import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { parseWeakEtag, QuestionBankEtagKind } from '../domain/question-bank/etag';
import { QuestionBankDomainError } from '../domain/question-bank/errors';
import { IQuestionBankService } from '../services/interfaces/IQuestionBankService';
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
  TranslationPreviewInput,
  TranslationApplyInput,
  EmbeddingBackfillInput,
  SemanticDuplicateInput,
} from '../validators/question-bank.validator';

const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7E]{16,128}$/;

const requestId = (res: Response): string =>
  typeof res.locals.requestId === 'string' ? res.locals.requestId : 'req_unknown';

const actorId = (req: Request): string => {
  const id = req.user?._id?.toString();
  if (!id) {
    throw new QuestionBankDomainError('AUTH_UNAUTHORIZED', 'Yêu cầu xác thực');
  }
  return id;
};

const idempotencyKey = (req: Request): string => {
  const value = req.header('idempotency-key')?.trim();
  if (!value || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new QuestionBankDomainError(
      'VALIDATION_ERROR',
      'Idempotency-Key phải dài từ 16 đến 128 ký tự in được',
      [{ field: 'Idempotency-Key', message: 'Header bắt buộc và không hợp lệ' }]
    );
  }
  return value;
};

const precondition = (req: Request, kind: QuestionBankEtagKind) => {
  const value = req.header('if-match');
  if (!value) {
    throw new QuestionBankDomainError(
      'PRECONDITION_REQUIRED',
      'If-Match là bắt buộc cho thao tác cập nhật'
    );
  }

  const parsed = parseWeakEtag(value);
  if (!parsed || parsed.kind !== kind) {
    throw new QuestionBankDomainError(
      'VALIDATION_ERROR',
      'If-Match không đúng định dạng',
      [{ field: 'If-Match', message: `Cần weak ETag loại ${kind}` }]
    );
  }
  return { resourceId: parsed.id, revision: parsed.revision };
};

const sendSuccess = <T>(
  res: Response,
  status: number,
  data: T,
  etag?: string,
  replayed?: boolean
) => {
  res.setHeader('Cache-Control', 'no-store');
  if (etag) res.setHeader('ETag', etag);
  if (replayed) res.setHeader('Idempotency-Replayed', 'true');
  return res.status(status).json({
    success: true,
    data,
    requestId: requestId(res),
  });
};

@injectable()
export class QuestionBankController {
  constructor(
    @inject('IQuestionBankService')
    private readonly service: IQuestionBankService
  ) {}

  listQuestions = async (req: Request, res: Response) =>
    sendSuccess(
      res,
      200,
      await this.service.listQuestions(req.query as unknown as ListQuestionsInput)
    );

  createQuestion = async (req: Request, res: Response) => {
    const result = await this.service.createQuestion(req.body as CreateQuestionInput, {
      actorId: actorId(req),
      idempotencyKey: idempotencyKey(req),
      route: 'POST /api/v1/admin/question-bank/questions',
      requestId: requestId(res),
    });
    return sendSuccess(res, 201, result.data, result.etag, result.replayed);
  };

  getQuestion = async (req: Request, res: Response) => {
    const result = await this.service.getQuestion(req.params.questionId as string);
    return sendSuccess(res, 200, result.data, result.etag);
  };

  updateQuestion = async (req: Request, res: Response) => {
    const result = await this.service.updateQuestion(
      req.params.questionId as string,
      req.body as UpdateQuestionInput,
      precondition(req, 'question'),
      actorId(req)
    );
    return sendSuccess(res, 200, result.data, result.etag);
  };

  listVersions = async (req: Request, res: Response) =>
    sendSuccess(
      res,
      200,
      { items: await this.service.listVersions(req.params.questionId as string) }
    );

  createVersion = async (req: Request, res: Response) => {
    const result = await this.service.createVersion(
      req.params.questionId as string,
      req.body as CreateQuestionVersionInput,
      {
        actorId: actorId(req),
        idempotencyKey: idempotencyKey(req),
        route: `POST /api/v1/admin/question-bank/questions/${req.params.questionId}/versions`,
        requestId: requestId(res),
      },
      precondition(req, 'question')
    );
    return sendSuccess(res, 201, result.data, result.etag, result.replayed);
  };

  getVersion = async (req: Request, res: Response) => {
    const result = await this.service.getVersion(
      req.params.questionId as string,
      Number(req.params.versionNumber)
    );
    return sendSuccess(res, 200, result.data, result.etag);
  };

  updateVersion = async (req: Request, res: Response) => {
    const result = await this.service.updateVersion(
      req.params.questionId as string,
      Number(req.params.versionNumber),
      req.body as UpdateQuestionVersionInput,
      precondition(req, 'question-version'),
      actorId(req)
    );
    return sendSuccess(res, 200, result.data, result.etag);
  };

  submitReview = async (req: Request, res: Response) => {
    const questionId = req.params.questionId as string;
    const result = await this.service.submitReview(
      questionId,
      req.body as SubmitReviewInput,
      {
        actorId: actorId(req),
        idempotencyKey: idempotencyKey(req),
        route: `POST /api/v1/admin/question-bank/questions/${questionId}/submit-review`,
        requestId: requestId(res),
      },
      precondition(req, 'question-version')
    );
    return sendSuccess(res, 200, result.data, result.etag, result.replayed);
  };

  listReviews = async (req: Request, res: Response) =>
    sendSuccess(
      res,
      200,
      await this.service.listReviews(req.query as unknown as ReviewQueueInput)
    );

  getReview = async (req: Request, res: Response) => {
    const result = await this.service.getReview(
      req.params.questionVersionId as string,
      actorId(req)
    );
    return sendSuccess(res, 200, result.data, result.etag);
  };

