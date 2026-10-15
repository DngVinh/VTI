import { IInterviewState, InterviewStatus, IInterviewContext, GeneratePayload, SubmitPayload } from './types';
import { PendingState } from './states/PendingState';
import { GeneratingState } from './states/GeneratingState';
import { InProgressState } from './states/InProgressState';
import { EvaluatingState } from './states/EvaluatingState';
import { CompletedState } from './states/CompletedState';
import { FailedState } from './states/FailedState';
import { FollowUpState } from './states/FollowUpState';
import { IInterviewRepository } from '../../repositories/IInterviewRepository';
import { IEventPublisher } from '../events/IEventPublisher';

export class InterviewContext implements IInterviewContext {
  private state: IInterviewState;
  private interviewId: string;
  private repository: IInterviewRepository;
  private eventPublisher?: IEventPublisher;
  private version: number;

  constructor(
    interviewId: string, 
    repository: IInterviewRepository, 
    initialState?: IInterviewState,
    eventPublisher?: IEventPublisher,
    initialVersion = 0
  ) {
    this.interviewId = interviewId;
    this.repository = repository;
    this.eventPublisher = eventPublisher;
    this.version = initialVersion;
    // Default state is PENDING if not provided
    this.state = initialState || new PendingState();
  }

  public getInterviewId(): string {
    return this.interviewId;
  }

  public getState(): IInterviewState {
    return this.state;
  }

  public getRepository(): IInterviewRepository {
    return this.repository;
  }

  public getVersion(): number {
    return this.version;
  }

  /**
   * Chuyển đổi trạng thái và cập nhật xuống DB (có thể gọi hàm update trạng thái ở đây)
   */
  public async changeState(newState: IInterviewState | InterviewStatus): Promise<void> {
    const targetState: IInterviewState = typeof newState === 'string'
      ? InterviewContext.createStateFromStatus(newState)
      : newState;
    const currentStatus = this.state.getName();
    const nextStatus = targetState.getName();
    const legalTransitions: Record<InterviewStatus, InterviewStatus[]> = {
      PENDING: ['GENERATING'],
      GENERATING: ['IN_PROGRESS', 'FAILED'],
      IN_PROGRESS: ['FOLLOW_UP', 'EVALUATING', 'FAILED'],
      FOLLOW_UP: ['IN_PROGRESS', 'EVALUATING', 'FAILED'],
      EVALUATING: ['COMPLETED', 'FAILED'],
      COMPLETED: [],
      FAILED: ['GENERATING', 'EVALUATING'],
    };

    if (!legalTransitions[currentStatus].includes(nextStatus)) {
      const { InvalidStateTransitionException } = await import('./exceptions/InvalidStateTransitionException');
      throw new InvalidStateTransitionException(
        `Cannot transition interview from ${currentStatus} to ${nextStatus}.`
      );
    }

    const nextVersion = await this.repository.updateStatus(
      this.interviewId,
      nextStatus,
      currentStatus,
      this.version
    );

    if (nextVersion === null) {
      const { InvalidStateTransitionException } = await import('./exceptions/InvalidStateTransitionException');
      throw new InvalidStateTransitionException(
        `Stale interview version ${this.version}; state changed concurrently.`
      );
    }

    this.state = targetState;
    this.version = nextVersion;
    
    // Publish state change event for SSE
    if (this.eventPublisher) {
      this.eventPublisher.publish('STATE_CHANGED', {
        interviewId: this.interviewId,
        status: this.state.getName(),
        version: this.version
      });
    }
  }

  /**
   * Delegate action 'generate' to current state
   */
  public async generate(payload: GeneratePayload): Promise<void> {
    await this.state.generate(this, payload);
  }

  /**
   * Delegate action 'submit' to current state
   */
  public async submit(payload: SubmitPayload): Promise<void> {
    await this.state.submit(this, payload);
  }

  /**
   * Delegate action 'saveProgress' to current state
   */
  public async saveProgress(payload: import('./types').SaveProgressPayload): Promise<void> {
    await this.state.saveProgress(this, payload);
  }

  /**
   * Static factory method to instantiate correct state based on status string from DB
   */
  public static createStateFromStatus(status: InterviewStatus): IInterviewState {
    switch (status) {
      case 'PENDING': return new PendingState();
      case 'GENERATING': return new GeneratingState();
      case 'IN_PROGRESS': return new InProgressState();
      case 'FOLLOW_UP': return new FollowUpState();
      case 'EVALUATING': return new EvaluatingState();
      case 'COMPLETED': return new CompletedState();
      case 'FAILED': return new FailedState();
      default: return new PendingState();
    }
  }
}
