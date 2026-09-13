import {
  QuestionAdminDetailDto,
  QuestionAdminListDto,
  QuestionVersionAdminDetailDto,
  QuestionVersionSummaryDto,
  QuestionReviewDetailDto,
  QuestionReviewQueueItemDto,
} from '../../mappers/question-bank.mapper';
import {
  CreateQuestionInput,
  CreateQuestionVersionInput,
  ListQuestionsInput,
  UpdateQuestionInput,
  UpdateQuestionVersionInput,
  PublishQuestionVersionInput,
  QuestionLifecycleInput,
  ReviewDecisionInput,
  ReviewQueueInput,
  SubmitReviewInput,
  SelectQuestionsInput,
  CoverageQueryInput,
  AnalyticsQueryInput,
  ImportQuestionsInput,
  ExportQuestionsInput,
  GenerateAiDraftInput,
} from '../../validators/question-bank.validator';
import {
  QuestionSelectionResult,
  QuestionCoverageResult,
  QuestionAnalyticsResult,
  QuestionImportResult,
  QuestionExportResult,
  QuestionAiDraftResult,
} from '../../domain/question-bank/types';

export interface QuestionBankCommandContext {
  actorId: string;
  idempotencyKey: string;
  route: string;
  requestId?: string;
}

export interface QuestionBankPrecondition {
  resourceId: string;
  revision: number;
}

export interface QuestionBankMutationResult<T> {
  data: T;
  etag: string;
  replayed?: boolean;
}

export interface QuestionBankReadResult<T> {
  data: T;
  etag?: string;
}

export interface QuestionBankListResult {
  items: QuestionAdminListDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IQuestionBankService {
  listQuestions(query: ListQuestionsInput): Promise<QuestionBankListResult>;
  createQuestion(
    input: CreateQuestionInput,
    context: QuestionBankCommandContext
  ): Promise<QuestionBankMutationResult<QuestionAdminDetailDto>>;
  getQuestion(questionId: string): Promise<QuestionBankReadResult<QuestionAdminDetailDto>>;
  updateQuestion(
    questionId: string,
    input: UpdateQuestionInput,
    precondition: QuestionBankPrecondition,
    actorId: string
  ): Promise<QuestionBankMutationResult<QuestionAdminDetailDto>>;
  listVersions(questionId: string): Promise<QuestionVersionSummaryDto[]>;
  createVersion(
    questionId: string,
    input: CreateQuestionVersionInput,
    context: QuestionBankCommandContext,
    aggregatePrecondition: QuestionBankPrecondition
  ): Promise<QuestionBankMutationResult<QuestionVersionAdminDetailDto>>;
  getVersion(
    questionId: string,
    versionNumber: number
  ): Promise<QuestionBankReadResult<QuestionVersionAdminDetailDto>>;
  updateVersion(
    questionId: string,
    versionNumber: number,
    input: UpdateQuestionVersionInput,
    precondition: QuestionBankPrecondition,
    actorId: string
  ): Promise<QuestionBankMutationResult<QuestionVersionAdminDetailDto>>;
  submitReview(
    questionId: string,
    input: SubmitReviewInput,
    context: QuestionBankCommandContext,
    precondition: QuestionBankPrecondition
  ): Promise<QuestionBankMutationResult<QuestionVersionAdminDetailDto>>;
  listReviews(query: ReviewQueueInput): Promise<{
    items: QuestionReviewQueueItemDto[];
    pagination: QuestionBankListResult['pagination'];
  }>;
  getReview(questionVersionId: string, actorId: string): Promise<QuestionBankReadResult<QuestionReviewDetailDto>>;
  decideReview(
    questionVersionId: string,
    input: ReviewDecisionInput,
    context: QuestionBankCommandContext,
    precondition: QuestionBankPrecondition
  ): Promise<QuestionBankMutationResult<QuestionReviewDetailDto>>;
  publishVersion(
    questionId: string,
    versionNumber: number,
    input: PublishQuestionVersionInput,
    context: QuestionBankCommandContext,
    precondition: QuestionBankPrecondition
  ): Promise<QuestionBankMutationResult<QuestionVersionAdminDetailDto>>;
  retireQuestion(
    questionId: string,
    input: QuestionLifecycleInput,
    context: QuestionBankCommandContext,
    precondition: QuestionBankPrecondition
  ): Promise<QuestionBankMutationResult<QuestionAdminDetailDto>>;
  restoreQuestion(
    questionId: string,
    input: QuestionLifecycleInput,
    context: QuestionBankCommandContext,
    precondition: QuestionBankPrecondition
  ): Promise<QuestionBankMutationResult<QuestionAdminDetailDto>>;

  selectQuestions(input: SelectQuestionsInput): Promise<QuestionSelectionResult>;
  getCoverage(query: CoverageQueryInput): Promise<QuestionCoverageResult>;
  getAnalytics(query: AnalyticsQueryInput): Promise<QuestionAnalyticsResult>;
  importQuestions(
    input: ImportQuestionsInput,
    context: QuestionBankCommandContext
  ): Promise<QuestionBankMutationResult<QuestionImportResult>>;
  exportQuestions(input: ExportQuestionsInput): Promise<QuestionExportResult>;
  generateAiDraft(
    input: GenerateAiDraftInput,
    context: QuestionBankCommandContext
  ): Promise<QuestionBankMutationResult<QuestionAiDraftResult>>;

  previewTranslation(
    questionId: string,
    versionNumber: number,
    input: import('../../validators/question-bank.validator').TranslationPreviewInput,
    requestId: string
  ): Promise<import('../../domain/question-bank/types').QuestionTranslationPreviewResult>;

  applyTranslation(
    questionId: string,
    versionNumber: number,
    input: import('../../validators/question-bank.validator').TranslationApplyInput,
    precondition: QuestionBankPrecondition,
    context: QuestionBankCommandContext
  ): Promise<QuestionBankMutationResult<QuestionVersionAdminDetailDto>>;

  backfillEmbeddings(
    input: import('../../validators/question-bank.validator').EmbeddingBackfillInput,
    context: QuestionBankCommandContext
  ): Promise<import('../../domain/question-bank/types').QuestionEmbeddingBackfillResult>;

  detectSemanticDuplicates(
    input: import('../../validators/question-bank.validator').SemanticDuplicateInput,
    requestId: string
  ): Promise<import('../../domain/question-bank/types').QuestionDuplicateDetectionResult>;
}
