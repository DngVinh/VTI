import mongoose, { Document, Schema, Types } from 'mongoose';
import { EMBEDDING_STATUSES, EmbeddingStatus } from '../domain/question-bank/types';

export interface IQuestionEmbedding extends Omit<Document, 'model'> {
  questionId: Types.ObjectId;
  questionVersionId: Types.ObjectId;
  contentHash: string;
  provider: string;
  model: string;
  dimensions: number;
  vector: number[];
  status: EmbeddingStatus;
  attempts: number;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const questionEmbeddingSchema = new Schema<IQuestionEmbedding>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      index: true,
    },
    questionVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'QuestionVersion',
      required: true,
      index: true,
    },
    contentHash: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    dimensions: {
      type: Number,
      required: true,
      min: 1,
    },
    vector: {
      type: [Number],
      required: true,
    },
    status: {
      type: String,
      enum: [...EMBEDDING_STATUSES],
      default: 'READY',
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 1,
      min: 0,
    },
    lastErrorCode: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'question_embeddings',
  }
);

questionEmbeddingSchema.index(
  { questionVersionId: 1, provider: 1, model: 1, contentHash: 1 },
  { unique: true, name: 'uniq_qv_prov_model_chash' }
);

questionEmbeddingSchema.index(
  { status: 1, provider: 1, model: 1 },
  { name: 'idx_qe_status_prov_model' }
);

questionEmbeddingSchema.index(
  { questionId: 1, status: 1 },
  { name: 'idx_qe_qid_status' }
);

export const QuestionEmbeddingModel =
  (mongoose.models.QuestionEmbedding as mongoose.Model<IQuestionEmbedding>) ||
  mongoose.model<IQuestionEmbedding>('QuestionEmbedding', questionEmbeddingSchema);
