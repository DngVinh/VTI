import { inject, injectable } from 'tsyringe';
import { ClientSession } from 'mongoose';
import {
  createQuestionEtag,
  createQuestionVersionEtag,
} from '../domain/question-bank/etag';
import { QuestionBankDomainError } from '../domain/question-bank/errors';
import { getEnv } from '../config/env';
import { createContentHash, normalizePromptFingerprint } from '../domain/question-bank/hashing';
import {
  createIdempotencyFingerprint,
  createIdempotencyKeyHash,
} from '../domain/question-bank/idempotency';
import {
  assertCanCreateDraft,
  assertDraftMutable,
  assertFourEyes,
  assertQuestionComplete,
  assertQuestionLibraryReady,
  assertRubricValid,
  validateQuestionCompleteness,
  normalizeTags,
  uniqueIds,
} from '../domain/question-bank/policies';
import {
  createEmptyQuestionVersionDraft,
  LocalizedText,
  QuestionVersionDraftFields,
  RubricCriterion,
} from '../domain/question-bank/types';
import {
  toQuestionAdminDetailDto,
  toQuestionAdminListResultDto,
  toQuestionVersionAdminDetailDto,
  toQuestionVersionSummaryDto,
  toQuestionReviewDetailDto,
  toQuestionReviewQueueItemDto,
} from '../mappers/question-bank.mapper';
import {
  IQuestionRepository,
  PersistedDraftInput,
  QuestionDetailRecord,
  QuestionVersionRecord,
} from '../repositories/interfaces/IQuestionRepository';
import {
  IQuestionCounterRepository,
  IQuestionIdempotencyRepository,
  IQuestionOutboxRepository,
  IQuestionTaxonomyRepository,
  QuestionTaxonomyReferenceInput,
} from '../repositories/interfaces/IQuestionSupportRepositories';
import { IQuestionWorkflowRepository } from '../repositories/interfaces/IQuestionWorkflowRepository';
import {
  IQuestionBankService,
  QuestionBankCommandContext,
  QuestionBankListResult,
  QuestionBankMutationResult,
  QuestionBankPrecondition,
  QuestionBankReadResult,
} from './interfaces/IQuestionBankService';
import {
  CreateQuestionInput,
  CreateQuestionVersionInput,
  ListQuestionsInput,
  UpdateQuestionInput,
  UpdateQuestionVersionInput,
  PublishQuestionVersionInput,
  QuestionLifecycleInput,
  ReviewDecisionInput,
  ReviewQueueInput,
  SubmitReviewInput,
  SelectQuestionsInput,
  CoverageQueryInput,
  AnalyticsQueryInput,
  ImportQuestionsInput,
  ExportQuestionsInput,
  GenerateAiDraftInput,
} from '../validators/question-bank.validator';
import {
  QuestionSelectionResult,
  QuestionCoverageResult,
  QuestionAnalyticsResult,
  QuestionImportResult,
  QuestionExportResult,
  QuestionAiDraftResult,
  ImportRowData,
  ImportRowError,
  Difficulty,
  QuestionType,
} from '../domain/question-bank/types';
import { evaluateSelectionPool } from '../domain/question-bank/selection';
import { formatCsvRow, parseCsvString } from '../domain/question-bank/csv';
import { IAiQuestionDraftProvider } from './interfaces/IAiQuestionDraftProvider';
import { IQuestionEmbeddingRepository } from '../repositories/interfaces/IQuestionEmbeddingRepository';
import { IQuestionTranslationProvider } from './interfaces/IQuestionTranslationProvider';
import { IQuestionEmbeddingProvider } from './interfaces/IQuestionEmbeddingProvider';
import {
  cosineSimilarity,
  validateVector,
  buildDiscoverabilityText,
  rankDuplicateMatches,
} from '../domain/question-bank/similarity';
import {
  TranslationPreviewInput,
  TranslationApplyInput,
  EmbeddingBackfillInput,
  SemanticDuplicateInput,
} from '../validators/question-bank.validator';
import {
  QuestionTranslationPreviewResult,
  QuestionEmbeddingBackfillResult,
  QuestionDuplicateDetectionResult,
  TranslationField,
  TranslationFieldStatus,
  QuestionDuplicateMatch,
} from '../domain/question-bank/types';
import Question from '../models/question.model';
import QuestionVersion from '../models/question-version.model';
import { Types } from 'mongoose';

const IDEMPOTENCY_SCOPE = 'QUESTION_BANK_ADMIN';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;

const cloneLocalized = (value: LocalizedText): LocalizedText => ({
  vi: value.vi,
  en: value.en,
});

const normalizeLocalized = (
  value: { vi?: string | null; en?: string | null } | undefined,
  current: LocalizedText
): LocalizedText => ({
  vi: value?.vi !== undefined ? value.vi : current.vi,
  en: value?.en !== undefined ? value.en : current.en,
});

const cloneRubric = (rubric: readonly RubricCriterion[]): RubricCriterion[] =>
  rubric.map((criterion) => ({
    key: criterion.key,
    title: cloneLocalized(criterion.title),
    description: cloneLocalized(criterion.description),
    weight: criterion.weight,
    levels: criterion.levels.map((level) => ({
      score: level.score,
      description: cloneLocalized(level.description),
    })),
  }));

const draftFromVersion = (
  source?: QuestionVersionDraftFields
): QuestionVersionDraftFields => {
  const value = source ?? createEmptyQuestionVersionDraft();
  return {
    prompt: cloneLocalized(value.prompt),
    explanation: cloneLocalized(value.explanation),
    followUps: value.followUps.map(cloneLocalized),
    referenceAnswer: cloneLocalized(value.referenceAnswer),
    learningObjective: cloneLocalized(value.learningObjective),
    estimatedTimeSeconds: value.estimatedTimeSeconds,
    rubric: cloneRubric(value.rubric),
    questionType: value.questionType,
    difficulty: value.difficulty,
    primaryRoleId: value.primaryRoleId,
    additionalRoleIds: [...value.additionalRoleIds],
    levelIds: [...value.levelIds],
    technologies: value.technologies.map((item) => ({ ...item })),
    technologyAgnostic: value.technologyAgnostic,
    classificationComplete: value.classificationComplete,
    topic: value.topic,
    tags: [...value.tags],
    changeSummary: value.changeSummary,
  };
};

type AuthoringInput = CreateQuestionInput | UpdateQuestionVersionInput;

const applyAuthoringInput = (
  current: QuestionVersionDraftFields,
  input: AuthoringInput
): QuestionVersionDraftFields => {
  const next = draftFromVersion(current);
  if (input.content?.prompt) {
    next.prompt = normalizeLocalized(input.content.prompt, next.prompt);
  }
  if (input.content?.explanation) {
    next.explanation = normalizeLocalized(input.content.explanation, next.explanation);
  }
  if (input.classification) {
    const value = input.classification;
    if (value.primaryRoleId !== undefined) next.primaryRoleId = value.primaryRoleId;
    if (value.additionalRoleIds !== undefined) {
      next.additionalRoleIds = uniqueIds(value.additionalRoleIds);
    }
    if (value.levelIds !== undefined) next.levelIds = uniqueIds(value.levelIds);
    if (value.technologies !== undefined) {
      next.technologies = value.technologies.map((item) => ({
        technologyId: item.technologyId,
        relevance: item.relevance ?? null,
      }));
    }
    if (value.technologyAgnostic !== undefined) {
      next.technologyAgnostic = value.technologyAgnostic;
    }
    if (value.classificationComplete !== undefined) {
      next.classificationComplete = value.classificationComplete;
    }
    if (value.topic !== undefined) next.topic = value.topic;
    if (value.tags !== undefined) next.tags = normalizeTags(value.tags);
    if (value.difficulty !== undefined) next.difficulty = value.difficulty;
    if (value.type !== undefined) next.questionType = value.type;
  }
  if (input.answer) {
    const value = input.answer;
    if (value.referenceAnswer) {
      next.referenceAnswer = normalizeLocalized(value.referenceAnswer, next.referenceAnswer);
    }
    if (value.learningObjective) {
      next.learningObjective = normalizeLocalized(value.learningObjective, next.learningObjective);
    }
    if (value.estimatedTimeSeconds !== undefined) {
      next.estimatedTimeSeconds = value.estimatedTimeSeconds;
    }
    if (value.followUps !== undefined) {
      next.followUps = value.followUps.map((item) => normalizeLocalized(item, { vi: null, en: null }));
    }
  }
  if (input.rubric !== undefined) {
    next.rubric = input.rubric.map((criterion) => ({
      key: criterion.key,
      title: normalizeLocalized(criterion.title, { vi: null, en: null }),
      description: normalizeLocalized(criterion.description, { vi: null, en: null }),
      weight: criterion.weight,
      levels: criterion.levels.map((level) => ({
        score: level.score as 0 | 1 | 2 | 3 | 4,
        description: normalizeLocalized(level.description, { vi: null, en: null }),
      })),
    }));
  }
  if (input.changeSummary !== undefined) next.changeSummary = input.changeSummary;
  return next;
};

const persistedDraft = (
  draft: QuestionVersionDraftFields,
  sourceVersionId: string | null = null
): PersistedDraftInput => ({
  ...draft,
  origin: 'MANUAL',
  sourceVersionId,
  sourceReference: null,
  contentHash: createContentHash(draft),
  normalizedPromptFingerprint: normalizePromptFingerprint(draft.prompt),
});

