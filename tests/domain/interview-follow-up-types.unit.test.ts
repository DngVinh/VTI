import { describe, it, expect } from 'vitest';
import { 
  LEGAL_INTERVIEW_STATUSES,
  type InterviewStatus, 
  type FollowUpPayload, 
  type FollowUpResult, 
  type IAiProvider 
} from '../../src/domain/interview/types';

describe('Domain Types with FOLLOW_UP (Micro-Task 1.1)', () => {
  it('should include FOLLOW_UP in LEGAL_INTERVIEW_STATUSES constant', () => {
    expect(LEGAL_INTERVIEW_STATUSES).toContain('FOLLOW_UP');
  });

  it('should construct valid FollowUpPayload', () => {
    const payload: FollowUpPayload = {
      questionId: 'q-123',
      candidateAnswer: 'Cơ chế Garbage Collection...',
    };
    expect(payload.questionId).toBe('q-123');
    expect(payload.candidateAnswer).toContain('Garbage Collection');
  });

  it('should construct valid FollowUpResult', () => {
    const result: FollowUpResult = {
      shouldFollowUp: true,
      followUpQuestion: {
        vi: 'Câu hỏi phản biện tiếng Việt',
        en: 'Follow-up question in English',
      },
      gapAnalysis: ['Chưa giải thích về heap'],
      difficultyAdjustment: 'SAME',
      confidenceScore: 0.9,
      summary: {
        vi: 'Tóm tắt tiếng Việt',
        en: 'Summary in English',
      },
    };
    expect(result.shouldFollowUp).toBe(true);
    expect(result.followUpQuestion?.vi).toBe('Câu hỏi phản biện tiếng Việt');
  });

  it('should allow generateFollowUp on IAiProvider', () => {
    const mockProvider: Partial<IAiProvider> = {
      generateFollowUp: async () => ({
        data: {
          shouldFollowUp: false,
          gapAnalysis: [],
          summary: { vi: 'ok', en: 'ok' },
        },
        audit: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
      }),
    };
    expect(typeof mockProvider.generateFollowUp).toBe('function');
  });
});
