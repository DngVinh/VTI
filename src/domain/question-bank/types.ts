export const QUESTION_LIFECYCLE_STATUSES = ['ACTIVE', 'RETIRED'] as const;
export type QuestionLifecycleStatus = (typeof QUESTION_LIFECYCLE_STATUSES)[number];

export const QUESTION_VERSION_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'SUPERSEDED',
] as const;
export type VersionStatus = (typeof QUESTION_VERSION_STATUSES)[number];

export const QUESTION_TYPES = [
  'TECHNICAL',
  'BEHAVIORAL',
  'SYSTEM_DESIGN',
  'CODING',
  'SCENARIO',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export type Difficulty = (typeof QUESTION_DIFFICULTIES)[number];

export const QUESTION_ORIGINS = ['MANUAL', 'IMPORTED', 'AI_ASSISTED'] as const;
export type QuestionOrigin = (typeof QUESTION_ORIGINS)[number];

export interface LocalizedText {
  vi: string | null;
  en: string | null;
}

export interface RubricLevel {
  score: 0 | 1 | 2 | 3 | 4;
  description: LocalizedText;
}

export interface RubricCriterion {
  key: string;
  title: LocalizedText;
  description: LocalizedText;
  weight: number;
  levels: RubricLevel[];
}

export interface TechnologyAssignment {
  technologyId: string;
  relevance: number | null;
}

export interface TaxonomyAssignment {
  primaryRoleId: string | null;
  additionalRoleIds: string[];
  levelIds: string[];
  technologies: TechnologyAssignment[];
  technologyAgnostic: boolean | null;
  classificationComplete: boolean;
  topic: string | null;
  tags: string[];
}

export interface QuestionVersionContent {
  prompt: LocalizedText;
  explanation: LocalizedText;
  followUps: LocalizedText[];
  referenceAnswer: LocalizedText;
  learningObjective: LocalizedText;
  estimatedTimeSeconds: number | null;
  rubric: RubricCriterion[];
}

export interface QuestionVersionProvenance {
  origin: QuestionOrigin;
  sourceVersionId: string | null;
  sourceReference: string | null;
}

export interface QuestionVersionDraftFields
  extends QuestionVersionContent,
    TaxonomyAssignment {
  questionType: QuestionType | null;
  difficulty: Difficulty | null;
  changeSummary: string | null;
}

export const EMPTY_LOCALIZED_TEXT: Readonly<LocalizedText> = Object.freeze({
  vi: null,
  en: null,
});

export const createEmptyQuestionVersionDraft = (): QuestionVersionDraftFields => ({
  prompt: { ...EMPTY_LOCALIZED_TEXT },
  explanation: { ...EMPTY_LOCALIZED_TEXT },
  followUps: [],
  referenceAnswer: { ...EMPTY_LOCALIZED_TEXT },
  learningObjective: { ...EMPTY_LOCALIZED_TEXT },
  estimatedTimeSeconds: null,
  rubric: [],
  questionType: null,
  difficulty: null,
  primaryRoleId: null,
  additionalRoleIds: [],
  levelIds: [],
  technologies: [],
  technologyAgnostic: null,
  classificationComplete: false,
  topic: null,
  tags: [],
  changeSummary: null,
});

// Phase 3 Types
export interface QuestionSelectionFilter {
  roleId?: string;
  levelId?: string;
  technologyIds?: string[];
  language?: 'vi' | 'en';
  difficulty?: Difficulty;
  type?: QuestionType;
  tags?: string[];
  excludeQuestionIds?: string[];
  count: number;
  seed?: string | number;
}

export interface QuestionSelectionItem {
  id: string;
  questionId: string;
  versionId?: string;
  code: string;
  versionNumber: number;
  prompt: LocalizedText;
  difficulty: Difficulty | null;
  type: QuestionType | null;
  primaryRoleId: string | null;
  levelIds: string[];
  technologies: Array<{ technologyId: string; relevance: number | null }>;
  taxonomy: {
    primaryRoleId: string | null;
    additionalRoleIds: string[];
    levelIds: string[];
    technologyIds: string[];
    topic: string | null;
    tags: string[];
  };
}

export interface QuestionSelectionDiagnostics {
  availableCount: number;
  poolSize: number;
  requestedCount: number;
  selectedCount: number;
  seed: string | number | null;
  isPoolSufficient: boolean;
  insufficientReason: string | null;
}

export interface QuestionSelectionResult {
  selected: QuestionSelectionItem[];
  diagnostics: QuestionSelectionDiagnostics;
}

export interface CoverageFilter {
  roleId?: string;
  levelId?: string;
  technologyId?: string;
  language?: 'vi' | 'en';
  difficulty?: Difficulty;
  type?: QuestionType;
}

export interface CoverageBreakdownItem {
  id: string;
  name?: string;
  publishedCount: number;
  draftCount: number;
  totalCount: number;
}

export interface CoverageGapItem {
  dimension: 'ROLE' | 'LEVEL' | 'TECHNOLOGY';
  id: string;
  name?: string;
  publishedCount: number;
  gapType: 'ZERO_COVERAGE' | 'LOW_COVERAGE';
}

export interface QuestionCoverageResult {
  totalQuestions: number;
  activeQuestions: number;
  retiredQuestions: number;
  publishedActiveQuestions: number;
  draftOnlyQuestions: number;
  byRole: CoverageBreakdownItem[];
  byLevel: CoverageBreakdownItem[];
  byTechnology: CoverageBreakdownItem[];
  byDifficulty: Record<Difficulty, number>;
  byType: Record<QuestionType, number>;
  byLanguage: { vi: number; en: number; bilingual: number };
  gaps: CoverageGapItem[];
}

export interface AnalyticsFilter {
  startDate?: string;
  endDate?: string;
  period?: 'day' | 'week' | 'month';
}

export interface ActivityTimelineItem {
  date: string;
  submissions: number;
  approvals: number;
  changesRequested: number;
  publishes: number;
}

export interface QuestionAnalyticsResult {
  summary: {
    totalQuestions: number;
    totalVersions: number;
    publishedVersions: number;
    inReviewVersions: number;
    draftVersions: number;
  };
  lifecycleDistribution: Record<QuestionLifecycleStatus, number>;
  versionStatusDistribution: Record<VersionStatus, number>;
  originDistribution: Record<QuestionOrigin, number>;
  difficultyDistribution: Record<Difficulty, number>;
  typeDistribution: Record<QuestionType, number>;
  activityTimeline: ActivityTimelineItem[];
}

export type ImportFormat = 'JSON' | 'CSV';

export interface ImportRowData {
  prompt: LocalizedText;
  explanation?: LocalizedText;
  referenceAnswer: LocalizedText;
  learningObjective?: LocalizedText;
  estimatedTimeSeconds?: number | null;
  type: QuestionType;
  difficulty: Difficulty;
  primaryRoleId: string;
  additionalRoleIds?: string[];
  levelIds: string[];
  technologyIds?: string[];
  technologyAgnostic?: boolean;
  topic?: string | null;
  tags?: string[];
  followUps?: LocalizedText[];
  rubric?: RubricCriterion[];
  changeSummary?: string | null;
}

export interface ImportRowError {
  row: number;
  field?: string;
  message: string;
}

export interface QuestionImportResult {
  dryRun: boolean;
  totalRecords: number;
  validCount: number;
  invalidCount: number;
  errors: ImportRowError[];
  createdQuestions?: Array<{ id: string; code: string; versionNumber: number }>;
}

export type ExportFormat = 'JSON' | 'CSV';

export interface ExportFilter {
  format: ExportFormat;
  lifecycleStatus?: QuestionLifecycleStatus;
  status?: VersionStatus;
  roleId?: string;
  levelId?: string;
  technologyId?: string;
  difficulty?: Difficulty;
  type?: QuestionType;
  limit?: number;
  offset?: number;
}

export interface ExportableQuestionItem {
  code: string;
  lifecycleStatus: QuestionLifecycleStatus;
  versionNumber: number;
  status: VersionStatus;
  prompt: LocalizedText;
  explanation: LocalizedText;
  referenceAnswer: LocalizedText;
  learningObjective: LocalizedText;
  type: QuestionType | null;
  difficulty: Difficulty | null;
  origin: QuestionOrigin;
  taxonomy: {
    primaryRoleId: string | null;
    additionalRoleIds: string[];
    levelIds: string[];
    technologyIds: string[];
    technologyAgnostic: boolean | null;
    topic: string | null;
    tags: string[];
  };
  rubricSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionExportResult {
  format: ExportFormat;
  count: number;
  total: number;
  data?: ExportableQuestionItem[];
  csvContent?: string;
}

export interface AiDraftSpec {
  topic: string;
  roleId: string;
  levelId: string;
  technologyId?: string;
  difficulty: Difficulty;
  type: QuestionType;
  language?: 'vi' | 'en' | 'both';
  additionalInstructions?: string;
  persistDraft?: boolean;
}

export interface GeneratedQuestionDraft {
  prompt: LocalizedText;
  explanation: LocalizedText;
  referenceAnswer: LocalizedText;
  learningObjective: LocalizedText;
  estimatedTimeSeconds: number;
  followUps: LocalizedText[];
  rubric: RubricCriterion[];
  topic: string;
  tags: string[];
}

export interface QuestionAiDraftResult {
  draft: GeneratedQuestionDraft;
  persistedQuestion?: { id: string; code: string; versionNumber: number };
}

export const EMBEDDING_STATUSES = ['PENDING', 'READY', 'FAILED', 'STALE'] as const;
export type EmbeddingStatus = (typeof EMBEDDING_STATUSES)[number];

export const TRANSLATION_FIELDS = [
  'prompt',
  'explanation',
  'referenceAnswer',
  'learningObjective',
  'followUps',
  'rubric',
] as const;
export type TranslationField = (typeof TRANSLATION_FIELDS)[number];

export interface TranslationProposedContent {
  prompt?: string | null;
  explanation?: string | null;
  referenceAnswer?: string | null;
  learningObjective?: string | null;
  followUps?: string[] | null;
  rubric?: Array<{
    key: string;
    title: string;
    description: string;
    levels: Array<{ score: number; description: string }>;
  }> | null;
}

export interface TranslationFieldStatus {
  field: TranslationField;
  sourcePresent: boolean;
  wouldOverwrite: boolean;
}

export interface QuestionTranslationPreviewResult {
  sourceLocale: 'vi' | 'en';
  targetLocale: 'vi' | 'en';
  proposed: TranslationProposedContent;
  fields: TranslationFieldStatus[];
  warnings: string[];
  provider: string;
  model: string;
  requestId: string;
}

export interface QuestionEmbeddingBackfillResult {
  processedCount: number;
  readyCount: number;
  failedCount: number;
  skippedCount: number;
  nextCursor: string | null;
  hasMore: boolean;
  model: string;
  provider: string;
  requestId: string;
}

export interface QuestionDuplicateMatch {
  questionId: string;
  code: string;
  versionNumber: number;
  promptPreview: LocalizedText;
  similarityScore: number;
  matchType: 'EXACT' | 'SEMANTIC';
  taxonomyOverlap: {
    roles: string[];
    levels: string[];
    technologies: string[];
    difficultyMatch: boolean;
    typeMatch: boolean;
  };
  topic: string | null;
}

export interface QuestionDuplicateDetectionResult {
  matches: QuestionDuplicateMatch[];
  totalMatches: number;
  model: string;
  threshold: number;
  requestId: string;
}


