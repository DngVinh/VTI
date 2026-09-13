import mongoose from 'mongoose';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { QuestionSourcingEventModel } from '../src/models/question-sourcing-event.model';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';

export interface ReconciliationReport {
  timestamp: string;
  verdict: 'HEALTHY' | 'CORRUPTED_ANOMALIES_DETECTED';
  recommendedAction: 'CONTINUE_ROLLOUT' | 'TRIGGER_KILL_SWITCH_AND_INVESTIGATE';
  generationSummary: {
    totalSessionsEvaluated: number;
    exactFiveCount: number;
    invalidBundleCount: number;
    generationSuccessCount: number;
    generationFailureCount: number;
    idempotentNoopCount: number;
    conflictCount: number;
    inconsistentStateCount: number;
  };
  sourceDistribution: {
    totalQuestionsAnalyzed: number;
    aiGeneratedCount: number;
    questionBankCount: number;
    questionBankPercentage: number;
  };
  cohortDistribution: {
    cohortSelectedCount: number;
    cohortNotSelectedCount: number;
    cohortSelectionRate: number;
  };
  fallbackAnalysis: {
    fallbackCount: number;
    fallbackRate: number;
  };
  tokenUsage: {
    totalPromptTokens: number;
    totalCandidatesTokens: number;
    totalTokens: number;
    avgTokensPerCompletedSession: number;
  };
  provenanceIntegrity: {
    missingProvenanceCount: number;
    orphanedBankReferences: number;
  };
  latency: {
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
  };
}

