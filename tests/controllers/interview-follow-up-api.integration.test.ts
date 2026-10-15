import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/user.model';
import { InterviewSessionModel } from '../../src/models/InterviewSession';
import { InterviewQuestionModel } from '../../src/models/InterviewQuestion';
import { ConversationTurnModel } from '../../src/models/ConversationTurn';
import { generateAuthTokens } from '../../src/utils/token';

let mongo: MongoMemoryReplSet;
let app: any;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await InterviewSessionModel.deleteMany({});
  await InterviewQuestionModel.deleteMany({});
  await ConversationTurnModel.deleteMany({});
});

describe('Interview Follow-Up API Integration (Micro-Task 1.9c)', () => {
  const setupTestSession = async () => {
    const owner = await User.create({
      fullName: 'Owner Candidate',
      email: 'owner@example.com',
      password: 'Password123!',
      role: 'CANDIDATE',
    });

    const otherUser = await User.create({
      fullName: 'Other Candidate',
      email: 'other@example.com',
      password: 'Password123!',
      role: 'CANDIDATE',
    });

    const ownerTokens = generateAuthTokens(owner._id.toString(), 'CANDIDATE');
    const otherTokens = generateAuthTokens(otherUser._id.toString(), 'CANDIDATE');

    const sessionId = new mongoose.Types.ObjectId();
    const questions = [];
    for (let i = 1; i <= 5; i++) {
      const q = await InterviewQuestionModel.create({
        sessionId,
        order: i,
        category: 'Language fundamentals',
        difficulty: 'Easy',
        content: { vi: `Câu hỏi ${i}`, en: `Question ${i}` },
      });
      questions.push(q);
    }

    const session = await InterviewSessionModel.create({
      _id: sessionId,
      userId: owner._id,
      role: 'Developer',
      level: 'Junior',
      technologies: ['NodeJS'],
      status: 'IN_PROGRESS',
      currentQuestionIndex: 0,
      totalQuestions: 5,
      questions: questions.map((q) => q._id),
      version: 1,
    });

    return { owner, otherUser, ownerTokens, otherTokens, session, question: questions[0] };
  };

  describe('POST /api/v1/interviews/:id/follow-up', () => {
    it('should return 401 when unauthenticated', async () => {
      const { session, question } = await setupTestSession();

      const res = await request(app)
        .post(`/api/v1/interviews/${session._id}/follow-up`)
        .send({
          questionId: question._id.toString(),
          candidateAnswer: 'Event loop điều phối microtask và macrotask.',
        });

      expect(res.status).toBe(401);
    });

    it('should return 403 when user is not the interview owner', async () => {
      const { session, question, otherTokens } = await setupTestSession();

      const res = await request(app)
        .post(`/api/v1/interviews/${session._id}/follow-up`)
        .set('Authorization', `Bearer ${otherTokens.accessToken}`)
        .send({
          questionId: question._id.toString(),
          candidateAnswer: 'Event loop điều phối microtask và macrotask.',
        });

      expect(res.status).toBe(403);
    });

    it('should return 200 and follow-up data for valid owner request', async () => {
      const { session, question, ownerTokens } = await setupTestSession();

      const res = await request(app)
        .post(`/api/v1/interviews/${session._id}/follow-up`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send({
          questionId: question._id.toString(),
          candidateAnswer: 'Biến là nơi lưu giá trị.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shouldFollowUp).toBeDefined();
      expect(res.body.data.turnIndex).toBe(1);
      expect(res.body.data.maxTurns).toBe(3);
    });
  });

  describe('GET /api/v1/interviews/:id/conversation', () => {
    it('should return 401 when unauthenticated', async () => {
      const { session } = await setupTestSession();

      const res = await request(app).get(`/api/v1/interviews/${session._id}/conversation`);
      expect(res.status).toBe(401);
    });

    it('should return 200 and turns for interview owner', async () => {
      const { session, question, ownerTokens } = await setupTestSession();

      // Submit a follow-up first
      await request(app)
        .post(`/api/v1/interviews/${session._id}/follow-up`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send({
          questionId: question._id.toString(),
          candidateAnswer: 'Biến là nơi lưu giá trị.',
        });

      const res = await request(app)
        .get(`/api/v1/interviews/${session._id}/conversation`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
