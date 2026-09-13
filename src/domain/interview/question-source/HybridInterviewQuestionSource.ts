import { injectable, inject } from 'tsyringe';
import {
  CandidateQuestionPayload,
  IInterviewQuestionSource,
  IQuestionBankSelector,
  QuestionBankCandidateItem,
  QuestionSourceContext,
  INTERVIEW_SOURCE_ERROR_CODES,
  QuestionSourceDiagnostics,
} from './types';
import {
  computeDeterministicSeed,
  computeSeedFingerprint,
  getHybridTargetDistribution,
} from './InterviewQuestionSourcePolicy';
import { deterministicShuffle } from '../../question-bank/selection';
import { createContentHash, normalizePromptFingerprint } from '../../question-bank/hashing';
import { IAiProvider, AiUsageMetadata } from '../types';
import { AppError } from '../../../utils/AppError';
import { generateThroughBoundary } from '../../../services/ai/prompt-security';

@injectable()
export class HybridInterviewQuestionSource implements IInterviewQuestionSource {
  public readonly mode = 'HYBRID';

  constructor(
    @inject('IQuestionBankSelector') private selector: IQuestionBankSelector,
    @inject('IAiProvider') private aiProvider: IAiProvider,
    private bankTargetCount: number = 2,
    private allowFallbackToAi: boolean = true
  ) {}

  async generateQuestions(context: QuestionSourceContext): Promise<{
    questions: CandidateQuestionPayload[];
    audit: AiUsageMetadata;
    diagnostics?: Partial<QuestionSourceDiagnostics>;
  }> {
    const policyVersion = context.policyVersion ?? 'v1';
    const taxonomy = {
      roleId: context.setupData.jobPosition,
      levelId: context.setupData.level,
      techIds: context.setupData.techStacks,
    };

    const seed = computeDeterministicSeed(context.sessionId, taxonomy, policyVersion);
    const fingerprint = computeSeedFingerprint(context.sessionId, taxonomy, policyVersion);

    let selectedBankQuestions: QuestionBankCandidateItem[] = [];
    let fallbackReasonCode: string | null = null;
    const { bank: bankTarget } = getHybridTargetDistribution(this.bankTargetCount);
    const totalBankNeeded = bankTarget.EASY + bankTarget.MEDIUM + bankTarget.HARD;

    try {
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

      if (
        easyBucket.length >= bankTarget.EASY &&
        mediumBucket.length >= bankTarget.MEDIUM &&
        hardBucket.length >= bankTarget.HARD
      ) {
        const pickedEasy = deterministicShuffle(easyBucket, `${seed}:HYBRID:EASY`).slice(0, bankTarget.EASY);
        const pickedMedium = deterministicShuffle(mediumBucket, `${seed}:HYBRID:MEDIUM`).slice(0, bankTarget.MEDIUM);
        const pickedHard = deterministicShuffle(hardBucket, `${seed}:HYBRID:HARD`).slice(0, bankTarget.HARD);
        selectedBankQuestions = [...pickedEasy, ...pickedMedium, ...pickedHard];
      } else if (uniquePool.length >= totalBankNeeded) {
        selectedBankQuestions = deterministicShuffle(uniquePool, `${seed}:HYBRID`).slice(0, totalBankNeeded);
      } else {
        fallbackReasonCode = INTERVIEW_SOURCE_ERROR_CODES.POOL_INSUFFICIENT;
        selectedBankQuestions = [];
      }
    } catch {
      fallbackReasonCode = INTERVIEW_SOURCE_ERROR_CODES.SOURCE_UNAVAILABLE;
      selectedBankQuestions = [];
    }

    const allowFallback =
      this.allowFallbackToAi &&
      process.env.INTERVIEW_QUESTION_BANK_ALLOW_FALLBACK_TO_AI !== 'false' &&
      process.env.INTERVIEW_QUESTION_BANK_ALLOW_FALLBACK_TO_AI !== '0';

    if (selectedBankQuestions.length < totalBankNeeded && !allowFallback) {
      throw new AppError(
        `Không đủ câu hỏi ngân hàng cho chế độ Hybrid và tính năng fallback AI bị tắt`,
        400,
        fallbackReasonCode || INTERVIEW_SOURCE_ERROR_CODES.POOL_INSUFFICIENT
      );
    }

    const bankChosenCount = selectedBankQuestions.length;
    const aiNeededCount = 5 - bankChosenCount;

    // Call AI provider
    let aiCallAudit: AiUsageMetadata = { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
    const { data: aiGeneratedRaw, audit } = await generateThroughBoundary(
      this.aiProvider,
      context.setupData,
    );
    aiCallAudit = {
      promptTokenCount: (aiCallAudit.promptTokenCount || 0) + (audit?.promptTokenCount || 0),
      candidatesTokenCount: (aiCallAudit.candidatesTokenCount || 0) + (audit?.candidatesTokenCount || 0),
      totalTokenCount: (aiCallAudit.totalTokenCount || 0) + (audit?.totalTokenCount || 0),
    };

    const bankFingerprints = new Set(
      selectedBankQuestions.map((b) => normalizePromptFingerprint(b.prompt)).filter(Boolean)
    );

    const eligibleAiQuestions: typeof aiGeneratedRaw = [];
    for (const aiQ of aiGeneratedRaw) {
      const fp = normalizePromptFingerprint(aiQ.content);
      if (fp && !bankFingerprints.has(fp)) {
        bankFingerprints.add(fp);
        eligibleAiQuestions.push(aiQ);
      }
    }

    if (eligibleAiQuestions.length < aiNeededCount) {
      throw new AppError(
        `Không thể tạo đủ câu hỏi duy nhất cho phỏng vấn Hybrid (cần ${aiNeededCount} từ AI, chỉ có ${eligibleAiQuestions.length})`,
        400,
        INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID
      );
    }

    const selectedAi = eligibleAiQuestions.slice(0, aiNeededCount);

    const finalQuestions: CandidateQuestionPayload[] = [];
    let currentOrder = 1;

    for (const b of selectedBankQuestions) {
      finalQuestions.push({
        order: currentOrder++,
        difficulty: b.difficulty,
        content: { vi: b.prompt.vi, en: b.prompt.en },
        sourceType: 'QUESTION_BANK',
        questionBankQuestionId: b.questionId,
        questionBankVersionId: b.versionId,
        questionBankVersionNumber: b.versionNumber,
        questionBankCode: b.code,
        selectionPolicyVersion: policyVersion,
        selectionSeedFingerprint: fingerprint,
        promptSnapshotHash: createContentHash({ en: b.prompt.en, vi: b.prompt.vi }),
        selectedAt: new Date(),
      });
    }

    for (const a of selectedAi) {
      const difficulty = (a.difficulty || 'MEDIUM').toUpperCase();
      finalQuestions.push({
        order: currentOrder++,
        difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? difficulty : 'MEDIUM',
        content: { vi: a.content.vi, en: a.content.en },
        sourceType: 'AI_GENERATED',
        questionBankQuestionId: null,
        questionBankVersionId: null,
        questionBankVersionNumber: null,
        questionBankCode: null,
        selectionPolicyVersion: policyVersion,
        selectionSeedFingerprint: null,
        promptSnapshotHash: createContentHash({ en: a.content.en, vi: a.content.vi }),
        selectedAt: new Date(),
      });
    }

    return {
      questions: finalQuestions,
      audit: aiCallAudit,
      diagnostics: {
        selectedFromBank: bankChosenCount,
        selectedFromAi: selectedAi.length,
        fallbackReasonCode,
      },
    };
  }
}
