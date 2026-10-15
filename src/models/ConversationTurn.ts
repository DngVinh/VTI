import mongoose, { Schema, Document, Types } from 'mongoose';

export type TurnRole = 'INTERVIEWER' | 'CANDIDATE';
export type TurnType = 'INITIAL_QUESTION' | 'FOLLOW_UP' | 'ANSWER' | 'HINT' | 'SUMMARY';

export interface IConversationTurnDocument extends Document {
  sessionId: Types.ObjectId;
  questionId: Types.ObjectId;
  turnIndex: number;
  role: TurnRole;
  type: TurnType;
  content: {
    vi: string;
    en: string;
  };
  metadata: {
    gapAnalysis?: Array<string | { vi: string; en: string }>;
    difficultyAdjustment?: 'EASIER' | 'SAME' | 'HARDER';
    confidenceScore?: number;
    tokenUsage?: {
      promptTokens: number;
      candidatesTokens: number;
      totalTokens: number;
    };
    speechMetrics?: {
      wpm: number;
      fillerCount: number;
      hesitationMs: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const ConversationTurnSchema = new Schema<IConversationTurnDocument>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'InterviewQuestion', required: true },
    turnIndex: { type: Number, required: true, min: 0 },
    role: { type: String, enum: ['INTERVIEWER', 'CANDIDATE'], required: true },
    type: { type: String, enum: ['INITIAL_QUESTION', 'FOLLOW_UP', 'ANSWER', 'HINT', 'SUMMARY'], required: true },
    content: {
      vi: { type: String, required: true, maxlength: 5000 },
      en: { type: String, required: true, maxlength: 5000 },
    },
    metadata: {
      gapAnalysis: [{ type: Schema.Types.Mixed }],
      difficultyAdjustment: { type: String, enum: ['EASIER', 'SAME', 'HARDER'] },
      confidenceScore: { type: Number, min: 0, max: 1 },
      tokenUsage: {
        promptTokens: { type: Number, default: 0, min: 0 },
        candidatesTokens: { type: Number, default: 0, min: 0 },
        totalTokens: { type: Number, default: 0, min: 0 },
      },
      speechMetrics: {
        wpm: { type: Number, min: 0 },
        fillerCount: { type: Number, min: 0 },
        hesitationMs: { type: Number, min: 0 },
      },
    },
  },
  { timestamps: true }
);

ConversationTurnSchema.index({ sessionId: 1, questionId: 1, turnIndex: 1 }, { unique: true });
ConversationTurnSchema.index({ sessionId: 1, createdAt: 1 });

export const ConversationTurnModel = mongoose.model<IConversationTurnDocument>(
  'ConversationTurn',
  ConversationTurnSchema
);
