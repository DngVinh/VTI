import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  Difficulty,
  LocalizedText,
  QUESTION_DIFFICULTIES,
  QUESTION_ORIGINS,
  QUESTION_TYPES,
  QUESTION_VERSION_STATUSES,
  QuestionOrigin,
  QuestionType,
  RubricCriterion,
  TechnologyAssignment,
  VersionStatus,
} from '../domain/question-bank/types';

export interface IQuestionVersion extends Document {
  questionId: Types.ObjectId;
  versionNumber: number;
  status: VersionStatus;
  revision: number;
  prompt: LocalizedText;
  explanation: LocalizedText;
  followUps: LocalizedText[];
  questionType: QuestionType | null;
  difficulty: Difficulty | null;
  primaryRoleId: Types.ObjectId | null;
  additionalRoleIds: Types.ObjectId[];
  levelIds: Types.ObjectId[];
  technologies: Array<Omit<TechnologyAssignment, 'technologyId'> & { technologyId: Types.ObjectId }>;
  technologyAgnostic: boolean | null;
  classificationComplete: boolean;
  topic: string | null;
  tags: string[];
  referenceAnswer: LocalizedText;
  learningObjective: LocalizedText;
  estimatedTimeSeconds: number | null;
  rubric: RubricCriterion[];
  changeSummary: string | null;
  origin: QuestionOrigin;
  sourceVersionId: Types.ObjectId | null;
  sourceReference: string | null;
  contentHash: string;
  normalizedPromptFingerprint: string | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  contributorIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const localizedTextSchema = new Schema<LocalizedText>(
  {
    vi: { type: String, default: null, maxlength: 20_000 },
    en: { type: String, default: null, maxlength: 20_000 },
  },
  { _id: false, strict: true }
);

const rubricLevelSchema = new Schema(
  {
    score: { type: Number, required: true, min: 0, max: 4 },
    description: { type: localizedTextSchema, required: true },
  },
  { _id: false, strict: true }
);

const rubricCriterionSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    title: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, required: true },
    weight: { type: Number, required: true, min: 1, max: 100 },
    levels: { type: [rubricLevelSchema], default: [] },
  },
  { _id: false, strict: true }
);

const technologyAssignmentSchema = new Schema(
  {
    technologyId: {
      type: Schema.Types.ObjectId,
      ref: 'Technology',
      required: true,
    },
    relevance: { type: Number, default: null, min: 0, max: 100 },
  },
  { _id: false, strict: true }
);

const questionVersionSchema = new Schema<IQuestionVersion>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      immutable: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
    },
    status: {
      type: String,
      enum: [...QUESTION_VERSION_STATUSES],
      required: true,
      default: 'DRAFT',
    },
    revision: { type: Number, required: true, min: 0, default: 0 },
    prompt: {
      type: localizedTextSchema,
      default: () => ({ vi: null, en: null }),
    },
    explanation: {
      type: localizedTextSchema,
      default: () => ({ vi: null, en: null }),
    },
    followUps: { type: [localizedTextSchema], default: [] },
    questionType: { type: String, enum: [...QUESTION_TYPES, null], default: null },
    difficulty: { type: String, enum: [...QUESTION_DIFFICULTIES, null], default: null },
    primaryRoleId: { type: Schema.Types.ObjectId, ref: 'Role', default: null },
    additionalRoleIds: { type: [Schema.Types.ObjectId], ref: 'Role', default: [] },
    levelIds: { type: [Schema.Types.ObjectId], ref: 'Level', default: [] },
    technologies: { type: [technologyAssignmentSchema], default: [] },
    technologyAgnostic: { type: Boolean, default: null },
    classificationComplete: { type: Boolean, required: true, default: false },
    topic: { type: String, trim: true, maxlength: 500, default: null },
    tags: {
      type: [{ type: String, lowercase: true, trim: true, maxlength: 100 }],
      default: [],
    },
    referenceAnswer: {
      type: localizedTextSchema,
      default: () => ({ vi: null, en: null }),
    },
    learningObjective: {
      type: localizedTextSchema,
      default: () => ({ vi: null, en: null }),
    },
    estimatedTimeSeconds: { type: Number, min: 30, max: 3600, default: null },
    rubric: { type: [rubricCriterionSchema], default: [] },
    changeSummary: { type: String, trim: true, maxlength: 1000, default: null },
    origin: {
      type: String,
      enum: [...QUESTION_ORIGINS],
      required: true,
      immutable: true,
    },
    sourceVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'QuestionVersion',
      default: null,
      immutable: true,
    },
    sourceReference: {
      type: String,
      maxlength: 2048,
      default: null,
      immutable: true,
    },
    contentHash: {
      type: String,
      required: true,
      match: /^[a-f\d]{64}$/,
      select: false,
    },
    normalizedPromptFingerprint: {
      type: String,
      default: null,
      match: /^[a-f\d]{64}$/,
      select: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contributorIds: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: true,
      default: [],
    },
  },
  {
    collection: 'question_versions',
    timestamps: true,
    strict: true,
  }
);

questionVersionSchema.index(
  { questionId: 1, versionNumber: 1 },
  { unique: true, name: 'question_versions_question_number_unique' }
);
questionVersionSchema.index(
  { questionId: 1, status: 1 },
  { name: 'question_versions_question_status' }
);
questionVersionSchema.index(
  { questionId: 1, status: 1 },
  {
    unique: true,
    name: 'question_versions_one_published',
    partialFilterExpression: { status: 'PUBLISHED' },
  }
);
questionVersionSchema.index(
  { status: 1, updatedAt: -1 },
  { name: 'question_versions_review_queue' }
);
questionVersionSchema.index(
  { questionId: 1, status: 1 },
  {
    unique: true,
    name: 'question_versions_one_active_draft',
    partialFilterExpression: { status: 'DRAFT' },
  }
);
questionVersionSchema.index(
  { status: 1, primaryRoleId: 1, difficulty: 1 },
  { name: 'question_versions_status_role_difficulty' }
);
questionVersionSchema.index(
  { status: 1, 'technologies.technologyId': 1, difficulty: 1 },
  { name: 'question_versions_status_technology_difficulty' }
);
questionVersionSchema.index(
  { normalizedPromptFingerprint: 1 },
  { name: 'question_versions_prompt_fingerprint', sparse: true }
);

const QuestionVersion =
  (mongoose.models.QuestionVersion as mongoose.Model<IQuestionVersion> | undefined) ??
  mongoose.model<IQuestionVersion>('QuestionVersion', questionVersionSchema);

export default QuestionVersion;
