import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ConversationTurnRepository } from '../../src/repositories/ConversationTurnRepository';
import { ConversationTurnModel } from '../../src/models/ConversationTurn';
import { InterviewSessionModel } from '../../src/models/InterviewSession';

let mongoReplSet: MongoMemoryReplSet;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoReplSet.getUri());
  await ConversationTurnModel.createIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoReplSet.stop();
});

beforeEach(async () => {
  await ConversationTurnModel.deleteMany({});
  await InterviewSessionModel.deleteMany({});
});

describe('ConversationTurnRepository (Micro-Task 1.5b)', () => {
  const userId = new mongoose.Types.ObjectId().toHexString();

  it('should create and retrieve turns for a question in ascending order', async () => {
    const session = await InterviewSessionModel.create({
      userId,
      status: 'IN_PROGRESS',
      setupData: {},
    });
    const sessionId = session._id.toString();
    const questionId = new mongoose.Types.ObjectId().toString();

    const repo = new ConversationTurnRepository().forOwner(userId);

    await repo.createTurn({
      sessionId: session._id,
      questionId: new mongoose.Types.ObjectId(questionId),
      turnIndex: 0,
      role: 'INTERVIEWER',
      type: 'INITIAL_QUESTION',
      content: { vi: 'Câu hỏi ban đầu', en: 'Initial question' },
      metadata: {},
    });

    await repo.createTurn({
      sessionId: session._id,
      questionId: new mongoose.Types.ObjectId(questionId),
      turnIndex: 1,
      role: 'CANDIDATE',
      type: 'ANSWER',
      content: { vi: 'Câu trả lời của ứng viên', en: 'Candidate answer' },
      metadata: {},
    });

    const count = await repo.countTurns(sessionId, questionId);
    expect(count).toBe(2);

    const turns = await repo.findByQuestion(sessionId, questionId);
    expect(turns).toHaveLength(2);
    expect(turns[0].turnIndex).toBe(0);
    expect(turns[1].turnIndex).toBe(1);

    const latest = await repo.getLatestTurn(sessionId, questionId);
    expect(latest?.turnIndex).toBe(1);
    expect(latest?.role).toBe('CANDIDATE');
  });

  it('should reject duplicate turnIndex on the same question', async () => {
    const session = await InterviewSessionModel.create({
      userId,
      status: 'IN_PROGRESS',
      setupData: {},
    });
    const questionId = new mongoose.Types.ObjectId();

    const repo = new ConversationTurnRepository().forOwner(userId);

    await repo.createTurn({
      sessionId: session._id,
      questionId,
      turnIndex: 0,
      role: 'INTERVIEWER',
      type: 'INITIAL_QUESTION',
      content: { vi: 'Q1', en: 'Q1' },
      metadata: {},
    });

    await expect(
      repo.createTurn({
        sessionId: session._id,
        questionId,
        turnIndex: 0,
        role: 'INTERVIEWER',
        type: 'INITIAL_QUESTION',
        content: { vi: 'Q1 duplicate', en: 'Q1 duplicate' },
        metadata: {},
      })
    ).rejects.toThrow();
  });

  it('should prevent access to session owned by another user when scoped with forOwner', async () => {
    const session = await InterviewSessionModel.create({
      userId: new mongoose.Types.ObjectId().toHexString(), // other user
      status: 'IN_PROGRESS',
      setupData: {},
    });
    const questionId = new mongoose.Types.ObjectId().toString();

    await ConversationTurnModel.create({
      sessionId: session._id,
      questionId: new mongoose.Types.ObjectId(questionId),
      turnIndex: 0,
      role: 'INTERVIEWER',
      type: 'INITIAL_QUESTION',
      content: { vi: 'Secret Question', en: 'Secret Question' },
      metadata: {},
    });

    const repo = new ConversationTurnRepository().forOwner(userId); // current user
    const turns = await repo.findBySession(session._id.toString());
    expect(turns).toHaveLength(0);
  });
});
