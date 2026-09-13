import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'observability_jwt_access_secret_32chars_123';
  process.env.JWT_REFRESH_SECRET = 'observability_jwt_refresh_secret_32chars_456';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
  process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
  process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'AI_ONLY';
  process.env.INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT = '100';
  process.env.QUESTION_SOURCING_TELEMETRY_ENABLED = 'true';
});

import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app';
import User from '../src/models/user.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { QuestionSourcingEventModel } from '../src/models/question-sourcing-event.model';
import { container } from 'tsyringe';
import { InterviewQuestionGenerationOrchestrator } from '../src/domain/interview/question-source/InterviewQuestionGenerationOrchestrator';
import { generateAuthTokens } from '../src/utils/token';

describe('AIP-68 Phase 7: Operational Telemetry & Admin Metrics Observability', () => {
  let replSet: MongoMemoryReplSet;
  let adminToken: string;
  let candidateToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri);

    // Create Admin user
    const adminUser = await User.create({
      email: 'admin-observability@vti.com.vn',
      passwordHash: 'argon2id_mock_hash_for_admin_testing_purpose',
      fullName: 'System Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      authVersion: 1,
      credentialVersion: 1,
    });
    adminUserId = adminUser._id.toString();
    adminToken = generateAuthTokens(adminUserId, 'ADMIN', undefined, undefined, 1).accessToken;

    // Create Candidate user
    const candidateUser = await User.create({
      email: 'candidate-observability@vti.com.vn',
      passwordHash: 'argon2id_mock_hash_for_candidate_testing_purpose',
      fullName: 'Test Candidate',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      authVersion: 1,
      credentialVersion: 1,
    });
    candidateToken = generateAuthTokens(candidateUser._id.toString(), 'CANDIDATE', undefined, undefined, 1).accessToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    await InterviewSessionModel.deleteMany({});
    await InterviewQuestionModel.deleteMany({});
    await QuestionSourcingEventModel.deleteMany({});
  });

  describe('Scope B.1: Telemetry Event Recording Lifecycle', () => {
    it('records structured ATTEMPT and SUCCESS events during generation', async () => {
      const orchestrator = container.resolve(InterviewQuestionGenerationOrchestrator);

      const session = await InterviewSessionModel.create({
        userId: new mongoose.Types.ObjectId(),
        jobPosition: 'Node.js Developer',
        level: 'Middle',
        status: 'GENERATING',
      });

      const bundle = await orchestrator.generateAndCommit(session._id.toString(), session.setupData);

      expect(bundle.questions).toHaveLength(5);

      const events = await QuestionSourcingEventModel.find({}).sort({ createdAt: 1 }).lean();
      expect(events.length).toBeGreaterThanOrEqual(2);

      const attemptEvent = events.find((e) => e.eventType === 'ATTEMPT');
      expect(attemptEvent).toBeDefined();
      expect(attemptEvent?.effectiveMode).toBeDefined();
      expect(attemptEvent?.sessionHash).toBeDefined();

      const successEvent = events.find((e) => e.eventType === 'SUCCESS');
      expect(successEvent).toBeDefined();
      expect(successEvent?.bundleValid).toBe(true);
      expect(successEvent?.exactFiveViolated).toBe(false);
      expect(successEvent?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('records IDEMPOTENT_NOOP telemetry event on duplicate job delivery', async () => {
      const orchestrator = container.resolve(InterviewQuestionGenerationOrchestrator);

      const session = await InterviewSessionModel.create({
        userId: new mongoose.Types.ObjectId(),
        jobPosition: 'Node.js Developer',
        level: 'Middle',
        status: 'GENERATING',
      });

      // First run
      await orchestrator.generateAndCommit(session._id.toString(), session.setupData);

      // Second run (duplicate)
      const duplicateBundle = await orchestrator.generateAndCommit(session._id.toString(), session.setupData);
      expect(duplicateBundle.diagnostics.successCode).toBe('IDEMPOTENT_NOOP');

      const noopEvent = await QuestionSourcingEventModel.findOne({ eventType: 'IDEMPOTENT_NOOP' }).lean();
      expect(noopEvent).toBeDefined();
      expect(noopEvent?.reasonCode).toBe('IDEMPOTENT_NOOP');
    });

    it('records INCONSISTENT_STATE telemetry event when session has 1..4 questions', async () => {
      const orchestrator = container.resolve(InterviewQuestionGenerationOrchestrator);

      const session = await InterviewSessionModel.create({
        userId: new mongoose.Types.ObjectId(),
        jobPosition: 'Node.js Developer',
        level: 'Middle',
        status: 'GENERATING',
      });

      // Insert 2 corrupt questions
      await InterviewQuestionModel.create([
        {
          sessionId: session._id,
          order: 1,
          difficulty: 'EASY',
          content: { vi: 'Câu 1', en: 'Q1' },
          sourceType: 'AI_GENERATED',
        },
        {
          sessionId: session._id,
          order: 2,
          difficulty: 'MEDIUM',
          content: { vi: 'Câu 2', en: 'Q2' },
          sourceType: 'AI_GENERATED',
        },
      ]);

      await expect(
        orchestrator.generateAndCommit(session._id.toString(), session.setupData)
      ).rejects.toThrow();

      const inconsistentEvent = await QuestionSourcingEventModel.findOne({
        eventType: 'INCONSISTENT_STATE',
      }).lean();
      expect(inconsistentEvent).toBeDefined();
      expect(inconsistentEvent?.exactFiveViolated).toBe(true);
    });
  });

  describe('Scope B.2: Anti-Leak & Telemetry Redaction Boundary', () => {
    it('verifies telemetry documents contain ZERO prompts, candidate answers, rubrics, embeddings, or raw session ObjectIds', async () => {
      const orchestrator = container.resolve(InterviewQuestionGenerationOrchestrator);

      const session = await InterviewSessionModel.create({
        userId: new mongoose.Types.ObjectId(),
        jobPosition: 'Security Engineer',
        level: 'Senior',
        status: 'GENERATING',
      });

      await orchestrator.generateAndCommit(session._id.toString(), session.setupData);

      const rawEvents = await mongoose.connection
        .collection('questionsourcingevents')
        .find({})
        .toArray();

      expect(rawEvents.length).toBeGreaterThan(0);

      const forbiddenKeys = [
        'content',
        'prompt',
        'answers',
        'candidateAnswer',
        'rubric',
        'embedding',
        'embeddings',
        'questionBankQuestionId',
        'questionBankVersionId',
        'rawUserId',
        'email',
        'sessionId', // strictly sessionHash only
        'candidateInput',
        'cvText',
        'jdText',
      ];

      for (const eventDoc of rawEvents) {
        for (const forbidden of forbiddenKeys) {
          expect(eventDoc[forbidden]).toBeUndefined();
        }
        // Verify sessionHash is a valid 64-char sha256 hex string, not Mongo ObjectId
        expect(eventDoc.sessionHash).toMatch(/^[a-f0-9]{64}$/);
        expect(eventDoc.sessionHash).not.toBe(session._id.toString());
      }
    });
  });

  describe('Scope B.3: Admin Metrics API Authorization & Additive Sourcing Section', () => {
    it('rejects unauthenticated request to /api/v1/admin/metrics with 401', async () => {
      const res = await request(app).get('/api/v1/admin/metrics?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z');
      expect(res.status).toBe(401);
    });

    it('rejects CANDIDATE request to /api/v1/admin/metrics with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/metrics?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z')
        .set('Authorization', `Bearer ${candidateToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 200 with users, interviews, and additive questionSourcing metrics for ADMIN', async () => {
      // Seed an event
      await QuestionSourcingEventModel.create({
        eventId: 'qse_test_001',
        sessionHash: '0000000000000000000000000000000000000000000000000000000000000001',
        eventType: 'SUCCESS',
        effectiveMode: 'AI_ONLY',
        configuredMode: 'AI_ONLY',
        rolloutPercent: 100,
        isCohortSelected: true,
        rolloutBucket: 10,
        policyVersion: 'v1',
        durationMs: 150,
        bankQuestionCount: 0,
        aiQuestionCount: 5,
        fallbackOccurred: false,
        poolInsufficient: false,
        shadowTimeout: false,
        bundleValid: true,
        exactFiveViolated: false,
        tokens: { promptTokens: 300, candidatesTokens: 150, totalTokens: 450 },
        reasonCode: 'SUCCESS',
        createdAt: new Date('2026-06-15T12:00:00.000Z'),
      });

      const res = await request(app)
        .get('/api/v1/admin/metrics?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('interviews');
      expect(res.body.data).toHaveProperty('questionSourcing');

      const qs = res.body.data.questionSourcing;
      expect(qs.totalEvents).toBe(1);
      expect(qs.successes).toBe(1);
      expect(qs.byEffectiveMode.AI_ONLY).toBe(1);
      expect(qs.totalSelectedFromAi).toBe(5);
      expect(qs.tokens.totalTokens).toBe(450);
      expect(qs.latency.avgMs).toBe(150);
    });
  });
});
