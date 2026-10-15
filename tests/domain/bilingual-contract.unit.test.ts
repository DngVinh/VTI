import { describe, it, expect } from 'vitest';
import type { EvaluationDimension, LocalizedContent } from '../../src/domain/interview/types';
import { createEvaluationSchema } from '../../src/services/ai/prompt-security';
import { calibratedDimensionSchema } from '../../src/services/ai/multi-agent/types';
import { followUpResponseSchema } from '../../src/services/ai/follow-up-engine';

describe('Bilingual Contract Suite (Phase 3)', () => {
  describe('TASK 3.1: EvaluationDimension type contract', () => {
    it('accepts string reasoning for legacy compatibility', () => {
      const legacyDim: EvaluationDimension = {
        name: 'Technical Depth',
        score: 8,
        reasoning: 'Good technical understanding',
      };
      expect(typeof legacyDim.reasoning).toBe('string');
    });

    it('accepts localized reasoning object { vi, en }', () => {
      const bilingualDim: EvaluationDimension = {
        name: 'Technical Depth',
        score: 9,
        reasoning: {
          vi: 'Hiểu sâu về cấu trúc dữ liệu và tối ưu truy vấn.',
          en: 'Deep understanding of data structures and query optimization.',
        },
      };
      expect(typeof bilingualDim.reasoning).toBe('object');
      expect((bilingualDim.reasoning as LocalizedContent).vi).toContain('Hiểu sâu');
      expect((bilingualDim.reasoning as LocalizedContent).en).toContain('Deep understanding');
    });
  });

  describe('TASK 3.2: AI evaluation schema handles bilingual reasoning', () => {
    const schema = createEvaluationSchema(1);
    const validQuestionId = '507f1f77bcf86cd799439011';

    it('parses legacy string reasoning in dimensions', () => {
      const payload = {
        evaluations: [
          {
            questionId: validQuestionId,
            feedback: { en: 'Good', vi: 'Tốt' },
            score: 8,
          },
        ],
        overallScore: 8,
        dimensions: [
          { name: 'Technical Depth', score: 8, reasoning: 'Strong knowledge' },
          { name: 'Problem Solving', score: 8, reasoning: 'Strong logic' },
          { name: 'Communication', score: 8, reasoning: 'Clear' },
          { name: 'Practical Experience', score: 8, reasoning: 'Good' },
        ],
        learningPath: [],
      };

      const result = schema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('parses bilingual { en, vi } reasoning in dimensions', () => {
      const payload = {
        evaluations: [
          {
            questionId: validQuestionId,
            feedback: { en: 'Good', vi: 'Tốt' },
            score: 8,
          },
        ],
        overallScore: 8,
        dimensions: [
          {
            name: 'Technical Depth',
            score: 8,
            reasoning: { en: 'Strong knowledge', vi: 'Kiến thức vững vàng' },
          },
          {
            name: 'Problem Solving',
            score: 8,
            reasoning: { en: 'Strong logic', vi: 'Tư duy logic tốt' },
          },
          {
            name: 'Communication',
            score: 8,
            reasoning: { en: 'Clear', vi: 'Rõ ràng mạch lạc' },
          },
          {
            name: 'Practical Experience',
            score: 8,
            reasoning: { en: 'Good hands-on', vi: 'Thực hành tốt' },
          },
        ],
        learningPath: [],
      };

      const result = schema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('TASK 3.4: Multi-Agent calibratedDimensions reasoning', () => {
    it('accepts string reasoning', () => {
      const dim = {
        name: 'Technical Accuracy & Architecture',
        score: 8.5,
        reasoning: 'Kiến trúc hệ thống chuẩn mực.',
      };
      const result = calibratedDimensionSchema.safeParse(dim);
      expect(result.success).toBe(true);
    });

    it('accepts bilingual { vi, en } reasoning', () => {
      const dim = {
        name: 'Technical Accuracy & Architecture',
        score: 8.5,
        reasoning: {
          vi: 'Kiến trúc hệ thống chuẩn mực.',
          en: 'Standard system architecture.',
        },
      };
      const result = calibratedDimensionSchema.safeParse(dim);
      expect(result.success).toBe(true);
    });
  });

  describe('TASK 3.5: Follow-up engine gapAnalysis supports bilingual format', () => {
    it('parses legacy string array for gapAnalysis', () => {
      const response = {
        shouldFollowUp: true,
        followUpQuestion: { vi: 'Câu hỏi?', en: 'Question?' },
        gapAnalysis: ['Thiếu cơ chế caching'],
        difficultyAdjustment: 'SAME',
        confidenceScore: 0.85,
        summary: { vi: 'Tóm tắt', en: 'Summary' },
      };
      const result = followUpResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('parses bilingual objects in gapAnalysis', () => {
      const response = {
        shouldFollowUp: true,
        followUpQuestion: { vi: 'Câu hỏi?', en: 'Question?' },
        gapAnalysis: [
          { vi: 'Thiếu cơ chế caching', en: 'Missing caching mechanism' },
        ],
        difficultyAdjustment: 'SAME',
        confidenceScore: 0.85,
        summary: { vi: 'Tóm tắt', en: 'Summary' },
      };
      const result = followUpResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});
