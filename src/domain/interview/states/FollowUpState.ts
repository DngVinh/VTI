import {
  IInterviewState,
  InterviewStatus,
  IInterviewContext,
  GeneratePayload,
  SubmitPayload,
  SaveProgressPayload,
} from '../types';
import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';

export class FollowUpState implements IInterviewState {
  getName(): InterviewStatus {
    return 'FOLLOW_UP';
  }

  async generate(_context: IInterviewContext, _payload: GeneratePayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot generate while in FOLLOW_UP state.');
  }

  async submit(context: IInterviewContext, _payload: SubmitPayload): Promise<void> {
    // Cho phép ứng viên nộp bài sớm từ trạng thái FOLLOW_UP
    await context.changeState('EVALUATING');
  }

  async saveProgress(context: IInterviewContext, payload: SaveProgressPayload): Promise<void> {
    const repository = context.getRepository();
    if (typeof (repository as any).saveAnswers === 'function') {
      await (repository as any).saveAnswers(context.getInterviewId(), payload.answers, context.getVersion());
    }
  }
}
