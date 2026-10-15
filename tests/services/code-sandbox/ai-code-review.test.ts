import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { AiCodeReviewer } from '../../../src/services/code-sandbox/AiCodeReviewer';
import { ComplexityAnalyzer } from '../../../src/services/code-sandbox/ComplexityAnalyzer';
import type { IAiProvider } from '../../../src/domain/interview/types';

describe('AiCodeReviewer (Micro-Task 3.5)', () => {
  const complexityAnalyzer = new ComplexityAnalyzer();

  it('performs AST analysis and calls AI provider for deep Vietnamese review', async () => {
    const mockAiProvider: IAiProvider = {
      generateQuestions: vi.fn(),
      evaluateAnswers: vi.fn(),
      evaluatePersona: vi.fn().mockResolvedValue({
        data: {
          feedback: {
            vi: 'Mã nguồn giải quyết đúng bài toán nhưng độ phức tạp thời gian O(N^2) chưa tối ưu.',
            en: 'The solution solves the problem but time complexity O(N^2) is suboptimal.',
          },
          suggestions: [
            {
              vi: 'Nên sử dụng HashMap để giảm độ phức tạp xuống O(N).',
              en: 'Consider using a HashMap to reduce complexity to O(N).',
            },
          ],
          cleanCodeScore: 75,
        },
        audit: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
      }),
    } as any;

    const reviewer = new AiCodeReviewer(complexityAnalyzer, mockAiProvider);

    const input = {
      code: `
        function twoSum(nums: number[], target: number) {
          for (let i = 0; i < nums.length; i++) {
            for (let j = i + 1; j < nums.length; j++) {
              if (nums[i] + nums[j] === target) return [i, j];
            }
          }
          return [];
        }
      `,
      language: 'typescript',
      questionContext: 'Two Sum Problem',
    };

    const result = await reviewer.review(input);

    expect(result.astComplexity.estimatedTimeComplexity).toBe('O(N^2)');
    expect(result.astComplexity.maxLoopNesting).toBe(2);
    expect(result.feedback.vi).toContain('O(N^2)');
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.cleanCodeScore).toBe(75);
    expect(mockAiProvider.evaluatePersona).toHaveBeenCalledOnce();
  });

  it('falls back safely to rule-based Vietnamese review when AI provider fails', async () => {
    const mockAiProvider: IAiProvider = {
      generateQuestions: vi.fn(),
      evaluateAnswers: vi.fn(),
      evaluatePersona: vi.fn().mockRejectedValue(new Error('AI Quota Exceeded')),
    } as any;

    const reviewer = new AiCodeReviewer(complexityAnalyzer, mockAiProvider);

    const input = {
      code: `
        function parseJson(str: string) {
          try {
            return JSON.parse(str);
          } catch (e) {}
        }
      `,
      language: 'typescript',
    };

    const result = await reviewer.review(input);

    expect(result.astComplexity.detectedSmells).toContain('EMPTY_CATCH_BLOCK');
    expect(result.feedback.vi).toBeTruthy();
    expect(result.cleanCodeScore).toBeLessThanOrEqual(100);
    expect(result.cleanCodeScore).toBeGreaterThanOrEqual(0);
  });
});
