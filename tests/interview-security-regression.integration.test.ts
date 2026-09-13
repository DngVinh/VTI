import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_at_least_32_characters_long_12345';
  process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_at_least_32_characters_long_67890';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
  process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'false';
  process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'AI_ONLY';
});

import request from 'supertest';
import http from 'http';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { container } from 'tsyringe';
import '../src/config/di';
import User from '../src/models/user.model';
import { createApp } from '../src/app';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import Technology from '../src/models/technology.model';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { IJobScheduler } from '../src/domain/jobs/IJobScheduler';
import { IJobHandler } from '../src/domain/jobs/IJobHandler';
import { GenerateQuestionJobHandler } from '../src/domain/jobs/handlers/GenerateQuestionJobHandler';
import { EvaluateAnswersJobHandler } from '../src/domain/jobs/handlers/EvaluateAnswersJobHandler';
import { createContentHash } from '../src/domain/question-bank/hashing';
import { MockAiProvider } from '../src/services/ai/providers/MockAiProvider';
import { AgendaJobScheduler } from '../src/infrastructure/jobs/AgendaJobScheduler';
import { QuestionBankSelector } from '../src/domain/interview/question-source/QuestionBankSelector';
import { generateAuthTokens } from '../src/utils/token';

let replicaSet: MongoMemoryReplSet;
let app: any;

