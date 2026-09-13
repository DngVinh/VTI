import mongoose, { ClientSession, PipelineStage, Types } from 'mongoose';
import Question, { IQuestion } from '../models/question.model';
import QuestionVersion, { IQuestionVersion } from '../models/question-version.model';
import {
  Difficulty,
  LocalizedText,
  QuestionOrigin,
  QuestionType,
  VersionStatus,
  QuestionSelectionFilter,
  QuestionSelectionItem,
  CoverageFilter,
  QuestionCoverageResult,
  CoverageGapItem,
  AnalyticsFilter,
  QuestionAnalyticsResult,
  ExportFilter,
  ExportableQuestionItem,
  ImportRowData,
} from '../domain/question-bank/types';
import { createContentHash, normalizePromptFingerprint } from '../domain/question-bank/hashing';
import {
  CreateDraftVersionInput,
  CreateQuestionAggregateInput,
  DraftVersionCreateResult,
  DraftVersionUpdateResult,
  IQuestionRepository,
  PaginatedQuestionListProjection,
  PersistedDraftInput,
  QuestionDetailRecord,
  QuestionListProjection,
  QuestionListQuery,
  QuestionListVersionRecord,
  QuestionRecord,
  QuestionUpdateResult,
  QuestionVersionRecord,
  UpdateDraftVersionInput,
  UpdateQuestionMetadataInput,
} from './interfaces/IQuestionRepository';

type UnknownRecord = Record<string, unknown>;

const objectId = (value: string): Types.ObjectId => new Types.ObjectId(value);
const idString = (value: unknown): string => String(value);

export const toQuestionRecord = (question: IQuestion): QuestionRecord => ({
  id: question._id.toString(),
  code: question.code,
  lifecycleStatus: question.lifecycleStatus,
  currentPublishedVersionId: question.currentPublishedVersionId?.toString() ?? null,
  draftVersionId: question.draftVersionId?.toString() ?? null,
  latestVersionNumber: question.latestVersionNumber,
  ownerId: question.ownerId.toString(),
  revision: question.revision,
  createdBy: question.createdBy.toString(),
  updatedBy: question.updatedBy.toString(),
  createdAt: question.createdAt,
  updatedAt: question.updatedAt,
});

export const toQuestionVersionRecord = (version: IQuestionVersion): QuestionVersionRecord => ({
  id: version._id.toString(),
  questionId: version.questionId.toString(),
  versionNumber: version.versionNumber,
  status: version.status,
  revision: version.revision,
  prompt: version.prompt,
  explanation: version.explanation,
  followUps: version.followUps,
  questionType: version.questionType,
  difficulty: version.difficulty,
  primaryRoleId: version.primaryRoleId?.toString() ?? null,
  additionalRoleIds: version.additionalRoleIds.map((id) => id.toString()),
  levelIds: version.levelIds.map((id) => id.toString()),
  technologies: version.technologies.map((item) => ({
    technologyId: item.technologyId.toString(),
    relevance: item.relevance,
  })),
  technologyAgnostic: version.technologyAgnostic,
  classificationComplete: version.classificationComplete,
  topic: version.topic,
  tags: [...version.tags],
  referenceAnswer: version.referenceAnswer,
  learningObjective: version.learningObjective,
  estimatedTimeSeconds: version.estimatedTimeSeconds,
  rubric: version.rubric,
  changeSummary: version.changeSummary,
  origin: version.origin,
  sourceVersionId: version.sourceVersionId?.toString() ?? null,
  sourceReference: version.sourceReference,
  contentHash: version.contentHash,
  normalizedPromptFingerprint: version.normalizedPromptFingerprint ?? null,
  createdBy: version.createdBy.toString(),
  updatedBy: version.updatedBy.toString(),
  contributorIds: (version.contributorIds.length
    ? version.contributorIds
    : [version.createdBy, version.updatedBy]
  ).map((id) => id.toString()),
  createdAt: version.createdAt,
  updatedAt: version.updatedAt,
});

const draftPersistence = (draft: PersistedDraftInput): UnknownRecord => ({
  prompt: draft.prompt,
  explanation: draft.explanation,
  followUps: draft.followUps,
  questionType: draft.questionType,
  difficulty: draft.difficulty,
  primaryRoleId: draft.primaryRoleId ? objectId(draft.primaryRoleId) : null,
  additionalRoleIds: draft.additionalRoleIds.map(objectId),
  levelIds: draft.levelIds.map(objectId),
  technologies: draft.technologies.map((item) => ({
    technologyId: objectId(item.technologyId),
    relevance: item.relevance,
  })),
  technologyAgnostic: draft.technologyAgnostic,
  classificationComplete: draft.classificationComplete,
  topic: draft.topic,
  tags: draft.tags,
  referenceAnswer: draft.referenceAnswer,
  learningObjective: draft.learningObjective,
  estimatedTimeSeconds: draft.estimatedTimeSeconds,
  rubric: draft.rubric,
  changeSummary: draft.changeSummary,
  origin: draft.origin,
  sourceVersionId: draft.sourceVersionId ? objectId(draft.sourceVersionId) : null,
  sourceReference: draft.sourceReference ?? null,
  contentHash: draft.contentHash,
  normalizedPromptFingerprint: draft.normalizedPromptFingerprint ?? null,
});

