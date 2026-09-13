import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  QUESTION_LIFECYCLE_STATUSES,
  QuestionLifecycleStatus,
} from '../domain/question-bank/types';

export interface IQuestion extends Document {
  code: string;
  lifecycleStatus: QuestionLifecycleStatus;
  currentPublishedVersionId: Types.ObjectId | null;
  draftVersionId: Types.ObjectId | null;
  latestVersionNumber: number;
  ownerId: Types.ObjectId;
  revision: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      immutable: true,
      match: /^QB-\d{4}-\d{6}$/,
    },
    lifecycleStatus: {
      type: String,
      enum: [...QUESTION_LIFECYCLE_STATUSES],
      default: 'ACTIVE',
      required: true,
    },
    currentPublishedVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'QuestionVersion',
      default: null,
    },
    draftVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'QuestionVersion',
      default: null,
    },
    latestVersionNumber: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    revision: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    collection: 'questions',
    timestamps: true,
    strict: true,
  }
);

questionSchema.index(
  { code: 1 },
  { unique: true, name: 'questions_code_unique' }
);
questionSchema.index(
  { lifecycleStatus: 1, updatedAt: -1 },
  { name: 'questions_lifecycle_updated' }
);
questionSchema.index(
  { currentPublishedVersionId: 1 },
  {
    name: 'questions_published_pointer',
    partialFilterExpression: { currentPublishedVersionId: { $type: 'objectId' } },
  }
);
questionSchema.index(
  { ownerId: 1, lifecycleStatus: 1, updatedAt: -1 },
  { name: 'questions_owner_lifecycle_updated' }
);

const Question =
  (mongoose.models.Question as mongoose.Model<IQuestion> | undefined) ??
  mongoose.model<IQuestion>('Question', questionSchema);

export default Question;

