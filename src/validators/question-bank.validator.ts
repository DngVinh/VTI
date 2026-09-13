import { z } from 'zod';

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const unsafeControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const boundedText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .refine((value) => !unsafeControlCharacters.test(value), 'Nội dung chứa ký tự điều khiển không hợp lệ');

const nullableText = (maximum: number) => boundedText(maximum).nullable().optional();
const objectId = z.string().regex(objectIdPattern, 'ObjectId không hợp lệ');

const uniqueArray = <T extends z.ZodTypeAny>(schema: T, maximum: number) =>
  z
    .array(schema)
    .max(maximum)
    .refine((values) => new Set(values).size === values.length, 'Danh sách không được chứa giá trị trùng lặp');

const localized = (maximum: number) =>
  z
    .object({
      vi: nullableText(maximum),
      en: nullableText(maximum),
    })
    .strict();

const promptContentSchema = z
  .object({
    prompt: localized(5_000).optional(),
    explanation: localized(5_000).optional(),
  })
  .strict();

const technologyAssignmentSchema = z
  .object({
    technologyId: objectId,
    relevance: z.number().min(0).max(100).nullable().optional(),
  })
  .strict();

const classificationSchema = z
  .object({
    primaryRoleId: objectId.nullable().optional(),
    additionalRoleIds: uniqueArray(objectId, 10).optional(),
    levelIds: uniqueArray(objectId, 10).optional(),
    technologies: z
      .array(technologyAssignmentSchema)
      .max(20)
      .refine(
        (values) =>
          new Set(values.map((value) => value.technologyId)).size === values.length,
        'Mỗi technology chỉ được gán một lần'
      )
      .optional(),
    technologyAgnostic: z.boolean().optional(),
    classificationComplete: z.boolean().optional(),
    topic: nullableText(200),
    tags: uniqueArray(
      z.string().trim().toLowerCase().regex(kebabCasePattern, 'Tag phải ở dạng kebab-case'),
      20
    ).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).nullable().optional(),
    type: z
      .enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'SCENARIO'])
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.primaryRoleId &&
      value.additionalRoleIds?.includes(value.primaryRoleId)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['additionalRoleIds'],
        message: 'Additional roles không được chứa primary role',
      });
    }

    if (
      value.classificationComplete === true &&
      value.technologyAgnostic === false &&
      (!value.technologies || value.technologies.length === 0)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['technologies'],
        message: 'Classification hoàn chỉnh phải có technology hoặc được đánh dấu agnostic',
      });
    }
  });

const answerSchema = z
  .object({
    referenceAnswer: localized(20_000).optional(),
    learningObjective: localized(1_000).optional(),
    estimatedTimeSeconds: z.number().int().min(30).max(3_600).nullable().optional(),
    followUps: z.array(localized(1_000)).max(5).optional(),
  })
  .strict();

const rubricLevelSchema = z
  .object({
    score: z.number().int().min(0).max(4),
    description: localized(2_000),
  })
  .strict();

const rubricCriterionSchema = z
  .object({
    key: z.string().trim().regex(kebabCasePattern, 'Rubric key phải ở dạng kebab-case'),
    title: localized(500),
    description: localized(2_000).optional(),
    weight: z.number().int().min(1).max(100),
    levels: z
      .array(rubricLevelSchema)
      .min(1)
      .max(5)
      .refine(
        (levels) => new Set(levels.map((level) => level.score)).size === levels.length,
        'Mỗi score rubric chỉ được xuất hiện một lần'
      ),
  })
  .strict();

const rubricSchema = z
  .array(rubricCriterionSchema)
  .max(10)
  .superRefine((criteria, context) => {
    if (criteria.length === 1) {
      context.addIssue({
        code: 'custom',
        message: 'Rubric phải có từ 2 đến 10 tiêu chí',
      });
    }

    if (new Set(criteria.map((criterion) => criterion.key)).size !== criteria.length) {
      context.addIssue({
        code: 'custom',
        message: 'Rubric key phải duy nhất',
      });
    }

    if (
      criteria.length > 0 &&
      criteria.reduce((total, criterion) => total + criterion.weight, 0) !== 100
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Tổng trọng số rubric phải bằng 100',
      });
    }
  });