  decideReview = async (req: Request, res: Response) => {
    const versionId = req.params.questionVersionId as string;
    const result = await this.service.decideReview(
      versionId,
      req.body as ReviewDecisionInput,
      {
        actorId: actorId(req),
        idempotencyKey: idempotencyKey(req),
        route: `POST /api/v1/admin/question-bank/reviews/${versionId}/decision`,
        requestId: requestId(res),
      },
      precondition(req, 'question-version')
    );
    return sendSuccess(res, 200, result.data, result.etag, result.replayed);
  };

  publishVersion = async (req: Request, res: Response) => {
    const questionId = req.params.questionId as string;
    const versionNumber = Number(req.params.versionNumber);
    const result = await this.service.publishVersion(
      questionId,
      versionNumber,
      req.body as PublishQuestionVersionInput,
      {
        actorId: actorId(req),
        idempotencyKey: idempotencyKey(req),
        route: `POST /api/v1/admin/question-bank/questions/${questionId}/versions/${versionNumber}/publish`,
        requestId: requestId(res),
      },
      precondition(req, 'question-version')
    );
    return sendSuccess(res, 200, result.data, result.etag, result.replayed);
  };

  retireQuestion = async (req: Request, res: Response) =>
    this.sendLifecycle(req, res, 'retire');

  restoreQuestion = async (req: Request, res: Response) =>
    this.sendLifecycle(req, res, 'restore');

  private sendLifecycle = async (
    req: Request,
    res: Response,
    action: 'retire' | 'restore'
  ) => {
    const questionId = req.params.questionId as string;
    const context = {
      actorId: actorId(req),
      idempotencyKey: idempotencyKey(req),
      route: `POST /api/v1/admin/question-bank/questions/${questionId}/${action}`,
      requestId: requestId(res),
    };
    const result = action === 'retire'
      ? await this.service.retireQuestion(
          questionId,
          req.body as QuestionLifecycleInput,
          context,
          precondition(req, 'question')
        )
      : await this.service.restoreQuestion(
          questionId,
          req.body as QuestionLifecycleInput,
          context,
          precondition(req, 'question')
        );
    return sendSuccess(res, 200, result.data, result.etag, result.replayed);
  };

  selectQuestions = async (req: Request, res: Response) => {
    const result = await this.service.selectQuestions(req.body as SelectQuestionsInput);
    return sendSuccess(res, 200, result);
  };

  getCoverage = async (req: Request, res: Response) => {
    const result = await this.service.getCoverage(req.query as unknown as CoverageQueryInput);
    return sendSuccess(res, 200, result);
  };

  getAnalytics = async (req: Request, res: Response) => {
    const result = await this.service.getAnalytics(req.query as unknown as AnalyticsQueryInput);
    return sendSuccess(res, 200, result);
  };

  importQuestions = async (req: Request, res: Response) => {
    const result = await this.service.importQuestions(req.body as ImportQuestionsInput, {
      actorId: actorId(req),
      idempotencyKey: idempotencyKey(req),
      route: 'POST /api/v1/admin/question-bank/imports',
      requestId: requestId(res),
    });
    return sendSuccess(
      res,
      result.data.dryRun ? 200 : 201,
      result.data,
      result.etag,
      result.replayed
    );
  };

  exportQuestions = async (req: Request, res: Response) => {
    const result = await this.service.exportQuestions(req.body as ExportQuestionsInput);
    return sendSuccess(res, 200, result);
  };

  generateAiDraft = async (req: Request, res: Response) => {
    const result = await this.service.generateAiDraft(req.body as GenerateAiDraftInput, {
      actorId: actorId(req),
      idempotencyKey: idempotencyKey(req),
      route: 'POST /api/v1/admin/question-bank/ai-generations',
      requestId: requestId(res),
    });
    return sendSuccess(
      res,
      result.data.persistedQuestion ? 201 : 200,
      result.data,
      result.etag,
      result.replayed
    );
  };

  previewTranslation = async (req: Request, res: Response) => {
    const questionId = req.params.questionId as string;
    const versionNumber = Number(req.params.versionNumber);
    const result = await this.service.previewTranslation(
      questionId,
      versionNumber,
      req.body as TranslationPreviewInput,
      requestId(res)
    );
    return sendSuccess(res, 200, result);
  };

  applyTranslation = async (req: Request, res: Response) => {
    const questionId = req.params.questionId as string;
    const versionNumber = Number(req.params.versionNumber);
    const result = await this.service.applyTranslation(
      questionId,
      versionNumber,
      req.body as TranslationApplyInput,
      precondition(req, 'question-version'),
      {
        actorId: actorId(req),
        idempotencyKey: idempotencyKey(req),
        route: `POST /api/v1/admin/question-bank/questions/${questionId}/versions/${versionNumber}/translation-apply`,
        requestId: requestId(res),
      }
    );
    return sendSuccess(res, 200, result.data, result.etag, result.replayed);
  };

  backfillEmbeddings = async (req: Request, res: Response) => {
    const result = await this.service.backfillEmbeddings(
      req.body as EmbeddingBackfillInput,
      {
        actorId: actorId(req),
        idempotencyKey:
          req.header('idempotency-key')?.trim() ||
          `backfill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        route: 'POST /api/v1/admin/question-bank/embeddings/backfill',
        requestId: requestId(res),
      }
    );
    return sendSuccess(res, 200, result);
  };

  detectSemanticDuplicates = async (req: Request, res: Response) => {
    const result = await this.service.detectSemanticDuplicates(
      req.body as SemanticDuplicateInput,
      requestId(res)
    );
    return sendSuccess(res, 200, result);
  };
}
