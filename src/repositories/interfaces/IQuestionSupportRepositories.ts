import { ClientSession } from 'mongoose';
import {
  IdempotencyResultReference,
  IdempotencyStatus,
} from '../../models/idempotency-record.model';
import {
  QuestionOutboxEventType,
  QuestionOutboxSafePayload,
} from '../../models/outbox-event.model';

export interface IdempotencyRecordValue {
  id: string;
  scope: string;
  route: string;
  actorId: string;
  keyHash: string;
  requestFingerprint: string;
  status: IdempotencyStatus;
  result: {
    resourceType: 'QUESTION' | 'QUESTION_VERSION';
    questionId: string;
    versionNumber: number | null;
    httpStatus: number;
  } | null;
  failureCode: string | null;
  expiresAt: Date;
}

export interface CreateIdempotencyClaimInput {
  scope: string;
  route: string;
  actorId: string;
  keyHash: string;
  requestFingerprint: string;
  expiresAt: Date;
}

export interface FindIdempotencyClaimInput {
  scope: string;
  route: string;
  actorId: string;
  keyHash: string;
}

export interface CompleteIdempotencyClaimInput extends FindIdempotencyClaimInput {
  requestFingerprint: string;
  result: Omit<IdempotencyResultReference, 'questionId'> & { questionId: string };
}

export interface IQuestionCounterRepository {
  allocateCode(year: number, session: ClientSession): Promise<{
    code: string;
    sequence: number;
  }>;
}

export interface IQuestionIdempotencyRepository {
  createClaim(
    input: CreateIdempotencyClaimInput,
    session: ClientSession
  ): Promise<IdempotencyRecordValue>;
  findClaim(
    input: FindIdempotencyClaimInput,
    session?: ClientSession
  ): Promise<IdempotencyRecordValue | null>;
  completeClaim(
    input: CompleteIdempotencyClaimInput,
    session: ClientSession
  ): Promise<IdempotencyRecordValue | null>;
  markRetryableFailure(
    input: FindIdempotencyClaimInput & { failureCode: string },
    session?: ClientSession
  ): Promise<void>;
}

export interface EnqueueQuestionOutboxInput {
  aggregateId: string;
  eventType: QuestionOutboxEventType;
  payload: QuestionOutboxSafePayload;
  nextAttemptAt?: Date;
}

export interface IQuestionOutboxRepository {
  enqueue(input: EnqueueQuestionOutboxInput, session: ClientSession): Promise<string>;
}

export interface QuestionTaxonomyReferenceInput {
  roleIds: string[];
  levelIds: string[];
  technologyIds: string[];
}

export interface InvalidQuestionTaxonomyReferences {
  missing: QuestionTaxonomyReferenceInput;
  inactive: QuestionTaxonomyReferenceInput;
}

export interface IQuestionTaxonomyRepository {
  findInvalidReferences(
    input: QuestionTaxonomyReferenceInput,
    session?: ClientSession
  ): Promise<InvalidQuestionTaxonomyReferences>;
}

