import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/user.model';
import { InterviewSessionModel } from '../../src/models/InterviewSession';
import { WhiteboardSnapshotModel } from '../../src/models/WhiteboardSnapshot';
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
  await WhiteboardSnapshotModel.deleteMany({});
});

describe('Whiteboard API Integration (Micro-Task 4.4b)', () => {
  const setupSession = async () => {
    const owner = await User.create({
      fullName: 'Architect Candidate',
      email: 'arch@example.com',
      password: 'Password123!',
      role: 'CANDIDATE',
    });

    const otherUser = await User.create({
      fullName: 'Other User',
      email: 'other.arch@example.com',
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

  it('allows owner to submit whiteboard snapshot and returns 200 with analysis', async () => {
    const { sessionId, ownerTokens } = await setupSession();

    const sampleBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const res = await request(app)
      .post(`/api/v1/interviews/${sessionId}/whiteboard`)
      .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
      .send({
        questionId: 'q-sys-1',
        imageBase64: `data:image/png;base64,${sampleBase64}`,
        mimeType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.snapshotId).toBeDefined();
    expect(res.body.data.analysis).toBeDefined();
    expect(res.body.data.analysis.score).toBeGreaterThan(0);

    const saved = await WhiteboardSnapshotModel.findById(res.body.data.snapshotId);
    expect(saved).not.toBeNull();
    expect(saved?.questionId).toBe('q-sys-1');
  });

  it('rejects whiteboard submission from non-owner with 403 Forbidden', async () => {
    const { sessionId, otherTokens } = await setupSession();

    const res = await request(app)
      .post(`/api/v1/interviews/${sessionId}/whiteboard`)
      .set('Authorization', `Bearer ${otherTokens.accessToken}`)
      .send({
        questionId: 'q-sys-1',
        imageBase64: 'fake-base64-data-short',
      });

    expect(res.status).toBe(403);
  });

  it('rejects invalid request with empty imageBase64 with 400 Bad Request', async () => {
    const { sessionId, ownerTokens } = await setupSession();

    const res = await request(app)
      .post(`/api/v1/interviews/${sessionId}/whiteboard`)
      .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
      .send({
        questionId: 'q-sys-1',
        imageBase64: '',
      });

    expect(res.status).toBe(400);
  });
});
