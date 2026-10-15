import { z } from 'zod';
import type { QuestionVersionInput } from '../types';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const boundedText = (max: number) => z.string()
  .max(max, `Tối đa ${max.toLocaleString('vi-VN')} ký tự`)
  .refine(
    (value) => !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return (code >= 0 && code <= 8) || code === 11 || code === 12 ||
        (code >= 14 && code <= 31) || code === 127;
    }),
    'Không được chứa ký tự điều khiển'
  );

const localized = (max: number) => z.strictObject({
  vi: boundedText(max),
  en: boundedText(max),
});

const unique = (values: string[]) => new Set(values).size === values.length;

const rubricLevelSchema = z.strictObject({
  score: z.number().int().min(0).max(4),
  description: localized(1_000),
});

const rubricSchema = z.strictObject({
  key: z.string().regex(KEBAB_CASE, 'Key phải ở dạng kebab-case'),
  title: localized(500),
  description: localized(1_000).optional(),
  weight: z.number().int().min(1).max(100),
  levels: z.array(rubricLevelSchema).max(5)
    .refine((levels) => unique(levels.map(({ score }) => String(score))), 'Điểm level phải duy nhất'),
});

export const questionDraftSchema: z.ZodType<QuestionVersionInput> = z.strictObject({
  content: z.strictObject({
    prompt: localized(5_000),
    explanation: localized(5_000).optional(),
  }),
  classification: z.strictObject({
    primaryRoleId: z.string().regex(OBJECT_ID, 'Role ID không hợp lệ').nullable(),
    additionalRoleIds: z.array(z.string().regex(OBJECT_ID, 'Role ID không hợp lệ')).max(10)
      .refine(unique, 'Role bổ sung không được trùng'),
    levelIds: z.array(z.string().regex(OBJECT_ID, 'Level ID không hợp lệ')).max(10)
      .refine(unique, 'Level không được trùng'),
    technologies: z.array(z.strictObject({
      technologyId: z.string().regex(OBJECT_ID, 'Technology ID không hợp lệ'),
      relevance: z.number().min(0).max(100).nullable(),
    })).max(20).refine(
      (technologies) => unique(technologies.map(({ technologyId }) => technologyId)),
      'Technology không được trùng'
    ),
    technologyAgnostic: z.boolean(),
    classificationComplete: z.boolean(),
    topic: boundedText(200).nullable(),
    tags: z.array(z.string().regex(KEBAB_CASE, 'Tag phải ở dạng kebab-case')).max(20)
      .refine(unique, 'Tag không được trùng'),
    difficulty: z.string().nullable(),
    type: z.string().nullable(),
  }),
  answer: z.strictObject({
    referenceAnswer: localized(20_000),
    learningObjective: localized(1_000),
    estimatedTimeSeconds: z.number().int().min(30).max(3_600).nullable(),
    followUps: z.array(localized(1_000)).max(5),
  }),
  rubric: z.array(rubricSchema).max(10),
  changeSummary: boundedText(1_000),
}).superRefine((value, context) => {
  if (value.classification.primaryRoleId &&
      value.classification.additionalRoleIds.includes(value.classification.primaryRoleId)) {
    context.addIssue({
      code: 'custom',
      path: ['classification', 'additionalRoleIds'],
      message: 'Role bổ sung không được chứa primary role',
    });
  }
  if (value.classification.classificationComplete &&
      !value.classification.technologyAgnostic &&
      value.classification.technologies.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['classification', 'technologies'],
      message: 'Classification hoàn tất phải có technology hoặc technology-agnostic',
    });
  }
  if (value.rubric.length === 1) {
    context.addIssue({
      code: 'custom',
      path: ['rubric'],
      message: 'Rubric phải có từ 2 đến 10 tiêu chí',
    });
  }
  if (!unique(value.rubric.map(({ key }) => key))) {
    context.addIssue({ code: 'custom', path: ['rubric'], message: 'Rubric key phải duy nhất' });
  }
  if (value.rubric.length > 0 && value.rubric.reduce((sum, item) => sum + item.weight, 0) !== 100) {
    context.addIssue({ code: 'custom', path: ['rubric'], message: 'Tổng trọng số rubric phải bằng 100' });
  }
});

