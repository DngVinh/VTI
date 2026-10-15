import { z } from 'zod';
import { emptyQuerySchema, idParamsSchema, objectIdSchema, resourceQuerySchema } from './common.validator';

const uniqueObjectIds = z
  .array(objectIdSchema)
  .min(1, 'Cần chọn ít nhất một công nghệ')
  .max(10, 'Chỉ được chọn tối đa 10 công nghệ')
  .refine((ids) => new Set(ids).size === ids.length, 'Danh sách công nghệ không được trùng lặp');

const setupBodySchema = z
  .object({
    jobPosition: objectIdSchema,
    level: objectIdSchema,
    techStacks: uniqueObjectIds,
    language: z.enum(['VI', 'EN']).default('VI'),
    secondsPerQuestion: z.coerce.number().int().min(60).max(600).default(300),
    strategy: z.enum(['STANDARD', 'ADAPTIVE']).default('STANDARD'),
  })
  .strict();



const jdSetupBodySchema = z
  .object({
    language: z.enum(['VI', 'EN']).default('VI'),
    secondsPerQuestion: z.coerce.number().int().min(60).max(600).default(300),
    strategy: z.enum(['STANDARD', 'ADAPTIVE']).default('STANDARD'),
  })
  .strict();

const answerSchema = z
  .object({
    questionId: objectIdSchema,
    candidateAnswer: z.string().trim().max(5000, 'Câu trả lời không được vượt quá 5000 ký tự'),
  })
  .strict();

const answersSchema = z
  .array(answerSchema)
  .min(1, 'Cần có ít nhất một câu trả lời')
  .max(5, 'Chỉ chấp nhận tối đa 5 câu trả lời')
  .refine(
    (answers) => new Set(answers.map((answer) => answer.questionId)).size === answers.length,
    'Mỗi câu hỏi chỉ được xuất hiện một lần'
  );

const answersBodySchema = z.object({ answers: answersSchema }).strict();

const idempotencyKeySchema = z
  .string()
  .min(16, 'Idempotency-Key phải có ít nhất 16 ký tự')
  .max(128, 'Idempotency-Key không được vượt quá 128 ký tự')
  .regex(/^[\x21-\x7E]+$/, 'Idempotency-Key chỉ được chứa ký tự ASCII hiển thị');

const idempotencyHeadersSchema = z.object({
  'idempotency-key': idempotencyKeySchema,
}).passthrough();

const progressBodySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  answers: answersSchema,
}).strict();

const submitAnswerSchema = z.discriminatedUnion('state', [
  z.object({
    questionId: objectIdSchema,
    state: z.literal('ANSWERED'),
    candidateAnswer: z.string().trim().min(1).max(5000),
  }).strict(),
  z.object({
    questionId: objectIdSchema,
    state: z.literal('SKIPPED'),
  }).strict(),
]);

const submitBodySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  answers: z.array(submitAnswerSchema)
    .min(1, 'Cần nộp snapshot ít nhất 1 câu hỏi')
    .max(5, 'Chỉ chấp nhận tối đa 5 câu hỏi')
    .refine(
      (answers) => new Set(answers.map((answer) => answer.questionId)).size === answers.length,
      'Mỗi câu hỏi chỉ được xuất hiện một lần'
    ),
}).strict();

export const interviewPracticeQuestionsSchema = z.object({
  body: z.object({
    questionIds: z.array(objectIdSchema)
      .min(1, 'Cần chọn ít nhất 1 câu hỏi')
      .max(5, 'Chỉ được chọn tối đa 5 câu hỏi')
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Không được chọn câu hỏi trùng lặp'
      ),
  }).strict(),
  query: emptyQuerySchema,
});

export const interviewCreateSchema = z.object({ body: setupBodySchema, query: emptyQuerySchema });
export const interviewJdCreateSchema = z.object({ body: jdSetupBodySchema, query: emptyQuerySchema });
export const interviewGetSchema = z.object({ params: idParamsSchema, query: resourceQuerySchema });
export const interviewActionSchema = z.object({
  body: z.object({}).strict().optional().default({}),
  params: idParamsSchema,
  query: emptyQuerySchema,
  headers: idempotencyHeadersSchema.partial(),
});
export const interviewProgressSchema = z.object({
  body: z.union([progressBodySchema, answersBodySchema]),
  params: idParamsSchema,
  query: emptyQuerySchema,
});
export const interviewSubmitSchema = z.object({
  body: z.union([submitBodySchema, answersBodySchema]),
  params: idParamsSchema,
  query: emptyQuerySchema,
  headers: idempotencyHeadersSchema.partial(),
});

