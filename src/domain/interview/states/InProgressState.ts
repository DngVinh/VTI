import {
  IInterviewState,
  InterviewStatus,
  IInterviewContext,
  GeneratePayload,
  SubmitPayload,
  SaveProgressPayload,
} from '../types';

import {
  InvalidStateTransitionException
} from '../exceptions/InvalidStateTransitionException';

import {
  EvaluatingState
} from './EvaluatingState';

import { evaluateSafely } from '../../../services/ai/prompt-security';
import { logger } from '../../../infrastructure/logging/logger';

export class InProgressState
  implements IInterviewState
{
  getName(): InterviewStatus {
    return 'IN_PROGRESS';
  }

  async generate(
    _context: IInterviewContext,
    _payload: GeneratePayload
  ): Promise<void> {
    throw new InvalidStateTransitionException(
      'Questions have already been generated. The interview is currently IN_PROGRESS.'
    );
  }

  async submit(
    context: IInterviewContext,
    payload: SubmitPayload
  ): Promise<void> {
    logger.info('interview.submitting', { resourceType: 'interview', resourceId: context.getInterviewId() });

    // Chuyển sang trạng thái chấm bài
    await context.changeState(
      new EvaluatingState()
    );

    try {
      if (payload.useAsyncJobs !== false && payload.jobScheduler) {
        await payload.jobScheduler.enqueue('EVALUATE_ANSWERS', {
          interviewId: context.getInterviewId(),
          ownerId: context.getRepository().getOwnerId(),
        });

        return;
      }

      /*
       * Multi-Agent Evaluation Panel (AIP-AIU-02).
       */
      if (payload.multiAgentEvaluator) {
        const session = await context.getRepository().findById(context.getInterviewId());
        if (!session || !session.questions) {
          throw new Error('Cannot find questions for this session.');
        }

        const consensus = await payload.multiAgentEvaluator.evaluate({
          sessionId: context.getInterviewId(),
          role: session.role || 'Developer',
          level: session.level || 'Junior',
          technologies: session.technologies || [],
          questions: session.questions.map((q: any, i: number) => ({
            order: q.order || i + 1,
            category: q.category || 'General',
            difficulty: q.difficulty || 'Medium',
            content: q.content,
          })),
          answers: payload.data.map((ans, i) => ({
            questionId: ans.questionId,
            order: i + 1,
            candidateAnswer: ans.candidateAnswer,
          })),
          conversationHistory: payload.conversationTurns,
        });

        const evaluationResult = payload.multiAgentEvaluator.toEvaluationResult(consensus, {
          sessionId: context.getInterviewId(),
          role: session.role || 'Developer',
          level: session.level || 'Junior',
          technologies: session.technologies || [],
          questions: session.questions,
          answers: payload.data.map((ans, i) => ({
            order: i + 1,
            candidateAnswer: ans.candidateAnswer,
          })),
        });

        for (const evalResult of evaluationResult.evaluations) {
          await context.getRepository().updateQuestionFeedback(
            evalResult.questionId,
            evalResult.feedback,
            evalResult.score,
            context.getInterviewId()
          );
        }

        await context.getRepository().update(context.getInterviewId(), {
          overallScore: evaluationResult.overallScore,
          dimensions: evaluationResult.dimensions,
          learningPath: evaluationResult.learningPath,
          personaEvaluations: consensus.personaBreakdown,
          varianceFlags: consensus.varianceFlags,
        });

        const { CompletedState } = await import('./CompletedState');
        await context.changeState(new CompletedState());
        return;
      }

      /*
       * Fallback synchronous evaluation.
       */
      if (payload.aiProvider) {
        const session =
          await context
            .getRepository()
            .findById(
              context.getInterviewId()
            );

        if (
          !session ||
          !session.questions
        ) {
          throw new Error(
            'Cannot find questions for this session.'
          );
        }

        const { data: evaluationResult, audit } = await evaluateSafely(
          payload.aiProvider,
          session.questions,
          payload.data,
        );

        /*
         * Save feedback cho từng câu trả lời.
         */
        for (
          const evalResult of
            evaluationResult.evaluations
        ) {
          await context
            .getRepository()
            .updateQuestionFeedback(
              evalResult.questionId,
              evalResult.feedback,
              evalResult.score,
              context.getInterviewId()
            );
        }

        const learningPath = evaluationResult.learningPath;

        /*
         * Save overall score và learning path.
         */
          await context
            .getRepository()
            .update(
            context.getInterviewId(),
            {
              overallScore:
                evaluationResult.overallScore,

              dimensions:
                evaluationResult.dimensions,

              learningPath
            }
          );

        /*
         * Save token usage của evaluation.
         */
        await context
          .getRepository()
          .updateTokenUsage(
            context.getInterviewId(),
            audit
          );

        // Success -> COMPLETED
        const {
          CompletedState
        } = await import(
          './CompletedState'
        );

        await context.changeState(
          new CompletedState()
        );
      }
    } catch (error) {
      // Fail -> FAILED
      await context.changeState('FAILED');

      throw error;
    }
  }

  async saveProgress(
    context: IInterviewContext,
    payload: SaveProgressPayload
  ): Promise<void> {
    logger.info('interview.saving', { resourceType: 'interview', resourceId: context.getInterviewId() });

    /*
     * Lưu câu trả lời nhưng không chuyển state.
     */
    for (
      const answer of payload.answers
    ) {
      await context
        .getRepository()
        .updateQuestionAnswer(
          answer.questionId,
          answer.candidateAnswer,
          context.getInterviewId()
        );
    }
  }
}
