import { useState, useCallback } from 'react';
import { interviewApi } from '../../../services/api/interviewApi';

export interface UseCodeExecutionOptions {
  sessionId: string;
  questionId: string;
}

export interface ExecutionResultData {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  memoryKb: number;
  testResults?: Array<{
    testCaseIndex: number;
    passed: boolean;
    actualOutput: string;
    expectedOutput: string;
    executionTimeMs: number;
    isHidden: boolean;
  }>;
}

export interface AiReviewData {
  astComplexity: {
    estimatedTimeComplexity: string;
    estimatedSpaceComplexity: string;
    cyclomaticComplexity: number;
    maxLoopNesting: number;
    hasRecursion: boolean;
    detectedSmells: string[];
  };
  feedback: { vi: string; en: string };
  suggestions: Array<{ vi: string; en: string }>;
  cleanCodeScore: number;
}

export const useCodeExecution = ({ sessionId, questionId }: UseCodeExecutionOptions) => {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResultData | null>(null);
  const [aiReviewResult, setAiReviewResult] = useState<AiReviewData | null>(null);

  const runCode = useCallback(
    async (
      code: string,
      language: string,
      options?: { withAiReview?: boolean; testCases?: any[] }
    ) => {
      setIsRunning(true);
      setError(null);

      try {
        const response = await interviewApi.executeCode(sessionId, {
          questionId,
          code,
          language,
          withAiReview: options?.withAiReview,
          testCases: options?.testCases,
        });

        if (response?.execution) {
          setExecutionResult(response.execution);
        }
        if (response?.review) {
          setAiReviewResult(response.review);
        }
        return response;
      } catch (err: any) {
        const errMsg = err?.message || 'Có lỗi xảy ra khi thực thi mã nguồn';
        setError(errMsg);
        return null;
      } finally {
        setIsRunning(false);
      }
    },
    [sessionId, questionId]
  );

  const clearOutput = useCallback(() => {
    setExecutionResult(null);
    setAiReviewResult(null);
    setError(null);
  }, []);

  return {
    isRunning,
    error,
    executionResult,
    aiReviewResult,
    runCode,
    clearOutput,
  };
};
