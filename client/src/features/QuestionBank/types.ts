export const QUESTION_TYPES = [
  'TECHNICAL',
  'BEHAVIORAL',
  'SCENARIO',
  'CODING',
  'SYSTEM_DESIGN',
] as const;

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export const QUESTION_ORIGINS = ['MANUAL', 'AI_ASSISTED', 'IMPORTED'] as const;
export const VERSION_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'SUPERSEDED',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type QuestionOrigin = (typeof QUESTION_ORIGINS)[number];
export type VersionStatus = (typeof VERSION_STATUSES)[number];
export type QuestionLifecycleStatus = 'ACTIVE' | 'RETIRED';

export interface LocalizedText {
  vi: string;
  en: string;
}

export interface RubricLevel {
  score: number;
  description: LocalizedText;
}

export interface RubricCriterion {
  key: string;
  title: LocalizedText;
  description?: LocalizedText;
  weight: number;
  levels: RubricLevel[];
}

export interface QuestionClassification {
  primaryRoleId: string | null;
  additionalRoleIds: string[];
  levelIds: string[];
  technologies: Array<{
    technologyId: string;
    relevance: number | null;
  }>;
  technologyAgnostic: boolean;
  classificationComplete: boolean;
  topic: string | null;
  tags: string[];
  difficulty: string | null;
  type: string | null;
}

export interface QuestionVersionInput {
  content: {
    prompt: LocalizedText;
    explanation?: LocalizedText;
  };
  classification: QuestionClassification;
  answer: {
    referenceAnswer: LocalizedText;
    learningObjective: LocalizedText;
    estimatedTimeSeconds: number | null;
    followUps: LocalizedText[];
  };
  rubric: RubricCriterion[];
  changeSummary: string;
}

