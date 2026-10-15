import { describe, it, expect } from 'vitest';
import {
  FOLLOW_UP_SYSTEM,
  followUpResponseSchema,
  buildFollowUpPrompt,
  validateFollowUpResponse,
} from '../../../src/services/ai/follow-up-engine';

describe('Follow-up Engine (Micro-Task 1.6)', () => {
  it('should have FOLLOW_UP_SYSTEM prompt with Vietnamese rules', () => {
    expect(FOLLOW_UP_SYSTEM).toContain('UNTRUSTED_USER_CONTENT');
    expect(FOLLOW_UP_SYSTEM).toContain('tiếng Việt');
  });

  it('should validate legal follow-up response', () => {
    const validData = {
      shouldFollowUp: true,
      followUpQuestion: {
        vi: 'Bạn xử lý race condition thế nào?',
        en: 'How do you handle race conditions?',
      },
      gapAnalysis: ['Chưa nhắc tới Mutex Lock'],
      difficultyAdjustment: 'SAME',
      confidenceScore: 0.85,
      summary: {
        vi: 'Trả lời đúng nhưng thiếu bảo vệ đồng thời.',
        en: 'Correct answer but lacks concurrency protection.',
      },
    };

    const parsed = validateFollowUpResponse(validData);
    expect(parsed.shouldFollowUp).toBe(true);
    expect(parsed.followUpQuestion?.vi).toContain('race condition');
  });

  it('should validate response when shouldFollowUp is false', () => {
    const validNoFollowUp = {
      shouldFollowUp: false,
      gapAnalysis: [],
      difficultyAdjustment: 'SAME',
      confidenceScore: 0.95,
      summary: {
        vi: 'Câu trả lời rất đầy đủ và chính xác.',
        en: 'Answer is complete and accurate.',
      },
    };

    const parsed = validateFollowUpResponse(validNoFollowUp);
    expect(parsed.shouldFollowUp).toBe(false);
    expect(parsed.followUpQuestion).toBeUndefined();
  });

  it('should reject response with missing summary or invalid confidenceScore', () => {
    const invalid = {
      shouldFollowUp: true,
      gapAnalysis: [],
      confidenceScore: 1.5, // out of range
    };
    expect(() => validateFollowUpResponse(invalid)).toThrow();
  });

  it('should build formatted prompt with boundary delimiter and PII redaction', () => {
    const prompt = buildFollowUpPrompt(
      { vi: 'Câu hỏi gốc', en: 'Original question' },
      'Email của em là test@gmail.com và em dùng Redis.',
      [{ role: 'INTERVIEWER', content: 'Chào bạn' }]
    );

    expect(prompt.systemInstruction).toBe(FOLLOW_UP_SYSTEM);
    expect(prompt.userContent).toContain('<UNTRUSTED_USER_CONTENT');
    expect(prompt.userContent).not.toContain('test@gmail.com');
    expect(prompt.userContent).toContain('[REDACTED]');
  });
});
