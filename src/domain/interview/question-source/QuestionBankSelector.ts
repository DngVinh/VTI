import { injectable, inject } from 'tsyringe';
import { IQuestionRepository } from '../../../repositories/interfaces/IQuestionRepository';
import { IQuestionBankSelector, QuestionBankCandidateItem } from './types';

import mongoose from 'mongoose';
import Role from '../../../models/role.model';
import Level from '../../../models/level.model';
import Technology from '../../../models/technology.model';

@injectable()
export class QuestionBankSelector implements IQuestionBankSelector {
  constructor(
    @inject('IQuestionRepository') private questionRepo: IQuestionRepository
  ) {}

  async findEligibleQuestions(filter: {
    roleId?: string;
    levelId?: string;
    technologyIds?: string[];
    excludeQuestionIds?: string[];
  }): Promise<QuestionBankCandidateItem[]> {
    let resolvedRoleId = filter.roleId;
    if (resolvedRoleId && !mongoose.Types.ObjectId.isValid(resolvedRoleId)) {
      const role = await Role.findOne({
        $or: [{ name: resolvedRoleId }, { code: resolvedRoleId }],
      });
      if (role) resolvedRoleId = role.id;
    }

    let resolvedLevelId = filter.levelId;
    if (resolvedLevelId && !mongoose.Types.ObjectId.isValid(resolvedLevelId)) {
      const level = await Level.findOne({
        $or: [{ name: resolvedLevelId }, { code: resolvedLevelId }],
      });
      if (level) resolvedLevelId = level.id;
    }

    let resolvedTechIds = filter.technologyIds;
    if (Array.isArray(resolvedTechIds)) {
      const mappedTechIds: string[] = [];
      for (const t of resolvedTechIds) {
        if (mongoose.Types.ObjectId.isValid(t)) {
          mappedTechIds.push(t);
        } else {
          const tech = await Technology.findOne({
            $or: [{ name: t }, { code: t }],
          });
          if (tech) mappedTechIds.push(tech.id);
        }
      }
      resolvedTechIds = mappedTechIds;
    }

    const rawItems = await this.questionRepo.findEligiblePublishedForSelection({
      roleId: resolvedRoleId,
      levelId: resolvedLevelId,
      technologyIds: resolvedTechIds,
      excludeQuestionIds: filter.excludeQuestionIds,
      count: 100,
      language: 'vi',
      bilingual: true,
    } as any);

    const eligible: QuestionBankCandidateItem[] = [];
    for (const item of rawItems) {
      const vi = item.prompt?.vi?.trim();
      const en = item.prompt?.en?.trim();
      if (!vi || !en) continue;

      eligible.push({
        questionId: item.questionId,
        versionId: item.versionId || item.id,
        versionNumber: item.versionNumber,
        code: item.code,
        prompt: { vi, en },
        difficulty: (item.difficulty || 'MEDIUM').toUpperCase(),
        type: item.type,
        primaryRoleId: item.primaryRoleId,
        levelIds: item.levelIds,
        technologyIds: item.taxonomy?.technologyIds,
      });
    }

    return eligible;
  }
}
