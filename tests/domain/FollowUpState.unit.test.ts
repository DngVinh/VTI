import { describe, it, expect, vi } from 'vitest';
import { FollowUpState } from '../../src/domain/interview/states/FollowUpState';
import { InvalidStateTransitionException } from '../../src/domain/interview/exceptions/InvalidStateTransitionException';
import type { IInterviewContext } from '../../src/domain/interview/types';

describe('FollowUpState (Micro-Task 1.2a)', () => {
  const mockContext = {
    getInterviewId: vi.fn().mockReturnValue('test-session-id'),
    getState: vi.fn(),
    getRepository: vi.fn(),
    getVersion: vi.fn().mockReturnValue(1),
    changeState: vi.fn().mockResolvedValue(undefined),
  } as unknown as IInterviewContext;

  it('should return FOLLOW_UP as name', () => {
    const state = new FollowUpState();
    expect(state.getName()).toBe('FOLLOW_UP');
  });

  it('should reject generate with InvalidStateTransitionException', async () => {
    const state = new FollowUpState();
    await expect(
      state.generate(mockContext, { setupData: {} })
    ).rejects.toThrow(InvalidStateTransitionException);
  });

  it('should transition to EVALUATING on submit (early submission)', async () => {
    const state = new FollowUpState();
    await state.submit(mockContext, { data: [] });
    expect(mockContext.changeState).toHaveBeenCalledWith('EVALUATING');
  });

  it('should allow saveProgress without changing state', async () => {
    const mockRepo = {
      saveAnswers: vi.fn().mockResolvedValue(2),
    };
    const ctx = {
      ...mockContext,
      getRepository: vi.fn().mockReturnValue(mockRepo),
    } as unknown as IInterviewContext;

    const state = new FollowUpState();
    await expect(state.saveProgress(ctx, { answers: [] })).resolves.not.toThrow();
  });
});
