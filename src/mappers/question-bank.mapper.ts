import {
  Difficulty,
  LocalizedText,
  QuestionLifecycleStatus,
  QuestionOrigin,
  QuestionType,
  RubricCriterion,
  TechnologyAssignment,
  VersionStatus,
} from '../domain/question-bank/types';
import {
  PaginatedQuestionListProjection,
  QuestionDetailRecord,
  QuestionListProjection,
  QuestionVersionRecord,
} from '../repositories/interfaces/IQuestionRepository';
import {
  QuestionReviewRecord,
  ReviewDetailRecord,
  ReviewQueueItemRecord,
} from '../repositories/interfaces/IQuestionWorkflowRepository';
import { DomainValidationIssue } from '../domain/question-bank/errors';

export interface QuestionAdminListDto {
  id: string;
  code: string;
  lifecycleStatus: QuestionLifecycleStatus;
  revision: number;
  promptPreview: LocalizedText;
  taxonomy: {
    primaryRoleId: string | null;
    additionalRoleIds: string[];
    levelIds: string[];
    technologyIds: string[];
    technologyAgnostic: boolean | null;
    topic: string | null;
    tags: string[];
  };
  type: QuestionType | null;
  difficulty: Difficulty | null;
  origin: QuestionOrigin;
  draftStatus: VersionStatus | null;
  selectionStatus: 'PUBLISHED' | 'UNAVAILABLE';
  draftVersionNumber: number | null;
  currentPublishedVersionNumber: number | null;
  latestVersionNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionVersionAdminDetailDto {
  id: string;
  questionId: string;
  versionNumber: number;
  status: VersionStatus;
  revision: number;
  content: {
    prompt: LocalizedText;
    explanation: LocalizedText;
  };
  classification: {
    primaryRoleId: string | null;
    additionalRoleIds: string[];
    levelIds: string[];
    technologies: TechnologyAssignment[];
    technologyAgnostic: boolean | null;
    classificationComplete: boolean;
    topic: string | null;
    tags: string[];
    difficulty: Difficulty | null;
    type: QuestionType | null;
  };
  answer: {
    referenceAnswer: LocalizedText;
    learningObjective: LocalizedText;
    estimatedTimeSeconds: number | null;
    followUps: LocalizedText[];
  };
  rubric: RubricCriterion[];
  changeSummary: string | null;
  origin: QuestionOrigin;
  provenance: { sourceVersionId: string | null; sourceReference: string | null };
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionVersionSummaryDto {
  id: string;
  questionId: string;
  versionNumber: number;
  status: VersionStatus;
  revision: number;
  promptPreview: LocalizedText;
  type: QuestionType | null;
  difficulty: Difficulty | null;
  updatedAt: string;
}

export interface QuestionReviewHistoryDto {
  id: string;
  actorId: string;
  action: QuestionReviewRecord['action'];
  reason: string | null;
  fromState: string;
  toState: string;
  revision: number;
  createdAt: string;
}

export interface QuestionReviewQueueItemDto extends QuestionVersionSummaryDto {
  code: string;
  lifecycleStatus: QuestionLifecycleStatus;
  contributorIds: string[];
}

export interface QuestionReviewDetailDto {
  question: QuestionAdminDetailDto['question'];
  snapshot: QuestionVersionAdminDetailDto;
  history: QuestionReviewHistoryDto[];
  completenessErrors: DomainValidationIssue[];
  allowedActions: Array<'APPROVE' | 'REQUEST_CHANGES' | 'PUBLISH'>;
}

export interface QuestionAdminDetailDto {
  question: {
    id: string;
    code: string;
    lifecycleStatus: QuestionLifecycleStatus;
    ownerId: string;
    revision: number;
    latestVersionNumber: number;
    draftVersionNumber: number | null;
    currentPublishedVersionNumber: number | null;
    createdAt: string;
    updatedAt: string;
  };
  draftVersion: QuestionVersionAdminDetailDto | null;
  currentPublishedVersion: QuestionVersionAdminDetailDto | null;
}

export interface QuestionAdminListResultDto {
  items: QuestionAdminListDto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const copyLocalized = (value: LocalizedText): LocalizedText => ({
  vi: value.vi,
  en: value.en,
});

const preview = (value: string | null, maximum = 180): string | null => {
  if (value === null) return null;
  const characters = Array.from(value.trim());
  return characters.length <= maximum
    ? characters.join('')
    : `${characters.slice(0, maximum - 1).join('')}…`;
};

const copyRubric = (rubric: readonly RubricCriterion[]): RubricCriterion[] =>
  rubric.map((criterion) => ({
    key: criterion.key,
    title: copyLocalized(criterion.title),
    description: copyLocalized(criterion.description),
    weight: criterion.weight,
    levels: criterion.levels.map((level) => ({
      score: level.score,
      description: copyLocalized(level.description),
    })),
  }));

export const toQuestionAdminListDto = (
  record: QuestionListProjection
): QuestionAdminListDto => ({
  id: record.question.id,
  code: record.question.code,
  lifecycleStatus: record.question.lifecycleStatus,
  revision: record.question.revision,
  promptPreview: {
    vi: preview(record.displayVersion.prompt.vi),
    en: preview(record.displayVersion.prompt.en),
  },
  taxonomy: {
    primaryRoleId: record.displayVersion.primaryRoleId,
    additionalRoleIds: [...record.displayVersion.additionalRoleIds],
    levelIds: [...record.displayVersion.levelIds],
    technologyIds: record.displayVersion.technologies.map((item) => item.technologyId),
    technologyAgnostic: record.displayVersion.technologyAgnostic,
    topic: record.displayVersion.topic,
    tags: [...record.displayVersion.tags],
  },
  type: record.displayVersion.questionType,
  difficulty: record.displayVersion.difficulty,
  origin: record.displayVersion.origin,
  draftStatus: record.draftStatus,
  selectionStatus: record.selectionStatus,
  draftVersionNumber: record.draftVersionNumber,
  currentPublishedVersionNumber: record.currentPublishedVersionNumber,
  latestVersionNumber: record.question.latestVersionNumber,
  createdAt: record.question.createdAt.toISOString(),
  updatedAt: record.question.updatedAt.toISOString(),
});

export const toQuestionVersionAdminDetailDto = (
  version: QuestionVersionRecord
): QuestionVersionAdminDetailDto => ({
  id: version.id,
  questionId: version.questionId,
  versionNumber: version.versionNumber,
  status: version.status,
  revision: version.revision,
  content: {
    prompt: copyLocalized(version.prompt),
    explanation: copyLocalized(version.explanation),
  },
  classification: {
    primaryRoleId: version.primaryRoleId,
    additionalRoleIds: [...version.additionalRoleIds],
    levelIds: [...version.levelIds],
    technologies: version.technologies.map((item) => ({ ...item })),
    technologyAgnostic: version.technologyAgnostic,
    classificationComplete: version.classificationComplete,
    topic: version.topic,
    tags: [...version.tags],
    difficulty: version.difficulty,
    type: version.questionType,
  },
  answer: {
    referenceAnswer: copyLocalized(version.referenceAnswer),
    learningObjective: copyLocalized(version.learningObjective),
    estimatedTimeSeconds: version.estimatedTimeSeconds,
    followUps: version.followUps.map(copyLocalized),
  },
  rubric: copyRubric(version.rubric),
  changeSummary: version.changeSummary,
  origin: version.origin,
  provenance: {
    sourceVersionId: version.sourceVersionId,
    sourceReference: version.sourceReference,
  },
  createdBy: version.createdBy,
  updatedBy: version.updatedBy,
  createdAt: version.createdAt.toISOString(),
  updatedAt: version.updatedAt.toISOString(),
});

export const toQuestionVersionSummaryDto = (
  version: QuestionVersionRecord
): QuestionVersionSummaryDto => ({
  id: version.id,
  questionId: version.questionId,
  versionNumber: version.versionNumber,
  status: version.status,
  revision: version.revision,
  promptPreview: {
    vi: preview(version.prompt.vi),
    en: preview(version.prompt.en),
  },
  type: version.questionType,
  difficulty: version.difficulty,
  updatedAt: version.updatedAt.toISOString(),
});

export const toQuestionReviewHistoryDto = (
  review: QuestionReviewRecord
): QuestionReviewHistoryDto => ({
  id: review.id,
  actorId: review.actorId,
  action: review.action,
  reason: review.comment,
  fromState: review.fromState,
  toState: review.toState,
  revision: review.revision,
  createdAt: review.createdAt.toISOString(),
});

export const toQuestionReviewQueueItemDto = (
  record: ReviewQueueItemRecord
): QuestionReviewQueueItemDto => ({
  ...toQuestionVersionSummaryDto(record.version),
  code: record.question.code,
  lifecycleStatus: record.question.lifecycleStatus,
  contributorIds: [...record.version.contributorIds],
});

export const toQuestionReviewDetailDto = (
  record: ReviewDetailRecord,
  completenessErrors: DomainValidationIssue[],
  allowedActions: QuestionReviewDetailDto['allowedActions']
): QuestionReviewDetailDto => ({
  question: {
    id: record.question.id,
    code: record.question.code,
    lifecycleStatus: record.question.lifecycleStatus,
    ownerId: record.question.ownerId,
    revision: record.question.revision,
    latestVersionNumber: record.question.latestVersionNumber,
    draftVersionNumber: record.draftVersionNumber,
    currentPublishedVersionNumber: record.currentPublishedVersionNumber,
    createdAt: record.question.createdAt.toISOString(),
    updatedAt: record.question.updatedAt.toISOString(),
  },
  snapshot: toQuestionVersionAdminDetailDto(record.version),
  history: record.history.map(toQuestionReviewHistoryDto),
  completenessErrors: completenessErrors.map((issue) => ({ ...issue })),
  allowedActions: [...allowedActions],
});

export const toQuestionAdminDetailDto = (
  record: QuestionDetailRecord
): QuestionAdminDetailDto => ({
  question: {
    id: record.question.id,
    code: record.question.code,
    lifecycleStatus: record.question.lifecycleStatus,
    ownerId: record.question.ownerId,
    revision: record.question.revision,
    latestVersionNumber: record.question.latestVersionNumber,
    draftVersionNumber: record.draftVersion?.versionNumber ?? null,
    currentPublishedVersionNumber: record.currentPublishedVersion?.versionNumber ?? null,
    createdAt: record.question.createdAt.toISOString(),
    updatedAt: record.question.updatedAt.toISOString(),
  },
  draftVersion: record.draftVersion
    ? toQuestionVersionAdminDetailDto(record.draftVersion)
    : null,
  currentPublishedVersion: record.currentPublishedVersion
    ? toQuestionVersionAdminDetailDto(record.currentPublishedVersion)
    : null,
});

export const toQuestionAdminListResultDto = (
  result: PaginatedQuestionListProjection
): QuestionAdminListResultDto => ({
  items: result.items.map(toQuestionAdminListDto),
  pagination: { ...result.pagination },
});
