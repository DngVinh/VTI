import mongoose, { Schema, Document } from 'mongoose';

export interface IInterviewQuestionDocument extends Document {
  sessionId: mongoose.Types.ObjectId;
  order: number;
  difficulty: string;
  content: {
    en: string;
    vi: string;
  };
  candidateAnswer: string | null;
  answerVersion: number;
  feedback: {
    en: string;
    vi: string;
  } | null;
  score: number | null;
  sourceType?: 'AI_GENERATED' | 'QUESTION_BANK';
  questionBankQuestionId?: mongoose.Types.ObjectId | null;
  questionBankVersionId?: mongoose.Types.ObjectId | null;
  questionBankVersionNumber?: number | null;
  questionBankCode?: string | null;
  selectionPolicyVersion?: string | null;
  selectionSeedFingerprint?: string | null;
  promptSnapshotHash?: string | null;
  selectedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const InterviewQuestionSchema: Schema = new Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true
    },
    ownerId: { type: String }, // New writes set this; legacy children remain scoped through their parent.
    order: {
      type: Number,
      required: true
    },
    difficulty: {
      type: String,
      required: true
    },
    content: {
      en: { type: String, required: true },
      vi: { type: String, required: true }
    },
    candidateAnswer: {
      type: String,
      default: null
    },
    answerVersion: {
      type: Number,
      default: 0,
      min: 0
    },
    feedback: {
      en: { type: String },
      vi: { type: String }
    },
    score: {
      type: Number,
      default: null
    },
    sourceType: {
      type: String,
      enum: ['AI_GENERATED', 'QUESTION_BANK'],
      default: 'AI_GENERATED'
    },
    questionBankQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null
    },
    questionBankVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuestionVersion',
      default: null
    },
    questionBankVersionNumber: {
      type: Number,
      default: null
    },
    questionBankCode: {
      type: String,
      default: null
    },
    selectionPolicyVersion: {
      type: String,
      default: null
    },
    selectionSeedFingerprint: {
      type: String,
      default: null
    },
    promptSnapshotHash: {
      type: String,
      default: null
    },
    selectedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

InterviewQuestionSchema.index(
  { sessionId: 1, order: 1 },
  { unique: true, name: 'interview_questions_session_order_unique' }
);
export const InterviewQuestionModel = mongoose.model<IInterviewQuestionDocument>('InterviewQuestion', InterviewQuestionSchema);
