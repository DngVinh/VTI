import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { container } from 'tsyringe';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'question_bank_rollout_access_secret_32_chars_123';
  process.env.JWT_REFRESH_SECRET = 'question_bank_rollout_refresh_secret_32_chars_456';
  process.env.PASSWORD_RESET_SECRET = 'question_bank_rollout_reset_secret_32_chars_789';
});

import '../src/config/di';
import { InterviewQuestionGenerationOrchestrator } from '../src/domain/interview/question-source/InterviewQuestionGenerationOrchestrator';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import Technology from '../src/models/technology.model';

describe('AIP-68 Phase 7: Kill Switch & Rollback Drill Integration Suite', () => {
  let replSet: MongoMemoryReplSet;
  let orchestrator: InterviewQuestionGenerationOrchestrator;
  let defaultUserId: mongoose.Types.ObjectId;
  let testRoleId: mongoose.Types.ObjectId;
  let testLevelId: mongoose.Types.ObjectId;
  let testTechId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri);

    defaultUserId = new mongoose.Types.ObjectId();
    const role = await Role.create({ name: 'Frontend Engineer', code: 'FE', createdBy: defaultUserId });
    const level = await Level.create({ name: 'Senior', code: 'SR', createdBy: defaultUserId });
    const tech = await Technology.create({ name: 'React', code: 'REACT', createdBy: defaultUserId });

    testRoleId = role._id;
    testLevelId = level._id;
    testTechId = tech._id;

    // Seed Question Bank with 2 EASY, 3 MEDIUM, 3 HARD questions
    const difficulties = ['EASY', 'EASY', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'HARD', 'HARD', 'HARD'];
    for (let i = 0; i < difficulties.length; i++) {
      const q = await Question.create({
        code: `QB-2026-${String(i + 1).padStart(6, '0')}`,
        lifecycleStatus: 'ACTIVE',
        ownerId: defaultUserId,
        createdBy: defaultUserId,
        updatedBy: defaultUserId,
      });

      const v = await QuestionVersion.create({
        questionId: q._id,
        versionNumber: 1,
        status: 'PUBLISHED',
        difficulty: difficulties[i],
        primaryRoleId: testRoleId,
        levelIds: [testLevelId],
        technologies: [{ technologyId: testTechId, requirementLevel: 'MANDATORY' }],
        prompt: { vi: `Câu hỏi QB ${i + 1}`, en: `QB Question ${i + 1}` },
        origin: 'MANUAL',
        contentHash: `000000000000000000000000000000000000000000000000000000000000000${i + 1}`,
        createdBy: defaultUserId,
        updatedBy: defaultUserId,
      });

      q.currentPublishedVersionId = v._id;
      await q.save();
    }

    orchestrator = container.resolve(InterviewQuestionGenerationOrchestrator);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    await InterviewSessionModel.deleteMany({});
    await InterviewQuestionModel.deleteMany({});
  });

  it('executes full primary kill switch drill (INTEGRATION_ENABLED=false)', async () => {
    // 1. Configure HYBRID with integration enabled
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
    process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'HYBRID';
    process.env.INTERVIEW_QUESTION_BANK_HYBRID_BANK_COUNT = '2';
    process.env.INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT = '100';

    const session1 = await InterviewSessionModel.create({
      userId: defaultUserId,
      status: 'GENERATING',
      setupData: {
        roleId: testRoleId.toString(),
        levelId: testLevelId.toString(),
        techIds: [testTechId.toString()],
      },
    });

    const bundle1 = await orchestrator.generateAndCommit(session1._id.toString(), session1.setupData);
    expect(bundle1.questions).toHaveLength(5);
    const bankCount1 = bundle1.questions.filter((q) => q.sourceType === 'QUESTION_BANK').length;
    expect(bankCount1).toBeGreaterThanOrEqual(1);

    const initialQbCount = await Question.countDocuments({});
    const initialVersionCount = await QuestionVersion.countDocuments({});

    // 2. TOGGLE PRIMARY KILL SWITCH OFF
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'false';

    // 3. New session generates purely AI_ONLY
    const session2 = await InterviewSessionModel.create({
      userId: defaultUserId,
      status: 'GENERATING',
      setupData: {
        roleId: testRoleId.toString(),
        levelId: testLevelId.toString(),
        techIds: [testTechId.toString()],
      },
    });

    const bundle2 = await orchestrator.generateAndCommit(session2._id.toString(), session2.setupData);
    expect(bundle2.questions).toHaveLength(5);
    expect(bundle2.diagnostics.effectiveMode).toBe('AI_ONLY');
    const bankCount2 = bundle2.questions.filter((q) => q.sourceType === 'QUESTION_BANK').length;
    expect(bankCount2).toBe(0);

    // 4. Session 1 questions and provenance remain completely unmutated
    const session1Questions = await InterviewQuestionModel.find({ sessionId: session1._id }).sort({ order: 1 });
    expect(session1Questions).toHaveLength(5);
    const preservedBankQuestions = session1Questions.filter((q) => q.sourceType === 'QUESTION_BANK');
    expect(preservedBankQuestions.length).toBe(bankCount1);
    expect(preservedBankQuestions[0].questionBankQuestionId).toBeDefined();

    // 5. Duplicate job delivery for Session 1 is a safe idempotent no-op
    const retryBundle1 = await orchestrator.generateAndCommit(session1._id.toString(), session1.setupData);
    expect(retryBundle1.diagnostics.successCode).toBe('IDEMPOTENT_NOOP');
    const session1CountAfterRetry = await InterviewQuestionModel.countDocuments({ sessionId: session1._id });
    expect(session1CountAfterRetry).toBe(5);

    // 6. Question Bank records have zero mutations or deletions
    const finalQbCount = await Question.countDocuments({});
    const finalVersionCount = await QuestionVersion.countDocuments({});
    expect(finalQbCount).toBe(initialQbCount);
    expect(finalVersionCount).toBe(initialVersionCount);
  });

  it('executes secondary kill switch drill (ROLLOUT_PERCENT=0)', async () => {
    // Keep integration code deployed, but set rollout percent to 0
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
    process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'HYBRID';
    process.env.INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT = '0';

    const session3 = await InterviewSessionModel.create({
      userId: defaultUserId,
      status: 'GENERATING',
      setupData: {
        roleId: testRoleId.toString(),
        levelId: testLevelId.toString(),
        techIds: [testTechId.toString()],
      },
    });

    const bundle3 = await orchestrator.generateAndCommit(session3._id.toString(), session3.setupData);
    expect(bundle3.questions).toHaveLength(5);
    expect(bundle3.diagnostics.effectiveMode).toBe('AI_ONLY');
    const bankCount3 = bundle3.questions.filter((q) => q.sourceType === 'QUESTION_BANK').length;
    expect(bankCount3).toBe(0);
  });
});