export const questionVersionAuthoringSchema = z
  .object({
    content: promptContentSchema.optional(),
    classification: classificationSchema.optional(),
    answer: answerSchema.optional(),
    rubric: rubricSchema.optional(),
    changeSummary: nullableText(1_000),
  })
  .strict();

const isMeaningfulAuthoringValue = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some(isMeaningfulAuthoringValue);
  if (value && typeof value === 'object') {
    return Object.values(value).some(isMeaningfulAuthoringValue);
  }
  return false;
};

const hasAuthoringValue = (value: z.infer<typeof questionVersionAuthoringSchema>): boolean =>
  isMeaningfulAuthoringValue(value);

const hasPatchOperation = (value: unknown): boolean => {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== 'object') return true;
  const entries = Object.values(value);
  return entries.length > 0 && entries.some(hasPatchOperation);
};

export const createQuestionSchema = z
  .object({
    body: questionVersionAuthoringSchema.refine(
      hasAuthoringValue,
      'Cần cung cấp ít nhất một trường nội dung để tạo Draft'
    ),
    query: z.object({}).strict(),
    params: z.object({}).strict(),
  })
  .strict();

export const listQuestionsSchema = z
  .object({
    body: z.unknown().optional(),
    params: z.object({}).strict(),
    query: z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: boundedText(200).min(2).optional(),
        sortBy: z.enum(['updatedAt', 'createdAt', 'code']).default('updatedAt'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
        status: z
          .enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'SUPERSEDED'])
          .optional(),
        lifecycleStatus: z.enum(['ACTIVE', 'RETIRED']).optional(),
        roleId: objectId.optional(),
        levelId: objectId.optional(),
        technologyId: objectId.optional(),
        difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
        type: z
          .enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'SCENARIO'])
          .optional(),
        origin: z.enum(['MANUAL', 'IMPORTED', 'AI_ASSISTED']).optional(),
      })
      .strict(),
  })
  .strict();

export const questionIdParamsSchema = z
  .object({ questionId: objectId })
  .strict();

export const questionVersionParamsSchema = questionIdParamsSchema
  .extend({
    versionNumber: z.coerce.number().int().min(1),
  })
  .strict();

export const questionDetailSchema = z
  .object({
    body: z.unknown().optional(),
    query: z.object({}).strict(),
    params: questionIdParamsSchema,
  })
  .strict();

export const questionVersionDetailSchema = z
  .object({
    body: z.unknown().optional(),
    query: z.object({}).strict(),
    params: questionVersionParamsSchema,
  })
  .strict();

export const updateQuestionSchema = z
  .object({
    body: z.object({ ownerId: objectId }).strict(),
    query: z.object({}).strict(),
    params: questionIdParamsSchema,
  })
  .strict();

export const updateQuestionVersionSchema = z
  .object({
    body: questionVersionAuthoringSchema.refine(
      hasPatchOperation,
      'PATCH phải chứa ít nhất một trường thay đổi'
    ),
    query: z.object({}).strict(),
    params: questionVersionParamsSchema,
  })
  .strict();

export const createQuestionVersionSchema = z
  .object({
    body: questionVersionAuthoringSchema
      .extend({
        sourceVersionNumber: z.number().int().min(1).optional(),
      })
      .strict(),
    query: z.object({}).strict(),
    params: questionIdParamsSchema,
  })
  .strict();

const reasonSchema = z.string().trim().min(3).max(5_000);

export const submitReviewSchema = z
  .object({
    body: z.object({ reason: reasonSchema.optional() }).strict(),
    query: z.object({}).strict(),
    params: questionIdParamsSchema,
  })
  .strict();

export const reviewQueueSchema = z
  .object({
    body: z.unknown().optional(),
    params: z.object({}).strict(),
    query: z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        status: z.enum(['IN_REVIEW', 'APPROVED']).optional(),
      })
      .strict(),
  })
  .strict();

export const reviewVersionParamsSchema = z
  .object({ questionVersionId: objectId })
  .strict();

export const reviewDetailSchema = z
  .object({
    body: z.unknown().optional(),
    query: z.object({}).strict(),
    params: reviewVersionParamsSchema,
  })
  .strict();

