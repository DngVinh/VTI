import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Operation = {
  operationId?: string;
  security?: Array<Record<string, unknown>>;
  parameters?: Array<{ $ref?: string }>;
  responses?: Record<string, { $ref?: string }>;
  'x-implementation-status'?: string;
};

type OpenApiDocument = {
  openapi: string;
  paths: Record<string, Record<string, Operation | unknown>>;
  components: {
    parameters: Record<string, unknown>;
    responses: Record<string, {
      headers?: Record<string, unknown>;
      content?: Record<string, { schema?: { $ref?: string } }>;
    }>;
    schemas: Record<string, {
      additionalProperties?: boolean;
      enum?: string[];
      required?: string[];
      properties?: Record<string, unknown>;
    }>;
  };
};

const documentPath = resolve(
  process.cwd(),
  'docs',
  'question-bank',
  'openapi-question-bank.yaml'
);
const document = JSON.parse(readFileSync(documentPath, 'utf8')) as OpenApiDocument;
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

const operations = Object.entries(document.paths).flatMap(([path, item]) =>
  Object.entries(item)
    .filter(([method]) => HTTP_METHODS.has(method))
    .map(([method, operation]) => ({
      path,
      method,
      operation: operation as Operation,
    }))
);

const implementedPhase1 = operations.filter(
  ({ operation }) => operation['x-implementation-status'] === 'implemented-phase-1'
);
const implementedPhase2 = operations.filter(
  ({ operation }) => operation['x-implementation-status'] === 'implemented-phase-2'
);
const implementedPhase3 = operations.filter(
  ({ operation }) => operation['x-implementation-status'] === 'implemented-phase-3'
);
const implementedPhase4 = operations.filter(
  ({ operation }) => operation['x-implementation-status'] === 'implemented-phase-4'
);
const implemented = [
  ...implementedPhase1,
  ...implementedPhase2,
  ...implementedPhase3,
  ...implementedPhase4,
];
const planned = operations.filter(
  ({ operation }) => operation['x-implementation-status'] === 'planned'
);

