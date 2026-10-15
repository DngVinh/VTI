import { Router } from 'express';
import {
  authenticate,
  authorize,
  requireOwnership
} from '../middlewares/auth.middleware';
import { InterviewController } from '../controllers/InterviewController';
import { CodeExecutionController } from '../controllers/CodeExecutionController';
import { WhiteboardController } from '../controllers/WhiteboardController';
import { container } from '../config/di';
import { uploadMiddleware } from '../middlewares/upload.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  interviewActionSchema,
  interviewAnalyticsQuerySchema,
  interviewCreateSchema,
  interviewGetSchema,
  interviewHistoryQuerySchema,
  interviewJdCreateSchema,
  interviewPracticeQuestionsSchema,
  interviewProgressSchema,
  interviewSubmitSchema,
  followUpSchema,
  conversationHistorySchema,
  codeExecutionSchema,
  whiteboardSchema,
} from '../validators/interview.validator';
import { InterviewSessionModel } from '../models/InterviewSession';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { InterviewQuotaMiddleware } from '../middlewares/interview-quota.middleware';
import { getEnv } from '../config/env';

const router = Router();

const interviewController =
  container.resolve(InterviewController);
const codeExecutionController =
  container.resolve(CodeExecutionController);
const whiteboardController =
  container.resolve(WhiteboardController);

const env = getEnv();

const rateLimitMiddleware =
  container.resolve(RateLimitMiddleware);

const requireInterviewOwner = requireOwnership(
  async (req) => {
    const session =
      await InterviewSessionModel.findById(req.params.id)
        .select('_id userId')
        .lean();

    if (!session) {
      return null;
    }

    return {
      ownerId: session.userId,
      resource: session
    };
  },
  {
    resourceName: 'Phiên phỏng vấn',
    notFoundMessage:
      'Phiên phỏng vấn không tồn tại',
    notFoundCode: 'INTERVIEW_NOT_FOUND',
    attachKey: 'interviewSession'
  }
);

const createInterviewRateLimit =
  rateLimitMiddleware.create({
    keyPrefix: 'interview:create',
    limit: env.RATE_LIMIT_CREATE_INTERVIEW_MAX,
    windowMs:
      env.RATE_LIMIT_CREATE_INTERVIEW_WINDOW_MS,
    keyGenerator: (req) =>
      req.user
        ? req.user._id.toString()
        : req.ip || 'unknown'
  });

const aiRateLimit =
  rateLimitMiddleware.create({
    keyPrefix: 'interview:ai',
    limit: env.RATE_LIMIT_AI_MAX,
    windowMs: env.RATE_LIMIT_AI_WINDOW_MS,
    keyGenerator: (req) =>
      req.user
        ? req.user._id.toString()
        : req.ip || 'unknown'
  });

const submitRateLimit =
  rateLimitMiddleware.create({
    keyPrefix: 'interview:submit',
    limit: env.RATE_LIMIT_SUBMIT_MAX,
    windowMs:
      env.RATE_LIMIT_SUBMIT_WINDOW_MS,
    keyGenerator: (req) =>
      req.user
        ? req.user._id.toString()
        : req.ip || 'unknown'
  });

const progressRateLimit =
  rateLimitMiddleware.create({
    keyPrefix: 'interview:progress',
    limit: env.RATE_LIMIT_PROGRESS_MAX,
    windowMs:
      env.RATE_LIMIT_PROGRESS_WINDOW_MS,
    keyGenerator: (req) =>
      req.user
        ? req.user._id.toString()
        : req.ip || 'unknown'
  });

const interviewQuotaMiddleware =
  container
    .resolve(InterviewQuotaMiddleware)
    .create();

const sandboxRateLimit =
  rateLimitMiddleware.create({
    keyPrefix: 'interview:sandbox',
    limit: 10,
    windowMs: 60 * 1000,
    keyGenerator: (req) =>
      req.user
        ? req.user._id.toString()
        : req.ip || 'unknown'
  });

router.post(
  '/',
  validate(interviewCreateSchema),
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  createInterviewRateLimit,
  interviewController.createSession
);

router.post(
  '/generate-from-jd',
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  uploadMiddleware.single('jdFile'),
  validate(interviewJdCreateSchema),
  createInterviewRateLimit,
  interviewController.createSessionFromJD
);

router.post(
  '/practice-questions',
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  validate(interviewPracticeQuestionsSchema),
  createInterviewRateLimit,
  interviewController.createSessionFromQuestions
);

// ANA-01: Current-user interview analytics
router.get(
  '/analytics',
  authenticate,
  validate(interviewAnalyticsQuerySchema),
  interviewController.getAnalytics
);

// HIS-01: Interview history
// Must be declared before /:id
router.get(
  '/history',
  validate(interviewHistoryQuerySchema),
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  interviewController.getHistory
);

router.get(
  '/:id',
  validate(interviewGetSchema),
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  requireInterviewOwner,
  interviewController.getSession
);

router.get(
  '/:id/stream',
  validate(interviewGetSchema),
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  requireInterviewOwner,
  interviewController.streamStatus
);

router.post(
  '/:id/generate',
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  requireInterviewOwner,
  validate(interviewActionSchema),
  aiRateLimit,
  interviewQuotaMiddleware,
  interviewController.generateQuestions
);

router.post(
  '/:id/progress',
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  requireInterviewOwner,
  validate(interviewProgressSchema),
  progressRateLimit,
  interviewController.saveProgress
);

router.post(
  '/:id/submit',
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  requireInterviewOwner,
  validate(interviewSubmitSchema),
  submitRateLimit,
  interviewController.submitAnswers
);

router.post(
  '/:id/follow-up',
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  requireInterviewOwner,
  validate(followUpSchema),
  aiRateLimit,
  interviewController.requestFollowUp
);

router.get(
  '/:id/conversation',
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  requireInterviewOwner,
  validate(conversationHistorySchema),
  interviewController.getConversationHistory
);

router.post(
  '/:id/execute-code',
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  requireInterviewOwner,
  validate(codeExecutionSchema),
  sandboxRateLimit,
  codeExecutionController.executeCode
);

router.post(
  '/:id/whiteboard',
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  requireInterviewOwner,
  validate(whiteboardSchema),
  aiRateLimit,
  whiteboardController.analyzeSnapshot
);

export default router;