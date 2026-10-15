import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { container } from '../../src/config/di';
import { ConversationTurnRepository } from '../../src/repositories/ConversationTurnRepository';

describe('DI Registration for ConversationTurnRepository (Micro-Task 1.5c)', () => {
  it('should resolve IConversationTurnRepository as an instance of ConversationTurnRepository', () => {
    const repo = container.resolve('IConversationTurnRepository');
    expect(repo).toBeInstanceOf(ConversationTurnRepository);
  });
});