const duplicateKey = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && (error as { code?: number }).code === 11000);

@injectable()
export class QuestionBankService implements IQuestionBankService {
  constructor(
    @inject('IQuestionRepository') private readonly questions: IQuestionRepository,
    @inject('IQuestionCounterRepository') private readonly counters: IQuestionCounterRepository,
    @inject('IQuestionIdempotencyRepository')
    private readonly idempotency: IQuestionIdempotencyRepository,
    @inject('IQuestionOutboxRepository') private readonly outbox: IQuestionOutboxRepository,
    @inject('IQuestionTaxonomyRepository')
    private readonly taxonomy: IQuestionTaxonomyRepository,
    @inject('IQuestionWorkflowRepository')
    private readonly workflow: IQuestionWorkflowRepository,
    @inject('IAiQuestionDraftProvider')
    private readonly aiProvider: IAiQuestionDraftProvider,
    @inject('IQuestionEmbeddingRepository')
    private readonly embeddings: IQuestionEmbeddingRepository,
    @inject('IQuestionTranslationProvider')
    private readonly translationProvider: IQuestionTranslationProvider,
    @inject('IQuestionEmbeddingProvider')
    private readonly embeddingProvider: IQuestionEmbeddingProvider
  ) {}

  async listQuestions(query: ListQuestionsInput): Promise<QuestionBankListResult> {
    return toQuestionAdminListResultDto(
      await this.questions.listQuestions({
        page: query.page,
        limit: query.limit,
        search: query.search,
        lifecycleStatus: query.lifecycleStatus,
        versionStatus: query.status,
        roleId: query.roleId,
        levelId: query.levelId,
        technologyId: query.technologyId,
        difficulty: query.difficulty,
        questionType: query.type,
        origin: query.origin,
        sortBy: query.sortBy,
        sortDirection: query.sortOrder,
      })
    );
  }

