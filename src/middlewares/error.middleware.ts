import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { ApiErrorDetail, ApiResponse } from '../types/response.type';
import { logger, Logger, LogEvent } from '../infrastructure/logging/logger';
import { logRoute } from './http-logger.middleware';
import { QuestionBankDomainError } from '../domain/question-bank/errors';

const defaultCodeByStatus: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT_ERROR',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
};

export const globalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    (res.locals.logger as Logger | undefined ?? logger).error('http.error.internal', {
      requestId: req.requestId,
      route: logRoute(req),
      method: req.method,
      status: res.statusCode,
    });
    res.destroy();
    return;
  }

  const error = err as Record<string, any>;
  let statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
  let message = typeof error?.message === 'string' ? error.message : 'Lỗi hệ thống ngoại lệ';
  let code: string | undefined = typeof error?.code === 'string' ? error.code : undefined;
  let errors: ApiErrorDetail[] | undefined;

  if (err instanceof QuestionBankDomainError) {
    const statuses: Record<string, number> = {
      VALIDATION_ERROR: 400,
      QUESTION_SELECTION_FAILED: 400,
      QUESTION_IMPORT_VALIDATION_FAILED: 400,
      AI_PROVIDER_ERROR: 400,
      AI_PROVIDER_RATE_LIMIT: 400,
      AI_PROVIDER_TIMEOUT: 400,
      AI_PROVIDER_SCHEMA_ERROR: 400,
      QUESTION_TRANSLATION_SOURCE_MISSING: 400,
      QUESTION_DUPLICATE_QUERY_INVALID: 400,
      AUTH_UNAUTHORIZED: 401,
      AUTH_FORBIDDEN: 403,
      QUESTION_TRANSLATION_DISABLED: 403,
      QUESTION_SEMANTIC_SEARCH_DISABLED: 403,
      QUESTION_EMBEDDING_BACKFILL_DISABLED: 403,
      QUESTION_BANK_FEATURE_DISABLED: 404,
      QUESTION_NOT_FOUND: 404,
      QUESTION_VERSION_NOT_FOUND: 404,
      QUESTION_REVIEW_NOT_FOUND: 404,
      QUESTION_TRANSLATION_OVERWRITE_CONFIRMATION_REQUIRED: 409,
      QUESTION_EMBEDDING_BACKFILL_IN_PROGRESS: 409,
      PRECONDITION_REQUIRED: 428,
      QUESTION_TRANSLATION_SCHEMA_ERROR: 500,
      QUESTION_EMBEDDING_INVALID_DIMENSIONS: 500,
      QUESTION_EMBEDDING_PROVIDER_UNAVAILABLE: 503,
      QUESTION_SEMANTIC_SEARCH_UNAVAILABLE: 503,
      INTERNAL_SERVER_ERROR: 500,
    };
    statusCode = statuses[err.code] ?? 409;
    message = err.message;
    code = err.code;
    errors = err.issues ? [...err.issues] : undefined;
  }
  // Xử lý lỗi từ Zod Validation
  else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Dữ liệu đầu vào không hợp lệ';
    code = 'VALIDATION_ERROR';
    errors = err.issues.flatMap((issue) => {
      if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)) {
        return issue.keys.map((k: string) => ({
          field: k,
          message: issue.message || `Trường '${k}' không được phép`,
        }));
      }
      const fieldPath = issue.path
        .filter((part) => part !== 'body' && part !== 'query' && part !== 'params')
        .join('.');
      return [
        {
          field: fieldPath || issue.path.join('.') || 'unknown',
          message: issue.message,
        },
      ];
    });
  }
  // JSON parser errors and explicit body limits
  else if (error?.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Nội dung JSON không hợp lệ';
    code = 'INVALID_JSON';
  } else if (error?.type === 'entity.too.large' || error?.status === 413) {
    statusCode = 413;
    message = 'Kích thước nội dung vượt quá giới hạn cho phép';
    code = 'PAYLOAD_TOO_LARGE';
  } else if (error?.type === 'charset.unsupported' || error?.type === 'encoding.unsupported') {
    statusCode = 415;
    message = 'Kiểu mã hóa nội dung không được hỗ trợ';
    code = 'UNSUPPORTED_MEDIA_TYPE';
  } else if (err instanceof multer.MulterError) {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Tệp tải lên vượt quá giới hạn 5MB'
      : 'Yêu cầu tải tệp không hợp lệ';
    code = err.code === 'LIMIT_FILE_SIZE' ? 'UPLOAD_TOO_LARGE' : 'INVALID_UPLOAD';
  }
  // Xử lý lỗi trùng lặp dữ liệu từ MongoDB (Duplicate Key Error)
  else if (error?.code === 11000) {
    statusCode = 409;
    const isEmailDuplicate = Boolean(
      error.keyPattern?.email ||
      error.keyValue?.email ||
      (typeof error.message === 'string' && (error.message.includes('email_1') || error.message.includes('email:')))
    );

    if (isEmailDuplicate) {
      message = 'Email đã được sử dụng';
      code = 'AUTH_EMAIL_ALREADY_EXISTS';
    } else {
      message = 'Dữ liệu đã tồn tại';
      code = 'CONFLICT_ERROR';
    }
    errors = undefined; // Không echo keyValue, email hoặc database internals
  }
  // Xử lý lỗi xác thực JWT
  else if (error?.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token không hợp lệ, vui lòng đăng nhập lại.';
    code = 'AUTH_INVALID_TOKEN';
  } else if (error?.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token đã hết hạn, vui lòng đăng nhập lại.';
    code = 'AUTH_TOKEN_EXPIRED';
  }
  const appEnvironment = req.app.get('env') as string;
  if (appEnvironment === 'production' && statusCode >= 500) {
    message = 'Lỗi hệ thống ngoại lệ';
    code = 'INTERNAL_SERVER_ERROR';
    errors = undefined;
  }

  code ??= defaultCodeByStatus[statusCode] ?? (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED');
  const errorEvent: LogEvent = statusCode >= 500 ? 'http.error.internal'
    : statusCode === 401 ? 'http.error.authentication'
    : statusCode === 403 ? 'http.error.authorization'
    : statusCode === 409 ? 'http.error.conflict'
    : statusCode === 400 ? 'http.error.validation' : 'http.error.request';
  (res.locals.logger as Logger | undefined ?? logger).error(errorEvent, {
    requestId: req.requestId, route: logRoute(req), method: req.method, status: statusCode,
  });

  // Trả về phản hồi lỗi tuân theo chuẩn ApiResponse
  const response: ApiResponse = {
    success: false,
    message,
    code,
    requestId: req.requestId || res.locals.requestId,
  };

  if (errors) {
    response.errors = errors;
  }

  // Ở môi trường dev, in thêm stack trace dạng string để debug nếu có
  if (appEnvironment === 'development' && typeof error?.stack === 'string' &&
      error?.code !== 'FILE_PARSE_FAILED' && !String(error?.code ?? '').startsWith('AI_')) {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
};
