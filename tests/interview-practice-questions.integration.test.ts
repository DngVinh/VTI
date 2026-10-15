import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_at_least_32_characters_long_12345';
  process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_at_least_32_characters_long_67890';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
});

import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import '../src/config/di';
import User from '../src/models/user.model';
import { createApp } from '../src/app';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import Technology from '../src/models/technology.model';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';
import { generateAuthTokens } from '../src/utils/token';

import { createContentHash } from '../src/domain/question-bank/hashing';

let replicaSet: MongoMemoryReplSet;
let app: any;

describe('Interview Practice Questions Integration Test', () => {
  let candidateToken: string;
  let candidateUser: any;
  let roleId: Types.ObjectId;
  let levelId: Types.ObjectId;
  let techId: Types.ObjectId;
  let q1Id: Types.ObjectId;
  let q2Id: Types.ObjectId;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replicaSet.getUri(), {
      dbName: 'interview_practice_questions_test',
    });

    app = createApp();

    roleId = new Types.ObjectId();
    await Role.create({
      _id: roleId,
      code: 'BACKEND_DEVELOPER',
      name: 'Backend Developer',
      status: 'ACTIVE',
    });

    levelId = new Types.ObjectId();
    await Level.create({
      _id: levelId,
      code: 'SENIOR',
      name: 'Senior',
      status: 'ACTIVE',
    });

    techId = new Types.ObjectId();
    await Technology.create({
      _id: techId,
      code: 'NODEJS',
      name: 'Node.js',
      roles: [roleId],
      status: 'ACTIVE',
    });

    candidateUser = await User.create({
      email: 'candidate_practice@example.com',
      password: 'Password123!',
      fullName: 'Practice Candidate',
      role: 'CANDIDATE',
      status: 'ACTIVE',
    });

    const tokens = generateAuthTokens(candidateUser._id.toString(), 'CANDIDATE');
    candidateToken = tokens.accessToken;

    // Create 2 test questions in Question Bank
    q1Id = new Types.ObjectId();
    const v1Id = new Types.ObjectId();
    const prompt1 = {
      vi: 'Giải thích kiến trúc Event Loop trong Node.js?',
      en: 'Explain Event Loop architecture in Node.js?',
    };
    await QuestionVersion.create({
      _id: v1Id,
      questionId: q1Id,
      versionNumber: 1,
      status: 'PUBLISHED',
      revision: 1,
      prompt: prompt1,
      difficulty: 'MEDIUM',
      primaryRoleId: roleId,
      levelIds: [levelId],
      technologies: [{ technologyId: techId, isPrimary: true }],
      classificationComplete: true,
      origin: 'MANUAL',
      contentHash: createContentHash(prompt1),
      createdBy: candidateUser._id,
      updatedBy: candidateUser._id,
    });

    await Question.create({
      _id: q1Id,
      code: 'QB-2026-000001',
      lifecycleStatus: 'ACTIVE',
      currentPublishedVersionId: v1Id,
      latestVersionNumber: 1,
      ownerId: candidateUser._id,
      revision: 1,
      createdBy: candidateUser._id,
      updatedBy: candidateUser._id,
    });

    q2Id = new Types.ObjectId();
    const v2Id = new Types.ObjectId();
    const prompt2 = {
      vi: 'Làm thế nào để tối ưu hóa truy vấn MongoDB với index?',
      en: 'How to optimize MongoDB queries with indexes?',
    };
    await QuestionVersion.create({
      _id: v2Id,
      questionId: q2Id,
      versionNumber: 1,
      status: 'PUBLISHED',
      revision: 1,
      prompt: prompt2,
      difficulty: 'HARD',
      primaryRoleId: roleId,
      levelIds: [levelId],
      technologies: [{ technologyId: techId, isPrimary: true }],
      classificationComplete: true,
      origin: 'MANUAL',
      contentHash: createContentHash(prompt2),
      createdBy: candidateUser._id,
      updatedBy: candidateUser._id,
    });

    await Question.create({
      _id: q2Id,
      code: 'QB-2026-000002',
      lifecycleStatus: 'ACTIVE',
      currentPublishedVersionId: v2Id,
      latestVersionNumber: 1,
      ownerId: candidateUser._id,
      revision: 1,
      createdBy: candidateUser._id,
      updatedBy: candidateUser._id,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replicaSet.stop();
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/v1/interviews/practice-questions')
      .send({ questionIds: [q1Id.toString()] });

    expect(res.status).toBe(401);
  });

  it('rejects request with empty questionIds with 400', async () => {
    const res = await request(app)
      .post('/api/v1/interviews/practice-questions')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ questionIds: [] });

    expect(res.status).toBe(400);
  });

  it('rejects request with more than 5 questionIds with 400', async () => {
    const res = await request(app)
      .post('/api/v1/interviews/practice-questions')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        questionIds: [
          new Types.ObjectId().toString(),
          new Types.ObjectId().toString(),
          new Types.ObjectId().toString(),
          new Types.ObjectId().toString(),
          new Types.ObjectId().toString(),
          new Types.ObjectId().toString(),
        ],
      });

    expect(res.status).toBe(400);
  });

  it('creates interview session with selected questions in IN_PROGRESS state', async () => {
    const res = await request(app)
      .post('/api/v1/interviews/practice-questions')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ questionIds: [q1Id.toString(), q2Id.toString()] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const session = res.body.data;
    expect(session.status).toBe('IN_PROGRESS');
    expect(session.questions).toHaveLength(2);

    expect(session.questions[0].order).toBe(1);
    expect(session.questions[0].content.vi).toBe('Giải thích kiến trúc Event Loop trong Node.js?');
    expect(session.questions[0].difficulty).toBe('MEDIUM');
    expect(session.questions[0].sourceType).toBe('QUESTION_BANK');
    expect(session.questions[0].questionBankCode).toBe('QB-2026-000001');

    expect(session.questions[1].order).toBe(2);
    expect(session.questions[1].content.vi).toBe('Làm thế nào để tối ưu hóa truy vấn MongoDB với index?');
    expect(session.questions[1].difficulty).toBe('HARD');
    expect(session.questions[1].sourceType).toBe('QUESTION_BANK');
    expect(session.questions[1].questionBankCode).toBe('QB-2026-000002');
  });
});
