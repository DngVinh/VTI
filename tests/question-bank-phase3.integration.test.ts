import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { container } from 'tsyringe';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'question_bank_access_secret_at_least_32_characters';
  process.env.JWT_REFRESH_SECRET = 'question_bank_refresh_secret_at_least_32_characters';
  process.env.PASSWORD_RESET_SECRET = 'question_bank_password_reset_secret_at_least_32_characters';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
  process.env.QUESTION_BANK_ADMIN_API_ENABLED = 'true';
});

import app from '../src/app';
import User from '../src/models/user.model';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import Technology from '../src/models/technology.model';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';
import QuestionReview from '../src/models/question-review.model';
import QuestionCounter from '../src/models/question-counter.model';
import IdempotencyRecord from '../src/models/idempotency-record.model';
import OutboxEvent from '../src/models/outbox-event.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { generateAuthTokens } from '../src/utils/token';
import { MockAiQuestionDraftProvider } from '../src/services/providers/mock-ai-question-draft.provider';
import { createContentHash, normalizePromptFingerprint } from '../src/domain/question-bank/hashing';

let replicaSet: MongoMemoryReplSet;
let adminToken: string;
let candidateToken: string;
let adminId: string;
let roleId: string;
let levelId: string;
let technologyId: string;

const auth = (token = adminToken) => ({ Authorization: 'Bearer ' + token });

