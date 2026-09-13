import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { container } from 'tsyringe';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'mode_matrix_test_access_secret_32_chars_123';
  process.env.JWT_REFRESH_SECRET = 'mode_matrix_test_refresh_secret_32_chars_456';
  process.env.PASSWORD_RESET_SECRET = 'mode_matrix_test_reset_secret_32_chars_789';
  process.env.INTERVIEW_QUESTION_COUNT = '5';
});

import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import Technology from '../src/models/technology.model';
import { MongoInterviewRepository } from '../src/repositories/MongoInterviewRepository';
import { QuestionBankSelector } from '../src/domain/interview/question-source/QuestionBankSelector';
import { InterviewQuestionGenerationOrchestrator } from '../src/domain/interview/question-source/InterviewQuestionGenerationOrchestrator';
import { MockAiProvider } from '../src/services/ai/providers/MockAiProvider';
import { InterviewEventBus } from '../src/infrastructure/events/InterviewEventBus';
import { createContentHash, normalizePromptFingerprint } from '../src/domain/question-bank/hashing';
import { INTERVIEW_SOURCE_ERROR_CODES } from '../src/domain/interview/question-source/types';

describe('AIP-67 Scope A: Sourcing Mode & Exact-Five Matrix Integration Tests', () => {
  let replicaSet: MongoMemoryReplSet;
  let repo: MongoInterviewRepository;
  let selector: QuestionBankSelector;
  let orchestrator: InterviewQuestionGenerationOrchestrator;
  let mockAiProvider: MockAiProvider;
  let roleId: string;
  let levelId: string;
  let technologyId: string;
  let adminId: string;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    await mongoose.connect(replicaSet.getUri(), {
      dbName: 'mode_matrix_test_db',
    });

    adminId = new Types.ObjectId().toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replicaSet.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();

    const role = await Role.create({
      code: 'BACKEND',
      name: 'Backend Engineer',
      description: 'Backend role',
      status: 'ACTIVE',
    });
    roleId = role.id;

    const level = await Level.create({
      code: 'SENIOR',
      name: 'Senior',
      description: 'Senior level',
      status: 'ACTIVE',
    });
    levelId = level.id;

    const tech = await Technology.create({
      code: 'NODEJS',
      name: 'Node.js',
      description: 'Node.js runtime',
      status: 'ACTIVE',
    });
    technologyId = tech.id;

    // Build fresh instances
    repo = new MongoInterviewRepository();
    selector = new QuestionBankSelector({
      findEligiblePublishedForSelection: async (filter: any) => {
        const query: any = {
          status: 'PUBLISHED',
        };
        if (filter.roleId) query.primaryRoleId = new Types.ObjectId(filter.roleId);
        if (filter.levelId) query.levelIds = new Types.ObjectId(filter.levelId);
        if (filter.technologyIds && filter.technologyIds.length > 0) {
          query['technologies.technologyId'] = {
            $in: filter.technologyIds.map((id: string) => new Types.ObjectId(id)),
          };
        }

        const versions = await QuestionVersion.find(query).lean();
        const results = [];
        for (const v of versions) {
          const q = await Question.findOne({
            _id: v.questionId,
            lifecycleStatus: 'ACTIVE',
            currentPublishedVersionId: v._id,
          }).lean();
          if (q) {
            results.push({
              questionId: q._id.toString(),
              versionId: v._id.toString(),
              versionNumber: v.versionNumber,
              code: q.code,
              prompt: v.prompt,
              difficulty: v.difficulty,
              type: v.questionType,
              primaryRoleId: v.primaryRoleId?.toString(),
              levelIds: (v.levelIds || []).map((id: any) => id.toString()),
              taxonomy: {
                technologyIds: (v.technologies || []).map((t: any) => t.technologyId?.toString()),
              },
            });
          }
        }
        return results;
      },
    } as any);

    mockAiProvider = new MockAiProvider();
    vi.spyOn(mockAiProvider, 'generateQuestions').mockImplementation(async () => {
      return {
        data: [
          { order: 1, difficulty: 'Easy', content: { vi: 'Câu hỏi AI 1', en: 'AI Question 1' } },
          { order: 2, difficulty: 'Medium', content: { vi: 'Câu hỏi AI 2', en: 'AI Question 2' } },
          { order: 3, difficulty: 'Medium', content: { vi: 'Câu hỏi AI 3', en: 'AI Question 3' } },
          { order: 4, difficulty: 'Hard', content: { vi: 'Câu hỏi AI 4', en: 'AI Question 4' } },
          { order: 5, difficulty: 'Hard', content: { vi: 'Câu hỏi AI 5', en: 'AI Question 5' } },
        ],
        audit: { promptTokenCount: 20, candidatesTokenCount: 80, totalTokenCount: 100 },
      };
    });

    const eventBus = new InterviewEventBus();
    orchestrator = new InterviewQuestionGenerationOrchestrator(
      repo,
      mockAiProvider,
      selector,
      eventBus
    );
  });

  const seedQuestion = async (
    code: string,
    difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM',
    lifecycleStatus: 'ACTIVE' | 'RETIRED' = 'ACTIVE',
    versionNumber: number = 1
  ) => {
    const questionId = new Types.ObjectId();
    const versionId = new Types.ObjectId();
    const adminOid = new Types.ObjectId(adminId);

    const prompt = {
      vi: `Nội dung ngân hàng tiếng Việt ${code}`,
      en: `Bank question content English ${code}`,
    };

    await QuestionVersion.create({
      _id: versionId,
      questionId,
      versionNumber,
      status: 'PUBLISHED',
      prompt,
      explanation: { vi: 'Giải thích', en: 'Explanation' },
      followUps: [],
      questionType: 'TECHNICAL',
      difficulty,
      primaryRoleId: new Types.ObjectId(roleId),
      additionalRoleIds: [],
      levelIds: [new Types.ObjectId(levelId)],
      technologies: [{ technologyId: new Types.ObjectId(technologyId), relevance: 100 }],
      technologyAgnostic: false,
      classificationComplete: true,
      topic: 'Matrix Topic',
      tags: ['matrix'],
      referenceAnswer: { vi: 'Đáp án tham chiếu', en: 'Reference answer' },
      learningObjective: { vi: 'Mục tiêu', en: 'Objective' },
      estimatedTimeSeconds: 180,
      rubric: [
        {
          key: 'technical',
          title: { vi: 'Kỹ thuật', en: 'Technical' },
          description: { vi: 'Mô tả', en: 'Description' },
          weight: 100,
          levels: [{ score: 4, description: { vi: 'Tốt', en: 'Good' } }],
        },
      ],
      changeSummary: 'Seed version',
      origin: 'MANUAL',
      sourceVersionId: null,
      sourceReference: null,
      contentHash: createContentHash({ prompt, difficulty }),
      normalizedPromptFingerprint: normalizePromptFingerprint(prompt),
      createdBy: adminOid,
      updatedBy: adminOid,
      contributorIds: [adminOid],
    });

    await Question.create({
      _id: questionId,
      code,
      lifecycleStatus,
      currentPublishedVersionId: versionId,
      draftVersionId: null,
      latestVersionNumber: versionNumber,
      revision: 1,
      origin: 'MANUAL',
      primaryRoleId: new Types.ObjectId(roleId),
      additionalRoleIds: [],
      levelIds: [new Types.ObjectId(levelId)],
      technologies: [{ technologyId: new Types.ObjectId(technologyId), relevance: 100 }],
      technologyAgnostic: false,
      ownerId: adminOid,
      createdBy: adminOid,
      updatedBy: adminOid,
      publishedAt: new Date(),
    });

    return { questionId: questionId.toString(), versionId: versionId.toString() };
  };

  const seedStandardPool = async () => {
    // Standard quota: 1 EASY, 2 MEDIUM, 2 HARD
    await seedQuestion('QB-2026-000001', 'EASY');
    await seedQuestion('QB-2026-000002', 'MEDIUM');
    await seedQuestion('QB-2026-000003', 'MEDIUM');
    await seedQuestion('QB-2026-000004', 'HARD');
    await seedQuestion('QB-2026-000005', 'HARD');
  };

  const createTestSession = async () => {
    const session = await InterviewSessionModel.create({
      userId: new Types.ObjectId(),
      status: 'GENERATING',
      setupData: {
        jobPosition: roleId,
        level: levelId,
        techStacks: [technologyId],
      },
    });
    return session.id.toString();
  };

  const assertExactFiveBundleInvariants = async (sessionId: string) => {
    const dbQuestions = await InterviewQuestionModel.find({ sessionId }).sort({ order: 1 }).lean();
    expect(dbQuestions.length).toBe(5);

    // 1. Order is unique 1..5
    const orders = dbQuestions.map((q) => q.order);
    expect(orders).toEqual([1, 2, 3, 4, 5]);

    // 2. Bilingual content valid
    const seenPrompts = new Set<string>();
    for (const q of dbQuestions) {
      expect(q.content).toBeDefined();
      expect(q.content.vi).toBeTruthy();
      expect(q.content.en).toBeTruthy();
      expect(q.content.vi.trim().length).toBeGreaterThan(0);
      expect(q.content.en.trim().length).toBeGreaterThan(0);

      // 3. No duplicate normalized prompt
      const fp = normalizePromptFingerprint(q.content);
      expect(seenPrompts.has(fp)).toBe(false);
      seenPrompts.add(fp);

      // 4. Difficulty valid
      expect(['EASY', 'MEDIUM', 'HARD']).toContain(q.difficulty.toUpperCase());

      // 5. Source type valid
      expect(['AI_GENERATED', 'QUESTION_BANK']).toContain(q.sourceType);
    }
  };

  // =========================================================================
  // SCENARIO 1: Feature Flag OFF + Config BANK_ONLY -> Force AI_ONLY
  // =========================================================================
  it('Scenario 1: Feature flag OFF + config BANK_ONLY forces AI_ONLY, selector not called, exact 5 saved', async () => {
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'false';
    process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'BANK_ONLY';

    const selectorSpy = vi.spyOn(selector, 'findEligibleQuestions');
    const aiSpy = vi.spyOn(mockAiProvider, 'generateQuestions');

    await seedStandardPool();
    const sessionId = await createTestSession();

    const bundle = await orchestrator.generateAndCommit(sessionId, {
      jobPosition: roleId,
      level: levelId,
      techStacks: [technologyId],
    });

    expect(bundle.questions.length).toBe(5);
    expect(bundle.diagnostics.effectiveMode).toBe('AI_ONLY');
    expect(selectorSpy).not.toHaveBeenCalled();
    expect(aiSpy).toHaveBeenCalledTimes(1);

    await assertExactFiveBundleInvariants(sessionId);

    // Verify all questions are AI_GENERATED
    const questions = await InterviewQuestionModel.find({ sessionId });
    for (const q of questions) {
      expect(q.sourceType).toBe('AI_GENERATED');
      expect(q.questionBankQuestionId).toBeNull();
    }
  });

  // =========================================================================
  // SCENARIO 2: AI_ONLY Mode
  // =========================================================================
  it('Scenario 2: AI_ONLY mode generates exact 5 AI questions, order 1..5, token usage recorded once', async () => {
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
    process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'AI_ONLY';

    const selectorSpy = vi.spyOn(selector, 'findEligibleQuestions');
    const aiSpy = vi.spyOn(mockAiProvider, 'generateQuestions');

    const sessionId = await createTestSession();

    const bundle = await orchestrator.generateAndCommit(sessionId, {
      jobPosition: roleId,
      level: levelId,
      techStacks: [technologyId],
    });

    expect(bundle.questions.length).toBe(5);
    expect(bundle.diagnostics.effectiveMode).toBe('AI_ONLY');
    expect(bundle.diagnostics.selectedFromAi).toBe(5);
    expect(bundle.diagnostics.selectedFromBank).toBe(0);
    expect(selectorSpy).not.toHaveBeenCalled();
    expect(aiSpy).toHaveBeenCalledTimes(1);

    await assertExactFiveBundleInvariants(sessionId);

    // Verify token usage recorded on session
    const session = await InterviewSessionModel.findById(sessionId);
    expect(session?.metadata?.totalTokens).toBe(100);
    expect(session?.metadata?.promptTokens).toBe(20);
    expect(session?.metadata?.candidatesTokens).toBe(80);
  });

  // =========================================================================
  // SCENARIO 3: SHADOW Mode
  // =========================================================================
  it('Scenario 3: SHADOW mode persists AI bundle, executes shadow selection with bounded timeout, does not fail candidate on shadow error', async () => {
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
    process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'SHADOW';
    process.env.INTERVIEW_QUESTION_BANK_SHADOW_TIMEOUT_MS = '500';

    await seedStandardPool();
    const sessionId = await createTestSession();

    // 3a. Normal shadow run
    const bundle = await orchestrator.generateAndCommit(sessionId, {
      jobPosition: roleId,
      level: levelId,
      techStacks: [technologyId],
    });

    expect(bundle.questions.length).toBe(5);
    expect(bundle.diagnostics.effectiveMode).toBe('SHADOW');
    expect(bundle.diagnostics.shadowDiagnostics).toBeDefined();
    expect(bundle.diagnostics.shadowDiagnostics?.success).toBe(true);

    // Persisted questions MUST all be AI
    const questions = await InterviewQuestionModel.find({ sessionId });
    for (const q of questions) {
      expect(q.sourceType).toBe('AI_GENERATED');
    }

    // 3b. Shadow throws exception -> Candidate generation still succeeds
    const errorSessionId = await createTestSession();
    vi.spyOn(selector, 'findEligibleQuestions').mockRejectedValueOnce(new Error('Shadow DB timeout'));

    const errorBundle = await orchestrator.generateAndCommit(errorSessionId, {
      jobPosition: roleId,
      level: levelId,
      techStacks: [technologyId],
    });

    expect(errorBundle.questions.length).toBe(5);
    expect(errorBundle.diagnostics.shadowDiagnostics?.success).toBe(false);
    expect(errorBundle.diagnostics.shadowDiagnostics?.insufficientReason).toContain('Shadow DB timeout');

    const errorSession = await InterviewSessionModel.findById(errorSessionId);
    expect(errorSession?.status).toBe('IN_PROGRESS');
    await assertExactFiveBundleInvariants(errorSessionId);
  });

  // =========================================================================
  // SCENARIO 4: BANK_ONLY Sufficient Pool
  // =========================================================================
  it('Scenario 4: BANK_ONLY sufficient pool selects exact 1 EASY, 2 MEDIUM, 2 HARD, no AI call, full provenance', async () => {
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
    process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'BANK_ONLY';

    const aiSpy = vi.spyOn(mockAiProvider, 'generateQuestions');
    await seedStandardPool();
    const sessionId = await createTestSession();

    const bundle = await orchestrator.generateAndCommit(sessionId, {
      jobPosition: roleId,
      level: levelId,
      techStacks: [technologyId],
    });

    expect(bundle.questions.length).toBe(5);
    expect(bundle.diagnostics.effectiveMode).toBe('BANK_ONLY');
    expect(bundle.diagnostics.selectedFromBank).toBe(5);
    expect(bundle.diagnostics.selectedFromAi).toBe(0);
    expect(aiSpy).not.toHaveBeenCalled();

    await assertExactFiveBundleInvariants(sessionId);

    // Verify quota distribution: 1 Easy, 2 Medium, 2 Hard
    const easy = bundle.questions.filter((q) => q.difficulty === 'EASY');
    const medium = bundle.questions.filter((q) => q.difficulty === 'MEDIUM');
    const hard = bundle.questions.filter((q) => q.difficulty === 'HARD');
    expect(easy.length).toBe(1);
    expect(medium.length).toBe(2);
    expect(hard.length).toBe(2);

    // Provenance in DB
    const dbQuestions = await InterviewQuestionModel.find({ sessionId });
    for (const q of dbQuestions) {
      expect(q.sourceType).toBe('QUESTION_BANK');
      expect(q.questionBankQuestionId).toBeDefined();
      expect(q.questionBankVersionId).toBeDefined();
      expect(q.selectionPolicyVersion).toBe('v1');
      expect(q.selectionSeedFingerprint).toBeDefined();
      expect(q.promptSnapshotHash).toBeDefined();
    }

    // Zero AI tokens recorded for Bank-only
    const session = await InterviewSessionModel.findById(sessionId);
    expect(session?.metadata?.totalTokens || 0).toBe(0);
  });

  // =========================================================================
  // SCENARIO 5: BANK_ONLY Insufficient Pool
  // =========================================================================
  it('Scenario 5: BANK_ONLY insufficient pool fails controlled, 0 questions saved, status FAILED', async () => {
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
    process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'BANK_ONLY';

    // Seed pool with only 1 EASY, 1 MEDIUM (missing 1 MEDIUM and 2 HARD)
    await seedQuestion('QB-2026-000001', 'EASY');
    await seedQuestion('QB-2026-000002', 'MEDIUM');

    const sessionId = await createTestSession();

    await expect(
      orchestrator.generateAndCommit(sessionId, {
        jobPosition: roleId,
        level: levelId,
        techStacks: [technologyId],
      })
    ).rejects.toThrow(/Không đủ câu hỏi hợp lệ trong ngân hàng câu hỏi/);

    // Invariant: 0 questions persisted
    const questionsCount = await InterviewQuestionModel.countDocuments({ sessionId });
    expect(questionsCount).toBe(0);

    // Session status transitioned to FAILED, not left in fake success
    const session = await InterviewSessionModel.findById(sessionId);
    expect(session?.status).toBe('FAILED');
  });

  // =========================================================================
  // SCENARIO 6: HYBRID Sufficient Pool
  // =========================================================================
  it('Scenario 6: HYBRID sufficient pool selects configured bank count, exact 5 total, deduplicates across sources', async () => {
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
    process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'HYBRID';
    process.env.INTERVIEW_QUESTION_BANK_HYBRID_BANK_COUNT = '2';

    // Fresh orchestrator to pick up env
    const eventBus = new InterviewEventBus();
    orchestrator = new InterviewQuestionGenerationOrchestrator(
      repo,
      mockAiProvider,
      selector,
      eventBus
    );

    await seedStandardPool();
    const sessionId = await createTestSession();

    const bundle = await orchestrator.generateAndCommit(sessionId, {
      jobPosition: roleId,
      level: levelId,
      techStacks: [technologyId],
    });

    expect(bundle.questions.length).toBe(5);
    expect(bundle.diagnostics.effectiveMode).toBe('HYBRID');
    expect(bundle.diagnostics.selectedFromBank).toBe(2);
    expect(bundle.diagnostics.selectedFromAi).toBe(3);

    await assertExactFiveBundleInvariants(sessionId);

    // First 2 from Bank, next 3 from AI
    const dbQuestions = await InterviewQuestionModel.find({ sessionId }).sort({ order: 1 });
    expect(dbQuestions[0].sourceType).toBe('QUESTION_BANK');
    expect(dbQuestions[1].sourceType).toBe('QUESTION_BANK');
    expect(dbQuestions[2].sourceType).toBe('AI_GENERATED');
    expect(dbQuestions[3].sourceType).toBe('AI_GENERATED');
    expect(dbQuestions[4].sourceType).toBe('AI_GENERATED');
  });

  // =========================================================================
  // SCENARIO 7: HYBRID Insufficient Pool, Fallback Enabled (Default)
  // =========================================================================
  it('Scenario 7: HYBRID insufficient pool with fallback enabled tops up with AI, total exact 5, records fallback code', async () => {
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
    process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'HYBRID';
    process.env.INTERVIEW_QUESTION_BANK_ALLOW_FALLBACK_TO_AI = 'true';

    const eventBus = new InterviewEventBus();
    orchestrator = new InterviewQuestionGenerationOrchestrator(
      repo,
      mockAiProvider,
      selector,
      eventBus
    );

    // Empty Question Bank pool -> triggers fallback
    const sessionId = await createTestSession();

    const bundle = await orchestrator.generateAndCommit(sessionId, {
      jobPosition: roleId,
      level: levelId,
      techStacks: [technologyId],
    });

    expect(bundle.questions.length).toBe(5);
    expect(bundle.diagnostics.effectiveMode).toBe('HYBRID');
    expect(bundle.diagnostics.selectedFromBank).toBe(0);
    expect(bundle.diagnostics.selectedFromAi).toBe(5);
    expect(bundle.diagnostics.fallbackReasonCode).toBe(INTERVIEW_SOURCE_ERROR_CODES.POOL_INSUFFICIENT);

    await assertExactFiveBundleInvariants(sessionId);

    const session = await InterviewSessionModel.findById(sessionId);
    expect(session?.status).toBe('IN_PROGRESS');
  });

  // =========================================================================
  // SCENARIO 8: HYBRID Insufficient Pool, Fallback Disabled -> Fail-Closed
  // =========================================================================
  it('Scenario 8: HYBRID insufficient pool with fallback disabled fails closed, saves 0 questions, status FAILED', async () => {
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
    process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'HYBRID';
    process.env.INTERVIEW_QUESTION_BANK_ALLOW_FALLBACK_TO_AI = 'false';

    const eventBus = new InterviewEventBus();
    orchestrator = new InterviewQuestionGenerationOrchestrator(
      repo,
      mockAiProvider,
      selector,
      eventBus
    );

    // Empty Question Bank pool
    const sessionId = await createTestSession();

    await expect(
      orchestrator.generateAndCommit(sessionId, {
        jobPosition: roleId,
        level: levelId,
        techStacks: [technologyId],
      })
    ).rejects.toThrow();

    // Invariant: Fail-closed -> 0 questions persisted
    const count = await InterviewQuestionModel.countDocuments({ sessionId });
    expect(count).toBe(0);

    const session = await InterviewSessionModel.findById(sessionId);
    expect(session?.status).toBe('FAILED');
  });
});
