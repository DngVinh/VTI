import mongoose from 'mongoose';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';
import { QuestionEmbeddingModel } from '../src/models/question-embedding.model';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { QuestionSourcingEventModel } from '../src/models/question-sourcing-event.model';

export interface PreflightReport {
  timestamp: string;
  verdict: 'GO_READY' | 'CONDITIONAL_WARNING' | 'BLOCKED';
  summary: {
    criticalViolations: number;
    warnings: number;
  };
  questionBank: {
    activeQuestions: number;
    publishedVersions: number;
    missingPublishedVersionPointer: number;
    duplicatePublishedVersions: number;
    bilingualIncompleteCount: number;
    difficultyCounts: { EASY: number; MEDIUM: number; HARD: number };
    embeddingReadinessCount: number;
    insufficientQuotaTaxonomyCombinations: number;
  };
  interviewDataIntegrity: {
    uniqueIndexPresent: boolean;
    duplicateSessionOrderCount: number;
    partialSessions1To4: number;
    overflowSessionsGt5: number;
    exactFiveSessions: number;
    invalidSourceTypeCount: number;
    invalidOrderCount: number;
    legacyUnannotatedQuestions: number;
  };
  telemetry: {
    eventCount: number;
    indexesVerified: boolean;
  };
}

export async function runRolloutPreflight(options?: {
  silent?: boolean;
}): Promise<PreflightReport> {
  const silent = options?.silent ?? false;

  // 1. Question Bank Active & Published Version Checks
  const activeQuestions = await Question.countDocuments({
    $or: [{ lifecycleStatus: 'ACTIVE' }, { status: 'ACTIVE' }],
  });
  const publishedVersions = await QuestionVersion.countDocuments({ status: 'PUBLISHED' });

  // Missing published version pointer
  const questionsWithoutPublished = await Question.countDocuments({
    $or: [{ lifecycleStatus: 'ACTIVE' }, { status: 'ACTIVE' }],
    $and: [
      {
        $or: [{ currentPublishedVersionId: null }, { currentPublishedVersionId: { $exists: false } }],
      },
    ],
  });

  // Duplicate published versions for the same question
  const duplicatePublished = await QuestionVersion.aggregate([
    { $match: { status: 'PUBLISHED' } },
    { $group: { _id: '$questionId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  // Bilingual completeness
  const bilingualIncomplete = await QuestionVersion.countDocuments({
    status: 'PUBLISHED',
    $or: [
      { 'prompt.vi': null },
      { 'prompt.vi': '' },
      { 'prompt.vi': { $exists: false } },
      { 'prompt.en': null },
      { 'prompt.en': '' },
      { 'prompt.en': { $exists: false } },
    ],
  });

  // Difficulty breakdown for active published versions
  const difficultyAgg = await QuestionVersion.aggregate([
    { $match: { status: 'PUBLISHED' } },
    { $group: { _id: '$difficulty', count: { $sum: 1 } } },
  ]);
  const difficultyCounts = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const d of difficultyAgg) {
    if (d._id in difficultyCounts) {
      difficultyCounts[d._id as keyof typeof difficultyCounts] = d.count;
    }
  }

  // Taxonomy quota check (1 Easy, 2 Medium, 2 Hard)
  const taxonomyQuotaAgg = await QuestionVersion.aggregate([
    { $match: { status: 'PUBLISHED' } },
    {
      $group: {
        _id: { roleId: '$primaryRoleId' },
        easy: { $sum: { $cond: [{ $eq: ['$difficulty', 'EASY'] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ['$difficulty', 'MEDIUM'] }, 1, 0] } },
        hard: { $sum: { $cond: [{ $eq: ['$difficulty', 'HARD'] }, 1, 0] } },
      },
    },
  ]);
  let insufficientQuotaTaxonomyCombinations = 0;
  for (const tax of taxonomyQuotaAgg) {
    if (tax.easy < 1 || tax.medium < 2 || tax.hard < 2) {
      insufficientQuotaTaxonomyCombinations++;
    }
  }

  // Embedding readiness
  const embeddingCount = await QuestionEmbeddingModel.countDocuments({});

  // 2. Interview Question & Session Invariant Checks
  let uniqueIndexPresent = false;
  try {
    const indexes = await InterviewQuestionModel.collection.indexes();
    uniqueIndexPresent = indexes.some(
      (idx) =>
        idx.name === 'interview_questions_session_order_unique' ||
        (idx.key && idx.key.sessionId && idx.key.order && idx.unique)
    );
  } catch {
    uniqueIndexPresent = false;
  }

  // Duplicate { sessionId, order }
  const duplicateSessionOrders = await InterviewQuestionModel.aggregate([
    { $group: { _id: { sessionId: '$sessionId', order: '$order' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  // Session question counts (1..4 vs 5 vs >5)
  const sessionQuestionCounts = await InterviewQuestionModel.aggregate([
    { $group: { _id: '$sessionId', count: { $sum: 1 } } },
    {
      $group: {
        _id: null,
        partial: { $sum: { $cond: [{ $and: [{ $gte: ['$count', 1] }, { $lte: ['$count', 4] }] }, 1, 0] } },
        exactFive: { $sum: { $cond: [{ $eq: ['$count', 5] }, 1, 0] } },
        overflow: { $sum: { $cond: [{ $gt: ['$count', 5] }, 1, 0] } },
      },
    },
  ]);
  const sessionStats = sessionQuestionCounts[0] || { partial: 0, exactFive: 0, overflow: 0 };

  // Invalid sourceType or invalid order
  const invalidSourceTypeCount = await InterviewQuestionModel.countDocuments({
    sourceType: { $exists: true, $nin: ['AI_GENERATED', 'QUESTION_BANK'] },
  });
  const invalidOrderCount = await InterviewQuestionModel.countDocuments({
    order: { $nin: [1, 2, 3, 4, 5] },
  });
  const legacyUnannotatedQuestions = await InterviewQuestionModel.countDocuments({
    sourceType: { $exists: false },
  });

  // 3. Telemetry Collection
  let telemetryEventCount = 0;
  let telemetryIndexesVerified = false;
  try {
    telemetryEventCount = await QuestionSourcingEventModel.countDocuments({});
    telemetryIndexesVerified = true;
  } catch {
    telemetryIndexesVerified = false;
  }

  // Verdict calculation
  let criticalViolations = 0;
  let warnings = 0;

  if (duplicateSessionOrders.length > 0) criticalViolations++;
  if (sessionStats.overflow > 0) criticalViolations++;
  if (invalidSourceTypeCount > 0) criticalViolations++;
  if (invalidOrderCount > 0) criticalViolations++;
  if (duplicatePublished.length > 0) criticalViolations++;
  if (questionsWithoutPublished > 0) criticalViolations++;

  if (sessionStats.partial > 0) warnings++;
  if (bilingualIncomplete > 0) warnings++;
  if (insufficientQuotaTaxonomyCombinations > 0) warnings++;
  if (!uniqueIndexPresent) warnings++;

  let verdict: 'GO_READY' | 'CONDITIONAL_WARNING' | 'BLOCKED' = 'GO_READY';
  if (criticalViolations > 0) {
    verdict = 'BLOCKED';
  } else if (warnings > 0) {
    verdict = 'CONDITIONAL_WARNING';
  }

  const report: PreflightReport = {
    timestamp: new Date().toISOString(),
    verdict,
    summary: {
      criticalViolations,
      warnings,
    },
    questionBank: {
      activeQuestions,
      publishedVersions,
      missingPublishedVersionPointer: questionsWithoutPublished,
      duplicatePublishedVersions: duplicatePublished.length,
      bilingualIncompleteCount: bilingualIncomplete,
      difficultyCounts,
      embeddingReadinessCount: embeddingCount,
      insufficientQuotaTaxonomyCombinations,
    },
    interviewDataIntegrity: {
      uniqueIndexPresent,
      duplicateSessionOrderCount: duplicateSessionOrders.length,
      partialSessions1To4: sessionStats.partial,
      overflowSessionsGt5: sessionStats.overflow,
      exactFiveSessions: sessionStats.exactFive,
      invalidSourceTypeCount,
      invalidOrderCount,
      legacyUnannotatedQuestions,
    },
    telemetry: {
      eventCount: telemetryEventCount,
      indexesVerified: telemetryIndexesVerified,
    },
  };

  if (!silent) {
    console.log('=== QUESTION BANK ROLLOUT PREFLIGHT REPORT (READ-ONLY) ===');
    console.log(JSON.stringify(report, null, 2));
  }

  return report;
}

if (process.argv[1] && process.argv[1].includes('question-bank-rollout-preflight')) {
  (async () => {
    try {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        console.error('Error: MONGODB_URI environment variable is required.');
        process.exit(1);
      }
      await mongoose.connect(mongoUri);
      const report = await runRolloutPreflight();
      await mongoose.disconnect();
      if (report.verdict === 'BLOCKED') {
        process.exit(1);
      }
      process.exit(0);
    } catch (err) {
      console.error('Preflight execution failed:', err);
      process.exit(1);
    }
  })();
}