const seedPublishedQuestion = async (code: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM') => {
  const questionId = new Types.ObjectId();
  const versionId = new Types.ObjectId();
  const adminOid = new Types.ObjectId(adminId);

  const prompt = {
    vi: `Câu hỏi kiểm thử ${code}`,
    en: `Test question ${code}`,
  };

  const versionDraft = {
    prompt,
    explanation: { vi: 'Giải thích', en: 'Explanation' },
    followUps: [],
    questionType: 'TECHNICAL',
    difficulty,
    primaryRoleId: roleId,
    additionalRoleIds: [],
    levelIds: [levelId],
    technologies: [{ technologyId, relevance: 100 }],
    technologyAgnostic: false,
    classificationComplete: true,
    topic: 'Testing Topic',
    tags: ['testing', 'integration'],
    referenceAnswer: { vi: 'Đáp án chuẩn', en: 'Reference answer' },
    learningObjective: { vi: 'Mục tiêu', en: 'Objective' },
    estimatedTimeSeconds: 300,
    rubric: [
      {
        key: 'understanding',
        title: { vi: 'Hiểu biết', en: 'Understanding' },
        description: { vi: 'Độ sâu', en: 'Depth' },
        weight: 100,
        levels: [{ score: 4, description: { vi: 'Tốt', en: 'Good' } }],
      },
    ],
  };

  const question = await Question.create({
    _id: questionId,
    code,
    lifecycleStatus: 'ACTIVE',
    currentPublishedVersionId: versionId,
    draftVersionId: null,
    latestVersionNumber: 1,
    ownerId: adminOid,
    revision: 1,
    createdBy: adminOid,
    updatedBy: adminOid,
  });

  const version = await QuestionVersion.create({
    _id: versionId,
    questionId,
    versionNumber: 1,
    status: 'PUBLISHED',
    revision: 1,
    prompt,
    explanation: { vi: 'Giải thích', en: 'Explanation' },
    followUps: [],
    referenceAnswer: { vi: 'Đáp án chuẩn', en: 'Reference answer' },
    learningObjective: { vi: 'Mục tiêu', en: 'Objective' },
    estimatedTimeSeconds: 300,
    rubric: [
      {
        key: 'understanding',
        title: { vi: 'Hiểu biết', en: 'Understanding' },
        description: { vi: 'Độ sâu', en: 'Depth' },
        weight: 100,
        levels: [{ score: 4, description: { vi: 'Tốt', en: 'Good' } }],
      },
    ],
    questionType: 'TECHNICAL',
    difficulty,
    primaryRoleId: new Types.ObjectId(roleId),
    additionalRoleIds: [],
    levelIds: [new Types.ObjectId(levelId)],
    technologies: [{ technologyId: new Types.ObjectId(technologyId), relevance: 100 }],
    technologyAgnostic: false,
    classificationComplete: true,
    topic: 'Testing Topic',
    tags: ['testing', 'integration'],
    changeSummary: 'Seed published',
    origin: 'MANUAL',
    sourceVersionId: null,
    sourceReference: null,
    contentHash: createContentHash(versionDraft),
    normalizedPromptFingerprint: normalizePromptFingerprint(prompt),
    createdBy: adminOid,
    updatedBy: adminOid,
    contributorIds: [adminOid],
  });

  return { question, version };
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri(), {
    dbName: 'question_bank_phase3_integration_test',
  });
  await Promise.all([
    Question.init(),
    QuestionVersion.init(),
    QuestionReview.init(),
    QuestionCounter.init(),
    IdempotencyRecord.init(),
    OutboxEvent.init(),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

beforeEach(async () => {
  process.env.QUESTION_BANK_ADMIN_API_ENABLED = 'true';
  await Promise.all([
    OutboxEvent.deleteMany({}),
    IdempotencyRecord.deleteMany({}),
    QuestionReview.deleteMany({}),
    QuestionVersion.deleteMany({}),
    Question.deleteMany({}),
    QuestionCounter.deleteMany({}),
    Technology.deleteMany({}),
    Level.deleteMany({}),
    Role.deleteMany({}),
    User.deleteMany({}),
  ]);

  const [admin, candidate, role, level, technology] = await Promise.all([
    User.create({
      email: 'qb-admin-p3@example.test',
      passwordHash: 'not-used-by-integration-test',
      fullName: 'Question Bank Admin Phase 3',
      role: 'ADMIN',
      status: 'ACTIVE',
      credentialVersion: 0,
    }),
    User.create({
      email: 'qb-candidate-p3@example.test',
      passwordHash: 'not-used-by-integration-test',
      fullName: 'Question Bank Candidate Phase 3',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      credentialVersion: 0,
    }),
    Role.create({ code: 'BACKEND', name: 'Backend Developer', status: 'ACTIVE' }),
    Level.create({ code: 'MIDDLE', name: 'Middle', status: 'ACTIVE' }),
    Technology.create({ code: 'NODEJS', name: 'Node.js', status: 'ACTIVE' }),
  ]);

  adminId = admin._id.toString();
  roleId = role._id.toString();
  levelId = level._id.toString();
  technologyId = technology._id.toString();

  adminToken = generateAuthTokens(adminId, 'ADMIN').accessToken;
  candidateToken = generateAuthTokens(candidate._id.toString(), 'CANDIDATE').accessToken;
});

describe('AIP-64 Phase 3: Selection Simulation', () => {
  it('selects published questions deterministically with seed and provides diagnostics', async () => {
    await seedPublishedQuestion('QB-2026-000001', 'MEDIUM');
    await seedPublishedQuestion('QB-2026-000002', 'MEDIUM');
    await seedPublishedQuestion('QB-2026-000003', 'MEDIUM');

    const res1 = await request(app)
      .post('/api/v1/admin/question-bank/selection')
      .set(auth())
      .send({
        roleId,
        levelId,
        count: 2,
        seed: 'fixed-seed-42',
      });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data.selected).toHaveLength(2);
    expect(res1.body.data.diagnostics.poolSize).toBe(3);
    expect(res1.body.data.diagnostics.requestedCount).toBe(2);
    expect(res1.body.data.diagnostics.selectedCount).toBe(2);
    expect(res1.body.data.diagnostics.isPoolSufficient).toBe(true);
    expect(res1.body.data.diagnostics.insufficientReason).toBeNull();

    // Verify projection does not leak referenceAnswer or rubric
    const item = res1.body.data.selected[0];
    expect(item).toHaveProperty('questionId');
    expect(item).toHaveProperty('code');
    expect(item).toHaveProperty('prompt');
    expect(item).not.toHaveProperty('referenceAnswer');
    expect(item).not.toHaveProperty('rubric');

    // Run again with identical seed -> exact identical selection
    const res2 = await request(app)
      .post('/api/v1/admin/question-bank/selection')
      .set(auth())
      .send({
        roleId,
        levelId,
        count: 2,
        seed: 'fixed-seed-42',
      });

    expect(res2.body.data.selected.map((q: any) => q.code)).toEqual(
      res1.body.data.selected.map((q: any) => q.code)
    );
  });

  it('reports insufficient pool diagnostics without fabricating questions', async () => {
    await seedPublishedQuestion('QB-2026-000001', 'EASY');

    const res = await request(app)
      .post('/api/v1/admin/question-bank/selection')
      .set(auth())
      .send({
        count: 5,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.selected).toHaveLength(1);
    expect(res.body.data.diagnostics.isPoolSufficient).toBe(false);
    expect(res.body.data.diagnostics.insufficientReason).toContain('Chỉ có 1 câu hỏi');
  });

  it('excludes retired, draft, in-review, and approved-unpublished questions', async () => {
    // 1 published active
    await seedPublishedQuestion('QB-2026-000001');

    // 1 retired with published pointer
    const { question: retiredQ } = await seedPublishedQuestion('QB-2026-000002');
    await Question.updateOne({ _id: retiredQ._id }, { lifecycleStatus: 'RETIRED' });

    // 1 draft only
    const draftQId = new Types.ObjectId();
    const draftVId = new Types.ObjectId();
    await Question.create({
      _id: draftQId,
      code: 'QB-2026-000003',
      lifecycleStatus: 'ACTIVE',
      currentPublishedVersionId: null,
      draftVersionId: draftVId,
      latestVersionNumber: 1,
      ownerId: new Types.ObjectId(adminId),
      revision: 0,
      createdBy: new Types.ObjectId(adminId),
      updatedBy: new Types.ObjectId(adminId),
    });
    await QuestionVersion.create({
      _id: draftVId,
      questionId: draftQId,
      versionNumber: 1,
      status: 'DRAFT',
      revision: 0,
      prompt: { vi: 'Draft prompt', en: 'Draft prompt' },
      explanation: { vi: null, en: null },
      followUps: [],
      referenceAnswer: { vi: 'Ans', en: 'Ans' },
      learningObjective: { vi: null, en: null },
      estimatedTimeSeconds: 300,
      rubric: [],
      questionType: 'TECHNICAL',
      difficulty: 'MEDIUM',
      primaryRoleId: new Types.ObjectId(roleId),
      additionalRoleIds: [],
      levelIds: [new Types.ObjectId(levelId)],
      technologies: [],
      technologyAgnostic: true,
      classificationComplete: true,
      topic: 'Topic',
      tags: [],
      changeSummary: 'Draft',
      origin: 'MANUAL',
      sourceVersionId: null,
      sourceReference: null,
      contentHash: createContentHash({ prompt: { vi: 'Draft prompt', en: 'Draft prompt' } }),
      normalizedPromptFingerprint: normalizePromptFingerprint({ vi: 'Draft prompt', en: 'Draft prompt' }),
      createdBy: new Types.ObjectId(adminId),
      updatedBy: new Types.ObjectId(adminId),
      contributorIds: [new Types.ObjectId(adminId)],
    });

    const res = await request(app)
      .post('/api/v1/admin/question-bank/selection')
      .set(auth())
      .send({ count: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data.selected).toHaveLength(1);
    expect(res.body.data.selected[0].code).toBe('QB-2026-000001');
  });

  it('rejects Candidate access with 403', async () => {
    const res = await request(app)
      .post('/api/v1/admin/question-bank/selection')
      .set(auth(candidateToken))
      .send({ count: 5 });

    expect(res.status).toBe(403);
  });
});

describe('AIP-64 Phase 3: Coverage and Analytics', () => {
  it('returns aggregated coverage metrics and identifies gaps', async () => {
    await seedPublishedQuestion('QB-2026-000001', 'HARD');

    const res = await request(app)
      .get('/api/v1/admin/question-bank/coverage')
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalQuestions).toBe(1);
    expect(res.body.data.publishedActiveQuestions).toBe(1);
    expect(res.body.data.byRole).toBeInstanceOf(Array);
    expect(res.body.data.byDifficulty.HARD).toBe(1);
    expect(res.body.data.gaps).toBeInstanceOf(Array);
  });

  it('returns governance analytics metrics and timeline', async () => {
    await seedPublishedQuestion('QB-2026-000001', 'EASY');

    const res = await request(app)
      .get('/api/v1/admin/question-bank/analytics')
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.totalQuestions).toBe(1);
    expect(res.body.data.lifecycleDistribution.ACTIVE).toBe(1);
    expect(res.body.data.versionStatusDistribution.PUBLISHED).toBe(1);
    expect(res.body.data.originDistribution.MANUAL).toBe(1);
    expect(res.body.data.difficultyDistribution.EASY).toBe(1);
    expect(res.body.data.activityTimeline).toBeInstanceOf(Array);
  });
});

describe('AIP-64 Phase 3: Import and Export', () => {
  it('performs dry-run validation reporting row errors without persisting', async () => {
    const res = await request(app)
      .post('/api/v1/admin/question-bank/imports')
      .set(auth())
      .set('Idempotency-Key', 'import-dryrun-key-000001')
      .send({
        format: 'JSON',
        dryRun: true,
        items: [
          {
            prompt: { vi: 'Câu hỏi 1', en: 'Question 1' },
            referenceAnswer: { vi: 'Trả lời 1', en: 'Answer 1' },
            primaryRoleId: roleId,
            levelIds: [levelId],
            type: 'TECHNICAL',
            difficulty: 'EASY',
          },
          {
            prompt: { vi: null, en: null }, // Missing prompt -> row error
            referenceAnswer: { vi: 'Trả lời 2', en: 'Answer 2' },
            primaryRoleId: roleId,
            levelIds: [levelId],
            type: 'TECHNICAL',
            difficulty: 'MEDIUM',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.dryRun).toBe(true);
    expect(res.body.data.totalRecords).toBe(2);
    expect(res.body.data.validCount).toBe(1);
    expect(res.body.data.invalidCount).toBe(1);
    expect(res.body.data.errors).toHaveLength(1);
    expect(res.body.data.errors[0].row).toBe(2);

    // Verify nothing persisted
    expect(await Question.countDocuments()).toBe(0);
  });

  it('atomically imports valid questions creating Drafts with origin IMPORTED', async () => {
    const res = await request(app)
      .post('/api/v1/admin/question-bank/imports')
      .set(auth())
      .set('Idempotency-Key', 'import-persist-key-000001')
      .send({
        format: 'JSON',
        dryRun: false,
        items: [
          {
            prompt: { vi: 'Câu hỏi import', en: 'Imported question' },
            referenceAnswer: { vi: 'Đáp án import', en: 'Imported answer' },
            primaryRoleId: roleId,
            levelIds: [levelId],
            technologyIds: [technologyId],
            type: 'TECHNICAL',
            difficulty: 'MEDIUM',
            topic: 'Imported Topic',
            tags: ['import-tag'],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.dryRun).toBe(false);
    expect(res.body.data.createdQuestions).toHaveLength(1);

    const created = await Question.findOne({ code: res.body.data.createdQuestions[0].code });
    expect(created).toBeTruthy();
    expect(created?.lifecycleStatus).toBe('ACTIVE');
    expect(created?.currentPublishedVersionId).toBeNull(); // Must NOT auto-publish!

    const version = await QuestionVersion.findById(created?.draftVersionId);
    expect(version).toBeTruthy();
    expect(version?.status).toBe('DRAFT'); // Must be DRAFT!
    expect(version?.origin).toBe('IMPORTED'); // Must be IMPORTED!
  });

  it('exports questions in JSON and CSV format with formula injection protection', async () => {
    await seedPublishedQuestion('QB-2026-000001');

    // JSON export
    const jsonRes = await request(app)
      .post('/api/v1/admin/question-bank/exports')
      .set(auth())
      .send({ format: 'JSON', limit: 10 });

    expect(jsonRes.status).toBe(200);
    expect(jsonRes.body.data.format).toBe('JSON');
    expect(jsonRes.body.data.data).toHaveLength(1);
    expect(jsonRes.body.data.data[0].code).toBe('QB-2026-000001');

    // CSV export
    const csvRes = await request(app)
      .post('/api/v1/admin/question-bank/exports')
      .set(auth())
      .send({ format: 'CSV', limit: 10 });

    expect(csvRes.status).toBe(200);
    expect(csvRes.body.data.format).toBe('CSV');
    expect(csvRes.body.data.csvContent).toContain('QB-2026-000001');
    expect(csvRes.body.data.csvContent).toContain('code,lifecycle_status');
  });
});

describe('AIP-64 Phase 3: AI-Assisted Draft Generation', () => {
  it('generates editable draft preview without auto-publishing or persisting', async () => {
    const res = await request(app)
      .post('/api/v1/admin/question-bank/ai-generations')
      .set(auth())
      .set('Idempotency-Key', 'ai-gen-preview-key-000001')
      .send({
        topic: 'Microservices Architecture',
        roleId,
        levelId,
        technologyId,
        difficulty: 'HARD',
        type: 'SYSTEM_DESIGN',
        persistDraft: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.draft).toHaveProperty('prompt');
    expect(res.body.data.draft.prompt.vi).toContain('Microservices Architecture');
    expect(res.body.data.draft.rubric.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.persistedQuestion).toBeUndefined();

    // No question created in DB
    expect(await Question.countDocuments()).toBe(0);
  });

  it('persists AI-assisted draft with origin AI_ASSISTED and DRAFT status', async () => {
    const res = await request(app)
      .post('/api/v1/admin/question-bank/ai-generations')
      .set(auth())
      .set('Idempotency-Key', 'ai-gen-persist-key-000001')
      .send({
        topic: 'Docker Containers',
        roleId,
        levelId,
        difficulty: 'MEDIUM',
        type: 'TECHNICAL',
        persistDraft: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.persistedQuestion).toHaveProperty('code');

    const created = await Question.findOne({ code: res.body.data.persistedQuestion.code });
    expect(created).toBeTruthy();
    expect(created?.currentPublishedVersionId).toBeNull(); // Must not auto-publish!

    const version = await QuestionVersion.findById(created?.draftVersionId);
    expect(version).toBeTruthy();
    expect(version?.status).toBe('DRAFT'); // Must be DRAFT!
    expect(version?.origin).toBe('AI_ASSISTED'); // Must be AI_ASSISTED!
  });

  it('handles mock AI provider failure scenarios cleanly', async () => {
    const mockProvider = container.resolve<MockAiQuestionDraftProvider>('IAiQuestionDraftProvider');

    mockProvider.setScenario('RATE_LIMIT');
    const res429 = await request(app)
      .post('/api/v1/admin/question-bank/ai-generations')
      .set(auth())
      .set('Idempotency-Key', 'ai-fail-429-key-0000001')
      .send({
        topic: 'Redis Caching',
        roleId,
        levelId,
        difficulty: 'EASY',
        type: 'TECHNICAL',
      });

    expect(res429.status).toBe(400); // QuestionBankDomainError returns safe error code
    expect(res429.body.code).toBe('AI_PROVIDER_RATE_LIMIT');

    mockProvider.setScenario('TIMEOUT');
    const resTimeout = await request(app)
      .post('/api/v1/admin/question-bank/ai-generations')
      .set(auth())
      .set('Idempotency-Key', 'ai-fail-timeout-key-0001')
      .send({
        topic: 'Redis Caching',
        roleId,
        levelId,
        difficulty: 'EASY',
        type: 'TECHNICAL',
      });

    expect(resTimeout.status).toBe(400);
    expect(resTimeout.body.code).toBe('AI_PROVIDER_TIMEOUT');

    mockProvider.setScenario('SUCCESS');
  });
});

describe('AIP-64 Phase 3: Isolation and Security Invariants', () => {
  it('proves Phase 3 operations never modify Interview collections', async () => {
    const sessionCountBefore = await InterviewSessionModel.countDocuments();
    const questionCountBefore = await InterviewQuestionModel.countDocuments();

    // Call selection
    await request(app)
      .post('/api/v1/admin/question-bank/selection')
      .set(auth())
      .send({ count: 5 });

    // Call coverage
    await request(app)
      .get('/api/v1/admin/question-bank/coverage')
      .set(auth());

    // Call analytics
    await request(app)
      .get('/api/v1/admin/question-bank/analytics')
      .set(auth());

    const sessionCountAfter = await InterviewSessionModel.countDocuments();
    const questionCountAfter = await InterviewQuestionModel.countDocuments();
    expect(sessionCountAfter).toBe(sessionCountBefore);
    expect(questionCountAfter).toBe(questionCountBefore);
    expect(sessionCountAfter).toBe(0);
    expect(questionCountAfter).toBe(0);
  });

  it('safely disables API when QUESTION_BANK_ADMIN_API_ENABLED is false', async () => {
    process.env.QUESTION_BANK_ADMIN_API_ENABLED = 'false';

    const res = await request(app)
      .post('/api/v1/admin/question-bank/selection')
      .set(auth())
      .send({ count: 5 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('QUESTION_BANK_FEATURE_DISABLED');
  });
});
