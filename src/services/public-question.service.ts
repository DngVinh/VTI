import { injectable } from 'tsyringe';
import { PipelineStage, Types } from 'mongoose';
import Question from '../models/question.model';
import QuestionVersion from '../models/question-version.model';
import Role from '../models/role.model';
import Level from '../models/level.model';
import Technology from '../models/technology.model';
import {
  IPublicQuestionService,
  PaginatedPublicQuestionsDto,
  PublicQuestionDetailDto,
  PublicQuestionFilterQuery,
  PublicQuestionSummaryDto,
  PublicTaxonomyDto,
} from './interfaces/IPublicQuestionService';

@injectable()
export class PublicQuestionService implements IPublicQuestionService {
  async listPublicQuestions(
    query: PublicQuestionFilterQuery
  ): Promise<PaginatedPublicQuestionsDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const matchConditions: Record<string, any>[] = [
      { lifecycleStatus: 'ACTIVE' },
      { currentPublishedVersionId: { $ne: null } },
    ];

    const versionConditions: Record<string, any>[] = [
      { 'version.status': 'PUBLISHED' },
    ];

    if (query.roleId && Types.ObjectId.isValid(query.roleId)) {
      const rOid = new Types.ObjectId(query.roleId);
      versionConditions.push({
        $or: [
          { 'version.primaryRoleId': rOid },
          { 'version.additionalRoleIds': rOid },
        ],
      });
    }

    if (query.levelId && Types.ObjectId.isValid(query.levelId)) {
      versionConditions.push({
        'version.levelIds': new Types.ObjectId(query.levelId),
      });
    }

    if (query.technologyId && Types.ObjectId.isValid(query.technologyId)) {
      versionConditions.push({
        'version.technologies.technologyId': new Types.ObjectId(query.technologyId),
      });
    }

    if (query.difficulty) {
      versionConditions.push({ 'version.difficulty': query.difficulty });
    }

    const typeFilter = query.questionType || query.type;
    if (typeFilter) {
      versionConditions.push({ 'version.questionType': typeFilter });
    }