  async createQuestion(
    input: CreateQuestionInput,
    context: QuestionBankCommandContext
  ): Promise<QuestionBankMutationResult<ReturnType<typeof toQuestionAdminDetailDto>>> {
    await this.assertTaxonomyValid(this.taxonomyInput(input));
    const draft = applyAuthoringInput(createEmptyQuestionVersionDraft(), input);
    assertRubricValid(draft.rubric);
    const claim = this.claimValues(context, input);

    const replay = await this.replayQuestion(claim);
    if (replay) return replay;

    try {
      return await this.questions.withTransaction(async (session) => {
        await this.idempotency.createClaim(
          { ...claim, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS) },
          session
        );
        const { code } = await this.counters.allocateCode(new Date().getUTCFullYear(), session);
        const aggregate = await this.questions.createQuestionAggregate(
          { code, ownerId: context.actorId, actorId: context.actorId, draft: persistedDraft(draft) },
          session
        );
        await this.outbox.enqueue(
          {
            aggregateId: aggregate.question.id,
            eventType: 'QUESTION_CREATED',
            payload: {
              questionId: aggregate.question.id,
              code: aggregate.question.code,
              versionNumber: 1,
              revision: aggregate.version.revision,
            },
          },
          session
        );
        await this.idempotency.completeClaim(
          {
            ...claim,
            result: {
              resourceType: 'QUESTION',
              questionId: aggregate.question.id,
              versionNumber: 1,
              httpStatus: 201,
            },
          },
          session
        );
        return {
          data: toQuestionAdminDetailDto({
            question: aggregate.question,
            draftVersion: aggregate.version,
            currentPublishedVersion: null,
          }),
          etag: createQuestionVersionEtag(aggregate.version.id, aggregate.version.revision),
        };
      });
    } catch (error) {
      if (duplicateKey(error)) {
        const recovered = await this.replayQuestion(claim);
        if (recovered) return recovered;
        throw new QuestionBankDomainError(
          'QUESTION_CODE_CONFLICT',
          'Không thể cấp mã câu hỏi duy nhất'
        );
      }
      throw error;
    }
  }

  async getQuestion(
    questionId: string
  ): Promise<QuestionBankReadResult<ReturnType<typeof toQuestionAdminDetailDto>>> {
    const detail = await this.requireQuestionDetail(questionId);
    const etag = detail.draftVersion
      ? createQuestionVersionEtag(detail.draftVersion.id, detail.draftVersion.revision)
      : createQuestionEtag(detail.question.id, detail.question.revision);
    return { data: toQuestionAdminDetailDto(detail), etag };
  }

  async updateQuestion(
    questionId: string,
    input: UpdateQuestionInput,
    precondition: QuestionBankPrecondition,
    actorId: string
  ): Promise<QuestionBankMutationResult<ReturnType<typeof toQuestionAdminDetailDto>>> {
    this.assertPreconditionResource(precondition, questionId);
    const result = await this.questions.updateQuestionMetadata({
      questionId,
      actorId,
      expectedRevision: precondition.revision,
      ownerId: input.ownerId,
    });
    if (result.kind === 'not-found') this.notFound('QUESTION_NOT_FOUND');
    if (result.kind === 'conflict') this.conflict(result.currentRevision);
    const detail = await this.requireQuestionDetail(questionId);
    return {
      data: toQuestionAdminDetailDto(detail),
      etag: createQuestionEtag(result.question.id, result.question.revision),
    };
  }

  async listVersions(questionId: string) {
    if (!(await this.questions.findQuestionById(questionId))) {
      this.notFound('QUESTION_NOT_FOUND');
    }
    return (await this.questions.listVersions(questionId)).map(toQuestionVersionSummaryDto);
  }

  async createVersion(
    questionId: string,
    input: CreateQuestionVersionInput,
    context: QuestionBankCommandContext,
    aggregatePrecondition: QuestionBankPrecondition
  ): Promise<QuestionBankMutationResult<ReturnType<typeof toQuestionVersionAdminDetailDto>>> {
    this.assertPreconditionResource(aggregatePrecondition, questionId);
    const claim = this.claimValues(context, { input, aggregatePrecondition });
    const replay = await this.replayVersion(claim);
    if (replay) return replay;

    const detail = await this.requireQuestionDetail(questionId);
    if (detail.question.revision !== aggregatePrecondition.revision) {
      this.conflict(detail.question.revision);
    }
    assertCanCreateDraft(detail.question.lifecycleStatus, Boolean(detail.draftVersion));

    let source: QuestionVersionRecord | null = null;
    if (input.sourceVersionNumber !== undefined) {
      source = await this.questions.findVersion(questionId, input.sourceVersionNumber);
      if (!source) this.notFound('QUESTION_VERSION_NOT_FOUND');
    } else {
      source = detail.currentPublishedVersion;
    }
    if (!source) {
      throw new QuestionBankDomainError(
        'QUESTION_INVALID_STATE_TRANSITION',
        'Cần sourceVersionNumber hoặc current published version để tạo Draft mới'
      );
    }

    const { sourceVersionNumber: _sourceVersionNumber, ...authoring } = input;
    void _sourceVersionNumber;
    await this.assertTaxonomyValid(this.taxonomyInput(authoring));
    const draft = applyAuthoringInput(draftFromVersion(source), authoring);
    assertRubricValid(draft.rubric);

    try {
      return await this.questions.withTransaction(async (session) => {
        await this.idempotency.createClaim(
          { ...claim, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS) },
          session
        );
        const created = await this.questions.createDraftVersion(
          {
            questionId,
            actorId: context.actorId,
            expectedQuestionRevision: aggregatePrecondition.revision,
            draft: persistedDraft(draft, source.id),
          },
          session
        );
        if (created.kind === 'not-found') this.notFound('QUESTION_NOT_FOUND');
        if (created.kind === 'active-draft') {
          throw new QuestionBankDomainError(
            'QUESTION_ACTIVE_DRAFT_EXISTS',
            'Câu hỏi đã có Draft đang hoạt động'
          );
        }
        if (created.kind === 'invalid-lifecycle') {
          throw new QuestionBankDomainError(
            'QUESTION_INVALID_STATE_TRANSITION',
            'Không thể tạo Draft cho câu hỏi đã retire'
          );
        }
        if (created.kind === 'conflict') this.conflict(created.currentRevision);
        await this.outbox.enqueue(
          {
            aggregateId: questionId,
            eventType: 'QUESTION_VERSION_CREATED',
            payload: {
              questionId,
              versionNumber: created.version.versionNumber,
              revision: created.version.revision,
            },
          },
          session
        );
        await this.idempotency.completeClaim(
          {
            ...claim,
            result: {
              resourceType: 'QUESTION_VERSION',
              questionId,
              versionNumber: created.version.versionNumber,
              httpStatus: 201,
            },
          },
          session
        );
        return {
          data: toQuestionVersionAdminDetailDto(created.version),
          etag: createQuestionVersionEtag(created.version.id, created.version.revision),
        };
      });
    } catch (error) {
      if (duplicateKey(error)) {
        const recovered = await this.replayVersion(claim);
        if (recovered) return recovered;
        throw new QuestionBankDomainError(
          'QUESTION_ACTIVE_DRAFT_EXISTS',
          'Câu hỏi đã có Draft đang hoạt động'
        );
      }
      throw error;
    }
  }

  async getVersion(questionId: string, versionNumber: number) {
    const version = await this.questions.findVersion(questionId, versionNumber);
    if (!version) this.notFound('QUESTION_VERSION_NOT_FOUND');
    return {
      data: toQuestionVersionAdminDetailDto(version),
      etag: createQuestionVersionEtag(version.id, version.revision),
    };
  }

  async updateVersion(
    questionId: string,
    versionNumber: number,
    input: UpdateQuestionVersionInput,
    precondition: QuestionBankPrecondition,
    actorId: string
  ) {
    const current = await this.questions.findVersion(questionId, versionNumber);
    if (!current) this.notFound('QUESTION_VERSION_NOT_FOUND');
    this.assertPreconditionResource(precondition, current.id);
    assertDraftMutable(current.status);
    await this.assertTaxonomyValid(this.taxonomyInput(input));
    const next = applyAuthoringInput(draftFromVersion(current), input);
    assertRubricValid(next.rubric);
    return this.questions.withTransaction(async (session) => {
      const result = await this.questions.updateDraftVersion(
        {
          questionId,
          versionNumber,
          actorId,
          expectedRevision: precondition.revision,
          changes: next,
          contentHash: createContentHash(next),
          normalizedPromptFingerprint: normalizePromptFingerprint(next.prompt),
        },
        session
      );
      if (result.kind === 'not-found') this.notFound('QUESTION_VERSION_NOT_FOUND');
      if (result.kind === 'immutable') {
        throw new QuestionBankDomainError(
          'QUESTION_VERSION_IMMUTABLE',
          'Phiên bản ' + result.status + ' không thể chỉnh sửa'
        );
      }
      if (result.kind === 'conflict') this.conflict(result.currentRevision);
      await this.outbox.enqueue(
        {
          aggregateId: questionId,
          eventType: 'QUESTION_DRAFT_UPDATED',
          payload: {
            questionId,
            versionNumber: result.version.versionNumber,
            revision: result.version.revision,
          },
        },
        session
      );
      return {
        data: toQuestionVersionAdminDetailDto(result.version),
        etag: createQuestionVersionEtag(result.version.id, result.version.revision),
      };
    });
  }

  async submitReview(
    questionId: string,
    input: SubmitReviewInput,
    context: QuestionBankCommandContext,
    precondition: QuestionBankPrecondition
  ) {
    const detail = await this.requireQuestionDetail(questionId);
    const draft = detail.draftVersion;
    if (!draft) {
      throw new QuestionBankDomainError(
        'QUESTION_INVALID_STATE_TRANSITION',
        'Câu hỏi không có Draft để gửi review'
      );
    }
    this.assertPreconditionResource(precondition, draft.id);
    const claim = this.claimValues(context, { questionId, input, precondition });
    const replay = await this.replayVersion(claim);
    if (replay) return replay;

    let result: QuestionVersionRecord;
    try {
      result = await this.questions.withTransaction(async (session) => {
        await this.idempotency.createClaim(
          { ...claim, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS) },
          session
        );
        const current = await this.requireVersion(questionId, draft.versionNumber, session);
        assertQuestionComplete(current);
        await this.assertStoredTaxonomyValid(current, session);
        const transitioned = await this.workflow.transitionVersion(
          {
            questionId,
            versionNumber: current.versionNumber,
            expectedRevision: precondition.revision,
            from: ['DRAFT'],
            to: 'IN_REVIEW',
            actorId: context.actorId,
            action: 'SUBMIT',
            reason: input.reason ?? null,
            requestId: context.requestId ?? 'req_unknown',
          },
          session
        );
        const updated = this.requireWorkflowUpdated(transitioned);
        await this.outbox.enqueue(
          {
            aggregateId: questionId,
            eventType: 'QUESTION_SUBMITTED',
            payload: this.workflowPayload(updated.version, context.actorId, 'DRAFT', 'IN_REVIEW'),
          },
          session
        );
        await this.completeVersionClaim(claim, questionId, updated.version.versionNumber, session);
        return updated.version;
      });
    } catch (error) {
      if (duplicateKey(error)) {
        const recovered = await this.replayVersion(claim);
        if (recovered) return recovered;
      }
      throw error;
    }
    return {
      data: toQuestionVersionAdminDetailDto(result),
      etag: createQuestionVersionEtag(result.id, result.revision),
    };
  }

  async listReviews(query: ReviewQueueInput) {
    const result = await this.workflow.listQueue(query);
    return {
      items: result.items.map(toQuestionReviewQueueItemDto),
      pagination: result.pagination,
    };
  }

  async getReview(questionVersionId: string, actorId: string) {
    const detail = await this.workflow.findReviewDetail(questionVersionId);
    if (!detail) this.notFound('QUESTION_REVIEW_NOT_FOUND');
    const completenessErrors = await this.completenessWithTaxonomy(detail.version);
    return {
      data: toQuestionReviewDetailDto(
        detail,
        completenessErrors,
        this.allowedReviewActions(detail.version.status, actorId, detail.version.contributorIds)
      ),
      etag: createQuestionVersionEtag(detail.version.id, detail.version.revision),
    };
  }

  async decideReview(
    questionVersionId: string,
    input: ReviewDecisionInput,
    context: QuestionBankCommandContext,
    precondition: QuestionBankPrecondition
  ) {
    const detail = await this.workflow.findReviewDetail(questionVersionId);
    if (!detail) this.notFound('QUESTION_REVIEW_NOT_FOUND');
    this.assertPreconditionResource(precondition, detail.version.id);
    if (input.decision === 'APPROVE') {
      assertFourEyes(context.actorId, detail.version.contributorIds, this.fourEyesEnabled());
    }
    const claim = this.claimValues(context, { questionVersionId, input, precondition });
    const replay = await this.replayVersion(claim);
    if (replay) {
      const replayDetail = await this.workflow.findReviewDetail(replay.data.id);
      if (!replayDetail) this.notFound('QUESTION_REVIEW_NOT_FOUND');
      return {
        data: toQuestionReviewDetailDto(
          replayDetail,
          await this.completenessWithTaxonomy(replayDetail.version),
          this.allowedReviewActions(
            replayDetail.version.status,
            context.actorId,
            replayDetail.version.contributorIds
          )
        ),
        etag: replay.etag,
        replayed: true,
      };
    }

    const version = await this.questions.withTransaction(async (session) => {
      await this.idempotency.createClaim(
        { ...claim, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS) },
        session
      );
      const current = await this.requireVersion(
        detail.question.id,
        detail.version.versionNumber,
        session
      );
      if (input.decision === 'APPROVE') {
        assertQuestionComplete(current);
        await this.assertStoredTaxonomyValid(current, session);
        assertFourEyes(context.actorId, current.contributorIds, this.fourEyesEnabled());
      }
      const to = input.decision === 'APPROVE' ? 'APPROVED' : 'DRAFT';
      const transitioned = await this.workflow.transitionVersion(
        {
          questionId: detail.question.id,
          versionNumber: current.versionNumber,
          expectedRevision: precondition.revision,
          from: input.decision === 'APPROVE' ? ['IN_REVIEW'] : ['IN_REVIEW', 'APPROVED'],
          to,
          actorId: context.actorId,
          action: input.decision,
          reason: input.reason ?? null,
          requestId: context.requestId ?? 'req_unknown',
        },
        session
      );
      const updated = this.requireWorkflowUpdated(transitioned);
      await this.outbox.enqueue(
        {
          aggregateId: detail.question.id,
          eventType:
            input.decision === 'APPROVE'
              ? 'QUESTION_APPROVED'
              : 'QUESTION_CHANGES_REQUESTED',
          payload: this.workflowPayload(
            updated.version,
            context.actorId,
            current.status,
            to
          ),
        },
        session
      );
      await this.completeVersionClaim(
        claim,
        detail.question.id,
        updated.version.versionNumber,
        session
      );
      return updated.version;
    });
    const updatedDetail = await this.workflow.findReviewDetail(version.id);
    if (!updatedDetail) this.notFound('QUESTION_REVIEW_NOT_FOUND');
    return {
      data: toQuestionReviewDetailDto(
        updatedDetail,
        await this.completenessWithTaxonomy(updatedDetail.version),
        this.allowedReviewActions(
          updatedDetail.version.status,
          context.actorId,
          updatedDetail.version.contributorIds
        )
      ),
      etag: createQuestionVersionEtag(version.id, version.revision),
    };
  }

  async publishVersion(
    questionId: string,
    versionNumber: number,
    input: PublishQuestionVersionInput,
    context: QuestionBankCommandContext,
    precondition: QuestionBankPrecondition
  ) {
    const initial = await this.requireVersion(questionId, versionNumber);
    this.assertPreconditionResource(precondition, initial.id);
    const direct = input.direct === true;
    if (!direct) {
      assertFourEyes(context.actorId, initial.contributorIds, this.fourEyesEnabled());
    }
    const claim = this.claimValues(context, { questionId, versionNumber, input, precondition });
    const replay = await this.replayVersion(claim);
    if (replay) return replay;

    const published = await this.questions.withTransaction(async (session) => {
      await this.idempotency.createClaim(
        { ...claim, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS) },
        session
      );
      const current = await this.requireVersion(questionId, versionNumber, session);
      if (direct) {
        assertQuestionLibraryReady(current);
      } else {
        assertQuestionComplete(current);
        await this.assertStoredTaxonomyValid(current, session);
        assertFourEyes(context.actorId, current.contributorIds, this.fourEyesEnabled());
      }
      const result = await this.workflow.publishVersion(
        {
          questionId,
          versionNumber,
          expectedRevision: precondition.revision,
          actorId: context.actorId,
          reason: input.reason ?? null,
          requestId: context.requestId ?? 'req_unknown',
          allowDraft: direct,
        },
        session
      );
      const updated = this.requireWorkflowUpdated(result);
      if (result.supersededVersionNumber !== undefined) {
        await this.outbox.enqueue(
          {
            aggregateId: questionId,
            eventType: 'QUESTION_SUPERSEDED',
            payload: {
              questionId,
              versionNumber: result.supersededVersionNumber,
              actorId: context.actorId,
              fromState: 'PUBLISHED',
              toState: 'SUPERSEDED',
            },
          },
          session
        );
      }
      await this.outbox.enqueue(
        {
          aggregateId: questionId,
          eventType: 'QUESTION_PUBLISHED',
          payload: this.workflowPayload(
            updated.version,
            context.actorId,
            direct ? 'DRAFT' : 'APPROVED',
            'PUBLISHED'
          ),
        },
        session
      );
      await this.completeVersionClaim(claim, questionId, versionNumber, session);
      return updated.version;
    });
    return {
      data: toQuestionVersionAdminDetailDto(published),
      etag: createQuestionVersionEtag(published.id, published.revision),
    };
  }

  async retireQuestion(
    questionId: string,
    input: QuestionLifecycleInput,
    context: QuestionBankCommandContext,
    precondition: QuestionBankPrecondition
  ) {
    return this.transitionLifecycle(questionId, input, context, precondition, 'ACTIVE', 'RETIRED');
  }

  async restoreQuestion(
    questionId: string,
    input: QuestionLifecycleInput,
    context: QuestionBankCommandContext,
    precondition: QuestionBankPrecondition
  ) {
    return this.transitionLifecycle(questionId, input, context, precondition, 'RETIRED', 'ACTIVE');
  }

  private async transitionLifecycle(
    questionId: string,
    input: QuestionLifecycleInput,
    context: QuestionBankCommandContext,
    precondition: QuestionBankPrecondition,
    from: 'ACTIVE' | 'RETIRED',
    to: 'ACTIVE' | 'RETIRED'
  ) {
    this.assertPreconditionResource(precondition, questionId);
    const claim = this.claimValues(context, { questionId, input, precondition, from, to });
    const replay = await this.replayQuestion(claim);
    if (replay) return replay;
    const question = await this.questions.withTransaction(async (session) => {
      await this.idempotency.createClaim(
        { ...claim, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS) },
        session
      );
      const result = await this.workflow.transitionLifecycle(
        {
          questionId,
          expectedRevision: precondition.revision,
          from,
          to,
          actorId: context.actorId,
          reason: input.reason,
          requestId: context.requestId ?? 'req_unknown',
        },
        session
      );
      if (result.kind === 'question-not-found') this.notFound('QUESTION_NOT_FOUND');
      if (result.kind === 'conflict') this.conflict(result.currentRevision);
      if (result.kind === 'invalid-state') {
        throw new QuestionBankDomainError(
          'QUESTION_INVALID_STATE_TRANSITION',
          `Không thể chuyển lifecycle từ ${result.currentState} sang ${to}`
        );
      }
      await this.outbox.enqueue(
        {
          aggregateId: questionId,
          eventType: to === 'RETIRED' ? 'QUESTION_RETIRED' : 'QUESTION_RESTORED',
          payload: {
            questionId,
            revision: result.question.revision,
            actorId: context.actorId,
            fromState: from,
            toState: to,
          },
        },
        session
      );
      await this.idempotency.completeClaim(
        {
          ...claim,
          result: {
            resourceType: 'QUESTION',
            questionId,
            versionNumber: null,
            httpStatus: 200,
          },
        },
        session
      );
      return result.question;
    });
    const detail = await this.requireQuestionDetail(question.id);
    return {
      data: toQuestionAdminDetailDto(detail),
      etag: createQuestionEtag(question.id, question.revision),
    };
  }

  private async requireVersion(
    questionId: string,
    versionNumber: number,
    session?: ClientSession
  ): Promise<QuestionVersionRecord> {
    const version = await this.questions.findVersion(questionId, versionNumber, session);
    if (!version) this.notFound('QUESTION_VERSION_NOT_FOUND');
    return version;
  }

  private requireWorkflowUpdated<T extends { kind: string }>(
    result: T
  ): Extract<T, { kind: 'updated' }> {
    if (result.kind === 'question-not-found') this.notFound('QUESTION_NOT_FOUND');
    if (result.kind === 'version-not-found') this.notFound('QUESTION_VERSION_NOT_FOUND');
    if (result.kind === 'retired') {
      throw new QuestionBankDomainError(
        'QUESTION_INVALID_STATE_TRANSITION',
        'Câu hỏi đã retire; hãy restore trước khi tiếp tục workflow'
      );
    }
    if (result.kind === 'conflict') {
      this.conflict((result as unknown as { currentRevision: number }).currentRevision);
    }
    if (result.kind === 'invalid-state') {
      throw new QuestionBankDomainError(
        'QUESTION_INVALID_STATE_TRANSITION',
        `Trạng thái hiện tại ${(result as unknown as { currentState: string }).currentState} không cho phép thao tác`
      );
    }
    return result as Extract<T, { kind: 'updated' }>;
  }

  private workflowPayload(
    version: QuestionVersionRecord,
    actorId: string,
    fromState: string,
    toState: string
  ) {
    return {
      questionId: version.questionId,
      versionNumber: version.versionNumber,
      revision: version.revision,
      actorId,
      fromState,
      toState,
    };
  }

  private async completeVersionClaim(
    claim: ReturnType<QuestionBankService['claimValues']>,
    questionId: string,
    versionNumber: number,
    session: ClientSession
  ): Promise<void> {
    await this.idempotency.completeClaim(
      {
        ...claim,
        result: {
          resourceType: 'QUESTION_VERSION',
          questionId,
          versionNumber,
          httpStatus: 200,
        },
      },
      session
    );
  }

  private fourEyesEnabled(): boolean {
    return getEnv().QUESTION_BANK_REVIEW_FOUR_EYES;
  }

  private allowedReviewActions(
    status: QuestionVersionRecord['status'],
    actorId: string,
    contributorIds: readonly string[]
  ): Array<'APPROVE' | 'REQUEST_CHANGES' | 'PUBLISH'> {
    const separated =
      !this.fourEyesEnabled() ||
      !contributorIds.some((id) => id.toLowerCase() === actorId.toLowerCase());
    if (status === 'IN_REVIEW') {
      return separated ? ['APPROVE', 'REQUEST_CHANGES'] : ['REQUEST_CHANGES'];
    }
    if (status === 'APPROVED') {
      return separated ? ['REQUEST_CHANGES', 'PUBLISH'] : ['REQUEST_CHANGES'];
    }
    return [];
  }

  private taxonomyFromVersion(version: QuestionVersionRecord): QuestionTaxonomyReferenceInput {
    return {
      roleIds: uniqueIds([
        ...(version.primaryRoleId ? [version.primaryRoleId] : []),
        ...version.additionalRoleIds,
      ]),
      levelIds: uniqueIds(version.levelIds),
      technologyIds: uniqueIds(version.technologies.map((item) => item.technologyId)),
    };
  }

  private async assertStoredTaxonomyValid(
    version: QuestionVersionRecord,
    session?: ClientSession
  ): Promise<void> {
    await this.assertTaxonomyValid(this.taxonomyFromVersion(version), session);
  }

  private async completenessWithTaxonomy(version: QuestionVersionRecord) {
    const issues = validateQuestionCompleteness(version);
    const invalid = await this.taxonomy.findInvalidReferences(this.taxonomyFromVersion(version));
    (['roleIds', 'levelIds', 'technologyIds'] as const).forEach((field) => {
      invalid.missing[field].forEach((id) =>
        issues.push({ field, message: `Taxonomy ${id} không tồn tại` })
      );
      invalid.inactive[field].forEach((id) =>
        issues.push({ field, message: `Taxonomy ${id} không hoạt động` })
      );
    });
    return issues;
  }

  private claimValues(context: QuestionBankCommandContext, payload: unknown) {
    const base = {
      scope: IDEMPOTENCY_SCOPE,
      route: context.route,
      actorId: context.actorId,
      keyHash: createIdempotencyKeyHash(context.idempotencyKey),
    };
    return {
      ...base,
      requestFingerprint: createIdempotencyFingerprint({
        scope: base.scope,
        route: base.route,
        payload,
      }),
    };
  }

  private async replayQuestion(claim: ReturnType<QuestionBankService['claimValues']>) {
    const existing = await this.idempotency.findClaim(claim);
    if (!existing) return null;
    this.assertFingerprint(existing.requestFingerprint, claim.requestFingerprint);
    if (existing.status !== 'COMPLETED' || !existing.result) {
      throw new QuestionBankDomainError(
        'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        'Yêu cầu cùng Idempotency-Key đang được xử lý hoặc chờ retry'
      );
    }
    const detail = await this.requireQuestionDetail(existing.result.questionId);
    const version = detail.draftVersion;
    return {
      data: toQuestionAdminDetailDto(detail),
      etag: existing.result.versionNumber !== null && version
        ? createQuestionVersionEtag(version.id, version.revision)
        : createQuestionEtag(detail.question.id, detail.question.revision),
      replayed: true,
    };
  }

  private async replayVersion(claim: ReturnType<QuestionBankService['claimValues']>) {
    const existing = await this.idempotency.findClaim(claim);
    if (!existing) return null;
    this.assertFingerprint(existing.requestFingerprint, claim.requestFingerprint);
    if (
      existing.status !== 'COMPLETED' ||
      !existing.result ||
      existing.result.versionNumber === null
    ) {
      throw new QuestionBankDomainError(
        'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        'Yêu cầu cùng Idempotency-Key đang được xử lý hoặc chờ retry'
      );
    }
    const version = await this.questions.findVersion(
      existing.result.questionId,
      existing.result.versionNumber
    );
    if (!version) this.notFound('QUESTION_VERSION_NOT_FOUND');
    return {
      data: toQuestionVersionAdminDetailDto(version),
      etag: createQuestionVersionEtag(version.id, version.revision),
      replayed: true,
    };
  }

  private assertFingerprint(actual: string, expected: string): void {
    if (actual !== expected) {
      throw new QuestionBankDomainError(
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency-Key đã được dùng với payload khác'
      );
    }
  }

  private async requireQuestionDetail(questionId: string): Promise<QuestionDetailRecord> {
    const detail = await this.questions.findQuestionDetail(questionId);
    if (!detail) this.notFound('QUESTION_NOT_FOUND');
    return detail;
  }

  private assertPreconditionResource(
    precondition: QuestionBankPrecondition,
    resourceId: string
  ): void {
    if (precondition.resourceId.toLowerCase() !== resourceId.toLowerCase()) {
      throw new QuestionBankDomainError(
        'QUESTION_REVISION_CONFLICT',
        'ETag không thuộc resource đang cập nhật'
      );
    }
  }

  private conflict(currentRevision: number): never {
    throw new QuestionBankDomainError(
      'QUESTION_REVISION_CONFLICT',
      `Revision đã thay đổi; revision hiện tại là ${currentRevision}`
    );
  }

  private notFound(
    code: 'QUESTION_NOT_FOUND' | 'QUESTION_VERSION_NOT_FOUND' | 'QUESTION_REVIEW_NOT_FOUND'
  ): never {
    throw new QuestionBankDomainError(
      code,
      code === 'QUESTION_NOT_FOUND'
        ? 'Không tìm thấy câu hỏi'
        : code === 'QUESTION_REVIEW_NOT_FOUND'
          ? 'Không tìm thấy review'
          : 'Không tìm thấy phiên bản câu hỏi'
    );
  }

  private taxonomyInput(input: AuthoringInput): QuestionTaxonomyReferenceInput {
    const classification = input.classification;
    return {
      roleIds: uniqueIds([
        ...(classification?.primaryRoleId ? [classification.primaryRoleId] : []),
        ...(classification?.additionalRoleIds ?? []),
      ]),
      levelIds: uniqueIds(classification?.levelIds ?? []),
      technologyIds: uniqueIds(
        classification?.technologies?.map((item) => item.technologyId) ?? []
      ),
    };
  }

  private async assertTaxonomyValid(
    input: QuestionTaxonomyReferenceInput,
    session?: ClientSession
  ): Promise<void> {
    if (!input.roleIds.length && !input.levelIds.length && !input.technologyIds.length) return;
    const invalid = await this.taxonomy.findInvalidReferences(input, session);
    const issues: Array<{ field: string; message: string }> = [];
    (['roleIds', 'levelIds', 'technologyIds'] as const).forEach((field) => {
      invalid.missing[field].forEach((id) =>
        issues.push({ field, message: `Taxonomy ${id} không tồn tại` })
      );
      invalid.inactive[field].forEach((id) =>
        issues.push({ field, message: `Taxonomy ${id} không hoạt động` })
      );
    });
    if (issues.length) {
      throw new QuestionBankDomainError(
        'VALIDATION_ERROR',
        'Taxonomy reference không hợp lệ',
        issues
      );
    }
  }

  async selectQuestions(input: SelectQuestionsInput): Promise<QuestionSelectionResult> {
    const eligibleItems = await this.questions.findEligiblePublishedForSelection(input);
    return evaluateSelectionPool(eligibleItems, input.count, input.seed);
  }

  async getCoverage(query: CoverageQueryInput): Promise<QuestionCoverageResult> {
    return this.questions.getCoverageMetrics(query);
  }

  async getAnalytics(query: AnalyticsQueryInput): Promise<QuestionAnalyticsResult> {
    return this.questions.getAnalyticsMetrics(query);
  }

  async importQuestions(
    input: ImportQuestionsInput,
    context: QuestionBankCommandContext
  ): Promise<QuestionBankMutationResult<QuestionImportResult>> {
    let rows: ImportRowData[] = [];
    if (input.items && input.items.length > 0) {
      rows = input.items as ImportRowData[];
    } else if (input.format === 'CSV' && input.content) {
      const parsedCsv = parseCsvString(input.content);
      if (parsedCsv.length < 2) {
        throw new QuestionBankDomainError(
          'VALIDATION_ERROR',
          'File CSV phải có dòng tiêu đề và ít nhất 1 dòng dữ liệu'
        );
      }
      const headers = parsedCsv[0].map((h) => h.trim().toLowerCase());
      const headerIndex = (name: string) => headers.indexOf(name);

      for (let i = 1; i < parsedCsv.length; i++) {
        const row = parsedCsv[i];
        if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;
        const getVal = (col: string) => {
          const idx = headerIndex(col);
          return idx >= 0 && idx < row.length ? row[idx].trim() : '';
        };
        const promptVi = getVal('prompt_vi') || null;
        const promptEn = getVal('prompt_en') || null;
        const expVi = getVal('explanation_vi') || null;
        const expEn = getVal('explanation_en') || null;
        const refVi = getVal('reference_answer_vi') || null;
        const refEn = getVal('reference_answer_en') || null;
        const learnVi = getVal('learning_objective_vi') || null;
        const learnEn = getVal('learning_objective_en') || null;
        const estTime = getVal('estimated_time_seconds') ? parseInt(getVal('estimated_time_seconds'), 10) : null;
        const qType = (getVal('type') || 'TECHNICAL') as QuestionType;
        const diff = (getVal('difficulty') || 'MEDIUM') as Difficulty;
        const primaryRoleId = getVal('primary_role_id');
        const levelIds = getVal('level_ids') ? getVal('level_ids').split(';').map((s) => s.trim()).filter(Boolean) : [];
        const techIds = getVal('technology_ids') ? getVal('technology_ids').split(';').map((s) => s.trim()).filter(Boolean) : [];
        const techAgnostic = getVal('technology_agnostic') === 'true';
        const topic = getVal('topic') || null;
        const tags = getVal('tags') ? getVal('tags').split(';').map((s) => s.trim()).filter(Boolean) : [];
        const changeSummary = getVal('change_summary') || 'Imported via CSV';

        rows.push({
          prompt: { vi: promptVi, en: promptEn },
          explanation: { vi: expVi, en: expEn },
          referenceAnswer: { vi: refVi, en: refEn },
          learningObjective: { vi: learnVi, en: learnEn },
          estimatedTimeSeconds: estTime,
          type: qType,
          difficulty: diff,
          primaryRoleId,
          levelIds,
          technologyIds: techIds,
          technologyAgnostic: techAgnostic,
          topic,
          tags,
          changeSummary,
        });
      }
    } else if (input.format === 'JSON' && input.content) {
      try {
        const parsed = JSON.parse(input.content);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        throw new QuestionBankDomainError('VALIDATION_ERROR', 'Nội dung JSON không hợp lệ');
      }
    }

    if (rows.length === 0) {
      throw new QuestionBankDomainError('VALIDATION_ERROR', 'Không có bản ghi nào để import');
    }

    const errors: ImportRowError[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      if (!row.prompt || (!row.prompt.vi && !row.prompt.en)) {
        errors.push({ row: rowNum, field: 'prompt', message: 'Cần ít nhất một prompt VI hoặc EN' });
      }
      if (!row.referenceAnswer || (!row.referenceAnswer.vi && !row.referenceAnswer.en)) {
        errors.push({ row: rowNum, field: 'referenceAnswer', message: 'Cần reference answer cho câu hỏi' });
      }
      if (!row.primaryRoleId) {
        errors.push({ row: rowNum, field: 'primaryRoleId', message: 'Primary role là bắt buộc' });
      }
      if (!row.levelIds || row.levelIds.length === 0) {
        errors.push({ row: rowNum, field: 'levelIds', message: 'Cần ít nhất 1 level' });
      }
      if (!row.type) {
        errors.push({ row: rowNum, field: 'type', message: 'Loại câu hỏi là bắt buộc' });
      }
      if (!row.difficulty) {
        errors.push({ row: rowNum, field: 'difficulty', message: 'Độ khó là bắt buộc' });
      }
    }

    const allRoleIds = uniqueIds(rows.map((r) => r.primaryRoleId).filter(Boolean));
    const allLevelIds = uniqueIds(rows.flatMap((r) => r.levelIds ?? []));
    const allTechIds = uniqueIds(rows.flatMap((r) => r.technologyIds ?? []));

    const invalidTaxonomy = await this.taxonomy.findInvalidReferences({
      roleIds: allRoleIds,
      levelIds: allLevelIds,
      technologyIds: allTechIds,
    });

    if (
      invalidTaxonomy.missing.roleIds.length > 0 ||
      invalidTaxonomy.missing.levelIds.length > 0 ||
      invalidTaxonomy.missing.technologyIds.length > 0
    ) {
      rows.forEach((r, idx) => {
        const rowNum = idx + 1;
        if (invalidTaxonomy.missing.roleIds.includes(r.primaryRoleId)) {
          errors.push({ row: rowNum, field: 'primaryRoleId', message: `Role ${r.primaryRoleId} không tồn tại` });
        }
        r.levelIds?.forEach((lid) => {
          if (invalidTaxonomy.missing.levelIds.includes(lid)) {
            errors.push({ row: rowNum, field: 'levelIds', message: `Level ${lid} không tồn tại` });
          }
        });
        r.technologyIds?.forEach((tid) => {
          if (invalidTaxonomy.missing.technologyIds.includes(tid)) {
            errors.push({ row: rowNum, field: 'technologyIds', message: `Technology ${tid} không tồn tại` });
          }
        });
      });
    }

    if (input.dryRun) {
      return {
        data: {
          dryRun: true,
          totalRecords: rows.length,
          validCount: rows.length - errors.length,
          invalidCount: errors.length,
          errors,
        },
        etag: 'W/"import-dry-run"',
      };
    }

    if (errors.length > 0) {
      throw new QuestionBankDomainError(
        'QUESTION_IMPORT_VALIDATION_FAILED',
        'Dữ liệu import có lỗi xác thực, vui lòng kiểm tra lại từng dòng',
        errors.map((e) => ({
          field: `row[${e.row}].${e.field ?? 'general'}`,
          message: e.message,
        }))
      );
    }

    const claim = this.claimValues(context, { input: { count: rows.length, format: input.format } });
    const replay = await this.idempotency.findClaim(claim);
    if (replay && replay.status === 'COMPLETED' && replay.result) {
      return {
        data: {
          dryRun: false,
          totalRecords: rows.length,
          validCount: rows.length,
          invalidCount: 0,
          errors: [],
          createdQuestions: [],
        },
        etag: 'W/"import-replayed"',
        replayed: true,
      };
    }

    const created = await this.questions.withTransaction(async (session) => {
      await this.idempotency.createClaim(
        { ...claim, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS) },
        session
      );
      const createdItems = await this.questions.bulkCreateImportedDrafts(rows, context.actorId, session);

      for (const item of createdItems) {
        await this.outbox.enqueue(
          {
            aggregateId: item.id,
            eventType: 'QUESTION_CREATED',
            payload: {
              questionId: item.id,
              code: item.code,
              versionNumber: 1,
              revision: 0,
            },
          },
          session
        );
      }

      await this.idempotency.completeClaim(
        {
          ...claim,
          result: {
            resourceType: 'QUESTION',
            questionId: createdItems[0]?.id ?? 'bulk',
            versionNumber: 1,
            httpStatus: 201,
          },
        },
        session
      );

      return createdItems;
    });

    return {
      data: {
        dryRun: false,
        totalRecords: rows.length,
        validCount: rows.length,
        invalidCount: 0,
        errors: [],
        createdQuestions: created,
      },
      etag: 'W/"import-completed"',
    };
  }

  async exportQuestions(input: ExportQuestionsInput): Promise<QuestionExportResult> {
    const { items, total } = await this.questions.findQuestionsForExport(input);

    if (input.format === 'CSV') {
      const headers = [
        'code',
        'lifecycle_status',
        'version_number',
        'status',
        'prompt_vi',
        'prompt_en',
        'explanation_vi',
        'explanation_en',
        'reference_answer_vi',
        'reference_answer_en',
        'learning_objective_vi',
        'learning_objective_en',
        'type',
        'difficulty',
        'origin',
        'primary_role_id',
        'level_ids',
        'technology_ids',
        'technology_agnostic',
        'topic',
        'tags',
        'rubric_summary',
        'created_at',
        'updated_at',
      ];

      const csvLines: string[] = [headers.join(',')];
      for (const item of items) {
        const row = [
          item.code,
          item.lifecycleStatus,
          item.versionNumber,
          item.status,
          item.prompt.vi ?? '',
          item.prompt.en ?? '',
          item.explanation.vi ?? '',
          item.explanation.en ?? '',
          item.referenceAnswer.vi ?? '',
          item.referenceAnswer.en ?? '',
          item.learningObjective.vi ?? '',
          item.learningObjective.en ?? '',
          item.type ?? '',
          item.difficulty ?? '',
          item.origin,
          item.taxonomy.primaryRoleId ?? '',
          item.taxonomy.levelIds.join(';'),
          item.taxonomy.technologyIds.join(';'),
          item.taxonomy.technologyAgnostic ? 'true' : 'false',
          item.taxonomy.topic ?? '',
          item.taxonomy.tags.join(';'),
          item.rubricSummary ?? '',
          item.createdAt,
          item.updatedAt,
        ];
        csvLines.push(formatCsvRow(row));
      }
      return {
        format: 'CSV',
        count: items.length,
        total,
        csvContent: csvLines.join('\r\n'),
      };
    }

    return {
      format: 'JSON',
      count: items.length,
      total,
      data: items,
    };
  }

  async generateAiDraft(
    input: GenerateAiDraftInput,
    context: QuestionBankCommandContext
  ): Promise<QuestionBankMutationResult<QuestionAiDraftResult>> {
    await this.assertTaxonomyValid({
      roleIds: [input.roleId],
      levelIds: [input.levelId],
      technologyIds: input.technologyId ? [input.technologyId] : [],
    });

    const claim = this.claimValues(context, { input });
    const replay = await this.idempotency.findClaim(claim);
    if (replay && replay.status === 'COMPLETED' && replay.result) {
      const persistedQuestion = replay.result.questionId
        ? { id: replay.result.questionId, code: 'REPLAYED', versionNumber: replay.result.versionNumber ?? 1 }
        : undefined;
      return {
        data: {
          draft: (await this.aiProvider.generateDraft(input)),
          persistedQuestion,
        },
        etag: 'W/"ai-draft-replayed"',
        replayed: true,
      };
    }

    const draft = await this.aiProvider.generateDraft(input);

    if (input.persistDraft) {
      const year = new Date().getFullYear();
      const created = await this.questions.withTransaction(async (session) => {
        await this.idempotency.createClaim(
          { ...claim, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS) },
          session
        );
        const { code } = await this.counters.allocateCode(year, session);
        const { question, version } = await this.questions.createQuestionAggregate(
          {
            code,
            ownerId: context.actorId,
            actorId: context.actorId,
            draft: {
              prompt: draft.prompt,
              explanation: draft.explanation,
              followUps: draft.followUps,
              referenceAnswer: draft.referenceAnswer,
              learningObjective: draft.learningObjective,
              estimatedTimeSeconds: draft.estimatedTimeSeconds,
              rubric: draft.rubric,
              questionType: input.type,
              difficulty: input.difficulty,
              primaryRoleId: input.roleId,
              additionalRoleIds: [],
              levelIds: [input.levelId],
              technologies: input.technologyId ? [{ technologyId: input.technologyId, relevance: 100 }] : [],
              technologyAgnostic: !input.technologyId,
              classificationComplete: true,
              topic: draft.topic,
              tags: draft.tags,
              changeSummary: 'Khởi tạo từ AI draft assistant',
              origin: 'AI_ASSISTED',
              sourceVersionId: null,
              sourceReference: null,
              contentHash: createContentHash(draft),
              normalizedPromptFingerprint: normalizePromptFingerprint(draft.prompt),
            },
          },
          session
        );

        await this.outbox.enqueue(
          {
            aggregateId: question.id,
            eventType: 'QUESTION_CREATED',
            payload: {
              questionId: question.id,
              code: question.code,
              versionNumber: 1,
              revision: 0,
            },
          },
          session
        );

        await this.idempotency.completeClaim(
          {
            ...claim,
            result: {
              resourceType: 'QUESTION',
              questionId: question.id,
              versionNumber: version.versionNumber,
              httpStatus: 201,
            },
          },
          session
        );

        return { id: question.id, code: question.code, versionNumber: version.versionNumber };
      });

      return {
        data: { draft, persistedQuestion: created },
        etag: createQuestionEtag(created.id, 0),
      };
    }

    return {
      data: { draft },
      etag: 'W/"ai-draft-preview"',
    };
  }

  async previewTranslation(
    questionId: string,
    versionNumber: number,
    input: TranslationPreviewInput,
    requestId: string
  ): Promise<QuestionTranslationPreviewResult> {
    await this.requireQuestionDetail(questionId);
    const version = await this.requireVersion(questionId, versionNumber);

    const allowedFields: TranslationField[] = [
      'prompt',
      'explanation',
      'referenceAnswer',
      'learningObjective',
      'followUps',
      'rubric',
    ];

    const selectedFields = input.fields && input.fields.length > 0
      ? input.fields
      : allowedFields;

    const sourcePrompt = version.prompt?.[input.sourceLocale];
    const sourceExplanation = version.explanation?.[input.sourceLocale];
    const sourceReferenceAnswer = version.referenceAnswer?.[input.sourceLocale];
    const sourceLearningObjective = version.learningObjective?.[input.sourceLocale];
    const sourceFollowUps = version.followUps
      ? version.followUps
          .map((f) => f[input.sourceLocale])
          .filter((s): s is string => Boolean(s && s.trim()))
      : [];
    const sourceRubric = version.rubric
      ? version.rubric.map((r) => ({
          key: r.key,
          title: r.title[input.sourceLocale] || '',
          description: r.description[input.sourceLocale] || '',
          levels: r.levels.map((l) => ({
            score: l.score,
            description: l.description[input.sourceLocale] || '',
          })),
        }))
      : [];

    const hasAnySource =
      (selectedFields.includes('prompt') && Boolean(sourcePrompt?.trim())) ||
      (selectedFields.includes('explanation') && Boolean(sourceExplanation?.trim())) ||
      (selectedFields.includes('referenceAnswer') && Boolean(sourceReferenceAnswer?.trim())) ||
      (selectedFields.includes('learningObjective') && Boolean(sourceLearningObjective?.trim())) ||
      (selectedFields.includes('followUps') && sourceFollowUps.length > 0) ||
      (selectedFields.includes('rubric') && sourceRubric.length > 0);

    if (!hasAnySource) {
      throw new QuestionBankDomainError(
        'QUESTION_TRANSLATION_SOURCE_MISSING',
        'Nội dung ngôn ngữ nguồn không tồn tại để dịch'
      );
    }

    const providerPayload = {
      sourceLocale: input.sourceLocale,
      targetLocale: input.targetLocale,
      fields: {
        prompt: selectedFields.includes('prompt') ? sourcePrompt : null,
        explanation: selectedFields.includes('explanation') ? sourceExplanation : null,
        referenceAnswer: selectedFields.includes('referenceAnswer') ? sourceReferenceAnswer : null,
        learningObjective: selectedFields.includes('learningObjective') ? sourceLearningObjective : null,
        followUps: selectedFields.includes('followUps') && sourceFollowUps.length > 0 ? sourceFollowUps : null,
        rubric: selectedFields.includes('rubric') && sourceRubric.length > 0 ? sourceRubric : null,
      },
    };

    const translationResult = await this.translationProvider.translate(providerPayload);

    const fieldStatuses: TranslationFieldStatus[] = allowedFields.map((field) => {
      let sourcePresent = false;
      let wouldOverwrite = false;

      switch (field) {
        case 'prompt':
          sourcePresent = Boolean(sourcePrompt?.trim());
          wouldOverwrite = Boolean(version.prompt?.[input.targetLocale]?.trim());
          break;
        case 'explanation':
          sourcePresent = Boolean(sourceExplanation?.trim());
          wouldOverwrite = Boolean(version.explanation?.[input.targetLocale]?.trim());
          break;
        case 'referenceAnswer':
          sourcePresent = Boolean(sourceReferenceAnswer?.trim());
          wouldOverwrite = Boolean(version.referenceAnswer?.[input.targetLocale]?.trim());
          break;
        case 'learningObjective':
          sourcePresent = Boolean(sourceLearningObjective?.trim());
          wouldOverwrite = Boolean(version.learningObjective?.[input.targetLocale]?.trim());
          break;
        case 'followUps':
          sourcePresent = sourceFollowUps.length > 0;
          wouldOverwrite = Boolean(version.followUps?.some((f) => f[input.targetLocale]?.trim()));
          break;
        case 'rubric':
          sourcePresent = sourceRubric.length > 0;
          wouldOverwrite = Boolean(
            version.rubric?.some(
              (r) =>
                Boolean(r.title[input.targetLocale]?.trim()) ||
                Boolean(r.description[input.targetLocale]?.trim())
            )
          );
          break;
      }

      return {
        field,
        sourcePresent,
        wouldOverwrite,
      };
    });

    return {
      sourceLocale: input.sourceLocale,
      targetLocale: input.targetLocale,
      proposed: translationResult.translated,
      fields: fieldStatuses,
      warnings: translationResult.warnings || [],
      provider: translationResult.provider,
      model: translationResult.model,
      requestId,
    };
  }

  async applyTranslation(
    questionId: string,
    versionNumber: number,
    input: TranslationApplyInput,
    precondition: QuestionBankPrecondition,
    context: QuestionBankCommandContext
  ): Promise<QuestionBankMutationResult<ReturnType<typeof toQuestionVersionAdminDetailDto>>> {
    const claim = this.claimValues(context, { questionId, versionNumber, input, precondition });
    const replay = await this.replayVersion(claim);
    if (replay) return replay;

    const version = await this.requireVersion(questionId, versionNumber);
    this.assertPreconditionResource(precondition, version.id);

    if (version.status !== 'DRAFT') {
      throw new QuestionBankDomainError(
        'QUESTION_VERSION_IMMUTABLE',
        'Phiên bản ' + version.status + ' không thể chỉnh sửa'
      );
    }

    if (version.revision !== precondition.revision) {
      this.conflict(version.revision);
    }

    if (!input.confirmOverwrite) {
      let hasOverwrite = false;
      if (input.fields.includes('prompt') && version.prompt?.[input.targetLocale]?.trim()) {
        hasOverwrite = true;
      }
      if (input.fields.includes('explanation') && version.explanation?.[input.targetLocale]?.trim()) {
        hasOverwrite = true;
      }
      if (
        input.fields.includes('referenceAnswer') &&
        version.referenceAnswer?.[input.targetLocale]?.trim()
      ) {
        hasOverwrite = true;
      }
      if (
        input.fields.includes('learningObjective') &&
        version.learningObjective?.[input.targetLocale]?.trim()
      ) {
        hasOverwrite = true;
      }
      if (
        input.fields.includes('followUps') &&
        version.followUps?.some((f) => f[input.targetLocale]?.trim())
      ) {
        hasOverwrite = true;
      }
      if (
        input.fields.includes('rubric') &&
        version.rubric?.some(
          (r) =>
            Boolean(r.title[input.targetLocale]?.trim()) ||
            Boolean(r.description[input.targetLocale]?.trim())
        )
      ) {
        hasOverwrite = true;
      }

      if (hasOverwrite) {
        throw new QuestionBankDomainError(
          'QUESTION_TRANSLATION_OVERWRITE_CONFIRMATION_REQUIRED',
          'Yêu cầu xác nhận ghi đè nội dung bản dịch hiện hữu'
        );
      }
    }

    const draft = draftFromVersion(version);

    if (input.fields.includes('prompt') && input.translations.prompt !== undefined) {
      draft.prompt[input.targetLocale] = input.translations.prompt;
    }
    if (input.fields.includes('explanation') && input.translations.explanation !== undefined) {
      draft.explanation[input.targetLocale] = input.translations.explanation;
    }
    if (
      input.fields.includes('referenceAnswer') &&
      input.translations.referenceAnswer !== undefined
    ) {
      draft.referenceAnswer[input.targetLocale] = input.translations.referenceAnswer;
    }
    if (
      input.fields.includes('learningObjective') &&
      input.translations.learningObjective !== undefined
    ) {
      draft.learningObjective[input.targetLocale] = input.translations.learningObjective;
    }
    if (input.fields.includes('followUps') && input.translations.followUps !== undefined) {
      if (Array.isArray(input.translations.followUps)) {
        draft.followUps = input.translations.followUps.map((text, idx) => ({
          vi: input.targetLocale === 'vi' ? text : draft.followUps[idx]?.vi || null,
          en: input.targetLocale === 'en' ? text : draft.followUps[idx]?.en || null,
        }));
      }
    }
    if (input.fields.includes('rubric') && input.translations.rubric !== undefined) {
      if (Array.isArray(input.translations.rubric)) {
        draft.rubric = input.translations.rubric.map((item, idx) => {
          const currentCriterion = draft.rubric[idx];
          return {
            key: item.key || currentCriterion?.key || `criterion-${idx + 1}`,
            title: {
              vi: input.targetLocale === 'vi' ? item.title : currentCriterion?.title.vi || null,
              en: input.targetLocale === 'en' ? item.title : currentCriterion?.title.en || null,
            },
            description: {
              vi: input.targetLocale === 'vi' ? item.description : currentCriterion?.description.vi || null,
              en: input.targetLocale === 'en' ? item.description : currentCriterion?.description.en || null,
            },
            weight: currentCriterion?.weight || 100,
            levels: item.levels.map((lvl, lIdx) => {
              const currentLvl = currentCriterion?.levels[lIdx];
              return {
                score: lvl.score as 0 | 1 | 2 | 3 | 4,
                description: {
                  vi: input.targetLocale === 'vi' ? lvl.description : currentLvl?.description.vi || null,
                  en: input.targetLocale === 'en' ? lvl.description : currentLvl?.description.en || null,
                },
              };
            }),
          };
        });
      }
    }

    assertRubricValid(draft.rubric);

    return await this.questions.withTransaction(async (session) => {
      await this.idempotency.createClaim(
        { ...claim, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS) },
        session
      );

      const updated = await this.questions.updateDraftVersion(
        {
          questionId,
          versionNumber,
          actorId: context.actorId,
          expectedRevision: precondition.revision,
          changes: draft,
          contentHash: createContentHash(draft),
          normalizedPromptFingerprint: normalizePromptFingerprint(draft.prompt),
        },
        session
      );

      if (updated.kind === 'not-found') this.notFound('QUESTION_VERSION_NOT_FOUND');
      if (updated.kind === 'immutable') {
        throw new QuestionBankDomainError(
          'QUESTION_VERSION_IMMUTABLE',
          'Phiên bản ' + updated.status + ' không thể chỉnh sửa'
        );
      }
      if (updated.kind === 'conflict') this.conflict(updated.currentRevision);

      await this.outbox.enqueue(
        {
          aggregateId: questionId,
          eventType: 'QUESTION_VERSION_TRANSLATED',
          payload: {
            questionId,
            versionNumber: updated.version.versionNumber,
            targetLocale: input.targetLocale,
            fields: input.fields,
          },
        },
        session
      );

      await this.idempotency.completeClaim(
        {
          ...claim,
          result: {
            resourceType: 'QUESTION_VERSION',
            questionId,
            versionNumber: updated.version.versionNumber,
            httpStatus: 200,
          },
        },
        session
      );

      return {
        data: toQuestionVersionAdminDetailDto(updated.version),
        etag: createQuestionVersionEtag(updated.version.id, updated.version.revision),
      };
    });
  }

  async backfillEmbeddings(
    input: EmbeddingBackfillInput,
    context: QuestionBankCommandContext
  ): Promise<QuestionEmbeddingBackfillResult> {
    const batchSize = Math.min(input.batchSize || 20, 50);
    const providerName = getEnv().QUESTION_BANK_AI_PROVIDER;
    const modelName = getEnv().QUESTION_BANK_EMBEDDING_MODEL;

    const query: any = {
      lifecycleStatus: 'ACTIVE',
      currentPublishedVersionId: { $ne: null },
    };

    if (input.cursor) {
      query._id = { $gt: new Types.ObjectId(input.cursor) };
    }

    const questions = await Question.find(query)
      .sort({ _id: 1 })
      .limit(batchSize + 1)
      .exec();

    const hasMore = questions.length > batchSize;
    const batchQuestions = hasMore ? questions.slice(0, batchSize) : questions;
    const nextCursor = batchQuestions.length > 0 ? batchQuestions[batchQuestions.length - 1].id : null;

    let processedCount = 0;
    let readyCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const q of batchQuestions) {
      processedCount++;
      try {
        const version = await QuestionVersion.findById(q.currentPublishedVersionId).exec();
        if (!version) {
          failedCount++;
          continue;
        }

        const existing = await this.embeddings.findByVersionAndModel(
          version.id,
          providerName,
          modelName,
          version.contentHash
        );

        if (existing && existing.status === 'READY' && !input.forceRecompute) {
          skippedCount++;
          continue;
        }

        const text = buildDiscoverabilityText({
          prompt: version.prompt,
          topic: version.topic,
          tags: version.tags,
          questionType: version.questionType,
          difficulty: version.difficulty,
        });

        const embeddingOutput = await this.embeddingProvider.generateEmbedding({ text });
        const vector = validateVector(embeddingOutput.vector, embeddingOutput.dimensions);

        await this.embeddings.upsertEmbedding({
          questionId: q.id,
          questionVersionId: version.id,
          contentHash: version.contentHash,
          provider: providerName,
          model: modelName,
          dimensions: embeddingOutput.dimensions,
          vector,
          status: 'READY',
        });

        await this.embeddings.markStaleByVersion(version.id, version.contentHash);
        readyCount++;
      } catch (err: any) {
        failedCount++;
      }
    }

    return {
      processedCount,
      readyCount,
      failedCount,
      skippedCount,
      nextCursor,
      hasMore,
      model: modelName,
      provider: providerName,
      requestId: context.requestId || 'req_backfill',
    };
  }

  async detectSemanticDuplicates(
    input: SemanticDuplicateInput,
    requestId: string
  ): Promise<QuestionDuplicateDetectionResult> {
    const providerName = getEnv().QUESTION_BANK_AI_PROVIDER;
    const modelName = getEnv().QUESTION_BANK_EMBEDDING_MODEL;
    const threshold = input.threshold ?? 0.75;
    const topK = Math.min(input.topK ?? 10, 20);

    let queryPrompt: LocalizedText;
    let queryTopic: string | null = null;
    let queryTags: string[] = [];
    let queryType: string | null = null;
    let queryDifficulty: string | null = null;
    let queryQuestionId: string | null = null;
    let queryFingerprint: string | null = null;

    if (input.target === 'EXISTING') {
      await this.requireQuestionDetail(input.questionId!);
      const version = await this.requireVersion(input.questionId!, input.versionNumber!);
      queryPrompt = version.prompt;
      queryTopic = version.topic;
      queryTags = version.tags;
      queryType = version.questionType;
      queryDifficulty = version.difficulty;
      queryQuestionId = input.questionId!;
      queryFingerprint =
        version.normalizedPromptFingerprint || normalizePromptFingerprint(version.prompt);
    } else {
      queryPrompt = {
        vi: input.draft?.prompt?.vi ?? null,
        en: input.draft?.prompt?.en ?? null,
      };
      queryTopic = input.draft?.topic ?? null;
      queryTags = input.draft?.tags ?? [];
      queryType = input.draft?.type ?? null;
      queryDifficulty = input.draft?.difficulty ?? null;
      queryQuestionId = null;
      queryFingerprint = normalizePromptFingerprint(queryPrompt);
    }

    const matchesMap = new Map<string, QuestionDuplicateMatch>();

    // 1. EXACT Duplicate Check
    if (queryFingerprint) {
      const exactCandidateVersions = await QuestionVersion.find({
        status: 'PUBLISHED',
        normalizedPromptFingerprint: queryFingerprint,
      }).exec();

      for (const ver of exactCandidateVersions) {
        const qId = ver.questionId.toString();
        if (queryQuestionId && qId === queryQuestionId) {
          continue;
        }

        const q = await Question.findOne({
          _id: ver.questionId,
          lifecycleStatus: 'ACTIVE',
          currentPublishedVersionId: ver._id,
        }).exec();

        if (q) {
          matchesMap.set(qId, {
            questionId: qId,
            code: q.code,
            versionNumber: ver.versionNumber,
            promptPreview: {
              vi: ver.prompt.vi ? ver.prompt.vi.slice(0, 200) : null,
              en: ver.prompt.en ? ver.prompt.en.slice(0, 200) : null,
            },
            similarityScore: 1.0,
            matchType: 'EXACT',
            taxonomyOverlap: {
              roles: ver.primaryRoleId ? [ver.primaryRoleId.toString()] : [],
              levels: ver.levelIds.map((l: any) => l.toString()),
              technologies: ver.technologies.map((t: any) => t.technologyId.toString()),
              difficultyMatch: Boolean(queryDifficulty && ver.difficulty === queryDifficulty),
              typeMatch: Boolean(queryType && ver.questionType === queryType),
            },
            topic: ver.topic,
          });
        }
      }
    }

    // 2. SEMANTIC Duplicate Check
    const queryDiscoverability = buildDiscoverabilityText({
      prompt: queryPrompt,
      topic: queryTopic,
      tags: queryTags,
      questionType: queryType,
      difficulty: queryDifficulty,
    });

    try {
      const queryEmbeddingOutput = await this.embeddingProvider.generateEmbedding({
        text: queryDiscoverability,
      });
      const queryVector = validateVector(
        queryEmbeddingOutput.vector,
        queryEmbeddingOutput.dimensions
      );

      const candidateQuery: any = {
        lifecycleStatus: 'ACTIVE',
        currentPublishedVersionId: { $ne: null },
      };
      if (queryQuestionId) {
        candidateQuery._id = { $ne: new Types.ObjectId(queryQuestionId) };
      }
      if (input.filters?.roleId) {
        candidateQuery.primaryRoleId = new Types.ObjectId(input.filters.roleId);
      }

      const candidateQuestions = await Question.find(candidateQuery).limit(100).exec();
      const versionIds = candidateQuestions.map((q) => q.currentPublishedVersionId!.toString());

      const readyEmbeddings = await this.embeddings.findReadyEmbeddingsForVersions(
        versionIds,
        providerName,
        modelName
      );

      const embeddingByVersionId = new Map<string, number[]>();
      for (const emb of readyEmbeddings) {
        embeddingByVersionId.set(emb.questionVersionId.toString(), emb.vector);
      }

      for (const q of candidateQuestions) {
        const qId = q.id;
        if (matchesMap.has(qId)) continue;

        const vId = q.currentPublishedVersionId!.toString();
        const candidateVector = embeddingByVersionId.get(vId);
        if (!candidateVector) continue;

        const score = cosineSimilarity(queryVector, candidateVector);
        if (score >= threshold) {
          const ver = await QuestionVersion.findById(q.currentPublishedVersionId).exec();
          if (ver) {
            matchesMap.set(qId, {
              questionId: qId,
              code: q.code,
              versionNumber: ver.versionNumber,
              promptPreview: {
                vi: ver.prompt.vi ? ver.prompt.vi.slice(0, 200) : null,
                en: ver.prompt.en ? ver.prompt.en.slice(0, 200) : null,
              },
              similarityScore: Number(score.toFixed(4)),
              matchType: 'SEMANTIC',
              taxonomyOverlap: {
                roles: ver.primaryRoleId ? [ver.primaryRoleId.toString()] : [],
                levels: ver.levelIds.map((l: any) => l.toString()),
                technologies: ver.technologies.map((t: any) => t.technologyId.toString()),
                difficultyMatch: Boolean(queryDifficulty && ver.difficulty === queryDifficulty),
                typeMatch: Boolean(queryType && ver.questionType === queryType),
              },
              topic: ver.topic,
            });
          }
        }
      }
    } catch (err) {
      if (err instanceof QuestionBankDomainError) {
        throw err;
      }
      throw new QuestionBankDomainError(
        'QUESTION_SEMANTIC_SEARCH_UNAVAILABLE',
        'Dịch vụ tìm kiếm ngữ nghĩa tạm thời không khả dụng'
      );
    }

    const rankedMatches = rankDuplicateMatches(Array.from(matchesMap.values()), topK);

    return {
      matches: rankedMatches,
      totalMatches: matchesMap.size,
      model: modelName,
      threshold,
      requestId,
    };
  }
}

