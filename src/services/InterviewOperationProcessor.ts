import { randomUUID } from 'node:crypto';
import mongoose, { ClientSession } from 'mongoose';
import { inject, singleton } from 'tsyringe';
import { IEventPublisher } from '../domain/events/IEventPublisher';
import { IAiProvider, AiUsageMetadata } from '../domain/interview/types';
import { InterviewEvaluationResultModel } from '../models/InterviewEvaluationResult';
import { InterviewQuestionModel } from '../models/InterviewQuestion';
import { InterviewSessionModel } from '../models/InterviewSession';
import { InterviewSubmissionModel } from '../models/InterviewSubmission';
import { OperationAction, OperationRecordModel } from '../models/OperationRecord';
import { OutboxEventModel } from '../models/OutboxEvent';
import { ProviderUsageAttemptModel } from '../models/ProviderUsageAttempt';
import { UserQuotaLedgerModel } from '../models/UserQuotaLedger';
import { classifyProviderError } from './ai/provider-errors';
import { validateEvaluationResult, validateGeneratedQuestions } from './ai/output-validation';
import { evaluateThroughBoundary, generateThroughBoundary } from './ai/prompt-security';
import { resolveGenerationSetup } from './ai/job-security';
import type { CandidateQuestionPayload } from '../domain/interview/question-source/types';
import { logger } from '../infrastructure/logging/logger';
import { getEnv } from '../config/env';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface OperationProcessorHooks {
  afterProviderBeforeCommit?: (operationId: string) => void | Promise<void>;
  afterCommitBeforeAck?: (operationId: string) => void | Promise<void>;
}

export interface OperationProcessorOptions {
  now?: () => Date;
  random?: () => number;
  leaseMs?: number;
  maxAttempts?: number;
  baseRetryMs?: number;
  maxRetryMs?: number;
  hooks?: OperationProcessorHooks;
}

const withTransaction = async <T>(work: (session: ClientSession) => Promise<T>): Promise<T | undefined> => {
  const session = await mongoose.startSession();
  let result: T | undefined;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    });
  } finally {
    await session.endSession();
  }
  return result;
};

const usageFields = (usage: AiUsageMetadata) => ({
  promptTokens: usage.promptTokenCount,
  candidatesTokens: usage.candidatesTokenCount,
  totalTokens: usage.totalTokenCount
});

type GeneratedQuestionForCommit = {
  order: number;
  difficulty: string;
  content: { en: string; vi: string };
  sourceType?: CandidateQuestionPayload['sourceType'];
  questionBankQuestionId?: string | null;
  questionBankVersionId?: string | null;
  questionBankVersionNumber?: number | null;
  questionBankCode?: string | null;
  selectionPolicyVersion?: string | null;
  selectionSeedFingerprint?: string | null;
  promptSnapshotHash?: string | null;
  selectedAt?: Date | null;
};

@singleton()
export class InterviewOperationProcessor {
  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly leaseMs: number;
  private readonly maxAttempts: number;
  private readonly baseRetryMs: number;
  private readonly maxRetryMs: number;
  private readonly hooks: OperationProcessorHooks;

  constructor(
    @inject('IAiProvider') private readonly aiProvider: IAiProvider,
    @inject('IEventPublisher') private readonly eventPublisher: IEventPublisher,
    @inject('OperationProcessorOptions') options: OperationProcessorOptions = {},
    @inject('InterviewQuestionGenerationOrchestrator')
    private readonly questionSourceOrchestrator?: import('../domain/interview/question-source/InterviewQuestionGenerationOrchestrator').InterviewQuestionGenerationOrchestrator,
  ) {
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.leaseMs = options.leaseMs ?? 60_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseRetryMs = options.baseRetryMs ?? 1_000;
    this.maxRetryMs = options.maxRetryMs ?? 30_000;
    this.hooks = options.hooks ?? {};
  }

