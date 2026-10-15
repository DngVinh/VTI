import { describe, it, expect } from 'vitest';
import { followUpSchema, followUpBodySchema, conversationHistorySchema } from '../../src/validators/interview.validator';

describe('FollowUp Validator (Micro-Task 1.9a)', () => {
  const validObjectId = '507f1f77bcf86cd799439011';

  describe('followUpBodySchema', () => {
    it('should validate valid questionId and candidateAnswer', () => {
      const result = followUpBodySchema.safeParse({
        questionId: validObjectId,
        candidateAnswer: 'Cơ chế Event Loop hoạt động với Call Stack và Event Queue.',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid questionId format', () => {
      const result = followUpBodySchema.safeParse({
        questionId: 'invalid-id',
        candidateAnswer: 'Câu trả lời.',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty candidateAnswer', () => {
      const result = followUpBodySchema.safeParse({
        questionId: validObjectId,
        candidateAnswer: '   ',
      });
      expect(result.success).toBe(false);
    });

    it('should reject candidateAnswer exceeding 5000 chars', () => {
      const result = followUpBodySchema.safeParse({
        questionId: validObjectId,
        candidateAnswer: 'a'.repeat(5001),
      });
      expect(result.success).toBe(false);
    });

    it('should reject unknown properties', () => {
      const result = followUpBodySchema.safeParse({
        questionId: validObjectId,
        candidateAnswer: 'Câu trả lời.',
        unknownField: 'test',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('followUpSchema (full request)', () => {
    it('should validate full request with params, body, empty query', () => {
      const result = followUpSchema.safeParse({
        params: { id: validObjectId },
        body: {
          questionId: validObjectId,
          candidateAnswer: 'Câu trả lời hợp lệ.',
        },
        query: {},
      });
      expect(result.success).toBe(true);
    });
  });

  describe('conversationHistorySchema', () => {
    it('should validate session id and optional questionId query', () => {
      const result = conversationHistorySchema.safeParse({
        params: { id: validObjectId },
        query: { questionId: validObjectId },
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty query', () => {
      const result = conversationHistorySchema.safeParse({
        params: { id: validObjectId },
        query: {},
      });
      expect(result.success).toBe(true);
    });
  });
});