export const reviewDecisionSchema = z
  .object({
    body: z
      .object({
        decision: z.enum(['APPROVE', 'REQUEST_CHANGES']),
        reason: reasonSchema.optional(),
      })
      .strict()
      .superRefine((value, context) => {
        if (value.decision === 'REQUEST_CHANGES' && !value.reason) {
          context.addIssue({
            code: 'custom',
            path: ['reason'],
            message: 'Reason là bắt buộc khi yêu cầu chỉnh sửa',
          });
        }
      }),
    query: z.object({}).strict(),
    params: reviewVersionParamsSchema,
  })
  .strict();

export const publishQuestionVersionSchema = z
  .object({
    body: z.object({ reason: reasonSchema.optional() }).strict(),
    query: z.object({}).strict(),
    params: questionVersionParamsSchema,
  })
  .strict();

export const questionLifecycleSchema = z
  .object({
    body: z.object({ reason: reasonSchema }).strict(),
    query: z.object({}).strict(),
    params: questionIdParamsSchema,
  })
  .strict();

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>['body'];
export type ListQuestionsInput = z.infer<typeof listQuestionsSchema>['query'];
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>['body'];
export type UpdateQuestionVersionInput = z.infer<typeof updateQuestionVersionSchema>['body'];
export type CreateQuestionVersionInput = z.infer<typeof createQuestionVersionSchema>['body'];
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>['body'];
export type ReviewQueueInput = z.infer<typeof reviewQueueSchema>['query'];
export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>['body'];
export type PublishQuestionVersionInput = z.infer<typeof publishQuestionVersionSchema>['body'];
export type QuestionLifecycleInput = z.infer<typeof questionLifecycleSchema>['body'];

// Phase 3 Schemas
export const selectQuestionsSchema = z
  .object({
    body: z
      .object({
        roleId: objectId.optional(),
        levelId: objectId.optional(),
        technologyIds: uniqueArray(objectId, 20).optional(),
        language: z.enum(['vi', 'en']).optional(),
        difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
        type: z.enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'SCENARIO']).optional(),
        tags: uniqueArray(
          z.string().trim().toLowerCase().regex(kebabCasePattern, 'Tag phải ở dạng kebab-case'),
          20
        ).optional(),
        excludeQuestionIds: uniqueArray(objectId, 100).optional(),
        count: z.coerce.number().int().min(1).max(50).default(5),
        seed: z.union([z.string().trim().min(1).max(100), z.number()]).optional(),
      })
      .strict(),
    query: z.object({}).strict(),
    params: z.object({}).strict(),
  })
  .strict();

export const coverageQuerySchema = z
  .object({
    body: z.unknown().optional(),
    params: z.object({}).strict(),
    query: z
      .object({
        roleId: objectId.optional(),
        levelId: objectId.optional(),
        technologyId: objectId.optional(),
        language: z.enum(['vi', 'en']).optional(),
        difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
        type: z.enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'SCENARIO']).optional(),
      })
      .strict(),
  })
  .strict();

export const analyticsQuerySchema = z
  .object({
    body: z.unknown().optional(),
    params: z.object({}).strict(),
    query: z
      .object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        period: z.enum(['day', 'week', 'month']).default('day').optional(),
      })
      .strict(),
  })
  .strict();

const importItemSchema = z
  .object({
    prompt: localized(5_000),
    explanation: localized(5_000).optional(),
    referenceAnswer: localized(20_000),
    learningObjective: localized(5_000).optional(),
    estimatedTimeSeconds: z.number().int().min(30).max(7200).nullable().optional(),
    type: z.enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'SCENARIO']),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    primaryRoleId: objectId,
    additionalRoleIds: uniqueArray(objectId, 10).optional(),
    levelIds: uniqueArray(objectId, 10),
    technologyIds: uniqueArray(objectId, 20).optional(),
    technologyAgnostic: z.boolean().optional(),
    topic: nullableText(200),
    tags: uniqueArray(
      z.string().trim().toLowerCase().regex(kebabCasePattern, 'Tag phải ở dạng kebab-case'),
      20
    ).optional(),
    followUps: z.array(localized(2_000)).max(10).optional(),
    rubric: rubricSchema.optional(),
    changeSummary: nullableText(500),
  })
  .strict();