export const interviewAnswersSchema = z.object({
  body: answersBodySchema,
  params: idParamsSchema,
  query: emptyQuerySchema,
});

export const followUpBodySchema = z
  .object({
    questionId: objectIdSchema,
    candidateAnswer: z
      .string()
      .trim()
      .min(1, 'Câu trả lời không được để trống')
      .max(5000, 'Câu trả lời không được vượt quá 5000 ký tự'),
  })
  .strict();

export const followUpSchema = z.object({
  body: followUpBodySchema,
  params: idParamsSchema,
  query: emptyQuerySchema,
});

export const conversationHistorySchema = z.object({
  params: idParamsSchema,
  query: z
    .object({
      questionId: objectIdSchema.optional(),
    })
    .strict(),
});

const optionalTrimmedString = z.string().trim().min(1).optional();

/**
 * History date contract:
 * - YYYY-MM-DD is interpreted as 00:00:00.000 UTC.
 * - ISO date-time values must include Z or an explicit UTC offset.
 * - `from` is inclusive and `to` is exclusive.
 */
const dateQuery = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
      }
      if (!/([zZ]|[+-]\d{2}:?\d{2})$/.test(value)) return false;
      return !Number.isNaN(Date.parse(value));
    },
    'Ngày phải là YYYY-MM-DD hoặc ISO date-time có timezone',
  )
  .transform((value) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00.000Z`);
    }
    return new Date(value);
  })
  .optional();

export const interviewHistoryQuerySchema = z
  .object({
    query: z
      .object({
        page: z.coerce.number().int('Page phải là số nguyên').min(1, 'Page phải lớn hơn hoặc bằng 1').default(1),
        limit: z.coerce.number().int('Limit phải là số nguyên').min(1, 'Limit phải lớn hơn hoặc bằng 1').max(100, 'Limit không được vượt quá 100').default(10),
        role: optionalTrimmedString,
        level: optionalTrimmedString,
        technology: optionalTrimmedString,
        status: z.enum(['PENDING', 'GENERATING', 'IN_PROGRESS', 'EVALUATING', 'COMPLETED', 'FAILED']).optional(),
        from: dateQuery,
        to: dateQuery,
        sort: z.enum(['newest', 'oldest']).default('newest'),
      })
      .strict(),
  })
  .superRefine((value, ctx) => {
    const { from, to } = value.query;
    if (from && to && from >= to) {
      ctx.addIssue({
        code: 'custom',
        path: ['query', 'to'],
        message: 'To phải lớn hơn From',
      });
    }
  });

export const interviewAnalyticsQuerySchema = z
  .object({
    query: z
      .object({
        role: optionalTrimmedString,
        level: optionalTrimmedString,
        technology: optionalTrimmedString,
        from: dateQuery,
        to: dateQuery,

        /**
         * Client-provided userId is intentionally accepted
         * but never used for ownership.
         *
         * Analytics ownership is always determined by the
         * authenticated user's id from req.user.
         */
        userId: optionalTrimmedString
      })
      .strict()
  })
  .superRefine((value, ctx) => {
    const { from, to } = value.query;

    if (from && to && from >= to) {
      ctx.addIssue({
        code: 'custom',
        path: ['query', 'to'],
        message: 'To phải lớn hơn From'
      });
    }
  });

export const codeExecutionSchema = z.object({
  params: idParamsSchema,
  body: z
    .object({
      questionId: z.string().trim().min(1, 'questionId không được để trống'),
      code: z.string().max(65536, 'Mã nguồn không được vượt quá 64KB'),
      language: z.enum([
        'javascript',
        'typescript',
        'python',
        'java',
        'csharp',
        'go',
        'cpp',
        'rust',
      ]),
      stdin: z.string().max(10000).optional(),
      withAiReview: z.boolean().optional(),
    })
    .strict(),
});

export const whiteboardSchema = z.object({
  params: idParamsSchema,
  body: z
    .object({
      questionId: z.string().trim().min(1, 'questionId không được để trống'),
      imageBase64: z.string().min(10, 'Dữ liệu ảnh không được để trống'),
      mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']).optional().default('image/png'),
      canvasData: z.record(z.string(), z.any()).optional(),
    })
    .strict(),
});