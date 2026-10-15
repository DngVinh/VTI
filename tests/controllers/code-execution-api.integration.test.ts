import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/user.model';
import { InterviewSessionModel } from '../../src/models/InterviewSession';
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
});

describe('Code Execution API Integration (Micro-Task 3.6b)', () => {
  const setupSession = async () => {
    const owner = await User.create({
      fullName: 'Owner Dev',
      email: 'owner-code@example.com',
      password: 'Password123!',
      role: 'CANDIDATE',
    });

    const otherUser = await User.create({
      fullName: 'Other Dev',
      email: 'other-code@example.com',
      password: 'Password123!',
      role: 'CANDIDATE',
    });

    const ownerTokens = generateAuthTokens(owner._id.toString(), 'CANDIDATE');
    const otherTokens = generateAuthTokens(otherUser._id.toString(), 'CANDIDATE');

    const session = await InterviewSessionModel.create({
      userId: owner._id,
      jobPosition: new mongoose.Types.ObjectId(),
      level: new mongoose.Types.ObjectId(),
      techStacks: [new mongoose.Types.ObjectId()],
      language: 'VI',
      status: 'IN_PROGRESS',
      secondsPerQuestion: 300,
      totalQuestions: 5,
      currentQuestionIndex: 0,
    });

    return {
      owner,
      otherUser,
      ownerTokens,
      otherTokens,
      sessionId: session._id.toString(),
    };
  };

  it('allows owner to execute code and returns execution stdout with 200 OK', async () => {
    const { sessionId, ownerTokens } = await setupSession();

    const res = await request(app)
      .post(`/api/v1/interviews/${sessionId}/execute-code`)
      .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
      .send({
        questionId: 'q-101',
        code: 'console.log("Hello from Sandbox API!");',
        language: 'javascript',
      });

    if (res.status !== 200) {
      console.log('API Error Response:', res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.execution).toBeDefined();
    expect(res.body.data.execution.stdout).toBeTruthy();
  });

  it('rejects execution from non-owner with 403 Forbidden', async () => {
    const { sessionId, otherTokens } = await setupSession();

    const res = await request(app)
      .post(`/api/v1/interviews/${sessionId}/execute-code`)
      .set('Authorization', `Bearer ${otherTokens.accessToken}`)
      .send({
        questionId: 'q-101',
        code: 'console.log("Hack");',
        language: 'javascript',
      });

    expect(res.status).toBe(403);
  });

  it('rejects execution with invalid language with 400 Bad Request', async () => {
    const { sessionId, ownerTokens } = await setupSession();

    const res = await request(app)
      .post(`/api/v1/interviews/${sessionId}/execute-code`)
      .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
      .send({
        questionId: 'q-101',
        code: 'print(1)',
        language: 'unsupported_lang_xyz',
      });

    expect(res.status).toBe(400);
  });
});
