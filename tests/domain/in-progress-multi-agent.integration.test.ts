import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { InProgressState } from '../../src/domain/interview/states/InProgressState';
import type { IInterviewContext, IInterviewRepository } from '../../src/domain/interview/types';
import type { MultiAgentEvaluator } from '../../src/services/ai/multi-agent/MultiAgentEvaluator';

describe('InProgressState Multi-Agent Integration (Micro-Task 2.7)', () => {
  const mockRepo: IInterviewRepository = {
    findById: vi.fn().mockResolvedValue({
      _id: 'session-777',
      role: 'Backend Dev',
      level: 'Senior',
      technologies: ['NodeJS'],
      questions: [
        {
          id: 'q-1',
          order: 1,
          category: 'Architecture',
          difficulty: 'Hard',
          content: { vi: 'Câu hỏi', en: 'Question' },
        },
      ],
    }),
    getOwnerId: vi.fn().mockReturnValue('owner-123'),
    update: vi.fn().mockResolvedValue({}),
    updateQuestionFeedback: vi.fn().mockResolvedValue({}),
    updateQuestionAnswer: vi.fn().mockResolvedValue({}),
    updateTokenUsage: vi.fn().mockResolvedValue({}),
  };

  const createMockContext = () => {
    let currentState: any = new InProgressState();
    return {
      getInterviewId: () => 'session-777',
      getRepository: () => mockRepo,
      changeState: vi.fn(async (newState: any) => {
        currentState = newState;
      }),
      getState: () => currentState,
    } as unknown as IInterviewContext;
  };

  it('evaluates through multiAgentEvaluator when provided in SubmitPayload', async () => {
    const context = createMockContext();
    const inProgressState = new InProgressState();

    const mockConsensus = {
      finalOverallScore: 9.0,
      personaBreakdown: [],
      varianceFlags: [],
      calibratedDimensions: [
        { name: 'Architecture & Design', score: 9.0, reasoning: 'Rất tốt' },
      ],
      learningPath: [
        {
          topic: { vi: 'Microservices', en: 'Microservices' },
          priority: 'High' as const,
          suggestion: { vi: 'Thực hành', en: 'Practice' },
        },
      ],
    };

    const mockMultiAgentEvaluator = {
      evaluate: vi.fn().mockResolvedValue(mockConsensus),
      toEvaluationResult: vi.fn().mockReturnValue({
        overallScore: 9.0,
        evaluations: [
          {
            questionId: 'q-1',
            score: 9.0,
            feedback: { vi: 'Tốt', en: 'Good' },
          },
        ],
        dimensions: [
          { name: 'Architecture & Design', score: 9.0, reasoning: 'Rất tốt' },
        ],
        learningPath: [
          {
            topic: { vi: 'Microservices', en: 'Microservices' },
            priority: 'High',
            suggestion: { vi: 'Thực hành', en: 'Practice' },
          },
        ],
      }),
    } as unknown as MultiAgentEvaluator;

    await inProgressState.submit(context, {
      data: [{ questionId: 'q-1', candidateAnswer: 'Kiến trúc hướng sự kiện.' }],
      useAsyncJobs: false,
      multiAgentEvaluator: mockMultiAgentEvaluator,
    });

    expect(mockMultiAgentEvaluator.evaluate).toHaveBeenCalled();
    expect(mockMultiAgentEvaluator.toEvaluationResult).toHaveBeenCalled();
    expect(mockRepo.updateQuestionFeedback).toHaveBeenCalledWith(
      'q-1',
      { vi: 'Tốt', en: 'Good' },
      9.0,
      'session-777'
    );
    expect(mockRepo.update).toHaveBeenCalledWith(
      'session-777',
      expect.objectContaining({
        overallScore: 9.0,
      })
    );
    expect(context.changeState).toHaveBeenCalledWith(expect.objectContaining({
      getName: expect.any(Function),
    }));
  });
});
