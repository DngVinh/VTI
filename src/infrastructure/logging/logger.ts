import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { redact } from '../../utils/redaction';

export const logContext = new AsyncLocalStorage<{ requestId?: string; locale?: string }>();
export const events = [
  'http.access', 'http.aborted', 'http.error.validation', 'http.error.authentication',
  'http.error.authorization', 'http.error.conflict', 'http.error.internal', 'http.error.request',
  'server.started', 'server.stopping', 'server.closed', 'server.startup_failed',
  'database.connected', 'database.connection_failed', 'scheduler.waiting', 'scheduler.started',
  'scheduler.stopped', 'job.queued', 'job.started', 'job.completed', 'job.failed', 'job.skipped',
  'ai.generating', 'ai.generated', 'ai.evaluating', 'ai.provider_failed',
  'interview.generating', 'interview.submitting', 'interview.saving',
  'interview.retry_generation', 'interview.retry_submission', 'audit.unavailable',
] as const;
export type LogEvent = typeof events[number];
type Level = 'info' | 'warn' | 'error';
export interface LogFields {
  requestId?: string;
  locale?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  actorIdHash?: string;
  resourceType?: 'user' | 'role' | 'level' | 'technology' | 'interview';
  resourceId?: string;
  jobName?: string;
  attempt?: number;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const hashActorId = (id: string): string | undefined =>
  /^[0-9a-f]{24}$/i.test(id) ? createHash('sha256').update(id).digest('hex') : undefined;

export function createLogger(sink: (line: string) => void = line => { process.stdout.write(line); }) {
  function write(level: Level, event: LogEvent, fields: LogFields = {}) {
    // Only fixed event codes and typed scalar fields reach JSON.stringify; arbitrary objects never do.
    if (!events.includes(event)) return;
    const safe: Record<string, unknown> = { timestamp: new Date().toISOString(), level, event };
    const descriptors = Object.getOwnPropertyDescriptors(fields);
    const scalar = (key: string): unknown => descriptors[key]?.value;
    const store = logContext.getStore();
    const requestId = store?.requestId ?? scalar('requestId');
    if (typeof requestId === 'string' && uuid.test(requestId)) safe.requestId = requestId;
    const rawLocale = store?.locale ?? scalar('locale');
    if (typeof rawLocale === 'string' && /^(?:vi|en)$/i.test(rawLocale)) {
      safe.locale = rawLocale.toLowerCase();
    }
    for (const key of ['status', 'durationMs', 'attempt']) {
      const value = scalar(key);
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) safe[key] = value;
    }
    const patterns: Record<string, RegExp> = {
      route: /^(?:unmatched|\/(?:[a-zA-Z:][a-zA-Z0-9:_-]*\/?)*|\/)$/,
      method: /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/,
      actorIdHash: /^[a-f0-9]{64}$/,
      resourceId: /^[a-f0-9]{24}$/i,
      resourceType: /^(user|role|level|technology|interview)$/,
      jobName: /^(GENERATE_QUESTIONS|EVALUATE_ANSWERS)$/,
    };
    for (const [key, pattern] of Object.entries(patterns)) {
      const value = scalar(key);
      if (typeof value === 'string' && value.length <= 160 && pattern.test(value)) {
        // IDs/hashes have already been constrained and may contain long numeric runs.
        safe[key] = ['actorIdHash', 'resourceId'].includes(key) ? value : redact(value);
      }
    }
    sink(JSON.stringify(safe) + '\n');
  }
  return {
    info: (event: LogEvent, fields?: LogFields) => write('info', event, fields),
    warn: (event: LogEvent, fields?: LogFields) => write('warn', event, fields),
    error: (event: LogEvent, fields?: LogFields) => write('error', event, fields),
  };
}
export type Logger = ReturnType<typeof createLogger>;
export const logger = createLogger();
