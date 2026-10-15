import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { InterviewEvaluationResultModel } from '../../src/models/InterviewEvaluationResult';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await InterviewEvaluationResultModel.deleteMany({});
});

describe('InterviewEvaluationResult Persona Data Support (Micro-Task 2.8)', () => {
  it('should persist and retrieve personaEvaluations and varianceFlags', async () => {
    const sessionId = new mongoose.Types.ObjectId();
    const operationId = new mongoose.Types.ObjectId();
    const questionId = new mongoose.Types.ObjectId();

    const created = await InterviewEvaluationResultModel.create({
      sessionId,
      submissionVersion: 1,
      operationId,
      overallScore: 8.5,
      evaluations: [
        {
          questionId,
          feedback: { vi: 'Tốt', en: 'Good' },
          score: 8.5,
        },
      ],
      dimensions: [
        {
          name: 'Architecture',
          score: 8.5,
          reasoning: 'Clean design',
        },
      ],
      learningPath: [
        {
          topic: { vi: 'Redis', en: 'Redis' },
          priority: 'Medium',
          suggestion: { vi: 'Học pub/sub', en: 'Learn pub/sub' },
        },
      ],
      personaEvaluations: [
        {
          role: 'TECH_LEAD',
          score: 9.0,
          strengths: [{ vi: 'Kiến trúc tốt', en: 'Good architecture' }],
          weaknesses: [{ vi: 'Thiếu sharding', en: 'Missing sharding' }],
          specificFeedback: { vi: 'Thiết kế module sạch sẽ.', en: 'Clean modular design.' },
          dimensionScores: { 'Architecture & Design': 9.0 },
        },
        {
          role: 'BAR_RAISER',
          score: 7.5,
          strengths: [{ vi: 'Biết dùng validator', en: 'Uses validator' }],
          weaknesses: [{ vi: 'Chưa bắt null pointer', en: 'Missed null pointer' }],
          specificFeedback: { vi: 'Cần chú ý edge cases.', en: 'Needs attention to edge cases.' },
          dimensionScores: { 'Security Awareness': 7.5 },
        },
      ],
      varianceFlags: [
        {
          dimension: 'Architecture vs Security',
          variance: 1.5,
          arbiterResolution: {
            vi: 'Độ lệch trong giới hạn cho phép, ghi nhận điểm cộng kiến trúc.',
            en: 'Variance within tolerance, architecture bonus recorded.',
          },
        },
      ],
    });

    expect(created._id).toBeDefined();

    const found = await InterviewEvaluationResultModel.findById(created._id);
    expect(found).toBeDefined();
    expect(found?.personaEvaluations?.length).toBe(2);
    expect(found?.personaEvaluations?.[0].role).toBe('TECH_LEAD');
    expect(found?.personaEvaluations?.[0].score).toBe(9.0);
    expect(found?.personaEvaluations?.[0].dimensionScores?.['Architecture & Design']).toBe(9.0);
    expect(found?.varianceFlags?.length).toBe(1);
    expect(found?.varianceFlags?.[0].variance).toBe(1.5);
    expect(found?.varianceFlags?.[0].arbiterResolution.vi).toContain('Độ lệch trong giới hạn');
  });
});
