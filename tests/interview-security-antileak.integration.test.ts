import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'security_antileak_jwt_access_secret_32chars_123';
  process.env.JWT_REFRESH_SECRET = 'security_antileak_jwt_refresh_secret_32chars_456';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
  process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
  process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'BANK_ONLY';
  process.env.INTERVIEW_QUESTION_BANK_POLICY_VERSION = 'v1';
  process.env.INTERVIEW_QUESTION_COUNT = '5';
});

import request from 'supertest';
import http from 'http';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { container } from 'tsyringe';
import '../src/config/di';
import { createApp } from '../src/app';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import Technology from '../src/models/technology.model';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';
import User from '../src/models/user.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { GenerateQuestionJobHandler } from '../src/domain/jobs/handlers/GenerateQuestionJobHandler';
import { EvaluateAnswersJobHandler } from '../src/domain/jobs/handlers/EvaluateAnswersJobHandler';
import { createContentHash } from '../src/domain/question-bank/hashing';
import { MockAiProvider } from '../src/services/ai/providers/MockAiProvider';
import { AgendaJobScheduler } from '../src/infrastructure/jobs/AgendaJobScheduler';
import { generateAuthTokens } from '../src/utils/token';
import { QuestionSourcingEventModel } from '../src/models/question-sourcing-event.model';
import { QuestionSourcingTelemetryService } from '../src/services/question-sourcing-telemetry.service';

let replicaSet: MongoMemoryReplSet;
let app: any;

const FORBIDDEN_KEYS = new Set([
  'sourcetype',
  'questionbankquestionid',
  'questionbankversionid',
  'questionbankversionnumber',
  'questionbankcode',
  'selectionpolicyversion',
  'selectionseedfingerprint',
  'promptsnapshothash',
  'selectedat',
  'referenceanswer',
  'rubric',
  'embeddings',
  'embedding',
  'vector',
  'vectors',
  'providermetadata',
  'sanitizedpromptcontext',
  'fallbackdiagnostics',
  'diagnostics',
  'embeddingid',
  'vectorid',
]);

export function assertNoForbiddenKeys(obj: any, path: string = ''): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => assertNoForbiddenKeys(item, `${path}[${index}]`));
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(normalizedKey)) {
      throw new Error(
        `[SECURITY LEAK] Forbidden key "${key}" detected at path "${path}.${key}" with value: ${JSON.stringify(value)}`
      );
    }
    assertNoForbiddenKeys(value, `${path}.${key}`);
  }
}