export const hasAuthoringContent = (value: QuestionVersionInput): boolean => Boolean(
  value.content.prompt.vi.trim() ||
  value.content.prompt.en.trim() ||
  value.content.explanation?.vi.trim() ||
  value.content.explanation?.en.trim() ||
  value.classification.primaryRoleId ||
  value.classification.levelIds.length ||
  value.classification.technologies.length ||
  value.classification.topic?.trim() ||
  value.classification.tags.length ||
  value.classification.difficulty ||
  value.classification.type ||
  value.answer.referenceAnswer.vi.trim() ||
  value.answer.referenceAnswer.en.trim() ||
  value.answer.learningObjective.vi.trim() ||
  value.answer.learningObjective.en.trim() ||
  value.rubric.length ||
  value.changeSummary.trim()
);

export interface DraftValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export const validateQuestionDraft = (
  value: QuestionVersionInput,
  requireContent = false
): DraftValidationResult => {
  const result = questionDraftSchema.safeParse(value);
  const errors: Record<string, string> = {};
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const field = issue.path.join('.') || 'form';
      errors[field] ??= issue.message;
    });
  }
  if (requireContent && !hasAuthoringContent(value)) {
    errors.form = 'Hãy nhập ít nhất một trường nội dung hợp lệ';
  }
  return { valid: Object.keys(errors).length === 0, errors };
};

export const validateQuestionForLibrary = (
  value: QuestionVersionInput
): DraftValidationResult => {
  const result = validateQuestionDraft(value, true);
  const errors = { ...result.errors };
  const promptVi = value.content.prompt.vi.trim();
  const promptEn = value.content.prompt.en.trim();

  if (!promptVi && !promptEn) errors['content.prompt'] ??= 'Cần nhập câu hỏi';
  if (!value.classification.type) errors['classification.type'] ??= 'Cần chọn loại câu hỏi';
  if (!value.classification.difficulty) errors['classification.difficulty'] ??= 'Cần chọn độ khó';
  if (promptVi && !value.answer.referenceAnswer.vi.trim()) {
    errors['answer.referenceAnswer.vi'] ??= 'Cần nhập đáp án tham khảo VI';
  }
  if (promptEn && !value.answer.referenceAnswer.en.trim()) {
    errors['answer.referenceAnswer.en'] ??= 'Cần nhập đáp án tham khảo EN';
  }
  const explanation = value.content.explanation ?? { vi: '', en: '' };
  if (promptVi && !explanation.vi.trim()) {
    errors['content.explanation.vi'] ??= 'Cần nhập giải thích VI';
  }
  if (promptEn && !explanation.en.trim()) {
    errors['content.explanation.en'] ??= 'Cần nhập giải thích EN';
  }
  if (promptVi && !value.answer.learningObjective.vi.trim()) {
    errors['answer.learningObjective.vi'] ??= 'Cần nhập mục tiêu đánh giá VI';
  }
  if (promptEn && !value.answer.learningObjective.en.trim()) {
    errors['answer.learningObjective.en'] ??= 'Cần nhập mục tiêu đánh giá EN';
  }
  if (value.rubric.length < 2) {
    errors.rubric ??= 'Cần có ít nhất 2 tiêu chí rubric chuẩn';
  }
  value.rubric.forEach((criterion, criterionIndex) => {
    if (!criterion.title.vi.trim() && !criterion.title.en.trim()) {
      errors[`rubric.${criterionIndex}.title`] ??= 'Cần nhập tiêu đề rubric';
    }
    const scores = new Set(criterion.levels.map((level) => level.score));
    if (criterion.levels.length !== 5 || [0, 1, 2, 3, 4].some((score) => !scores.has(score))) {
      errors[`rubric.${criterionIndex}.levels`] ??= 'Rubric cần đủ 5 mức điểm từ 0 đến 4';
    }
    criterion.levels.forEach((level, levelIndex) => {
      if (!level.description.vi.trim() && !level.description.en.trim()) {
        errors[`rubric.${criterionIndex}.levels.${levelIndex}`] ??= 'Cần nhập mô tả mức điểm';
      }
    });
  });

  return { valid: Object.keys(errors).length === 0, errors };
};