describe('AIP-65 OpenAPI contract', () => {
  it('is JSON-compatible YAML with the exact Phase 1, Phase 2, Phase 3, and Phase 4 operations', () => {
    expect(document.openapi).toBe('3.1.0');
    expect(implementedPhase1.map(({ method, path }) => method.toUpperCase() + ' ' + path)).toEqual([
      'GET /api/v1/admin/question-bank/questions',
      'POST /api/v1/admin/question-bank/questions',
      'GET /api/v1/admin/question-bank/questions/{questionId}',
      'PATCH /api/v1/admin/question-bank/questions/{questionId}',
      'GET /api/v1/admin/question-bank/questions/{questionId}/versions',
      'POST /api/v1/admin/question-bank/questions/{questionId}/versions',
      'GET /api/v1/admin/question-bank/questions/{questionId}/versions/{versionNumber}',
      'PATCH /api/v1/admin/question-bank/questions/{questionId}/versions/{versionNumber}',
    ]);
    expect(implementedPhase2.map(({ method, path }) => method.toUpperCase() + ' ' + path)).toEqual([
      'POST /api/v1/admin/question-bank/questions/{questionId}/submit-review',
      'GET /api/v1/admin/question-bank/reviews',
      'GET /api/v1/admin/question-bank/reviews/{questionVersionId}',
      'POST /api/v1/admin/question-bank/reviews/{questionVersionId}/decision',
      'POST /api/v1/admin/question-bank/questions/{questionId}/versions/{versionNumber}/publish',
      'POST /api/v1/admin/question-bank/questions/{questionId}/retire',
      'POST /api/v1/admin/question-bank/questions/{questionId}/restore',
    ]);
    expect(implementedPhase3.map(({ method, path }) => method.toUpperCase() + ' ' + path)).toEqual([
      'POST /api/v1/admin/question-bank/selection',
      'GET /api/v1/admin/question-bank/coverage',
      'GET /api/v1/admin/question-bank/analytics',
      'POST /api/v1/admin/question-bank/imports',
      'POST /api/v1/admin/question-bank/exports',
      'POST /api/v1/admin/question-bank/ai-generations',
    ]);
    expect(implementedPhase4.map(({ method, path }) => method.toUpperCase() + ' ' + path)).toEqual([
      'POST /api/v1/admin/question-bank/questions/{questionId}/versions/{versionNumber}/translation-preview',
      'POST /api/v1/admin/question-bank/questions/{questionId}/versions/{versionNumber}/translation-apply',
      'POST /api/v1/admin/question-bank/embeddings/backfill',
      'POST /api/v1/admin/question-bank/semantic-duplicates',
    ]);
    expect(new Set(implemented.map(({ operation }) => operation.operationId)).size).toBe(25);
    expect(planned).toHaveLength(0);
  });

  it('requires bearer authentication and stable security/cache response headers', () => {
    for (const { operation } of implemented) {
      expect(operation.security).toEqual([{ bearerAuth: [] }]);
      for (const response of Object.values(operation.responses ?? {})) {
        const reference = response.$ref;
        if (!reference) continue;
        const name = reference.split('/').at(-1) as string;
        const declared = document.components.responses[name];
        expect(declared.headers).toHaveProperty('X-Request-Id');
        expect(declared.headers).toHaveProperty('Cache-Control');
      }
    }
  });

  it('documents idempotency and optimistic-concurrency preconditions on mutations', () => {
    const byOperationId = new Map(
      implemented.map(({ operation }) => [operation.operationId, operation])
    );
    const refs = (operationId: string) =>
      byOperationId.get(operationId)?.parameters?.map((parameter) => parameter.$ref) ?? [];

    expect(refs('createAdminQuestion')).toContain('#/components/parameters/IdempotencyKey');
    expect(refs('createAdminQuestionVersion')).toEqual(
      expect.arrayContaining([
        '#/components/parameters/IdempotencyKey',
        '#/components/parameters/IfMatch',
      ])
    );
    expect(refs('updateAdminQuestion')).toContain('#/components/parameters/IfMatch');
    expect(refs('updateAdminQuestionVersion')).toContain(
      '#/components/parameters/IfMatch'
    );
    expect(byOperationId.get('updateAdminQuestion')?.responses).toHaveProperty('428');
    expect(byOperationId.get('updateAdminQuestionVersion')?.responses).toHaveProperty('428');

    for (const operationId of [
      'submitQuestionForReview',
      'decideQuestionReview',
      'publishQuestionVersion',
      'retireQuestion',
      'restoreQuestion',
      'applyQuestionTranslation',
    ]) {
      expect(refs(operationId), operationId).toEqual(
        expect.arrayContaining([
          '#/components/parameters/IdempotencyKey',
          '#/components/parameters/IfMatch',
        ])
      );
      expect(byOperationId.get(operationId)?.responses).toHaveProperty('428');
    }

    for (const operationId of ['importQuestions', 'generateQuestionDraftWithAi']) {
      expect(refs(operationId), operationId).toContain('#/components/parameters/IdempotencyKey');
    }
  });

  it('keeps request DTOs strict and prevents create clients from setting server-owned fields', () => {
    const schemas = document.components.schemas;
    for (const name of [
      'DraftFields',
      'CreateVersionRequest',
      'UpdateQuestionRequest',
      'QuestionAdminListItem',
      'QuestionAdminDetail',
      'QuestionVersionAdminDetail',
      'QuestionVersionSummary',
      'ReviewQueueItem',
      'QuestionReviewHistory',
      'ReviewDetail',
      'ReviewDecisionRequest',
      'LifecycleReasonRequest',
      'ErrorResponse',
      'SelectQuestionsRequest',
      'QuestionSelectionItem',
      'QuestionSelectionDiagnostics',
      'QuestionSelectionResponse',
      'CoverageBreakdownItem',
      'CoverageGapItem',
      'QuestionCoverageResponse',
      'ActivityTimelineItem',
      'QuestionAnalyticsResponse',
      'ImportRowInput',
      'ImportQuestionsRequest',
      'ImportRowError',
      'QuestionImportResponse',
      'ExportQuestionsRequest',
      'QuestionExportResponse',
      'GenerateAiDraftRequest',
      'AiDraftGenerationResponse',
      'TranslationPreviewRequest',
      'TranslationPreviewFieldDetail',
      'TranslationPreviewResponse',
      'TranslationApplyRequest',
      'EmbeddingBackfillRequest',
      'EmbeddingBackfillResponse',
      'SemanticDuplicateFilter',
      'SemanticDuplicateRequest',
      'SemanticDuplicateMatch',
      'SemanticDuplicateResponse',
    ]) {
      expect(schemas[name].additionalProperties, name).toBe(false);
    }

    const createProperties = schemas.DraftFields.properties ?? {};
    for (const serverOwned of [
      'id',
      'code',
      'status',
      'revision',
      'origin',
      'createdBy',
      'updatedBy',
      'currentPublishedVersionId',
      'draftVersionId',
    ]) {
      expect(createProperties, serverOwned).not.toHaveProperty(serverOwned);
    }
  });

  it('matches the nested runtime DTOs and stable enums', () => {
    const schemas = document.components.schemas;
    expect(schemas.QuestionAdminDetail.required).toEqual([
      'question',
      'draftVersion',
      'currentPublishedVersion',
    ]);
    expect(schemas.QuestionVersionAdminDetail.required).toEqual(
      expect.arrayContaining(['content', 'classification', 'answer', 'provenance'])
    );
    expect(schemas.QuestionAdminListItem.required).toEqual(
      expect.arrayContaining(['promptPreview', 'taxonomy', 'draftStatus', 'selectionStatus'])
    );
    expect(schemas.QuestionVersionSummary.properties).not.toHaveProperty('answer');
    expect(schemas.QuestionVersionSummary.properties).not.toHaveProperty('rubric');
    expect(schemas.ReviewQueueItem.properties).not.toHaveProperty('answer');
    expect(schemas.ReviewQueueItem.properties).not.toHaveProperty('rubric');
    expect(schemas.ReviewDetail.required).toEqual(
      expect.arrayContaining(['snapshot', 'history', 'completenessErrors', 'allowedActions'])
    );
    expect(schemas.QuestionType.enum).toEqual([
      'TECHNICAL',
      'BEHAVIORAL',
      'SYSTEM_DESIGN',
      'CODING',
      'SCENARIO',
    ]);
    expect(schemas.ErrorCode.enum).toEqual(
      expect.arrayContaining([
        'VALIDATION_ERROR',
        'QUESTION_REVISION_CONFLICT',
        'QUESTION_VERSION_IMMUTABLE',
        'QUESTION_CONTENT_INCOMPLETE',
        'QUESTION_FOUR_EYES_VIOLATION',
        'QUESTION_REVIEW_NOT_FOUND',
        'IDEMPOTENCY_KEY_REUSED',
        'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        'PRECONDITION_REQUIRED',
        'QUESTION_SELECTION_FAILED',
        'QUESTION_IMPORT_VALIDATION_FAILED',
        'AI_PROVIDER_ERROR',
        'AI_PROVIDER_RATE_LIMIT',
        'AI_PROVIDER_TIMEOUT',
        'AI_PROVIDER_SCHEMA_ERROR',
        'QUESTION_TRANSLATION_SOURCE_MISSING',
        'QUESTION_TRANSLATION_OVERWRITE_CONFIRMATION_REQUIRED',
        'QUESTION_TRANSLATION_SCHEMA_ERROR',
        'QUESTION_TRANSLATION_DISABLED',
        'QUESTION_EMBEDDING_PROVIDER_UNAVAILABLE',
        'QUESTION_EMBEDDING_INVALID_DIMENSIONS',
        'QUESTION_EMBEDDING_BACKFILL_IN_PROGRESS',
        'QUESTION_EMBEDDING_BACKFILL_DISABLED',
        'QUESTION_SEMANTIC_SEARCH_DISABLED',
        'QUESTION_SEMANTIC_SEARCH_UNAVAILABLE',
        'QUESTION_DUPLICATE_QUERY_INVALID',
        'INTERNAL_SERVER_ERROR',
      ])
    );
  });
});
