import { injectable, inject } from 'tsyringe';

import { IInterviewRepository } from '../repositories/IInterviewRepository';
import { InterviewPromptVersion } from '../repositories/IInterviewRepository';

import {
  IInterviewHistoryRepository,
  InterviewHistoryQuery,
  InterviewHistoryResult,
} from '../repositories/interfaces/IInterviewHistoryRepository';

import {
  IInterviewAnalyticsRepository,
  InterviewAnalyticsQuery,
  InterviewAnalyticsResult,
} from '../repositories/interfaces/IInterviewAnalyticsRepository';

import { InterviewContext } from '../domain/interview/InterviewContext';

import {
  InterviewSetupPayload,
  AnswerPayload,
  IAiProvider,
} from '../domain/interview/types';

import Role from '../models/role.model';
import Level from '../models/level.model';
import Technology from '../models/technology.model';

import { AppError } from '../utils/AppError';

import {
  generationPrompt,
  evaluationPrompt,
  minimizeText,
} from './ai/prompt-security';

import { resolveGenerationSetup } from './ai/job-security';

import { IJobScheduler } from '../domain/jobs/IJobScheduler';
import { IEventPublisher } from '../domain/events/IEventPublisher';
import { AppEnv } from '../config/env';
import { ISystemPromptService } from './interfaces/ISystemPromptService';

@injectable()
export class InterviewService {
  constructor(
    @inject('IInterviewRepository')
    private readonly interviewRepo: IInterviewRepository,

    @inject('IAiProvider')
    private readonly aiProvider: IAiProvider,

    @inject('IJobScheduler')
    private readonly jobScheduler?: IJobScheduler,

    @inject('IEventPublisher')
    private readonly eventPublisher?: IEventPublisher,

    @inject('IInterviewHistoryRepository')
    private readonly interviewHistoryRepo?: IInterviewHistoryRepository,

    @inject('IInterviewAnalyticsRepository')
    private readonly interviewAnalyticsRepo?: IInterviewAnalyticsRepository,

    @inject('AppEnv')
    private readonly env?: AppEnv,

    @inject('ISystemPromptService')
    private readonly systemPromptService?: ISystemPromptService,
    @inject('InterviewQuestionGenerationOrchestrator')
    private readonly questionSourceOrchestrator?: import('../domain/interview/question-source/InterviewQuestionGenerationOrchestrator').InterviewQuestionGenerationOrchestrator,
  ) {}

  /**
   * Store prompt provenance without passing mutable admin content to the AI path.
   * AIP-54 always uses the fixed prompt-security templates for execution.
   */
  private async recordPublishedPromptVersion(
    repository: IInterviewRepository,
    id: string,
    type: 'generation' | 'evaluation' | 'learningPath',
  ): Promise<void> {
    if (!this.systemPromptService) return;

    const promptType =
      type === 'generation'
        ? 'GENERATION'
        : type === 'evaluation'
          ? 'EVALUATION'
          : 'LEARNING_PATH';

    try {
      const prompt =
        await this.systemPromptService.getPublished(
          'interview',
          promptType,
          'EN',
        );

      const promptVersion: InterviewPromptVersion = {
        promptId: prompt._id.toString(),
        version: prompt.version,
        language: prompt.language,
      };

      await repository.updatePromptVersion(
        id,
        type,
        promptVersion,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          'PUBLISHED_SYSTEM_PROMPT_NOT_FOUND'
      ) {
        return;
      }

      throw error;
    }
  }

  async createInterviewSession(setupData: InterviewSetupPayload, userId: string) {
    if (!setupData.jdText) {
      await this.validateSetupTaxonomy(setupData);
    }
    const safeSetupData = {
      ...generationPrompt(setupData).data,

      ...(setupData.language !== undefined
        ? { language: setupData.language }
        : {}),

      ...(setupData.secondsPerQuestion !== undefined
        ? {
            secondsPerQuestion:
              setupData.secondsPerQuestion,
          }
        : {}),

      ...(setupData.strategy !== undefined
        ? { strategy: setupData.strategy }
        : {}),
    };

    return this.interviewRepo
      .forOwner(userId)
      .create(safeSetupData, userId);
  }

  private async validateSetupTaxonomy(
    setupData: InterviewSetupPayload,
  ): Promise<void> {
    if (setupData.strategy === 'ADAPTIVE') {
      throw new AppError(
        'Chiến lược ADAPTIVE chưa được bật',
        409,
        'FEATURE_DISABLED',
      );
    }

    const [role, level] = await Promise.all([
      Role.findOne({
        _id: setupData.jobPosition,
        status: 'ACTIVE',
      }).lean(),

      Level.findOne({
        _id: setupData.level,
        status: 'ACTIVE',
      }).lean(),
    ]);

    if (!role) {
      throw new AppError(
        'Role không tồn tại hoặc không hoạt động',
        400,
        'SETUP_ROLE_INVALID',
      );
    }

    if (!level) {
      throw new AppError(
        'Level không tồn tại hoặc không hoạt động',
        400,
        'SETUP_LEVEL_INVALID',
      );
    }

    const technologyIds =
      setupData.techStacks ?? [];

    const activeTechnologies =
      await Technology.countDocuments({
        _id: { $in: technologyIds },
        status: 'ACTIVE',
        roles: role._id,
      });

    if (
      activeTechnologies !==
      technologyIds.length
    ) {
      throw new AppError(
        'Technology không tồn tại, không hoạt động hoặc không thuộc Role đã chọn',
        400,
        'SETUP_TECHNOLOGY_INVALID',
      );
    }
  }

