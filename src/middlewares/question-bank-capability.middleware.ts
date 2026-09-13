import { NextFunction, Request, Response } from 'express';
import {
  hasQuestionBankCapability,
  QuestionBankCapability,
} from '../domain/question-bank/capabilities';
import { AppError } from '../utils/AppError';

export const requireQuestionBankCapability = (
  capability: QuestionBankCapability
) => (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(new AppError('Yêu cầu xác thực', 401, 'AUTH_UNAUTHORIZED'));
  }

  if (!hasQuestionBankCapability(req.user.role, capability)) {
    return next(
      new AppError(
        'Bạn không có quyền thực hiện hành động này',
        403,
        'AUTH_FORBIDDEN'
      )
    );
  }

  next();
};

