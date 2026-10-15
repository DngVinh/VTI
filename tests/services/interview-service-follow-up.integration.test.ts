import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { InterviewService } from '../../src/services/InterviewService';
import { MongoInterviewRepository } from '../../src/repositories/MongoInterviewRepository';
import { ConversationTurnRepository } from '../../src/repositories/ConversationTurnRepository';
import { MockAiProvider } from '../../src/services/ai/providers/MockAiProvider';
import { InterviewSessionModel } from '../../src/models/InterviewSession';
import { InterviewQuestionModel } from '../../src/models/InterviewQuestion';
import { ConversationTurnModel } from '../../src/models/ConversationTurn';
import { AppError } from '../../src/utils/AppError';

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
  await InterviewSessionModel.deleteMany({});
  await InterviewQuestionModel.deleteMany({});
  await ConversationTurnModel.deleteMany({});
});

describe('InterviewService.processFollowUp (Micro-Task 1.8)', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const mockAi = new MockAiProvider();
  const interviewRepo = new MongoInterviewRepository(userId);
  const turnRepo = new ConversationTurnRepository(userId);

  const createService = () =>
    new InterviewService(
      interviewRepo,
      mockAi,
      undefined,
      undefined,
      undefined,
      undefined,
      { NODE_ENV: 'test', AIU_MAX_FOLLOW_UPS_PER_QUESTION: 3 } as any,
      undefined,
      undefined,
      turnRepo
    );

  const setupSession = async (status: string = 'IN_PROGRESS') => {
    const sessionId = new mongoose.Types.ObjectId();
    const questions = [];
    for (let i = 1; i <= 5; i++) {
      const q = await InterviewQuestionModel.create({
        sessionId,
        order: i,
        category: 'Backend',
        difficulty: 'Medium',
        content: { vi: `Câu hỏi ${i}`, en: `Question ${i}` },
      });
      questions.push(q);
    }

    const session = await InterviewSessionModel.create({
      _id: sessionId,
      userId,
      role: 'NodeJS Developer',
      level: 'Senior',
      technologies: ['NodeJS'],
      status,
      currentQuestionIndex: 0,
      totalQuestions: 5,
      questions: questions.map((q) => q._id),
      version: 1,
    });

    return { session, question: questions[0] };
  };

  it('should reject follow-up when session status is not IN_PROGRESS or FOLLOW_UP', async () => {
    const service = createService();
    const { session, question } = await setupSession('COMPLETED');

    await expect(
      service.processFollowUp(
        session._id.toString(),
        { questionId: question._id.toString(), candidateAnswer: 'Là một vòng lặp.' },
        userId
      )
    ).rejects.toThrow(AppError);
  });

  it('should reject follow-up for non-existent question', async () => {
    const service = createService();
    const { session } = await setupSession('IN_PROGRESS');
    const fakeQuestionId = new mongoose.Types.ObjectId().toString();

    await expect(
      service.processFollowUp(
        session._id.toString(),
        { questionId: fakeQuestionId, candidateAnswer: 'Câu trả lời.' },
        userId
      )
    ).rejects.toThrow(AppError);
  });

  it('should process first follow-up, change state to FOLLOW_UP, and store turn', async () => {
    const service = createService();
    const { session, question } = await setupSession('IN_PROGRESS');

    const result = await service.processFollowUp(
      session._id.toString(),
      { questionId: question._id.toString(), candidateAnswer: 'Event Loop xử lý bất đồng bộ.' },
      userId
    );

    expect(result.shouldFollowUp).toBe(true);
    expect(result.turnIndex).toBe(1);
    expect(result.maxTurns).toBe(3);
    expect(result.followUpQuestion).toBeDefined();

    // Verify session updated to FOLLOW_UP
    const updatedSession = await InterviewSessionModel.findById(session._id);
    expect(updatedSession?.status).toBe('FOLLOW_UP');

    // Verify turn stored in DB
    const turns = await turnRepo.findByQuestion(session._id.toString(), question._id.toString());
    expect(turns).toHaveLength(2);
    expect(turns[0].role).toBe('CANDIDATE');
    expect(turns[0].content.vi).toBe('Event Loop xử lý bất đồng bộ.');
    expect(turns[1].role).toBe('INTERVIEWER');
    expect(turns[1].type).toBe('FOLLOW_UP');
  });

  it('should cap follow-up when max turns reached', async () => {
    const service = createService();
    const { session, question } = await setupSession('FOLLOW_UP');
    const sId = session._id.toString();
    const qId = question._id.toString();

    // Seed 3 rounds of turns already
    await turnRepo.createTurn({
      sessionId: session._id,
      questionId: question._id,
      turnIndex: 0,
      role: 'CANDIDATE',
      type: 'ANSWER',
      content: { vi: 'a1', en: 'a1' },
    });
    await turnRepo.createTurn({
      sessionId: session._id,
      questionId: question._id,
      turnIndex: 1,
      role: 'INTERVIEWER',
      type: 'FOLLOW_UP',
      content: { vi: 'f1', en: 'f1' },
    });
    await turnRepo.createTurn({
      sessionId: session._id,
      questionId: question._id,
      turnIndex: 2,
      role: 'CANDIDATE',
      type: 'ANSWER',
      content: { vi: 'a2', en: 'a2' },
    });
    await turnRepo.createTurn({
      sessionId: session._id,
      questionId: question._id,
      turnIndex: 3,
      role: 'INTERVIEWER',
      type: 'FOLLOW_UP',
      content: { vi: 'f2', en: 'f2' },
    });
    await turnRepo.createTurn({
      sessionId: session._id,
      questionId: question._id,
      turnIndex: 4,
      role: 'CANDIDATE',
      type: 'ANSWER',
      content: { vi: 'a3', en: 'a3' },
    });
    await turnRepo.createTurn({
      sessionId: session._id,
      questionId: question._id,
      turnIndex: 5,
      role: 'INTERVIEWER',
      type: 'FOLLOW_UP',
      content: { vi: 'f3', en: 'f3' },
    });

    const result = await service.processFollowUp(
      sId,
      { questionId: qId, candidateAnswer: 'a4' },
      userId
    );

    expect(result.shouldFollowUp).toBe(false);
    expect(result.turnIndex).toBe(3);
  });

  it('should allow submitting answers when session is in FOLLOW_UP state', async () => {
    const service = createService();
    const { session, question } = await setupSession('FOLLOW_UP');
    const sId = session._id.toString();
    const qId = question._id.toString();

    await expect(
      service.submitAnswers(
        sId,
        [{ questionId: qId, candidateAnswer: 'Câu trả lời cuối cùng' }],
        userId
      )
    ).resolves.toBeDefined();
  });

  it('should retrieve conversation history for a session', async () => {
    const service = createService();
    const { session, question } = await setupSession('IN_PROGRESS');
    const sId = session._id.toString();
    const qId = question._id.toString();

    await service.processFollowUp(
      sId,
      { questionId: qId, candidateAnswer: 'Answer 1' },
      userId
    );

    const history = await service.getConversationHistory(sId, userId);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].sessionId.toString()).toBe(sId);
  });
});