const draftChangesPersistence = (
  changes: UpdateDraftVersionInput['changes']
): UnknownRecord => {
  const update: UnknownRecord = {};
  if (changes.prompt !== undefined) update.prompt = changes.prompt;
  if (changes.explanation !== undefined) update.explanation = changes.explanation;
  if (changes.followUps !== undefined) update.followUps = changes.followUps;
  if (changes.questionType !== undefined) update.questionType = changes.questionType;
  if (changes.difficulty !== undefined) update.difficulty = changes.difficulty;
  if (changes.primaryRoleId !== undefined) {
    update.primaryRoleId = changes.primaryRoleId ? objectId(changes.primaryRoleId) : null;
  }
  if (changes.additionalRoleIds !== undefined) {
    update.additionalRoleIds = changes.additionalRoleIds.map(objectId);
  }
  if (changes.levelIds !== undefined) update.levelIds = changes.levelIds.map(objectId);
  if (changes.technologies !== undefined) {
    update.technologies = changes.technologies.map((item) => ({
      technologyId: objectId(item.technologyId),
      relevance: item.relevance,
    }));
  }
  if (changes.technologyAgnostic !== undefined) {
    update.technologyAgnostic = changes.technologyAgnostic;
  }
  if (changes.classificationComplete !== undefined) {
    update.classificationComplete = changes.classificationComplete;
  }
  if (changes.topic !== undefined) update.topic = changes.topic;
  if (changes.tags !== undefined) update.tags = changes.tags;
  if (changes.referenceAnswer !== undefined) update.referenceAnswer = changes.referenceAnswer;
  if (changes.learningObjective !== undefined) update.learningObjective = changes.learningObjective;
  if (changes.estimatedTimeSeconds !== undefined) {
    update.estimatedTimeSeconds = changes.estimatedTimeSeconds;
  }
  if (changes.rubric !== undefined) update.rubric = changes.rubric;
  if (changes.changeSummary !== undefined) update.changeSummary = changes.changeSummary;
  return update;
};

export const escapeQuestionSearch = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildSafeQuestionSearchRegex = (value: string): RegExp =>
  new RegExp(escapeQuestionSearch(value.trim()), 'iu');

interface AggregatedListVersion extends UnknownRecord {
  _id: Types.ObjectId;
  questionId: Types.ObjectId;
  versionNumber: number;
  status: QuestionListVersionRecord['status'];
  revision: number;
  prompt: QuestionListVersionRecord['prompt'];
  questionType: QuestionListVersionRecord['questionType'];
  difficulty: QuestionListVersionRecord['difficulty'];
  primaryRoleId: Types.ObjectId | null;
  additionalRoleIds: Types.ObjectId[];
  levelIds: Types.ObjectId[];
  technologies: Array<{ technologyId: Types.ObjectId; relevance: number | null }>;
  technologyAgnostic: boolean | null;
  topic: string | null;
  tags: string[];
  origin: QuestionListVersionRecord['origin'];
  updatedAt: Date;
}

interface AggregatedListQuestion extends UnknownRecord {
  _id: Types.ObjectId;
  code: string;
  lifecycleStatus: QuestionRecord['lifecycleStatus'];
  currentPublishedVersionId: Types.ObjectId | null;
  draftVersionId: Types.ObjectId | null;
  latestVersionNumber: number;
  ownerId: Types.ObjectId;
  revision: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  draftVersion: Array<{ status: QuestionListVersionRecord['status']; versionNumber: number }>;
  publishedVersion: Array<{ versionNumber: number }>;
  candidateVersions: AggregatedListVersion[];
}

const toListVersionRecord = (version: AggregatedListVersion): QuestionListVersionRecord => ({
  id: version._id.toString(),
  questionId: version.questionId.toString(),
  versionNumber: version.versionNumber,
  status: version.status,
  revision: version.revision,
  prompt: version.prompt,
  questionType: version.questionType,
  difficulty: version.difficulty,
  primaryRoleId: version.primaryRoleId?.toString() ?? null,
  additionalRoleIds: version.additionalRoleIds.map(idString),
  levelIds: version.levelIds.map(idString),
  technologies: version.technologies.map((item) => ({
    technologyId: item.technologyId.toString(),
    relevance: item.relevance,
  })),
  technologyAgnostic: version.technologyAgnostic,
  topic: version.topic,
  tags: version.tags,
  origin: version.origin,
  updatedAt: version.updatedAt,
});

