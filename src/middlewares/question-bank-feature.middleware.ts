import { NextFunction, Request, Response } from 'express';
import { getEnv } from '../config/env';
import { AppError } from '../utils/AppError';

export const requireQuestionBankAdminApi = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!getEnv().QUESTION_BANK_ADMIN_API_ENABLED) {
    return next(
      new AppError(
        'Tính năng Question Bank chưa được bật',
        404,
        'QUESTION_BANK_FEATURE_DISABLED'
      )
    );
  }

  next();
};

export const requireQuestionBankAiTranslationEnabled = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!getEnv().QUESTION_BANK_AI_TRANSLATION_ENABLED) {
    return next(
      new AppError(
        'Tính năng AI Translation chưa được bật',
        403,
        'QUESTION_TRANSLATION_DISABLED'
      )
    );
  }

  next();
};

export const requireQuestionBankSemanticDuplicatesEnabled = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!getEnv().QUESTION_BANK_SEMANTIC_DUPLICATES_ENABLED) {
    return next(
      new AppError(
        'Tính năng Semantic Duplicate Detection chưa được bật',
        403,
        'QUESTION_SEMANTIC_SEARCH_DISABLED'
      )
    );
  }

  next();
};

export const requireQuestionBankEmbeddingBackfillEnabled = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!getEnv().QUESTION_BANK_EMBEDDING_BACKFILL_ENABLED) {
    return next(
      new AppError(
        'Tính năng Embedding Backfill chưa được bật',
        403,
        'QUESTION_EMBEDDING_BACKFILL_DISABLED'
      )
    );
  }

  next();
};

