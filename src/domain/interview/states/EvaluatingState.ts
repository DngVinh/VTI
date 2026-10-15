import {
  IInterviewState,
  InterviewStatus,
  IInterviewContext,
  GeneratePayload,
  SubmitPayload,
  SaveProgressPayload,
} from '../types';
import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';

export class EvaluatingState implements IInterviewState {
  getName(): InterviewStatus {
    return 'EVALUATING';
  }

  async generate(_context: IInterviewContext, _payload: GeneratePayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot generate questions while EVALUATING answers.');
  }

  async submit(_context: IInterviewContext, _payload: SubmitPayload): Promise<void> {
    throw new InvalidStateTransitionException('Interview is already in EVALUATING state. Answers were already submitted.');
  }

  async saveProgress(_context: IInterviewContext, _payload: SaveProgressPayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot save progress while EVALUATING.');
  }
}
