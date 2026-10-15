import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import User from '../src/models/user.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { ConversationTurnModel } from '../src/models/ConversationTurn';
import { generateAuthTokens } from '../src/utils/token';

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

describe('E2E Conversational Interview Flow (Task 1.15)', () => {
  const createTestFixture = async () => {
    const candidate = await User.create({
      fullName: 'Trần Văn Ứng Viên',
      email: 'candidate@example.com',
      password: 'Password123!',
      role: 'CANDIDATE',
    });

    const otherCandidate = await User.create({
      fullName: 'Người Khác',
      email: 'other@example.com',
      password: 'Password123!',
      role: 'CANDIDATE',
    });

    const candidateTokens = generateAuthTokens(candidate._id.toString(), 'CANDIDATE');
    const otherTokens = generateAuthTokens(otherCandidate._id.toString(), 'CANDIDATE');

    const sessionId = new mongoose.Types.ObjectId();
    const questions = [];
    for (let i = 1; i <= 5; i++) {
      const q = await InterviewQuestionModel.create({
        sessionId,
        order: i,
        category: 'Architecture & Design',
        difficulty: i === 1 ? 'Easy' : 'Medium',
        content: {
          vi: `Câu hỏi ${i}: Giải thích cơ chế Event Loop trong NodeJS và cách hoạt động của microtask queue?`,
          en: `Question ${i}: Explain Event Loop mechanism in NodeJS and how microtask queue works?`,
        },
      });
      questions.push(q);
    }

    const session = await InterviewSessionModel.create({
      _id: sessionId,
      userId: candidate._id,
      role: 'Fullstack Engineer',
      level: 'Middle',
      technologies: ['NodeJS', 'React'],
      status: 'IN_PROGRESS',
      currentQuestionIndex: 0,
      totalQuestions: 5,
      questions: questions.map((q) => q._id),
      version: 0,
    });

    return { candidate, otherCandidate, candidateTokens, otherTokens, session, questions };
  };

  it('executes full conversational follow-up lifecycle: turn 1 -> turn 2 -> max turns -> early submit', async () => {
    const { session, questions, candidateTokens } = await createTestFixture();
    const q1 = questions[0];
    const sId = session._id.toString();
    const q1Id = q1._id.toString();

    // 1. Candidate sends Turn 1 answer (short answer triggers follow-up)
    const turn1Res = await request(app)
      .post(`/api/v1/interviews/${sId}/follow-up`)
      .set('Authorization', `Bearer ${candidateTokens.accessToken}`)
      .send({
        questionId: q1Id,
        candidateAnswer: 'Event loop chạy liên tục.',
      });

    expect(turn1Res.status).toBe(200);
    expect(turn1Res.body.success).toBe(true);
    expect(turn1Res.body.data.turnIndex).toBe(1);
    expect(turn1Res.body.data.maxTurns).toBe(3);
    expect(turn1Res.body.data.shouldFollowUp).toBe(true);
    expect(turn1Res.body.data.followUpQuestion).toBeDefined();
    expect(turn1Res.body.data.followUpQuestion.vi).toBeTruthy();

    // Verify session state transitioned to FOLLOW_UP
    const sessionAfterTurn1 = await InterviewSessionModel.findById(sId);
    expect(sessionAfterTurn1?.status).toBe('FOLLOW_UP');

    // Verify ConversationTurns saved to DB
    const turnsAfterTurn1 = await ConversationTurnModel.find({ sessionId: sId, questionId: q1Id }).sort({ turnIndex: 1 });
    expect(turnsAfterTurn1.length).toBe(2);
    expect(turnsAfterTurn1[0].role).toBe('CANDIDATE');
    expect(turnsAfterTurn1[0].type).toBe('ANSWER');
    expect(turnsAfterTurn1[1].role).toBe('INTERVIEWER');
    expect(turnsAfterTurn1[1].type).toBe('FOLLOW_UP');

    // 2. Fetch conversation history via GET /api/v1/interviews/:id/conversation
    const historyRes = await request(app)
      .get(`/api/v1/interviews/${sId}/conversation?questionId=${q1Id}`)
      .set('Authorization', `Bearer ${candidateTokens.accessToken}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.success).toBe(true);
    expect(historyRes.body.data.length).toBe(2);
    expect(historyRes.body.data[0].role).toBe('CANDIDATE');
    expect(historyRes.body.data[1].role).toBe('INTERVIEWER');

    // 3. Candidate sends Turn 2 answer to follow-up question (short answer continues follow-up)
    const turn2Res = await request(app)
      .post(`/api/v1/interviews/${sId}/follow-up`)
      .set('Authorization', `Bearer ${candidateTokens.accessToken}`)
      .send({
        questionId: q1Id,
        candidateAnswer: 'Nó kiểm tra call stack.',
      });

    expect(turn2Res.status).toBe(200);
    expect(turn2Res.body.data.turnIndex).toBe(2);

    const turnsAfterTurn2 = await ConversationTurnModel.find({ sessionId: sId, questionId: q1Id }).sort({ turnIndex: 1 });
    expect(turnsAfterTurn2.length).toBe(4);

    // 4. Candidate sends Turn 3 detailed answer (>= 50 chars), satisfying AI or reaching max turns
    const turn3Res = await request(app)
      .post(`/api/v1/interviews/${sId}/follow-up`)
      .set('Authorization', `Bearer ${candidateTokens.accessToken}`)
      .send({
        questionId: q1Id,
        candidateAnswer: 'Microtask queue được xử lý ngay sau khi call stack rỗng và trước macrotask tiếp theo, bao gồm process.nextTick và Promise.',
      });

    expect(turn3Res.status).toBe(200);
    expect(turn3Res.body.data.turnIndex).toBe(3);
    // Detailed answer satisfies requirement
    expect(turn3Res.body.data.shouldFollowUp).toBe(false);

    // 5. Submit interview early from current state
    const currentSession = await InterviewSessionModel.findById(sId);
    const submitRes = await request(app)
      .post(`/api/v1/interviews/${sId}/submit`)
      .set('Authorization', `Bearer ${candidateTokens.accessToken}`)
      .set('Idempotency-Key', 'e2e-submit-key-001')
      .send({
        expectedVersion: currentSession?.version ?? 0,
        answers: questions.map((q) => ({
          questionId: q._id.toString(),
          state: 'ANSWERED',
          candidateAnswer: 'Câu trả lời hoàn chỉnh cho bài test E2E.',
        })),
      });

    // 202 Accepted according to AIP-56 async evaluation pipeline
    expect([200, 202]).toContain(submitRes.status);
    expect(submitRes.body.success).toBe(true);

    const finalSession = await InterviewSessionModel.findById(sId);
    expect(['EVALUATING', 'COMPLETED']).toContain(finalSession?.status);
  });

  it('enforces authentication and authorization invariants on conversational endpoints', async () => {
    const { session, questions, otherTokens } = await createTestFixture();
    const sId = session._id.toString();
    const qId = questions[0]._id.toString();

    // 401 when missing token
    const unauthFollowUp = await request(app)
      .post(`/api/v1/interviews/${sId}/follow-up`)
      .send({ questionId: qId, candidateAnswer: 'Some answer' });
    expect(unauthFollowUp.status).toBe(401);

    const unauthHistory = await request(app)
      .get(`/api/v1/interviews/${sId}/conversation`);
    expect(unauthHistory.status).toBe(401);

    // 403 when accessed by another candidate
    const forbiddenFollowUp = await request(app)
      .post(`/api/v1/interviews/${sId}/follow-up`)
      .set('Authorization', `Bearer ${otherTokens.accessToken}`)
      .send({ questionId: qId, candidateAnswer: 'Some answer' });
    expect(forbiddenFollowUp.status).toBe(403);

    const forbiddenHistory = await request(app)
      .get(`/api/v1/interviews/${sId}/conversation`)
      .set('Authorization', `Bearer ${otherTokens.accessToken}`);
    expect(forbiddenHistory.status).toBe(403);
  });
});
