import {
  IInterviewState,
  InterviewStatus,
  IInterviewContext,
  GeneratePayload,
  SubmitPayload,
  SaveProgressPayload,
} from '../types';
import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';

export class GeneratingState implements IInterviewState {
  getName(): InterviewStatus {
    return 'GENERATING';
  }

  async generate(_context: IInterviewContext, _payload: GeneratePayload): Promise<void> {
    // Đang sinh câu hỏi rồi, không được gọi lại -> Idempotency
    throw new InvalidStateTransitionException('Interview is already in GENERATING state. Please wait.');
  }

  async submit(_context: IInterviewContext, _payload: SubmitPayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot submit answers while questions are being generated.');
  }

  async saveProgress(_context: IInterviewContext, _payload: SaveProgressPayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot save progress while questions are being generated.');
  }
}
