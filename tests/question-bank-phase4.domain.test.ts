import { describe, expect, it } from 'vitest';
import {
  cosineSimilarity,
  validateVector,
  buildDiscoverabilityText,
  rankDuplicateMatches,
} from '../src/domain/question-bank/similarity';
import { QuestionBankDomainError } from '../src/domain/question-bank/errors';

describe('AIP-65 Phase 4 Domain - Vector Math & Discoverability', () => {
  describe('cosineSimilarity', () => {
    it('returns 1.0 for identical non-zero vectors', () => {
      const v1 = [1, 2, 3, 4];
      const v2 = [1, 2, 3, 4];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0, 5);
    });

    it('returns 0.0 for orthogonal vectors', () => {
      const v1 = [1, 0];
      const v2 = [0, 1];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0, 5);
    });

    it('returns correct similarity for known angle', () => {
      const v1 = [1, 1];
      const v2 = [0, 2];
      // cos(45 deg) = 1/sqrt(2) approx 0.7071
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.7071, 3);
    });

    it('returns 0 for zero vectors without NaN or infinite results', () => {
      const v1 = [0, 0, 0];
      const v2 = [1, 2, 3];
      expect(cosineSimilarity(v1, v2)).toBe(0);
      expect(Number.isFinite(cosineSimilarity(v1, v2))).toBe(true);
    });

    it('throws error when vector lengths mismatch', () => {
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrowError(QuestionBankDomainError);
    });
  });

  describe('validateVector', () => {
    it('accepts valid finite number array matching dimensions', () => {
      const raw = [0.1, -0.2, 0.5];
      const valid = validateVector(raw, 3);
      expect(valid).toEqual([0.1, -0.2, 0.5]);
    });

    it('rejects vectors with NaN, Infinity or non-numeric values', () => {
      expect(() => validateVector([0.1, NaN, 0.5], 3)).toThrowError(QuestionBankDomainError);
      expect(() => validateVector([0.1, Infinity, 0.5], 3)).toThrowError(QuestionBankDomainError);
      expect(() => validateVector([0.1, '0.5' as any, 0.2], 3)).toThrowError(QuestionBankDomainError);
    });

    it('rejects vectors with incorrect dimensions', () => {
      expect(() => validateVector([0.1, 0.2], 3)).toThrowError(QuestionBankDomainError);
      expect(() => validateVector([], 3)).toThrowError(QuestionBankDomainError);
    });
  });

  describe('buildDiscoverabilityText', () => {
    it('constructs deterministic discoverability text excluding reference answers and rubrics', () => {
      const text = buildDiscoverabilityText({
        prompt: {
          vi: 'Giải thích cơ chế Event Loop trong Node.js.',
          en: 'Explain Event Loop mechanism in Node.js.',
        },
        topic: 'Node.js Internals',
        tags: ['backend', 'javascript', 'runtime'],
        questionType: 'TECHNICAL',
        difficulty: 'MEDIUM',
      });

      expect(text).toContain('PROMPT_VI: Giải thích cơ chế Event Loop trong Node.js.');
      expect(text).toContain('PROMPT_EN: Explain Event Loop mechanism in Node.js.');
      expect(text).toContain('TOPIC: Node.js Internals');
      expect(text).toContain('TAGS: backend, javascript, runtime');
      expect(text).toContain('TYPE: TECHNICAL');
      expect(text).toContain('DIFFICULTY: MEDIUM');
      // Must not contain answers or rubrics
      expect(text).not.toContain('referenceAnswer');
      expect(text).not.toContain('rubric');
    });

    it('sorts tags deterministically and normalizes spaces', () => {
      const text1 = buildDiscoverabilityText({
        prompt: { vi: 'Câu hỏi' },
        tags: ['zebra', 'apple', 'mango'],
      });
      const text2 = buildDiscoverabilityText({
        prompt: { vi: 'Câu hỏi' },
        tags: ['apple', 'zebra', 'mango'],
      });
      expect(text1).toBe(text2);
      expect(text1).toContain('TAGS: apple, mango, zebra');
    });
  });

  describe('rankDuplicateMatches', () => {
    it('prioritizes EXACT matches over SEMANTIC matches regardless of score', () => {
      const rawMatches = [
        {
          questionId: 'q2',
          code: 'QB-2026-000002',
          versionNumber: 1,
          similarityScore: 0.95,
          matchType: 'SEMANTIC' as const,
        },
        {
          questionId: 'q1',
          code: 'QB-2026-000001',
          versionNumber: 1,
          similarityScore: 1.0,
          matchType: 'EXACT' as const,
        },
      ];

      const ranked = rankDuplicateMatches(rawMatches, 10);
      expect(ranked[0].matchType).toBe('EXACT');
      expect(ranked[0].questionId).toBe('q1');
      expect(ranked[1].matchType).toBe('SEMANTIC');
    });

    it('sorts descending by score and uses code as stable tie-breaker', () => {
      const rawMatches = [
        {
          questionId: 'q2',
          code: 'QB-2026-000002',
          versionNumber: 1,
          similarityScore: 0.85,
          matchType: 'SEMANTIC' as const,
        },
        {
          questionId: 'q1',
          code: 'QB-2026-000001',
          versionNumber: 1,
          similarityScore: 0.85,
          matchType: 'SEMANTIC' as const,
        },
      ];

      const ranked = rankDuplicateMatches(rawMatches, 10);
      expect(ranked[0].code).toBe('QB-2026-000001');
      expect(ranked[1].code).toBe('QB-2026-000002');
    });

    it('respects topK limit', () => {
      const items = Array.from({ length: 15 }, (_, i) => ({
        questionId: `q${i}`,
        code: `QB-2026-0000${i.toString().padStart(2, '0')}`,
        versionNumber: 1,
        similarityScore: 0.8 + i * 0.01,
        matchType: 'SEMANTIC' as const,
      }));

      const ranked = rankDuplicateMatches(items, 5);
      expect(ranked).toHaveLength(5);
      expect(ranked[0].similarityScore).toBeCloseTo(0.94, 2);
    });
  });
});
