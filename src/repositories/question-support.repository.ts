import { randomUUID } from 'node:crypto';
import { ClientSession, Types } from 'mongoose';
import IdempotencyRecord, {
  IIdempotencyRecord,
} from '../models/idempotency-record.model';
import OutboxEvent from '../models/outbox-event.model';
import QuestionCounter from '../models/question-counter.model';
import Role from '../models/role.model';
import Level from '../models/level.model';
import Technology from '../models/technology.model';
import { QuestionBankDomainError } from '../domain/question-bank/errors';
import {
  CompleteIdempotencyClaimInput,
  CreateIdempotencyClaimInput,
  EnqueueQuestionOutboxInput,
  FindIdempotencyClaimInput,
  IdempotencyRecordValue,
  IQuestionCounterRepository,
  IQuestionIdempotencyRepository,
  IQuestionOutboxRepository,
  IQuestionTaxonomyRepository,
  InvalidQuestionTaxonomyReferences,
  QuestionTaxonomyReferenceInput,
} from './interfaces/IQuestionSupportRepositories';

const objectId = (value: string): Types.ObjectId => new Types.ObjectId(value);

const toIdempotencyValue = (record: IIdempotencyRecord): IdempotencyRecordValue => ({
  id: record._id.toString(),
  scope: record.scope,
  route: record.route,
  actorId: record.actorId.toString(),
  keyHash: record.keyHash,
  requestFingerprint: record.requestFingerprint,
  status: record.status,
  result: record.result
    ? {
        resourceType: record.result.resourceType,
        questionId: record.result.questionId.toString(),
        versionNumber: record.result.versionNumber,
        httpStatus: record.result.httpStatus,
      }
    : null,
  failureCode: record.failureCode,
  expiresAt: record.expiresAt,
});

export class QuestionCounterRepository implements IQuestionCounterRepository {
  async allocateCode(
    year: number,
    session: ClientSession
  ): Promise<{ code: string; sequence: number }> {
    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      throw new QuestionBankDomainError('VALIDATION_ERROR', 'Năm cấp mã câu hỏi không hợp lệ');
    }

    const counter = await QuestionCounter.findOneAndUpdate(
      { scope: 'QUESTION_CODE', year },
      {
        $inc: { sequence: 1 },
        $setOnInsert: { scope: 'QUESTION_CODE', year },
      },
      { upsert: true, returnDocument: 'after', session, setDefaultsOnInsert: true }
    );

    if (!counter || counter.sequence > 999_999) {
      throw new QuestionBankDomainError(
        'QUESTION_CODE_CONFLICT',
        'Dải mã câu hỏi trong năm hiện tại đã được sử dụng hết'
      );
    }

    return {
      sequence: counter.sequence,
      code: `QB-${year}-${String(counter.sequence).padStart(6, '0')}`,
    };
  }
}

export class QuestionIdempotencyRepository implements IQuestionIdempotencyRepository {
  async createClaim(
    input: CreateIdempotencyClaimInput,
    session: ClientSession
  ): Promise<IdempotencyRecordValue> {
    const [record] = await IdempotencyRecord.create(
      [
        {
          ...input,
          actorId: new Types.ObjectId(input.actorId),
          status: 'IN_PROGRESS',
          result: null,
          failureCode: null,
        },
      ],
      { session }
    );
    return toIdempotencyValue(record);
  }

  async findClaim(
    input: FindIdempotencyClaimInput,
    session?: ClientSession
  ): Promise<IdempotencyRecordValue | null> {
    const query = IdempotencyRecord.findOne({
      scope: input.scope,
      route: input.route,
      actorId: new Types.ObjectId(input.actorId),
      keyHash: input.keyHash,
    });
    if (session) query.session(session);
    const record = await query.exec();
    return record ? toIdempotencyValue(record) : null;
  }

