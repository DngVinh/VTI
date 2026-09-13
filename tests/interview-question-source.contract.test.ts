import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { AiInterviewQuestionSource } from '../src/domain/interview/question-source/AiInterviewQuestionSource';
import { QuestionBankInterviewQuestionSource } from '../src/domain/interview/question-source/QuestionBankInterviewQuestionSource';
import { HybridInterviewQuestionSource } from '../src/domain/interview/question-source/HybridInterviewQuestionSource';
import {
  IQuestionBankSelector,
  QuestionBankCandidateItem,
  INTERVIEW_SOURCE_ERROR_CODES,
} from '../src/domain/interview/question-source/types';
import { IAiProvider, GeneratedQuestion, AiUsageMetadata } from '../src/domain/interview/types';

describe('AIP-66 Question Source Contracts', () => {
  const mockAiQuestions: GeneratedQuestion[] = [
    { order: 1, difficulty: 'Easy', content: { vi: 'AI Câu 1', en: 'AI Question 1' } },
    { order: 2, difficulty: 'Medium', content: { vi: 'AI Câu 2', en: 'AI Question 2' } },
    { order: 3, difficulty: 'Medium', content: { vi: 'AI Câu 3', en: 'AI Question 3' } },
    { order: 4, difficulty: 'Hard', content: { vi: 'AI Câu 4', en: 'AI Question 4' } },
    { order: 5, difficulty: 'Hard', content: { vi: 'AI Câu 5', en: 'AI Question 5' } },
  ];

  const mockAiAudit: AiUsageMetadata = {
    promptTokenCount: 15,
    candidatesTokenCount: 85,
    totalTokenCount: 100,
  };

  const createMockAiProvider = (): IAiProvider => ({
    generateQuestions: vi.fn().mockResolvedValue({
      data: mockAiQuestions,
      audit: mockAiAudit,
    }),
    evaluateAnswers: vi.fn(),
  });

  const mockBankPool: QuestionBankCandidateItem[] = [
    {
      questionId: '507f1f77bcf86cd799439001',
      versionId: '507f1f77bcf86cd799439002',
      versionNumber: 1,
      code: 'QB-000001',
      difficulty: 'EASY',
      prompt: { vi: 'Bank Easy 1', en: 'Bank Easy 1 EN' },
    },
    {
      questionId: '507f1f77bcf86cd799439003',
      versionId: '507f1f77bcf86cd799439004',
      versionNumber: 1,
      code: 'QB-000002',
      difficulty: 'MEDIUM',
      prompt: { vi: 'Bank Medium 1', en: 'Bank Medium 1 EN' },
    },
    {
      questionId: '507f1f77bcf86cd799439005',
      versionId: '507f1f77bcf86cd799439006',
      versionNumber: 2,
      code: 'QB-000003',
      difficulty: 'MEDIUM',
      prompt: { vi: 'Bank Medium 2', en: 'Bank Medium 2 EN' },
    },
    {
      questionId: '507f1f77bcf86cd799439007',
      versionId: '507f1f77bcf86cd799439008',
      versionNumber: 1,
      code: 'QB-000004',
      difficulty: 'HARD',
      prompt: { vi: 'Bank Hard 1', en: 'Bank Hard 1 EN' },
    },
    {
      questionId: '507f1f77bcf86cd799439009',
      versionId: '507f1f77bcf86cd799439010',
      versionNumber: 1,
      code: 'QB-000005',
      difficulty: 'HARD',
      prompt: { vi: 'Bank Hard 2', en: 'Bank Hard 2 EN' },
    },
  ];

  const createMockSelector = (items: QuestionBankCandidateItem[] = mockBankPool): IQuestionBankSelector => ({
    findEligibleQuestions: vi.fn().mockResolvedValue(items),
  });

  describe('AI_ONLY Source Contract', () => {
    it('generates exactly 5 questions exclusively from AI provider and tracks exact token usage', async () => {
      const aiProvider = createMockAiProvider();
      const source = new AiInterviewQuestionSource(aiProvider);

      const result = await source.generateQuestions({
        sessionId: 'session_ai_1',
        setupData: { jobPosition: 'Backend', level: 'Senior' },
      });

      expect(aiProvider.generateQuestions).toHaveBeenCalledTimes(1);
      expect(result.questions).toHaveLength(5);
      expect(result.audit).toEqual(mockAiAudit);

      for (let i = 0; i < 5; i++) {
        const q = result.questions[i];
        expect(q.order).toBe(i + 1);
        expect(q.sourceType).toBe('AI_GENERATED');
        expect(q.questionBankQuestionId).toBeNull();
        expect(q.questionBankVersionId).toBeNull();
        expect(q.promptSnapshotHash).toBeTruthy();
      }
    });
  });

  describe('BANK_ONLY Source Contract', () => {
    it('selects exactly 5 questions from Question Bank with 0 token usage when pool is sufficient', async () => {
      const selector = createMockSelector();
      const source = new QuestionBankInterviewQuestionSource(selector);

      const result = await source.generateQuestions({
        sessionId: 'session_bank_1',
        setupData: { jobPosition: 'Backend', level: 'Mid' },
        policyVersion: 'v1',
      });

      expect(selector.findEligibleQuestions).toHaveBeenCalledTimes(1);
      expect(result.questions).toHaveLength(5);
      expect(result.audit).toEqual({ promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 });

      const difficulties = result.questions.map((q) => q.difficulty);
      expect(difficulties.filter((d) => d === 'EASY')).toHaveLength(1);
      expect(difficulties.filter((d) => d === 'MEDIUM')).toHaveLength(2);
      expect(difficulties.filter((d) => d === 'HARD')).toHaveLength(2);

      for (const q of result.questions) {
        expect(q.sourceType).toBe('QUESTION_BANK');
        expect(q.questionBankQuestionId).toBeTruthy();
        expect(q.questionBankVersionId).toBeTruthy();
        expect(q.questionBankCode).toBeTruthy();
        expect(q.selectionPolicyVersion).toBe('v1');
        expect(q.selectionSeedFingerprint).toBeTruthy();
      }
    });

    it('fails with INTERVIEW_QUESTION_BANK_POOL_INSUFFICIENT and 0 questions when pool lacks required difficulties', async () => {
      // Only 1 Medium and 0 Hard
      const insufficientPool = mockBankPool.slice(0, 2);
      const selector = createMockSelector(insufficientPool);
      const source = new QuestionBankInterviewQuestionSource(selector);

      await expect(
        source.generateQuestions({
          sessionId: 'session_bank_insufficient',
          setupData: { jobPosition: 'DevOps' },
        })
      ).rejects.toMatchObject({
        code: INTERVIEW_SOURCE_ERROR_CODES.POOL_INSUFFICIENT,
      });
    });

    it('selection is strictly deterministic for identical session and taxonomy', async () => {
      // Add extra questions to ensure ordering choice
      const largerPool: QuestionBankCandidateItem[] = [
        ...mockBankPool,
        {
          questionId: '507f1f77bcf86cd799439011',
          versionId: '507f1f77bcf86cd799439012',
          versionNumber: 1,
          code: 'QB-000006',
          difficulty: 'MEDIUM',
          prompt: { vi: 'Bank Medium 3', en: 'Bank Medium 3 EN' },
        },
      ];
      const selector = createMockSelector(largerPool);
      const source = new QuestionBankInterviewQuestionSource(selector);

      const ctx = {
        sessionId: 'deterministic_session_1',
        setupData: { jobPosition: 'Backend', level: 'Mid' },
        policyVersion: 'v1',
      };

      const result1 = await source.generateQuestions(ctx);
      const result2 = await source.generateQuestions(ctx);

      expect(result1.questions.map((q) => q.questionBankQuestionId)).toEqual(
        result2.questions.map((q) => q.questionBankQuestionId)
      );
    });
  });

  describe('HYBRID Source Contract', () => {
    it('merges Bank (2) and AI (3) questions into exact-5 bundle without duplicates', async () => {
      const selector = createMockSelector();
      const aiProvider = createMockAiProvider();
      const source = new HybridInterviewQuestionSource(selector, aiProvider, 2);

      const result = await source.generateQuestions({
        sessionId: 'session_hybrid_1',
        setupData: { jobPosition: 'Frontend' },
        policyVersion: 'v1',
      });

      expect(result.questions).toHaveLength(5);
      expect(result.audit).toEqual(mockAiAudit);

      const bankQuestions = result.questions.filter((q) => q.sourceType === 'QUESTION_BANK');
      const aiQuestions = result.questions.filter((q) => q.sourceType === 'AI_GENERATED');

      expect(bankQuestions).toHaveLength(2);
      expect(aiQuestions).toHaveLength(3);

      for (let i = 0; i < 5; i++) {
        expect(result.questions[i].order).toBe(i + 1);
      }
    });

    it('falls back to AI for all 5 questions if Bank pool is insufficient, recording safe fallback code', async () => {
      const selector = createMockSelector([]); // empty pool
      const aiProvider = createMockAiProvider();
      const source = new HybridInterviewQuestionSource(selector, aiProvider, 2);

      const result = await source.generateQuestions({
        sessionId: 'session_hybrid_fallback',
        setupData: { jobPosition: 'AI Engineer' },
        policyVersion: 'v1',
      });

      expect(result.questions).toHaveLength(5);
      expect(result.diagnostics?.fallbackReasonCode).toBe(INTERVIEW_SOURCE_ERROR_CODES.POOL_INSUFFICIENT);

      const bankQuestions = result.questions.filter((q) => q.sourceType === 'QUESTION_BANK');
      const aiQuestions = result.questions.filter((q) => q.sourceType === 'AI_GENERATED');

      expect(bankQuestions).toHaveLength(0);
      expect(aiQuestions).toHaveLength(5);
    });

    it('deduplicates AI question when its prompt duplicates a selected Bank question', async () => {
      const selector = createMockSelector(mockBankPool);

      // AI returns one question that matches Bank Easy 1
      const duplicateAiQuestions: GeneratedQuestion[] = [
        { order: 1, difficulty: 'Easy', content: { vi: 'Bank Easy 1', en: 'Bank Easy 1 EN' } }, // DUPLICATE OF BANK!
        { order: 2, difficulty: 'Medium', content: { vi: 'Unique AI 1', en: 'Unique AI 1 EN' } },
        { order: 3, difficulty: 'Hard', content: { vi: 'Unique AI 2', en: 'Unique AI 2 EN' } },
        { order: 4, difficulty: 'Hard', content: { vi: 'Unique AI 3', en: 'Unique AI 3 EN' } },
        { order: 5, difficulty: 'Hard', content: { vi: 'Unique AI 4', en: 'Unique AI 4 EN' } },
      ];

      const aiProvider: IAiProvider = {
        generateQuestions: vi.fn().mockResolvedValue({
          data: duplicateAiQuestions,
          audit: mockAiAudit,
        }),
        evaluateAnswers: vi.fn(),
      };

      const source = new HybridInterviewQuestionSource(selector, aiProvider, 2);

      const result = await source.generateQuestions({
        sessionId: 'session_hybrid_dedup',
        setupData: { jobPosition: 'QA' },
        policyVersion: 'v1',
      });

      expect(result.questions).toHaveLength(5);
      const bankQ = result.questions.filter((q) => q.sourceType === 'QUESTION_BANK');
      const aiQ = result.questions.filter((q) => q.sourceType === 'AI_GENERATED');

      expect(bankQ).toHaveLength(2);
      expect(aiQ).toHaveLength(3);

      // Ensure the duplicated prompt was NOT selected from AI
      const aiPrompts = aiQ.map((q) => q.content.vi);
      expect(aiPrompts).not.toContain('Bank Easy 1');
      expect(aiPrompts).toContain('Unique AI 1');
      expect(aiPrompts).toContain('Unique AI 2');
      expect(aiPrompts).toContain('Unique AI 3');
    });
  });
});
