import { request, requestWithMetadata } from '../../../auth/apiClient';
import type {
  Pagination,
  QuestionAdminDetailDto,
  QuestionSummaryDto,
  QuestionListQuery,
  QuestionListResponse,
  QuestionVersionAdminDetailDto,
  QuestionVersionInput,
  QuestionVersionSummaryDto,
  QuestionReviewDetailDto,
  ReviewQueueResponse,
  QuestionSelectionInput,
  QuestionSelectionResult,
  QuestionCoverageResult,
  QuestionAnalyticsResult,
  QuestionImportInput,
  QuestionImportResult,
  ExportFilterInput,
  QuestionExportResult,
  AiDraftSpecInput,
  QuestionAiDraftResult,
  TranslationPreviewInput,
  TranslationPreviewResult,
  TranslationApplyInput,
  EmbeddingBackfillInput,
  EmbeddingBackfillResult,
  SemanticDuplicateInput,
  SemanticDuplicateResult,
} from '../types';

const BASE_PATH = 'admin/question-bank/questions';

const buildListQuery = (query: QuestionListQuery): string => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  return params.toString();
};

export const createVersionEtag = (version: QuestionVersionAdminDetailDto): string =>
  `W/"question-version:${version.id}:${version.revision}"`;

export const createQuestionEtag = (question: QuestionAdminDetailDto['question']): string =>
  `W/"question:${question.id}:${question.revision}"`;

export const createQuestionSummaryEtag = (
  question: Pick<QuestionSummaryDto, 'id' | 'revision'>
): string => `W/"question:${question.id}:${question.revision}"`;

