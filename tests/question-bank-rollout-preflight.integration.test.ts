import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { runRolloutPreflight } from '../scripts/question-bank-rollout-preflight';
import { manageIndexes } from '../scripts/question-bank-migration-indexes';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { InterviewSessionModel } from '../src/models/InterviewSession';

describe('AIP-68 Phase 7: Read-Only Preflight & Index Migration Suite', () => {
  let replSet: MongoMemoryReplSet;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
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
  });

  describe('Scope C: Read-Only Preflight Execution', () => {
    it('runs on empty/clean database and returns verdict without mutating state', async () => {
      await InterviewQuestionModel.collection.createIndex(
        { sessionId: 1, order: 1 },
        { unique: true, name: 'interview_questions_session_order_unique' }
      );

      const report = await runRolloutPreflight({ silent: true });

      expect(report).toBeDefined();
      expect(report.verdict).toBe('GO_READY');
      expect(report.summary.criticalViolations).toBe(0);
      expect(report.questionBank.activeQuestions).toBe(0);
      expect(report.interviewDataIntegrity.duplicateSessionOrderCount).toBe(0);

      // Verify zero mutation occurred
      const countQuestions = await Question.countDocuments({});
      expect(countQuestions).toBe(0);
    });

    it('detects duplicate published versions and reports BLOCKED', async () => {
      await QuestionVersion.collection
        .dropIndex('question_versions_one_published')
        .catch(() => {});

      const userId = new mongoose.Types.ObjectId();
      const q = await Question.create({
        code: 'QB-2026-000001',
        lifecycleStatus: 'ACTIVE',
        ownerId: userId,
        createdBy: userId,
        updatedBy: userId,
      });

      // Create two published versions for the same question
      await QuestionVersion.create([
        {
          questionId: q._id,
          versionNumber: 1,
          status: 'PUBLISHED',
          difficulty: 'MEDIUM',
          prompt: { vi: 'Câu hỏi', en: 'Question' },
          origin: 'MANUAL',
          contentHash: '0000000000000000000000000000000000000000000000000000000000000001',
          createdBy: userId,
          updatedBy: userId,
        },
        {
          questionId: q._id,
          versionNumber: 2,
          status: 'PUBLISHED',
          difficulty: 'MEDIUM',
          prompt: { vi: 'Câu hỏi 2', en: 'Question 2' },
          origin: 'MANUAL',
          contentHash: '0000000000000000000000000000000000000000000000000000000000000002',
          createdBy: userId,
          updatedBy: userId,
        },
      ]);

      const report = await runRolloutPreflight({ silent: true });
      expect(report.questionBank.duplicatePublishedVersions).toBe(1);
      expect(report.verdict).toBe('BLOCKED');
    });

    it('detects corrupt session question counts (>5 overflow) and reports BLOCKED', async () => {
      const sessionId = new mongoose.Types.ObjectId();

      const questions = [];
      for (let i = 1; i <= 6; i++) {
        questions.push({
          sessionId,
          order: i,
          difficulty: 'MEDIUM',
          content: { vi: `Câu ${i}`, en: `Q ${i}` },
          sourceType: 'AI_GENERATED',
        });
      }
      await InterviewQuestionModel.create(questions);

      const report = await runRolloutPreflight({ silent: true });
      expect(report.interviewDataIntegrity.overflowSessionsGt5).toBe(1);
      expect(report.verdict).toBe('BLOCKED');
    });

    it('detects missing bilingual prompts and reports warning', async () => {
      const userId = new mongoose.Types.ObjectId();
      const q = await Question.create({
        code: 'QB-2026-000002',
        lifecycleStatus: 'ACTIVE',
        ownerId: userId,
        createdBy: userId,
        updatedBy: userId,
      });

      const v = await QuestionVersion.create({
        questionId: q._id,
        versionNumber: 1,
        status: 'PUBLISHED',
        difficulty: 'EASY',
        prompt: { vi: 'Chỉ có tiếng Việt', en: null }, // missing en
        origin: 'MANUAL',
        contentHash: '0000000000000000000000000000000000000000000000000000000000000003',
        createdBy: userId,
        updatedBy: userId,
      });

      q.currentPublishedVersionId = v._id;
      await q.save();

      const report = await runRolloutPreflight({ silent: true });
      expect(report.questionBank.bilingualIncompleteCount).toBe(1);
      expect(report.verdict).toBe('CONDITIONAL_WARNING');
    });
  });

  describe('Scope D: Index Migration & Safety', () => {
    it('verify-only mode does not create indexes when missing', async () => {
      const report = await manageIndexes({ apply: false, silent: true });
      expect(report.mode).toBe('VERIFY_ONLY');
      expect(report.appliedCount).toBe(0);
    });

    it('apply mode safely creates indexes idempotently without dropping anything', async () => {
      const applyReport = await manageIndexes({ apply: true, silent: true });
      expect(applyReport.mode).toBe('APPLY');
      expect(applyReport.appliedCount).toBeGreaterThan(0);

      // Second run in verify-only mode should show all present
      const verifyReport = await manageIndexes({ apply: false, silent: true });
      expect(verifyReport.mode).toBe('VERIFY_ONLY');
      expect(verifyReport.appliedCount).toBe(0);
      expect(verifyReport.verifiedCount).toBe(applyReport.indexes.length);
    });
  });
});
