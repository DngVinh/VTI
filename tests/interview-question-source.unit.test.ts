import { describe, it, expect } from 'vitest';
import {
  resolveEffectiveSourceMode,
  computeDeterministicSeed,
  computeSeedFingerprint,
  getDifficultyDistribution,
  getHybridTargetDistribution,
} from '../src/domain/interview/question-source/InterviewQuestionSourcePolicy';
import { InterviewQuestionBundleValidator } from '../src/domain/interview/question-source/InterviewQuestionBundleValidator';
import { toCandidateSafeInterviewQuestion, toCandidateSafeInterviewSession } from '../src/domain/interview/safe-dto';
import { CandidateQuestionPayload, INTERVIEW_SOURCE_ERROR_CODES } from '../src/domain/interview/question-source/types';

describe('AIP-66 Interview Question Source - Unit & Domain Tests', () => {
  describe('Policy Resolution & Feature Flag Precedence', () => {
    it('returns AI_ONLY when integration flag is false, regardless of configured mode', () => {
      expect(resolveEffectiveSourceMode({ enabled: false, mode: 'BANK_ONLY' })).toBe('AI_ONLY');
      expect(resolveEffectiveSourceMode({ enabled: false, mode: 'HYBRID' })).toBe('AI_ONLY');
      expect(resolveEffectiveSourceMode({ enabled: false, mode: 'SHADOW' })).toBe('AI_ONLY');
      expect(resolveEffectiveSourceMode({ enabled: false, mode: 'AI_ONLY' })).toBe('AI_ONLY');
    });

    it('returns configured mode when integration flag is true', () => {
      expect(resolveEffectiveSourceMode({ enabled: true, mode: 'BANK_ONLY' })).toBe('BANK_ONLY');
      expect(resolveEffectiveSourceMode({ enabled: true, mode: 'HYBRID' })).toBe('HYBRID');
      expect(resolveEffectiveSourceMode({ enabled: true, mode: 'SHADOW' })).toBe('SHADOW');
      expect(resolveEffectiveSourceMode({ enabled: true, mode: 'AI_ONLY' })).toBe('AI_ONLY');
    });

    it('fails closed to AI_ONLY when configured mode is unknown or invalid', () => {
      expect(resolveEffectiveSourceMode({ enabled: true, mode: 'INVALID_MODE' as any })).toBe('AI_ONLY');
      expect(resolveEffectiveSourceMode({ enabled: true, mode: undefined as any })).toBe('AI_ONLY');
    });
  });

  describe('Deterministic Seed Computation', () => {
    it('generates identical seed for identical session, taxonomy, and policy version', () => {
      const taxonomy = { roleId: 'role123', levelId: 'level456', techIds: ['tech1', 'tech2'] };
      const seed1 = computeDeterministicSeed('session_abc', taxonomy, 'v1');
      const seed2 = computeDeterministicSeed('session_abc', taxonomy, 'v1');
      expect(seed1).toBe(seed2);

      const fp1 = computeSeedFingerprint('session_abc', taxonomy, 'v1');
      const fp2 = computeSeedFingerprint('session_abc', taxonomy, 'v1');
      expect(fp1).toBe(fp2);
    });

    it('generates identical seed regardless of technology order in array', () => {
      const tax1 = { roleId: 'role1', levelId: 'level1', techIds: ['techA', 'techB'] };
      const tax2 = { roleId: 'role1', levelId: 'level1', techIds: ['techB', 'techA'] };
      expect(computeDeterministicSeed('session_1', tax1, 'v1')).toBe(
        computeDeterministicSeed('session_1', tax2, 'v1')
      );
    });

    it('generates different seeds for different session IDs', () => {
      const taxonomy = { roleId: 'role123', levelId: 'level456', techIds: ['tech1'] };
      const seed1 = computeDeterministicSeed('session_1', taxonomy, 'v1');
      const seed2 = computeDeterministicSeed('session_2', taxonomy, 'v1');
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('Difficulty Distribution Policy', () => {
    it('returns exact 5-question distribution: 1 Easy, 2 Medium, 2 Hard', () => {
      const dist = getDifficultyDistribution();
      expect(dist.EASY).toBe(1);
      expect(dist.MEDIUM).toBe(2);
      expect(dist.HARD).toBe(2);
      expect(dist.EASY + dist.MEDIUM + dist.HARD).toBe(5);
    });

    it('calculates hybrid distribution split correctly for bankCount = 2', () => {
      const split = getHybridTargetDistribution(2);
      expect(split.bank.EASY + split.bank.MEDIUM + split.bank.HARD).toBe(2);
      expect(split.ai.EASY + split.ai.MEDIUM + split.ai.HARD).toBe(3);
      expect(
        split.bank.EASY + split.bank.MEDIUM + split.bank.HARD +
        split.ai.EASY + split.ai.MEDIUM + split.ai.HARD
      ).toBe(5);
    });
  });

  describe('Bundle Validator - Exact-Five & Invariants', () => {
    const validQuestions: CandidateQuestionPayload[] = [
      {
        order: 1,
        difficulty: 'EASY',
        content: { vi: 'Câu hỏi 1', en: 'Question 1' },
        sourceType: 'QUESTION_BANK',
        questionBankQuestionId: '507f1f77bcf86cd799439011',
        questionBankVersionId: '507f1f77bcf86cd799439012',
        questionBankVersionNumber: 1,
        questionBankCode: 'QB-000001',
      },
      {
        order: 2,
        difficulty: 'MEDIUM',
        content: { vi: 'Câu hỏi 2', en: 'Question 2' },
        sourceType: 'QUESTION_BANK',
        questionBankQuestionId: '507f1f77bcf86cd799439013',
        questionBankVersionId: '507f1f77bcf86cd799439014',
        questionBankVersionNumber: 1,
        questionBankCode: 'QB-000002',
      },
      {
        order: 3,
        difficulty: 'MEDIUM',
        content: { vi: 'Câu hỏi 3', en: 'Question 3' },
        sourceType: 'AI_GENERATED',
      },
      {
        order: 4,
        difficulty: 'HARD',
        content: { vi: 'Câu hỏi 4', en: 'Question 4' },
        sourceType: 'AI_GENERATED',
      },
      {
        order: 5,
        difficulty: 'HARD',
        content: { vi: 'Câu hỏi 5', en: 'Question 5' },
        sourceType: 'AI_GENERATED',
      },
    ];

    it('passes validation for valid 5-question bundle', () => {
      expect(() => InterviewQuestionBundleValidator.validate(validQuestions)).not.toThrow();
    });

    it('rejects bundle with fewer than 5 questions', () => {
      const partial = validQuestions.slice(0, 4);
      expect(() => InterviewQuestionBundleValidator.validate(partial)).toThrowError(
        expect.objectContaining({ code: INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID })
      );
    });

    it('rejects bundle with more than 5 questions', () => {
      const extra = [...validQuestions, { ...validQuestions[0], order: 6 }];
      expect(() => InterviewQuestionBundleValidator.validate(extra)).toThrowError(
        expect.objectContaining({ code: INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID })
      );
    });

    it('rejects non-contiguous or duplicate order numbers', () => {
      const dupOrders = validQuestions.map(q => ({ ...q }));
      dupOrders[1].order = 1; // duplicate order 1
      expect(() => InterviewQuestionBundleValidator.validate(dupOrders)).toThrowError(
        expect.objectContaining({ code: INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID })
      );
    });

    it('rejects questions with duplicate normalized prompt', () => {
      const dupPrompts = validQuestions.map(q => ({ ...q }));
      dupPrompts[2].content = { vi: '  câu hỏi 1  ', en: ' Question 1 ' }; // duplicate of order 1
      expect(() => InterviewQuestionBundleValidator.validate(dupPrompts)).toThrowError(
        expect.objectContaining({ code: INTERVIEW_SOURCE_ERROR_CODES.DUPLICATE })
      );
    });

    it('rejects missing or empty bilingual content (vi or en missing)', () => {
      const missingEn = validQuestions.map(q => ({ ...q }));
      missingEn[0].content = { vi: 'Có tiếng Việt', en: '' };
      expect(() => InterviewQuestionBundleValidator.validate(missingEn)).toThrowError(
        expect.objectContaining({ code: INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID })
      );
    });

    it('rejects QUESTION_BANK question missing versionId or questionId', () => {
      const invalidProvenance = validQuestions.map(q => ({ ...q }));
      invalidProvenance[0] = {
        ...invalidProvenance[0],
        questionBankVersionId: null,
      };
      expect(() => InterviewQuestionBundleValidator.validate(invalidProvenance)).toThrowError(
        expect.objectContaining({ code: INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID })
      );
    });

    it('rejects AI_GENERATED question having fake questionBankQuestionId', () => {
      const fakeProvenance = validQuestions.map(q => ({ ...q }));
      fakeProvenance[2] = {
        ...fakeProvenance[2],
        sourceType: 'AI_GENERATED',
        questionBankQuestionId: 'fake_id',
      };
      expect(() => InterviewQuestionBundleValidator.validate(fakeProvenance)).toThrowError(
        expect.objectContaining({ code: INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID })
      );
    });
  });

  describe('Candidate Safe DTO Sanitization', () => {
    it('omits all internal Question Bank provenance and secrets from Candidate DTO', () => {
      const internalQuestion: any = {
        _id: 'q123',
        sessionId: 's456',
        order: 1,
        difficulty: 'EASY',
        content: { vi: 'Câu hỏi', en: 'Question' },
        candidateAnswer: 'Trả lời',
        feedback: null,
        score: null,
        sourceType: 'QUESTION_BANK',
        questionBankQuestionId: 'qb_question_id',
        questionBankVersionId: 'qb_version_id',
        questionBankVersionNumber: 2,
        questionBankCode: 'QB-000001',
        selectionPolicyVersion: 'v1',
        selectionSeedFingerprint: 'seed_fingerprint',
        promptSnapshotHash: 'snapshot_hash',
        selectedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const safeQ = toCandidateSafeInterviewQuestion(internalQuestion);

      expect(safeQ).toEqual({
        id: 'q123',
        sessionId: 's456',
        order: 1,
        difficulty: 'EASY',
        content: { vi: 'Câu hỏi', en: 'Question' },
        candidateAnswer: 'Trả lời',
        feedback: null,
        score: null,
        createdAt: internalQuestion.createdAt,
        updatedAt: internalQuestion.updatedAt,
      });

      expect((safeQ as any).sourceType).toBeUndefined();
      expect((safeQ as any).questionBankQuestionId).toBeUndefined();
      expect((safeQ as any).questionBankVersionId).toBeUndefined();
      expect((safeQ as any).promptSnapshotHash).toBeUndefined();
      expect((safeQ as any).selectionSeedFingerprint).toBeUndefined();
    });

    it('sanitizes questions within full InterviewSession', () => {
      const session: any = {
        id: 's456',
        userId: 'u1',
        status: 'IN_PROGRESS',
        setupData: { jobPosition: 'Backend', level: 'Junior', techStacks: ['Node.js'] },
        questions: [
          {
            id: 'q1',
            sessionId: 's456',
            order: 1,
            difficulty: 'EASY',
            content: { vi: 'V1', en: 'E1' },
            sourceType: 'QUESTION_BANK',
            questionBankQuestionId: 'qb_secret',
          },
        ],
      };

      const safeSession = toCandidateSafeInterviewSession(session);
      expect(safeSession.questions?.[0].id).toBe('q1');
      expect((safeSession.questions?.[0] as any).sourceType).toBeUndefined();
      expect((safeSession.questions?.[0] as any).questionBankQuestionId).toBeUndefined();
    });
  });
});