export const questionBankApi = {
  listQuestions: (
    query: QuestionListQuery,
    signal?: AbortSignal
  ): Promise<QuestionListResponse> =>
    request<QuestionListResponse>(`${BASE_PATH}?${buildListQuery(query)}`, { signal }),

  getQuestion: (questionId: string, signal?: AbortSignal) =>
    requestWithMetadata<QuestionAdminDetailDto>(`${BASE_PATH}/${questionId}`, { signal }),

  createQuestion: (payload: QuestionVersionInput, idempotencyKey: string) =>
    requestWithMetadata<QuestionAdminDetailDto>(BASE_PATH, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    }),

  createVersion: (
    questionId: string,
    payload: { sourceVersionNumber?: number },
    questionEtag: string,
    idempotencyKey: string
  ) => requestWithMetadata<QuestionVersionAdminDetailDto>(`${BASE_PATH}/${questionId}/versions`, {
    method: 'POST',
    headers: {
      'If-Match': questionEtag,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  }),

  updateQuestionOwner: (questionId: string, ownerId: string, questionEtag: string) =>
    requestWithMetadata<QuestionAdminDetailDto>(`${BASE_PATH}/${questionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/merge-patch+json',
        'If-Match': questionEtag,
      },
      body: JSON.stringify({ ownerId }),
    }),

  updateDraft: (
    questionId: string,
    versionNumber: number,
    payload: QuestionVersionInput,
    etag: string
  ) =>
    requestWithMetadata<QuestionVersionAdminDetailDto>(
      `${BASE_PATH}/${questionId}/versions/${versionNumber}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/merge-patch+json',
          'If-Match': etag,
        },
        body: JSON.stringify(payload),
      }
    ),

  listVersions: async (questionId: string, signal?: AbortSignal) => {
    const data = await request<{
      items: QuestionVersionSummaryDto[];
      pagination?: Pagination;
    }>(`${BASE_PATH}/${questionId}/versions`, { signal });
    return data.items;
  },

  getVersion: (questionId: string, versionNumber: number, signal?: AbortSignal) =>
    request<QuestionVersionAdminDetailDto>(
      `${BASE_PATH}/${questionId}/versions/${versionNumber}`,
      { signal }
    ),

  submitReview: (questionId: string, etag: string, idempotencyKey: string, reason?: string) =>
    requestWithMetadata<QuestionVersionAdminDetailDto>(`${BASE_PATH}/${questionId}/submit-review`, {
      method: 'POST',
      headers: { 'If-Match': etag, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(reason ? { reason } : {}),
    }),

  listReviews: (
    query: { page: number; limit: number; status?: 'IN_REVIEW' | 'APPROVED' },
    signal?: AbortSignal
  ) => {
    const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
    if (query.status) params.set('status', query.status);
    return request<ReviewQueueResponse>(
      `admin/question-bank/reviews?${params.toString()}`,
      { signal }
    );
  },

  getReview: (questionVersionId: string, signal?: AbortSignal) =>
    requestWithMetadata<QuestionReviewDetailDto>(
      `admin/question-bank/reviews/${questionVersionId}`,
      { signal }
    ),

  decideReview: (
    questionVersionId: string,
    decision: 'APPROVE' | 'REQUEST_CHANGES',
    reason: string | undefined,
    etag: string,
    idempotencyKey: string
  ) => requestWithMetadata<QuestionReviewDetailDto>(
    `admin/question-bank/reviews/${questionVersionId}/decision`,
    {
      method: 'POST',
      headers: { 'If-Match': etag, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }),
    }
  ),

  publishVersion: (
    questionId: string,
    versionNumber: number,
    etag: string,
    idempotencyKey: string,
    reason?: string,
    direct = false
  ) => requestWithMetadata<QuestionVersionAdminDetailDto>(
    `${BASE_PATH}/${questionId}/versions/${versionNumber}/publish`,
    {
      method: 'POST',
      headers: { 'If-Match': etag, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        ...(reason ? { reason } : {}),
        ...(direct ? { direct: true } : {}),
      }),
    }
  ),

  transitionLifecycle: (
    questionId: string,
    action: 'retire' | 'restore',
    reason: string,
    etag: string,
    idempotencyKey: string
  ) => requestWithMetadata<QuestionAdminDetailDto>(`${BASE_PATH}/${questionId}/${action}`, {
    method: 'POST',
    headers: { 'If-Match': etag, 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ reason }),
  }),

  selectQuestions: (payload: QuestionSelectionInput) =>
    request<QuestionSelectionResult>('admin/question-bank/selection', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCoverage: (query?: Record<string, string | undefined>, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
    }
    const queryStr = params.toString();
    return request<QuestionCoverageResult>(
      `admin/question-bank/coverage${queryStr ? '?' + queryStr : ''}`,
      { signal }
    );
  },

  getAnalytics: (query?: Record<string, string | undefined>, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
    }
    const queryStr = params.toString();
    return request<QuestionAnalyticsResult>(
      `admin/question-bank/analytics${queryStr ? '?' + queryStr : ''}`,
      { signal }
    );
  },

  importQuestions: (payload: QuestionImportInput, idempotencyKey: string) =>
    requestWithMetadata<QuestionImportResult>('admin/question-bank/imports', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    }),

  exportQuestions: (payload: ExportFilterInput) =>
    request<QuestionExportResult>('admin/question-bank/exports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateAiDraft: (payload: AiDraftSpecInput, idempotencyKey: string) =>
    requestWithMetadata<QuestionAiDraftResult>('admin/question-bank/ai-generations', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    }),

  previewTranslation: (
    questionId: string,
    versionNumber: number,
    payload: TranslationPreviewInput,
    signal?: AbortSignal
  ) =>
    request<TranslationPreviewResult>(
      `${BASE_PATH}/${questionId}/versions/${versionNumber}/translation-preview`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        signal,
      }
    ),

  applyTranslation: (
    questionId: string,
    versionNumber: number,
    payload: TranslationApplyInput,
    ifMatch: string,
    idempotencyKey: string
  ) =>
    requestWithMetadata<QuestionVersionAdminDetailDto>(
      `${BASE_PATH}/${questionId}/versions/${versionNumber}/translation-apply`,
      {
        method: 'POST',
        headers: {
          'If-Match': ifMatch,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      }
    ),

  backfillEmbeddings: (payload: EmbeddingBackfillInput, idempotencyKey?: string) =>
    request<EmbeddingBackfillResult>('admin/question-bank/embeddings/backfill', {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(payload),
    }),

  detectSemanticDuplicates: (payload: SemanticDuplicateInput, signal?: AbortSignal) =>
    request<SemanticDuplicateResult>('admin/question-bank/semantic-duplicates', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    }),
};

export const createIdempotencyKey = (): string => {
  const randomPart = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `qb-admin-${randomPart}`;
};