export const importQuestionsSchema = z
  .object({
    body: z
      .object({
        format: z.enum(['JSON', 'CSV']).default('JSON'),
        dryRun: z.boolean().default(false),
        content: z.string().max(2_000_000).optional(),
        items: z.array(importItemSchema).max(100).optional(),
      })
      .strict()
      .superRefine((data, ctx) => {
        if (!data.content && (!data.items || data.items.length === 0)) {
          ctx.addIssue({
            code: 'custom',
            path: ['items'],
            message: 'Phải cung cấp items hoặc content để import',
          });
        }
      }),
    query: z.object({}).strict(),
    params: z.object({}).strict(),
  })
  .strict();

export const exportQuestionsSchema = z
  .object({
    body: z
      .object({
        format: z.enum(['JSON', 'CSV']).default('JSON'),
        lifecycleStatus: z.enum(['ACTIVE', 'RETIRED']).optional(),
        status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'SUPERSEDED']).optional(),
        roleId: objectId.optional(),
        levelId: objectId.optional(),
        technologyId: objectId.optional(),
        difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
        type: z.enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'SCENARIO']).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .strict(),
    query: z.object({}).strict(),
    params: z.object({}).strict(),
  })
  .strict();

export const generateAiDraftSchema = z
  .object({
    body: z
      .object({
        topic: boundedText(200),
        roleId: objectId,
        levelId: objectId,
        technologyId: objectId.optional(),
        difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
        type: z.enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'SCENARIO']),
        language: z.enum(['vi', 'en', 'both']).default('both'),
        additionalInstructions: boundedText(500).optional(),
        persistDraft: z.boolean().default(false),
      })
      .strict(),
    query: z.object({}).strict(),
    params: z.object({}).strict(),
  })
  .strict();

export const translationPreviewSchema = z
  .object({
    body: z
      .object({
        sourceLocale: z.enum(['vi', 'en']),
        targetLocale: z.enum(['vi', 'en']),
        fields: z
          .array(
            z.enum([
              'prompt',
              'explanation',
              'referenceAnswer',
              'learningObjective',
              'followUps',
              'rubric',
            ])
          )
          .max(6)
          .optional(),
      })
      .strict()
      .superRefine((data, ctx) => {
        if (data.sourceLocale === data.targetLocale) {
          ctx.addIssue({
            code: 'custom',
            path: ['targetLocale'],
            message: 'sourceLocale và targetLocale không được trùng nhau',
          });
        }
      }),
    query: z.object({}).strict(),
    params: z
      .object({
        questionId: objectId,
        versionNumber: z.coerce.number().int().min(1),
      })
      .strict(),
  })
  .strict();

export const translationApplySchema = z
  .object({
    body: z
      .object({
        sourceLocale: z.enum(['vi', 'en']),
        targetLocale: z.enum(['vi', 'en']),
        fields: z
          .array(
            z.enum([
              'prompt',
              'explanation',
              'referenceAnswer',
              'learningObjective',
              'followUps',
              'rubric',
            ])
          )
          .min(1, 'Phải chọn ít nhất một trường để áp dụng')
          .max(6),
        confirmOverwrite: z.boolean().default(false),
        translations: z
          .object({
            prompt: boundedText(20_000).nullable().optional(),
            explanation: boundedText(20_000).nullable().optional(),
            referenceAnswer: boundedText(20_000).nullable().optional(),
            learningObjective: boundedText(20_000).nullable().optional(),
            followUps: z.array(boundedText(5_000)).max(10).nullable().optional(),
            rubric: z
              .array(
                z
                  .object({
                    key: z.string().trim().min(1),
                    title: boundedText(200),
                    description: boundedText(1_000),
                    levels: z
                      .array(
                        z
                          .object({
                            score: z.union([
                              z.literal(0),
                              z.literal(1),
                              z.literal(2),
                              z.literal(3),
                              z.literal(4),
                            ]),
                            description: boundedText(1_000),
                          })
                          .strict()
                      )
                      .min(2),
                  })
                  .strict()
              )
              .max(10)
              .nullable()
              .optional(),
          })
          .strict(),
      })
      .strict()
      .superRefine((data, ctx) => {
        if (data.sourceLocale === data.targetLocale) {
          ctx.addIssue({
            code: 'custom',
            path: ['targetLocale'],
            message: 'sourceLocale và targetLocale không được trùng nhau',
          });
        }
      }),
    query: z.object({}).strict(),
    params: z
      .object({
        questionId: objectId,
        versionNumber: z.coerce.number().int().min(1),
      })
      .strict(),
  })
  .strict();

