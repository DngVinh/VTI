import { describe, it, expect, vi } from 'vitest';
import { InterviewContext } from '../../src/domain/interview/InterviewContext';
import { FollowUpState } from '../../src/domain/interview/states/FollowUpState';
import { InProgressState } from '../../src/domain/interview/states/InProgressState';
import { InvalidStateTransitionException } from '../../src/domain/interview/exceptions/InvalidStateTransitionException';
import type { IInterviewRepository } from '../../src/repositories/IInterviewRepository';

describe('InterviewContext with FOLLOW_UP (Micro-Task 1.2b)', () => {
  const mockRepo = {
    updateStatus: vi.fn().mockResolvedValue(1),
    getOwnerId: vi.fn().mockReturnValue('owner-1'),
  } as unknown as IInterviewRepository;

  it('should instantiate FollowUpState from status string', () => {
    const state = InterviewContext.createStateFromStatus('FOLLOW_UP');
    expect(state).toBeInstanceOf(FollowUpState);
    expect(state.getName()).toBe('FOLLOW_UP');
  });

  it('should allow transition from IN_PROGRESS to FOLLOW_UP', async () => {
    const context = new InterviewContext('int-1', mockRepo, new InProgressState(), undefined, 0);
    await expect(context.changeState('FOLLOW_UP')).resolves.not.toThrow();
    expect(context.getState().getName()).toBe('FOLLOW_UP');
  });

  it('should allow transition from FOLLOW_UP back to IN_PROGRESS', async () => {
    const context = new InterviewContext('int-1', mockRepo, new FollowUpState(), undefined, 0);
    await expect(context.changeState('IN_PROGRESS')).resolves.not.toThrow();
    expect(context.getState().getName()).toBe('IN_PROGRESS');
  });

  it('should allow transition from FOLLOW_UP to EVALUATING', async () => {
    const context = new InterviewContext('int-1', mockRepo, new FollowUpState(), undefined, 0);
    await expect(context.changeState('EVALUATING')).resolves.not.toThrow();
    expect(context.getState().getName()).toBe('EVALUATING');
  });

  it('should reject transition from FOLLOW_UP to GENERATING', async () => {
    const context = new InterviewContext('int-1', mockRepo, new FollowUpState(), undefined, 0);
    await expect(context.changeState('GENERATING')).rejects.toThrow(InvalidStateTransitionException);
  });
});