  async process(operationId: string, expectedAction: OperationAction): Promise<void> {
    if (!mongoose.isObjectIdOrHexString(operationId)) return;
    const now = this.now();
    const leaseToken = randomUUID();
    const operation = await OperationRecordModel.findOneAndUpdate(
      {
        _id: operationId,
        action: expectedAction,
        nextAttemptAt: { $lte: now },
        $or: [
          { status: 'PENDING' },
          { status: 'PROCESSING', leaseExpiresAt: { $lte: now } }
        ]
      },
      {
        $set: {
          status: 'PROCESSING',
          leaseToken,
          leaseExpiresAt: new Date(now.getTime() + this.leaseMs)
        },
        $inc: { attempts: 1 }
      },
      { returnDocument: 'after' }
    );
    if (!operation) return;

    await ProviderUsageAttemptModel.updateMany(
      { operationId: operation._id, status: 'STARTED' },
      { $set: { status: 'UNKNOWN', safeErrorCode: 'WORKER_RESTARTED', finishedAt: now } }
    );

    let generated: GeneratedQuestionForCommit[] | undefined;
    let evaluated: ReturnType<typeof validateEvaluationResult> | undefined;
    let usage: AiUsageMetadata | undefined;

    try {
      if (expectedAction === 'GENERATE_QUESTIONS') {
        const interview = await InterviewSessionModel.findById(operation.targetId).lean();
        if (!interview) throw new Error('Missing interview aggregate');
        await this.startUsageAttempt(operation._id, operation.attempts, now);
        const useQuestionBank =
          getEnv().INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED &&
          this.questionSourceOrchestrator;
        if (useQuestionBank) {
          const bundle = await this.questionSourceOrchestrator!.generateBundle(
            operation.targetId.toString(),
            interview.setupData,
          );
          usage = bundle.audit;
          generated = bundle.questions;
        } else {
          const resolvedSetupData = await resolveGenerationSetup(interview.setupData);
          const providerResult = await generateThroughBoundary(this.aiProvider, resolvedSetupData);
          usage = providerResult.audit;
          generated = validateGeneratedQuestions(providerResult.data);
        }
        await this.recordObservedUsage(operation._id, operation.attempts, usage);
      } else {
        const submission = await InterviewSubmissionModel.findOne({ operationId: operation._id }).lean();
        const questions = await InterviewQuestionModel.find({ sessionId: operation.targetId })
          .sort({ order: 1 })
          .lean();
        if (!submission || questions.length !== 5) throw new Error('Missing accepted submission snapshot');
        await this.startUsageAttempt(operation._id, operation.attempts, now);
        const answers = submission.answers.map((answer) => ({
          questionId: answer.questionId.toString(),
          candidateAnswer: answer.state === 'ANSWERED' ? answer.candidateAnswer ?? '' : ''
        }));
        const providerResult = await evaluateThroughBoundary(
          this.aiProvider,
          questions.map((question) => ({
            id: question._id.toString(),
            content: question.content
          })),
          answers,
        );
        usage = providerResult.audit;
        await this.recordObservedUsage(operation._id, operation.attempts, usage);
        evaluated = validateEvaluationResult(
          providerResult.data,
          questions.map((question) => question._id.toString())
        );
      }
    } catch (error) {
      logger.error('ai.provider_failed');
      await this.handleProviderFailure(operation, leaseToken, error, usage);
      return;
    }

    await this.hooks.afterProviderBeforeCommit?.(operation._id.toString());
    const finalVersion = expectedAction === 'GENERATE_QUESTIONS'
      ? await this.commitGeneratedQuestions(operation, leaseToken, generated!, usage!)
      : await this.commitEvaluation(operation, leaseToken, evaluated!, usage!);
    if (finalVersion === undefined) return;

    this.eventPublisher.publish('STATE_CHANGED', {
      interviewId: operation.targetId.toString(),
      status: expectedAction === 'GENERATE_QUESTIONS' ? 'IN_PROGRESS' : 'COMPLETED',
      version: finalVersion,
      updatedAt: this.now()
    });
    await this.hooks.afterCommitBeforeAck?.(operation._id.toString());
  }

  private async startUsageAttempt(
    operationId: mongoose.Types.ObjectId,
    attempt: number,
    startedAt: Date
  ): Promise<void> {
    await ProviderUsageAttemptModel.create({
      operationId,
      attempt,
      status: 'STARTED',
      startedAt
    });
  }

  private async recordObservedUsage(
    operationId: mongoose.Types.ObjectId,
    attempt: number,
    usage: AiUsageMetadata
  ): Promise<void> {
    await ProviderUsageAttemptModel.updateOne(
      { operationId, attempt, status: { $in: ['STARTED', 'UNKNOWN'] } },
      { $set: { usage: usageFields(usage) } }
    );
  }

