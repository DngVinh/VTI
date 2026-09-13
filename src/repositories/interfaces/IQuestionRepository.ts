import { ClientSession } from 'mongoose';
import {
  Difficulty,
  LocalizedText,
  QuestionLifecycleStatus,
  QuestionOrigin,
  QuestionType,
  QuestionVersionDraftFields,
  RubricCriterion,
  TechnologyAssignment,
  VersionStatus,
  QuestionSelectionFilter,
  QuestionSelectionItem,
  CoverageFilter,
  QuestionCoverageResult,
  AnalyticsFilter,
  QuestionAnalyticsResult,
  ExportFilter,
  ExportableQuestionItem,
  ImportRowData,
} from '../../domain/question-bank/types';

export interface QuestionRecord {
  id: string;
  code: string;
  lifecycleStatus: QuestionLifecycleStatus;
  currentPublishedVersionId: string | null;
  draftVersionId: string | null;
  latestVersionNumber: number;
  ownerId: string;
  revision: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionVersionRecord extends QuestionVersionDraftFields {
  id: string;
  questionId: string;
  versionNumber: number;
  status: VersionStatus;
  revision: number;
  origin: QuestionOrigin;
  sourceVersionId: string | null;
  sourceReference: string | null;
  contentHash: string;
  normalizedPromptFingerprint: string | null;
  createdBy: string;
  updatedBy: string;
  contributorIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionListProjection {
  question: QuestionRecord;
  draftStatus: VersionStatus | null;
  selectionStatus: 'PUBLISHED' | 'UNAVAILABLE';
  draftVersionNumber: number | null;
  currentPublishedVersionNumber: number | null;
  displayVersion: QuestionListVersionRecord;
}

export interface QuestionDetailRecord {
  question: QuestionRecord;
  draftVersion: QuestionVersionRecord | null;
  currentPublishedVersion: QuestionVersionRecord | null;
}

export interface QuestionListQuery {
  page: number;
  limit: number;
  search?: string;
  lifecycleStatus?: QuestionLifecycleStatus;
  versionStatus?: VersionStatus;
  roleId?: string;
  levelId?: string;
  technologyId?: string;
  difficulty?: Difficulty;
  questionType?: QuestionType;
  origin?: QuestionOrigin;
  ownerId?: string;
  sortBy: 'updatedAt' | 'createdAt' | 'code';
  sortDirection: 'asc' | 'desc';
}

export interface PaginatedQuestionListProjection {
  items: QuestionListProjection[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PersistedDraftInput extends QuestionVersionDraftFields {
  origin: QuestionOrigin;
  sourceVersionId?: string | null;
  sourceReference?: string | null;
  contentHash: string;
  normalizedPromptFingerprint?: string | null;
}

export interface CreateQuestionAggregateInput {
  code: string;
  ownerId: string;
  actorId: string;
  draft: PersistedDraftInput;
}

export interface CreateDraftVersionInput {
  questionId: string;
  actorId: string;
  expectedQuestionRevision: number;
  draft: PersistedDraftInput;
}

export interface UpdateQuestionMetadataInput {
  questionId: string;
  actorId: string;
  expectedRevision: number;
  ownerId?: string;
}

export interface UpdateDraftVersionInput {
  questionId: string;
  versionNumber: number;
  actorId: string;
  expectedRevision: number;
  changes: Partial<QuestionVersionDraftFields>;
  contentHash: string;
  normalizedPromptFingerprint: string | null;
}

export type QuestionUpdateResult =
  | { kind: 'updated'; question: QuestionRecord }
  | { kind: 'not-found' }
  | { kind: 'conflict'; currentRevision: number };

export type DraftVersionUpdateResult =
  | { kind: 'updated'; version: QuestionVersionRecord }
  | { kind: 'not-found' }
  | { kind: 'immutable'; status: VersionStatus }
  | { kind: 'conflict'; currentRevision: number };

export type DraftVersionCreateResult =
  | { kind: 'created'; question: QuestionRecord; version: QuestionVersionRecord }
  | { kind: 'not-found' }
  | { kind: 'active-draft'; draftVersionId: string }
  | { kind: 'invalid-lifecycle'; lifecycleStatus: QuestionLifecycleStatus }
  | { kind: 'conflict'; currentRevision: number };

export interface IQuestionRepository {
  withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T>;

  createQuestionAggregate(
    input: CreateQuestionAggregateInput,
    session: ClientSession
  ): Promise<{ question: QuestionRecord; version: QuestionVersionRecord }>;

  createDraftVersion(
    input: CreateDraftVersionInput,
    session: ClientSession
  ): Promise<DraftVersionCreateResult>;

  listQuestions(query: QuestionListQuery): Promise<PaginatedQuestionListProjection>;
  findQuestionById(questionId: string, session?: ClientSession): Promise<QuestionRecord | null>;
  findQuestionDetail(questionId: string): Promise<QuestionDetailRecord | null>;
  listVersions(questionId: string): Promise<QuestionVersionRecord[]>;
  findVersion(
    questionId: string,
    versionNumber: number,
    session?: ClientSession
  ): Promise<QuestionVersionRecord | null>;

  updateQuestionMetadata(input: UpdateQuestionMetadataInput): Promise<QuestionUpdateResult>;
  updateDraftVersion(
    input: UpdateDraftVersionInput,
    session?: ClientSession
  ): Promise<DraftVersionUpdateResult>;

  findEligiblePublishedForSelection(
    filter: QuestionSelectionFilter
  ): Promise<QuestionSelectionItem[]>;

  getCoverageMetrics(filter: CoverageFilter): Promise<QuestionCoverageResult>;

  getAnalyticsMetrics(filter: AnalyticsFilter): Promise<QuestionAnalyticsResult>;

  findQuestionsForExport(
    filter: ExportFilter
  ): Promise<{ items: ExportableQuestionItem[]; total: number }>;

  bulkCreateImportedDrafts(
    items: ImportRowData[],
    actorId: string,
    session: ClientSession
  ): Promise<Array<{ id: string; code: string; versionNumber: number }>>;
}

export interface QuestionListVersionRecord {
  id: string;
  questionId: string;
  versionNumber: number;
  status: VersionStatus;
  revision: number;
  prompt: LocalizedText;
  questionType: QuestionType | null;
  difficulty: Difficulty | null;
  primaryRoleId: string | null;
  additionalRoleIds: string[];
  levelIds: string[];
  technologies: TechnologyAssignment[];
  technologyAgnostic: boolean | null;
  topic: string | null;
  tags: string[];
  origin: QuestionOrigin;
  updatedAt: Date;
}
