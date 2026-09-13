import { Router } from 'express';
import { container } from 'tsyringe';
import { QuestionBankController } from '../controllers/question-bank.controller';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';
import { requireQuestionBankCapability } from '../middlewares/question-bank-capability.middleware';
import {
  requireQuestionBankAdminApi,
  requireQuestionBankAiTranslationEnabled,
  requireQuestionBankEmbeddingBackfillEnabled,
  requireQuestionBankSemanticDuplicatesEnabled,
} from '../middlewares/question-bank-feature.middleware';
import { validate } from '../middlewares/validate.middleware';
import { catchAsync } from '../utils/catchAsync';
import {
  createQuestionSchema,
  createQuestionVersionSchema,
  listQuestionsSchema,
  questionDetailSchema,
  questionVersionDetailSchema,
  updateQuestionSchema,
  updateQuestionVersionSchema,
  publishQuestionVersionSchema,
  questionLifecycleSchema,
  reviewDecisionSchema,
  reviewDetailSchema,
  reviewQueueSchema,
  submitReviewSchema,
  selectQuestionsSchema,
  coverageQuerySchema,
  analyticsQuerySchema,
  importQuestionsSchema,
  exportQuestionsSchema,
  generateAiDraftSchema,
  translationPreviewSchema,
  translationApplySchema,
  embeddingBackfillSchema,
  semanticDuplicateSchema,
} from '../validators/question-bank.validator';

const router = Router();
const controller = container.resolve(QuestionBankController);

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.use(authenticate, requireAdmin, requireQuestionBankAdminApi);

router.get(
  '/questions',
  requireQuestionBankCapability('QUESTION_READ'),
  validate(listQuestionsSchema),
  catchAsync(controller.listQuestions)
);
router.post(
  '/questions',
  requireQuestionBankCapability('QUESTION_AUTHOR'),
  validate(createQuestionSchema),
  catchAsync(controller.createQuestion)
);
router.get(
  '/questions/:questionId',
  requireQuestionBankCapability('QUESTION_READ'),
  validate(questionDetailSchema),
  catchAsync(controller.getQuestion)
);
router.patch(
  '/questions/:questionId',
  requireQuestionBankCapability('QUESTION_AUTHOR'),
  validate(updateQuestionSchema),
  catchAsync(controller.updateQuestion)
);
router.get(
  '/questions/:questionId/versions',
  requireQuestionBankCapability('QUESTION_READ'),
  validate(questionDetailSchema),
  catchAsync(controller.listVersions)
);
router.post(
  '/questions/:questionId/versions',
  requireQuestionBankCapability('QUESTION_AUTHOR'),
  validate(createQuestionVersionSchema),
  catchAsync(controller.createVersion)
);
router.get(
  '/questions/:questionId/versions/:versionNumber',
  requireQuestionBankCapability('QUESTION_READ'),
  validate(questionVersionDetailSchema),
  catchAsync(controller.getVersion)
);
router.patch(
  '/questions/:questionId/versions/:versionNumber',
  requireQuestionBankCapability('QUESTION_AUTHOR'),
  validate(updateQuestionVersionSchema),
  catchAsync(controller.updateVersion)
);

router.post(
  '/questions/:questionId/submit-review',
  requireQuestionBankCapability('QUESTION_AUTHOR'),
  validate(submitReviewSchema),
  catchAsync(controller.submitReview)
);
router.get(
  '/reviews',
  requireQuestionBankCapability('QUESTION_REVIEW'),
  validate(reviewQueueSchema),
  catchAsync(controller.listReviews)
);
router.get(
  '/reviews/:questionVersionId',
  requireQuestionBankCapability('QUESTION_REVIEW'),
  validate(reviewDetailSchema),
  catchAsync(controller.getReview)
);
router.post(
  '/reviews/:questionVersionId/decision',
  requireQuestionBankCapability('QUESTION_REVIEW'),
  validate(reviewDecisionSchema),
  catchAsync(controller.decideReview)
);
router.post(
  '/questions/:questionId/versions/:versionNumber/publish',
  requireQuestionBankCapability('QUESTION_PUBLISH'),
  validate(publishQuestionVersionSchema),
  catchAsync(controller.publishVersion)
);
router.post(
  '/questions/:questionId/retire',
  requireQuestionBankCapability('QUESTION_LIFECYCLE_MANAGE'),
  validate(questionLifecycleSchema),
  catchAsync(controller.retireQuestion)
);
router.post(
  '/questions/:questionId/restore',
  requireQuestionBankCapability('QUESTION_LIFECYCLE_MANAGE'),
  validate(questionLifecycleSchema),
  catchAsync(controller.restoreQuestion)
);

router.post(
  '/selection',
  requireQuestionBankCapability('QUESTION_SELECT'),
  validate(selectQuestionsSchema),
  catchAsync(controller.selectQuestions)
);

router.get(
  '/coverage',
  requireQuestionBankCapability('QUESTION_ANALYTICS'),
  validate(coverageQuerySchema),
  catchAsync(controller.getCoverage)
);

router.get(
  '/analytics',
  requireQuestionBankCapability('QUESTION_ANALYTICS'),
  validate(analyticsQuerySchema),
  catchAsync(controller.getAnalytics)
);

router.post(
  '/imports',
  requireQuestionBankCapability('QUESTION_IMPORT_EXPORT'),
  validate(importQuestionsSchema),
  catchAsync(controller.importQuestions)
);

router.post(
  '/exports',
  requireQuestionBankCapability('QUESTION_IMPORT_EXPORT'),
  validate(exportQuestionsSchema),
  catchAsync(controller.exportQuestions)
);

router.post(
  '/ai-generations',
  requireQuestionBankCapability('QUESTION_AI_GENERATE'),
  validate(generateAiDraftSchema),
  catchAsync(controller.generateAiDraft)
);

router.post(
  '/questions/:questionId/versions/:versionNumber/translation-preview',
  requireQuestionBankAiTranslationEnabled,
  requireQuestionBankCapability('QUESTION_AI_TRANSLATE'),
  validate(translationPreviewSchema),
  catchAsync(controller.previewTranslation)
);

router.post(
  '/questions/:questionId/versions/:versionNumber/translation-apply',
  requireQuestionBankAiTranslationEnabled,
  requireQuestionBankCapability('QUESTION_AI_TRANSLATE'),
  validate(translationApplySchema),
  catchAsync(controller.applyTranslation)
);

router.post(
  '/embeddings/backfill',
  requireQuestionBankEmbeddingBackfillEnabled,
  requireQuestionBankCapability('QUESTION_EMBEDDING_MANAGE'),
  validate(embeddingBackfillSchema),
  catchAsync(controller.backfillEmbeddings)
);

router.post(
  '/semantic-duplicates',
  requireQuestionBankSemanticDuplicatesEnabled,
  requireQuestionBankCapability('QUESTION_DUPLICATE_READ'),
  validate(semanticDuplicateSchema),
  catchAsync(controller.detectSemanticDuplicates)
);

export default router;
