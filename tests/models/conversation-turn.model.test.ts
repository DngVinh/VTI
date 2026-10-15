import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { ConversationTurnModel } from '../../src/models/ConversationTurn';

describe('ConversationTurn Model (Micro-Task 1.4)', () => {
  const sessionId = new mongoose.Types.ObjectId();
  const questionId = new mongoose.Types.ObjectId();

  it('should validate a complete and legal ConversationTurn', () => {
    const turn = new ConversationTurnModel({
      sessionId,
      questionId,
      turnIndex: 0,
      role: 'INTERVIEWER',
      type: 'INITIAL_QUESTION',
      content: {
        vi: 'Trình bày cơ chế Event Loop trong Node.js?',
        en: 'Explain the Event Loop mechanism in Node.js?',
      },
      metadata: {
        gapAnalysis: ['Chưa nói rõ về microtask queue'],
        difficultyAdjustment: 'SAME',
        confidenceScore: 0.95,
      },
    });

    const error = turn.validateSync();
    expect(error).toBeUndefined();
  });

  it('should require sessionId, questionId, turnIndex, role, type, and content', () => {
    const invalidTurn = new ConversationTurnModel({});
    const error = invalidTurn.validateSync();

    expect(error?.errors.sessionId).toBeDefined();
    expect(error?.errors.questionId).toBeDefined();
    expect(error?.errors.turnIndex).toBeDefined();
    expect(error?.errors.role).toBeDefined();
    expect(error?.errors.type).toBeDefined();
    expect(error?.errors['content.vi']).toBeDefined();
  });

  it('should reject invalid role and type enums', () => {
    const invalidTurn = new ConversationTurnModel({
      sessionId,
      questionId,
      turnIndex: 1,
      role: 'INVALID_ROLE' as any,
      type: 'INVALID_TYPE' as any,
      content: { vi: 'test', en: 'test' },
    });
    const error = invalidTurn.validateSync();

    expect(error?.errors.role).toBeDefined();
    expect(error?.errors.type).toBeDefined();
  });
});