  async completeClaim(
    input: CompleteIdempotencyClaimInput,
    session: ClientSession
  ): Promise<IdempotencyRecordValue | null> {
    const record = await IdempotencyRecord.findOneAndUpdate(
      {
        scope: input.scope,
        route: input.route,
        actorId: new Types.ObjectId(input.actorId),
        keyHash: input.keyHash,
        requestFingerprint: input.requestFingerprint,
        status: 'IN_PROGRESS',
      },
      {
        $set: {
          status: 'COMPLETED',
          result: {
            ...input.result,
            questionId: new Types.ObjectId(input.result.questionId),
          },
          failureCode: null,
        },
      },
      { returnDocument: 'after', session }
    );
    return record ? toIdempotencyValue(record) : null;
  }

  async markRetryableFailure(
    input: FindIdempotencyClaimInput & { failureCode: string },
    session?: ClientSession
  ): Promise<void> {
    const query = IdempotencyRecord.updateOne(
      {
        scope: input.scope,
        route: input.route,
        actorId: new Types.ObjectId(input.actorId),
        keyHash: input.keyHash,
        status: 'IN_PROGRESS',
      },
      { $set: { status: 'FAILED_RETRYABLE', failureCode: input.failureCode } }
    );
    if (session) query.session(session);
    await query.exec();
  }
}

export class QuestionOutboxRepository implements IQuestionOutboxRepository {
  async enqueue(input: EnqueueQuestionOutboxInput, session: ClientSession): Promise<string> {
    const eventId = randomUUID();
    await OutboxEvent.create(
      [
        {
          eventId,
          aggregateType: 'QUESTION',
          aggregateId: new Types.ObjectId(input.aggregateId),
          eventType: input.eventType,
          payload: input.payload,
          status: 'PENDING',
          attempts: 0,
          nextAttemptAt: input.nextAttemptAt ?? new Date(),
          publishedAt: null,
        },
      ],
      { session }
    );
    return eventId;
  }
}

interface TaxonomyState {
  id: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const classifyReferences = (
  requested: readonly string[],
  found: readonly TaxonomyState[]
): { missing: string[]; inactive: string[] } => {
  const byId = new Map(found.map((item) => [item.id, item.status]));
  return {
    missing: requested.filter((id) => !byId.has(id)),
    inactive: requested.filter((id) => byId.get(id) === 'INACTIVE'),
  };
};

export class QuestionTaxonomyRepository implements IQuestionTaxonomyRepository {
  async findInvalidReferences(
    input: QuestionTaxonomyReferenceInput,
    session?: ClientSession
  ): Promise<InvalidQuestionTaxonomyReferences> {
    const roleQuery = Role.find({ _id: { $in: input.roleIds.map(objectId) } }).select('_id status');
    const levelQuery = Level.find({ _id: { $in: input.levelIds.map(objectId) } }).select('_id status');
    const technologyQuery = Technology.find({
      _id: { $in: input.technologyIds.map(objectId) },
    }).select('_id status');
    if (session) {
      roleQuery.session(session);
      levelQuery.session(session);
      technologyQuery.session(session);
    }

    // MongoDB transactions do not support parallel operations on one session.
    const roles = await roleQuery.exec();
    const levels = await levelQuery.exec();
    const technologies = await technologyQuery.exec();

    const roleState = classifyReferences(
      input.roleIds,
      roles.map((item) => ({ id: item._id.toString(), status: item.status }))
    );
    const levelState = classifyReferences(
      input.levelIds,
      levels.map((item) => ({ id: item._id.toString(), status: item.status }))
    );
    const technologyState = classifyReferences(
      input.technologyIds,
      technologies.map((item) => ({ id: item._id.toString(), status: item.status }))
    );

    return {
      missing: {
        roleIds: roleState.missing,
        levelIds: levelState.missing,
        technologyIds: technologyState.missing,
      },
      inactive: {
        roleIds: roleState.inactive,
        levelIds: levelState.inactive,
        technologyIds: technologyState.inactive,
      },
    };
  }
}

