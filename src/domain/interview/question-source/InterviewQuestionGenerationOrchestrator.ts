import { injectable, inject } from 'tsyringe';
import { IInterviewRepository } from '../../../repositories/IInterviewRepository';
import { IEventPublisher } from '../../events/IEventPublisher';
import { IAiProvider } from '../types';
import {
  CandidateQuestionPayload,
  ExactFiveBundle,
  IQuestionBankSelector,
  InterviewQuestionSourceMode,
  INTERVIEW_SOURCE_ERROR_CODES,
  QuestionSourceContext,
  ShadowDiagnostics,
} from './types';
import {
  resolveEffectiveSourceMode,
  resolveRolloutDecision,
  RolloutDecision,
  SourcePolicyConfig,
} from './InterviewQuestionSourcePolicy';
import { AiInterviewQuestionSource } from './AiInterviewQuestionSource';
import { QuestionBankInterviewQuestionSource } from './QuestionBankInterviewQuestionSource';
import { HybridInterviewQuestionSource } from './HybridInterviewQuestionSource';
import { InterviewQuestionBundleValidator } from './InterviewQuestionBundleValidator';
import { AppError } from '../../../utils/AppError';
import { logger } from '../../../infrastructure/logging/logger';
import { InterviewQuestionModel } from '../../../models/InterviewQuestion';
import {
  QuestionSourcingTelemetryService,
  sanitizeQuestionSourcingReasonCode,
} from '../../../services/question-sourcing-telemetry.service';
import { getEnv } from '../../../config/env';

@injectable()
export class InterviewQuestionGenerationOrchestrator {
  private aiSource: AiInterviewQuestionSource;
  private bankSource: QuestionBankInterviewQuestionSource;
  private hybridSource: HybridInterviewQuestionSource;

  constructor(
    @inject('IInterviewRepository') private repository: IInterviewRepository,
    @inject('IAiProvider') private aiProvider: IAiProvider,
    @inject('IQuestionBankSelector') private selector: IQuestionBankSelector,
    @inject('IEventPublisher') private eventPublisher?: IEventPublisher
  ) {
    this.aiSource = new AiInterviewQuestionSource(this.aiProvider);
    this.bankSource = new QuestionBankInterviewQuestionSource(this.selector);
    const env = getEnv();
    const hybridBankCount = env.INTERVIEW_QUESTION_BANK_HYBRID_BANK_COUNT;
    this.hybridSource = new HybridInterviewQuestionSource(
      this.selector,
      this.aiProvider,
      hybridBankCount
    );
  }

  public getRolloutDecision(sessionId?: string): RolloutDecision {
    const env = getEnv();
    const config: SourcePolicyConfig = {
      enabled: env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED,
      mode: (env as any).INTERVIEW_QUESTION_SOURCE_MODE || 'AI_ONLY',
      policyVersion: env.INTERVIEW_QUESTION_BANK_POLICY_VERSION,
      hybridBankCount: env.INTERVIEW_QUESTION_BANK_HYBRID_BANK_COUNT,
      rolloutPercent: env.INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT,
      rolloutSalt: env.INTERVIEW_QUESTION_BANK_ROLLOUT_SALT,
    };
    return resolveRolloutDecision(config, sessionId);
  }

  public getEffectiveMode(sessionId?: string): InterviewQuestionSourceMode {
    return this.getRolloutDecision(sessionId).effectiveMode;
  }

