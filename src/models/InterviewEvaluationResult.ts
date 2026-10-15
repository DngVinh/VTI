import mongoose, { Document, Schema } from 'mongoose';

export interface IInterviewEvaluationResultDocument extends Document {
  sessionId: mongoose.Types.ObjectId;
  submissionVersion: number;
  operationId: mongoose.Types.ObjectId;
  evaluations: Array<{
    questionId: mongoose.Types.ObjectId;
    feedback: { en: string; vi: string };
    score: number;
  }>;
  overallScore: number;
  dimensions: Array<{ name: string; score: number; reasoning: string | { en: string; vi: string } }>;
  learningPath: Array<{
    topic: { en: string; vi: string };
    priority: string;
    suggestion: { en: string; vi: string };
  }>;
  personaEvaluations?: Array<{
    role: 'TECH_LEAD' | 'BAR_RAISER' | 'BEHAVIORAL' | 'JUDGE';
    score: number;
    strengths: Array<{ en: string; vi: string }>;
    weaknesses: Array<{ en: string; vi: string }>;
    specificFeedback: { en: string; vi: string };
    dimensionScores?: Record<string, number>;
  }>;
  varianceFlags?: Array<{
    dimension: string;
    variance: number;
    arbiterResolution: { en: string; vi: string };
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const LocalizedSchema = new Schema(
  { en: { type: String, required: true }, vi: { type: String, required: true } },
  { _id: false }
);

const InterviewEvaluationResultSchema = new Schema<IInterviewEvaluationResultDocument>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'InterviewSession', required: true },
    submissionVersion: { type: Number, required: true, min: 1 },
    operationId: { type: Schema.Types.ObjectId, ref: 'OperationRecord', required: true },
    evaluations: [{
      questionId: { type: Schema.Types.ObjectId, ref: 'InterviewQuestion', required: true },
      feedback: { type: LocalizedSchema, required: true },
      score: { type: Number, min: 0, max: 10, required: true }
    }],
    overallScore: { type: Number, min: 0, max: 10, required: true },
    dimensions: [{
      name: { type: String, required: true },
      score: { type: Number, min: 0, max: 10, required: true },
      reasoning: { type: Schema.Types.Mixed, required: true }
    }],
    learningPath: [{
      topic: { type: LocalizedSchema, required: true },
      priority: { type: String, enum: ['High', 'Medium', 'Low'], required: true },
      suggestion: { type: LocalizedSchema, required: true }
    }],
    personaEvaluations: [{
      role: { type: String, enum: ['TECH_LEAD', 'BAR_RAISER', 'BEHAVIORAL', 'JUDGE'], required: true },
      score: { type: Number, min: 0, max: 10, required: true },
      strengths: [{ type: LocalizedSchema, required: true }],
      weaknesses: [{ type: LocalizedSchema, required: true }],
      specificFeedback: { type: LocalizedSchema, required: true },
      dimensionScores: { type: Schema.Types.Mixed, default: {} }
    }],
    varianceFlags: [{
      dimension: { type: String, required: true },
      variance: { type: Number, min: 0, required: true },
      arbiterResolution: { type: LocalizedSchema, required: true }
    }]
  },
  { timestamps: true }
);

InterviewEvaluationResultSchema.index(
  { sessionId: 1, submissionVersion: 1 },
  { unique: true }
);
InterviewEvaluationResultSchema.index({ operationId: 1 }, { unique: true });

export const InterviewEvaluationResultModel = mongoose.model<IInterviewEvaluationResultDocument>(
  'InterviewEvaluationResult',
  InterviewEvaluationResultSchema
);