export interface QuestionVersionAdminDetailDto extends QuestionVersionInput {
  id: string;
  questionId: string;
  versionNumber: number;
  status: VersionStatus | string;
  revision: number;
  origin: QuestionOrigin | string;
  provenance: {
    sourceVersionId: string | null;
    sourceReference: string | null;
  };
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionVersionSummaryDto {
  id: string;
  questionId: string;
  versionNumber: number;
  status: VersionStatus | string;
  revision: number;
  promptPreview: LocalizedText;
  type: string | null;
  difficulty: string | null;
  updatedAt: string;
}

export interface QuestionReviewQueueItemDto extends QuestionVersionSummaryDto {
  code: string;
  lifecycleStatus: QuestionLifecycleStatus | string;
  contributorIds: string[];
}

export interface QuestionReviewHistoryDto {
  id: string;
  actorId: string;
  action: string;
  reason: string | null;
  fromState: string;
  toState: string;
  revision: number;
  createdAt: string;
}

export interface QuestionReviewDetailDto {
  question: QuestionAdminDetailDto['question'];
  snapshot: QuestionVersionAdminDetailDto;
  history: QuestionReviewHistoryDto[];
  completenessErrors: Array<{ field: string; message: string }>;
  allowedActions: Array<'APPROVE' | 'REQUEST_CHANGES' | 'PUBLISH'>;
}

export interface ReviewQueueResponse {
  items: QuestionReviewQueueItemDto[];
  pagination: Pagination;
}

export interface QuestionSummaryDto {
  id: string;
  code: string;
  lifecycleStatus: QuestionLifecycleStatus | string;
  revision: number;
  promptPreview: LocalizedText;
  taxonomy: {
    primaryRoleId: string | null;
    additionalRoleIds: string[];
    levelIds: string[];
    technologyIds: string[];
    technologyAgnostic: boolean;
    topic: string | null;
    tags: string[];
  };
  difficulty: string | null;
  type: string | null;
  origin: string | null;
  draftStatus: string | null;
  selectionStatus: string | null;
  latestVersionNumber: number;
  draftVersionNumber: number | null;
  currentPublishedVersionNumber: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionAdminDetailDto {
  question: {
    id: string;
    code: string;
    lifecycleStatus: QuestionLifecycleStatus | string;
    ownerId: string;
    revision: number;
    latestVersionNumber: number;
    draftVersionNumber: number | null;
    currentPublishedVersionNumber: number | null;
    createdAt: string;
    updatedAt: string;
  };
  draftVersion?: QuestionVersionAdminDetailDto | null;
  currentPublishedVersion?: QuestionVersionAdminDetailDto | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface QuestionListResponse {
  items: QuestionSummaryDto[];
  pagination: Pagination;
}

export type QuestionSort = 'updatedAt' | 'createdAt' | 'code';
export type SortOrder = 'asc' | 'desc';

export interface QuestionListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  lifecycleStatus?: string;
  roleId?: string;
  levelId?: string;
  technologyId?: string;
  difficulty?: string;
  type?: string;
  origin?: string;
  sortBy: QuestionSort;
  sortOrder: SortOrder;
}

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';

export interface EditorConflict {
  message: string;
  server: QuestionAdminDetailDto | null;
  serverEtag: string | null;
}

export const emptyQuestionVersionInput = (): QuestionVersionInput => ({
  content: {
    prompt: { vi: '', en: '' },
    explanation: { vi: '', en: '' },
  },
  classification: {
    primaryRoleId: null,
    additionalRoleIds: [],
    levelIds: [],
    technologies: [],
    technologyAgnostic: false,
    classificationComplete: false,
    topic: null,
    tags: [],
    difficulty: null,
    type: null,
  },
  answer: {
    referenceAnswer: { vi: '', en: '' },
    learningObjective: { vi: '', en: '' },
    estimatedTimeSeconds: null,
    followUps: [],
  },
  rubric: [],
  changeSummary: '',
});

export const toVersionInput = (
  version: QuestionVersionAdminDetailDto
): QuestionVersionInput => ({
  content: {
    prompt: {
      vi: version.content?.prompt?.vi ?? '',
      en: version.content?.prompt?.en ?? '',
    },
    explanation: {
      vi: version.content?.explanation?.vi ?? '',
      en: version.content?.explanation?.en ?? '',
    },
  },
  classification: {
    primaryRoleId: version.classification?.primaryRoleId ?? null,
    additionalRoleIds: version.classification?.additionalRoleIds ?? [],
    levelIds: version.classification?.levelIds ?? [],
    technologies: version.classification?.technologies ?? [],
    technologyAgnostic: version.classification?.technologyAgnostic ?? false,
    classificationComplete: version.classification?.classificationComplete ?? false,
    topic: version.classification?.topic ?? null,
    tags: version.classification?.tags ?? [],
    difficulty: version.classification?.difficulty ?? null,
    type: version.classification?.type ?? null,
  },
  answer: {
    referenceAnswer: {
      vi: version.answer?.referenceAnswer?.vi ?? '',
      en: version.answer?.referenceAnswer?.en ?? '',
    },
    learningObjective: {
      vi: version.answer?.learningObjective?.vi ?? '',
      en: version.answer?.learningObjective?.en ?? '',
    },
    estimatedTimeSeconds: version.answer?.estimatedTimeSeconds ?? null,
    followUps: version.answer?.followUps ?? [],
  },
  rubric: version.rubric ?? [],
  changeSummary: version.changeSummary ?? '',
});

// Phase 3 Types
export interface QuestionSelectionInput {
  count: number;
  roleId?: string;
  levelId?: string;
  technologyIds?: string[];
  seed?: number;
  difficulty?: Difficulty;
  type?: QuestionType;
}

export interface QuestionSelectionItem {
  id: string;
  code: string;
  versionNumber: number;
  prompt: LocalizedText;
  type: QuestionType | null;
  difficulty: Difficulty | null;
  primaryRoleId: string | null;
  levelIds: string[];
  technologies: Array<{ technologyId: string; relevance: number | null }>;
}

export interface QuestionSelectionDiagnostics {
  requestedCount: number;
  availableCount: number;
  selectedCount: number;
  isPoolSufficient: boolean;
  insufficientReason: string | null;
}

export interface QuestionSelectionResult {
  selected: QuestionSelectionItem[];
  diagnostics: QuestionSelectionDiagnostics;
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

export interface QuestionImportInput {
  format: 'JSON' | 'CSV';
  dryRun: boolean;
  items?: unknown[];
  csvContent?: string;
}

export interface ExportFilterInput {
  format: 'JSON' | 'CSV';
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

export interface QuestionExportResult {
  format: 'JSON' | 'CSV';
  count: number;
  total: number;
  data?: unknown[];
  csvContent?: string;
}

export interface AiDraftSpecInput {
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

export type TranslationField =
  | 'prompt'
  | 'explanation'
  | 'referenceAnswer'
  | 'learningObjective'
  | 'followUps'
  | 'rubric';

export interface TranslationPreviewInput {
  sourceLocale: 'vi' | 'en';
  targetLocale: 'vi' | 'en';
  fields?: TranslationField[];
}

export interface TranslationPreviewFieldDetail {
  field: TranslationField;
  sourceText: string;
  proposedText: string;
  hasExistingTarget: boolean;
  wouldOverwrite: boolean;
}

export interface TranslationPreviewResult {
  sourceLocale: 'vi' | 'en';
  targetLocale: 'vi' | 'en';
  fields: TranslationPreviewFieldDetail[];
  proposed: Record<string, unknown>;
  diffSummary: {
    totalFields: number;
    newFields: number;
    overwritingFields: number;
  };
}

export interface TranslationApplyInput {
  sourceLocale: 'vi' | 'en';
  targetLocale: 'vi' | 'en';
  fields: TranslationField[];
  confirmOverwrite: boolean;
  translations: Record<string, unknown>;
}

export interface EmbeddingBackfillInput {
  batchSize?: number;
  cursor?: string;
  forceRecompute?: boolean;
}

export interface EmbeddingBackfillResult {
  processed: number;
  computed: number;
  skipped: number;
  failed: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface SemanticDuplicateInput {
  target: 'EXISTING' | 'DRAFT';
  questionId?: string;
  versionNumber?: number;
  draft?: {
    prompt: LocalizedText;
    topic?: string | null;
    tags?: string[];
    difficulty?: Difficulty | null;
    type?: QuestionType | null;
    primaryRoleId?: string | null;
    levelIds?: string[];
    technologyIds?: string[];
  };
  threshold?: number;
  topK?: number;
  filters?: {
    roleId?: string;
    levelId?: string;
    technologyId?: string;
    difficulty?: Difficulty;
    type?: QuestionType;
  };
}

export interface SemanticDuplicateMatch {
  questionId: string;
  versionNumber: number;
  code: string;
  title: LocalizedText;
  similarityScore: number;
  matchReason: 'EXACT_FINGERPRINT' | 'SEMANTIC_SIMILARITY';
  taxonomyOverlap: number;
  status: VersionStatus;
}

export interface SemanticDuplicateResult {
  matches: SemanticDuplicateMatch[];
  totalMatches: number;
  thresholdUsed: number;
}