  private async commitGeneratedQuestions(
    operation: any,
    leaseToken: string,
    questions: GeneratedQuestionForCommit[],
    usage: AiUsageMetadata
  ): Promise<number | undefined> {
    return withTransaction(async (session) => {
      const claimed = await OperationRecordModel.findOne({
        _id: operation._id,
        status: 'PROCESSING',
        leaseToken
      }).session(session);
      if (!claimed) return undefined;

      await InterviewQuestionModel.insertMany(
        questions.map((question) => ({
          sessionId: operation.targetId,
          ownerId: operation.actorId,
          order: question.order,
          difficulty: question.difficulty,
          content: question.content,
          sourceType: question.sourceType ?? 'AI_GENERATED',
          questionBankQuestionId: question.questionBankQuestionId
            ? new mongoose.Types.ObjectId(question.questionBankQuestionId)
            : null,
          questionBankVersionId: question.questionBankVersionId
            ? new mongoose.Types.ObjectId(question.questionBankVersionId)
            : null,
          questionBankVersionNumber: question.questionBankVersionNumber ?? null,
          questionBankCode: question.questionBankCode ?? null,
          selectionPolicyVersion: question.selectionPolicyVersion ?? null,
          selectionSeedFingerprint: question.selectionSeedFingerprint ?? null,
          promptSnapshotHash: question.promptSnapshotHash ?? null,
          selectedAt: question.selectedAt ?? new Date(),
          candidateAnswer: null,
          answerVersion: operation.aggregateVersion
        })),
        { session }
      );

      const transition = await InterviewSessionModel.updateOne(
        {
          _id: operation.targetId,
          status: 'GENERATING',
          version: operation.aggregateVersion,
          activeOperationId: operation._id
        },
        {
          $set: { status: 'IN_PROGRESS', activeOperationId: null, safeErrorCode: null },
          $inc: {
            version: 1,
            'metadata.promptTokens': usage.promptTokenCount,
            'metadata.candidatesTokens': usage.candidatesTokenCount,
            'metadata.totalTokens': usage.totalTokenCount
          }
        },
        { session }
      );
      if (transition.modifiedCount !== 1) throw new Error('Stale generation operation');

      await this.finishAccounting(operation, leaseToken, usage, session, operation.targetId);
      return operation.aggregateVersion + 1;
    });
  }

  private async commitEvaluation(
    operation: any,
    leaseToken: string,
    evaluation: ReturnType<typeof validateEvaluationResult>,
    usage: AiUsageMetadata
  ): Promise<number | undefined> {
    return withTransaction(async (session) => {
      const claimed = await OperationRecordModel.findOne({
        _id: operation._id,
        status: 'PROCESSING',
        leaseToken
      }).session(session);
      if (!claimed) return undefined;

      const submission = await InterviewSubmissionModel.findOne({ operationId: operation._id }).session(session);
      if (!submission || submission.status === 'COMPLETED') return undefined;
      const resultId = new mongoose.Types.ObjectId();
      await new InterviewEvaluationResultModel({
        _id: resultId,
        sessionId: operation.targetId,
        submissionVersion: submission.submissionVersion,
        operationId: operation._id,
        evaluations: evaluation.evaluations,
        overallScore: evaluation.overallScore,
        dimensions: evaluation.dimensions,
        learningPath: evaluation.learningPath
      }).save({ session });

      await InterviewQuestionModel.bulkWrite(
        evaluation.evaluations.map((item) => ({
          updateOne: {
            filter: { _id: item.questionId, sessionId: operation.targetId },
            update: { $set: { feedback: item.feedback, score: item.score } }
          }
        })),
        { session }
      );

      const completedAt = this.now();
      const transition = await InterviewSessionModel.updateOne(
        {
          _id: operation.targetId,
          status: 'EVALUATING',
          version: operation.aggregateVersion,
          activeOperationId: operation._id
        },
        {
          $set: {
            status: 'COMPLETED',
            activeOperationId: null,
            safeErrorCode: null,
            overallScore: evaluation.overallScore,
            dimensions: evaluation.dimensions,
            learningPath: evaluation.learningPath,
            terminalAt: completedAt,
            contentPurgeAt: new Date(completedAt.getTime() + 30 * DAY_MS),
            recordPurgeAt: new Date(completedAt.getTime() + 365 * DAY_MS)
          },
          $inc: {
            version: 1,
            'metadata.promptTokens': usage.promptTokenCount,
            'metadata.candidatesTokens': usage.candidatesTokenCount,
            'metadata.totalTokens': usage.totalTokenCount
          }
        },
        { session }
      );
      if (transition.modifiedCount !== 1) throw new Error('Stale evaluation operation');

      await InterviewSubmissionModel.updateOne(
        { _id: submission._id, status: { $in: ['ACCEPTED', 'EVALUATING'] } },
        { $set: { status: 'COMPLETED', resultRef: resultId } },
        { session }
      );
      await this.finishAccounting(operation, leaseToken, usage, session, resultId);
      return operation.aggregateVersion + 1;
    });
  }

