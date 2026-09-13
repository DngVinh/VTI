import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { sha256Hex } from '../domain/question-bank/hashing';
import {
  IQuestionSourcingEvent,
  QuestionSourcingEventModel,
  QuestionSourcingEventType,
} from '../models/question-sourcing-event.model';
import {
  INTERVIEW_SOURCE_ERROR_CODES,
  InterviewQuestionSourceMode,
} from '../domain/interview/question-source/types';

const SAFE_REASON_CODES = new Set<string>([
  ...Object.values(INTERVIEW_SOURCE_ERROR_CODES),
  'SUCCESS',
  'IDEMPOTENT_NOOP',
  'INTERNAL_ERROR',
]);

export const sanitizeQuestionSourcingReasonCode = (
  value: unknown
): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' && SAFE_REASON_CODES.has(value)
    ? value
    : 'INTERNAL_ERROR';
};

export interface RecordSourcingEventInput {
  sessionId: string;
  eventType: QuestionSourcingEventType;
  effectiveMode: InterviewQuestionSourceMode;
  configuredMode: InterviewQuestionSourceMode;
  rolloutPercent: number;
  isCohortSelected: boolean;
  rolloutBucket: number;
  policyVersion?: string;
  durationMs: number;
  bankQuestionCount?: number;
  aiQuestionCount?: number;
  fallbackOccurred?: boolean;
  fallbackReasonCode?: string | null;
  poolInsufficient?: boolean;
  shadowSuccess?: boolean | null;
  shadowTimeout?: boolean;
  shadowErrorCode?: string | null;
  bundleValid?: boolean;
  exactFiveViolated?: boolean;
  tokens?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  reasonCode?: string | null;
}

export class QuestionSourcingTelemetryService {
  public static isTelemetryEnabled(): boolean {
    return (
      process.env.QUESTION_SOURCING_TELEMETRY_ENABLED !== 'false' &&
      process.env.QUESTION_SOURCING_TELEMETRY_ENABLED !== '0'
    );
  }

  public static async recordEvent(
    input: RecordSourcingEventInput
  ): Promise<IQuestionSourcingEvent | null> {
    if (!this.isTelemetryEnabled()) {
      return null;
    }

    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    try {
      const eventId = `qse_${randomUUID().replace(/-/g, '')}`;
      const sessionHash = sha256Hex(input.sessionId);

      const event = await QuestionSourcingEventModel.create({
        eventId,
        sessionHash,
        eventType: input.eventType,
        effectiveMode: input.effectiveMode,
        configuredMode: input.configuredMode,
        rolloutPercent: input.rolloutPercent,
        isCohortSelected: input.isCohortSelected,
        rolloutBucket: input.rolloutBucket,
        policyVersion: input.policyVersion || 'v1',
        durationMs: Math.max(0, Math.floor(input.durationMs)),
        bankQuestionCount: input.bankQuestionCount ?? 0,
        aiQuestionCount: input.aiQuestionCount ?? 0,
        fallbackOccurred: input.fallbackOccurred ?? false,
        fallbackReasonCode: sanitizeQuestionSourcingReasonCode(
          input.fallbackReasonCode
        ),
        poolInsufficient: input.poolInsufficient ?? false,
        shadowSuccess: input.shadowSuccess ?? null,
        shadowTimeout: input.shadowTimeout ?? false,
        shadowErrorCode: sanitizeQuestionSourcingReasonCode(
          input.shadowErrorCode
        ),
        bundleValid: input.bundleValid ?? true,
        exactFiveViolated: input.exactFiveViolated ?? false,
        tokens: {
          promptTokens:
            input.tokens?.promptTokens ??
            (input.tokens as any)?.promptTokenCount ??
            0,
          candidatesTokens:
            input.tokens?.candidatesTokens ??
            (input.tokens as any)?.candidatesTokenCount ??
            0,
          totalTokens:
            input.tokens?.totalTokens ??
            (input.tokens as any)?.totalTokenCount ??
            0,
        },
        reasonCode: sanitizeQuestionSourcingReasonCode(input.reasonCode),
      });

      return event;
    } catch (err) {
      console.error('[QuestionSourcingTelemetry] Failed to record event');
      return null;
    }
  }
}
