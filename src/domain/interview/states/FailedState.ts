import {
  IInterviewState,
  InterviewStatus,
  IInterviewContext,
  GeneratePayload,
  SubmitPayload,
  SaveProgressPayload,
} from '../types';
import { PendingState } from './PendingState';
import { InProgressState } from './InProgressState';
import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';
import { logger } from '../../../infrastructure/logging/logger';

export class FailedState implements IInterviewState {
  getName(): InterviewStatus {
    return 'FAILED';
  }

  async generate(context: IInterviewContext, payload: GeneratePayload): Promise<void> {
    logger.info('interview.retry_generation', { resourceType: 'interview', resourceId: context.getInterviewId() });
    const pendingState = new PendingState();
    await pendingState.generate(context, payload);
  }

  async submit(context: IInterviewContext, payload: SubmitPayload): Promise<void> {
    logger.info('interview.retry_submission', { resourceType: 'interview', resourceId: context.getInterviewId() });
    const inProgressState = new InProgressState();
    await inProgressState.submit(context, payload);
  }

  async saveProgress(_context: IInterviewContext, _payload: SaveProgressPayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot save progress for a FAILED interview.');
  }
}
