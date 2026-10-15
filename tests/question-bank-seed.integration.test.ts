import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'question_bank_seed_access_secret_at_least_32_characters';
  process.env.JWT_REFRESH_SECRET = 'question_bank_seed_refresh_secret_at_least_32_characters';
  process.env.PASSWORD_RESET_SECRET = 'question_bank_seed_reset_secret_at_least_32_characters';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
});

import app from '../src/app';
import User from '../src/models/user.model';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import Technology from '../src/models/technology.model';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';
import QuestionCounter from '../src/models/question-counter.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import {
  QUESTION_BANK_SEED_SOURCE_PREFIX,
  seedQuestionBank,
} from '../src/seeds/question-bank.seed';

let replicaSet: MongoMemoryReplSet;
let interviewSessionId: mongoose.Types.ObjectId;

describe('Question Bank sample seed', () => {
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
      InterviewSessionModel.deleteMany({}),
    ]);

    const admin = await User.create({
      email: 'seed-admin@example.test',
      passwordHash: 'not-used-by-seed-test',
      fullName: 'Seed Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    const interviewSession = await InterviewSessionModel.create({
      userId: admin._id.toString(),
      status: 'IN_PROGRESS',
      setupData: {
        jobPosition: 'Backend Developer',
        level: 'MIDDLE',
        techStacks: ['Node.js'],
        language: 'EN',
        secondsPerQuestion: 300,
        strategy: 'STANDARD',
      },
    });
    interviewSessionId = interviewSession._id;
  });

  it('creates exactly 20 complete ACTIVE/PUBLISHED questions visible in the public library', async () => {
    const result = await seedQuestionBank();

    expect(result).toEqual({ created: 20, skipped: 0 });
    expect(await Question.countDocuments()).toBe(20);

    const questions = await Question.find().lean().exec();
    const versions = await QuestionVersion.find({
      sourceReference: { $regex: `^${QUESTION_BANK_SEED_SOURCE_PREFIX}` },
    })
      .select('+contentHash +normalizedPromptFingerprint')
      .lean()
      .exec();

    expect(versions).toHaveLength(20);
    expect(questions.every((question) => /^QB-\d{4}-\d{6}$/.test(question.code))).toBe(true);

    for (const question of questions) {
      expect(question.lifecycleStatus).toBe('ACTIVE');
      expect(question.currentPublishedVersionId).not.toBeNull();
      const version = versions.find((candidate) => candidate.questionId.equals(question._id));
      expect(version).toBeDefined();
      expect(version?.status).toBe('PUBLISHED');
      expect(version?._id.equals(question.currentPublishedVersionId!)).toBe(true);
      expect(version?.prompt.vi).toBeTruthy();
      expect(version?.prompt.en).toBeTruthy();
      expect(version?.explanation.vi).toBeTruthy();
      expect(version?.explanation.en).toBeTruthy();
      expect(version?.referenceAnswer.vi).toBeTruthy();
      expect(version?.referenceAnswer.en).toBeTruthy();
      expect(version?.learningObjective.vi).toBeTruthy();
      expect(version?.learningObjective.en).toBeTruthy();
      expect(version?.contentHash).toMatch(/^[a-f\d]{64}$/);
      expect(version?.normalizedPromptFingerprint).toMatch(/^[a-f\d]{64}$/);
      expect(version?.rubric).toHaveLength(2);
      expect(version?.rubric.reduce((sum, criterion) => sum + criterion.weight, 0)).toBe(100);
      for (const criterion of version?.rubric ?? []) {
        expect(criterion.levels.map((level) => level.score).sort()).toEqual([0, 1, 2, 3, 4]);
      }
    }

    const libraryResponse = await request(app)
      .get('/api/v1/questions/public')
      .query({ page: 1, limit: 100 });
    expect(libraryResponse.status).toBe(200);
    expect(libraryResponse.body.success).toBe(true);
    expect(libraryResponse.body.data.total).toBe(20);
    expect(libraryResponse.body.data.items).toHaveLength(20);
  });

  it('is idempotent and preserves existing interview data on the second run', async () => {
    await seedQuestionBank();
    const beforeInterview = await InterviewSessionModel.findById(interviewSessionId).lean().exec();

    const result = await seedQuestionBank();

    expect(result).toEqual({ created: 0, skipped: 20 });
    expect(await Question.countDocuments()).toBe(20);
    expect(await QuestionVersion.countDocuments()).toBe(20);
    expect(await InterviewSessionModel.countDocuments()).toBe(1);
    const afterInterview = await InterviewSessionModel.findById(interviewSessionId).lean().exec();
    expect(afterInterview).toMatchObject({
      _id: interviewSessionId,
      status: beforeInterview?.status,
      userId: beforeInterview?.userId,
    });
  });
});

