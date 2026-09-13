import mongoose, { Document, Schema, Types } from 'mongoose';

export const QUESTION_OUTBOX_STATUSES = ['PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'] as const;
export type QuestionOutboxStatus = (typeof QUESTION_OUTBOX_STATUSES)[number];

export const QUESTION_OUTBOX_EVENT_TYPES = [
  'QUESTION_CREATED',
  'QUESTION_DRAFT_UPDATED',
  'QUESTION_VERSION_CREATED',
  'QUESTION_SUBMITTED',
  'QUESTION_APPROVED',
  'QUESTION_CHANGES_REQUESTED',
  'QUESTION_PUBLISHED',
  'QUESTION_SUPERSEDED',
  'QUESTION_RETIRED',
  'QUESTION_RESTORED',
  'QUESTION_VERSION_TRANSLATED',
] as const;
export type QuestionOutboxEventType = (typeof QUESTION_OUTBOX_EVENT_TYPES)[number];

export interface QuestionOutboxSafePayload {
  questionId: string;
  code?: string;
  versionNumber?: number;
  revision?: number;
  actorId?: string;
  fromState?: string;
  toState?: string;
  targetLocale?: string;
  fields?: string[];
}

export interface IOutboxEvent extends Document {
  eventId: string;
  aggregateType: 'QUESTION';
  aggregateId: Types.ObjectId;
  eventType: QuestionOutboxEventType;
  payload: QuestionOutboxSafePayload;
  status: QuestionOutboxStatus;
  attempts: number;
  nextAttemptAt: Date;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const safePayloadSchema = new Schema(
  {
    questionId: { type: String, required: true },
    code: { type: String, required: false },
    versionNumber: { type: Number, required: false, min: 1 },
    revision: { type: Number, required: false, min: 0 },
    actorId: { type: String, required: false, match: /^[a-f\d]{24}$/i },
    fromState: { type: String, required: false, maxlength: 40 },
    toState: { type: String, required: false, maxlength: 40 },
    targetLocale: { type: String, required: false, enum: ['vi', 'en'] },
    fields: { type: [String], required: false },
  },
  { _id: false, strict: 'throw' }
);

const outboxEventSchema = new Schema<IOutboxEvent>(
  {
    eventId: { type: String, required: true, immutable: true },
    aggregateType: { type: String, enum: ['QUESTION'], required: true, immutable: true },
    aggregateId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      immutable: true,
    },
    eventType: {
      type: String,
      enum: [...QUESTION_OUTBOX_EVENT_TYPES],
      required: true,
      immutable: true,
    },
    payload: { type: safePayloadSchema, required: true, immutable: true },
    status: { type: String, enum: [...QUESTION_OUTBOX_STATUSES], default: 'PENDING' },
    attempts: { type: Number, required: true, min: 0, default: 0 },
    nextAttemptAt: { type: Date, required: true, default: Date.now },
    publishedAt: { type: Date, default: null },
  },
  { collection: 'outbox_events', timestamps: true, strict: true }
);

outboxEventSchema.index(
  { eventId: 1 },
  { unique: true, name: 'outbox_event_id_unique' }
);
outboxEventSchema.index(
  { status: 1, nextAttemptAt: 1 },
  { name: 'outbox_status_next_attempt' }
);

// Interview operations have a separate legacy OutboxEvent model. Keep the
// Question Bank outbox on its own model name even though both are exported
// through similarly named modules.
const OUTBOX_MODEL_NAME = 'QuestionOutboxEvent';
const OutboxEvent =
  (mongoose.models[OUTBOX_MODEL_NAME] as mongoose.Model<IOutboxEvent> | undefined) ??
  mongoose.model<IOutboxEvent>(OUTBOX_MODEL_NAME, outboxEventSchema);

export { OutboxEvent as OutboxEventModel, OutboxEvent };
export default OutboxEvent;
