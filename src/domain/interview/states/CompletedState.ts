import {
  IInterviewState,
  InterviewStatus,
  IInterviewContext,
  GeneratePayload,
  SubmitPayload,
  SaveProgressPayload,
} from '../types';
import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';

export class CompletedState implements IInterviewState {
  getName(): InterviewStatus {
    return 'COMPLETED';
  }

  async generate(_context: IInterviewContext, _payload: GeneratePayload): Promise<void> {
    throw new InvalidStateTransitionException('Interview is already COMPLETED. Cannot generate questions.');
  }

  async submit(_context: IInterviewContext, _payload: SubmitPayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot submit answers for a COMPLETED interview.');
  }

  async saveProgress(_context: IInterviewContext, _payload: SaveProgressPayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot save progress for a COMPLETED interview.');
  }
}
