import { z } from 'zod';

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const unsafeControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const boundedText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .refine(
      (value) => !unsafeControlCharacters.test(value),
      'Nội dung chứa ký tự điều khiển không hợp lệ'
    );

const objectId = z.string().regex(objectIdPattern, 'ObjectId không hợp lệ');

export const listPublicQuestionsSchema = z.object({
  body: z.unknown().optional(),
  params: z.object({}).passthrough(),
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
      search: boundedText(200).optional(),
      roleId: objectId.optional(),
      levelId: objectId.optional(),
      technologyId: objectId.optional(),
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
      questionType: z
        .enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'SCENARIO'])
        .optional(),
      type: z
        .enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'SCENARIO'])
        .optional(),
    })
    .passthrough(),
});

export const getPublicQuestionDetailSchema = z.object({
  body: z.unknown().optional(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: objectId,
  }),
});
