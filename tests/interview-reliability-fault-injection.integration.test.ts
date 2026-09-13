import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'reliability_fault_injection_access_secret_123';
  process.env.JWT_REFRESH_SECRET = 'reliability_fault_injection_refresh_secret_456';
  process.env.PASSWORD_RESET_SECRET = 'reliability_fault_injection_reset_secret_789';
  process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
  process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'BANK_ONLY';
  process.env.INTERVIEW_QUESTION_BANK_POLICY_VERSION = 'v1';
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

describe('AIP-67 Scope B: Concurrency, Retry & Fault Injection Integration Tests', () => {
  let replicaSet: MongoMemoryReplSet;
  let repo: MongoInterviewRepository;
  let selector: QuestionBankSelector;
  let orchestrator: InterviewQuestionGenerationOrchestrator;
  let mockAiProvider: MockAiProvider;
  let eventBus: InterviewEventBus;
  let roleId: string;
  let levelId: string;
  let technologyId: string;
  let adminId: string;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    await mongoose.connect(replicaSet.getUri(), {
      dbName: 'reliability_fault_injection_db',
    });
    adminId = new Types.ObjectId().toString();

    // Ensure indexes are built for unique constraint testing
    await InterviewQuestionModel.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replicaSet.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await InterviewQuestionModel.init();

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

    repo = new MongoInterviewRepository();
    selector = new QuestionBankSelector({
      findEligiblePublishedForSelection: async (filter: any) => {
        const query: any = { status: 'PUBLISHED' };
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
    vi.spyOn(mockAiProvider, 'generateQuestions').mockImplementation(async () => ({
      data: [
        { order: 1, difficulty: 'Easy', content: { vi: 'Câu hỏi AI 1', en: 'AI Question 1' } },
        { order: 2, difficulty: 'Medium', content: { vi: 'Câu hỏi AI 2', en: 'AI Question 2' } },
        { order: 3, difficulty: 'Medium', content: { vi: 'Câu hỏi AI 3', en: 'AI Question 3' } },
        { order: 4, difficulty: 'Hard', content: { vi: 'Câu hỏi AI 4', en: 'AI Question 4' } },
        { order: 5, difficulty: 'Hard', content: { vi: 'Câu hỏi AI 5', en: 'AI Question 5' } },
      ],
      audit: { promptTokenCount: 20, candidatesTokenCount: 80, totalTokenCount: 100 },
    }));

    eventBus = new InterviewEventBus();
    orchestrator = new InterviewQuestionGenerationOrchestrator(
      repo,
      mockAiProvider,
      selector,
      eventBus
    );
  });

  const seedQuestion = async (
    codeNum: number,
    difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM',
    lifecycleStatus: 'ACTIVE' | 'RETIRED' = 'ACTIVE',
    versionStatus: 'PUBLISHED' | 'DRAFT' | 'SUPERSEDED' = 'PUBLISHED'
  ) => {
    const questionId = new Types.ObjectId();
    const versionId = new Types.ObjectId();
    const adminOid = new Types.ObjectId(adminId);
    const code = `QB-2026-${String(codeNum).padStart(6, '0')}`;

    const prompt = {
      vi: `Nội dung ngân hàng ${code}`,
      en: `Bank question content ${code}`,
    };

    await QuestionVersion.create({
      _id: versionId,
      questionId,
      versionNumber: 1,
      status: versionStatus,
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
      topic: 'Reliability Topic',
      tags: ['reliability'],
      referenceAnswer: { vi: 'Đáp án', en: 'Answer' },
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
      currentPublishedVersionId: versionStatus === 'PUBLISHED' ? versionId : null,
      draftVersionId: versionStatus === 'DRAFT' ? versionId : null,
      latestVersionNumber: 1,
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
      publishedAt: versionStatus === 'PUBLISHED' ? new Date() : null,
    });

    return { questionId: questionId.toString(), versionId: versionId.toString() };
  };

  const seedStandardPool = async () => {
    await seedQuestion(1, 'EASY');
    await seedQuestion(2, 'MEDIUM');
    await seedQuestion(3, 'MEDIUM');
    await seedQuestion(4, 'HARD');
    await seedQuestion(5, 'HARD');
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

  // =========================================================================
  // 1. UNIQUE INDEX VERIFICATION
  // =========================================================================
  it('verifies unique index {sessionId: 1, order: 1} exists with exact name interview_questions_session_order_unique', async () => {
    const indexes = await InterviewQuestionModel.collection.indexes();
    const sessionOrderIndex = indexes.find(
      (idx) => idx.name === 'interview_questions_session_order_unique'
    );

    expect(sessionOrderIndex).toBeDefined();
    expect(sessionOrderIndex?.unique).toBe(true);
    expect(sessionOrderIndex?.key).toEqual({ sessionId: 1, order: 1 });
  });

  // =========================================================================
  // 2. CONCURRENT WORKERS RACE & CAS
  // =========================================================================
  it('two concurrent workers racing on same session: exactly one commits, exactly 5 questions saved', async () => {
    await seedStandardPool();
    const sessionId = await createTestSession();

    const worker1 = orchestrator.generateAndCommit(sessionId, {
      jobPosition: roleId,
      level: levelId,
      techStacks: [technologyId],
    });

    const worker2 = orchestrator.generateAndCommit(sessionId, {
      jobPosition: roleId,
      level: levelId,
      techStacks: [technologyId],
    });

    const results = await Promise.allSettled([worker1, worker2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    // Exact-five invariant
    const count = await InterviewQuestionModel.countDocuments({ sessionId });
    expect(count).toBe(5);

    const session = await InterviewSessionModel.findById(sessionId);
    expect(session?.status).toBe('IN_PROGRESS');
  });

  // =========================================================================
  // 3. DUPLICATE DELIVERY & RETRY IDEMPOTENCY
  // =========================================================================
  it('duplicate delivery after successful commit returns IDEMPOTENT_NOOP, no double token increment', async () => {
    await seedStandardPool();
    const sessionId = await createTestSession();

    // First delivery
    const firstBundle = await orchestrator.generateAndCommit(sessionId, {
      jobPosition: roleId,
      level: levelId,
      techStacks: [technologyId],
    });
    expect(firstBundle.questions.length).toBe(5);

    const sessionAfterFirst = await InterviewSessionModel.findById(sessionId);
    const tokensAfterFirst = sessionAfterFirst?.metadata?.totalTokens || 0;

    // Second delivery (duplicate job event)
    const secondBundle = await orchestrator.generateAndCommit(sessionId, {
      jobPosition: roleId,
      level: levelId,
      techStacks: [technologyId],
    });

    expect(secondBundle.questions.length).toBe(5);
    expect(secondBundle.diagnostics.successCode).toBe('IDEMPOTENT_NOOP');

    // Token usage MUST NOT increment twice
    const sessionAfterSecond = await InterviewSessionModel.findById(sessionId);
    expect(sessionAfterSecond?.metadata?.totalTokens || 0).toBe(tokensAfterFirst);

    // Total questions remain exactly 5
    const totalQuestions = await InterviewQuestionModel.countDocuments({ sessionId });
    expect(totalQuestions).toBe(5);
  });

  // =========================================================================
  // 4. RETRY AFTER EVENT PUBLISH FAILURE PRESERVES COMMITTED BUNDLE
  // =========================================================================
  it('retry after bundle committed but event publish fails preserves committed bundle', async () => {
    await seedStandardPool();
    const sessionId = await createTestSession();

    // Event publisher throws on first publish
    vi.spyOn(eventBus, 'publish').mockImplementationOnce(() => {
      throw new Error('Kafka/Redis EventBus connection lost');
    });

    // Worker commits bundle, but event publishing throws
    await expect(
      orchestrator.generateAndCommit(sessionId, {
        jobPosition: roleId,
        level: levelId,
        techStacks: [technologyId],
      })
    ).rejects.toThrow('Kafka/Redis EventBus connection lost');

    // Bundle is ALREADY committed in DB (atomicity achieved before event)
    const countAfterCrash = await InterviewQuestionModel.countDocuments({ sessionId });
    expect(countAfterCrash).toBe(5);

    // Retry job arrives
    const retryBundle = await orchestrator.generateAndCommit(sessionId, {
      jobPosition: roleId,
      level: levelId,
      techStacks: [technologyId],
    });

    expect(retryBundle.questions.length).toBe(5);
    expect(retryBundle.diagnostics.successCode).toBe('IDEMPOTENT_NOOP');

    const totalCount = await InterviewQuestionModel.countDocuments({ sessionId });
    expect(totalCount).toBe(5);
  });

  // =========================================================================
  // 5. 10-ITERATION DETERMINISTIC CONCURRENCY STRESS
  // =========================================================================
  it('10-iteration deterministic concurrency stress test on parallel sessions', async () => {
    await seedStandardPool();
    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
      const sessionId = await createTestSession();

      // Launch 3 racing workers per session
      const p1 = orchestrator.generateAndCommit(sessionId, {
        jobPosition: roleId,
        level: levelId,
        techStacks: [technologyId],
      });
      const p2 = orchestrator.generateAndCommit(sessionId, {
        jobPosition: roleId,
        level: levelId,
        techStacks: [technologyId],
      });
      const p3 = orchestrator.generateAndCommit(sessionId, {
        jobPosition: roleId,
        level: levelId,
        techStacks: [technologyId],
      });

      await Promise.allSettled([p1, p2, p3]);

      const count = await InterviewQuestionModel.countDocuments({ sessionId });
      expect(count, `Iteration ${i + 1} must persist exactly 5 questions`).toBe(5);

      const session = await InterviewSessionModel.findById(sessionId);
      expect(session?.status).toBe('IN_PROGRESS');
    }
  });

  // =========================================================================
  // 6. LEGACY STATE PROTECTION (1-4 AND >5 QUESTIONS)
  // =========================================================================
  it('legacy state with 1-4 questions halts with INCONSISTENT_STATE and does NOT delete existing rows', async () => {
    const sessionId = await createTestSession();

    // Create 3 legacy partial questions
    for (let i = 1; i <= 3; i++) {
      await InterviewQuestionModel.create({
        sessionId: new Types.ObjectId(sessionId),
        order: i,
        difficulty: 'MEDIUM',
        content: { vi: `Legacy Q${i}`, en: `Legacy Q${i}` },
        sourceType: 'AI_GENERATED',
      });
    }

    await expect(
      orchestrator.generateAndCommit(sessionId, {
        jobPosition: roleId,
        level: levelId,
        techStacks: [technologyId],
      })
    ).rejects.toThrow(/trạng thái câu hỏi không nhất quán/);

    // Fail-safe invariant: legacy 3 questions remain intact, not wiped
    const count = await InterviewQuestionModel.countDocuments({ sessionId });
    expect(count).toBe(3);
  });

  it('legacy state with >5 questions halts with INCONSISTENT_STATE and does NOT delete or alter data', async () => {
    const sessionId = await createTestSession();

    // Create 6 questions
    for (let i = 1; i <= 6; i++) {
      await InterviewQuestionModel.create({
        sessionId: new Types.ObjectId(sessionId),
        order: i,
        difficulty: 'MEDIUM',
        content: { vi: `Legacy Q${i}`, en: `Legacy Q${i}` },
        sourceType: 'AI_GENERATED',
      });
    }

    await expect(
      orchestrator.generateAndCommit(sessionId, {
        jobPosition: roleId,
        level: levelId,
        techStacks: [technologyId],
      })
    ).rejects.toThrow(/trạng thái câu hỏi không nhất quán/);

    // Legacy 6 questions remain intact
    const count = await InterviewQuestionModel.countDocuments({ sessionId });
    expect(count).toBe(6);
  });

  // =========================================================================
  // 7. FAULT INJECTION - AI PROVIDER
  // =========================================================================
  describe('Fault Injection - AI Provider', () => {
    beforeEach(() => {
      process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'AI_ONLY';
    });

    it('AI provider throws exception -> generation fails, 0 questions committed, status FAILED', async () => {
      vi.spyOn(mockAiProvider, 'generateQuestions').mockRejectedValueOnce(new Error('AI Service 503 Unavailable'));
      const sessionId = await createTestSession();

      await expect(
        orchestrator.generateAndCommit(sessionId, {
          jobPosition: roleId,
          level: levelId,
          techStacks: [technologyId],
        })
      ).rejects.toThrow('AI Service 503 Unavailable');

      expect(await InterviewQuestionModel.countDocuments({ sessionId })).toBe(0);
      const session = await InterviewSessionModel.findById(sessionId);
      expect(session?.status).toBe('FAILED');
    });

    it('AI provider returns malformed count (4 questions) -> validator rejects with BUNDLE_INVALID, 0 committed', async () => {
      vi.spyOn(mockAiProvider, 'generateQuestions').mockResolvedValueOnce({
        data: [
          { order: 1, difficulty: 'Easy', content: { vi: 'Q1', en: 'Q1' } },
          { order: 2, difficulty: 'Medium', content: { vi: 'Q2', en: 'Q2' } },
          { order: 3, difficulty: 'Medium', content: { vi: 'Q3', en: 'Q3' } },
          { order: 4, difficulty: 'Hard', content: { vi: 'Q4', en: 'Q4' } },
        ],
        audit: { promptTokenCount: 10, candidatesTokenCount: 50, totalTokenCount: 60 },
      });

      const sessionId = await createTestSession();

      await expect(
        orchestrator.generateAndCommit(sessionId, {
          jobPosition: roleId,
          level: levelId,
          techStacks: [technologyId],
        })
      ).rejects.toThrow(/chính xác 5 câu hỏi/);

      expect(await InterviewQuestionModel.countDocuments({ sessionId })).toBe(0);
      const session = await InterviewSessionModel.findById(sessionId);
      expect(session?.status).toBe('FAILED');
    });

    it('AI provider returns duplicate order -> validator rejects with BUNDLE_INVALID, 0 committed', async () => {
      vi.spyOn(mockAiProvider, 'generateQuestions').mockResolvedValueOnce({
        data: [
          { order: 1, difficulty: 'Easy', content: { vi: 'Q1', en: 'Q1' } },
          { order: 2, difficulty: 'Medium', content: { vi: 'Q2', en: 'Q2' } },
          { order: 2, difficulty: 'Medium', content: { vi: 'Q3', en: 'Q3' } }, // Duplicate order 2
          { order: 4, difficulty: 'Hard', content: { vi: 'Q4', en: 'Q4' } },
          { order: 5, difficulty: 'Hard', content: { vi: 'Q5', en: 'Q5' } },
        ],
        audit: { promptTokenCount: 10, candidatesTokenCount: 50, totalTokenCount: 60 },
      });

      const sessionId = await createTestSession();

      await expect(
        orchestrator.generateAndCommit(sessionId, {
          jobPosition: roleId,
          level: levelId,
          techStacks: [technologyId],
        })
      ).rejects.toThrow(/Thứ tự câu hỏi trong bundle phải liên tục/);

      expect(await InterviewQuestionModel.countDocuments({ sessionId })).toBe(0);
    });

    it('AI provider returns missing bilingual content (empty vi) -> validator rejects, 0 committed', async () => {
      vi.spyOn(mockAiProvider, 'generateQuestions').mockResolvedValueOnce({
        data: [
          { order: 1, difficulty: 'Easy', content: { vi: '', en: 'Q1' } },
          { order: 2, difficulty: 'Medium', content: { vi: 'Q2', en: 'Q2' } },
          { order: 3, difficulty: 'Medium', content: { vi: 'Q3', en: 'Q3' } },
          { order: 4, difficulty: 'Hard', content: { vi: 'Q4', en: 'Q4' } },
          { order: 5, difficulty: 'Hard', content: { vi: 'Q5', en: 'Q5' } },
        ],
        audit: { promptTokenCount: 10, candidatesTokenCount: 50, totalTokenCount: 60 },
      });

      const sessionId = await createTestSession();

      await expect(
        orchestrator.generateAndCommit(sessionId, {
          jobPosition: roleId,
          level: levelId,
          techStacks: [technologyId],
        })
      ).rejects.toThrow(/thiếu nội dung tiếng Việt hoặc tiếng Anh/);

      expect(await InterviewQuestionModel.countDocuments({ sessionId })).toBe(0);
    });

    it('AI provider returns duplicate prompt content -> validator rejects, 0 committed', async () => {
      vi.spyOn(mockAiProvider, 'generateQuestions').mockResolvedValueOnce({
        data: [
          { order: 1, difficulty: 'Easy', content: { vi: 'Same Content', en: 'Same Content' } },
          { order: 2, difficulty: 'Medium', content: { vi: 'Same Content', en: 'Same Content' } },
          { order: 3, difficulty: 'Medium', content: { vi: 'Q3', en: 'Q3' } },
          { order: 4, difficulty: 'Hard', content: { vi: 'Q4', en: 'Q4' } },
          { order: 5, difficulty: 'Hard', content: { vi: 'Q5', en: 'Q5' } },
        ],
        audit: { promptTokenCount: 10, candidatesTokenCount: 50, totalTokenCount: 60 },
      });

      const sessionId = await createTestSession();

      await expect(
        orchestrator.generateAndCommit(sessionId, {
          jobPosition: roleId,
          level: levelId,
          techStacks: [technologyId],
        })
      ).rejects.toThrow(/Phát hiện câu hỏi trùng lặp nội dung/);

      expect(await InterviewQuestionModel.countDocuments({ sessionId })).toBe(0);
    });
  });

  // =========================================================================
  // 8. FAULT INJECTION - QUESTION BANK
  // =========================================================================
  describe('Fault Injection - Question Bank', () => {
    beforeEach(() => {
      process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'BANK_ONLY';
    });

    it('Question Bank selector repository throws -> BANK_ONLY fails gracefully, 0 committed', async () => {
      vi.spyOn(selector, 'findEligibleQuestions').mockRejectedValueOnce(new Error('Mongo connection refused'));
      const sessionId = await createTestSession();

      await expect(
        orchestrator.generateAndCommit(sessionId, {
          jobPosition: roleId,
          level: levelId,
          techStacks: [technologyId],
        })
      ).rejects.toThrow('Mongo connection refused');

      expect(await InterviewQuestionModel.countDocuments({ sessionId })).toBe(0);
      const session = await InterviewSessionModel.findById(sessionId);
      expect(session?.status).toBe('FAILED');
    });

    it('Question Bank contains only RETIRED questions -> excluded from pool, throws POOL_INSUFFICIENT', async () => {
      await seedQuestion(1, 'EASY', 'RETIRED');
      await seedQuestion(2, 'MEDIUM', 'RETIRED');
      await seedQuestion(3, 'MEDIUM', 'RETIRED');
      await seedQuestion(4, 'HARD', 'RETIRED');
      await seedQuestion(5, 'HARD', 'RETIRED');

      const sessionId = await createTestSession();

      await expect(
        orchestrator.generateAndCommit(sessionId, {
          jobPosition: roleId,
          level: levelId,
          techStacks: [technologyId],
        })
      ).rejects.toThrow(/Không đủ câu hỏi hợp lệ/);

      expect(await InterviewQuestionModel.countDocuments({ sessionId })).toBe(0);
    });

    it('Question Bank contains only DRAFT-only questions -> excluded from pool, throws POOL_INSUFFICIENT', async () => {
      await seedQuestion(1, 'EASY', 'ACTIVE', 'DRAFT');
      await seedQuestion(2, 'MEDIUM', 'ACTIVE', 'DRAFT');
      await seedQuestion(3, 'MEDIUM', 'ACTIVE', 'DRAFT');
      await seedQuestion(4, 'HARD', 'ACTIVE', 'DRAFT');
      await seedQuestion(5, 'HARD', 'ACTIVE', 'DRAFT');

      const sessionId = await createTestSession();

      await expect(
        orchestrator.generateAndCommit(sessionId, {
          jobPosition: roleId,
          level: levelId,
          techStacks: [technologyId],
        })
      ).rejects.toThrow(/Không đủ câu hỏi hợp lệ/);

      expect(await InterviewQuestionModel.countDocuments({ sessionId })).toBe(0);
    });

    it('Question Bank version is SUPERSEDED -> excluded from pool', async () => {
      await seedQuestion(1, 'EASY', 'ACTIVE', 'SUPERSEDED');
      await seedQuestion(2, 'MEDIUM', 'ACTIVE', 'SUPERSEDED');
      await seedQuestion(3, 'MEDIUM', 'ACTIVE', 'SUPERSEDED');
      await seedQuestion(4, 'HARD', 'ACTIVE', 'SUPERSEDED');
      await seedQuestion(5, 'HARD', 'ACTIVE', 'SUPERSEDED');

      const sessionId = await createTestSession();

      await expect(
        orchestrator.generateAndCommit(sessionId, {
          jobPosition: roleId,
          level: levelId,
          techStacks: [technologyId],
        })
      ).rejects.toThrow(/Không đủ câu hỏi hợp lệ/);

      expect(await InterviewQuestionModel.countDocuments({ sessionId })).toBe(0);
    });
  });
});
