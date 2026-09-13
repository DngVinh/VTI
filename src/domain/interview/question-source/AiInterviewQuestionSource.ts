import { injectable, inject } from 'tsyringe';
import { IAiProvider, GeneratedQuestion, AiUsageMetadata } from '../types';
import {
  CandidateQuestionPayload,
  IInterviewQuestionSource,
  QuestionSourceContext,
} from './types';
import { createContentHash } from '../../question-bank/hashing';
import { generateThroughBoundary } from '../../../services/ai/prompt-security';

@injectable()
export class AiInterviewQuestionSource implements IInterviewQuestionSource {
  public readonly mode = 'AI_ONLY';

  constructor(@inject('IAiProvider') private aiProvider: IAiProvider) {}

  async generateQuestions(context: QuestionSourceContext): Promise<{
    questions: CandidateQuestionPayload[];
    audit: AiUsageMetadata;
  }> {
    const { data, audit } = await generateThroughBoundary(this.aiProvider, context.setupData);

    const questions: CandidateQuestionPayload[] = data.map((q: GeneratedQuestion, idx: number) => {
      const difficulty = (q.difficulty || 'MEDIUM').toUpperCase();
      const vi = q.content?.vi ?? '';
      const en = q.content?.en ?? '';
      return {
        order: q.order || idx + 1,
        difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? difficulty : 'MEDIUM',
        content: { vi, en },
        sourceType: 'AI_GENERATED',
        questionBankQuestionId: null,
        questionBankVersionId: null,
        questionBankVersionNumber: null,
        questionBankCode: null,
        selectionPolicyVersion: context.policyVersion ?? 'v1',
        selectionSeedFingerprint: null,
        promptSnapshotHash: createContentHash({ en, vi }),
        selectedAt: new Date(),
      };
    });

    return { questions, audit };
  }
}
