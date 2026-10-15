import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import User from '../src/models/user.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { WhiteboardSnapshotModel } from '../src/models/WhiteboardSnapshot';
import { generateAuthTokens } from '../src/utils/token';
import { GeminiVisionAnalyzer } from '../src/services/vision/GeminiVisionAnalyzer';

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

describe('Phase 4: System Design Whiteboard & Multimodal Vision Integration (Micro-Task 4.10)', () => {
  it('executes GeminiVisionAnalyzer fallback gracefully for image buffer', async () => {
    const analyzer = new GeminiVisionAnalyzer();
    const fakeBuffer = Buffer.from('fake-png-data');

    const result = await analyzer.analyzeImage({
      imageBuffer: fakeBuffer,
      mimeType: 'image/png',
      questionContext: 'Thiết kế hệ thống Chat thời gian thực',
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.detectedNodes.length).toBeGreaterThan(0);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.tradeOffEvaluation.vi).toBeTruthy();
  });

  it('handles complete end-to-end whiteboard snapshot flow via API', async () => {
    const candidate = await User.create({
      fullName: 'Solutions Architect',
      email: 'sa.candidate@example.com',
      password: 'Password123!',
      role: 'CANDIDATE',
    });

    const tokens = generateAuthTokens(candidate._id.toString(), 'CANDIDATE');

    const session = await InterviewSessionModel.create({
      userId: candidate._id,
      jobPosition: new mongoose.Types.ObjectId(),
      level: new mongoose.Types.ObjectId(),
      techStacks: [new mongoose.Types.ObjectId()],
      language: 'VI',
      status: 'IN_PROGRESS',
      secondsPerQuestion: 300,
      totalQuestions: 5,
      currentQuestionIndex: 0,
    });

    const sampleBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const res = await request(app)
      .post(`/api/v1/interviews/${session._id}/whiteboard`)
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .send({
        questionId: 'q-system-design-chat',
        imageBase64: `data:image/png;base64,${sampleBase64}`,
        mimeType: 'image/png',
        canvasData: {
          nodes: [
            { id: '1', type: 'LOAD_BALANCER', label: 'NLB' },
            { id: '2', type: 'SERVICE', label: 'WebSocket Gateway' },
            { id: '3', type: 'QUEUE', label: 'Kafka Broker' },
            { id: '4', type: 'DATABASE', label: 'Cassandra' },
          ],
          edges: [
            { from: '1', to: '2', protocol: 'TCP' },
            { from: '2', to: '3', protocol: 'Kafka' },
            { from: '3', to: '4', protocol: 'Batch' },
          ],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.snapshotId).toBeTruthy();
    expect(res.body.data.analysis).toBeDefined();
    expect(res.body.data.analysis.detectedNodes.length).toBeGreaterThan(0);

    // Verify database record
    const snapshotInDb = await WhiteboardSnapshotModel.findById(res.body.data.snapshotId);
    expect(snapshotInDb).not.toBeNull();
    expect(snapshotInDb?.sessionId.toString()).toBe(session._id.toString());
    expect(snapshotInDb?.canvasData?.nodes.length).toBe(4);
  });
});
