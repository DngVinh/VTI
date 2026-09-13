import {
    AdminMetricsDateRange,
    AdminUserMetrics,
    AdminInterviewMetrics,
    AdminQuestionSourcingMetrics,
} from '../../repositories/interfaces/IAdminMetricsRepository';

export interface IAdminMetricsService {
    getMetrics(
        range: AdminMetricsDateRange
    ): Promise<{
        users: AdminUserMetrics;
        interviews: AdminInterviewMetrics;
        questionSourcing: AdminQuestionSourcingMetrics;
    }>;
}
