import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PistonSandboxProvider } from '../../../src/services/code-sandbox/PistonSandboxProvider';
import type { TestCase } from '../../../src/services/code-sandbox/types';

describe('PistonSandboxProvider (Micro-Task 3.2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps supported languages to Piston runtimes and versions', () => {
    const provider = new PistonSandboxProvider('http://localhost:2000');
    expect(provider.getPistonLanguage('javascript')).toBe('javascript');
    expect(provider.getPistonLanguage('typescript')).toBe('typescript');
    expect(provider.getPistonLanguage('python')).toBe('python3');
    expect(provider.getPistonLanguage('java')).toBe('java');
    expect(provider.getPistonLanguage('go')).toBe('go');
  });

  it('executes code successfully via mock HTTP fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        run: {
          stdout: '42\n',
          stderr: '',
          code: 0,
        },
      }),
    });
    global.fetch = mockFetch;

    const provider = new PistonSandboxProvider('http://localhost:2000');
    const result = await provider.execute('console.log(42);', 'javascript');

    expect(result.stdout).toBe('42\n');
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:2000/api/v2/execute',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('evaluates test cases against actual stdout', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        run: {
          stdout: '[0, 1]\n',
          stderr: '',
          code: 0,
        },
      }),
    });
    global.fetch = mockFetch;

    const testCases: TestCase[] = [
      { input: '[2, 7, 11, 15], 9', expectedOutput: '[0, 1]', isHidden: false },
    ];

    const provider = new PistonSandboxProvider('http://localhost:2000');
    const result = await provider.execute('console.log("[0, 1]");', 'javascript', testCases);

    expect(result.testResults).toBeDefined();
    expect(result.testResults?.length).toBe(1);
    expect(result.testResults?.[0].passed).toBe(true);
    expect(result.testResults?.[0].actualOutput).toBe('[0, 1]');
  });

  it('handles network failure or non-200 HTTP status and throws error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    global.fetch = mockFetch;

    const provider = new PistonSandboxProvider('http://localhost:2000');
    await expect(provider.execute('print(1)', 'python')).rejects.toThrow();
  });
});
