export interface AdminMetricsDateRange {
  from: Date;
  to: Date;
}

export interface AdminUserMetrics {
  total: number;
  active: number;
  locked: number;
  inactive: number;
}

export interface AdminInterviewMetrics {
  total: number;
  byStatus: {
    PENDING: number;
    GENERATING: number;
    IN_PROGRESS: number;
    EVALUATING: number;
    COMPLETED: number;
    FAILED: number;
  };
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface AdminQuestionSourcingMetrics {
  totalEvents: number;
  attempts: number;
  successes: number;
  failures: number;
  idempotentNoops: number;
  conflicts: number;
  inconsistentStates: number;
  exactFiveViolations: number;
  byEffectiveMode: {
    AI_ONLY: number;
    SHADOW: number;
    BANK_ONLY: number;
    HYBRID: number;
  };
  cohortSelectionRate: number;
  totalSelectedFromBank: number;
  totalSelectedFromAi: number;
  fallbackCount: number;
  poolInsufficientCount: number;
  shadowTimeoutCount: number;
  shadowFailureCount: number;
  latency: {
    avgMs: number;
    p95Ms: number;
  };
  tokens: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
}

export interface IAdminMetricsRepository {
  /**
   * User metric hiện là snapshot tại thời điểm hiện tại,
   * chưa áp dụng bộ lọc thời gian.
   */
  getUserMetrics(): Promise<AdminUserMetrics>;

  /**
   * Interview lọc theo createdAt và dùng [from, to)
   * để tránh đếm trùng tại thời điểm biên.
   */
  getInterviewMetrics(
    range: AdminMetricsDateRange
  ): Promise<AdminInterviewMetrics>;

  getQuestionSourcingMetrics(
    range: AdminMetricsDateRange
  ): Promise<AdminQuestionSourcingMetrics>;
}
