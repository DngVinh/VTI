import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

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
import QuestionCounter from '../src/models/question-counter.model';

const PUBLIC_BASE = '/api/v1/questions/public';

let replicaSet: MongoMemoryReplSet;
let roleId: string;
let levelId: string;
let technologyId: string;
let otherRoleId: string;

let publishedQuestionId: string;
let draftOnlyQuestionId: string;
let retiredQuestionId: string;

describe('Public Question Study API (TDD RED-GREEN-REFACTOR)', () => {
  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    await mongoose.connect(replicaSet.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replicaSet) await replicaSet.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Role.deleteMany({}),
      Level.deleteMany({}),
      Technology.deleteMany({}),
      Question.deleteMany({}),
      QuestionVersion.deleteMany({}),
      QuestionCounter.deleteMany({}),
    ]);

    const admin = await User.create({
      fullName: 'Admin Author',
      email: 'admin@study.test',
      passwordHash: 'not-used-by-integration-test',
      role: 'ADMIN',
      status: 'ACTIVE',
      credentialVersion: 0,
    });

    const role = await Role.create({
      code: 'BACKEND',
      name: 'Backend Developer',
      status: 'ACTIVE',
      description: 'Backend role',
    });
    roleId = role._id.toString();

    const otherRole = await Role.create({
      code: 'FRONTEND',
      name: 'Frontend Developer',
      status: 'ACTIVE',
      description: 'Frontend role',
    });
    otherRoleId = otherRole._id.toString();

    const level = await Level.create({
      code: 'MIDDLE',
      name: 'Middle',
      status: 'ACTIVE',
      description: 'Middle level',
    });
    levelId = level._id.toString();

    const tech = await Technology.create({
      code: 'NODEJS',
      name: 'Node.js',
      status: 'ACTIVE',
      description: 'Node.js runtime',
    });
    technologyId = tech._id.toString();

    // 1. Published question with complete content, explanation, and rubric
    const qPub = await Question.create({
      code: 'QB-2026-000001',
      lifecycleStatus: 'ACTIVE',
      latestVersionNumber: 1,
      ownerId: admin._id,
      createdBy: admin._id,
      updatedBy: admin._id,
      revision: 1,
    });
    publishedQuestionId = qPub._id.toString();

    const qPubVer = await QuestionVersion.create({
      questionId: qPub._id,
      versionNumber: 1,
      status: 'PUBLISHED',
      revision: 1,
      prompt: {
        vi: 'Giải thích cơ chế Event Loop trong Node.js.',
        en: 'Explain the Event Loop mechanism in Node.js.',
      },
      explanation: {
        vi: 'Event Loop bao gồm các phases: Timers, Pending, Poll, Check, Close.',
        en: 'The Event Loop contains phases: Timers, Pending, Poll, Check, Close.',
      },
      referenceAnswer: {
        vi: 'Node.js sử dụng libuv để quản lý Event Loop cho non-blocking I/O.',
        en: 'Node.js utilizes libuv to handle Event Loop for non-blocking I/O.',
      },
      learningObjective: {
        vi: 'Hiểu kiến trúc bất đồng bộ đơn luồng.',
        en: 'Understand single-threaded asynchronous architecture.',
      },
      difficulty: 'MEDIUM',
      questionType: 'TECHNICAL',
      primaryRoleId: role._id,
      additionalRoleIds: [],
      levelIds: [level._id],
      technologies: [{ technologyId: tech._id, relevance: 100 }],
      technologyAgnostic: false,
      classificationComplete: true,
      topic: 'Node.js Runtime',
      tags: ['nodejs', 'event-loop', 'libuv'],
      rubric: [
        {
          key: 'core-concepts',
          title: { vi: 'Khái niệm cốt lõi', en: 'Core Concepts' },
          description: { vi: 'Nắm vững các phase của Event Loop', en: 'Understand Event Loop phases' },
          weight: 60,
          levels: [
            { score: 0, description: { vi: 'Chưa hiểu', en: 'No understanding' } },
            { score: 1, description: { vi: 'Biết khái niệm', en: 'Basic idea' } },
            { score: 2, description: { vi: 'Nêu được timers và poll', en: 'Mentions timers and poll' } },
            { score: 3, description: { vi: 'Phân biệt microtask vs macrotask', en: 'Differentiates micro vs macrotasks' } },
            { score: 4, description: { vi: 'Hiểu sâu libuv và nextTick queue', en: 'Deep knowledge of libuv and nextTick' } },
          ],
        },
      ],
      origin: 'MANUAL',
      contentHash: 'a'.repeat(64),
      createdBy: admin._id,
      updatedBy: admin._id,
      contributorIds: [admin._id],
    });

    qPub.currentPublishedVersionId = qPubVer._id;
    await qPub.save();

    // 2. Draft-only question (must NOT be visible publicly)
    const qDraft = await Question.create({
      code: 'QB-2026-000002',
      lifecycleStatus: 'ACTIVE',
      latestVersionNumber: 1,
      ownerId: admin._id,
      createdBy: admin._id,
      updatedBy: admin._id,
      revision: 0,
    });
    draftOnlyQuestionId = qDraft._id.toString();

    const qDraftVer = await QuestionVersion.create({
      questionId: qDraft._id,
      versionNumber: 1,
      status: 'DRAFT',
      revision: 0,
      prompt: { vi: 'Câu hỏi nháp chưa duyệt', en: 'Draft question not approved' },
      explanation: { vi: 'Giải thích nháp', en: 'Draft explanation' },
      difficulty: 'EASY',
      questionType: 'TECHNICAL',
      primaryRoleId: role._id,
      additionalRoleIds: [],
      levelIds: [level._id],
      technologies: [{ technologyId: tech._id, relevance: 100 }],
      origin: 'MANUAL',
      contentHash: 'b'.repeat(64),
      createdBy: admin._id,
      updatedBy: admin._id,
      contributorIds: [admin._id],
    });
    qDraft.draftVersionId = qDraftVer._id;
    await qDraft.save();

    // 3. Retired question (must NOT be visible publicly)
    const qRetired = await Question.create({
      code: 'QB-2026-000003',
      lifecycleStatus: 'RETIRED',
      latestVersionNumber: 1,
      ownerId: admin._id,
      createdBy: admin._id,
      updatedBy: admin._id,
      revision: 2,
    });
    retiredQuestionId = qRetired._id.toString();

    const qRetiredVer = await QuestionVersion.create({
      questionId: qRetired._id,
      versionNumber: 1,
      status: 'SUPERSEDED',
      revision: 2,
      prompt: { vi: 'Câu hỏi đã ngừng sử dụng', en: 'Retired question' },
      difficulty: 'HARD',
      questionType: 'CODING',
      primaryRoleId: role._id,
      additionalRoleIds: [],
      levelIds: [level._id],
      technologies: [{ technologyId: tech._id, relevance: 100 }],
      origin: 'MANUAL',
      contentHash: 'c'.repeat(64),
      createdBy: admin._id,
      updatedBy: admin._id,
      contributorIds: [admin._id],
    });
    qRetired.currentPublishedVersionId = qRetiredVer._id;
    await qRetired.save();
  });

  describe('GET /api/v1/questions/public', () => {
    it('returns 200 with list containing ONLY published questions', async () => {
      const res = await request(app).get(PUBLIC_BASE);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBe(1);

      const item = res.body.data.items[0];
      expect(item.id).toBe(publishedQuestionId);
      expect(item.code).toBe('QB-2026-000001');
      expect(item.prompt.vi).toContain('Event Loop');
      expect(item.difficulty).toBe('MEDIUM');
      expect(item.questionType).toBe('TECHNICAL');
      expect(item.technologies).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Node.js' })]));
      expect(res.body.data.total).toBe(1);
    });

    it('filters published questions by role, level, technology, difficulty and search keyword', async () => {
      // Match filter
      const matchRes = await request(app)
        .get(PUBLIC_BASE)
        .query({
          roleId,
          levelId,
          technologyId,
          difficulty: 'MEDIUM',
          search: 'libuv',
        });

      expect(matchRes.status).toBe(200);
      expect(matchRes.body.data.items.length).toBe(1);

      // Non-matching role filter
      const nonMatchRes = await request(app)
        .get(PUBLIC_BASE)
        .query({ roleId: otherRoleId });

      expect(nonMatchRes.status).toBe(200);
      expect(nonMatchRes.body.data.items.length).toBe(0);
      expect(nonMatchRes.body.data.total).toBe(0);
    });

    it('safely handles regex special characters in search keyword without 500 error', async () => {
      // Searching with '[' or '(' or '+' or '*' or '?' should not crash server with SyntaxError
      const regexChars = ['[', ']', '(', ')', '+', '*', '?', '\\', '^', '$'];
      for (const char of regexChars) {
        const res = await request(app)
          .get(PUBLIC_BASE)
          .query({ search: `test${char}` });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data.items)).toBe(true);
      }
    });

    it('supports pagination boundaries', async () => {
      const res = await request(app)
        .get(PUBLIC_BASE)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(10);
      expect(res.body.data.totalPages).toBe(1);
    });
  });

  describe('GET /api/v1/questions/public/:id', () => {
    it('returns 200 with full model answer, explanation, and rubric for PUBLISHED question', async () => {
      const res = await request(app).get(`${PUBLIC_BASE}/${publishedQuestionId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.id).toBe(publishedQuestionId);
      expect(data.code).toBe('QB-2026-000001');
      expect(data.prompt.vi).toBe('Giải thích cơ chế Event Loop trong Node.js.');
      expect(data.prompt.en).toBe('Explain the Event Loop mechanism in Node.js.');
      expect(data.explanation.vi).toContain('Timers, Pending, Poll');
      expect(data.explanation.en).toContain('Timers, Pending, Poll');
      expect(data.referenceAnswer.vi).toContain('libuv');
      expect(data.learningObjective.vi).toContain('bất đồng bộ');

      // Rubric check
      expect(Array.isArray(data.rubric)).toBe(true);
      expect(data.rubric.length).toBe(1);
      const criterion = data.rubric[0];
      expect(criterion.key).toBe('core-concepts');
      expect(criterion.weight).toBe(60);
      expect(criterion.levels.length).toBe(5);
      expect(criterion.levels[4].score).toBe(4);
      expect(criterion.levels[4].description.vi).toContain('libuv và nextTick');

      // Taxonomy info populated
      expect(data.role.name).toBe('Backend Developer');
      expect(data.levels[0].name).toBe('Middle');
      expect(data.technologies[0].name).toBe('Node.js');
    });

    it('returns 404 for DRAFT question', async () => {
      const res = await request(app).get(`${PUBLIC_BASE}/${draftOnlyQuestionId}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for RETIRED question', async () => {
      const res = await request(app).get(`${PUBLIC_BASE}/${retiredQuestionId}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent question ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).get(`${PUBLIC_BASE}/${fakeId}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('allows guest access without Authorization header', async () => {
      const res = await request(app).get(`${PUBLIC_BASE}/${publishedQuestionId}`);
      expect(res.status).toBe(200);
    });
  });
});
