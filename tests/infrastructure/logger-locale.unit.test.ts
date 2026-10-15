import { describe, it, expect } from 'vitest';
import { createLogger, logContext } from '../../src/infrastructure/logging/logger';

describe('Logger Structured Logs with Locale (Micro-Task 4.5)', () => {
  it('includes locale field when provided in logContext', () => {
    let capturedLine = '';
    const customLogger = createLogger((line) => {
      capturedLine = line;
    });

    logContext.run({ requestId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', locale: 'vi' }, () => {
      customLogger.info('http.access', {
        route: '/api/v1/interviews',
        method: 'GET',
        status: 200,
      });
    });

    expect(capturedLine).toBeTruthy();
    const parsed = JSON.parse(capturedLine);
    expect(parsed.locale).toBe('vi');
    expect(parsed.event).toBe('http.access');
    expect(parsed.status).toBe(200);
  });

  it('includes locale field when provided directly in LogFields', () => {
    let capturedLine = '';
    const customLogger = createLogger((line) => {
      capturedLine = line;
    });

    customLogger.info('http.access', {
      route: '/api/v1/interviews',
      method: 'GET',
      status: 200,
      locale: 'en',
    });

    expect(capturedLine).toBeTruthy();
    const parsed = JSON.parse(capturedLine);
    expect(parsed.locale).toBe('en');
  });

  it('normalizes uppercase locale to lowercase vi/en', () => {
    let capturedLine = '';
    const customLogger = createLogger((line) => {
      capturedLine = line;
    });

    customLogger.info('http.access', {
      route: '/api/v1/interviews',
      method: 'GET',
      status: 200,
      locale: 'VI',
    });

    const parsed = JSON.parse(capturedLine);
    expect(parsed.locale).toBe('vi');
  });
});
