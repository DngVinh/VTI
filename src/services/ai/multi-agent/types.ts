import { z } from 'zod';

export type AgentRole = 'TECH_LEAD' | 'BAR_RAISER' | 'BEHAVIORAL' | 'JUDGE';

export const agentRoleSchema = z.enum(['TECH_LEAD', 'BAR_RAISER', 'BEHAVIORAL', 'JUDGE']);

export const localizedTextSchema = z.object({
  vi: z.string().min(1),
  en: z.string().min(1),
});

export const personaEvaluationSchema = z.object({
  role: agentRoleSchema,
  score: z.number().min(0).max(10),
  strengths: z.array(localizedTextSchema),
  weaknesses: z.array(localizedTextSchema),
  specificFeedback: localizedTextSchema,
  dimensionScores: z.record(z.string(), z.number()),
});

export type PersonaEvaluation = z.infer<typeof personaEvaluationSchema>;

export const varianceFlagSchema = z.object({
  dimension: z.string().min(1),
  variance: z.number().min(0),
  arbiterResolution: localizedTextSchema,
});

export type VarianceFlag = z.infer<typeof varianceFlagSchema>;

export const calibratedDimensionSchema = z.object({
  name: z.string().min(1),
  score: z.number().min(0).max(10),
  reasoning: z.union([z.string().min(1), localizedTextSchema]),
});

export type CalibratedDimension = z.infer<typeof calibratedDimensionSchema>;

export const learningPathItemSchema = z.object({
  topic: localizedTextSchema,
  priority: z.enum(['High', 'Medium', 'Low']),
  suggestion: localizedTextSchema,
});

export type LearningPathItem = z.infer<typeof learningPathItemSchema>;

export const consensusReportSchema = z.object({
  finalOverallScore: z.number().min(0).max(10),
  personaBreakdown: z.array(personaEvaluationSchema),
  varianceFlags: z.array(varianceFlagSchema),
  calibratedDimensions: z.array(calibratedDimensionSchema),
  learningPath: z.array(learningPathItemSchema),
});

export type ConsensusReport = z.infer<typeof consensusReportSchema>;

export const multiAgentEvaluationInputSchema = z.object({
  sessionId: z.string().min(1),
  role: z.string().min(1),
  level: z.string().min(1),
  technologies: z.array(z.string()),
  questions: z.array(
    z.object({
      order: z.number(),
      category: z.string(),
      difficulty: z.string(),
      content: localizedTextSchema,
    })
  ),
  answers: z.array(
    z.object({
      questionId: z.string().optional(),
      order: z.number(),
      candidateAnswer: z.string(),
    })
  ),
  conversationHistory: z
    .array(
      z.object({
        questionId: z.string(),
        turnIndex: z.number(),
        role: z.string(),
        type: z.string(),
        content: localizedTextSchema,
      })
    )
    .optional(),
});

export type MultiAgentEvaluationInput = z.infer<typeof multiAgentEvaluationInputSchema>;
