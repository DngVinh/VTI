import { IJobHandler } from '../IJobHandler';
import { container, inject, injectable } from 'tsyringe';
import { InterviewOperationProcessor } from '../../../services/InterviewOperationProcessor';
import { IAiProvider } from '../../interview/types';
import { IInterviewRepository } from '../../../repositories/IInterviewRepository';
import { InterviewContext } from '../../interview/InterviewContext';
import { IEventPublisher } from '../../events/IEventPublisher';
import { logger } from '../../../infrastructure/logging/logger';
import { evaluateSafely } from '../../../services/ai/prompt-security';
import { interviewJobData, operationJobData } from '../../../services/ai/job-security';

type EvaluateAnswersData =
  | { operationId: string; requestId?: string | null }
  | { interviewId: string; ownerId: string; requestId?: string | null };

@injectable()
export class EvaluateAnswersJobHandler implements IJobHandler<EvaluateAnswersData> {
  public readonly name = 'EVALUATE_ANSWERS';

  constructor(
    @inject(InterviewOperationProcessor)
    private readonly processorOrProvider: InterviewOperationProcessor | IAiProvider,
    @inject('IInterviewRepository')
    private readonly repository?: IInterviewRepository,
    @inject('IEventPublisher')
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  private resolveProvider(): IAiProvider {
    if (
      this.processorOrProvider &&
      typeof (this.processorOrProvider as any).evaluateAnswers === 'function'
    ) {
      return this.processorOrProvider as IAiProvider;
    }
    return container.resolve<IAiProvider>('IAiProvider');
  }

  async handle(input: EvaluateAnswersData): Promise<void> {
    if ('operationId' in input) {
      const normalized = operationJobData(input);
      await (this.processorOrProvider as InterviewOperationProcessor).process(
        normalized.operationId,
        'SUBMIT_ANSWERS',
      );
      return;
    }

    const provider = this.resolveProvider();
    const repo = this.repository ?? container.resolve<IInterviewRepository>('IInterviewRepository');
    if (!repo) throw new Error('Interview repository is not configured');
    const data = interviewJobData(input);
    const repository = repo.forOwner(data.ownerId);
    logger.info('job.started', {
      jobName: this.name,
      resourceType: 'interview',
      resourceId: data.interviewId,
    });

    const session = await repository.findById(data.interviewId);
    if (!session || session.status !== 'EVALUATING') {
      logger.warn('job.skipped', {
        jobName: this.name,
        resourceType: 'interview',
        resourceId: data.interviewId,
      });
      return;
    }
    if (!session.questions) throw new Error('Cannot find questions for this session.');

    try {
      const answers = session.questions.map((question) => ({
        questionId: question.id,
        candidateAnswer: question.candidateAnswer ?? '',
      }));
      const { data: evaluationResult, audit } = await evaluateSafely(
        provider,
        session.questions,
        answers,
      );

      for (const evaluation of evaluationResult.evaluations) {
        await repository.updateQuestionFeedback(
          evaluation.questionId,
          evaluation.feedback,
          evaluation.score,
          data.interviewId,
        );
      }
      await repository.update(data.interviewId, {
        overallScore: evaluationResult.overallScore,
        dimensions: evaluationResult.dimensions,
        learningPath: evaluationResult.learningPath,
      });
      await repository.updateTokenUsage(data.interviewId, audit);

      const publisher = this.eventPublisher ?? container.resolve<IEventPublisher>('IEventPublisher');
      const context = new InterviewContext(
        data.interviewId,
        repository,
        InterviewContext.createStateFromStatus(session.status),
        publisher,
        session.version,
      );
      const { CompletedState } = await import('../../interview/states/CompletedState');
      await context.changeState(new CompletedState());
      logger.info('job.completed', {
        jobName: this.name,
        resourceType: 'interview',
        resourceId: data.interviewId,
      });
    } catch (error) {
      logger.error('job.failed', {
        jobName: this.name,
        resourceType: 'interview',
        resourceId: data.interviewId,
      });
      const publisher = this.eventPublisher ?? container.resolve<IEventPublisher>('IEventPublisher');
      const context = new InterviewContext(
        data.interviewId,
        repository,
        InterviewContext.createStateFromStatus(session.status),
        publisher,
        session.version,
      );
      const { FailedState } = await import('../../interview/states/FailedState');
      await context.changeState(new FailedState());
      throw error;
    }
  }
}
