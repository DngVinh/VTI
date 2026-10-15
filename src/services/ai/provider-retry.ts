import { AppError } from '../../utils/AppError';
import { logger } from '../../infrastructure/logging/logger';

export const RETRY_LIMITS = Object.freeze({ attempts: 3, totalMs: 90000, attemptMs: 30000, baseMs: 1000 });
const unavailable = () => new AppError('AI provider unavailable', 503, 'AI_PROVIDER_UNAVAILABLE');
export async function providerRetry<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const deadline = Date.now() + RETRY_LIMITS.totalMs;
  for (let attempt = 0; attempt < RETRY_LIMITS.attempts; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw unavailable();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      return await Promise.race([operation(controller.signal), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { timedOut = true; controller.abort(); reject(unavailable()); }, Math.min(remaining, RETRY_LIMITS.attemptMs));
      })]);
    } catch (error) {
      logger.warn('ai.provider_failed', { attempt });
      const status = (error as {status?: number})?.status;
      const transient = timedOut || status === 429 || [500, 502, 503, 504].includes(status ?? 0);
      if (!transient || attempt + 1 === RETRY_LIMITS.attempts) throw unavailable();
    } finally { if (timer) clearTimeout(timer); }
    const delay = RETRY_LIMITS.baseMs * 2 ** attempt * (0.5 + Math.random());
    if (Date.now() + delay >= deadline) throw unavailable();
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw unavailable();
}
