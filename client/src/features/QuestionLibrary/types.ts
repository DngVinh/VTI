import { z } from 'zod';

export const LocalizedTextSchema = z.object({
  vi: z.string().nullable().optional(),
  en: z.string().nullable().optional(),
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

export const PublicTaxonomyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional(),
});
export type PublicTaxonomyItem = z.infer<typeof PublicTaxonomyItemSchema>;

export const PublicTechnologyItemSchema = PublicTaxonomyItemSchema.extend({
  relevance: z.number().nullable().optional(),
});
export type PublicTechnologyItem = z.infer<typeof PublicTechnologyItemSchema>;

export const RubricLevelSchema = z.object({
  score: z.number().min(0).max(4),
  description: LocalizedTextSchema,
});
export type RubricLevel = z.infer<typeof RubricLevelSchema>;

export const RubricCriterionSchema = z.object({
  key: z.string(),
  title: LocalizedTextSchema,
  description: LocalizedTextSchema.optional(),
  weight: z.number(),
  levels: z.array(RubricLevelSchema),
});
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const PublicQuestionSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  prompt: LocalizedTextSchema,
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).nullable().optional(),
  questionType: z.string().nullable().optional(),
  primaryRoleId: z.string().nullable().optional(),
  role: PublicTaxonomyItemSchema.nullable().optional(),
  levelIds: z.array(z.string()).default([]),
  levels: z.array(PublicTaxonomyItemSchema).default([]),
  technologies: z.array(PublicTechnologyItemSchema).default([]),
  topic: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  updatedAt: z.string(),
});
export type PublicQuestionSummary = z.infer<typeof PublicQuestionSummarySchema>;

export const PublicQuestionDetailSchema = PublicQuestionSummarySchema.extend({
  versionNumber: z.number().default(1),
  explanation: LocalizedTextSchema.default({ vi: null, en: null }),
  referenceAnswer: LocalizedTextSchema.default({ vi: null, en: null }),
  learningObjective: LocalizedTextSchema.optional(),
  rubric: z.array(RubricCriterionSchema).default([]),
  estimatedTimeSeconds: z.number().nullable().optional(),
});
export type PublicQuestionDetail = z.infer<typeof PublicQuestionDetailSchema>;

export interface PublicQuestionFilters {
  roleId?: string;
  levelId?: string;
  technologyId?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD' | '';
  questionType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedPublicQuestions {
  items: PublicQuestionSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
