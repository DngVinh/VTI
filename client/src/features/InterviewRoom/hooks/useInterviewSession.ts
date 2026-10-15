/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { interviewApi } from '../../../services/api/interviewApi';
import type { InterviewSession, AnswerState } from '../types';
import { useInterviewSSE } from './useInterviewSSE';

const getApiErrorDetails = (error: unknown): { message?: string; code?: string } => {
  if (error instanceof Error) {
    const cause = error.cause;
    if (cause && typeof cause === 'object') {
      const details = cause as { message?: unknown; code?: unknown };
      return {
        message: error.message,
        code: typeof details.code === 'string' ? details.code : undefined,
      };
    }
    return { message: error.message };
  }

  if (error && typeof error === 'object') {
    const details = error as { message?: unknown; code?: unknown };
    return {
      message: typeof details.message === 'string' ? details.message : undefined,
      code: typeof details.code === 'string' ? details.code : undefined,
    };
  }

  return {};
};

export const useInterviewSession = (sessionId: string) => {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingInFlightRef = useRef(false);

  const { sseStatus, sseVersion } = useInterviewSSE(sessionId);

  const fetchSession = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      let data = await interviewApi.fetchInterviewSession(sessionId);
      
      // If session is still PENDING, we need to generate questions
      if (data.status === 'PENDING') {
        setIsGenerating(true);
        try {
          await interviewApi.generateQuestions(sessionId);
          // Fetch the session again to get the updated status (should be GENERATING)
          data = await interviewApi.fetchInterviewSession(sessionId);
        } catch (genErr) {
          console.error('Failed to generate questions:', genErr);
          const details = getApiErrorDetails(genErr);
          const message = details.code === 'QUOTA_EXCEEDED'
            ? 'Bạn đã hết lượt tạo phỏng vấn trong ngày. Vui lòng thử lại vào ngày mai.'
            : details.message || 'Không thể khởi tạo câu hỏi phỏng vấn bằng AI.';
          throw new Error(message, { cause: genErr });
        }
      }

      if (data.status === 'PENDING' || data.status === 'GENERATING' || data.status === 'EVALUATING') {
        setIsGenerating(true);
      } else {
        setIsGenerating(false);
      }

      if (data.status === 'COMPLETED') {
        window.location.href = `/interview/${sessionId}/result`;
        return;
      }
      if (data.status === 'FAILED') {
         throw new Error('Lỗi trong quá trình xử lý bằng AI.');
      }

      setSession(data);
      
      // Initialize answers from DB
      const initialAnswers: AnswerState[] = [];
      if (data.questions) {
        data.questions.forEach((q: any) => {
          const qId = q.id || q._id;
          if (qId && q.candidateAnswer) {
            initialAnswers.push({ questionId: qId, candidateAnswer: q.candidateAnswer });
          }
        });
      }

      // Load answers from sessionStorage for F5 protection and merge
      const savedAnswersStr = sessionStorage.getItem(`interview_${sessionId}_answers`);
      if (savedAnswersStr) {
        try {
          const parsed = JSON.parse(savedAnswersStr) as { version?: number; answers?: AnswerState[] };
          if (parsed.version === data.version && Array.isArray(parsed.answers) && parsed.answers.length > 0) {
            // Merge logic: session storage overwrites DB if it exists and has content
            parsed.answers.forEach(saved => {
              if (saved.questionId && saved.candidateAnswer) {
                const existingIdx = initialAnswers.findIndex(a => a.questionId === saved.questionId);
                if (existingIdx >= 0) {
                  initialAnswers[existingIdx].candidateAnswer = saved.candidateAnswer;
                } else {
                  initialAnswers.push(saved);
                }
              }
            });
          }
        } catch (e) {
          console.error('Failed to parse saved answers', e);
        }
      }
      
      setAnswers(initialAnswers);
    } catch (err: any) {
      console.error('Failed to load session:', err);
      setIsGenerating(false);
      setError(err.message || 'Không thể tải phiên phỏng vấn. Vui lòng kiểm tra kết nối.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    // Avoid calling setState synchronously within an effect body
    setTimeout(() => fetchSession(), 0);
  }, [fetchSession]);

  // SSE is the fast path, but a dropped connection must not leave the room
  // permanently on the loading screen after the worker has committed questions.
  useEffect(() => {
    if (isLoading || !isGenerating || error) return;

    const pollTimer = window.setInterval(() => {
      if (pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      void fetchSession(false).finally(() => {
        pollingInFlightRef.current = false;
      });
    }, 3_000);

    return () => window.clearInterval(pollTimer);
  }, [error, fetchSession, isGenerating, isLoading]);

  // Handle SSE state changes
  useEffect(() => {
    if (!sseStatus || !session) return;
    const isNewStatus = session.status !== sseStatus;
    const isNewVersion = sseVersion !== null && typeof session.version === 'number' && sseVersion > session.version;
    if (isNewStatus || isNewVersion) {
      if (sseStatus === 'IN_PROGRESS' || sseStatus === 'COMPLETED' || sseStatus === 'FAILED') {
        // Avoid calling setState synchronously within an effect body
        setTimeout(() => fetchSession(), 0);
      }
    }
  }, [sseStatus, sseVersion, session, fetchSession]);

  const currentQuestion = session?.questions?.[currentQuestionIndex];
  
  const handleAnswerChange = useCallback((text: string) => {
    if (!currentQuestion) return;
    
    const qId = currentQuestion.id || currentQuestion._id;
    if (!qId) return;

    setAnswers(prev => {
      const existing = prev.findIndex(a => a.questionId === qId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], candidateAnswer: text };
        return updated;
      } else {
        return [...prev, { questionId: qId, candidateAnswer: text }];
      }
    });
  }, [currentQuestion]);

  const currentAnswer = answers.find(a => a.questionId === (currentQuestion?.id || currentQuestion?._id))?.candidateAnswer || '';

  const totalQuestions = session?.questions?.length || 0;
  const answeredCount = answers.filter(a => a.candidateAnswer.trim().length > 0).length;

  const refetch = useCallback(() => {
    return fetchSession();
  }, [fetchSession]);

  const updateVersion = useCallback((version: number) => {
    setSession((current) => current && version > current.version ? { ...current, version } : current);
  }, []);

  return {
    session,
    isLoading,
    isGenerating,
    error,
    currentQuestion,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    currentAnswer,
    handleAnswerChange,
    totalQuestions,
    answeredCount,
    refetch,
    updateVersion
  };
};


