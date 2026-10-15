import { Request, Response, NextFunction } from 'express';
import { hashActorId, logContext, logger, Logger } from '../infrastructure/logging/logger';

const staticSegments = new Set([
  'api', 'v1', 'health', 'auth', 'register', 'login', 'refresh', 'logout', 'users', 'lock',
  'unlock', 'password', 'forgot', 'reset', 'profile', 'roles', 'levels', 'technologies',
  'interviews', 'generate-from-jd', 'generate', 'submit', 'progress', 'stream', 'history',
  'results', 'admin', 'metrics',
]);

// Keep only known static route words. IDs and any attacker-controlled path segment become :parameter;
// query strings and percent-decoded values never enter logs.
export const logRoute = (req: Request): string => {
  const pathname = req.originalUrl.split('?', 1)[0];
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) return '/';
  return '/' + segments.map(segment => staticSegments.has(segment) ? segment : ':parameter').join('/');
};

export const httpLogger = (output: Logger = logger) => (req: Request, res: Response, next: NextFunction): void => {
  const start = performance.now();
  let logged = false;
  res.locals.logger = output;
  const rawLocale =
    (typeof req.headers['accept-language'] === 'string'
      ? req.headers['accept-language'].slice(0, 2).toLowerCase()
      : undefined) ||
    (typeof req.query.locale === 'string'
      ? req.query.locale.slice(0, 2).toLowerCase()
      : undefined);
  const locale = rawLocale === 'vi' || rawLocale === 'en' ? rawLocale : undefined;

  const complete = (aborted: boolean) => {
    if (logged) return;
    logged = true;
    output.info(aborted ? 'http.aborted' : 'http.access', {
      requestId: req.requestId,
      locale,
      route: logRoute(req), method: req.method,
      status: aborted ? 499 : res.statusCode,
      durationMs: Math.round((performance.now() - start) * 100) / 100,
      actorIdHash: req.user ? hashActorId(req.user._id.toString()) : undefined,
    });
  };
  res.once('finish', () => complete(false));
  res.once('close', () => complete(!res.writableFinished));
  logContext.run({ requestId: req.requestId, locale }, next);
};
