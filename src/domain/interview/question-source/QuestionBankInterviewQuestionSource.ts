import { injectable, inject } from 'tsyringe';
import {
  CandidateQuestionPayload,
  IInterviewQuestionSource,
  IQuestionBankSelector,
  QuestionBankCandidateItem,
  QuestionSourceContext,
  INTERVIEW_SOURCE_ERROR_CODES,
} from './types';
import {
  computeDeterministicSeed,
  computeSeedFingerprint,
  getDifficultyDistribution,
} from './InterviewQuestionSourcePolicy';
import { deterministicShuffle } from '../../question-bank/selection';
import { createContentHash, normalizePromptFingerprint } from '../../question-bank/hashing';
import { AppError } from '../../../utils/AppError';

@injectable()
export class QuestionBankInterviewQuestionSource implements IInterviewQuestionSource {
  public readonly mode = 'BANK_ONLY';

  constructor(
    @inject('IQuestionBankSelector') private selector: IQuestionBankSelector
  ) {}

  async generateQuestions(context: QuestionSourceContext): Promise<{
    questions: CandidateQuestionPayload[];
    audit: import('../types').AiUsageMetadata;
  }> {
    const policyVersion = context.policyVersion ?? 'v1';
    const taxonomy = {
      roleId: context.setupData.jobPosition,
      levelId: context.setupData.level,
      techIds: context.setupData.techStacks,
    };

    const seed = computeDeterministicSeed(context.sessionId, taxonomy, policyVersion);
    const fingerprint = computeSeedFingerprint(context.sessionId, taxonomy, policyVersion);

    const eligiblePool = await this.selector.findEligibleQuestions({
      roleId: context.setupData.jobPosition,
      levelId: context.setupData.level,
      technologyIds: context.setupData.techStacks,
    });

    const seenPrompts = new Set<string>();
    const uniquePool: QuestionBankCandidateItem[] = [];
    for (const item of eligiblePool) {
      const fp = normalizePromptFingerprint(item.prompt);
      if (fp && !seenPrompts.has(fp)) {
        seenPrompts.add(fp);
        uniquePool.push(item);
      }
    }

    const easyBucket = uniquePool.filter((q) => q.difficulty === 'EASY');
    const mediumBucket = uniquePool.filter((q) => q.difficulty === 'MEDIUM');
    const hardBucket = uniquePool.filter((q) => q.difficulty === 'HARD');

    const dist = getDifficultyDistribution(); // 1 Easy, 2 Medium, 2 Hard

    if (
      easyBucket.length < dist.EASY ||
      mediumBucket.length < dist.MEDIUM ||
      hardBucket.length < dist.HARD
    ) {
      throw new AppError(
        `Không đủ câu hỏi hợp lệ trong ngân hàng câu hỏi theo phân bổ độ khó (yêu cầu ${dist.EASY} Easy, ${dist.MEDIUM} Medium, ${dist.HARD} Hard; hiện có ${easyBucket.length} Easy, ${mediumBucket.length} Medium, ${hardBucket.length} Hard)`,
        400,
        INTERVIEW_SOURCE_ERROR_CODES.POOL_INSUFFICIENT
      );
    }

    const shuffledEasy = deterministicShuffle(easyBucket, `${seed}:EASY`);
    const shuffledMedium = deterministicShuffle(mediumBucket, `${seed}:MEDIUM`);
    const shuffledHard = deterministicShuffle(hardBucket, `${seed}:HARD`);

    const selectedEasy = shuffledEasy.slice(0, dist.EASY);
    const selectedMedium = shuffledMedium.slice(0, dist.MEDIUM);
    const selectedHard = shuffledHard.slice(0, dist.HARD);

    const orderedItems = [...selectedEasy, ...selectedMedium, ...selectedHard];

    const questions: CandidateQuestionPayload[] = orderedItems.map((item, idx) => ({
      order: idx + 1,
      difficulty: item.difficulty,
      content: { vi: item.prompt.vi, en: item.prompt.en },
      sourceType: 'QUESTION_BANK',
      questionBankQuestionId: item.questionId,
      questionBankVersionId: item.versionId,
      questionBankVersionNumber: item.versionNumber,
      questionBankCode: item.code,
      selectionPolicyVersion: policyVersion,
      selectionSeedFingerprint: fingerprint,
      promptSnapshotHash: createContentHash({ en: item.prompt.en, vi: item.prompt.vi }),
      selectedAt: new Date(),
    }));

    return {
      questions,
      audit: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
    };
  }
}
