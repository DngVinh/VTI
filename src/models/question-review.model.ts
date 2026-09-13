import mongoose, { Document, Schema, Types } from 'mongoose';

export const QUESTION_REVIEW_ACTIONS = [
  'COMMENT',
  'SUBMIT',
  'APPROVE',
  'REQUEST_CHANGES',
  'PUBLISH',
  'RETIRE',
  'RESTORE',
] as const;
export type QuestionReviewAction = (typeof QUESTION_REVIEW_ACTIONS)[number];

export interface IQuestionReview extends Document {
  questionId: Types.ObjectId;
  questionVersionId: Types.ObjectId | null;
  revision: number;
  actorId: Types.ObjectId;
  action: QuestionReviewAction;
  comment: string | null;
  fromState: string;
  toState: string;
  requestId: string;
  createdAt: Date;
  updatedAt: Date;
}

const questionReviewSchema = new Schema<IQuestionReview>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      immutable: true,
    },
    questionVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'QuestionVersion',
      required: false,
      default: null,
      immutable: true,
    },
    revision: { type: Number, required: true, min: 0, immutable: true },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    action: { type: String, enum: [...QUESTION_REVIEW_ACTIONS], required: true, immutable: true },
    comment: { type: String, maxlength: 5000, default: null, immutable: true },
    fromState: { type: String, required: true, maxlength: 40, immutable: true },
    toState: { type: String, required: true, maxlength: 40, immutable: true },
    requestId: { type: String, required: true, maxlength: 128, immutable: true },
  },
  { collection: 'question_reviews', timestamps: true, strict: true }
);

questionReviewSchema.index(
  { questionVersionId: 1, revision: 1, actorId: 1 },
  { name: 'question_reviews_version_revision_actor' }
);
questionReviewSchema.index(
  { questionId: 1, createdAt: -1 },
  { name: 'question_reviews_question_created' }
);

const QuestionReview =
  (mongoose.models.QuestionReview as mongoose.Model<IQuestionReview> | undefined) ??
  mongoose.model<IQuestionReview>('QuestionReview', questionReviewSchema);

export default QuestionReview;
