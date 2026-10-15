import { describe, it, expect } from 'vitest';
import type { IConversationTurnRepository } from '../../src/repositories/IConversationTurnRepository';

describe('IConversationTurnRepository Interface Contract (Micro-Task 1.5a)', () => {
  it('should define interface methods correctly with tenant scoping', () => {
    const mockRepo: IConversationTurnRepository = {
      forOwner: (userId: string) => mockRepo,
      createTurn: async (data: any) => data,
      findByQuestion: async (_s: string, _q: string) => [],
      findBySession: async (_s: string) => [],
      countTurns: async (_s: string, _q: string) => 0,
      getLatestTurn: async (_s: string, _q: string) => null,
    };

    expect(typeof mockRepo.forOwner).toBe('function');
    expect(typeof mockRepo.createTurn).toBe('function');
    expect(typeof mockRepo.findByQuestion).toBe('function');
    expect(typeof mockRepo.findBySession).toBe('function');
    expect(typeof mockRepo.countTurns).toBe('function');
    expect(typeof mockRepo.getLatestTurn).toBe('function');
  });
});
