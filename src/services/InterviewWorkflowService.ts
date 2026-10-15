import { createHash } from 'node:crypto';
import { inject, injectable } from 'tsyringe';
import mongoose, { ClientSession } from 'mongoose';
import { IInterviewRepository } from '../repositories/IInterviewRepository';
import { AnswerPayload, InterviewSetupPayload } from '../domain/interview/types';
import { AppError } from '../utils/AppError';
import { InterviewSessionModel } from '../models/InterviewSession';
import { InterviewQuestionModel } from '../models/InterviewQuestion';
import { OperationRecordModel } from '../models/OperationRecord';
import { OutboxEventModel } from '../models/OutboxEvent';
import {
  InterviewSubmissionModel,
  SubmissionAnswerState
} from '../models/InterviewSubmission';
import { UserQuotaLedgerModel } from '../models/UserQuotaLedger';
import { JdValidatorService } from './ai/JdValidatorService';

const GENERATE_ROUTE = '/api/v1/interviews/:id/generate';
const SUBMIT_ROUTE = '/api/v1/interviews/:id/submit';

export interface SubmitAnswerInput {
  questionId: string;
  state: SubmissionAnswerState;
  candidateAnswer?: string;
}

export interface OperationReceipt {
  operationId: string;
  action: 'GENERATE_QUESTIONS' | 'SUBMIT_ANSWERS';
  targetId: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  aggregateVersion: number;
  responseRef?: string;
  safeErrorCode?: string;
  replayed: boolean;
}

const sha256 = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

const canonicalize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const transaction = async <T>(work: (session: ClientSession) => Promise<T>): Promise<T> => {
  const mongoSession = await mongoose.startSession();
  let result: T | undefined;
  try {
    await mongoSession.withTransaction(async () => {
      result = await work(mongoSession);
    });
  } finally {
    await mongoSession.endSession();
  }
  if (result === undefined) {
    throw new AppError('Không thể hoàn tất giao dịch', 503, 'DEPENDENCY_UNAVAILABLE');
  }
  return result;
};

const isDuplicateKeyError = (error: unknown): boolean =>
  (error as { code?: number })?.code === 11000;

@injectable()
export class InterviewWorkflowService {
  constructor(@inject('IInterviewRepository') private interviewRepo: IInterviewRepository) {}

  async createInterviewSession(setupData: InterviewSetupPayload, actorId: string) {
    this.requireObjectId(actorId, 'AUTH_UNAUTHORIZED');
    return this.interviewRepo.create(setupData, actorId);
  }

  async createInterviewSessionFromJD(
    setupData: Omit<InterviewSetupPayload, 'jdText'>,
    fileBuffer: Buffer,
    mimeType: string,
    actorId: string
  ) {
    try {
      const { FileParserFactory } = await import('../utils/parsers/FileParserFactory');
      const parser = FileParserFactory.getParser(mimeType);
      const jdText = await parser.parse(fileBuffer);
      const validation = JdValidatorService.validate(jdText);
      if (!validation.isValid) {
        throw new AppError(
          validation.reason || 'Nội dung tệp không phải bản mô tả công việc (JD) hợp lệ',
          422,
          'INVALID_JD_CONTENT',
        );
      }
      return this.createInterviewSession(
        { ...setupData, jdText: jdText.substring(0, 10000) },
        actorId
      );
    } finally {
      fileBuffer.fill(0);
    }
  }

  async getInterviewSession(id: string, actorId?: string) {
    const interview = await this.interviewRepo.findById(id);
    if (!interview) {
      throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
    }
    if (actorId && interview.userId !== actorId) {
      throw new AppError('Bạn không có quyền truy cập phiên phỏng vấn này', 403, 'AUTH_FORBIDDEN');
    }
    return interview;
  }