  private async finishAccounting(
    operation: any,
    leaseToken: string,
    usage: AiUsageMetadata,
    session: ClientSession,
    responseRef: mongoose.Types.ObjectId
  ): Promise<void> {
    const usageDocument = usageFields(usage);
    await UserQuotaLedgerModel.updateOne(
      { operationId: operation._id, status: 'RESERVED' },
      { $set: { status: 'SETTLED', usage: usageDocument } },
      { session }
    );
    await ProviderUsageAttemptModel.updateOne(
      { operationId: operation._id, attempt: operation.attempts, status: 'STARTED' },
      { $set: { status: 'SUCCEEDED', usage: usageDocument, finishedAt: this.now() } },
      { session }
    );
    await OperationRecordModel.updateOne(
      { _id: operation._id, status: 'PROCESSING', leaseToken },
      {
        $set: {
          status: 'SUCCEEDED',
          responseRef,
          expiresAt: new Date(this.now().getTime() + 7 * DAY_MS)
        },
        $unset: { leaseToken: 1, leaseExpiresAt: 1 }
      },
      { session }
    );
  }

  private async handleProviderFailure(
    operation: any,
    leaseToken: string,
    error: unknown,
    usage?: AiUsageMetadata
  ): Promise<void> {
    const failure = classifyProviderError(error);
    const now = this.now();
    if (failure.retryable && operation.attempts < this.maxAttempts) {
      const exponential = Math.min(
        this.maxRetryMs,
        this.baseRetryMs * (2 ** Math.max(0, operation.attempts - 1))
      );
      const delay = Math.min(this.maxRetryMs, exponential + Math.floor(this.random() * this.baseRetryMs));
      const nextAttemptAt = new Date(now.getTime() + delay);
      await withTransaction(async (session) => {
        await ProviderUsageAttemptModel.updateOne(
          { operationId: operation._id, attempt: operation.attempts, status: 'STARTED' },
          {
            $set: {
              status: 'FAILED',
              safeErrorCode: failure.safeCode,
              finishedAt: now,
              ...(usage ? { usage: usageFields(usage) } : {})
            }
          },
          { session }
        );
        await OperationRecordModel.updateOne(
          { _id: operation._id, status: 'PROCESSING', leaseToken },
          {
            $set: { status: 'PENDING', safeErrorCode: failure.safeCode, nextAttemptAt },
            $unset: { leaseToken: 1, leaseExpiresAt: 1 }
          },
          { session }
        );
        await OutboxEventModel.updateOne(
          { operationId: operation._id },
          {
            $set: { status: 'PENDING', safeErrorCode: failure.safeCode, nextAttemptAt },
            $unset: { leaseToken: 1, leasedUntil: 1, publishedAt: 1 }
          },
          { session }
        );
      });
      return;
    }

    const safeCode = failure.retryable ? 'AI_RETRY_EXHAUSTED' : failure.safeCode;
    const failedVersion = await withTransaction(async (session) => {
      await ProviderUsageAttemptModel.updateOne(
        { operationId: operation._id, attempt: operation.attempts, status: 'STARTED' },
        {
          $set: {
            status: 'FAILED',
            safeErrorCode: safeCode,
            finishedAt: now,
            ...(usage ? { usage: usageFields(usage) } : {})
          }
        },
        { session }
      );
      await UserQuotaLedgerModel.updateOne(
        { operationId: operation._id, status: 'RESERVED' },
        { $set: { status: 'RELEASED' } },
        { session }
      );
      await OperationRecordModel.updateOne(
        { _id: operation._id, status: 'PROCESSING', leaseToken },
        {
          $set: {
            status: 'FAILED',
            safeErrorCode: safeCode,
            expiresAt: new Date(now.getTime() + 7 * DAY_MS)
          },
          $unset: { leaseToken: 1, leaseExpiresAt: 1 }
        },
        { session }
      );
      await OutboxEventModel.updateOne(
        { operationId: operation._id },
        { $set: { status: 'FAILED', safeErrorCode: safeCode } },
        { session }
      );
      const transition = await InterviewSessionModel.updateOne(
        {
          _id: operation.targetId,
          version: operation.aggregateVersion,
          activeOperationId: operation._id
        },
        {
          $set: {
            status: 'FAILED',
            activeOperationId: null,
            failedStage: operation.action === 'GENERATE_QUESTIONS' ? 'GENERATION' : 'EVALUATION',
            safeErrorCode: safeCode,
            terminalAt: now,
            contentPurgeAt: new Date(now.getTime() + 30 * DAY_MS),
            recordPurgeAt: new Date(now.getTime() + 365 * DAY_MS)
          },
          $inc: { version: 1 }
        },
        { session }
      );
      if (operation.action === 'SUBMIT_ANSWERS') {
        await InterviewSubmissionModel.updateOne(
          { operationId: operation._id },
          { $set: { status: 'FAILED', safeErrorCode: safeCode } },
          { session }
        );
      }
      return transition.modifiedCount === 1 ? operation.aggregateVersion + 1 : undefined;
    });

    if (failedVersion !== undefined) {
      this.eventPublisher.publish('STATE_CHANGED', {
        interviewId: operation.targetId.toString(),
        status: 'FAILED',
        version: failedVersion,
        updatedAt: now
      });
    }
  }
}
