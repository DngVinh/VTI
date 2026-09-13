import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicQuestionApi } from './publicQuestionApi';

describe('publicQuestionApi unit test', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetchPublicQuestions sends query params and parses result', async () => {
    const mockData = {
      success: true,
      data: {
        items: [
          {
            id: '507f1f77bcf86cd799439011',
            code: 'QB-2026-000001',
            prompt: { vi: 'Câu hỏi mẫu', en: 'Sample question' },
            difficulty: 'MEDIUM',
            questionType: 'TECHNICAL',
            primaryRoleId: '507f1f77bcf86cd799439012',
            role: { id: '507f1f77bcf86cd799439012', name: 'Backend' },
            levelIds: ['507f1f77bcf86cd799439013'],
            levels: [{ id: '507f1f77bcf86cd799439013', name: 'Middle' }],
            technologies: [{ id: '507f1f77bcf86cd799439014', name: 'Node.js', relevance: 100 }],
            topic: 'Runtime',
            tags: ['node'],
            updatedAt: '2026-09-13T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const res = await publicQuestionApi.fetchPublicQuestions({
      roleId: '507f1f77bcf86cd799439012',
      difficulty: 'MEDIUM',
      search: 'Node',
      page: 1,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/questions/public?page=1&roleId=507f1f77bcf86cd799439012&difficulty=MEDIUM&search=Node')
    );
    expect(res.items.length).toBe(1);
    expect(res.items[0].code).toBe('QB-2026-000001');
    expect(res.total).toBe(1);
  });

  it('fetchPublicQuestionById returns full detail on 200', async () => {
    const mockDetail = {
      success: true,
      data: {
        id: '507f1f77bcf86cd799439011',
        code: 'QB-2026-000001',
        versionNumber: 1,
        prompt: { vi: 'Câu hỏi', en: 'Question' },
        explanation: { vi: 'Lời giải', en: 'Explanation' },
        referenceAnswer: { vi: 'Đáp án chuẩn', en: 'Standard Answer' },
        learningObjective: { vi: 'Mục tiêu', en: 'Objective' },
        rubric: [
          {
            key: 'core',
            title: { vi: 'Tiêu chí 1', en: 'Criterion 1' },
            weight: 100,
            levels: [
              { score: 0, description: { vi: 'Kém', en: 'Poor' } },
              { score: 4, description: { vi: 'Tốt', en: 'Good' } },
            ],
          },
        ],
        difficulty: 'HARD',
        questionType: 'TECHNICAL',
        primaryRoleId: null,
        role: null,
        levelIds: [],
        levels: [],
        technologies: [],
        topic: null,
        tags: [],
        estimatedTimeSeconds: 300,
        updatedAt: '2026-09-13T00:00:00.000Z',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDetail,
    });

    const res = await publicQuestionApi.fetchPublicQuestionById('507f1f77bcf86cd799439011');
    expect(res.code).toBe('QB-2026-000001');
    expect(res.explanation.vi).toBe('Lời giải');
    expect(res.rubric.length).toBe(1);
    expect(res.rubric[0].levels[1].score).toBe(4);
  });

  it('fetchPublicQuestionById throws error when status is 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ success: false, message: 'Not Found' }),
    });

    await expect(publicQuestionApi.fetchPublicQuestionById('non-existent')).rejects.toThrow(
      'Question not found or not published'
    );
  });
});
