import {
  IInterviewHistoryRepository,
  InterviewHistoryQuery,
  InterviewHistoryResult
} from './interfaces/IInterviewHistoryRepository';

import {
  IInterviewRepository,
  InterviewEntity,
  InterviewPromptVersion,
  InterviewQuestionEntity
} from './IInterviewRepository';

import mongoose from 'mongoose';

import {
  IInterviewAnalyticsRepository,
  InterviewAnalyticsQuery,
  InterviewAnalyticsResult
} from './interfaces/IInterviewAnalyticsRepository';

import { InterviewStatus } from '../domain/interview/IInterviewState';
import {
  InterviewSetupPayload,
  LocalizedContent
} from '../domain/interview/types';

import { InterviewSessionModel } from '../models/InterviewSession';
import { InterviewQuestionModel } from '../models/InterviewQuestion';
import { AppError } from '../utils/AppError';
import { terminalUpdate } from '../services/retention-policy';

export class MongoInterviewRepository
  implements
    IInterviewRepository,
    IInterviewHistoryRepository,
    IInterviewAnalyticsRepository
{
  constructor(
    private readonly ownerId?: string,
    private readonly internalJobScope = false,
  ) {}

  forOwner(ownerId: string): IInterviewRepository {
    if (!/^[a-f0-9]{24}$/i.test(ownerId)) {
      throw new AppError(
        'Authentication required',
        401,
        'AUTH_UNAUTHORIZED'
      );
    }

    return new MongoInterviewRepository(ownerId);
  }

  /**
   * Background generation is invoked only by the server-side operation
   * processor. It retains a distinct system scope instead of weakening the
   * public owner-scoped repository methods.
   */
  forInternalGeneration(): IInterviewRepository {
    return new MongoInterviewRepository(undefined, true);
  }

  private sessionFilter(id: string, status?: InterviewStatus): Record<string, unknown> {
    const filter: Record<string, unknown> = { _id: id };
    if (this.ownerId) {
      filter.userId = this.ownerId;
    } else if (!this.internalJobScope) {
      filter.userId = this.getOwnerId();
    }
    if (status) filter.status = status;
    return filter;
  }

  getOwnerId(): string {
    if (!this.ownerId) {
      throw new AppError(
        'Owner scope required',
        403,
        'AUTH_FORBIDDEN'
      );
    }

    return this.ownerId;
  }

  private async assertSession(sessionId: string): Promise<void> {
    if (!await InterviewSessionModel.exists(this.sessionFilter(sessionId))) {
      throw new AppError('Access denied', 403, 'AUTH_FORBIDDEN');
    }
  }

  async create(
    data: InterviewSetupPayload,
    userId?: string
  ): Promise<InterviewEntity> {
    if (userId !== this.getOwnerId()) {
      throw new AppError(
        'Access denied',
        403,
        'AUTH_FORBIDDEN'
      );
    }

    const session = await InterviewSessionModel.create({
      userId,
      status: 'PENDING',
      setupData: data
    });

    return this.mapToEntity(session);
  }

  async findById(id: string): Promise<InterviewEntity | null> {
    const session = this.internalJobScope
      ? await InterviewSessionModel.findById(id).lean()
      : await InterviewSessionModel.findOne(this.sessionFilter(id)).lean();
    if (!session) {
      if (await InterviewSessionModel.exists({ _id: id })) {
        throw new AppError(
          'Access denied',
          403,
          'AUTH_FORBIDDEN'
        );
      }

      return null;
    }

    const questions = await InterviewQuestionModel
      .find({ sessionId: id })
      .sort({ order: 1 })
      .lean();

    const entity = this.mapToEntity(session);

    entity.questions = questions.map((question) =>
      this.mapQuestionToEntity(question)
    );

    return entity;
  }

  async findHistory(
    userId: string,
    query: InterviewHistoryQuery
  ): Promise<InterviewHistoryResult> {
    if (!/^[a-f0-9]{24}$/i.test(userId)) {
      throw new AppError(
        'Authentication required',
        401,
        'AUTH_UNAUTHORIZED'
      );
    }

    const filter: Record<string, unknown> = {
      userId
    };

    if (query.role) {
      filter['setupData.jobPosition'] = query.role;
    }

    if (query.level) {
      filter['setupData.level'] = query.level;
    }

    if (query.technology) {
      filter['setupData.techStacks'] = query.technology;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lt: query.to } : {})
      };
    }

    const skip = (query.page - 1) * query.limit;

    const sortDirection =
      query.sort === 'oldest' ? 1 : -1;

    const [sessions, total] = await Promise.all([
      InterviewSessionModel
        .find(filter)
        .select({
          _id: 1,
          'setupData.jobPosition': 1,
          'setupData.level': 1,
          'setupData.techStacks': 1,
          overallScore: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1
        })
        .sort({
          createdAt: sortDirection,
          _id: sortDirection
        })
        .skip(skip)
        .limit(query.limit)
        .lean(),

      InterviewSessionModel.countDocuments(filter)
    ]);

    return {
      items: sessions.map((session: any) => ({
        sessionId: session._id.toString(),
        role: session.setupData?.jobPosition,
        level: session.setupData?.level,
        technologies: Array.isArray(
          session.setupData?.techStacks
        )
          ? session.setupData.techStacks
          : [],
        score: session.overallScore ?? null,
        status: session.status as InterviewStatus,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      })),

      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(
          total / query.limit
        )
      }
    };
  }

  async getAnalytics(
    userId: string,
    query: InterviewAnalyticsQuery
  ): Promise<InterviewAnalyticsResult> {
    const match: Record<string, unknown> = {
      userId,
      status: 'COMPLETED',
      overallScore: {
        $gte: 0,
        $lte: 10
      }
    };

    if (query.role) {
      match['setupData.jobPosition'] = query.role;
    }

    if (query.level) {
      match['setupData.level'] = query.level;
    }

    if (query.technology) {
      match['setupData.techStacks'] = query.technology;
    }

    if (query.from || query.to) {
      match.createdAt = {
        ...(query.from
          ? { $gte: query.from }
          : {}),
        ...(query.to
          ? { $lt: query.to }
          : {})
      };
    }

    const dimensionNames = [
      'Technical Depth',
      'Problem Solving',
      'System Design & Best Practices',
      'Communication',
      'Practical Experience'
    ];

    type AnalyticsAggregation = {
      summaryOverall: Array<{
        totalCompleted: number;
        averageOverallScore: number | null;
      }>;

      summaryDimensions: Array<{
        _id: string;
        score: number | null;
      }>;

      dailyOverall: Array<{
        _id: string;
        overallScore: number | null;
      }>;

      dailyDimensions: Array<{
        _id: {
          date: string;
          name: string;
        };
        score: number | null;
      }>;
    };

    const [aggregation] =
      await InterviewSessionModel.aggregate<AnalyticsAggregation>([
        {
          $match: match
        },

        {
          $set: {
            bucketDate: {
              $dateToString: {
                date: '$createdAt',
                format: '%Y-%m-%d',
                timezone: 'UTC'
              }
            }
          }
        },

        {
          $facet: {
            summaryOverall: [
              {
                $group: {
                  _id: null,
                  totalCompleted: {
                    $sum: 1
                  },
                  averageOverallScore: {
                    $avg: '$overallScore'
                  }
                }
              }
            ],

            summaryDimensions: [
              {
                $unwind: '$dimensions'
              },

              {
                $match: {
                  'dimensions.name': {
                    $in: dimensionNames
                  },
                  'dimensions.score': {
                    $gte: 0,
                    $lte: 10
                  }
                }
              },

              {
                $group: {
                  _id: '$dimensions.name',
                  score: {
                    $avg: '$dimensions.score'
                  }
                }
              }
            ],

            dailyOverall: [
              {
                $group: {
                  _id: '$bucketDate',
                  overallScore: {
                    $avg: '$overallScore'
                  }
                }
              },

              {
                $sort: {
                  _id: 1
                }
              }
            ],

            dailyDimensions: [
              {
                $unwind: '$dimensions'
              },

              {
                $match: {
                  'dimensions.name': {
                    $in: dimensionNames
                  },
                  'dimensions.score': {
                    $gte: 0,
                    $lte: 10
                  }
                }
              },

              {
                $group: {
                  _id: {
                    date: '$bucketDate',
                    name: '$dimensions.name'
                  },
                  score: {
                    $avg: '$dimensions.score'
                  }
                }
              },

              {
                $sort: {
                  '_id.date': 1,
                  '_id.name': 1
                }
              }
            ]
          }
        }
      ]);

    const round = (
      value: number | null | undefined
    ): number | null =>
      typeof value === 'number'
        ? Number(value.toFixed(2))
        : null;

    const summaryOverall =
      aggregation?.summaryOverall?.[0];

    const summaryDimensions =
      new Map<string, number | null>(
        (
          aggregation?.summaryDimensions ?? []
        ).map(
          (
            item: {
              _id: string;
              score: number | null;
            }
          ) => [
            item._id,
            round(item.score)
          ]
        )
      );

    const dailyOverall =
      new Map<string, number | null>(
        (
          aggregation?.dailyOverall ?? []
        ).map(
          (
            item: {
              _id: string;
              overallScore: number | null;
            }
          ) => [
            item._id,
            round(item.overallScore)
          ]
        )
      );

    const dailyDimensions =
      new Map<
        string,
        Map<string, number | null>
      >();

    for (
      const item of
        aggregation?.dailyDimensions ?? []
    ) {
      const date = item._id.date;

      const dimensions =
        dailyDimensions.get(date) ??
        new Map<string, number | null>();

      dimensions.set(
        item._id.name,
        round(item.score)
      );

      dailyDimensions.set(
        date,
        dimensions
      );
    }

    const dates = Array.from(
      new Set([
        ...dailyOverall.keys(),
        ...dailyDimensions.keys()
      ])
    ).sort();

    return {
      summary: {
        totalCompleted:
          summaryOverall?.totalCompleted ?? 0,

        averageOverallScore:
          round(
            summaryOverall?.averageOverallScore
          ),

        dimensions:
          dimensionNames.map((name) => ({
            name,
            score:
              summaryDimensions.get(name) ??
              null
          }))
      },

      series: dates.map((date) => {
        const dimensions =
          dailyDimensions.get(date);

        return {
          date,

          overallScore:
            dailyOverall.get(date) ?? 0,

          dimensions:
            dimensionNames.map((name) => ({
              name,
              score:
                dimensions?.get(name) ??
                null
            }))
        };
      })
    };
  }

  async updateStatus(
    id: string,
    status: InterviewStatus,
    expectedStatus?: InterviewStatus,
    expectedVersion?: number,
  ): Promise<number | null> {
    await this.assertSession(id);

    const filter = this.sessionFilter(id);
    if (expectedStatus !== undefined) filter.status = expectedStatus;
    if (expectedVersion !== undefined) filter.version = expectedVersion;

    const updatePipeline = [
      ...terminalUpdate(status),
      {
        $set: {
          version: {
            $add: [
              { $ifNull: ['$version', 0] },
              1
            ]
          }
        }
      }
    ];

    const updated =
      await InterviewSessionModel.findOneAndUpdate(
        filter,
        updatePipeline,
        {
          returnDocument: 'after',
          updatePipeline: true
        }
      ).lean();

    return updated?.version ?? null;
  }

  async update(
    id: string,
    data: Partial<InterviewEntity>
  ): Promise<void> {
    await this.assertSession(id);

    const allowed: Record<string, unknown> = {};

    for (
      const key of [
        'overallScore',
        'dimensions',
        'learningPath'
      ] as const
    ) {
      if (data[key] !== undefined) {
        allowed[key] = data[key];
      }
    }

    if (Object.keys(allowed).length > 0) {
      await InterviewSessionModel.updateOne(
        this.sessionFilter(id),
        { $set: allowed },
      );
    }
  }

  async updateTokenUsage(
    id: string,
    usage: import('../domain/interview/types').AiUsageMetadata
  ): Promise<void> {
    await this.assertSession(id);

    await InterviewSessionModel.updateOne(
      this.sessionFilter(id),
      {
        $inc: {
          'metadata.promptTokens':
            usage.promptTokenCount,

          'metadata.candidatesTokens':
            usage.candidatesTokenCount,

          'metadata.totalTokens':
            usage.totalTokenCount
        }
      }
    );
  }

  async updatePromptVersion(
    id: string,
    type:
      | 'generation'
      | 'evaluation'
      | 'learningPath',
    promptVersion: InterviewPromptVersion
  ): Promise<void> {
    await this.assertSession(id);

    await InterviewSessionModel.updateOne(
      this.sessionFilter(id),
      { $set: { [`promptVersions.${type}`]: promptVersion } },
    );
  }

  async createQuestions(
    sessionId: string,
    questionsData: Omit<
      InterviewQuestionEntity,
      | 'id'
      | 'sessionId'
      | 'createdAt'
      | 'updatedAt'
      | 'candidateAnswer'
      | 'feedback'
      | 'score'
    >[]
  ): Promise<InterviewQuestionEntity[]> {
    await this.assertSession(sessionId);

    const docs = questionsData.map((question) => ({
      sessionId,
      ownerId: this.getOwnerId(),
      order: question.order,
      difficulty: question.difficulty,
      content: question.content,
      candidateAnswer: null,
      feedback: null,
      score: null
    }));

    const created =
      await InterviewQuestionModel.insertMany(
        docs
      );

    return created.map((question) =>
      this.mapQuestionToEntity(question)
    );
  }

  async commitInterviewQuestionsBundle(
    sessionId: string,
    bundle: import('../domain/interview/question-source/types').ExactFiveBundle,
  ): Promise<InterviewEntity> {
    await this.assertSession(sessionId);
    const { InterviewQuestionBundleValidator } = await import(
      '../domain/interview/question-source/InterviewQuestionBundleValidator'
    );
    InterviewQuestionBundleValidator.validate(bundle.questions);

    const existingQuestions = await InterviewQuestionModel.find({ sessionId })
      .sort({ order: 1 })
      .lean();
    if (existingQuestions.length === 5) {
      const existing = await this.findById(sessionId);
      if (!existing) {
        throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
      }
      return existing;
    }
    if (existingQuestions.length > 0) {
      throw new AppError(
        `Phát hiện trạng thái câu hỏi không nhất quán (${existingQuestions.length} câu hỏi) cho session ${sessionId}`,
        409,
        'INTERVIEW_QUESTION_GENERATION_INCONSISTENT_STATE',
      );
    }

    const docs = bundle.questions.map((question) => ({
      sessionId: new mongoose.Types.ObjectId(sessionId),
      ownerId: this.ownerId ?? undefined,
      order: question.order,
      difficulty: question.difficulty,
      content: question.content,
      sourceType: question.sourceType,
      questionBankQuestionId: question.questionBankQuestionId
        ? new mongoose.Types.ObjectId(question.questionBankQuestionId)
        : null,
      questionBankVersionId: question.questionBankVersionId
        ? new mongoose.Types.ObjectId(question.questionBankVersionId)
        : null,
      questionBankVersionNumber: question.questionBankVersionNumber ?? null,
      questionBankCode: question.questionBankCode ?? null,
      selectionPolicyVersion: question.selectionPolicyVersion ?? null,
      selectionSeedFingerprint: question.selectionSeedFingerprint ?? null,
      promptSnapshotHash: question.promptSnapshotHash ?? null,
      selectedAt: question.selectedAt ?? new Date(),
      candidateAnswer: null,
      feedback: null,
      score: null,
    }));

    let committed = false;
    try {
      const mongoSession = await mongoose.startSession();
      try {
        await mongoSession.withTransaction(async () => {
          const current = await InterviewSessionModel.findOne(
            this.sessionFilter(sessionId)
          ).session(mongoSession);
          if (!current) {
            throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
          }
          const count = await InterviewQuestionModel.countDocuments({ sessionId }).session(mongoSession);
          if (count === 5) return;
          if (count > 0) {
            throw new AppError(
              `Phát hiện trạng thái câu hỏi không nhất quán (${count} câu hỏi) cho session ${sessionId}`,
              409,
              'INTERVIEW_QUESTION_GENERATION_INCONSISTENT_STATE',
            );
          }
          if (current.status !== 'GENERATING') {
            throw new AppError(
              `Phiên phỏng vấn đang ở trạng thái ${current.status}, không thể sinh câu hỏi`,
              409,
              'INTERVIEW_QUESTION_GENERATION_CONFLICT',
            );
          }

          await InterviewQuestionModel.insertMany(docs, { session: mongoSession });
          current.status = 'IN_PROGRESS';
          current.metadata = current.metadata ?? {
            promptTokens: 0,
            candidatesTokens: 0,
            totalTokens: 0,
          };
          current.metadata.promptTokens += bundle.audit.promptTokenCount;
          current.metadata.candidatesTokens += bundle.audit.candidatesTokenCount;
          current.metadata.totalTokens += bundle.audit.totalTokenCount;
          await current.save({ session: mongoSession });
          committed = true;
        });
      } finally {
        await mongoSession.endSession();
      }
    } catch (error: any) {
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('Transactions are not supported') && !message.includes('standalone')) {
        throw error;
      }

      const fallbackResult = await this.commitBundleStandaloneFallback(sessionId, bundle);
      committed = Boolean(fallbackResult);
    }

    if (!committed) {
      const existing = await this.findById(sessionId);
      if (existing) return existing;
    }
    const result = await this.findById(sessionId);
    if (!result) {
      throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
    }
    return result;
  }

  private async commitBundleStandaloneFallback(
    sessionId: string,
    bundle: import('../domain/interview/question-source/types').ExactFiveBundle,
  ): Promise<InterviewEntity> {
    const audit = bundle.audit;
    const fallbackSessionFilter = this.ownerId
      ? this.sessionFilter(sessionId, 'GENERATING')
      : { _id: sessionId, status: 'GENERATING' };
    const claimed = await InterviewSessionModel.findOneAndUpdate(
      fallbackSessionFilter,
      {
        $set: { status: 'IN_PROGRESS' },
        $inc: {
          'metadata.promptTokens': audit.promptTokenCount,
          'metadata.candidatesTokens': audit.candidatesTokenCount,
          'metadata.totalTokens': audit.totalTokenCount,
        },
      },
      { new: true },
    );

    if (!claimed) {
      const existing = await this.findById(sessionId);
      if (existing?.questions?.length === 5) return existing;
      throw new AppError(
        'Không thể claim trạng thái GENERATING',
        409,
        'INTERVIEW_QUESTION_GENERATION_CONFLICT',
      );
    }

    try {
      const docs = bundle.questions.map((question) => ({
        sessionId: new mongoose.Types.ObjectId(sessionId),
        ownerId: this.ownerId ?? undefined,
        order: question.order,
        difficulty: question.difficulty,
        content: question.content,
        sourceType: question.sourceType,
        questionBankQuestionId: question.questionBankQuestionId
          ? new mongoose.Types.ObjectId(question.questionBankQuestionId)
          : null,
        questionBankVersionId: question.questionBankVersionId
          ? new mongoose.Types.ObjectId(question.questionBankVersionId)
          : null,
        questionBankVersionNumber: question.questionBankVersionNumber ?? null,
        questionBankCode: question.questionBankCode ?? null,
        selectionPolicyVersion: question.selectionPolicyVersion ?? null,
        selectionSeedFingerprint: question.selectionSeedFingerprint ?? null,
        promptSnapshotHash: question.promptSnapshotHash ?? null,
        selectedAt: question.selectedAt ?? new Date(),
        candidateAnswer: null,
        feedback: null,
        score: null,
      }));
      await InterviewQuestionModel.insertMany(docs);
      return this.mapToEntity(claimed);
    } catch (insertError) {
      const metadata = claimed.metadata ?? {
        promptTokens: 0,
        candidatesTokens: 0,
        totalTokens: 0,
      };
      const rollbackSessionFilter = this.ownerId
        ? this.sessionFilter(sessionId)
        : { _id: sessionId };
      await InterviewSessionModel.updateOne(rollbackSessionFilter, {
        $set: {
          status: 'FAILED',
          metadata: {
            promptTokens: Math.max(0, metadata.promptTokens - audit.promptTokenCount),
            candidatesTokens: Math.max(0, metadata.candidatesTokens - audit.candidatesTokenCount),
            totalTokens: Math.max(0, metadata.totalTokens - audit.totalTokenCount),
          },
        },
      });
      // Existing question documents are intentionally preserved. The caller
      // must resolve any pre-existing partial state explicitly.
      throw insertError;
    }
  }

  async updateQuestionAnswer(questionId: string, answer: string, sessionId?: string): Promise<void> {
    const resolvedSessionId = sessionId ?? String((await InterviewQuestionModel.findById(questionId).select({ sessionId: 1 }).lean())?.sessionId ?? '');
    await this.assertSession(resolvedSessionId);
    const result = await InterviewQuestionModel.updateOne(
      { _id: questionId, sessionId: resolvedSessionId },
      { candidateAnswer: answer },
    );

    if (!result.matchedCount) {
      throw new AppError(
        'Question not in session',
        403,
        'AUTH_FORBIDDEN'
      );
    }
  }

  async updateQuestionFeedback(
    questionId: string,
    feedback: LocalizedContent,
    score: number,
    sessionId?: string
  ): Promise<void> {
    const resolvedSessionId =
      sessionId ??
      String(
        (
          await InterviewQuestionModel
            .findById(questionId)
            .select({ sessionId: 1 })
            .lean()
        )?.sessionId ?? ''
      );

    await this.assertSession(
      resolvedSessionId
    );

    const result =
      await InterviewQuestionModel.updateOne(
        {
          _id: questionId,
          sessionId: resolvedSessionId
        },
        {
          feedback,
          score
        }
      );

    if (!result.matchedCount) {
      throw new AppError(
        'Question not in session',
        403,
        'AUTH_FORBIDDEN'
      );
    }
  }

  private mapToEntity(doc: any): InterviewEntity {
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      status: doc.status as InterviewStatus,
      version: doc.version ?? 0,
      rubricVersion: doc.rubricVersion ?? 1,
      submissionVersion: doc.submissionVersion ?? 0,
      activeOperationId:
        doc.activeOperationId?.toString?.() ?? null,
      safeErrorCode: doc.safeErrorCode ?? null,
      setupData: doc.setupData,
      overallScore: doc.overallScore,
      dimensions: doc.dimensions,
      learningPath: doc.learningPath,
      personaEvaluations: doc.personaEvaluations,
      varianceFlags: doc.varianceFlags,
      promptVersions: doc.promptVersions,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      terminalAt: doc.terminalAt,
      contentPurgeAt: doc.contentPurgeAt,
      recordPurgeAt: doc.recordPurgeAt
    };
  }

  private mapQuestionToEntity(
    doc: any
  ): InterviewQuestionEntity {
    return {
      id: doc._id.toString(),
      sessionId: doc.sessionId.toString(),
      order: doc.order,
      difficulty: doc.difficulty,
      content: doc.content,
      candidateAnswer: doc.candidateAnswer,
      answerVersion: doc.answerVersion ?? 0,
      feedback: doc.feedback,
      score: doc.score,
      sourceType: doc.sourceType,
      questionBankQuestionId: doc.questionBankQuestionId
        ? doc.questionBankQuestionId.toString()
        : null,
      questionBankVersionId: doc.questionBankVersionId
        ? doc.questionBankVersionId.toString()
        : null,
      questionBankVersionNumber: doc.questionBankVersionNumber ?? null,
      questionBankCode: doc.questionBankCode ?? null,
      selectionPolicyVersion: doc.selectionPolicyVersion ?? null,
      selectionSeedFingerprint: doc.selectionSeedFingerprint ?? null,
      promptSnapshotHash: doc.promptSnapshotHash ?? null,
      selectedAt: doc.selectedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }
}
