import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEnv } from '../../src/config/env';

describe('AIU Environment Variables (Micro-Task 1.0)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should provide default values for AIU environment variables', () => {
    const env = getEnv();
    expect(env.AIU_FOLLOW_UP_ENABLED).toBe(true);
    expect(env.AIU_MAX_FOLLOW_UPS_PER_QUESTION).toBe(3);
    expect(env.AIU_FOLLOW_UP_TIMEOUT_MS).toBe(15000);
  });

  it('should allow overriding AIU environment variables', () => {
    process.env.AIU_FOLLOW_UP_ENABLED = 'false';
    process.env.AIU_MAX_FOLLOW_UPS_PER_QUESTION = '5';
    process.env.AIU_FOLLOW_UP_TIMEOUT_MS = '20000';

    const env = getEnv();
    expect(env.AIU_FOLLOW_UP_ENABLED).toBe(false);
    expect(env.AIU_MAX_FOLLOW_UPS_PER_QUESTION).toBe(5);
    expect(env.AIU_FOLLOW_UP_TIMEOUT_MS).toBe(20000);
  });
});