  /**
   * Select and validate one interview bundle without mutating the interview.
   * The operation processor owns the durable operation, quota and state
   * transition; keeping selection separate preserves those AIP-55/56 fences.
   */
  public async generateBundle(
    interviewId: string,
    setupData: QuestionSourceContext['setupData'],
  ): Promise<ExactFiveBundle> {
    const startTime = Date.now();
    const rolloutDecision = this.getRolloutDecision(interviewId);
    const effectiveMode = rolloutDecision.effectiveMode;
    const policyVersion = getEnv().INTERVIEW_QUESTION_BANK_POLICY_VERSION;

    await QuestionSourcingTelemetryService.recordEvent({
      sessionId: interviewId,
      eventType: 'ATTEMPT',
      effectiveMode,
      configuredMode: rolloutDecision.configuredMode,
      rolloutPercent: rolloutDecision.rolloutPercent,
      isCohortSelected: rolloutDecision.isCohortSelected,
      rolloutBucket: rolloutDecision.bucket,
      policyVersion,
      durationMs: 0,
    });

    const context: QuestionSourceContext = {
      sessionId: interviewId,
      setupData,
      policyVersion,
    };
    let candidateQuestions: CandidateQuestionPayload[] = [];
    let auditTokens = { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
    let shadowDiag: ShadowDiagnostics | null = null;
    let fallbackCode: string | null = null;

    try {
      switch (effectiveMode) {
        case 'SHADOW': {
          const aiResult = await this.aiSource.generateQuestions(context);
          candidateQuestions = aiResult.questions;
          auditTokens = aiResult.audit;
          const shadowTimeoutMs = getEnv().INTERVIEW_QUESTION_BANK_SHADOW_TIMEOUT_MS;
          const shadowStart = Date.now();
          try {
            const shadowPromise = this.bankSource.generateQuestions(context);
            const timerPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(INTERVIEW_SOURCE_ERROR_CODES.SOURCE_TIMEOUT)), shadowTimeoutMs),
            );
            const shadowResult = await Promise.race([shadowPromise, timerPromise]);
            shadowDiag = {
              availableCount: shadowResult.questions.length,
              eligibleCount: shadowResult.questions.length,
              selectedCount: shadowResult.questions.length,
              selectionLatencyMs: Date.now() - shadowStart,
              insufficientReason: null,
              success: true,
            };
          } catch (error: any) {
            const safeCode = sanitizeQuestionSourcingReasonCode(error?.code ?? error?.message)
              ?? INTERVIEW_SOURCE_ERROR_CODES.SOURCE_TIMEOUT;
            shadowDiag = {
              availableCount: 0,
              eligibleCount: 0,
              selectedCount: 0,
              selectionLatencyMs: Date.now() - shadowStart,
              insufficientReason: safeCode,
              success: false,
              errorCode: safeCode,
            };
          }
          break;
        }
        case 'BANK_ONLY': {
          const result = await this.bankSource.generateQuestions(context);
          candidateQuestions = result.questions;
          auditTokens = result.audit;
          break;
        }
        case 'HYBRID': {
          const result = await this.hybridSource.generateQuestions(context);
          candidateQuestions = result.questions;
          auditTokens = result.audit;
          fallbackCode = result.diagnostics?.fallbackReasonCode ?? null;
          break;
        }
        case 'AI_ONLY':
        default: {
          const result = await this.aiSource.generateQuestions(context);
          candidateQuestions = result.questions;
          auditTokens = result.audit;
          break;
        }
      }

      InterviewQuestionBundleValidator.validate(candidateQuestions);
      const selectedFromBank = candidateQuestions.filter(
        (question) => question.sourceType === 'QUESTION_BANK',
      ).length;
      const selectedFromAi = candidateQuestions.filter(
        (question) => question.sourceType === 'AI_GENERATED',
      ).length;
      const durationMs = Date.now() - startTime;
      const bundle: ExactFiveBundle = {
        sessionId: interviewId,
        questions: candidateQuestions,
        audit: auditTokens,
        diagnostics: {
          effectiveMode,
          policyVersion,
          selectedFromBank,
          selectedFromAi,
          fallbackReasonCode: fallbackCode,
          durationMs,
          successCode: 'SUCCESS',
          shadowDiagnostics: shadowDiag,
        },
      };