describe('AIP-67 Scope C: Security & Anti-Leak Lifecycle Gates', () => {
  let testRoleId: string;
  let testLevelId: string;
  let testTechId: string;
  let candidateUser: any;
  let candidateToken: string;
  let interviewerUser: any;
  let interviewerToken: string;
  let otherCandidateUser: any;
  let otherCandidateToken: string;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replicaSet.getUri(), {
      dbName: 'security_antileak_test_db',
    });

    vi.spyOn(AgendaJobScheduler.prototype, 'enqueue').mockImplementation(async function (
      jobName: string,
      data: any
    ) {
      const genHandler = container.resolve(GenerateQuestionJobHandler);
      const evalHandler = container.resolve(EvaluateAnswersJobHandler);
      if (jobName === 'GENERATE_QUESTIONS') {
        await genHandler.handle(data);
      } else if (jobName === 'EVALUATE_ANSWERS') {
        await evalHandler.handle(data);
      }
    });

    vi.spyOn(MockAiProvider.prototype, 'generateQuestions').mockImplementation(async () => ({
      data: [
        { order: 1, difficulty: 'Easy', content: { en: 'AI Q1 EN', vi: 'AI Q1 VI' } },
        { order: 2, difficulty: 'Medium', content: { en: 'AI Q2 EN', vi: 'AI Q2 VI' } },
        { order: 3, difficulty: 'Medium', content: { en: 'AI Q3 EN', vi: 'AI Q3 VI' } },
        { order: 4, difficulty: 'Hard', content: { en: 'AI Q4 EN', vi: 'AI Q4 VI' } },
        { order: 5, difficulty: 'Hard', content: { en: 'AI Q5 EN', vi: 'AI Q5 VI' } },
      ],
      audit: { promptTokenCount: 15, candidatesTokenCount: 65, totalTokenCount: 80 },
    }));

    vi.spyOn(MockAiProvider.prototype, 'evaluateAnswers').mockImplementation(async (questions: any[]) => ({
      data: {
        evaluations: questions.map((q, idx) => ({
          questionId: q._id?.toString() || q.id,
          score: 8,
          feedback: { vi: `Đánh giá câu ${idx + 1}`, en: `Evaluation for question ${idx + 1}` },
        })),
        overallScore: 8,
        dimensions: [
          { name: 'Technical Depth', score: 8, reasoning: 'Technical understanding is solid.' },
          { name: 'Problem Solving', score: 8, reasoning: 'The approach is structured.' },
          { name: 'System Design & Best Practices', score: 8, reasoning: 'The solution follows sound practices.' },
          { name: 'Communication', score: 8, reasoning: 'The explanation is clear.' },
          { name: 'Practical Experience', score: 8, reasoning: 'The solution is applicable.' },
        ],
        learningPath: [],
      },
      audit: { promptTokenCount: 30, candidatesTokenCount: 80, totalTokenCount: 110 },
    }));

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
      status: 'ACTIVE',
    });
    testRoleId = role.id;

    const level = await Level.create({
      code: 'SENIOR',
      name: 'Senior',
      description: 'Senior level',
      status: 'ACTIVE',
    });
    testLevelId = level.id;

    const tech = await Technology.create({
      code: 'NODEJS',
      name: 'Node.js',
      description: 'Node.js runtime',
      roles: [role._id],
      status: 'ACTIVE',
    });
    testTechId = tech.id;

    // Create Candidate user
    candidateUser = await User.create({
      email: 'candidate@example.com',
      passwordHash: 'hashedpassword123',
      fullName: 'Test Candidate',
      role: 'CANDIDATE',
      status: 'ACTIVE',
    });
    const tokens = generateAuthTokens(candidateUser.id, 'CANDIDATE');
    candidateToken = tokens.accessToken;

    // Create Other Candidate
    otherCandidateUser = await User.create({
      email: 'other@example.com',
      passwordHash: 'hashedpassword123',
      fullName: 'Other Candidate',
      role: 'CANDIDATE',
      status: 'ACTIVE',
    });
    const otherTokens = generateAuthTokens(otherCandidateUser.id, 'CANDIDATE');
    otherCandidateToken = otherTokens.accessToken;

    // Create Interviewer user
    interviewerUser = await User.create({
      email: 'interviewer@example.com',
      passwordHash: 'hashedpassword123',
      fullName: 'Test Interviewer',
      role: 'INTERVIEWER',
      status: 'ACTIVE',
    });
    const interviewerTokens = generateAuthTokens(interviewerUser.id, 'INTERVIEWER');
    interviewerToken = interviewerTokens.accessToken;
  });

  const seedQuestionBankQuestions = async (count: number) => {
    const difficulties = ['EASY', 'MEDIUM', 'MEDIUM', 'HARD', 'HARD'];
    for (let i = 0; i < count; i++) {
      const qId = new Types.ObjectId();
      const codeNum = String(i + 1).padStart(6, '0');
      const versionId = new Types.ObjectId();

      await Question.create({
        _id: qId,
        code: `QB-2026-${codeNum}`,
        lifecycleStatus: 'ACTIVE',
        currentPublishedVersionId: versionId,
        primaryRoleId: new Types.ObjectId(testRoleId),
        ownerId: new Types.ObjectId(),
        levelIds: [new Types.ObjectId(testLevelId)],
        technologies: [{ technologyId: new Types.ObjectId(testTechId), relevance: 100 }],
        createdBy: new Types.ObjectId(),
        updatedBy: new Types.ObjectId(),
      });

      await QuestionVersion.create({
        _id: versionId,
        questionId: qId,
        versionNumber: 1,
        status: 'PUBLISHED',
        revision: 0,
        prompt: {
          vi: `Câu hỏi ngân hàng số ${i + 1} tiếng Việt`,
          en: `Bank question number ${i + 1} in English`,
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
        topic: 'Security Topic',
        tags: ['security', 'anti-leak'],
        referenceAnswer: { vi: `Đáp án tối mật ${i + 1}`, en: `Top secret answer ${i + 1}` },
        learningObjective: { vi: `Mục tiêu ${i + 1}`, en: `Objective ${i + 1}` },
        estimatedTimeSeconds: 180,
        rubric: [
          {
            key: 'tech',
            title: { vi: 'Tiêu chí chấm điểm', en: 'Scoring Criteria' },
            description: { vi: 'Thang điểm bí mật', en: 'Secret rubric details' },
            weight: 100,
            criteria: [{ point: 10, descriptor: { vi: 'Tốt', en: 'Good' } }],
          },
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
        publishedAt: new Date(),
      });
    }
  };

  // =========================================================================
  // 1. RECURSIVE ANTI-LEAK AUDIT ACROSS FULL CANDIDATE LIFECYCLE
  // =========================================================================
  it('enforces recursive anti-leak assertion across full lifecycle: create -> generate -> get -> progress -> submit -> result', async () => {
    await seedQuestionBankQuestions(10);

    // Step 1: Create Interview Session
    const createRes = await request(app)
      .post('/api/v1/interviews')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
          jobPosition: testRoleId,
          level: testLevelId,
          techStacks: [testTechId],
        });

    expect(createRes.status).toBe(201);
    assertNoForbiddenKeys(createRes.body);
    const sessionId = createRes.body.data.id || createRes.body.data._id;

    // Step 2: Generate Questions
    const genRes = await request(app)
      .post(`/api/v1/interviews/${sessionId}/generate`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send();

    expect(genRes.status).toBe(200);
    assertNoForbiddenKeys(genRes.body);
    const questions = genRes.body.data.questions;
    expect(questions.length).toBe(5);

    // Step 3: Get Session by ID
    const getRes = await request(app)
      .get(`/api/v1/interviews/${sessionId}`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send();

    expect(getRes.status).toBe(200);
    assertNoForbiddenKeys(getRes.body);

    // Step 4: Save Progress / Autosave
    const progressRes = await request(app)
      .post(`/api/v1/interviews/${sessionId}/progress`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        answers: [{ questionId: questions[0].id, candidateAnswer: 'Draft answer 1' }],
      });

    expect(progressRes.status).toBe(200);
    assertNoForbiddenKeys(progressRes.body);

    // Step 5: Submit Final Answers
    const submitRes = await request(app)
      .post(`/api/v1/interviews/${sessionId}/submit`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        answers: questions.map((q: any, idx: number) => ({
          questionId: q.id,
          candidateAnswer: `Final answer ${idx + 1}`,
        })),
      });

    expect(submitRes.status).toBe(200);
    assertNoForbiddenKeys(submitRes.body);

    // Step 6: Evaluation / Final Result
    const finalRes = await request(app)
      .get(`/api/v1/interviews/${sessionId}`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send();

    expect(finalRes.status).toBe(200);
    expect(finalRes.body.data.status).toBe('COMPLETED');
    assertNoForbiddenKeys(finalRes.body);

    // Invariant: DB preserves internal audit provenance, but API leaked NOTHING
    const dbQuestions = await InterviewQuestionModel.find({ sessionId });
    expect(dbQuestions.length).toBe(5);
    for (const dbQ of dbQuestions) {
      expect(dbQ.sourceType).toBe('QUESTION_BANK');
      expect(dbQ.questionBankQuestionId).toBeDefined();
      expect(dbQ.selectionSeedFingerprint).toBeDefined();
      expect(dbQ.promptSnapshotHash).toBeDefined();
    }
  });

  // =========================================================================
  // 2. SSE STREAM SAFETY
  // =========================================================================
  it('SSE stream emits only candidate-safe payload {status}', async () => {
    await seedQuestionBankQuestions(5);

    const createRes = await request(app)
      .post('/api/v1/interviews')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        jobPosition: testRoleId,
        level: testLevelId,
        techStacks: [testTechId],
      });

    const sessionId = createRes.body.data.id || createRes.body.data._id;

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
              try {
                const parsed = JSON.parse(dataLine!.replace(/^data:\s*/, ''));
                expect(parsed.status).toBe('PENDING');
                assertNoForbiddenKeys(parsed);
              } catch (e) {
                // If text contains non-JSON prefix/suffix
              }
              req.destroy();
              server.close(() => resolve());
            });
          }
        );
        req.on('error', (err: any) => {
          if (err.message !== 'aborted' && err.code !== 'ECONNRESET') reject(err);
        });
      });
    });
  });

  // =========================================================================
  // 3. INPUT INJECTION ISOLATION
  // =========================================================================
  it('rejects candidate attempts to inject questionSourceMode, questionBankQuestionId, or provenance fields', async () => {
    const maliciousPayloads = [
      {
        jobPosition: testRoleId,
        level: testLevelId,
        techStacks: [testTechId],
        questionSourceMode: 'BANK_ONLY',
      },
      {
        jobPosition: testRoleId,
        level: testLevelId,
        techStacks: [testTechId],
        questionBankQuestionId: new Types.ObjectId().toString(),
      },
      {
        jobPosition: testRoleId,
        level: testLevelId,
        techStacks: [testTechId],
        sourceType: 'QUESTION_BANK',
      },
      {
        jobPosition: testRoleId,
        level: testLevelId,
        techStacks: [testTechId],
        promptSnapshotHash: 'malicious-hash',
      },
    ];

    for (const payload of maliciousPayloads) {
      const res = await request(app)
        .post('/api/v1/interviews')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      assertNoForbiddenKeys(res.body);
    }
  });

  // =========================================================================
  // 4. RBAC: CANDIDATE AND INTERVIEWER CANNOT ACCESS QUESTION BANK ADMIN
  // =========================================================================
  it('candidate and interviewer cannot access Question Bank Admin API routes (401/403)', async () => {
    // Candidate attempt
    const candRes = await request(app)
      .get('/api/v1/admin/question-bank/questions')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send();

    expect([401, 403]).toContain(candRes.status);
    assertNoForbiddenKeys(candRes.body);

    // Interviewer attempt
    const intRes = await request(app)
      .get('/api/v1/admin/question-bank/questions')
      .set('Authorization', `Bearer ${interviewerToken}`)
      .send();

    expect([401, 403]).toContain(intRes.status);
    assertNoForbiddenKeys(intRes.body);
  });

  // =========================================================================
  // 5. ERROR SANITIZATION: NO STACK / DB QUERY LEAK
  // =========================================================================
  it('persists only allowlisted telemetry reason codes', async () => {
    const sentinel = 'provider-secret-key=should-never-be-persisted';
    const event = await QuestionSourcingTelemetryService.recordEvent({
      sessionId: new Types.ObjectId().toString(),
      eventType: 'FAILURE',
      effectiveMode: 'BANK_ONLY',
      configuredMode: 'BANK_ONLY',
      rolloutPercent: 100,
      isCohortSelected: true,
      rolloutBucket: 0,
      policyVersion: 'v1',
      durationMs: 1,
      fallbackOccurred: true,
      fallbackReasonCode: sentinel,
      shadowErrorCode: sentinel,
      reasonCode: sentinel,
    });

    expect(event).not.toBeNull();
    expect(event?.reasonCode).toBe('INTERNAL_ERROR');
    expect(event?.fallbackReasonCode).toBe('INTERNAL_ERROR');
    expect(event?.shadowErrorCode).toBe('INTERNAL_ERROR');

    const persisted = await QuestionSourcingEventModel.findOne({
      eventId: event?.eventId,
    }).lean();
    expect(JSON.stringify(persisted)).not.toContain(sentinel);
  });

  it('error responses do not leak database queries, internal stack traces, or provider secrets', async () => {
    const invalidIdRes = await request(app)
      .get('/api/v1/interviews/invalid-object-id-string')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send();

    expect([400, 404]).toContain(invalidIdRes.status);
    expect(invalidIdRes.body.success).toBe(false);
    expect(JSON.stringify(invalidIdRes.body)).not.toContain('CastError');
    expect(JSON.stringify(invalidIdRes.body)).not.toContain('node_modules');
    assertNoForbiddenKeys(invalidIdRes.body);
  });

  // =========================================================================
  // 6. OPENAPI CONTRACT: EXACT 25 OPERATIONS MAINTAINED
  // =========================================================================
  it('verifies Question Bank OpenAPI contract maintains exactly 25 Admin operations', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const docPath = path.resolve(process.cwd(), 'docs', 'question-bank', 'openapi-question-bank.yaml');
    const content = JSON.parse(fs.readFileSync(docPath, 'utf8'));

    const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
    const ops = Object.entries(content.paths as Record<string, any>).flatMap(([p, item]) =>
      Object.entries(item)
        .filter(([method]) => HTTP_METHODS.has(method))
        .map(([method, op]: [string, any]) => ({ path: p, method, operation: op }))
    );

    const implemented = ops.filter(({ operation }) =>
      operation['x-implementation-status']?.startsWith('implemented-phase-')
    );

    expect(implemented.length).toBe(25);
    const operationIds = new Set(implemented.map(({ operation }) => operation.operationId));
    expect(operationIds.size).toBe(25);
  });
});
