import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { container } from 'tsyringe';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'interview_concurrency_access_secret_32_chars';
  process.env.JWT_REFRESH_SECRET = 'interview_concurrency_refresh_secret_32_chars';
  process.env.PASSWORD_RESET_SECRET = 'interview_concurrency_reset_secret_32_chars';
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

describe('AIP-66 Interview Generation - Concurrency, Persistence & Idempotency', () => {
  let replicaSet: MongoMemoryReplSet;
  let repo: MongoInterviewRepository;
  let orchestrator: InterviewQuestionGenerationOrchestrator;
  let roleId: string;
  let levelId: string;
  let technologyId: string;
  let adminId: string;

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
      vi: `Nội dung tiếng Việt ${code}`,
      en: `English content ${code}`,
    };

    const versionDoc = {
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
      topic: 'Concurrency Topic',
      tags: ['concurrency'],
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
    };

    await Question.create({
      _id: questionId,
      code,
      lifecycleStatus,
      currentPublishedVersionId: versionId,
      draftVersionId: null,
      latestVersionNumber: versionNumber,
      ownerId: adminOid,
      revision: 1,
      createdBy: adminOid,
      updatedBy: adminOid,
    });

    await QuestionVersion.create({
      _id: versionId,
      questionId,
      versionNumber,
      status: 'PUBLISHED',
      revision: 1,
      ...versionDoc,
    });

    return { questionId, versionId };
  };

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replicaSet.getUri(), {
      dbName: 'interview_concurrency_test_' + Date.now(),
    });

    await Promise.all([
      InterviewSessionModel.init(),
      InterviewQuestionModel.init(),
      Question.init(),
      QuestionVersion.init(),
      Role.init(),
      Level.init(),
      Technology.init(),
    ]);

    adminId = new Types.ObjectId().toString();

    // Seed taxonomy
    const r = await Role.create({ code: 'BACKEND', name: 'Backend Engineer', description: 'Backend', isActive: true });
    roleId = r._id.toString();

    const l = await Level.create({ code: 'MID', name: 'Middle', description: 'Mid level', isActive: true });
    levelId = l._id.toString();

    const t = await Technology.create({ code: 'NODEJS', name: 'Node.js', description: 'Node runtime', isActive: true });
    technologyId = t._id.toString();

    const { QuestionRepository } = await import('../src/repositories/question.repository');
    const questionRepo = new QuestionRepository();
    repo = new MongoInterviewRepository();
    const selector = new QuestionBankSelector(questionRepo);
    const aiProvider = new MockAiProvider();
    const eventPublisher = new InterviewEventBus();

    orchestrator = new InterviewQuestionGenerationOrchestrator(
      repo,
      aiProvider,
      selector,
      eventPublisher
    );
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await replicaSet.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      InterviewSessionModel.deleteMany({}),
      InterviewQuestionModel.deleteMany({}),
      Question.deleteMany({}),
      QuestionVersion.deleteMany({}),
    ]);
  });

  describe('Named Unique Index Invariant', () => {
    it('enforces unique compound index on { sessionId, order }', async () => {
      const sessionId = new Types.ObjectId();
      await InterviewQuestionModel.create({
        sessionId,
        order: 1,
        difficulty: 'EASY',
        content: { vi: 'Câu 1', en: 'Q1' },
      });

      // Inserting second document with same sessionId and order 1 must fail
      await expect(
        InterviewQuestionModel.create({
          sessionId,
          order: 1,
          difficulty: 'MEDIUM',
          content: { vi: 'Câu 1 khác', en: 'Q1 different' },
        })
      ).rejects.toThrow();
    });
  });

  describe('Concurrent Job Delivery - Repeated 10x Test', () => {
    it('reliably handles concurrent generation workers without double insertion or state race (10 iterations)', async () => {
      // Seed enough questions: 2 Easy, 3 Medium, 3 Hard
      await seedQuestion('QB-2026-000001', 'EASY');
      await seedQuestion('QB-2026-000002', 'EASY');
      await seedQuestion('QB-2026-000003', 'MEDIUM');
      await seedQuestion('QB-2026-000004', 'MEDIUM');
      await seedQuestion('QB-2026-000005', 'MEDIUM');
      await seedQuestion('QB-2026-000006', 'HARD');
      await seedQuestion('QB-2026-000007', 'HARD');
      await seedQuestion('QB-2026-000008', 'HARD');

      for (let iteration = 0; iteration < 10; iteration++) {
        const session = await InterviewSessionModel.create({
          userId: `user_${iteration}`,
          status: 'GENERATING',
          setupData: {
            jobPosition: roleId,
            level: levelId,
            techStacks: [technologyId],
          },
          metadata: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
        });
        const sessionId = session._id.toString();

        // Launch 2 parallel generate workers for the same sessionId
        const [res1, res2] = await Promise.allSettled([
          orchestrator.generateAndCommit(sessionId, session.setupData),
          orchestrator.generateAndCommit(sessionId, session.setupData),
        ]);

        // Both workers must settle cleanly (at least one fulfilled, and if both fulfilled, exactly 5 questions exist)
        expect(res1.status === 'fulfilled' || res2.status === 'fulfilled').toBe(true);

        const storedQuestions = await InterviewQuestionModel.find({ sessionId }).sort({ order: 1 });
        expect(storedQuestions).toHaveLength(5);

        const orders = storedQuestions.map((q) => q.order);
        expect(orders).toEqual([1, 2, 3, 4, 5]);

        const updatedSession = await InterviewSessionModel.findById(sessionId);
        expect(updatedSession?.status).toBe('IN_PROGRESS');
      }
    });
  });

  describe('Duplicate Delivery and Idempotency', () => {
    it('calling generateAndCommit on an already committed session is an idempotent no-op', async () => {
      await seedQuestion('QB-2026-000011', 'EASY');
      await seedQuestion('QB-2026-000012', 'MEDIUM');
      await seedQuestion('QB-2026-000013', 'MEDIUM');
      await seedQuestion('QB-2026-000014', 'HARD');
      await seedQuestion('QB-2026-000015', 'HARD');

      const session = await InterviewSessionModel.create({
        status: 'GENERATING',
        setupData: { jobPosition: roleId, level: levelId, techStacks: [technologyId] },
      });
      const sessionId = session._id.toString();

      // First run: commit
      const firstResult = await orchestrator.generateAndCommit(sessionId, session.setupData);
      expect(firstResult.questions).toHaveLength(5);

      const countAfterFirst = await InterviewQuestionModel.countDocuments({ sessionId });
      expect(countAfterFirst).toBe(5);

      // Second run: duplicate delivery
      const secondResult = await orchestrator.generateAndCommit(sessionId, session.setupData);
      expect(secondResult.diagnostics.successCode).toBe('IDEMPOTENT_NOOP');

      const countAfterSecond = await InterviewQuestionModel.countDocuments({ sessionId });
      expect(countAfterSecond).toBe(5);

      const finalSession = await InterviewSessionModel.findById(sessionId);
      expect(finalSession?.status).toBe('IN_PROGRESS');
      // Token usage did not double
      expect(finalSession?.metadata?.totalTokens).toBe(0);
    });
  });

  describe('Legacy Inconsistent Partial State Protection', () => {
    it('aborts safely with INCONSISTENT_STATE when session already has 1-4 questions, preserving them untouched', async () => {
      const session = await InterviewSessionModel.create({
        status: 'GENERATING',
        setupData: { jobPosition: roleId, level: levelId, techStacks: [technologyId] },
      });
      const sessionId = session._id.toString();

      // Insert 2 partial legacy questions
      await InterviewQuestionModel.create([
        {
          sessionId: session._id,
          order: 1,
          difficulty: 'EASY',
          content: { vi: 'Legacy 1', en: 'Legacy 1 EN' },
        },
        {
          sessionId: session._id,
          order: 2,
          difficulty: 'MEDIUM',
          content: { vi: 'Legacy 2', en: 'Legacy 2 EN' },
        },
      ]);

      await expect(
        orchestrator.generateAndCommit(sessionId, session.setupData)
      ).rejects.toMatchObject({
        code: INTERVIEW_SOURCE_ERROR_CODES.INCONSISTENT_STATE,
      });

      // Verify legacy questions were NOT deleted or overwritten
      const remaining = await InterviewQuestionModel.find({ sessionId });
      expect(remaining).toHaveLength(2);
      expect(remaining.map((r) => r.content.vi)).toEqual(['Legacy 1', 'Legacy 2']);
    });
  });

  describe('Standalone fallback compensation', () => {
    it('rolls back token counters when question persistence fails', async () => {
      const session = await InterviewSessionModel.create({
        status: 'GENERATING',
        setupData: {
          jobPosition: roleId,
          level: levelId,
          techStacks: [technologyId],
        },
        metadata: {
          promptTokens: 7,
          candidatesTokens: 11,
          totalTokens: 18,
        },
      });
      const insertSpy = vi
        .spyOn(InterviewQuestionModel, 'insertMany')
        .mockRejectedValueOnce(new Error('forced standalone insert failure'));

      try {
        await expect(
          (repo as any).commitBundleStandaloneFallback(session.id, {
            sessionId: session.id,
            questions: [],
            audit: {
              promptTokenCount: 3,
              candidatesTokenCount: 5,
              totalTokenCount: 8,
            },
            diagnostics: {
              effectiveMode: 'BANK_ONLY',
              policyVersion: 'v1',
              selectedFromBank: 5,
              selectedFromAi: 0,
              durationMs: 1,
              successCode: 'SUCCESS',
            },
          })
        ).rejects.toThrow('forced standalone insert failure');
      } finally {
        insertSpy.mockRestore();
      }

      const persistedSession = await InterviewSessionModel.findById(session.id);
      expect(persistedSession?.status).toBe('FAILED');
      expect(persistedSession?.metadata).toMatchObject({
        promptTokens: 7,
        candidatesTokens: 11,
        totalTokens: 18,
      });
      expect(
        await InterviewQuestionModel.countDocuments({ sessionId: session.id })
      ).toBe(0);
    });
  });

  describe('Immutable Snapshot Invariant on Publish / Retire', () => {
    it('subsequent version publishing does not mutate existing interview prompt snapshot', async () => {
      const { questionId, versionId } = await seedQuestion('QB-2026-000021', 'EASY');
      await seedQuestion('QB-2026-000022', 'MEDIUM');
      await seedQuestion('QB-2026-000023', 'MEDIUM');
      await seedQuestion('QB-2026-000024', 'HARD');
      await seedQuestion('QB-2026-000025', 'HARD');

      const session = await InterviewSessionModel.create({
        status: 'GENERATING',
        setupData: { jobPosition: roleId, level: levelId, techStacks: [technologyId] },
      });
      const sessionId = session._id.toString();

      await orchestrator.generateAndCommit(sessionId, session.setupData);

      const beforeQuestion = await InterviewQuestionModel.findOne({
        sessionId,
        questionBankQuestionId: questionId,
      });
      expect(beforeQuestion).not.toBeNull();
      const originalPrompt = beforeQuestion?.content.vi;
      const originalVersionId = beforeQuestion?.questionBankVersionId?.toString();
      expect(originalVersionId).toBe(versionId.toString());

      // Now archive Version 1 and publish Version 2 in Question Bank with new prompt
      await QuestionVersion.updateOne({ _id: versionId }, { status: 'ARCHIVED' });
      const newVersionId = new Types.ObjectId();
      await QuestionVersion.create({
        _id: newVersionId,
        questionId,
        versionNumber: 2,
        status: 'PUBLISHED',
        revision: 1,
        prompt: { vi: 'Nội dung v2 đã sửa đổi', en: 'Modified v2 content' },
        explanation: { vi: 'Giải thích v2', en: 'Explanation v2' },
        followUps: [],
        questionType: 'TECHNICAL',
        difficulty: 'EASY',
        primaryRoleId: new Types.ObjectId(roleId),
        additionalRoleIds: [],
        levelIds: [new Types.ObjectId(levelId)],
        technologies: [{ technologyId: new Types.ObjectId(technologyId), relevance: 100 }],
        technologyAgnostic: false,
        classificationComplete: true,
        topic: 'Concurrency Topic',
        tags: ['concurrency'],
        referenceAnswer: { vi: 'Đáp án v2', en: 'Answer v2' },
        learningObjective: { vi: 'Mục tiêu v2', en: 'Objective v2' },
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
        changeSummary: 'Version 2 published',
        origin: 'MANUAL',
        sourceVersionId: versionId,
        sourceReference: null,
        contentHash: createContentHash({ v: 2 }),
        normalizedPromptFingerprint: normalizePromptFingerprint({ vi: 'Nội dung v2 đã sửa đổi', en: 'Modified v2 content' }),
        createdBy: new Types.ObjectId(adminId),
        updatedBy: new Types.ObjectId(adminId),
        contributorIds: [new Types.ObjectId(adminId)],
      });

      // Update question pointer to version 2
      await Question.findByIdAndUpdate(questionId, {
        currentPublishedVersionId: newVersionId,
        latestVersionNumber: 2,
      });

      // Verify interview question still contains original immutable snapshot and version 1 pointer
      const afterQuestion = await InterviewQuestionModel.findOne({
        sessionId,
        questionBankQuestionId: questionId,
      });
      expect(afterQuestion?.content.vi).toBe(originalPrompt);
      expect(afterQuestion?.questionBankVersionId?.toString()).toBe(originalVersionId);
    });

    it('retiring question does not break or delete existing interview question snapshot', async () => {
      const { questionId } = await seedQuestion('QB-2026-000031', 'EASY');
      await seedQuestion('QB-2026-000032', 'MEDIUM');
      await seedQuestion('QB-2026-000033', 'MEDIUM');
      await seedQuestion('QB-2026-000034', 'HARD');
      await seedQuestion('QB-2026-000035', 'HARD');

      const session = await InterviewSessionModel.create({
        status: 'GENERATING',
        setupData: { jobPosition: roleId, level: levelId, techStacks: [technologyId] },
      });
      const sessionId = session._id.toString();

      await orchestrator.generateAndCommit(sessionId, session.setupData);

      // Retire the question in Question Bank
      await Question.findByIdAndUpdate(questionId, { lifecycleStatus: 'RETIRED' });

      // Reload interview session from DB
      const interviewQuestions = await InterviewQuestionModel.find({ sessionId }).sort({ order: 1 });
      expect(interviewQuestions).toHaveLength(5);

      const targetQ = interviewQuestions.find((q) => q.questionBankQuestionId?.toString() === questionId.toString());
      expect(targetQ).toBeDefined();
      expect(targetQ?.content.vi).toContain('QB-2026-000031');
    });
  });
});
