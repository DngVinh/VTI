import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { runRolloutReconciliation } from '../scripts/question-bank-rollout-reconciliation';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { QuestionSourcingEventModel } from '../src/models/question-sourcing-event.model';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';

describe('AIP-68 Phase 7: Post-Rollout Reconciliation Suite', () => {
  let replSet: MongoMemoryReplSet;
  let testUserId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
    testUserId = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    await Question.deleteMany({});
    await QuestionVersion.deleteMany({});
    await InterviewQuestionModel.deleteMany({});
    await InterviewSessionModel.deleteMany({});
    await QuestionSourcingEventModel.deleteMany({});
  });

  it('verifies healthy generation runs produce HEALTHY verdict and CONTINUE_ROLLOUT', async () => {
    const q = await Question.create({
      code: 'QB-2026-000099',
      lifecycleStatus: 'ACTIVE',
      ownerId: testUserId,
      createdBy: testUserId,
      updatedBy: testUserId,
    });

    const v = await QuestionVersion.create({
      questionId: q._id,
      versionNumber: 1,
      status: 'PUBLISHED',
      difficulty: 'MEDIUM',
      prompt: { vi: 'Câu hỏi test', en: 'Test question' },
      origin: 'MANUAL',
      contentHash: '0000000000000000000000000000000000000000000000000000000000000099',
      createdBy: testUserId,
      updatedBy: testUserId,
    });

    const session = await InterviewSessionModel.create({
      userId: testUserId,
      status: 'COMPLETED',
      metadata: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
    });

    // 2 bank questions + 3 AI questions
    const questions = [
      {
        sessionId: session._id,
        order: 1,
        difficulty: 'MEDIUM',
        content: { vi: 'Câu 1', en: 'Q1' },
        sourceType: 'QUESTION_BANK',
        questionBankQuestionId: q._id,
        questionBankVersionId: v._id,
        promptSnapshotHash: 'hash-snap-1',
      },
      {
        sessionId: session._id,
        order: 2,
        difficulty: 'MEDIUM',
        content: { vi: 'Câu 2', en: 'Q2' },
        sourceType: 'QUESTION_BANK',
        questionBankQuestionId: q._id,
        questionBankVersionId: v._id,
        promptSnapshotHash: 'hash-snap-2',
      },
      {
        sessionId: session._id,
        order: 3,
        difficulty: 'EASY',
        content: { vi: 'Câu 3', en: 'Q3' },
        sourceType: 'AI_GENERATED',
      },
      {
        sessionId: session._id,
        order: 4,
        difficulty: 'HARD',
        content: { vi: 'Câu 4', en: 'Q4' },
        sourceType: 'AI_GENERATED',
      },
      {
        sessionId: session._id,
        order: 5,
        difficulty: 'HARD',
        content: { vi: 'Câu 5', en: 'Q5' },
        sourceType: 'AI_GENERATED',
      },
    ];
    await InterviewQuestionModel.create(questions);

    await QuestionSourcingEventModel.create({
      eventId: 'qse_rec_1',
      sessionHash: '0000000000000000000000000000000000000000000000000000000000000100',
      eventType: 'SUCCESS',
      effectiveMode: 'HYBRID',
      configuredMode: 'HYBRID',
      rolloutPercent: 50,
      isCohortSelected: true,
      rolloutBucket: 20,
      policyVersion: 'v1',
      durationMs: 250,
      bankQuestionCount: 2,
      aiQuestionCount: 3,
      tokens: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
    });

    const report = await runRolloutReconciliation({ silent: true });

    expect(report.verdict).toBe('HEALTHY');
    expect(report.recommendedAction).toBe('CONTINUE_ROLLOUT');
    expect(report.generationSummary.totalSessionsEvaluated).toBe(1);
    expect(report.generationSummary.exactFiveCount).toBe(1);
    expect(report.generationSummary.invalidBundleCount).toBe(0);
    expect(report.sourceDistribution.questionBankCount).toBe(2);
    expect(report.sourceDistribution.aiGeneratedCount).toBe(3);
    expect(report.provenanceIntegrity.missingProvenanceCount).toBe(0);
    expect(report.provenanceIntegrity.orphanedBankReferences).toBe(0);
  });

  it('detects partial bundle (invalidBundleCount > 0) and recommends kill switch', async () => {
    const session = await InterviewSessionModel.create({
      userId: testUserId,
      status: 'IN_PROGRESS',
    });

    // Corrupted session with only 3 questions
    await InterviewQuestionModel.create([
      { sessionId: session._id, order: 1, difficulty: 'EASY', content: { vi: '1', en: '1' }, sourceType: 'AI_GENERATED' },
      { sessionId: session._id, order: 2, difficulty: 'EASY', content: { vi: '2', en: '2' }, sourceType: 'AI_GENERATED' },
      { sessionId: session._id, order: 3, difficulty: 'EASY', content: { vi: '3', en: '3' }, sourceType: 'AI_GENERATED' },
    ]);

    const report = await runRolloutReconciliation({ silent: true });

    expect(report.verdict).toBe('CORRUPTED_ANOMALIES_DETECTED');
    expect(report.recommendedAction).toBe('TRIGGER_KILL_SWITCH_AND_INVESTIGATE');
    expect(report.generationSummary.invalidBundleCount).toBe(1);
  });

  it('detects orphaned Question Bank references and recommends kill switch', async () => {
    const session = await InterviewSessionModel.create({
      userId: testUserId,
      status: 'COMPLETED',
    });

    // Sourced question referencing non-existent Question ID
    const orphanedQuestionId = new mongoose.Types.ObjectId();
    const orphanedVersionId = new mongoose.Types.ObjectId();

    await InterviewQuestionModel.create([
      {
        sessionId: session._id,
        order: 1,
        difficulty: 'EASY',
        content: { vi: '1', en: '1' },
        sourceType: 'QUESTION_BANK',
        questionBankQuestionId: orphanedQuestionId,
        questionBankVersionId: orphanedVersionId,
        promptSnapshotHash: 'hash-snap',
      },
      { sessionId: session._id, order: 2, difficulty: 'MEDIUM', content: { vi: '2', en: '2' }, sourceType: 'AI_GENERATED' },
      { sessionId: session._id, order: 3, difficulty: 'MEDIUM', content: { vi: '3', en: '3' }, sourceType: 'AI_GENERATED' },
      { sessionId: session._id, order: 4, difficulty: 'HARD', content: { vi: '4', en: '4' }, sourceType: 'AI_GENERATED' },
      { sessionId: session._id, order: 5, difficulty: 'HARD', content: { vi: '5', en: '5' }, sourceType: 'AI_GENERATED' },
    ]);

    const report = await runRolloutReconciliation({ silent: true });

    expect(report.verdict).toBe('CORRUPTED_ANOMALIES_DETECTED');
    expect(report.recommendedAction).toBe('TRIGGER_KILL_SWITCH_AND_INVESTIGATE');
    expect(report.provenanceIntegrity.orphanedBankReferences).toBe(1);
  });
});
