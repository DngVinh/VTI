import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

const bodyMethods = new Set(['POST', 'PUT', 'PATCH']);
const multipartRoutes = new Set([
  '/api/v1/interviews/generate-from-jd',
  '/api/v1/profile/avatar',
]);

export const enforceContentType = (req: Request, _res: Response, next: NextFunction): void => {
  if (!bodyMethods.has(req.method)) {
    next();
    return;
  }

  const contentLength = Number(req.get('content-length') ?? '0');
  const hasBody = contentLength > 0 || Boolean(req.get('transfer-encoding'));
  if (!hasBody) {
    next();
    return;
  }

  const mediaType = req.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  const isJson = mediaType === 'application/json' || Boolean(mediaType?.endsWith('+json'));
  const isForm = mediaType === 'application/x-www-form-urlencoded';
  const isAllowedMultipart = mediaType === 'multipart/form-data' && multipartRoutes.has(req.path);

  if (isJson || isForm || isAllowedMultipart) {
    next();
    return;
  }

  next(
    new AppError(
      'Content-Type không được hỗ trợ cho endpoint này',
      415,
      'UNSUPPORTED_MEDIA_TYPE'
    )
  );
};
