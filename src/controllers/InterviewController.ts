import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { InterviewWorkflowService } from '../services/InterviewWorkflowService';
import { InterviewService } from '../services/InterviewService';
import { IEventPublisher } from '../domain/events/IEventPublisher';
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';
import { toCandidateSafeInterviewSession } from '../domain/interview/safe-dto';

@injectable()
export class InterviewController {
  constructor(
    @inject(InterviewWorkflowService) private readonly workflowService: InterviewWorkflowService,
    @inject(InterviewService) private readonly interviewService: InterviewService,
    @inject('IEventPublisher') private eventPublisher?: IEventPublisher
  ) {}

  /**
   * GET /api/interviews/:id/stream
   * Stream interview state changes via SSE
   */
  streamStatus = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const actorId = req.user!._id.toString();
    // Resolve ownership before sending headers; Express 5 forwards rejected async handlers.
    const current = await this.interviewService.getInterviewSession(id, actorId);

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const writeStatus = (status: string, version: number, updatedAt?: Date) => {
      res.write(`event: session.status\nid: ${version}\ndata: ${JSON.stringify({
        sessionId: id,
        status,
        version,
        updatedAt
      })}\n\n`);
    };

    writeStatus(current.status, current.version, current.updatedAt);

    if (current.status === 'COMPLETED' || current.status === 'FAILED') {
      res.end();
      return;
    }

    const listener = (payload: any) => {
      if (payload.interviewId === id) {
        writeStatus(payload.status, payload.version, payload.updatedAt);

        if (payload.status === 'COMPLETED' || payload.status === 'FAILED') {
          res.end();
        }
      }
    };

    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20_000);

    if (this.eventPublisher) {
      this.eventPublisher.subscribe('STATE_CHANGED', listener);
    }

    req.on('close', () => {
      clearInterval(heartbeat);

      if (this.eventPublisher) {
        this.eventPublisher.unsubscribe('STATE_CHANGED', listener);
      }

      res.end();
    });
  };

  /**
   * POST /api/interviews
   */
  createSession = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { jobPosition, level, techStacks, language, secondsPerQuestion, strategy } = req.body;

    const setupData = {
      jobPosition,
      level,
      techStacks,
      language,
      secondsPerQuestion,
      strategy
    };

    const session = await this.interviewService.createInterviewSession(
      setupData,
      req.user!._id.toString()
    );

    res.status(201).json({ success: true, data: toCandidateSafeInterviewSession(session) });
  });

  /**
   * POST /api/interviews/generate-from-jd
   */
  createSessionFromJD = catchAsync(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new AppError('JD file is required', 400, 'JD_FILE_REQUIRED');
    }

    const { jobPosition, level, techStacks, language, secondsPerQuestion, strategy } = req.body;
    const setupData = { jobPosition, level, techStacks, language, secondsPerQuestion, strategy };

    try {
      const session = await this.interviewService.createInterviewSessionFromJD(
        setupData,
        req.file.buffer,
        req.file.mimetype,
        req.user!._id.toString(),
      );

      res.status(201).json({ success: true, data: toCandidateSafeInterviewSession(session) });
    } finally {
      req.file.buffer.fill(0);
      req.file = undefined;
    }
  });

  /**
   * POST /api/interviews/practice-questions
   */
  createSessionFromQuestions = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { questionIds } = req.body;
    const session = await this.interviewService.createInterviewSessionFromQuestions(
      questionIds,
      req.user!._id.toString()
    );

    res.status(201).json({
      success: true,
      data: toCandidateSafeInterviewSession(session, { includePracticeProvenance: true }),
    });
  });

  /**
   * GET /api/interviews/history
   */
  getHistory = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id?.toString();

    if (!userId) {
      throw new AppError('Yêu cầu xác thực', 401, 'AUTH_UNAUTHORIZED');
    }

    const query = req.query as any;
    const result = await this.interviewService.getInterviewHistory(userId, query);

    res.status(200).json({ success: true, data: result });
  });

  /**
   * GET /api/interviews/analytics
   */
  getAnalytics = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id?.toString();

    if (!userId) {
      throw new AppError('Yêu cầu xác thực', 401, 'AUTH_UNAUTHORIZED');
    }

    const query = req.query as any;
    const result = await this.interviewService.getInterviewAnalytics(
      userId,
      query
    );

    res.status(200).json({
      success: true,
      data: result
    });
  });

  /**
   * GET /api/interviews/:id
   */
  getSession = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const session = await this.interviewService.getInterviewSession(id, req.user!._id.toString());
    res.status(200).json({ success: true, data: toCandidateSafeInterviewSession(session) });
  });

  /**
   * POST /api/interviews/:id/generate
   */
  generateQuestions = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const userId = req.user!._id.toString();
    const idempotencyKey = req.get('Idempotency-Key');

    if (!idempotencyKey) {
      const session = await this.interviewService.generateQuestions(id, userId);

      res.status(200).json({ success: true, data: toCandidateSafeInterviewSession(session) });
      return;
    }

    const result = await this.workflowService.generateQuestions(
      id,
      userId,
      idempotencyKey
    );

    res.status(202).json({ success: true, data: result });
  });

  /**
   * POST /api/interviews/:id/submit
   */
  submitAnswers = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { expectedVersion, answers } = req.body;
    const userId = req.user!._id.toString();
    const idempotencyKey = req.get('Idempotency-Key');

    if (!idempotencyKey) {
      const session = await this.interviewService.submitAnswers(id, answers, userId);
      res.status(200).json({ success: true, data: toCandidateSafeInterviewSession(session) });
      return;
    }

    const resolvedVersion = expectedVersion !== undefined
      ? expectedVersion
      : (await this.interviewService.getInterviewSession(id, userId)).version;

    const result = await this.workflowService.submitAnswers(
      id,
      userId,
      idempotencyKey,
      resolvedVersion,
      answers
    );

    res.status(202).json({ success: true, data: result });
  });

  /**
   * POST /api/interviews/:id/progress
   */
  saveProgress = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { expectedVersion, answers } = req.body;
    const userId = req.user!._id.toString();

    if (expectedVersion === undefined) {
      const result = await this.interviewService.saveProgress(
        id,
        answers,
        userId
      );

      res.status(200).json({ success: true, data: result });
      return;
    }

    const result = await this.workflowService.saveProgress(
      id,
      userId,
      expectedVersion,
      answers
    );

    res.status(200).json({ success: true, data: result });
  });

  /**
   * POST /api/v1/interviews/:id/follow-up
   */
  requestFollowUp = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { questionId, candidateAnswer } = req.body;
    const userId = req.user!._id.toString();

    const result = await this.interviewService.processFollowUp(
      id,
      { questionId, candidateAnswer },
      userId
    );

    res.status(200).json({ success: true, data: result });
  });

  /**
   * GET /api/v1/interviews/:id/conversation
   */
  getConversationHistory = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const questionId = req.query.questionId as string | undefined;
    const userId = req.user!._id.toString();

    const result = await this.interviewService.getConversationHistory(id, userId, questionId);

    res.status(200).json({ success: true, data: result });
  });
}