  async generateQuestions(
    id: string,
    actorId: string,
    idempotencyKey: string
  ): Promise<OperationReceipt> {
    this.requireObjectId(id, 'VALIDATION_ERROR');
    this.requireObjectId(actorId, 'AUTH_UNAUTHORIZED');
    const keyHash = sha256(idempotencyKey);
    const fingerprint = sha256(canonicalize({ action: 'GENERATE_QUESTIONS', targetId: id }));
    const replay = await this.findReplay(actorId, GENERATE_ROUTE, keyHash, fingerprint);
    if (replay) return this.toReceipt(replay, true);

    try {
      return await transaction(async (mongoSession) => {
        const existing = await OperationRecordModel.findOne({
          actorId,
          route: GENERATE_ROUTE,
          idempotencyKeyHash: keyHash
        }).session(mongoSession);
        if (existing) {
          this.assertFingerprint(existing.requestFingerprint, fingerprint);
          return this.toReceipt(existing, true);
        }

        const interview = await InterviewSessionModel.findById(id).session(mongoSession);
        this.assertOwnedInterview(interview, actorId);
        if (interview!.status !== 'PENDING') {
          throw new AppError('Trạng thái phiên đã thay đổi', 409, 'STATE_CONFLICT');
        }

        const operationId = new mongoose.Types.ObjectId();
        const aggregateVersion = interview!.version + 1;
        const operation = new OperationRecordModel({
          _id: operationId,
          actorId,
          route: GENERATE_ROUTE,
          action: 'GENERATE_QUESTIONS',
          targetId: id,
          idempotencyKeyHash: keyHash,
          requestFingerprint: fingerprint,
          status: 'PENDING',
          aggregateVersion,
          responseRef: interview!._id,
          nextAttemptAt: new Date()
        });
        await operation.save({ session: mongoSession });

        const transition = await InterviewSessionModel.updateOne(
          { _id: id, userId: actorId, status: 'PENDING', version: interview!.version },
          {
            $set: {
              status: 'GENERATING',
              activeOperationId: operationId,
              failedStage: null,
              safeErrorCode: null
            },
            $inc: { version: 1 }
          },
          { session: mongoSession }
        );
        if (transition.modifiedCount !== 1) {
          throw new AppError('Trạng thái phiên đã thay đổi', 409, 'STATE_CONFLICT');
        }

        await new UserQuotaLedgerModel({
          actorId,
          operationId,
          quotaType: 'AI_GENERATION',
          reservedUnits: 1,
          status: 'RESERVED'
        }).save({ session: mongoSession });

        await new OutboxEventModel({
          businessKey: `GENERATE:${id}:${aggregateVersion}`,
          eventType: 'INTERVIEW_GENERATION_REQUESTED',
          aggregateId: id,
          aggregateVersion,
          operationId,
          status: 'PENDING',
          nextAttemptAt: new Date()
        }).save({ session: mongoSession });

        return this.toReceipt(operation, false);
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const concurrentReplay = await this.findReplay(actorId, GENERATE_ROUTE, keyHash, fingerprint);
        if (concurrentReplay) return this.toReceipt(concurrentReplay, true);
      }
      throw error;
    }
  }

  async submitAnswers(
    id: string,
    actorId: string,
    idempotencyKey: string,
    expectedVersion: number,
    answers: SubmitAnswerInput[]
  ): Promise<OperationReceipt> {
    this.requireObjectId(id, 'VALIDATION_ERROR');
    this.requireObjectId(actorId, 'AUTH_UNAUTHORIZED');
    const normalizedAnswers = [...answers]
      .map((answer) => ({
        questionId: answer.questionId,
        state: answer.state,
        ...(answer.state === 'ANSWERED' ? { candidateAnswer: answer.candidateAnswer?.trim() ?? '' } : {})
      }))
      .sort((left, right) => left.questionId.localeCompare(right.questionId));
    const keyHash = sha256(idempotencyKey);
    const fingerprint = sha256(canonicalize({
      action: 'SUBMIT_ANSWERS',
      targetId: id,
      expectedVersion,
      answers: normalizedAnswers
    }));
    const replay = await this.findReplay(actorId, SUBMIT_ROUTE, keyHash, fingerprint);
    if (replay) return this.toReceipt(replay, true);

    try {
      return await transaction(async (mongoSession) => {
        const existing = await OperationRecordModel.findOne({
          actorId,
          route: SUBMIT_ROUTE,
          idempotencyKeyHash: keyHash
        }).session(mongoSession);
        if (existing) {
          this.assertFingerprint(existing.requestFingerprint, fingerprint);
          return this.toReceipt(existing, true);
        }

        const interview = await InterviewSessionModel.findById(id).session(mongoSession);
        this.assertOwnedInterview(interview, actorId);
        if (
          (interview!.status !== 'IN_PROGRESS' && interview!.status !== 'FOLLOW_UP') ||
          interview!.version !== expectedVersion
        ) {
          throw new AppError('Trạng thái hoặc phiên bản phiên đã thay đổi', 409, 'STATE_CONFLICT');
        }

        const questions = await InterviewQuestionModel.find({ sessionId: id })
          .sort({ order: 1 })
          .session(mongoSession);
        const persistedIds = questions.map((question) => question._id.toString()).sort();
        const submittedIds = normalizedAnswers.map((answer) => answer.questionId).sort();
        if (
          questions.length < 1 ||
          questions.length > 5 ||
          submittedIds.length !== questions.length ||
          submittedIds.some((questionId, index) => questionId !== persistedIds[index])
        ) {
          throw new AppError('Câu trả lời không khớp bộ câu hỏi của phiên', 400, 'VALIDATION_ERROR');
        }

        const operationId = new mongoose.Types.ObjectId();
        const submissionId = new mongoose.Types.ObjectId();
        const aggregateVersion = expectedVersion + 1;
        const submissionVersion = interview!.submissionVersion + 1;
        const operation = new OperationRecordModel({
          _id: operationId,
          actorId,
          route: SUBMIT_ROUTE,
          action: 'SUBMIT_ANSWERS',
          targetId: id,
          idempotencyKeyHash: keyHash,
          requestFingerprint: fingerprint,
          status: 'PENDING',
          aggregateVersion,
          responseRef: submissionId,
          nextAttemptAt: new Date()
        });
        await operation.save({ session: mongoSession });

        await new InterviewSubmissionModel({
          _id: submissionId,
          sessionId: id,
          ownerId: actorId,
          submissionVersion,
          operationId,
          answers: normalizedAnswers,
          answerFingerprint: fingerprint,
          status: 'ACCEPTED'
        }).save({ session: mongoSession });

        const transition = await InterviewSessionModel.updateOne(
          { _id: id, userId: actorId, status: { $in: ['IN_PROGRESS', 'FOLLOW_UP'] }, version: expectedVersion },
          {
            $set: {
              status: 'EVALUATING',
              activeOperationId: operationId,
              submissionVersion,
              failedStage: null,
              safeErrorCode: null
            },
            $inc: { version: 1 }
          },
          { session: mongoSession }
        );
        if (transition.modifiedCount !== 1) {
          throw new AppError('Trạng thái hoặc phiên bản phiên đã thay đổi', 409, 'STATE_CONFLICT');
        }

        await InterviewQuestionModel.bulkWrite(
          normalizedAnswers.map((answer) => ({
            updateOne: {
              filter: { _id: answer.questionId, sessionId: id },
              update: {
                $set: {
                  candidateAnswer: answer.state === 'ANSWERED' ? answer.candidateAnswer : null,
                  answerVersion: aggregateVersion
                }
              }
            }
          })),
          { session: mongoSession }
        );

        await new UserQuotaLedgerModel({
          actorId,
          operationId,
          quotaType: 'AI_EVALUATION',
          reservedUnits: 1,
          status: 'RESERVED'
        }).save({ session: mongoSession });

        await new OutboxEventModel({
          businessKey: `EVALUATE:${id}:${submissionVersion}`,
          eventType: 'INTERVIEW_EVALUATION_REQUESTED',
          aggregateId: id,
          aggregateVersion,
          operationId,
          status: 'PENDING',
          nextAttemptAt: new Date()
        }).save({ session: mongoSession });

        return this.toReceipt(operation, false);
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const concurrentReplay = await this.findReplay(actorId, SUBMIT_ROUTE, keyHash, fingerprint);
        if (concurrentReplay) return this.toReceipt(concurrentReplay, true);
      }
      throw error;
    }
  }

  async saveProgress(
    id: string,
    actorId: string,
    expectedVersion: number,
    answers: AnswerPayload[]
  ): Promise<{ version: number; status: 'IN_PROGRESS' | 'FOLLOW_UP' }> {
    this.requireObjectId(id, 'VALIDATION_ERROR');
    this.requireObjectId(actorId, 'AUTH_UNAUTHORIZED');

    return transaction(async (mongoSession) => {
      const interview = await InterviewSessionModel.findById(id).session(mongoSession);
      this.assertOwnedInterview(interview, actorId);
      if (
        (interview!.status !== 'IN_PROGRESS' && interview!.status !== 'FOLLOW_UP') ||
        interview!.version !== expectedVersion
      ) {
        throw new AppError('Bản lưu nháp đã cũ', 409, 'VERSION_CONFLICT');
      }

      const questionIds = answers.map((answer) => answer.questionId);
      const matchedQuestions = await InterviewQuestionModel.countDocuments({
        _id: { $in: questionIds },
        sessionId: id
      }).session(mongoSession);
      if (matchedQuestions !== questionIds.length) {
        throw new AppError('Câu trả lời không thuộc phiên phỏng vấn', 400, 'VALIDATION_ERROR');
      }

      const nextVersion = expectedVersion + 1;
      const transition = await InterviewSessionModel.updateOne(
        { _id: id, userId: actorId, status: { $in: ['IN_PROGRESS', 'FOLLOW_UP'] }, version: expectedVersion },
        { $inc: { version: 1 } },
        { session: mongoSession }
      );
      if (transition.modifiedCount !== 1) {
        throw new AppError('Bản lưu nháp đã cũ', 409, 'VERSION_CONFLICT');
      }

      await InterviewQuestionModel.bulkWrite(
        answers.map((answer) => ({
          updateOne: {
            filter: { _id: answer.questionId, sessionId: id },
            update: {
              $set: { candidateAnswer: answer.candidateAnswer, answerVersion: nextVersion }
            }
          }
        })),
        { session: mongoSession }
      );
      return { version: nextVersion, status: interview!.status as 'IN_PROGRESS' | 'FOLLOW_UP' };
    });
  }

  private async findReplay(
    actorId: string,
    route: string,
    keyHash: string,
    fingerprint: string
  ) {
    const existing = await OperationRecordModel.findOne({
      actorId,
      route,
      idempotencyKeyHash: keyHash
    });
    if (!existing) return null;
    this.assertFingerprint(existing.requestFingerprint, fingerprint);
    return existing;
  }

  private assertFingerprint(existing: string, requested: string): void {
    if (existing !== requested) {
      throw new AppError(
        'Idempotency-Key đã được dùng cho một yêu cầu khác',
        409,
        'IDEMPOTENCY_CONFLICT'
      );
    }
  }

  private assertOwnedInterview(
    interview: { userId?: string | null } | null,
    actorId: string
  ): void {
    if (!interview) {
      throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
    }
    if (String(interview.userId ?? '') !== actorId) {
      throw new AppError('Bạn không có quyền truy cập phiên phỏng vấn này', 403, 'AUTH_FORBIDDEN');
    }
  }

  private requireObjectId(value: string, code: string): void {
    if (!mongoose.isObjectIdOrHexString(value)) {
      throw new AppError('Định danh không hợp lệ', 400, code);
    }
  }

  private toReceipt(operation: any, replayed: boolean): OperationReceipt {
    return {
      operationId: operation._id.toString(),
      action: operation.action,
      targetId: operation.targetId.toString(),
      status: operation.status,
      aggregateVersion: operation.aggregateVersion,
      ...(operation.responseRef ? { responseRef: operation.responseRef.toString() } : {}),
      ...(operation.safeErrorCode ? { safeErrorCode: operation.safeErrorCode } : {}),
      replayed
    };
  }
}
