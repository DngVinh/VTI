import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFollowUp } from '../hooks/useFollowUp';
import { interviewApi } from '../../../services/api/interviewApi';

vi.mock('../../../services/api/interviewApi', () => ({
  interviewApi: {
    requestFollowUp: vi.fn(),
    fetchConversationHistory: vi.fn(),
  },
}));

describe('useFollowUp Hook (Micro-Task 1.11)', () => {
  const sessionId = 'session-123';
  const questionId = 'question-456';
  const initialQuestion = { vi: 'Câu hỏi chính', en: 'Main Question' };

  beforeEach(() => {
    vi.clearAllMocks();
    (interviewApi.fetchConversationHistory as any).mockResolvedValue([]);
  });

  it('should initialize with default states and load history on mount', async () => {
    const existingTurns = [
      {
        turnIndex: 0,
        role: 'INTERVIEWER',
        type: 'INITIAL_QUESTION',
        content: initialQuestion,
      },
    ];
    (interviewApi.fetchConversationHistory as any).mockResolvedValue(existingTurns);

    const { result } = renderHook(() =>
      useFollowUp({ sessionId, questionId, initialQuestion })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isCompleted).toBe(false);

    await act(async () => {
      await result.current.loadHistory();
    });

    expect(result.current.turns).toEqual(existingTurns);
  });

  it('should successfully submit candidate answer and append follow-up turn', async () => {
    const mockFollowUpResponse = {
      shouldFollowUp: true,
      followUpQuestion: {
        vi: 'Bạn có thể giải thích chi tiết hơn không?',
        en: 'Can you explain in more detail?',
      },
      gapAnalysis: ['Cần làm rõ cơ chế event loop'],
      difficultyAdjustment: 'SAME' as const,
      turnIndex: 1,
      maxTurns: 3,
      summary: {
        vi: 'Ứng viên trả lời đạt 60%',
        en: 'Candidate answer reached 60%',
      },
    };

    (interviewApi.requestFollowUp as any).mockResolvedValue(mockFollowUpResponse);

    const { result } = renderHook(() =>
      useFollowUp({ sessionId, questionId, initialQuestion })
    );

    await act(async () => {
      await result.current.submitFollowUp('Biến lưu giá trị');
    });

    expect(interviewApi.requestFollowUp).toHaveBeenCalledWith(sessionId, {
      questionId,
      candidateAnswer: 'Biến lưu giá trị',
    });

    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[0].role).toBe('CANDIDATE');
    expect(result.current.turns[0].content.vi).toBe('Biến lưu giá trị');
    expect(result.current.turns[1].role).toBe('INTERVIEWER');
    expect(result.current.turns[1].content.vi).toBe('Bạn có thể giải thích chi tiết hơn không?');

    expect(result.current.turnIndex).toBe(1);
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.lastResponse).toEqual(mockFollowUpResponse);
  });

  it('should mark completed when shouldFollowUp is false', async () => {
    const mockTerminalResponse = {
      shouldFollowUp: false,
      gapAnalysis: [],
      difficultyAdjustment: 'SAME' as const,
      turnIndex: 3,
      maxTurns: 3,
      summary: {
        vi: 'Đã hoàn thành câu hỏi.',
        en: 'Question completed.',
      },
    };

    (interviewApi.requestFollowUp as any).mockResolvedValue(mockTerminalResponse);

    const { result } = renderHook(() =>
      useFollowUp({ sessionId, questionId, initialQuestion })
    );

    await act(async () => {
      await result.current.submitFollowUp('Giải thích chi tiết và toàn diện.');
    });

    expect(result.current.isCompleted).toBe(true);
    expect(result.current.turnIndex).toBe(3);
  });

  it('should handle API failure gracefully and set error', async () => {
    (interviewApi.requestFollowUp as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useFollowUp({ sessionId, questionId, initialQuestion })
    );

    await act(async () => {
      await result.current.submitFollowUp('Câu trả lời');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Network error');
  });
});
