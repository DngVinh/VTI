import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiAiProvider } from '../../../src/services/ai/providers/GeminiAiProvider';
import { AppEnv } from '../../../src/config/env';

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

describe('GeminiAiProvider.generateFollowUp (Micro-Task 1.7b)', () => {
  const fakeEnv: AppEnv = {
    GEMINI_API_KEY: 'test-key',
  } as any;

  let provider: GeminiAiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GeminiAiProvider(fakeEnv);
  });

  it('should successfully parse valid follow-up output from Gemini', async () => {
    const aiOutput = {
      shouldFollowUp: true,
      followUpQuestion: {
        vi: 'Bạn có thể tối ưu hoá độ phức tạp thời gian từ O(N^2) xuống O(N) được không?',
        en: 'Can you optimize the time complexity from O(N^2) to O(N)?',
      },
      gapAnalysis: ['Chưa tối ưu thuật toán tìm kiếm', 'Cần giải thích cấu trúc dữ liệu bổ trợ'],
      difficultyAdjustment: 'HARDER',
      confidenceScore: 0.9,
      summary: {
        vi: 'Ứng viên trả lời đúng giải pháp ngây thơ, cần kiểm tra tư duy tối ưu.',
        en: 'Candidate answered brute force correctly, needs optimization check.',
      },
    };

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [{ finishReason: 'STOP' }],
        promptFeedback: {},
        text: () => JSON.stringify(aiOutput),
        usageMetadata: {
          promptTokenCount: 150,
          candidatesTokenCount: 80,
          totalTokenCount: 230,
        },
      },
    });

    const result = await (provider as any).generateFollowUp(
      { vi: 'Giải thuật tìm hai số có tổng bằng S', en: 'Two Sum Problem' },
      'Dùng 2 vòng lặp lồng nhau duyệt qua mảng.',
      []
    );

    expect(result.data.shouldFollowUp).toBe(true);
    expect(result.data.followUpQuestion?.vi).toContain('độ phức tạp');
    expect(result.data.gapAnalysis).toHaveLength(2);
    expect(result.data.difficultyAdjustment).toBe('HARDER');
    expect(result.audit.totalTokenCount).toBe(230);
  });

  it('should throw error when Gemini output violates followUp schema', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [{ finishReason: 'STOP' }],
        promptFeedback: {},
        text: () => JSON.stringify({ shouldFollowUp: true }), // Missing required fields
        usageMetadata: {
          promptTokenCount: 50,
          candidatesTokenCount: 20,
          totalTokenCount: 70,
        },
      },
    });

    await expect(
      (provider as any).generateFollowUp(
        { vi: 'Câu hỏi', en: 'Question' },
        'Câu trả lời',
        []
      )
    ).rejects.toThrow();
  });
});
