import { injectable } from 'tsyringe';

import User from '../models/user.model';
import { InterviewSessionModel } from '../models/InterviewSession';

import {
  AdminMetricsDateRange,
  AdminUserMetrics,
  AdminInterviewMetrics,
  AdminQuestionSourcingMetrics,
  IAdminMetricsRepository
} from './interfaces/IAdminMetricsRepository';
import { QuestionSourcingEventModel } from '../models/question-sourcing-event.model';

@injectable()
export class AdminMetricsRepository
  implements IAdminMetricsRepository
{
  /**
   * User metric hiện là snapshot tại thời điểm hiện tại,
   * chưa áp dụng bộ lọc thời gian.
   */
  async getUserMetrics(): Promise<AdminUserMetrics> {
    const [result] = await User.aggregate([
      {
        $group: {
          _id: null,

          total: {
            $sum: 1
          },

          active: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'ACTIVE'] },
                1,
                0
              ]
            }
          },

          locked: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'LOCKED'] },
                1,
                0
              ]
            }
          },

          inactive: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'INACTIVE'] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    return {
      total: result?.total ?? 0,
      active: result?.active ?? 0,
      locked: result?.locked ?? 0,
      inactive: result?.inactive ?? 0
    };
  }

  /**
   * Interview lọc theo createdAt và dùng [from, to)
   * để tránh đếm trùng tại thời điểm biên.
   */
  async getInterviewMetrics(
    range: AdminMetricsDateRange
  ): Promise<AdminInterviewMetrics> {
    const [result] = await InterviewSessionModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: range.from,
            $lt: range.to
          }
        }
      },

      {
        $group: {
          _id: null,

          total: {
            $sum: 1
          },

          pending: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'PENDING'] },
                1,
                0
              ]
            }
          },

          generating: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'GENERATING'] },
                1,
                0
              ]
            }
          },

          inProgress: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'IN_PROGRESS'] },
                1,
                0
              ]
            }
          },

          evaluating: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'EVALUATING'] },
                1,
                0
              ]
            }
          },

          completed: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'COMPLETED'] },
                1,
                0
              ]
            }
          },

          failed: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'FAILED'] },
                1,
                0
              ]
            }
          },

          promptTokens: {
            $sum: {
              $ifNull: [
                '$metadata.promptTokens',
                0
              ]
            }
          },

          candidatesTokens: {
            $sum: {
              $ifNull: [
                '$metadata.candidatesTokens',
                0
              ]
            }
          },

          totalTokens: {
            $sum: {
              $ifNull: [
                '$metadata.totalTokens',
                0
              ]
            }
          }
        }
      }
    ]);

    return {
      total: result?.total ?? 0,

      byStatus: {
        PENDING: result?.pending ?? 0,
        GENERATING: result?.generating ?? 0,
        IN_PROGRESS: result?.inProgress ?? 0,
        EVALUATING: result?.evaluating ?? 0,
        COMPLETED: result?.completed ?? 0,
        FAILED: result?.failed ?? 0
      },

      promptTokens: result?.promptTokens ?? 0,
      candidatesTokens: result?.candidatesTokens ?? 0,
      totalTokens: result?.totalTokens ?? 0
    };
  }

  async getQuestionSourcingMetrics(
    range: AdminMetricsDateRange
  ): Promise<AdminQuestionSourcingMetrics> {
    const events = await QuestionSourcingEventModel.find({
      createdAt: { $gte: range.from, $lt: range.to },
    })
      .select({
        eventType: 1,
        effectiveMode: 1,
        isCohortSelected: 1,
        durationMs: 1,
        bankQuestionCount: 1,
        aiQuestionCount: 1,
        fallbackOccurred: 1,
        poolInsufficient: 1,
        shadowTimeout: 1,
        shadowSuccess: 1,
        exactFiveViolated: 1,
        tokens: 1,
      })
      .lean();

    let attempts = 0;
    let successes = 0;
    let failures = 0;
    let idempotentNoops = 0;
    let conflicts = 0;
    let inconsistentStates = 0;
    let exactFiveViolations = 0;
    const byEffectiveMode = {
      AI_ONLY: 0,
      SHADOW: 0,
      BANK_ONLY: 0,
      HYBRID: 0,
    };
    let cohortSelectedCount = 0;
    let totalCohortEvaluated = 0;
    let totalSelectedFromBank = 0;
    let totalSelectedFromAi = 0;
    let fallbackCount = 0;
    let poolInsufficientCount = 0;
    let shadowTimeoutCount = 0;
    let shadowFailureCount = 0;
    let promptTokens = 0;
    let candidatesTokens = 0;
    let totalTokens = 0;
    const durations: number[] = [];

    for (const event of events) {
      switch (event.eventType) {
        case 'ATTEMPT':
          attempts += 1;
          totalCohortEvaluated += 1;
          if (event.isCohortSelected) cohortSelectedCount += 1;
          break;
        case 'SUCCESS':
          successes += 1;
          if (event.effectiveMode in byEffectiveMode) {
            byEffectiveMode[event.effectiveMode as keyof typeof byEffectiveMode] += 1;
          }
          totalSelectedFromBank += event.bankQuestionCount || 0;
          totalSelectedFromAi += event.aiQuestionCount || 0;
          if (event.durationMs !== undefined) durations.push(event.durationMs);
          if (event.tokens) {
            promptTokens += event.tokens.promptTokens || 0;
            candidatesTokens += event.tokens.candidatesTokens || 0;
            totalTokens += event.tokens.totalTokens || 0;
          }
          break;
        case 'FAILURE':
          failures += 1;
          break;
        case 'IDEMPOTENT_NOOP':
          idempotentNoops += 1;
          break;
        case 'CONFLICT':
          conflicts += 1;
          break;
        case 'INCONSISTENT_STATE':
          inconsistentStates += 1;
          break;
      }

      if (event.exactFiveViolated) exactFiveViolations += 1;
      if (event.fallbackOccurred) fallbackCount += 1;
      if (event.poolInsufficient) poolInsufficientCount += 1;
      if (event.shadowTimeout) shadowTimeoutCount += 1;
      if (event.shadowSuccess === false) shadowFailureCount += 1;
    }

    durations.sort((a, b) => a - b);
    const averageDuration = durations.length > 0
      ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
      : 0;
    const p95Index = Math.min(
      Math.floor(durations.length * 0.95),
      Math.max(0, durations.length - 1),
    );

    return {
      totalEvents: events.length,
      attempts,
      successes,
      failures,
      idempotentNoops,
      conflicts,
      inconsistentStates,
      exactFiveViolations,
      byEffectiveMode,
      cohortSelectionRate: totalCohortEvaluated > 0
        ? Number(((cohortSelectedCount / totalCohortEvaluated) * 100).toFixed(2))
        : 0,
      totalSelectedFromBank,
      totalSelectedFromAi,
      fallbackCount,
      poolInsufficientCount,
      shadowTimeoutCount,
      shadowFailureCount,
      latency: {
        avgMs: averageDuration,
        p95Ms: durations.length > 0 ? durations[p95Index] : 0,
      },
      tokens: { promptTokens, candidatesTokens, totalTokens },
    };
  }
}
