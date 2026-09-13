import mongoose, { Document, Schema, Types } from 'mongoose';

export const IDEMPOTENCY_STATUSES = ['IN_PROGRESS', 'COMPLETED', 'FAILED_RETRYABLE'] as const;
export type IdempotencyStatus = (typeof IDEMPOTENCY_STATUSES)[number];

export interface IdempotencyResultReference {
  resourceType: 'QUESTION' | 'QUESTION_VERSION';
  questionId: Types.ObjectId;
  versionNumber: number | null;
  httpStatus: number;
}

export interface IIdempotencyRecord extends Document {
  scope: string;
  route: string;
  actorId: Types.ObjectId;
  keyHash: string;
  requestFingerprint: string;
  status: IdempotencyStatus;
  result: IdempotencyResultReference | null;
  failureCode: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const resultReferenceSchema = new Schema(
  {
    resourceType: {
      type: String,
      enum: ['QUESTION', 'QUESTION_VERSION'],
      required: true,
    },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    versionNumber: { type: Number, min: 1, default: null },
    httpStatus: { type: Number, min: 200, max: 299, required: true },
  },
  { _id: false, strict: true }
);

const idempotencyRecordSchema = new Schema<IIdempotencyRecord>(
  {
    scope: { type: String, required: true, maxlength: 100, immutable: true },
    route: { type: String, required: true, maxlength: 250, immutable: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    keyHash: { type: String, required: true, match: /^[a-f\d]{64}$/, immutable: true },
    requestFingerprint: {
      type: String,
      required: true,
      match: /^[a-f\d]{64}$/,
      immutable: true,
    },
    status: { type: String, enum: [...IDEMPOTENCY_STATUSES], required: true },
    result: { type: resultReferenceSchema, default: null },
    failureCode: { type: String, maxlength: 100, default: null },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'idempotency_records', timestamps: true, strict: true }
);

idempotencyRecordSchema.index(
  { scope: 1, route: 1, actorId: 1, keyHash: 1 },
  { unique: true, name: 'idempotency_scope_route_actor_key_unique' }
);
idempotencyRecordSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'idempotency_expires_ttl' }
);

const IdempotencyRecord =
  (mongoose.models.IdempotencyRecord as mongoose.Model<IIdempotencyRecord> | undefined) ??
  mongoose.model<IIdempotencyRecord>('IdempotencyRecord', idempotencyRecordSchema);

export default IdempotencyRecord;

