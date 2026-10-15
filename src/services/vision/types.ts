import { z } from 'zod';

export type ArchitectureNodeType =
  | 'CLIENT'
  | 'CDN'
  | 'LOAD_BALANCER'
  | 'GATEWAY'
  | 'SERVICE'
  | 'CACHE'
  | 'QUEUE'
  | 'DATABASE'
  | 'STORAGE';

export const architectureNodeTypeSchema = z.enum([
  'CLIENT',
  'CDN',
  'LOAD_BALANCER',
  'GATEWAY',
  'SERVICE',
  'CACHE',
  'QUEUE',
  'DATABASE',
  'STORAGE',
]);

export interface CanvasBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const canvasBoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export interface ArchitectureIssue {
  type: 'SPOF' | 'BOTTLENECK' | 'CONSISTENCY' | 'SECURITY' | 'MISSING_TIER';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: { vi: string; en: string };
  description: { vi: string; en: string };
  targetBox?: CanvasBoundingBox;
  suggestedFix: { vi: string; en: string };
}

export const architectureIssueSchema = z.object({
  type: z.enum(['SPOF', 'BOTTLENECK', 'CONSISTENCY', 'SECURITY', 'MISSING_TIER']),
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  title: z.object({
    vi: z.string().min(1),
    en: z.string().min(1),
  }),
  description: z.object({
    vi: z.string().min(1),
    en: z.string().min(1),
  }),
  targetBox: canvasBoundingBoxSchema.optional(),
  suggestedFix: z.object({
    vi: z.string().min(1),
    en: z.string().min(1),
  }),
});

export interface VisionAnalysisResult {
  detectedNodes: Array<{ type: ArchitectureNodeType; label: string }>;
  issues: ArchitectureIssue[];
  tradeOffEvaluation: { vi: string; en: string };
  score: number; // 0 - 10
}

export const visionAnalysisResultSchema = z.object({
  detectedNodes: z.array(
    z.object({
      type: architectureNodeTypeSchema,
      label: z.string(),
    })
  ),
  issues: z.array(architectureIssueSchema),
  tradeOffEvaluation: z.object({
    vi: z.string().min(1),
    en: z.string().min(1),
  }),
  score: z.number().min(0).max(10),
});
