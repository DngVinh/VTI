import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockAiProvider } from '../../../src/services/ai/providers/MockAiProvider';
import { GeminiAiProvider } from '../../../src/services/ai/providers/GeminiAiProvider';
import type { IAiProvider } from '../../../src/domain/interview/types';
import type { AppEnv } from '../../../src/config/env';

const mockGenerateContent = vi.fn();

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: mockGenerateContent,
        };
      }
    },
  };
});

describe('IAiProvider generateFollowUp contract (07-delivery-test-plan #7)', () => {
  let mockProvider: IAiProvider;
  let geminiProvider: IAiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = new MockAiProvider();
    const fakeEnv: AppEnv = {
      GEMINI_API_KEY: 'test-key',
    } as any;
    geminiProvider = new GeminiAiProvider(fakeEnv);
  });

  it('MockAiProvider conforms to IAiProvider generateFollowUp contract', async () => {
    const result = await mockProvider.generateFollowUp(
      { vi: 'Giải thích Event Loop', en: 'Explain Event Loop' },
      'Nó xử lý bất đồng bộ',
      []
    );

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('audit');
    expect(result.data).toHaveProperty('shouldFollowUp');
    expect(typeof result.data.shouldFollowUp).toBe('boolean');
    expect(result.data).toHaveProperty('gapAnalysis');
    expect(Array.isArray(result.data.gapAnalysis)).toBe(true);
    expect(result.data).toHaveProperty('difficultyAdjustment');
    expect(['EASIER', 'SAME', 'HARDER']).toContain(result.data.difficultyAdjustment);
    expect(result.data).toHaveProperty('confidenceScore');
    expect(typeof result.data.confidenceScore).toBe('number');
    expect(result.audit.totalTokenCount).toBeGreaterThan(0);
  });

  it('GeminiAiProvider conforms to IAiProvider generateFollowUp contract when model responds', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [{ finishReason: 'STOP' }],
        promptFeedback: {},
        text: () =>
          JSON.stringify({
            shouldFollowUp: true,
            followUpQuestion: {
              vi: 'Cơ chế Call Stack và Callback Queue tương tác ra sao?',
              en: 'How do the Call Stack and Callback Queue interact?',
            },
            gapAnalysis: ['Chưa giải thích Microtask Queue vs Macrotask Queue'],
            difficultyAdjustment: 'HARDER',
            confidenceScore: 0.9,
            summary: {
              vi: 'Ứng viên nắm được khái niệm cơ bản nhưng cần đào sâu hơn.',
              en: 'Candidate grasps basic concept but needs deeper exploration.',
            },
          }),
        usageMetadata: {
          promptTokenCount: 120,
          candidatesTokenCount: 65,
          totalTokenCount: 185,
        },
      },
    });

    const result = await geminiProvider.generateFollowUp(
      { vi: 'Giải thích Event Loop', en: 'Explain Event Loop' },
      'Event loop điều phối microtask và macrotask trong JS.',
      []
    );

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('audit');
    expect(result.data.shouldFollowUp).toBe(true);
    expect(result.data.followUpQuestion?.vi).toContain('Call Stack');
    expect(result.data.gapAnalysis.length).toBeGreaterThan(0);
    expect(result.audit.totalTokenCount).toBe(185);
  });
});