export class QuestionRepository implements IQuestionRepository {
  async withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    let result: T | undefined;
    try {
      await session.withTransaction(async () => {
        result = await work(session);
      });
    } finally {
      await session.endSession();
    }
    if (result === undefined) throw new Error('Question Bank transaction returned no result');
    return result;
  }

  async createQuestionAggregate(
    input: CreateQuestionAggregateInput,
    session: ClientSession
  ): Promise<{ question: QuestionRecord; version: QuestionVersionRecord }> {
    const questionId = new Types.ObjectId();
    const versionId = new Types.ObjectId();
    const actorId = objectId(input.actorId);

    const [question] = await Question.create(
      [
        {
          _id: questionId,
          code: input.code,
          lifecycleStatus: 'ACTIVE',
          currentPublishedVersionId: null,
          draftVersionId: versionId,
          latestVersionNumber: 1,
          ownerId: objectId(input.ownerId),
          revision: 0,
          createdBy: actorId,
          updatedBy: actorId,
        },
      ],
      { session }
    );

    const [version] = await QuestionVersion.create(
      [
        {
          _id: versionId,
          questionId,
          versionNumber: 1,
          status: 'DRAFT',
          revision: 0,
          ...draftPersistence(input.draft),
          createdBy: actorId,
          updatedBy: actorId,
          contributorIds: [actorId],
        },
      ],
      { session }
    );

    return {
      question: toQuestionRecord(question),
      version: toQuestionVersionRecord(version),
    };
  }

  async createDraftVersion(
    input: CreateDraftVersionInput,
    session: ClientSession
  ): Promise<DraftVersionCreateResult> {
    const versionId = new Types.ObjectId();
    const actorId = objectId(input.actorId);
    const question = await Question.findOneAndUpdate(
      {
        _id: objectId(input.questionId),
        lifecycleStatus: 'ACTIVE',
        draftVersionId: null,
        revision: input.expectedQuestionRevision,
      },
      {
        $set: { draftVersionId: versionId, updatedBy: actorId },
        $inc: { latestVersionNumber: 1, revision: 1 },
      },
      { returnDocument: 'after', session }
    );

    if (!question) {
      const current = await Question.findById(input.questionId).session(session);
      if (!current) return { kind: 'not-found' };
      if (current.lifecycleStatus !== 'ACTIVE') {
        return { kind: 'invalid-lifecycle', lifecycleStatus: current.lifecycleStatus };
      }
      if (current.draftVersionId) {
        return { kind: 'active-draft', draftVersionId: current.draftVersionId.toString() };
      }
      return { kind: 'conflict', currentRevision: current.revision };
    }

    const [version] = await QuestionVersion.create(
      [
        {
          _id: versionId,
          questionId: question._id,
          versionNumber: question.latestVersionNumber,
          status: 'DRAFT',
          revision: 0,
          ...draftPersistence(input.draft),
          createdBy: actorId,
          updatedBy: actorId,
          contributorIds: [actorId],
        },
      ],
      { session }
    );

    return {
      kind: 'created',
      question: toQuestionRecord(question),
      version: toQuestionVersionRecord(version),
    };
  }

  async listQuestions(query: QuestionListQuery): Promise<PaginatedQuestionListProjection> {
    const questionMatch: UnknownRecord = {};
    if (query.lifecycleStatus) questionMatch.lifecycleStatus = query.lifecycleStatus;
    if (query.ownerId) questionMatch.ownerId = objectId(query.ownerId);

    const versionMatch: UnknownRecord = {};
    if (query.roleId) {
      const roleId = objectId(query.roleId);
      versionMatch.$or = [{ primaryRoleId: roleId }, { additionalRoleIds: roleId }];
    }
    if (query.levelId) versionMatch.levelIds = objectId(query.levelId);
    if (query.technologyId) versionMatch['technologies.technologyId'] = objectId(query.technologyId);
    if (query.difficulty) versionMatch.difficulty = query.difficulty;
    if (query.questionType) versionMatch.questionType = query.questionType;
    if (query.origin) versionMatch.origin = query.origin;

    let versionRelation: UnknownRecord;
    if (query.versionStatus === 'PUBLISHED') {
      versionRelation = {
        $and: [
          { $eq: ['$questionId', '$$questionId'] },
          { $eq: ['$_id', '$$publishedVersionId'] },
          { $eq: ['$status', 'PUBLISHED'] },
        ],
      };
    } else if (query.versionStatus) {
      versionRelation = {
        $and: [
          { $eq: ['$questionId', '$$questionId'] },
          { $eq: ['$status', query.versionStatus] },
        ],
      };
    } else {
      versionRelation = { $eq: ['$_id', '$$displayVersionId'] };
    }

    const candidateLookup: PipelineStage.Lookup = {
      $lookup: {
        from: 'question_versions',
        let: {
          questionId: '$_id',
          displayVersionId: '$displayVersionId',
          publishedVersionId: '$currentPublishedVersionId',
        },
        pipeline: [
          { $match: { $expr: versionRelation } },
          { $match: versionMatch },
          { $sort: { versionNumber: -1 } },
          {
            $project: {
              _id: 1,
              questionId: 1,
              versionNumber: 1,
              status: 1,
              revision: 1,
              prompt: 1,
              questionType: 1,
              difficulty: 1,
              primaryRoleId: 1,
              additionalRoleIds: 1,
              levelIds: 1,
              technologies: 1,
              technologyAgnostic: 1,
              topic: 1,
              tags: 1,
              origin: 1,
              updatedAt: 1,
            },
          },
        ],
        as: 'candidateVersions',
      },
    };

    const direction = query.sortDirection === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: direction,
      _id: direction,
    };

    const pipeline: PipelineStage[] = [
      { $match: questionMatch },
      {
        $lookup: {
          from: 'question_versions',
          localField: 'draftVersionId',
          foreignField: '_id',
          pipeline: [{ $project: { status: 1, versionNumber: 1 } }],
          as: 'draftVersion',
        },
      },
      {
        $lookup: {
          from: 'question_versions',
          localField: 'currentPublishedVersionId',
          foreignField: '_id',
          pipeline: [{ $project: { versionNumber: 1 } }],
          as: 'publishedVersion',
        },
      },
      {
        $set: {
          displayVersionId: {
            $ifNull: [
              { $arrayElemAt: ['$draftVersion._id', 0] },
              { $arrayElemAt: ['$publishedVersion._id', 0] },
            ],
          },
        },
      },
      candidateLookup,
      { $match: { 'candidateVersions.0': { $exists: true } } },
    ];

    if (query.search) {
      const regex = buildSafeQuestionSearchRegex(query.search);
      pipeline.push({
        $match: {
          $or: [
            { code: regex },
            { 'candidateVersions.prompt.vi': regex },
            { 'candidateVersions.prompt.en': regex },
          ],
        },
      });
    }

    pipeline.push({
      $facet: {
        items: [
          { $sort: sort },
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
        ],
        total: [{ $count: 'count' }],
      },
    });

    const [result] = await Question.aggregate<{
      items: AggregatedListQuestion[];
      total: Array<{ count: number }>;
    }>(pipeline);

    const items: QuestionListProjection[] = (result?.items ?? []).map((row) => {
      const draft = row.draftVersion[0];
      const published = row.publishedVersion[0];
      const displayVersion = row.candidateVersions[0];
      return {
        question: toQuestionRecord(row as unknown as IQuestion),
        draftStatus: draft?.status ?? null,
        selectionStatus: published ? 'PUBLISHED' : 'UNAVAILABLE',
        draftVersionNumber: draft?.versionNumber ?? null,
        currentPublishedVersionNumber: published?.versionNumber ?? null,
        displayVersion: toListVersionRecord(displayVersion),
      };
    });

    const total = result?.total[0]?.count ?? 0;
    return {
      items,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findQuestionById(
    questionId: string,
    session?: ClientSession
  ): Promise<QuestionRecord | null> {
    const query = Question.findById(questionId);
    if (session) query.session(session);
    const question = await query.exec();
    return question ? toQuestionRecord(question) : null;
  }

  async findQuestionDetail(questionId: string): Promise<QuestionDetailRecord | null> {
    const question = await Question.findById(questionId).exec();
    if (!question) return null;

    const versionIds = [question.draftVersionId, question.currentPublishedVersionId].filter(
      (value): value is Types.ObjectId => Boolean(value)
    );
    const versions = versionIds.length
      ? await QuestionVersion.find({ _id: { $in: versionIds } }).exec()
      : [];
    const byId = new Map(versions.map((version) => [version._id.toString(), version]));

    const draftVersion = question.draftVersionId
      ? byId.get(question.draftVersionId.toString()) ?? null
      : null;
    const publishedVersion = question.currentPublishedVersionId
      ? byId.get(question.currentPublishedVersionId.toString()) ?? null
      : null;

    return {
      question: toQuestionRecord(question),
      draftVersion: draftVersion ? toQuestionVersionRecord(draftVersion) : null,
      currentPublishedVersion: publishedVersion
        ? toQuestionVersionRecord(publishedVersion)
        : null,
    };
  }

  async listVersions(questionId: string): Promise<QuestionVersionRecord[]> {
    const versions = await QuestionVersion.find({ questionId: objectId(questionId) })
      .sort({ versionNumber: -1 })
      .exec();
    return versions.map(toQuestionVersionRecord);
  }

  async findVersion(
    questionId: string,
    versionNumber: number,
    session?: ClientSession
  ): Promise<QuestionVersionRecord | null> {
    const query = QuestionVersion.findOne({
      questionId: objectId(questionId),
      versionNumber,
    });
    if (session) query.session(session);
    const version = await query.exec();
    return version ? toQuestionVersionRecord(version) : null;
  }

  async updateQuestionMetadata(input: UpdateQuestionMetadataInput): Promise<QuestionUpdateResult> {
    const set: UnknownRecord = { updatedBy: objectId(input.actorId) };
    if (input.ownerId !== undefined) set.ownerId = objectId(input.ownerId);

    const question = await Question.findOneAndUpdate(
      { _id: objectId(input.questionId), revision: input.expectedRevision },
      { $set: set, $inc: { revision: 1 } },
      { returnDocument: 'after', runValidators: true }
    );
    if (question) return { kind: 'updated', question: toQuestionRecord(question) };

    const current = await Question.findById(input.questionId).select('revision').exec();
    return current
      ? { kind: 'conflict', currentRevision: current.revision }
      : { kind: 'not-found' };
  }

  async updateDraftVersion(
    input: UpdateDraftVersionInput,
    session?: ClientSession
  ): Promise<DraftVersionUpdateResult> {
    const set = draftChangesPersistence(input.changes);
    set.contentHash = input.contentHash;
    set.normalizedPromptFingerprint = input.normalizedPromptFingerprint;
    set.updatedBy = objectId(input.actorId);

    const updateQuery = QuestionVersion.findOneAndUpdate(
      {
        questionId: objectId(input.questionId),
        versionNumber: input.versionNumber,
        status: 'DRAFT',
        revision: input.expectedRevision,
      },
      { $set: set, $inc: { revision: 1 }, $addToSet: { contributorIds: objectId(input.actorId) } },
      { returnDocument: 'after', runValidators: true }
    );
    if (session) updateQuery.session(session);
    const version = await updateQuery.exec();
    if (version) return { kind: 'updated', version: toQuestionVersionRecord(version) };

    const currentQuery = QuestionVersion.findOne({
      questionId: objectId(input.questionId),
      versionNumber: input.versionNumber,
    })
      .select('status revision');
    if (session) currentQuery.session(session);
    const current = await currentQuery.exec();
    if (!current) return { kind: 'not-found' };
    if (current.status !== 'DRAFT') return { kind: 'immutable', status: current.status };
    return { kind: 'conflict', currentRevision: current.revision };
  }

  async findEligiblePublishedForSelection(
    filter: QuestionSelectionFilter
  ): Promise<QuestionSelectionItem[]> {
    const matchQuestion: Record<string, unknown> = {
      lifecycleStatus: 'ACTIVE',
      currentPublishedVersionId: { $ne: null },
    };
    if (filter.excludeQuestionIds && filter.excludeQuestionIds.length > 0) {
      matchQuestion._id = {
        $nin: filter.excludeQuestionIds.map(objectId),
      };
    }

    const versionMatch: Record<string, unknown> = {
      'publishedVersion.status': 'PUBLISHED',
    };

    if (filter.roleId) {
      versionMatch.$or = [
        { 'publishedVersion.primaryRoleId': objectId(filter.roleId) },
        { 'publishedVersion.additionalRoleIds': objectId(filter.roleId) },
      ];
    }

    if (filter.levelId) {
      versionMatch['publishedVersion.levelIds'] = objectId(filter.levelId);
    }

    if (filter.technologyIds && filter.technologyIds.length > 0) {
      const techOids = filter.technologyIds.map(objectId);
      const techCondition = [
        { 'publishedVersion.technologyAgnostic': true },
        { 'publishedVersion.technologies.technologyId': { $in: techOids } },
      ];
      if (versionMatch.$or) {
        versionMatch.$and = [
          { $or: versionMatch.$or },
          { $or: techCondition },
        ];
        delete versionMatch.$or;
      } else {
        versionMatch.$or = techCondition;
      }
    }

    if (filter.difficulty) {
      versionMatch['publishedVersion.difficulty'] = filter.difficulty;
    }

    if (filter.type) {
      versionMatch['publishedVersion.questionType'] = filter.type;
    }

    if (filter.language === 'vi') {
      versionMatch['publishedVersion.prompt.vi'] = { $exists: true, $nin: [null, ''] };
    } else if (filter.language === 'en') {
      versionMatch['publishedVersion.prompt.en'] = { $exists: true, $nin: [null, ''] };
    } else if ((filter as any).bilingual || (filter as any).language === 'both') {
      versionMatch['publishedVersion.prompt.vi'] = { $exists: true, $nin: [null, ''] };
      versionMatch['publishedVersion.prompt.en'] = { $exists: true, $nin: [null, ''] };
    }

    if (filter.tags && filter.tags.length > 0) {
      versionMatch['publishedVersion.tags'] = { $in: filter.tags };
    }

    const pipeline: PipelineStage[] = [
      { $match: matchQuestion },
      {
        $lookup: {
          from: 'question_versions',
          localField: 'currentPublishedVersionId',
          foreignField: '_id',
          as: 'publishedVersion',
        },
      },
      { $unwind: '$publishedVersion' },
      { $match: versionMatch },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          questionId: { $toString: '$_id' },
          versionId: { $toString: '$publishedVersion._id' },
          code: 1,
          versionNumber: '$publishedVersion.versionNumber',
          prompt: '$publishedVersion.prompt',
          type: '$publishedVersion.questionType',
          difficulty: '$publishedVersion.difficulty',
          primaryRoleId: { $toString: '$publishedVersion.primaryRoleId' },
          levelIds: {
            $map: {
              input: { $ifNull: ['$publishedVersion.levelIds', []] },
              as: 'id',
              in: { $toString: '$$id' },
            },
          },
          technologies: {
            $map: {
              input: { $ifNull: ['$publishedVersion.technologies', []] },
              as: 'tech',
              in: {
                technologyId: { $toString: '$$tech.technologyId' },
                relevance: '$$tech.relevance',
              },
            },
          },
          taxonomy: {
            primaryRoleId: { $toString: '$publishedVersion.primaryRoleId' },
            additionalRoleIds: {
              $map: {
                input: { $ifNull: ['$publishedVersion.additionalRoleIds', []] },
                as: 'id',
                in: { $toString: '$$id' },
              },
            },
            levelIds: {
              $map: {
                input: { $ifNull: ['$publishedVersion.levelIds', []] },
                as: 'id',
                in: { $toString: '$$id' },
              },
            },
            technologyIds: {
              $map: {
                input: { $ifNull: ['$publishedVersion.technologies', []] },
                as: 'tech',
                in: { $toString: '$$tech.technologyId' },
              },
            },
            topic: '$publishedVersion.topic',
            tags: '$publishedVersion.tags',
          },
        },
      },
    ];

    return Question.aggregate<QuestionSelectionItem>(pipeline).exec();
  }

  async getCoverageMetrics(filter: CoverageFilter): Promise<QuestionCoverageResult> {
    const totalQuestions = await Question.countDocuments();
    const activeQuestions = await Question.countDocuments({ lifecycleStatus: 'ACTIVE' });
    const retiredQuestions = await Question.countDocuments({ lifecycleStatus: 'RETIRED' });
    const publishedActiveQuestions = await Question.countDocuments({
      lifecycleStatus: 'ACTIVE',
      currentPublishedVersionId: { $ne: null },
    });
    const draftOnlyQuestions = activeQuestions - publishedActiveQuestions;

    const Role = mongoose.model('Role');
    const Level = mongoose.model('Level');
    const Technology = mongoose.model('Technology');

    const [allRoles, allLevels, allTechnologies] = await Promise.all([
      Role.find({ isActive: true }).select('name').lean(),
      Level.find({ isActive: true }).select('name').lean(),
      Technology.find({ isActive: true }).select('name').lean(),
    ]);

    const publishedPipeline: PipelineStage[] = [
      { $match: { lifecycleStatus: 'ACTIVE', currentPublishedVersionId: { $ne: null } } },
      {
        $lookup: {
          from: 'question_versions',
          localField: 'currentPublishedVersionId',
          foreignField: '_id',
          as: 'version',
        },
      },
      { $unwind: '$version' },
      { $match: { 'version.status': 'PUBLISHED' } },
    ];

    if (filter.roleId) {
      publishedPipeline.push({
        $match: {
          $or: [
            { 'version.primaryRoleId': objectId(filter.roleId) },
            { 'version.additionalRoleIds': objectId(filter.roleId) },
          ],
        },
      });
    }
    if (filter.levelId) {
      publishedPipeline.push({ $match: { 'version.levelIds': objectId(filter.levelId) } });
    }
    if (filter.technologyId) {
      publishedPipeline.push({
        $match: {
          $or: [
            { 'version.technologyAgnostic': true },
            { 'version.technologies.technologyId': objectId(filter.technologyId) },
          ],
        },
      });
    }
    if (filter.difficulty) {
      publishedPipeline.push({ $match: { 'version.difficulty': filter.difficulty } });
    }
    if (filter.type) {
      publishedPipeline.push({ $match: { 'version.questionType': filter.type } });
    }

    const publishedDocs = await Question.aggregate<{
      primaryRoleId: Types.ObjectId | null;
      levelIds: Types.ObjectId[];
      technologies: Array<{ technologyId: Types.ObjectId }>;
      difficulty: Difficulty | null;
      questionType: QuestionType | null;
      prompt: LocalizedText;
    }>([
      ...publishedPipeline,
      {
        $project: {
          primaryRoleId: '$version.primaryRoleId',
          levelIds: '$version.levelIds',
          technologies: '$version.technologies',
          difficulty: '$version.difficulty',
          questionType: '$version.questionType',
          prompt: '$version.prompt',
        },
      },
    ]).exec();

    const rolePublishedCounts = new Map<string, number>();
    const levelPublishedCounts = new Map<string, number>();
    const techPublishedCounts = new Map<string, number>();
    const byDifficulty: Record<Difficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
    const byType: Record<QuestionType, number> = {
      TECHNICAL: 0,
      BEHAVIORAL: 0,
      SYSTEM_DESIGN: 0,
      CODING: 0,
      SCENARIO: 0,
    };
    let viOnly = 0;
    let enOnly = 0;
    let bilingual = 0;

    for (const doc of publishedDocs) {
      if (doc.primaryRoleId) {
        const id = doc.primaryRoleId.toString();
        rolePublishedCounts.set(id, (rolePublishedCounts.get(id) ?? 0) + 1);
      }
      for (const lvl of doc.levelIds ?? []) {
        const id = lvl.toString();
        levelPublishedCounts.set(id, (levelPublishedCounts.get(id) ?? 0) + 1);
      }
      for (const t of doc.technologies ?? []) {
        const id = t.technologyId.toString();
        techPublishedCounts.set(id, (techPublishedCounts.get(id) ?? 0) + 1);
      }
      if (doc.difficulty && byDifficulty[doc.difficulty] !== undefined) {
        byDifficulty[doc.difficulty]++;
      }
      if (doc.questionType && byType[doc.questionType] !== undefined) {
        byType[doc.questionType]++;
      }
      const hasVi = Boolean(doc.prompt?.vi?.trim());
      const hasEn = Boolean(doc.prompt?.en?.trim());
      if (hasVi && hasEn) bilingual++;
      else if (hasVi) viOnly++;
      else if (hasEn) enOnly++;
    }

    const byRole = allRoles.map((r: any) => ({
      id: r._id.toString(),
      name: r.name,
      publishedCount: rolePublishedCounts.get(r._id.toString()) ?? 0,
      draftCount: 0,
      totalCount: rolePublishedCounts.get(r._id.toString()) ?? 0,
    }));

    const byLevel = allLevels.map((l: any) => ({
      id: l._id.toString(),
      name: l.name,
      publishedCount: levelPublishedCounts.get(l._id.toString()) ?? 0,
      draftCount: 0,
      totalCount: levelPublishedCounts.get(l._id.toString()) ?? 0,
    }));

    const byTechnology = allTechnologies.map((t: any) => ({
      id: t._id.toString(),
      name: t.name,
      publishedCount: techPublishedCounts.get(t._id.toString()) ?? 0,
      draftCount: 0,
      totalCount: techPublishedCounts.get(t._id.toString()) ?? 0,
    }));

    const gaps: CoverageGapItem[] = [];
    for (const r of byRole) {
      if (r.publishedCount === 0) {
        gaps.push({ dimension: 'ROLE', id: r.id, name: r.name, publishedCount: 0, gapType: 'ZERO_COVERAGE' });
      } else if (r.publishedCount < 3) {
        gaps.push({ dimension: 'ROLE', id: r.id, name: r.name, publishedCount: r.publishedCount, gapType: 'LOW_COVERAGE' });
      }
    }
    for (const l of byLevel) {
      if (l.publishedCount === 0) {
        gaps.push({ dimension: 'LEVEL', id: l.id, name: l.name, publishedCount: 0, gapType: 'ZERO_COVERAGE' });
      } else if (l.publishedCount < 3) {
        gaps.push({ dimension: 'LEVEL', id: l.id, name: l.name, publishedCount: l.publishedCount, gapType: 'LOW_COVERAGE' });
      }
    }
    for (const t of byTechnology) {
      if (t.publishedCount === 0) {
        gaps.push({ dimension: 'TECHNOLOGY', id: t.id, name: t.name, publishedCount: 0, gapType: 'ZERO_COVERAGE' });
      }
    }

    return {
      totalQuestions,
      activeQuestions,
      retiredQuestions,
      publishedActiveQuestions,
      draftOnlyQuestions,
      byRole,
      byLevel,
      byTechnology,
      byDifficulty,
      byType,
      byLanguage: { vi: viOnly, en: enOnly, bilingual },
      gaps,
    };
  }

  async getAnalyticsMetrics(filter: AnalyticsFilter): Promise<QuestionAnalyticsResult> {
    const totalQuestions = await Question.countDocuments();
    const totalVersions = await QuestionVersion.countDocuments();
    const publishedVersions = await QuestionVersion.countDocuments({ status: 'PUBLISHED' });
    const inReviewVersions = await QuestionVersion.countDocuments({ status: 'IN_REVIEW' });
    const draftVersions = await QuestionVersion.countDocuments({ status: 'DRAFT' });

    const activeQ = await Question.countDocuments({ lifecycleStatus: 'ACTIVE' });
    const retiredQ = await Question.countDocuments({ lifecycleStatus: 'RETIRED' });

    const versionStatusAgg = await QuestionVersion.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const versionStatusDistribution: Record<VersionStatus, number> = {
      DRAFT: 0,
      IN_REVIEW: 0,
      APPROVED: 0,
      PUBLISHED: 0,
      SUPERSEDED: 0,
    };
    for (const row of versionStatusAgg) {
      if (row._id in versionStatusDistribution) {
        versionStatusDistribution[row._id as VersionStatus] = row.count;
      }
    }

    const originAgg = await QuestionVersion.aggregate([
      { $group: { _id: '$origin', count: { $sum: 1 } } },
    ]);
    const originDistribution: Record<QuestionOrigin, number> = {
      MANUAL: 0,
      IMPORTED: 0,
      AI_ASSISTED: 0,
    };
    for (const row of originAgg) {
      if (row._id in originDistribution) {
        originDistribution[row._id as QuestionOrigin] = row.count;
      }
    }

    const diffAgg = await QuestionVersion.aggregate([
      { $match: { difficulty: { $ne: null } } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
    ]);
    const difficultyDistribution: Record<Difficulty, number> = {
      EASY: 0,
      MEDIUM: 0,
      HARD: 0,
    };
    for (const row of diffAgg) {
      if (row._id in difficultyDistribution) {
        difficultyDistribution[row._id as Difficulty] = row.count;
      }
    }

    const typeAgg = await QuestionVersion.aggregate([
      { $match: { questionType: { $ne: null } } },
      { $group: { _id: '$questionType', count: { $sum: 1 } } },
    ]);
    const typeDistribution: Record<QuestionType, number> = {
      TECHNICAL: 0,
      BEHAVIORAL: 0,
      SYSTEM_DESIGN: 0,
      CODING: 0,
      SCENARIO: 0,
    };
    for (const row of typeAgg) {
      if (row._id in typeDistribution) {
        typeDistribution[row._id as QuestionType] = row.count;
      }
    }

    const QuestionReview = mongoose.model('QuestionReview');
    const reviewMatch: Record<string, unknown> = {};
    if (filter.startDate || filter.endDate) {
      reviewMatch.createdAt = {};
      if (filter.startDate) (reviewMatch.createdAt as any).$gte = new Date(filter.startDate);
      if (filter.endDate) (reviewMatch.createdAt as any).$lte = new Date(filter.endDate);
    }

    const reviewTimelineAgg = await QuestionReview.aggregate<{
      _id: { date: string; action: string };
      count: number;
    }>([
      { $match: reviewMatch },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            action: '$action',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    const timelineMap = new Map<string, { submissions: number; approvals: number; changesRequested: number; publishes: number }>();
    for (const row of reviewTimelineAgg) {
      const date = row._id.date;
      if (!timelineMap.has(date)) {
        timelineMap.set(date, { submissions: 0, approvals: 0, changesRequested: 0, publishes: 0 });
      }
      const entry = timelineMap.get(date)!;
      if (row._id.action === 'SUBMIT') entry.submissions += row.count;
      else if (row._id.action === 'APPROVE') entry.approvals += row.count;
      else if (row._id.action === 'REQUEST_CHANGES') entry.changesRequested += row.count;
      else if (row._id.action === 'PUBLISH') entry.publishes += row.count;
    }

    const activityTimeline = Array.from(timelineMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    return {
      summary: {
        totalQuestions,
        totalVersions,
        publishedVersions,
        inReviewVersions,
        draftVersions,
      },
      lifecycleDistribution: {
        ACTIVE: activeQ,
        RETIRED: retiredQ,
      },
      versionStatusDistribution,
      originDistribution,
      difficultyDistribution,
      typeDistribution,
      activityTimeline,
    };
  }

  async findQuestionsForExport(
    filter: ExportFilter
  ): Promise<{ items: ExportableQuestionItem[]; total: number }> {
    const qMatch: Record<string, unknown> = {};
    if (filter.lifecycleStatus) qMatch.lifecycleStatus = filter.lifecycleStatus;

    const pipeline: PipelineStage[] = [
      { $match: qMatch },
      {
        $lookup: {
          from: 'question_versions',
          let: {
            publishedId: '$currentPublishedVersionId',
            draftId: '$draftVersionId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $cond: {
                    if: { $eq: [filter.status, 'PUBLISHED'] },
                    then: { $eq: ['$_id', '$$publishedId'] },
                    else: {
                      $cond: {
                        if: { $eq: [filter.status, 'DRAFT'] },
                        then: { $eq: ['$_id', '$$draftId'] },
                        else: { $or: [{ $eq: ['$_id', '$$publishedId'] }, { $eq: ['$_id', '$$draftId'] }] },
                      },
                    },
                  },
                },
              },
            },
          ],
          as: 'versions',
        },
      },
      { $unwind: '$versions' },
    ];

    if (filter.status) {
      pipeline.push({ $match: { 'versions.status': filter.status } });
    }
    if (filter.difficulty) {
      pipeline.push({ $match: { 'versions.difficulty': filter.difficulty } });
    }
    if (filter.type) {
      pipeline.push({ $match: { 'versions.questionType': filter.type } });
    }
    if (filter.roleId) {
      pipeline.push({
        $match: {
          $or: [
            { 'versions.primaryRoleId': objectId(filter.roleId) },
            { 'versions.additionalRoleIds': objectId(filter.roleId) },
          ],
        },
      });
    }
    if (filter.levelId) {
      pipeline.push({ $match: { 'versions.levelIds': objectId(filter.levelId) } });
    }
    if (filter.technologyId) {
      pipeline.push({
        $match: {
          $or: [
            { 'versions.technologyAgnostic': true },
            { 'versions.technologies.technologyId': objectId(filter.technologyId) },
          ],
        },
      });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Question.aggregate<{ total: number }>(countPipeline).exec();
    const total = countResult[0]?.total ?? 0;

    pipeline.push(
      { $sort: { code: 1 } },
      { $skip: filter.offset ?? 0 },
      { $limit: Math.min(filter.limit ?? 100, 500) },
      {
        $project: {
          _id: 0,
          code: 1,
          lifecycleStatus: 1,
          versionNumber: '$versions.versionNumber',
          status: '$versions.status',
          prompt: '$versions.prompt',
          explanation: '$versions.explanation',
          referenceAnswer: '$versions.referenceAnswer',
          learningObjective: '$versions.learningObjective',
          type: '$versions.questionType',
          difficulty: '$versions.difficulty',
          origin: '$versions.origin',
          taxonomy: {
            primaryRoleId: { $toString: '$versions.primaryRoleId' },
            additionalRoleIds: {
              $map: { input: '$versions.additionalRoleIds', as: 'id', in: { $toString: '$$id' } },
            },
            levelIds: {
              $map: { input: '$versions.levelIds', as: 'id', in: { $toString: '$$id' } },
            },
            technologyIds: {
              $map: { input: '$versions.technologies', as: 'tech', in: { $toString: '$$tech.technologyId' } },
            },
            technologyAgnostic: '$versions.technologyAgnostic',
            topic: '$versions.topic',
            tags: '$versions.tags',
          },
          rubricSummary: {
            $reduce: {
              input: '$versions.rubric',
              initialValue: '',
              in: {
                $concat: [
                  '$$value',
                  { $cond: [{ $eq: ['$$value', ''] }, '', '; '] },
                  '$$this.key',
                  ' (',
                  { $toString: '$$this.weight' },
                  '%)',
                ],
              },
            },
          },
          createdAt: { $dateToString: { date: '$createdAt' } },
          updatedAt: { $dateToString: { date: '$updatedAt' } },
        },
      }
    );

    const items = await Question.aggregate<ExportableQuestionItem>(pipeline).exec();
    return { items, total };
  }

  async bulkCreateImportedDrafts(
    items: ImportRowData[],
    actorId: string,
    session: ClientSession
  ): Promise<Array<{ id: string; code: string; versionNumber: number }>> {
    const actorOid = objectId(actorId);
    const created: Array<{ id: string; code: string; versionNumber: number }> = [];

    const QuestionCounter = mongoose.model('QuestionCounter');
    const year = new Date().getFullYear();

    for (const item of items) {
      const counter = await QuestionCounter.findOneAndUpdate(
        { scope: 'QUESTION_CODE', year },
        { $inc: { sequence: 1 }, $setOnInsert: { scope: 'QUESTION_CODE', year } },
        { upsert: true, returnDocument: 'after', session, setDefaultsOnInsert: true }
      );
      if (!counter) throw new Error('Could not allocate question counter');
      const code = `QB-${year}-${String(counter.sequence).padStart(6, '0')}`;

      const questionId = new Types.ObjectId();
      const versionId = new Types.ObjectId();

      const normalizedPrompt = item.prompt ? normalizePromptFingerprint(item.prompt) : null;
      const contentHash = createContentHash(item);

      const [question] = await Question.create(
        [
          {
            _id: questionId,
            code,
            lifecycleStatus: 'ACTIVE',
            currentPublishedVersionId: null,
            draftVersionId: versionId,
            latestVersionNumber: 1,
            ownerId: actorOid,
            revision: 0,
            createdBy: actorOid,
            updatedBy: actorOid,
          },
        ],
        { session }
      );

      const [version] = await QuestionVersion.create(
        [
          {
            _id: versionId,
            questionId,
            versionNumber: 1,
            status: 'DRAFT',
            revision: 0,
            prompt: item.prompt,
            explanation: item.explanation ?? { vi: null, en: null },
            followUps: item.followUps ?? [],
            referenceAnswer: item.referenceAnswer,
            learningObjective: item.learningObjective ?? { vi: null, en: null },
            estimatedTimeSeconds: item.estimatedTimeSeconds ?? null,
            rubric: item.rubric ?? [],
            questionType: item.type,
            difficulty: item.difficulty,
            primaryRoleId: objectId(item.primaryRoleId),
            additionalRoleIds: (item.additionalRoleIds ?? []).map(objectId),
            levelIds: item.levelIds.map(objectId),
            technologies: (item.technologyIds ?? []).map((t) => ({ technologyId: objectId(t), relevance: null })),
            technologyAgnostic: item.technologyAgnostic ?? false,
            classificationComplete: true,
            topic: item.topic ?? null,
            tags: item.tags ?? [],
            changeSummary: item.changeSummary ?? 'Imported question',
            origin: 'IMPORTED',
            sourceVersionId: null,
            sourceReference: null,
            contentHash,
            normalizedPromptFingerprint: normalizedPrompt,
            createdBy: actorOid,
            updatedBy: actorOid,
            contributorIds: [actorOid],
          },
        ],
        { session }
      );

      created.push({
        id: question._id.toString(),
        code: question.code,
        versionNumber: version.versionNumber,
      });
    }

    return created;
  }
}