describe('AIP-66 Interview Security & Regression Integration', () => {
  let testRoleId: string;
  let testLevelId: string;
  let testTechId: string;
  let candidateToken: string;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replicaSet.getUri(), {
      dbName: 'interview_security_regression_test'
    });

    vi.spyOn(AgendaJobScheduler.prototype, 'enqueue').mockImplementation(async function (jobName: string, data: any) {
      const genHandler = container.resolve(GenerateQuestionJobHandler);
      const evalHandler = container.resolve(EvaluateAnswersJobHandler);
      if (jobName === 'GENERATE_QUESTIONS') {
        await genHandler.handle(data);
      } else if (jobName === 'EVALUATE_ANSWERS') {
        await evalHandler.handle(data);
      }
    });

    vi.spyOn(MockAiProvider.prototype, 'generateQuestions').mockImplementation(async () => {
      return {
        data: [
          { order: 1, difficulty: 'Easy', category: 'Fundamentals', content: { en: 'AI Question 1 EN', vi: 'AI Câu hỏi 1 VI' } },
          { order: 2, difficulty: 'Medium', category: 'Fundamentals', content: { en: 'AI Question 2 EN', vi: 'AI Câu hỏi 2 VI' } },
          { order: 3, difficulty: 'Medium', category: 'Fundamentals', content: { en: 'AI Question 3 EN', vi: 'AI Câu hỏi 3 VI' } },
          { order: 4, difficulty: 'Hard', category: 'Fundamentals', content: { en: 'AI Question 4 EN', vi: 'AI Câu hỏi 4 VI' } },
          { order: 5, difficulty: 'Hard', category: 'Fundamentals', content: { en: 'AI Question 5 EN', vi: 'AI Câu hỏi 5 VI' } }
        ],
        audit: { promptTokenCount: 15, candidatesTokenCount: 65, totalTokenCount: 80 }
      };
    });

    vi.spyOn(MockAiProvider.prototype, 'evaluateAnswers').mockImplementation(async (questions: any[]) => {
      return {
        data: {
          evaluations: questions.map((q, idx) => ({
            questionId: q._id?.toString() || q.id,
            score: 8,
            feedback: {
              vi: `Đánh giá câu ${idx + 1}`,
              en: `Evaluation for question ${idx + 1}`
            }
          })),
          overallScore: 8,
          dimensions: [
            { name: 'Technical Depth', score: 8, reasoning: 'Technical understanding is solid.' },
            { name: 'Problem Solving', score: 8, reasoning: 'The approach is structured.' },
            { name: 'System Design & Best Practices', score: 8, reasoning: 'The solution follows sound practices.' },
            { name: 'Communication', score: 8, reasoning: 'The explanation is clear.' },
            { name: 'Practical Experience', score: 8, reasoning: 'The solution is applicable.' },
          ],
          learningPath: []
        },
        audit: { promptTokenCount: 30, candidatesTokenCount: 80, totalTokenCount: 110 }
      };
    });

    app = createApp();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replicaSet.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();

    const role = await Role.create({
      code: 'BACKEND',
      name: 'Backend Engineer',
      description: 'Backend role',
      status: 'ACTIVE'
    });
    testRoleId = role.id;

    const level = await Level.create({
      code: 'SENIOR',
      name: 'Senior',
      description: 'Senior level',
      status: 'ACTIVE'
    });
    testLevelId = level.id;

    const tech = await Technology.create({
      code: 'NODEJS',
      name: 'Node.js',
      description: 'Node.js runtime',
      roles: [role._id],
      status: 'ACTIVE'
    });
    testTechId = tech.id;

    const candidate = await User.create({
      email: `candidate-${new Types.ObjectId().toString()}@example.test`,
      passwordHash: 'hashed-password',
      fullName: 'Regression Candidate',
      role: 'CANDIDATE',
      status: 'ACTIVE',
    });
    candidateToken = generateAuthTokens(candidate.id, 'CANDIDATE').accessToken;
  });

  const seedQuestionBankQuestions = async (count: number) => {
    const difficulties = ['EASY', 'MEDIUM', 'MEDIUM', 'HARD', 'HARD'];
    const created = [];
    for (let i = 0; i < count; i++) {
      const qId = new Types.ObjectId();
      const codeNum = String(i + 1).padStart(6, '0');
      await Question.create({
        _id: qId,
        code: `QB-2026-${codeNum}`,
        lifecycleStatus: 'ACTIVE',
        currentPublishedVersionId: new Types.ObjectId(),
        primaryRoleId: new Types.ObjectId(testRoleId),
        ownerId: new Types.ObjectId(),
        levelIds: [new Types.ObjectId(testLevelId)],
        technologies: [{ technologyId: new Types.ObjectId(testTechId), relevance: 100 }],
        createdBy: new Types.ObjectId(),
        updatedBy: new Types.ObjectId()
      });

      const versionId = new Types.ObjectId();
      await Question.updateOne({ _id: qId }, { currentPublishedVersionId: versionId });
      await QuestionVersion.create({
        _id: versionId,
        questionId: qId,
        versionNumber: 1,
        status: 'PUBLISHED',
        revision: 0,
        prompt: {
          vi: `Câu hỏi ngân hàng số ${i + 1} tiếng Việt`,
          en: `Bank question number ${i + 1} in English`
        },
        explanation: { vi: `Giải thích ${i + 1}`, en: `Explanation ${i + 1}` },
        followUps: [],
        questionType: 'TECHNICAL',
        difficulty: difficulties[i % 5],
        primaryRoleId: new Types.ObjectId(testRoleId),
        additionalRoleIds: [],
        levelIds: [new Types.ObjectId(testLevelId)],
        technologies: [{ technologyId: new Types.ObjectId(testTechId), relevance: 100 }],
        technologyAgnostic: false,
        classificationComplete: true,
        topic: 'Backend Architecture',
        tags: ['backend', 'test'],
        referenceAnswer: { vi: `Đáp án tham chiếu ${i + 1}`, en: `Reference answer ${i + 1}` },
        learningObjective: { vi: `Mục tiêu ${i + 1}`, en: `Objective ${i + 1}` },
        estimatedTimeSeconds: 180,
        rubric: [
          {
            key: 'tech',
            title: { vi: 'Kỹ thuật', en: 'Technical' },
            description: { vi: 'Mô tả', en: 'Description' },
            weight: 100,
            criteria: [{ point: 10, descriptor: { vi: 'Tốt', en: 'Good' } }]
          }
        ],
        origin: 'MANUAL',
        contentHash: createContentHash({
          prompt: {
            vi: `Câu hỏi ngân hàng số ${i + 1} tiếng Việt`,
            en: `Bank question number ${i + 1} in English`,
          },
          difficulty: difficulties[i % 5],
        }),
        createdBy: new Types.ObjectId(),
        updatedBy: new Types.ObjectId(),
        authorId: new Types.ObjectId(),
        publishedAt: new Date()
      });
      created.push({ qId, versionId });
    }
    return created;
  };

  describe('Candidate Security Boundary (Zod Validation)', () => {
    it('rejects candidate payload attempting to supply questionSourceMode', async () => {
      const res = await request(app)
        .post('/api/v1/interviews')
        .send({
          jobPosition: testRoleId,
          level: testLevelId,
          techStacks: [testTechId],
          questionSourceMode: 'BANK_ONLY'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects candidate payload attempting to inject question bank IDs or questionIds', async () => {
      const res = await request(app)
        .post('/api/v1/interviews')
        .send({
          jobPosition: testRoleId,
          level: testLevelId,
          techStacks: [testTechId],
          questionBankQuestionId: new Types.ObjectId().toString(),
          questionIds: [new Types.ObjectId().toString()]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid interview setup inputs with missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/interviews')
        .send({
          jobPosition: testRoleId
          // missing level and techStacks
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Provenance Sanitization & Candidate DTO Boundary', () => {
    it('persists full provenance in DB but completely strips provenance and internal metadata from candidate responses', async () => {
      // Configure Question Bank Integration ON and BANK_ONLY mode
      const origEnabled = process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED;
      const origMode = process.env.INTERVIEW_QUESTION_SOURCE_MODE;
      process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
      process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'BANK_ONLY';

      try {
        await seedQuestionBankQuestions(10);

        // 1. Create interview session via API
        const createRes = await request(app)
          .post('/api/v1/interviews')
          .set('Authorization', `Bearer ${candidateToken}`)
          .send({
            jobPosition: testRoleId,
            level: testLevelId,
            techStacks: [testTechId]
          });

        expect(createRes.status).toBe(201);
        const sessionId = createRes.body.data.id || createRes.body.data._id;
        expect(sessionId).toBeDefined();

        // 2. Trigger question generation
        const genRes = await request(app)
          .post(`/api/v1/interviews/${sessionId}/generate`)
          .set('Authorization', `Bearer ${candidateToken}`)
          .send();

        expect(genRes.status).toBe(200);

        // 3. Fetch candidate session view via GET /api/v1/interviews/:id
        const getRes = await request(app)
          .get(`/api/v1/interviews/${sessionId}`)
          .set('Authorization', `Bearer ${candidateToken}`)
          .send();

        expect(getRes.status).toBe(200);
        expect(getRes.body.success).toBe(true);

        const candidateQuestions = getRes.body.data.questions;
        expect(candidateQuestions).toBeDefined();
        expect(candidateQuestions.length).toBe(5);

        // Candidate DTO verification: strict leak prevention
        for (const q of candidateQuestions) {
          expect(q.order).toBeGreaterThanOrEqual(1);
          expect(q.order).toBeLessThanOrEqual(5);
          expect(q.content).toBeDefined();

          // FORBIDDEN candidate fields:
          expect(q).not.toHaveProperty('provenance');
          expect(q).not.toHaveProperty('source');
          expect(q).not.toHaveProperty('questionBankQuestionId');
          expect(q).not.toHaveProperty('questionBankVersionId');
          expect(q).not.toHaveProperty('questionBankVersionNumber');
          expect(q).not.toHaveProperty('sourceFingerprint');
          expect(q).not.toHaveProperty('embeddingId');
          expect(q).not.toHaveProperty('vectorId');
          expect(q).not.toHaveProperty('generationSeed');
        }

        // 4. DB verification: internal DB MUST preserve audit provenance
        const dbQuestions = await InterviewQuestionModel.find({ sessionId }).sort({ order: 1 });
        expect(dbQuestions.length).toBe(5);
        for (const dbQ of dbQuestions) {
          expect(dbQ.sourceType).toBe('QUESTION_BANK');
          expect(dbQ.questionBankQuestionId).toBeDefined();
          expect(dbQ.questionBankVersionId).toBeDefined();
          expect(dbQ.selectionPolicyVersion).toBeDefined();
          expect(dbQ.promptSnapshotHash).toBeDefined();
          expect(dbQ.selectedAt).toBeDefined();
        }
      } finally {
        process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = origEnabled;
        process.env.INTERVIEW_QUESTION_SOURCE_MODE = origMode;
      }
    });
  });

  describe('Feature Flag Invariant (Safe-Off / Rollback)', () => {
    it('when INTEGRATION_ENABLED is false, Question Bank is never accessed and questions are purely AI generated', async () => {
      const origEnabled = process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED;
      const origMode = process.env.INTERVIEW_QUESTION_SOURCE_MODE;
      process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'false';
      process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'BANK_ONLY'; // Even if configured BANK_ONLY, flag false must force AI_ONLY

      const qbSelector = container.resolve(QuestionBankSelector);
      const selectSpy = vi.spyOn(qbSelector, 'findEligibleQuestions');

      try {
        await seedQuestionBankQuestions(5);

        const createRes = await request(app)
          .post('/api/v1/interviews')
          .set('Authorization', `Bearer ${candidateToken}`)
          .send({
            jobPosition: testRoleId,
            level: testLevelId,
            techStacks: [testTechId]
          });

        const sessionId = createRes.body.data.id || createRes.body.data._id;

        const genRes = await request(app)
          .post(`/api/v1/interviews/${sessionId}/generate`)
          .set('Authorization', `Bearer ${candidateToken}`)
          .send();

        expect(genRes.status).toBe(200);

        // Verify QuestionBankSelector was NOT called
        expect(selectSpy).not.toHaveBeenCalled();

        // Verify DB questions are from AI
        const dbQuestions = await InterviewQuestionModel.find({ sessionId }).sort({ order: 1 });
        expect(dbQuestions.length).toBe(5);
        for (const dbQ of dbQuestions) {
          expect(dbQ.sourceType).toBe('AI_GENERATED');
          expect(dbQ.questionBankQuestionId).toBeNull();
          expect(dbQ.selectionPolicyVersion).toBeDefined();
        }
      } finally {
        selectSpy.mockRestore();
        process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = origEnabled;
        process.env.INTERVIEW_QUESTION_SOURCE_MODE = origMode;
      }
    });
  });

  describe('End-to-End Interview Lifecycle Regression', () => {
    it('executes complete lifecycle: create -> generate -> stream -> progress -> submit -> evaluate without errors', async () => {
      // 1. Create Session
      const createRes = await request(app)
        .post('/api/v1/interviews')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          jobPosition: testRoleId,
          level: testLevelId,
          techStacks: [testTechId]
        });

      expect(createRes.status).toBe(201);
      const sessionId = createRes.body.data.id || createRes.body.data._id;
      expect(createRes.body.data.status).toBe('PENDING');

      // 2. Generate questions
      const genRes = await request(app)
        .post(`/api/v1/interviews/${sessionId}/generate`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send();

      expect(genRes.status).toBe(200);
      expect(genRes.body.data.status).toBe('IN_PROGRESS');
      const questions = genRes.body.data.questions;
      expect(questions.length).toBe(5);

      // 3. Check Stream initial response
      await new Promise<void>((resolve, reject) => {
        const server = app.listen(0, () => {
          const address = server.address() as any;
          const req = http.get(
            `http://127.0.0.1:${address.port}/api/v1/interviews/${sessionId}/stream`,
            { headers: { Authorization: `Bearer ${candidateToken}` } },
            (res) => {
              res.once('data', (chunk: Buffer) => {
                const text = chunk.toString();
                const dataLine = text.split(/\r?\n/).find((line) => line.startsWith('data:'));
                expect(dataLine).toBeDefined();
                const parsed = JSON.parse(dataLine!.replace(/^data:\s*/, ''));
                expect(parsed.status).toBe('IN_PROGRESS');
                req.removeAllListeners('error');
                res.removeAllListeners('error');
                req.destroy();
                server.close(() => resolve());
              });
            }
          );
          req.on('error', (err: any) => {
            if (err.message !== 'aborted' && err.code !== 'ECONNRESET') {
              reject(err);
            }
          });
        });
      });

      // 4. Save intermediate progress
      const firstQId = questions[0].id || questions[0]._id;
      const progressRes = await request(app)
        .post(`/api/v1/interviews/${sessionId}/progress`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          answers: [
            { questionId: firstQId, candidateAnswer: 'Đây là câu trả lời nháp cho câu 1' }
          ]
        });

      expect(progressRes.status).toBe(200);

      // 5. Submit final answers
      const answersPayload = questions.map((q: any, index: number) => ({
        questionId: q.id || q._id,
        candidateAnswer: `Câu trả lời hoàn chỉnh số ${index + 1}`
      }));

      const submitRes = await request(app)
        .post(`/api/v1/interviews/${sessionId}/submit`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ answers: answersPayload });

      expect(submitRes.status).toBe(200);

      // Because DirectJobScheduler executes immediately, session completes evaluation
      const finalSessionRes = await request(app)
        .get(`/api/v1/interviews/${sessionId}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send();

      expect(finalSessionRes.status).toBe(200);
      expect(finalSessionRes.body.data.status).toBe('COMPLETED');
      expect(finalSessionRes.body.data.questions.length).toBe(5);
    });
  });
});