    const escapeRegex = (value: string): string =>
      value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (query.search && query.search.trim().length > 0) {
      const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'iu');
      versionConditions.push({
        $or: [
          { 'version.prompt.vi': searchRegex },
          { 'version.prompt.en': searchRegex },
          { 'version.topic': searchRegex },
          { 'version.tags': searchRegex },
          { code: searchRegex },
        ],
      });
    }

    const pipeline: PipelineStage[] = [
      { $match: { $and: matchConditions } },
      {
        $lookup: {
          from: 'question_versions',
          localField: 'currentPublishedVersionId',
          foreignField: '_id',
          as: 'version',
        },
      },
      { $unwind: '$version' },
      { $match: { $and: versionConditions } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $sort: { 'version.updatedAt': -1, _id: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'roles',
                localField: 'version.primaryRoleId',
                foreignField: '_id',
                as: 'roleInfo',
              },
            },
            {
              $lookup: {
                from: 'levels',
                localField: 'version.levelIds',
                foreignField: '_id',
                as: 'levelsInfo',
              },
            },
            {
              $lookup: {
                from: 'technologies',
                localField: 'version.technologies.technologyId',
                foreignField: '_id',
                as: 'techsInfo',
              },
            },
          ],
        },
      },
    ];

    const [result] = await Question.aggregate(pipeline).exec();
    const total = result?.metadata?.[0]?.total || 0;
    const rawItems = result?.data || [];

    const items: PublicQuestionSummaryDto[] = rawItems.map((item: any) => {
      const role = item.roleInfo?.[0];
      const levels = item.levelsInfo || [];
      const techs = item.techsInfo || [];
      const techMap = new Map(techs.map((t: any) => [t._id.toString(), t]));

      const technologies = (item.version.technologies || []).map((t: any) => {
        const techDoc: any = techMap.get(t.technologyId.toString());
        return {
          id: t.technologyId.toString(),
          name: techDoc?.name || 'Unknown',
          code: techDoc?.code,
          relevance: t.relevance,
        };
      });

      return {
        id: item._id.toString(),
        code: item.code,
        prompt: item.version.prompt || { vi: null, en: null },
        difficulty: item.version.difficulty || null,
        questionType: item.version.questionType || null,
        primaryRoleId: item.version.primaryRoleId?.toString() ?? null,
        role: role
          ? { id: role._id.toString(), name: role.name, code: role.code }
          : null,
        levelIds: (item.version.levelIds || []).map((l: any) => l.toString()),
        levels: levels.map((l: any) => ({
          id: l._id.toString(),
          name: l.name,
          code: l.code,
        })),
        technologies,
        topic: item.version.topic || null,
        tags: item.version.tags || [],
        updatedAt: new Date(item.version?.updatedAt || item.updatedAt || Date.now()).toISOString(),
      };
    });

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getPublicQuestionDetail(id: string): Promise<PublicQuestionDetailDto | null> {
    if (!Types.ObjectId.isValid(id)) return null;

    const question = await Question.findById(id).exec();
    if (!question || question.lifecycleStatus !== 'ACTIVE' || !question.currentPublishedVersionId) {
      return null;
    }

    const version = await QuestionVersion.findById(question.currentPublishedVersionId).exec();
    if (!version || version.status !== 'PUBLISHED') {
      return null;
    }

    const [role, levels, techs] = await Promise.all([
      version.primaryRoleId ? Role.findById(version.primaryRoleId).exec() : null,
      version.levelIds?.length ? Level.find({ _id: { $in: version.levelIds } }).exec() : [],
      version.technologies?.length
        ? Technology.find({
            _id: { $in: version.technologies.map((t) => t.technologyId) },
          }).exec()
        : [],
    ]);

    const techMap = new Map(techs.map((t) => [t._id.toString(), t]));

    return {
      id: question._id.toString(),
      code: question.code,
      versionNumber: version.versionNumber,
      prompt: version.prompt || { vi: null, en: null },
      explanation: version.explanation || { vi: null, en: null },
      referenceAnswer: version.referenceAnswer || { vi: null, en: null },
      learningObjective: version.learningObjective || { vi: null, en: null },
      rubric: version.rubric || [],
      difficulty: version.difficulty || null,
      questionType: version.questionType || null,
      primaryRoleId: version.primaryRoleId?.toString() ?? null,
      role: role
        ? { id: role._id.toString(), name: role.name, code: role.code }
        : null,
      levelIds: (version.levelIds || []).map((l) => l.toString()),
      levels: levels.map((l) => ({
        id: l._id.toString(),
        name: l.name,
        code: l.code,
      })),
      technologies: (version.technologies || []).map((t) => {
        const techDoc = techMap.get(t.technologyId.toString());
        return {
          id: t.technologyId.toString(),
          name: techDoc?.name || 'Unknown',
          code: techDoc?.code,
          relevance: t.relevance,
        };
      }),
      topic: version.topic || null,
      tags: version.tags || [],
      estimatedTimeSeconds: version.estimatedTimeSeconds ?? null,
      updatedAt: new Date(version.updatedAt || question.updatedAt || Date.now()).toISOString(),
    };
  }

  async getPublicTaxonomy(roleId?: string): Promise<PublicTaxonomyDto> {
    const techFilter: Record<string, any> = { status: 'ACTIVE' };
    if (roleId && Types.ObjectId.isValid(roleId)) {
      techFilter.roles = new Types.ObjectId(roleId);
    }

    const [roles, levels, techs] = await Promise.all([
      Role.find({ status: 'ACTIVE' }).sort({ name: 1 }).lean().exec(),
      Level.find({ status: 'ACTIVE' }).sort({ rank: 1, name: 1 }).lean().exec(),
      Technology.find(techFilter).sort({ name: 1 }).lean().exec(),
    ]);

    return {
      roles: roles.map((r: any) => ({
        id: r._id.toString(),
        name: r.name,
        code: r.code,
      })),
      levels: levels.map((l: any) => ({
        id: l._id.toString(),
        name: l.name,
        code: l.code,
      })),
      technologies: techs.map((t: any) => ({
        id: t._id.toString(),
        name: t.name,
        code: t.code,
      })),
    };
  }
}
