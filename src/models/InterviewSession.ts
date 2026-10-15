import mongoose, {
  Schema,
  Document
} from 'mongoose';

import {
  InterviewStatus
} from '../domain/interview/IInterviewState';

import {
  InterviewSetupPayload
} from '../domain/interview/types';

export interface InterviewPromptVersion {
  promptId: string;
  version: number;
  language: 'EN' | 'VI';
}

export interface IInterviewSessionDocument
  extends Document {
  userId: string;
  status: InterviewStatus;
  version: number;
  rubricVersion: number;
  submissionVersion: number;
  activeOperationId?: mongoose.Types.ObjectId | null;
  failedStage?: 'GENERATION' | 'EVALUATION' | null;
  safeErrorCode?: string | null;
  setupData: InterviewSetupPayload;

  overallScore: number | null;
  dimensions: { name: string; score: number; reasoning: string | { vi: string; en: string } }[] | null;
  learningPath: { 
    topic: { en: string; vi: string }; 
    priority: string; 
    suggestion: { en: string; vi: string } 
  }[] | null;

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

  promptVersions?: {
    generation?: InterviewPromptVersion;
    evaluation?: InterviewPromptVersion;
    learningPath?: InterviewPromptVersion;
  };
  metadata?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };

  createdAt: Date;
  updatedAt: Date;
  terminalAt?: Date;
  contentPurgeAt?: Date;
  contentPurgedAt?: Date;
  recordPurgeAt?: Date;
}

const InterviewSessionSchema = new Schema<IInterviewSessionDocument>(
  {
    userId: {
      type: String,
      required: false, // Legacy records remain readable; every repository create requires an authenticated owner.
    },
    status: {
      type: String,
      enum: ['PENDING', 'GENERATING', 'IN_PROGRESS', 'FOLLOW_UP', 'EVALUATING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      required: true
    },
    version: { type: Number, default: 0, min: 0, required: true },
    rubricVersion: { type: Number, default: 2, enum: [1, 2], required: true },
    submissionVersion: { type: Number, default: 0, min: 0, required: true },
    activeOperationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OperationRecord',
      default: null
    },
    failedStage: { type: String, enum: ['GENERATION', 'EVALUATION', null], default: null },
    safeErrorCode: { type: String, default: null },
      terminalAt: { type: Date, default: null },
      contentPurgeAt: { type: Date, default: null },
      recordPurgeAt: { type: Date, default: null },
      contentPurgedAt: { type: Date },
    setupData: {
      jobPosition: { type: String },
      level: { type: String },
      techStacks: [{ type: String }],
      jdText: { type: String, maxlength: 10000 },
      language: { type: String, enum: ['VI', 'EN'], default: 'VI' },
      secondsPerQuestion: { type: Number, min: 60, max: 600, default: 300 },
      strategy: { type: String, enum: ['STANDARD', 'ADAPTIVE'], default: 'STANDARD' }
    },
    overallScore: {
      type: Number,
      default: null
    },
    dimensions: [{
      name: { type: String, required: true },
      score: { type: Number, min: 0, max: 10, required: true },
      reasoning: { type: Schema.Types.Mixed, required: true }
    }],
    learningPath: [{
      topic: { 
        en: { type: String },
        vi: { type: String }
      },
      priority: { type: String, enum: ['High', 'Medium', 'Low'] },
      suggestion: { 
        en: { type: String },
        vi: { type: String }
      }
    }],
    personaEvaluations: { type: Schema.Types.Mixed, default: undefined },
    varianceFlags: { type: Schema.Types.Mixed, default: undefined },
    promptVersions: {
      generation: {
        promptId: { type: String },
        version: { type: Number, min: 1 },
        language: { type: String, enum: ['EN', 'VI'] }
      },
      evaluation: {
        promptId: { type: String },
        version: { type: Number, min: 1 },
        language: { type: String, enum: ['EN', 'VI'] }
      },
      learningPath: {
        promptId: { type: String },
        version: { type: Number, min: 1 },
        language: { type: String, enum: ['EN', 'VI'] }
      }
    },
    metadata: {
      promptTokens: { type: Number, default: 0 },
      candidatesTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true
  }
);

InterviewSessionSchema.index({ status: 1, contentPurgeAt: 1, _id: 1 });
InterviewSessionSchema.index({ status: 1, recordPurgeAt: 1, _id: 1 });
InterviewSessionSchema.index({
  userId: 1,
  createdAt: -1,
  _id: -1
});
InterviewSessionSchema.index({
  userId: 1,
  status: 1,
  createdAt: -1,
  _id: -1
});

export const InterviewSessionModel = mongoose.model<IInterviewSessionDocument>('InterviewSession', InterviewSessionSchema);
