import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCodeExecution } from '../hooks/useCodeExecution';
import { interviewApi } from '../../../services/api/interviewApi';

vi.mock('../../../services/api/interviewApi', () => ({
  interviewApi: {
    executeCode: vi.fn(),
  },
}));

describe('useCodeExecution Hook (Micro-Task 3.7)', () => {
  const mockSessionId = 'session-123';
  const mockQuestionId = 'q-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default empty state', () => {
    const { result } = renderHook(() =>
      useCodeExecution({ sessionId: mockSessionId, questionId: mockQuestionId })
    );

    expect(result.current.isRunning).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.executionResult).toBeNull();
    expect(result.current.aiReviewResult).toBeNull();
  });

  it('runs code successfully and updates executionResult', async () => {
    const fakeResponse = {
      execution: {
        stdout: '42\n',
        stderr: '',
        exitCode: 0,
        executionTimeMs: 45,
        memoryKb: 2048,
        testResults: [
          {
            testCaseIndex: 0,
            passed: true,
            actualOutput: '42',
            expectedOutput: '42',
            executionTimeMs: 12,
            isHidden: false,
          },
        ],
      },
      review: {
        astComplexity: {
          estimatedTimeComplexity: 'O(1)',
          estimatedSpaceComplexity: 'O(1)',
          cyclomaticComplexity: 1,
          maxLoopNesting: 0,
          hasRecursion: false,
          detectedSmells: [],
        },
        feedback: { vi: 'Code tối ưu', en: 'Optimal code' },
        suggestions: [],
        cleanCodeScore: 100,
      },
    };

    (interviewApi.executeCode as any).mockResolvedValue(fakeResponse);

    const { result } = renderHook(() =>
      useCodeExecution({ sessionId: mockSessionId, questionId: mockQuestionId })
    );

    await act(async () => {
      await result.current.runCode('console.log(42);', 'javascript', { withAiReview: true });
    });

    expect(interviewApi.executeCode).toHaveBeenCalledWith(mockSessionId, {
      questionId: mockQuestionId,
      code: 'console.log(42);',
      language: 'javascript',
      withAiReview: true,
      testCases: undefined,
    });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.executionResult?.stdout).toBe('42\n');
    expect(result.current.aiReviewResult?.cleanCodeScore).toBe(100);
    expect(result.current.error).toBeNull();
  });

  it('handles execution failure gracefully and sets error message', async () => {
    (interviewApi.executeCode as any).mockRejectedValue(new Error('Sandbox Timeout'));

    const { result } = renderHook(() =>
      useCodeExecution({ sessionId: mockSessionId, questionId: mockQuestionId })
    );

    await act(async () => {
      await result.current.runCode('while(true){}', 'javascript');
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.error).toBe('Sandbox Timeout');
  });

  it('clears output and errors when clearOutput is called', async () => {
    (interviewApi.executeCode as any).mockResolvedValue({
      execution: { stdout: 'done', stderr: '', exitCode: 0, executionTimeMs: 10, memoryKb: 1024 },
    });

    const { result } = renderHook(() =>
      useCodeExecution({ sessionId: mockSessionId, questionId: mockQuestionId })
    );

    await act(async () => {
      await result.current.runCode('code', 'javascript');
    });

    expect(result.current.executionResult).not.toBeNull();

    act(() => {
      result.current.clearOutput();
    });

    expect(result.current.executionResult).toBeNull();
    expect(result.current.aiReviewResult).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
