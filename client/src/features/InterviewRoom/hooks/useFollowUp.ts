import { useState, useCallback, useEffect, useRef } from 'react';
import { interviewApi } from '../../../services/api/interviewApi';
import type { ConversationTurn, FollowUpResponseData, LocalizedContent } from '../types';

export interface UseFollowUpOptions {
  sessionId: string;
  questionId: string;
  initialQuestion?: LocalizedContent;
  enabled?: boolean;
}

export const useFollowUp = ({
  sessionId,
  questionId,
  enabled = true,
}: UseFollowUpOptions) => {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<FollowUpResponseData | null>(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [maxTurns, setMaxTurns] = useState(3);
  const [isCompleted, setIsCompleted] = useState(false);

  const historyLoadingRef = useRef<Promise<void> | null>(null);

  const loadHistory = useCallback(async () => {
    if (!sessionId || !questionId) return;
    const promise = (async () => {
      try {
        const history = await interviewApi.fetchConversationHistory(sessionId, questionId);
        if (Array.isArray(history)) {
          setTurns(history);
          const candidateTurns = history.filter((t) => t.role === 'CANDIDATE');
          setTurnIndex(candidateTurns.length);
          if (candidateTurns.length >= maxTurns) {
            setIsCompleted(true);
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Không thể tải lịch sử đàm thoại');
      } finally {
        historyLoadingRef.current = null;
      }
    })();
    historyLoadingRef.current = promise;
    return promise;
  }, [sessionId, questionId, maxTurns]);

  useEffect(() => {
    if (enabled && sessionId && questionId) {
      loadHistory();
    }
  }, [enabled, sessionId, questionId, loadHistory]);

  const submitFollowUp = useCallback(
    async (candidateAnswer: string): Promise<FollowUpResponseData | null> => {
      if (!sessionId || !questionId || !candidateAnswer.trim() || isLoading) {
        return null;
      }

      if (historyLoadingRef.current) {
        await historyLoadingRef.current;
      }

      setIsLoading(true);
      setError(null);

      const optimisticCandidateTurn: ConversationTurn = {
        questionId,
        sessionId,
        turnIndex,
        role: 'CANDIDATE',
        type: 'ANSWER',
        content: {
          vi: candidateAnswer,
          en: candidateAnswer,
        },
        createdAt: new Date(),
      };

      setTurns((prev) => [...prev, optimisticCandidateTurn]);

      try {
        const response = await interviewApi.requestFollowUp(sessionId, {
          questionId,
          candidateAnswer,
        });

        setLastResponse(response);
        setTurnIndex(response.turnIndex);
        setMaxTurns(response.maxTurns);

        if (response.shouldFollowUp && response.followUpQuestion) {
          const interviewerTurn: ConversationTurn = {
            questionId,
            sessionId,
            turnIndex: response.turnIndex,
            role: 'INTERVIEWER',
            type: 'FOLLOW_UP',
            content: response.followUpQuestion,
            metadata: {
              gapAnalysis: response.gapAnalysis,
              difficultyAdjustment: response.difficultyAdjustment,
            },
            createdAt: new Date(),
          };
          setTurns((prev) => [...prev, interviewerTurn]);
        } else {
          setIsCompleted(true);
        }

        return response;
      } catch (err: any) {
        const msg = err?.message || 'Không thể gửi phản biện';
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, questionId, isLoading, turnIndex]
  );

  return {
    turns,
    isLoading,
    error,
    lastResponse,
    turnIndex,
    maxTurns,
    isCompleted,
    submitFollowUp,
    loadHistory,
  };
};