export const embeddingBackfillSchema = z
  .object({
    body: z
      .object({
        batchSize: z.coerce.number().int().min(1).max(50).default(20),
        cursor: objectId.optional(),
        forceRecompute: z.boolean().default(false),
      })
      .strict(),
    query: z.object({}).strict(),
    params: z.object({}).strict(),
  })
  .strict();

export const semanticDuplicateSchema = z
  .object({
    body: z
      .object({
        target: z.enum(['EXISTING', 'DRAFT']),
        questionId: objectId.optional(),
        versionNumber: z.coerce.number().int().min(1).optional(),
        draft: z
          .object({
            prompt: localized(5_000),
            topic: nullableText(200),
            tags: uniqueArray(
              z.string().trim().toLowerCase().regex(kebabCasePattern, 'Tag phải ở dạng kebab-case'),
              20
            ).optional(),
            difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).nullable().optional(),
            type: z
              .enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'SCENARIO'])
              .nullable()
              .optional(),
            primaryRoleId: objectId.nullable().optional(),
            levelIds: uniqueArray(objectId, 10).optional(),
            technologyIds: uniqueArray(objectId, 20).optional(),
          })
          .strict()
          .optional(),
        threshold: z.coerce.number().min(0.5).max(0.99).default(0.75),
        topK: z.coerce.number().int().min(1).max(20).default(10),
        filters: z
          .object({
            roleId: objectId.optional(),
            levelId: objectId.optional(),
            technologyId: objectId.optional(),
            difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
            type: z
              .enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'SCENARIO'])
              .optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .superRefine((data, ctx) => {
        if (data.target === 'EXISTING') {
          if (!data.questionId || data.versionNumber === undefined) {
            ctx.addIssue({
              code: 'custom',
              path: ['questionId'],
              message: 'questionId và versionNumber là bắt buộc khi target là EXISTING',
            });
          }
          if (data.draft) {
            ctx.addIssue({
              code: 'custom',
              path: ['draft'],
              message: 'Không được truyền draft khi target là EXISTING',
            });
          }
        } else if (data.target === 'DRAFT') {
          if (!data.draft || (!data.draft.prompt?.vi && !data.draft.prompt?.en)) {
            ctx.addIssue({
              code: 'custom',
              path: ['draft'],
              message: 'draft với prompt (vi hoặc en) là bắt buộc khi target là DRAFT',
            });
          }
          if (data.questionId || data.versionNumber !== undefined) {
            ctx.addIssue({
              code: 'custom',
              path: ['questionId'],
              message: 'Không được truyền questionId hoặc versionNumber khi target là DRAFT',
            });
          }
        }
      }),
    query: z.object({}).strict(),
    params: z.object({}).strict(),
  })
  .strict();

export type SelectQuestionsInput = z.infer<typeof selectQuestionsSchema>['body'];
export type CoverageQueryInput = z.infer<typeof coverageQuerySchema>['query'];
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>['query'];
export type ImportQuestionsInput = z.infer<typeof importQuestionsSchema>['body'];
export type ExportQuestionsInput = z.infer<typeof exportQuestionsSchema>['body'];
export type GenerateAiDraftInput = z.infer<typeof generateAiDraftSchema>['body'];
export type TranslationPreviewInput = z.infer<typeof translationPreviewSchema>['body'];
export type TranslationApplyInput = z.infer<typeof translationApplySchema>['body'];
export type EmbeddingBackfillInput = z.infer<typeof embeddingBackfillSchema>['body'];
export type SemanticDuplicateInput = z.infer<typeof semanticDuplicateSchema>['body'];


