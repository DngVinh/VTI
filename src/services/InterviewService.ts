import { injectable, inject } from 'tsyringe';
import mongoose, { Types } from 'mongoose';

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
import Question from '../models/question.model';
import QuestionVersion from '../models/question-version.model';
import { InterviewSessionModel } from '../models/InterviewSession';
import { InterviewQuestionModel } from '../models/InterviewQuestion';

import { AppError } from '../utils/AppError';

import {
  generationPrompt,
  evaluationPrompt,
  minimizeText,
} from './ai/prompt-security';

import { resolveGenerationSetup } from './ai/job-security';
import { JdValidatorService } from './ai/JdValidatorService';
import { getEnv } from '../config/env';

import { IJobScheduler } from '../domain/jobs/IJobScheduler';
import { IEventPublisher } from '../domain/events/IEventPublisher';
import { AppEnv } from '../config/env';
import { ISystemPromptService } from './interfaces/ISystemPromptService';
import { IConversationTurnRepository } from '../repositories/IConversationTurnRepository';

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
    @inject('IConversationTurnRepository')
    private readonly conversationTurnRepo?: IConversationTurnRepository,
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

    const validation = JdValidatorService.validate(jdText);
    if (!validation.isValid) {
      throw new AppError(
        validation.reason || 'Nội dung tệp không phải bản mô tả công việc (JD) hợp lệ',
        422,
        'INVALID_JD_CONTENT',
      );
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

  /**
   * @deprecated Since AIP-56. Use InterviewWorkflowService.generateQuestions with Idempotency-Key
   * and transactional Outbox pattern for production workloads.
   * Retained for backward compatibility and synchronous integration tests.
   */
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
      Boolean(getEnv().INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED);
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

  /**
   * @deprecated Since AIP-56. Use InterviewWorkflowService.submitAnswers with Idempotency-Key
   * and transactional Outbox pattern for production workloads.
   * Retained for backward compatibility and synchronous integration tests.
   */
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
      sessionData.status !== 'IN_PROGRESS' &&
      sessionData.status !== 'FOLLOW_UP'
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

  async processFollowUp(
    id: string,
    payload: { questionId: string; candidateAnswer: string },
    userId: string,
  ) {
    const sessionData = await this.getInterviewSession(id, userId);

    if (sessionData.status !== 'IN_PROGRESS' && sessionData.status !== 'FOLLOW_UP') {
      throw new AppError(
        'Invalid interview state for follow-up',
        409,
        'STATE_CONFLICT',
      );
    }

    const question = sessionData.questions?.find(
      (q: any) =>
        q._id?.toString() === payload.questionId ||
        q.id?.toString() === payload.questionId ||
        q.toString() === payload.questionId
    );
    if (!question) {
      throw new AppError('Question not found in interview session', 404, 'NOT_FOUND');
    }

    const questionContent = (question as any).content ?? {
      vi: 'Câu hỏi chuyên môn',
      en: 'Technical Question',
    };

    const turnRepo = this.conversationTurnRepo?.forOwner
      ? this.conversationTurnRepo.forOwner(userId)
      : this.conversationTurnRepo;

    if (!turnRepo) {
      throw new AppError('Conversation turn repository not configured', 500, 'INTERNAL_SERVER_ERROR');
    }

    const maxTurns = this.env?.AIU_MAX_FOLLOW_UPS_PER_QUESTION ?? 3;
    const previousTurns = await turnRepo.findByQuestion(id, payload.questionId);
    const candidateAnswers = previousTurns.filter((t) => t.type === 'ANSWER');
    const currentRound = candidateAnswers.length;

    if (currentRound >= maxTurns) {
      return {
        shouldFollowUp: false,
        gapAnalysis: [],
        turnIndex: currentRound,
        maxTurns,
        summary: {
          vi: 'Đã hoàn thành số lượt phản biện tối đa cho câu hỏi này.',
          en: 'Maximum follow-up turns reached for this question.',
        },
      };
    }

    const historyFormatted = previousTurns.map((t) => ({
      role: t.role === 'INTERVIEWER' ? 'INTERVIEWER' : 'CANDIDATE',
      content: t.content?.vi || t.content?.en || '',
    }));

    const aiResult = this.aiProvider.generateFollowUp
      ? await this.aiProvider.generateFollowUp(
          questionContent,
          payload.candidateAnswer,
          historyFormatted,
        )
      : {
          data: {
            shouldFollowUp: false,
            gapAnalysis: [],
            difficultyAdjustment: 'SAME' as const,
            confidenceScore: 0.8,
            summary: {
              vi: 'AI Provider không hỗ trợ phản biện.',
              en: 'AI Provider does not support follow-up.',
            },
          },
          audit: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
        };

    const nextTurnCount = await turnRepo.countTurns(id, payload.questionId);

    // Save candidate answer turn (idempotent if already exists)
    try {
      await turnRepo.createTurn({
        sessionId: new Types.ObjectId(id),
        questionId: new Types.ObjectId(payload.questionId),
        turnIndex: nextTurnCount,
        role: 'CANDIDATE',
        type: 'ANSWER',
        content: {
          vi: payload.candidateAnswer,
          en: payload.candidateAnswer,
        },
        metadata: {},
      });
    } catch (err: any) {
      if (err?.code !== 11000) {
        throw err;
      }
    }

    // If AI generates follow-up question, save interviewer turn
    if (aiResult.data.shouldFollowUp && aiResult.data.followUpQuestion) {
      try {
        await turnRepo.createTurn({
          sessionId: new Types.ObjectId(id),
          questionId: new Types.ObjectId(payload.questionId),
          turnIndex: nextTurnCount + 1,
          role: 'INTERVIEWER',
          type: 'FOLLOW_UP',
          content: aiResult.data.followUpQuestion,
          metadata: {
            gapAnalysis: aiResult.data.gapAnalysis,
            difficultyAdjustment: aiResult.data.difficultyAdjustment,
            confidenceScore: aiResult.data.confidenceScore,
            tokenUsage: {
              promptTokens: aiResult.audit?.promptTokenCount ?? 0,
              candidatesTokens: aiResult.audit?.candidatesTokenCount ?? 0,
              totalTokens: aiResult.audit?.totalTokenCount ?? 0,
            },
          },
        });
      } catch (err: any) {
        if (err?.code !== 11000) {
          throw err;
        }
      }
    }

    const repository = this.interviewRepo.forOwner(userId);

    // If session was IN_PROGRESS, transition to FOLLOW_UP
    if (sessionData.status === 'IN_PROGRESS') {
      const context = new InterviewContext(
        id,
        repository,
        InterviewContext.createStateFromStatus(sessionData.status),
        this.eventPublisher,
        sessionData.version,
      );
      await context.changeState('FOLLOW_UP');
    }

    // Status guard: ensure session hasn't transitioned to EVALUATING/COMPLETED concurrently
    const freshSession = await repository.findById(id);
    if (!freshSession || !['IN_PROGRESS', 'FOLLOW_UP'].includes(freshSession.status)) {
      throw new AppError(
        'Session đã chuyển trạng thái, không thể cập nhật câu trả lời follow-up',
        409,
        'STATE_CONFLICT'
      );
    }

    // Update candidate answer for this question in interview session
    await repository.updateQuestionAnswer(payload.questionId, payload.candidateAnswer, id);

    return {
      shouldFollowUp: aiResult.data.shouldFollowUp,
      followUpQuestion: aiResult.data.followUpQuestion,
      gapAnalysis: aiResult.data.gapAnalysis,
      difficultyAdjustment: aiResult.data.difficultyAdjustment,
      turnIndex: currentRound + 1,
      maxTurns,
      summary: aiResult.data.summary,
    };
  }

  async getConversationHistory(id: string, userId: string, questionId?: string) {
    await this.getInterviewSession(id, userId);
    const turnRepo = this.conversationTurnRepo?.forOwner
      ? this.conversationTurnRepo.forOwner(userId)
      : this.conversationTurnRepo;

    if (!turnRepo) {
      throw new AppError('Conversation turn repository not configured', 500, 'INTERNAL_SERVER_ERROR');
    }

    if (questionId) {
      return await turnRepo.findByQuestion(id, questionId);
    }
    return await turnRepo.findBySession(id);
  }

  async createInterviewSessionFromQuestions(questionIds: string[], userId: string) {
    if (!Array.isArray(questionIds) || questionIds.length < 1 || questionIds.length > 5) {
      throw new AppError('Cần chọn từ 1 đến 5 câu hỏi để luyện tập', 400, 'VALIDATION_ERROR');
    }

    // Deduplicate while preserving user selection order
    const uniqueIds = Array.from(new Set(questionIds));
    const objectIds = uniqueIds.map((id) => new Types.ObjectId(id));

    const questions = await Question.find({
      _id: { $in: objectIds },
      lifecycleStatus: 'ACTIVE',
    }).lean();

    if (questions.length !== uniqueIds.length) {
      throw new AppError('Một số câu hỏi không tồn tại hoặc không còn hoạt động', 404, 'QUESTION_NOT_FOUND');
    }

    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));
    const versionIds = questions
      .map((q) => q.currentPublishedVersionId)
      .filter((vId): vId is Types.ObjectId => Boolean(vId));

    const versions = await QuestionVersion.find({
      _id: { $in: versionIds },
      status: 'PUBLISHED',
    }).lean();

    const versionMap = new Map(versions.map((v) => [v._id.toString(), v]));

    // Reorder according to the requested questionIds order
    const orderedItems: Array<{ question: typeof questions[0]; version: typeof versions[0] }> = [];
    for (const qId of uniqueIds) {
      const q = questionMap.get(qId);
      if (!q || !q.currentPublishedVersionId) {
        throw new AppError(`Câu hỏi ${qId} chưa có phiên bản xuất bản`, 400, 'QUESTION_VERSION_MISSING');
      }
      const v = versionMap.get(q.currentPublishedVersionId.toString());
      if (!v) {
        throw new AppError(`Không tìm thấy phiên bản xuất bản của câu hỏi ${q.code}`, 404, 'QUESTION_VERSION_NOT_FOUND');
      }
      orderedItems.push({ question: q, version: v });
    }

    // Taxonomy derivation for session
    const firstVersion = orderedItems[0].version;
    let jobPosition = firstVersion.primaryRoleId?.toString() || '';
    let level = firstVersion.levelIds?.[0]?.toString() || '';
    if (!jobPosition) {
      const activeRole = await Role.findOne({ status: 'ACTIVE' }).lean();
      if (activeRole) jobPosition = activeRole._id.toString();
    }
    if (!level) {
      const activeLevel = await Level.findOne({ status: 'ACTIVE' }).lean();
      if (activeLevel) level = activeLevel._id.toString();
    }

    const techStackSet = new Set<string>();
    for (const { version } of orderedItems) {
      for (const t of version.technologies || []) {
        if (t.technologyId) techStackSet.add(t.technologyId.toString());
      }
    }

    const setupData: InterviewSetupPayload = {
      jobPosition,
      level,
      techStacks: Array.from(techStackSet),
      language: 'VI',
      secondsPerQuestion: 300,
      strategy: 'STANDARD',
    };

    // Create session directly with status IN_PROGRESS
    const session = await InterviewSessionModel.create({
      userId,
      status: 'IN_PROGRESS',
      version: 0,
      rubricVersion: 2,
      submissionVersion: 0,
      setupData,
    });

    const questionDocs = orderedItems.map(({ question, version }, idx) => ({
      sessionId: session._id,
      ownerId: userId,
      order: idx + 1,
      difficulty: version.difficulty || 'MEDIUM',
      content: {
        vi: version.prompt.vi || version.prompt.en || 'Chưa cập nhật đề bài',
        en: version.prompt.en || version.prompt.vi || 'No prompt',
      },
      candidateAnswer: null,
      answerVersion: 0,
      feedback: null,
      score: null,
      sourceType: 'QUESTION_BANK',
      questionBankQuestionId: question._id,
      questionBankVersionId: version._id,
      questionBankVersionNumber: version.versionNumber,
      questionBankCode: question.code,
    }));

    await InterviewQuestionModel.insertMany(questionDocs);

    return this.getInterviewSession(session._id.toString(), userId);
  }
}
