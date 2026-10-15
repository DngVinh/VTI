import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { WhiteboardSnapshotModel } from '../../src/models/WhiteboardSnapshot';

let mongo: MongoMemoryReplSet;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await WhiteboardSnapshotModel.deleteMany({});
});

describe('WhiteboardSnapshot Model (Micro-Task 4.5)', () => {
  it('creates and persists a whiteboard snapshot with valid fields', async () => {
    const sessionId = new mongoose.Types.ObjectId();
    const snapshot = await WhiteboardSnapshotModel.create({
      sessionId,
      questionId: 'q-arch-1',
      imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      mimeType: 'image/png',
      analysisResult: {
        detectedNodes: [{ type: 'DATABASE', label: 'Postgres' }],
        issues: [],
        tradeOffEvaluation: { vi: 'Hợp lý', en: 'Reasonable' },
        score: 9,
      },
    });

    expect(snapshot._id).toBeDefined();
    expect(snapshot.sessionId.toString()).toBe(sessionId.toString());
    expect(snapshot.questionId).toBe('q-arch-1');
    expect(snapshot.analysisResult?.score).toBe(9);
    expect(snapshot.createdAt).toBeInstanceOf(Date);
  });

  it('rejects creation without required sessionId or questionId', async () => {
    await expect(
      WhiteboardSnapshotModel.create({
        imageBase64: 'fake-data',
      })
    ).rejects.toThrow();
  });
});
