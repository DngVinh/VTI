import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const incoming = req.header('x-request-id');
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming)
    ? incoming
    : `req_${randomUUID()}`;

  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};