export async function runRolloutReconciliation(options?: {
  from?: Date;
  to?: Date;
  silent?: boolean;
}): Promise<ReconciliationReport> {
  const silent = options?.silent ?? false;
  const from = options?.from || new Date(0);
  const to = options?.to || new Date(Date.now() + 86400000);

  // 1. Telemetry Aggregation
  const events = await QuestionSourcingEventModel.find({
    createdAt: { $gte: from, $lt: to },
  }).lean();

  let generationSuccessCount = 0;
  let generationFailureCount = 0;
  let idempotentNoopCount = 0;
  let conflictCount = 0;
  let inconsistentStateCount = 0;
  let cohortSelectedCount = 0;
  let totalCohortEvaluated = 0;
  let fallbackCount = 0;
  const durations: number[] = [];

  for (const evt of events) {
    if (evt.eventType === 'ATTEMPT') {
      totalCohortEvaluated++;
      if (evt.isCohortSelected) cohortSelectedCount++;
    } else if (evt.eventType === 'SUCCESS') {
      generationSuccessCount++;
      if (evt.durationMs !== undefined) durations.push(evt.durationMs);
    } else if (evt.eventType === 'FAILURE') {
      generationFailureCount++;
    } else if (evt.eventType === 'IDEMPOTENT_NOOP') {
      idempotentNoopCount++;
    } else if (evt.eventType === 'CONFLICT') {
      conflictCount++;
    } else if (evt.eventType === 'INCONSISTENT_STATE') {
      inconsistentStateCount++;
    }

    if (evt.fallbackOccurred) {
      fallbackCount++;
    }
  }

  durations.sort((a, b) => a - b);
  const avgMs =
    durations.length > 0
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : 0;
  const p50Index = Math.min(
    Math.floor(durations.length * 0.5),
    Math.max(0, durations.length - 1)
  );
  const p95Index = Math.min(
    Math.floor(durations.length * 0.95),
    Math.max(0, durations.length - 1)
  );
  const p50Ms = durations.length > 0 ? durations[p50Index] : 0;
  const p95Ms = durations.length > 0 ? durations[p95Index] : 0;

  // 2. Question Analysis
  const questions = await InterviewQuestionModel.find({
    createdAt: { $gte: from, $lt: to },
  }).lean();

  const totalQuestionsAnalyzed = questions.length;
  let aiGeneratedCount = 0;
  let questionBankCount = 0;
  let missingProvenanceCount = 0;
  let orphanedBankReferences = 0;

  // Group by session to verify exact-five
  const sessionQuestionMap = new Map<string, typeof questions>();
  for (const q of questions) {
    const sId = q.sessionId.toString();
    if (!sessionQuestionMap.has(sId)) {
      sessionQuestionMap.set(sId, []);
    }
    sessionQuestionMap.get(sId)!.push(q);

    if (q.sourceType === 'QUESTION_BANK') {
      questionBankCount++;
      if (!q.questionBankQuestionId || !q.questionBankVersionId || !q.promptSnapshotHash) {
        missingProvenanceCount++;
      } else {
        // Verify existence of Question and QuestionVersion
        const qExists = await Question.exists({ _id: q.questionBankQuestionId });
        const vExists = await QuestionVersion.exists({ _id: q.questionBankVersionId });
        if (!qExists || !vExists) {
          orphanedBankReferences++;
        }
      }
    } else {
      aiGeneratedCount++;
    }
  }

  let exactFiveCount = 0;
  let invalidBundleCount = 0;
  for (const [, sessionQuestions] of sessionQuestionMap.entries()) {
    if (sessionQuestions.length === 5) {
      exactFiveCount++;
    } else {
      invalidBundleCount++;
    }
  }

  // 3. Token Aggregation
  const sessions = await InterviewSessionModel.find({
    _id: { $in: Array.from(sessionQuestionMap.keys()).map((id) => new mongoose.Types.ObjectId(id)) },
  }).lean();

  let totalPromptTokens = 0;
  let totalCandidatesTokens = 0;
  let totalTokens = 0;
  for (const s of sessions) {
    const meta = (s as any).metadata;
    if (meta) {
      totalPromptTokens += meta.promptTokens || 0;
      totalCandidatesTokens += meta.candidatesTokens || 0;
      totalTokens += meta.totalTokens || 0;
    }
  }

  const completedSessions = exactFiveCount;
  const avgTokensPerCompletedSession =
    completedSessions > 0 ? Math.round(totalTokens / completedSessions) : 0;

  const questionBankPercentage =
    totalQuestionsAnalyzed > 0
      ? Number(((questionBankCount / totalQuestionsAnalyzed) * 100).toFixed(2))
      : 0;

  const cohortSelectionRate =
    totalCohortEvaluated > 0
      ? Number(((cohortSelectedCount / totalCohortEvaluated) * 100).toFixed(2))
      : 0;

  const fallbackRate =
    generationSuccessCount > 0
      ? Number(((fallbackCount / generationSuccessCount) * 100).toFixed(2))
      : 0;

  let verdict: 'HEALTHY' | 'CORRUPTED_ANOMALIES_DETECTED' = 'HEALTHY';
  let recommendedAction: 'CONTINUE_ROLLOUT' | 'TRIGGER_KILL_SWITCH_AND_INVESTIGATE' =
    'CONTINUE_ROLLOUT';

  if (
    invalidBundleCount > 0 ||
    missingProvenanceCount > 0 ||
    orphanedBankReferences > 0 ||
    inconsistentStateCount > 0
  ) {
    verdict = 'CORRUPTED_ANOMALIES_DETECTED';
    recommendedAction = 'TRIGGER_KILL_SWITCH_AND_INVESTIGATE';
  }

  const report: ReconciliationReport = {
    timestamp: new Date().toISOString(),
    verdict,
    recommendedAction,
    generationSummary: {
      totalSessionsEvaluated: sessionQuestionMap.size,
      exactFiveCount,
      invalidBundleCount,
      generationSuccessCount,
      generationFailureCount,
      idempotentNoopCount,
      conflictCount,
      inconsistentStateCount,
    },
    sourceDistribution: {
      totalQuestionsAnalyzed,
      aiGeneratedCount,
      questionBankCount,
      questionBankPercentage,
    },
    cohortDistribution: {
      cohortSelectedCount,
      cohortNotSelectedCount: totalCohortEvaluated - cohortSelectedCount,
      cohortSelectionRate,
    },
    fallbackAnalysis: {
      fallbackCount,
      fallbackRate,
    },
    tokenUsage: {
      totalPromptTokens,
      totalCandidatesTokens,
      totalTokens,
      avgTokensPerCompletedSession,
    },
    provenanceIntegrity: {
      missingProvenanceCount,
      orphanedBankReferences,
    },
    latency: {
      avgMs,
      p50Ms,
      p95Ms,
    },
  };

  if (!silent) {
    console.log('=== QUESTION BANK POST-ROLLOUT RECONCILIATION REPORT (READ-ONLY) ===');
    console.log(JSON.stringify(report, null, 2));
  }

  return report;
}

if (process.argv[1] && process.argv[1].includes('question-bank-rollout-reconciliation')) {
  (async () => {
    try {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        console.error('Error: MONGODB_URI environment variable is required.');
        process.exit(1);
      }
      await mongoose.connect(mongoUri);
      const report = await runRolloutReconciliation();
      await mongoose.disconnect();
      if (report.verdict === 'CORRUPTED_ANOMALIES_DETECTED') {
        process.exit(1);
      }
      process.exit(0);
    } catch (err) {
      console.error('Reconciliation execution failed:', err);
      process.exit(1);
    }
  })();
}
