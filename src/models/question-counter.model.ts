import mongoose, { Document, Schema } from 'mongoose';

export interface IQuestionCounter extends Document {
  scope: 'QUESTION_CODE';
  year: number;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
}

const questionCounterSchema = new Schema<IQuestionCounter>(
  {
    scope: { type: String, enum: ['QUESTION_CODE'], required: true, immutable: true },
    year: { type: Number, required: true, min: 2000, max: 9999, immutable: true },
    sequence: { type: Number, required: true, min: 0, default: 0 },
  },
  { collection: 'question_counters', timestamps: true, strict: true }
);

questionCounterSchema.index(
  { scope: 1, year: 1 },
  { unique: true, name: 'question_counters_scope_year_unique' }
);

const QuestionCounter =
  (mongoose.models.QuestionCounter as mongoose.Model<IQuestionCounter> | undefined) ??
  mongoose.model<IQuestionCounter>('QuestionCounter', questionCounterSchema);

export default QuestionCounter;

