import mongoose, { Document, Schema } from 'mongoose';
import { InterviewQuestionSourceMode } from '../domain/interview/question-source/types';

export const QUESTION_SOURCING_EVENT_TYPES = [
  'ATTEMPT',
  'SUCCESS',
  'FAILURE',
  'IDEMPOTENT_NOOP',
  'CONFLICT',
  'INCONSISTENT_STATE',
] as const;

export type QuestionSourcingEventType = (typeof QUESTION_SOURCING_EVENT_TYPES)[number];

export interface IQuestionSourcingEvent extends Document {
  eventId: string;
  sessionHash: string;
  eventType: QuestionSourcingEventType;
  effectiveMode: InterviewQuestionSourceMode;
  configuredMode: InterviewQuestionSourceMode;
  rolloutPercent: number;
  isCohortSelected: boolean;
  rolloutBucket: number;
  policyVersion: string;
  durationMs: number;
  bankQuestionCount: number;
  aiQuestionCount: number;
  fallbackOccurred: boolean;
  fallbackReasonCode?: string | null;
  poolInsufficient: boolean;
  shadowSuccess?: boolean | null;
  shadowTimeout: boolean;
  shadowErrorCode?: string | null;
  bundleValid: boolean;
  exactFiveViolated: boolean;
  tokens: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
  reasonCode?: string | null;
  createdAt: Date;
}

const QuestionSourcingEventSchema = new Schema<IQuestionSourcingEvent>(
  {
    eventId: { type: String, required: true, unique: true },
    sessionHash: { type: String, required: true, index: true },
    eventType: {
      type: String,
      required: true,
      enum: QUESTION_SOURCING_EVENT_TYPES,
      index: true,
    },
    effectiveMode: {
      type: String,
      required: true,
      enum: ['AI_ONLY', 'SHADOW', 'BANK_ONLY', 'HYBRID'],
      index: true,
    },
    configuredMode: {
      type: String,
      required: true,
      enum: ['AI_ONLY', 'SHADOW', 'BANK_ONLY', 'HYBRID'],
    },
    rolloutPercent: { type: Number, required: true, min: 0, max: 100 },
    isCohortSelected: { type: Boolean, required: true },
    rolloutBucket: { type: Number, required: true, min: 0, max: 99 },
    policyVersion: { type: String, required: true, default: 'v1' },
    durationMs: { type: Number, required: true, min: 0 },
    bankQuestionCount: { type: Number, required: true, min: 0, max: 5 },
    aiQuestionCount: { type: Number, required: true, min: 0, max: 5 },
    fallbackOccurred: { type: Boolean, required: true, default: false },
    fallbackReasonCode: { type: String, required: false, default: null },
    poolInsufficient: { type: Boolean, required: true, default: false },
    shadowSuccess: { type: Boolean, required: false, default: null },
    shadowTimeout: { type: Boolean, required: true, default: false },
    shadowErrorCode: { type: String, required: false, default: null },
    bundleValid: { type: Boolean, required: true, default: true },
    exactFiveViolated: { type: Boolean, required: true, default: false },
    tokens: {
      promptTokens: { type: Number, required: true, default: 0 },
      candidatesTokens: { type: Number, required: true, default: 0 },
      totalTokens: { type: Number, required: true, default: 0 },
    },
    reasonCode: { type: String, required: false, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: 'throw',
    autoIndex: false,
  }
);

QuestionSourcingEventSchema.index({ createdAt: -1, eventType: 1 });
QuestionSourcingEventSchema.index({ createdAt: -1, effectiveMode: 1 });

export const QuestionSourcingEventModel =
  mongoose.models.QuestionSourcingEvent ||
  mongoose.model<IQuestionSourcingEvent>(
    'QuestionSourcingEvent',
    QuestionSourcingEventSchema
  );
