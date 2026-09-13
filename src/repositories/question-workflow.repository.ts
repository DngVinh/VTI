import { ClientSession, Types } from 'mongoose';
import Question from '../models/question.model';
import QuestionReview, { IQuestionReview } from '../models/question-review.model';
import QuestionVersion from '../models/question-version.model';
import {
  IQuestionWorkflowRepository,
  LifecycleTransitionInput,
  PublishVersionInput,
  QuestionReviewRecord,
  ReviewDetailRecord,
  ReviewQueueQuery,
  ReviewQueueResult,
  TransitionVersionInput,
  WorkflowMutationResult,
} from './interfaces/IQuestionWorkflowRepository';
import { toQuestionRecord, toQuestionVersionRecord } from './question.repository';

const objectId = (value: string): Types.ObjectId => new Types.ObjectId(value);

const toReviewRecord = (record: IQuestionReview): QuestionReviewRecord => ({
  id: record._id.toString(),
  questionId: record.questionId.toString(),
  questionVersionId: record.questionVersionId?.toString() ?? null,
  revision: record.revision,
  actorId: record.actorId.toString(),
  action: record.action,
  comment: record.comment,
  fromState: record.fromState,
  toState: record.toState,
  requestId: record.requestId,
  createdAt: record.createdAt,
});

const appendAudit = async (
  input: {
    questionId: Types.ObjectId;
    versionId: Types.ObjectId | null;
    revision: number;
    actorId: string;
    action: IQuestionReview['action'];
    reason: string | null;
    fromState: string;
    toState: string;
    requestId: string;
  },
  session: ClientSession
): Promise<void> => {
  await QuestionReview.create(
    [{
      questionId: input.questionId,
      questionVersionId: input.versionId,
      revision: input.revision,
      actorId: objectId(input.actorId),
      action: input.action,
      comment: input.reason,
      fromState: input.fromState,
      toState: input.toState,
      requestId: input.requestId,
    }],
    { session }
  );
};