      await QuestionSourcingTelemetryService.recordEvent({
        sessionId: interviewId,
        eventType: 'SUCCESS',
        effectiveMode,
        configuredMode: rolloutDecision.configuredMode,
        rolloutPercent: rolloutDecision.rolloutPercent,
        isCohortSelected: rolloutDecision.isCohortSelected,
        rolloutBucket: rolloutDecision.bucket,
        policyVersion,
        durationMs,
        bankQuestionCount: selectedFromBank,
        aiQuestionCount: selectedFromAi,
        fallbackOccurred: Boolean(fallbackCode),
        fallbackReasonCode: fallbackCode,
        poolInsufficient: fallbackCode === INTERVIEW_SOURCE_ERROR_CODES.POOL_INSUFFICIENT,
        shadowSuccess: shadowDiag?.success ?? null,
        shadowTimeout: shadowDiag?.errorCode === INTERVIEW_SOURCE_ERROR_CODES.SOURCE_TIMEOUT,
        shadowErrorCode: shadowDiag?.errorCode ?? null,
        bundleValid: true,
        exactFiveViolated: false,
        tokens: auditTokens,
        reasonCode: 'SUCCESS',
      });
      return bundle;
    } catch (error: any) {
      await QuestionSourcingTelemetryService.recordEvent({
        sessionId: interviewId,
        eventType: 'FAILURE',
        effectiveMode,
        configuredMode: rolloutDecision.configuredMode,
        rolloutPercent: rolloutDecision.rolloutPercent,
        isCohortSelected: rolloutDecision.isCohortSelected,
        rolloutBucket: rolloutDecision.bucket,
        policyVersion,
        durationMs: Date.now() - startTime,
        reasonCode: sanitizeQuestionSourcingReasonCode(error?.code) ?? 'INTERNAL_ERROR',
        fallbackOccurred: Boolean(fallbackCode),
        fallbackReasonCode: fallbackCode,
        poolInsufficient: error?.code === INTERVIEW_SOURCE_ERROR_CODES.POOL_INSUFFICIENT,
        bundleValid: false,
      });
      throw error;
    }
  }

  public async generateAndCommit(
    interviewId: string,
    setupData: any,
    ownerId?: string,
  ): Promise<ExactFiveBundle> {
    const startTime = Date.now();
    const rolloutDecision = this.getRolloutDecision(interviewId);
    const effectiveMode = rolloutDecision.effectiveMode;
    const policyVersion = getEnv().INTERVIEW_QUESTION_BANK_POLICY_VERSION;

    await QuestionSourcingTelemetryService.recordEvent({
      sessionId: interviewId,
      eventType: 'ATTEMPT',
      effectiveMode,
      configuredMode: rolloutDecision.configuredMode,
      rolloutPercent: rolloutDecision.rolloutPercent,
      isCohortSelected: rolloutDecision.isCohortSelected,
      rolloutBucket: rolloutDecision.bucket,
      policyVersion,
      durationMs: 0,
    });

    // 1. Session inspection & Idempotency check
    const repository = ownerId
      ? this.repository.forOwner(ownerId)
      : typeof (this.repository as any).forInternalGeneration === 'function'
        ? (this.repository as any).forInternalGeneration()
        : this.repository;
    const session = await repository.findById(interviewId);
    if (!session) {
      throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
    }

    // The parent session has already been owner-checked by the repository;
    // sessionId-only child reads also retain compatibility with legacy child
    // documents that predate the denormalized ownerId field.
    const questionScope = { sessionId: interviewId };
    const existingCount = await InterviewQuestionModel.countDocuments(questionScope);

    if (existingCount === 5) {
      // Idempotent retry / duplicate delivery
      if (session.status === 'GENERATING') {
        await repository.updateStatus(interviewId, 'IN_PROGRESS');
        if (this.eventPublisher) {
          this.eventPublisher.publish('STATE_CHANGED', {
            interviewId,
            status: 'IN_PROGRESS',
          });
        }
      }

      await QuestionSourcingTelemetryService.recordEvent({
        sessionId: interviewId,
        eventType: 'IDEMPOTENT_NOOP',
        effectiveMode,
        configuredMode: rolloutDecision.configuredMode,
        rolloutPercent: rolloutDecision.rolloutPercent,
        isCohortSelected: rolloutDecision.isCohortSelected,
        rolloutBucket: rolloutDecision.bucket,
        policyVersion,
        durationMs: Date.now() - startTime,
        reasonCode: 'IDEMPOTENT_NOOP',
      });

      const existing = await InterviewQuestionModel.find(questionScope).sort({ order: 1 }).lean();
      return {
        sessionId: interviewId,
        questions: existing as any,
        audit: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
        diagnostics: {
          effectiveMode,
          policyVersion,
          selectedFromBank: 0,
          selectedFromAi: 0,
          durationMs: Date.now() - startTime,
          successCode: 'IDEMPOTENT_NOOP',
        },
      };
    }

    if (existingCount > 0 && existingCount !== 5) {
      await QuestionSourcingTelemetryService.recordEvent({
        sessionId: interviewId,
        eventType: 'INCONSISTENT_STATE',
        effectiveMode,
        configuredMode: rolloutDecision.configuredMode,
        rolloutPercent: rolloutDecision.rolloutPercent,
        isCohortSelected: rolloutDecision.isCohortSelected,
        rolloutBucket: rolloutDecision.bucket,
        policyVersion,
        durationMs: Date.now() - startTime,
        reasonCode: INTERVIEW_SOURCE_ERROR_CODES.INCONSISTENT_STATE,
        exactFiveViolated: true,
      });

      throw new AppError(
        `Phát hiện trạng thái câu hỏi không nhất quán (${existingCount} câu hỏi) cho session ${interviewId}`,
        409,
        INTERVIEW_SOURCE_ERROR_CODES.INCONSISTENT_STATE
      );
    }

    if (session.status !== 'GENERATING') {
      if (session.status === 'PENDING') {
      await repository.updateStatus(interviewId, 'GENERATING');
      } else {
        await QuestionSourcingTelemetryService.recordEvent({
          sessionId: interviewId,
          eventType: 'CONFLICT',
          effectiveMode,
          configuredMode: rolloutDecision.configuredMode,
          rolloutPercent: rolloutDecision.rolloutPercent,
          isCohortSelected: rolloutDecision.isCohortSelected,
          rolloutBucket: rolloutDecision.bucket,
          policyVersion,
          durationMs: Date.now() - startTime,
          reasonCode: INTERVIEW_SOURCE_ERROR_CODES.GENERATION_CONFLICT,
        });

        throw new AppError(
          `Phiên phỏng vấn đang ở trạng thái ${session.status}, không thể sinh câu hỏi`,
          400,
          INTERVIEW_SOURCE_ERROR_CODES.GENERATION_CONFLICT
        );
      }
    }

    const context: QuestionSourceContext = {
      sessionId: interviewId,
      setupData: setupData || session.setupData,
      policyVersion,
    };

    let candidateQuestions: CandidateQuestionPayload[] = [];
    let auditTokens = { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
    let shadowDiag: ShadowDiagnostics | null = null;
    let fallbackCode: string | null = null;

    try {
      switch (effectiveMode) {
        case 'AI_ONLY': {
          const res = await this.aiSource.generateQuestions(context);
          candidateQuestions = res.questions;
          auditTokens = res.audit;
          break;
        }

        case 'SHADOW': {
          // Primary: generate AI questions
          const aiRes = await this.aiSource.generateQuestions(context);
          candidateQuestions = aiRes.questions;
          auditTokens = aiRes.audit;

          // Shadow: run question bank selection safely with bounded timeout
          const shadowTimeoutMs = getEnv().INTERVIEW_QUESTION_BANK_SHADOW_TIMEOUT_MS;
          const shadowStart = Date.now();

          try {
            const shadowPromise = this.bankSource.generateQuestions(context);
            const timerPromise = new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(INTERVIEW_SOURCE_ERROR_CODES.SOURCE_TIMEOUT)),
                shadowTimeoutMs
              )
            );
            const shadowRes = await Promise.race([shadowPromise, timerPromise]);

            shadowDiag = {
              availableCount: shadowRes.questions.length,
              eligibleCount: shadowRes.questions.length,
              selectedCount: shadowRes.questions.length,
              selectionLatencyMs: Date.now() - shadowStart,
              insufficientReason: null,
              success: true,
            };
          } catch (shadowErr: any) {
            shadowDiag = {
              availableCount: 0,
              eligibleCount: 0,
              selectedCount: 0,
              selectionLatencyMs: Date.now() - shadowStart,
              insufficientReason: shadowErr.message || 'Shadow evaluation failed',
              success: false,
              errorCode: shadowErr.code || INTERVIEW_SOURCE_ERROR_CODES.SOURCE_TIMEOUT,
            };
          }
          break;
        }

        case 'BANK_ONLY': {
          const res = await this.bankSource.generateQuestions(context);
          candidateQuestions = res.questions;
          auditTokens = res.audit;
          break;
        }

        case 'HYBRID': {
          const res = await this.hybridSource.generateQuestions(context);
          candidateQuestions = res.questions;
          auditTokens = res.audit;
          fallbackCode = res.diagnostics?.fallbackReasonCode ?? null;
          break;
        }

        default: {
          const res = await this.aiSource.generateQuestions(context);
          candidateQuestions = res.questions;
          auditTokens = res.audit;
          break;
        }
      }

      // 2. Validate bundle invariants (exact-5, orders 1..5, no duplicate fingerprints, bilingual, provenance)
      InterviewQuestionBundleValidator.validate(candidateQuestions);

      const selectedFromBank = candidateQuestions.filter(
        (q) => q.sourceType === 'QUESTION_BANK'
      ).length;
      const selectedFromAi = candidateQuestions.filter(
        (q) => q.sourceType === 'AI_GENERATED'
      ).length;
      const durationMs = Date.now() - startTime;

      const bundle: ExactFiveBundle = {
        sessionId: interviewId,
        questions: candidateQuestions,
        audit: auditTokens,
        diagnostics: {
          effectiveMode,
          policyVersion,
          selectedFromBank,
          selectedFromAi,
          fallbackReasonCode: fallbackCode,
          durationMs,
          successCode: 'SUCCESS',
          shadowDiagnostics: shadowDiag,
        },
      };

      // 3. Persist atomically
      await repository.commitInterviewQuestionsBundle(interviewId, bundle);

      // Record SUCCESS telemetry
      await QuestionSourcingTelemetryService.recordEvent({
        sessionId: interviewId,
        eventType: 'SUCCESS',
        effectiveMode,
        configuredMode: rolloutDecision.configuredMode,
        rolloutPercent: rolloutDecision.rolloutPercent,
        isCohortSelected: rolloutDecision.isCohortSelected,
        rolloutBucket: rolloutDecision.bucket,
        policyVersion,
        durationMs,
        bankQuestionCount: selectedFromBank,
        aiQuestionCount: selectedFromAi,
        fallbackOccurred: Boolean(fallbackCode),
        fallbackReasonCode: fallbackCode,
        poolInsufficient:
          fallbackCode === INTERVIEW_SOURCE_ERROR_CODES.POOL_INSUFFICIENT,
        shadowSuccess: shadowDiag ? shadowDiag.success : null,
        shadowTimeout:
          shadowDiag?.errorCode === INTERVIEW_SOURCE_ERROR_CODES.SOURCE_TIMEOUT,
        shadowErrorCode: shadowDiag?.errorCode ?? null,
        bundleValid: true,
        exactFiveViolated: candidateQuestions.length !== 5,
        tokens: auditTokens,
        reasonCode: 'SUCCESS',
      });

      // 4. Publish state change
      if (this.eventPublisher) {
        this.eventPublisher.publish('STATE_CHANGED', {
          interviewId,
          status: 'IN_PROGRESS',
        });
      }

      return bundle;
    } catch (err: any) {
      // Record FAILURE telemetry
      await QuestionSourcingTelemetryService.recordEvent({
        sessionId: interviewId,
        eventType: 'FAILURE',
        effectiveMode,
        configuredMode: rolloutDecision.configuredMode,
        rolloutPercent: rolloutDecision.rolloutPercent,
        isCohortSelected: rolloutDecision.isCohortSelected,
        rolloutBucket: rolloutDecision.bucket,
        policyVersion,
        durationMs: Date.now() - startTime,
        reasonCode:
          sanitizeQuestionSourcingReasonCode(err?.code) ?? 'INTERNAL_ERROR',
        fallbackOccurred: Boolean(fallbackCode),
        fallbackReasonCode: fallbackCode,
        poolInsufficient:
          err.code === INTERVIEW_SOURCE_ERROR_CODES.POOL_INSUFFICIENT,
      });

      // Transition to FAILED on generation error
      try {
        await repository.updateStatus(interviewId, 'FAILED');
        if (this.eventPublisher) {
          this.eventPublisher.publish('STATE_CHANGED', {
            interviewId,
            status: 'FAILED',
          });
        }
      } catch (statusErr) {
        logger.error('interview.retry_generation');
      }
      throw err;
    }
  }
}
