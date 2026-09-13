import { injectable, inject } from 'tsyringe';

import {
    AdminMetricsDateRange,
    AdminUserMetrics,
    AdminInterviewMetrics,
    AdminQuestionSourcingMetrics,
    IAdminMetricsRepository
} from '../repositories/interfaces/IAdminMetricsRepository';

import { IAdminMetricsService } from './interfaces/IAdminMetricsService';


@injectable()
export class AdminMetricsService
   implements IAdminMetricsService
{
    constructor(
        @inject('IAdminMetricsRepository')
        private readonly metricsRepository: IAdminMetricsRepository
    ){}

    async getMetrics(
        range: AdminMetricsDateRange
    ): Promise<{
        users: AdminUserMetrics;
        interviews: AdminInterviewMetrics;
        questionSourcing: AdminQuestionSourcingMetrics;
    }> {
        const [users, interviews, questionSourcing] = await Promise.all([
            this.metricsRepository.getUserMetrics(),
            this.metricsRepository.getInterviewMetrics(range),
            this.metricsRepository.getQuestionSourcingMetrics(range),
        ]);

        return {
            users,
            interviews,
            questionSourcing,
        };
    }
}
