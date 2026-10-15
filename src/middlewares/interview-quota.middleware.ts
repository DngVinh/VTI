import {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  inject,
  injectable,
} from 'tsyringe';

import {
  InterviewSessionModel,
} from '../models/InterviewSession';
import { logger } from '../infrastructure/logging/logger';

import {
  IInterviewQuotaService,
} from '../services/interfaces/IInterviewQuotaService';

import {
  AppError,
} from '../utils/AppError';

@injectable()
export class InterviewQuotaMiddleware {
  constructor(
    @inject('IInterviewQuotaService')
    private readonly quotaService:
      IInterviewQuotaService
  ) {}

  create() {
    return async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        if (!req.user) {
          next(
            new AppError(
              'Yêu cầu xác thực',
              401,
              'AUTH_UNAUTHORIZED'
            )
          );
          return;
        }

        const interviewId =
          req.params.id;

        if (!interviewId) {
          next(
            new AppError(
              'Interview ID không hợp lệ',
              400,
              'INTERVIEW_INVALID_ID'
            )
          );
          return;
        }

        const session =
          await InterviewSessionModel.findById(
            interviewId
          ).lean();

        if (!session) {
          next(
            new AppError(
              'Interview session không tồn tại',
              404,
              'INTERVIEW_NOT_FOUND'
            )
          );
          return;
        }

        const currentUserId =
          req.user._id.toString();

        if (
          !session.userId ||
          session.userId !== currentUserId
        ) {
          next(
            new AppError(
              'Bạn không có quyền truy cập interview này',
              403,
              'AUTH_FORBIDDEN'
            )
          );
          return;
        }

        /*
         * Generate is a single logical action for one
         * interview session. Retries must reuse the same
         * idempotency key.
         */
        const idempotencyKey =
          `interview:${interviewId}:generate`;

        const quota =
          await this.quotaService.reserve(
            currentUserId,
            idempotencyKey
          );

        /*
         * The same request/action has already been
         * reserved or committed. Do not consume again.
         */
        if (quota.alreadyExists) {
          res.setHeader(
            'X-Interview-Quota-Limit',
            quota.limit.toString()
          );

          res.setHeader(
            'X-Interview-Quota-Used',
            quota.used.toString()
          );

          res.setHeader(
            'X-Interview-Quota-Remaining',
            quota.remaining.toString()
          );

          next();
          return;
        }

        /*
         * Quota exhausted.
         */
        if (!quota.reserved) {
          next(
            new AppError(
              'Daily interview quota exceeded. Please try again tomorrow.',
              429,
              'QUOTA_EXCEEDED'
            )
          );
          return;
        }

        res.setHeader(
          'X-Interview-Quota-Limit',
          quota.limit.toString()
        );

        res.setHeader(
          'X-Interview-Quota-Used',
          quota.used.toString()
        );

        res.setHeader(
          'X-Interview-Quota-Remaining',
          quota.remaining.toString()
        );

        let responseFinished = false;
        let finalized = false;

        const commitQuota = async () => {
          if (finalized) {
            return;
          }

          finalized = true;

          try {
            await this.quotaService.commit(
              currentUserId,
              quota.quotaDate,
              idempotencyKey
            );
          } catch (error) {
            /*
             * At this point the response has already been
             * sent. Log the failure instead of throwing into
             * Express after the response lifecycle.
             */
            logger.error('http.error.internal');
          }
        };

        const releaseQuota = async () => {
          if (finalized) {
            return;
          }

          finalized = true;

          try {
            await this.quotaService.release(
              currentUserId,
              quota.quotaDate,
              idempotencyKey
            );
          } catch (error) {
            logger.error('http.error.internal');
          }
        };

        res.once(
          'finish',
          () => {
            responseFinished = true;

            /*
             * Controller returns 2xx only after enqueue()
             * completes successfully.
             */
            if (
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              void commitQuota();
            } else {
              void releaseQuota();
            }
          }
        );

        res.once(
          'close',
          () => {
            /*
             * `close` may happen after `finish`, so do not
             * release a quota that has already been finalized.
             */
            if (!responseFinished) {
              void releaseQuota();
            }
          }
        );

        next();
      } catch (error) {
        next(error);
      }
    };
  }
}