  async createInterviewSessionFromJD(
    setupData: Omit<
      InterviewSetupPayload,
      'jdText'
    >,
    fileBuffer: Buffer,
    mimeType: string,
    userId: string,
  ) {
    const {
      FileParserFactory,
    } = await import(
      '../utils/parsers/FileParserFactory'
    );

    let jdText: string;

    try {
      this.interviewRepo
        .forOwner(userId)
        .getOwnerId();

      jdText =
        await FileParserFactory
          .getParser(mimeType)
          .parse(fileBuffer);
    } finally {
      fileBuffer.fill(0);
    }

    return this.createInterviewSession(
      {
        ...setupData,
        jdText: minimizeText(jdText)
          .substring(0, 10000),
      },
      userId,
    );
  }

  async getInterviewSession(
    id: string,
    userId: string,
  ) {
    const session =
      await this.interviewRepo
        .forOwner(userId)
        .findById(id);

    if (!session) {
      throw new AppError(
        'Interview session not found',
        404,
        'INTERVIEW_NOT_FOUND',
      );
    }

    return session;
  }

  async getInterviewHistory(
    userId: string,
    query: InterviewHistoryQuery,
  ): Promise<InterviewHistoryResult> {
    if (!this.interviewHistoryRepo) {
      throw new AppError(
        'Interview history unavailable',
        500,
        'INTERVIEW_HISTORY_UNAVAILABLE',
      );
    }

    return this.interviewHistoryRepo.findHistory(
      userId,
      query,
    );
  }

  async getInterviewAnalytics(
    userId: string,
    query: InterviewAnalyticsQuery,
  ): Promise<InterviewAnalyticsResult> {
    if (!this.interviewAnalyticsRepo) {
      throw new AppError(
        'Interview analytics unavailable',
        500,
        'INTERVIEW_ANALYTICS_UNAVAILABLE',
      );
    }

    return this.interviewAnalyticsRepo.getAnalytics(userId, query);
  }

  async generateQuestions(
    id: string,
    userId: string,
  ) {
    const sessionData = await this.getInterviewSession(id, userId);

    if (!sessionData.setupData) {
      throw new AppError(
        'Setup data is missing from session',
        500,
        'INTERVIEW_SETUP_MISSING',
      );
    }

    const repository = this.interviewRepo.forOwner(userId);
    const questionBankIntegrationEnabled =
      process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED === 'true' ||
      process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED === '1';
    if (this.questionSourceOrchestrator && questionBankIntegrationEnabled) {
      await this.questionSourceOrchestrator.generateAndCommit(
        id,
        sessionData.setupData,
        userId,
      );
      return this.getInterviewSession(id, userId);
    }

    const context = new InterviewContext(
      id,
      repository,
      InterviewContext.createStateFromStatus(sessionData.status),
      this.eventPublisher,
      sessionData.version,
    );

    await this.recordPublishedPromptVersion(
      repository,
      id,
      'generation',
    );

    await context.generate({
      setupData:
        await resolveGenerationSetup(
          sessionData.setupData,
        ),

      aiProvider: this.aiProvider,

      useAsyncJobs: this.env
        ? this.env.NODE_ENV !== 'test'
        : undefined,

      jobScheduler: this.jobScheduler,
    });

    return this.getInterviewSession(
      id,
      userId,
    );
  }

  async submitAnswers(
    id: string,
    answers: AnswerPayload[],
    userId: string,
  ) {
    const sessionData =
      await this.getInterviewSession(
        id,
        userId,
      );

    if (
      sessionData.status !==
      'IN_PROGRESS'
    ) {
      throw new AppError(
        'Invalid interview state',
        409,
        'STATE_CONFLICT',
      );
    }

    // Validate every question ID before any answer is written.
    evaluationPrompt(
      sessionData.questions ?? [],
      answers,
    );

    const repository =
      this.interviewRepo.forOwner(userId);

    await this.recordPublishedPromptVersion(
      repository,
      id,
      'evaluation',
    );

    await this.recordPublishedPromptVersion(
      repository,
      id,
      'learningPath',
    );

    for (const answer of answers) {
      await repository.updateQuestionAnswer(
        answer.questionId,
        answer.candidateAnswer,
        id,
      );
    }

    const context =
      new InterviewContext(
        id,
        repository,
        InterviewContext.createStateFromStatus(
          sessionData.status,
        ),
        this.eventPublisher,
        sessionData.version,
      );

    await context.submit({
      data: answers,
      aiProvider: this.aiProvider,

      useAsyncJobs: this.env
        ? this.env.NODE_ENV !== 'test'
        : undefined,

      jobScheduler: this.jobScheduler,
    });

    return this.getInterviewSession(
      id,
      userId,
    );
  }

  async saveProgress(
    id: string,
    answers: AnswerPayload[],
    userId: string,
  ) {
    const sessionData =
      await this.getInterviewSession(
        id,
        userId,
      );

    evaluationPrompt(
      sessionData.questions ?? [],
      answers,
    );

    const context =
      new InterviewContext(
        id,
        this.interviewRepo.forOwner(userId),
        InterviewContext.createStateFromStatus(
          sessionData.status,
        ),
        this.eventPublisher,
        sessionData.version,
      );

    await context.saveProgress({
      answers,
    });

    return {
      message:
        'Progress saved successfully',
    };
  }
}