export class QuestionWorkflowRepository implements IQuestionWorkflowRepository {
  async listQueue(query: ReviewQueueQuery): Promise<ReviewQueueResult> {
    const status: Array<'IN_REVIEW' | 'APPROVED'> = query.status
      ? [query.status]
      : ['IN_REVIEW', 'APPROVED'];
    const activeQuestionIds = await Question.find({ lifecycleStatus: 'ACTIVE' }).distinct('_id');
    const filter = {
      questionId: { $in: activeQuestionIds },
      status: { $in: status },
    };
    const [versions, total] = await Promise.all([
      QuestionVersion.find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      QuestionVersion.countDocuments(filter),
    ]);
    const questionIds = versions.map((version) => version.questionId);
    const questions = await Question.find({
      _id: { $in: questionIds },
      lifecycleStatus: 'ACTIVE',
    }).exec();
    const byId = new Map(questions.map((question) => [question._id.toString(), question]));
    const items = versions.flatMap((version) => {
      const question = byId.get(version.questionId.toString());
      return question
        ? [{ question: toQuestionRecord(question), version: toQuestionVersionRecord(version) }]
        : [];
    });
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findReviewDetail(questionVersionId: string): Promise<ReviewDetailRecord | null> {
    const version = await QuestionVersion.findById(questionVersionId).exec();
    if (!version) return null;
    const [question, history] = await Promise.all([
      Question.findById(version.questionId).exec(),
      QuestionReview.find({ questionVersionId: version._id }).sort({ createdAt: 1, _id: 1 }).exec(),
    ]);
    if (!question || history.length === 0) return null;
    const pointerIds = [question.draftVersionId, question.currentPublishedVersionId].filter(
      (id): id is Types.ObjectId => id !== null
    );
    const pointerVersions = await QuestionVersion.find({ _id: { $in: pointerIds } })
      .select('_id versionNumber')
      .exec();
    const pointerNumber = new Map(
      pointerVersions.map((pointer) => [pointer._id.toString(), pointer.versionNumber])
    );
    return {
      question: toQuestionRecord(question),
      version: toQuestionVersionRecord(version),
      history: history.map(toReviewRecord),
      draftVersionNumber: question.draftVersionId
        ? pointerNumber.get(question.draftVersionId.toString()) ?? null
        : null,
      currentPublishedVersionNumber: question.currentPublishedVersionId
        ? pointerNumber.get(question.currentPublishedVersionId.toString()) ?? null
        : null,
    };
  }

  async transitionVersion(
    input: TransitionVersionInput,
    session: ClientSession
  ): Promise<WorkflowMutationResult> {
    const question = await Question.findById(input.questionId).session(session);
    if (!question) return { kind: 'question-not-found' };
    if (question.lifecycleStatus !== 'ACTIVE') return { kind: 'retired' };
    const previous = await QuestionVersion.findOne({
      questionId: question._id,
      versionNumber: input.versionNumber,
      status: { $in: input.from },
      revision: input.expectedRevision,
    }).session(session);
    if (!previous) {
      const current = await QuestionVersion.findOne({
        questionId: question._id,
        versionNumber: input.versionNumber,
      }).session(session);
      if (!current) return { kind: 'version-not-found' };
      if (!input.from.includes(current.status as never)) {
        return { kind: 'invalid-state', currentState: current.status };
      }
      return { kind: 'conflict', currentRevision: current.revision };
    }
    const version = await QuestionVersion.findOneAndUpdate(
      {
        _id: previous._id,
        status: previous.status,
        revision: previous.revision,
      },
      {
        $set: { status: input.to, updatedBy: objectId(input.actorId) },
        $inc: { revision: 1 },
      },
      { returnDocument: 'after', runValidators: true, session }
    );
    if (!version) {
      const current = await QuestionVersion.findOne({
        questionId: question._id,
        versionNumber: input.versionNumber,
      }).session(session);
      if (!current) return { kind: 'version-not-found' };
      if (!input.from.includes(current.status as never)) {
        return { kind: 'invalid-state', currentState: current.status };
      }
      return { kind: 'conflict', currentRevision: current.revision };
    }
    await appendAudit({
      questionId: question._id,
      versionId: version._id,
      revision: version.revision,
      actorId: input.actorId,
      action: input.action,
      reason: input.reason,
      fromState: previous.status,
      toState: input.to,
      requestId: input.requestId,
    }, session);
    return {
      kind: 'updated',
      question: toQuestionRecord(question),
      version: toQuestionVersionRecord(version),
    };
  }

  async publishVersion(
    input: PublishVersionInput,
    session: ClientSession
  ): Promise<WorkflowMutationResult & { supersededVersionNumber?: number }> {
    const question = await Question.findById(input.questionId).session(session);
    if (!question) return { kind: 'question-not-found' };
    if (question.lifecycleStatus !== 'ACTIVE') return { kind: 'retired' };
    const targetCandidate = await QuestionVersion.findOne(
      {
        questionId: question._id,
        versionNumber: input.versionNumber,
        status: 'APPROVED',
        revision: input.expectedRevision,
      }
    ).session(session);
    if (!targetCandidate) {
      const current = await QuestionVersion.findOne({
        questionId: question._id,
        versionNumber: input.versionNumber,
      }).session(session);
      if (!current) return { kind: 'version-not-found' };
      if (current.status !== 'APPROVED') return { kind: 'invalid-state', currentState: current.status };
      return { kind: 'conflict', currentRevision: current.revision };
    }

    let supersededVersionNumber: number | undefined;
    if (
      question.currentPublishedVersionId &&
      !question.currentPublishedVersionId.equals(targetCandidate._id)
    ) {
      const old = await QuestionVersion.findOneAndUpdate(
        { _id: question.currentPublishedVersionId, questionId: question._id, status: 'PUBLISHED' },
        { $set: { status: 'SUPERSEDED', updatedBy: objectId(input.actorId) }, $inc: { revision: 1 } },
        { returnDocument: 'after', runValidators: true, session }
      );
      if (!old) return { kind: 'invalid-state', currentState: 'PUBLISHED_POINTER_INVALID' };
      supersededVersionNumber = old.versionNumber;
      await appendAudit({
        questionId: question._id,
        versionId: old._id,
        revision: old.revision,
        actorId: input.actorId,
        action: 'PUBLISH',
        reason: input.reason,
        fromState: 'PUBLISHED',
        toState: 'SUPERSEDED',
        requestId: input.requestId,
      }, session);
    }

    const target = await QuestionVersion.findOneAndUpdate(
      { _id: targetCandidate._id, status: 'APPROVED', revision: input.expectedRevision },
      { $set: { status: 'PUBLISHED', updatedBy: objectId(input.actorId) }, $inc: { revision: 1 } },
      { returnDocument: 'after', runValidators: true, session }
    );
    if (!target) {
      throw new Error('Publish transaction lost the approved version after superseding the prior version');
    }

    const updatedQuestion = await Question.findOneAndUpdate(
      {
        _id: question._id,
        lifecycleStatus: 'ACTIVE',
        draftVersionId: target._id,
        revision: question.revision,
      },
      {
        $set: {
          currentPublishedVersionId: target._id,
          draftVersionId: null,
          updatedBy: objectId(input.actorId),
        },
        $inc: { revision: 1 },
      },
      { returnDocument: 'after', runValidators: true, session }
    );
    if (!updatedQuestion) return { kind: 'conflict', currentRevision: question.revision + 1 };
    await appendAudit({
      questionId: question._id,
      versionId: target._id,
      revision: target.revision,
      actorId: input.actorId,
      action: 'PUBLISH',
      reason: input.reason,
      fromState: 'APPROVED',
      toState: 'PUBLISHED',
      requestId: input.requestId,
    }, session);
    return {
      kind: 'updated',
      question: toQuestionRecord(updatedQuestion),
      version: toQuestionVersionRecord(target),
      supersededVersionNumber,
    };
  }

  async transitionLifecycle(
    input: LifecycleTransitionInput,
    session: ClientSession
  ) {
    const question = await Question.findOneAndUpdate(
      { _id: objectId(input.questionId), lifecycleStatus: input.from, revision: input.expectedRevision },
      {
        $set: { lifecycleStatus: input.to, updatedBy: objectId(input.actorId) },
        $inc: { revision: 1 },
      },
      { returnDocument: 'after', runValidators: true, session }
    );
    if (!question) {
      const current = await Question.findById(input.questionId).session(session);
      if (!current) return { kind: 'question-not-found' as const };
      if (current.lifecycleStatus !== input.from) {
        return { kind: 'invalid-state' as const, currentState: current.lifecycleStatus };
      }
      return { kind: 'conflict' as const, currentRevision: current.revision };
    }
    await appendAudit({
      questionId: question._id,
      versionId: question.draftVersionId ?? question.currentPublishedVersionId ?? null,
      revision: question.revision,
      actorId: input.actorId,
      action: input.to === 'RETIRED' ? 'RETIRE' : 'RESTORE',
      reason: input.reason,
      fromState: input.from,
      toState: input.to,
      requestId: input.requestId,
    }, session);
    const versionId = question.draftVersionId ?? question.currentPublishedVersionId;
    const version = versionId ? await QuestionVersion.findById(versionId).session(session) : null;
    return {
      kind: 'updated' as const,
      question: toQuestionRecord(question),
      version: version ? toQuestionVersionRecord(version) : null as never,
    };
  }
}
