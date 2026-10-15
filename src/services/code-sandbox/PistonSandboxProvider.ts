import { injectable, inject } from 'tsyringe';
import vm from 'node:vm';
import {
  type ISandboxProvider,
  type SupportedLanguage,
  type TestCase,
  type TestCaseResult,
  type ExecutionResult,
} from './types';
import { logger } from '../../infrastructure/logging/logger';

const DANGEROUS_PATTERNS = /\b(process|require|import|global|globalThis|constructor|__proto__|prototype|eval|Function|Buffer)\b/i;

@injectable()
export class PistonSandboxProvider implements ISandboxProvider {
  private apiUrl: string;
  private enableFallback: boolean;

  constructor(
    @inject('PistonApiUrl') apiUrl?: string,
    enableFallback?: boolean,
  ) {
    this.apiUrl = (apiUrl || 'http://localhost:2000').replace(/\/$/, '');
    this.enableFallback = enableFallback ?? (apiUrl ? false : true);
  }

  getPistonLanguage(lang: SupportedLanguage): string {
    switch (lang) {
      case 'python':
        return 'python3';
      case 'javascript':
        return 'javascript';
      case 'typescript':
        return 'typescript';
      case 'java':
        return 'java';
      case 'go':
        return 'go';
      default:
        return lang;
    }
  }

  private evaluateTestCases(
    stdout: string,
    testCases: TestCase[],
    executionTimeMs: number
  ): TestCaseResult[] {
    const lines = stdout.trim().split('\n');
    return testCases.map((tc, idx) => {
      const actualOutput = (lines[idx] !== undefined ? lines[idx] : stdout).trim();
      const expected = tc.expectedOutput.trim();
      const passed = actualOutput === expected;

      return {
        testCaseIndex: idx,
        passed,
        actualOutput,
        expectedOutput: expected,
        executionTimeMs: Math.round(executionTimeMs / testCases.length),
        isHidden: Boolean(tc.isHidden),
      };
    });
  }

  private executeLocalFallback(
    code: string,
    language: SupportedLanguage,
    testCases?: TestCase[],
    startTime: number = Date.now()
  ): ExecutionResult {
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    if (language === 'javascript' || language === 'typescript') {
      // Hardened sandbox security guard: prevent prototype traversal / RCE
      if (DANGEROUS_PATTERNS.test(code)) {
        return {
          stdout: '',
          stderr: 'Security violation: Access to host reflection or sensitive globals is blocked in fallback sandbox.',
          exitCode: 1,
          executionTimeMs: Date.now() - startTime,
          memoryKb: 0,
        };
      }

      try {
        const consoleLog = (...args: any[]) => {
          stdout += args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') + '\n';
        };
        const consoleError = (...args: any[]) => {
          stderr += args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') + '\n';
        };

        const sandbox = Object.create(null);
        sandbox.console = Object.freeze({
          log: consoleLog,
          error: consoleError,
          warn: consoleLog,
          info: consoleLog,
        });
        sandbox.Math = Math;
        sandbox.Date = Date;
        sandbox.JSON = JSON;
        sandbox.parseInt = parseInt;
        sandbox.parseFloat = parseFloat;
        sandbox.isNaN = isNaN;
        sandbox.isFinite = isFinite;
        sandbox.Array = Array;
        sandbox.Object = Object;
        sandbox.String = String;
        sandbox.Number = Number;
        sandbox.Boolean = Boolean;
        sandbox.Map = Map;
        sandbox.Set = Set;
        sandbox.RegExp = RegExp;

        const context = vm.createContext(sandbox);
        vm.runInContext(code, context, { timeout: 3000 });
      } catch (err: any) {
        stderr = err?.message || String(err);
        exitCode = 1;
      }
    } else {
      stdout = `[Local Sandbox Fallback for ${language}]\nExecution completed.\n`;
    }

    const executionTimeMs = Date.now() - startTime;
    const testResults = testCases && testCases.length > 0
      ? this.evaluateTestCases(stdout, testCases, executionTimeMs)
      : undefined;

    return {
      stdout,
      stderr,
      exitCode,
      executionTimeMs,
      memoryKb: 1024,
      testResults,
    };
  }

  async execute(
    code: string,
    language: SupportedLanguage,
    testCases?: TestCase[]
  ): Promise<ExecutionResult> {
    const pistonLang = this.getPistonLanguage(language);
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.apiUrl}/api/v2/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: pistonLang,
          version: '*',
          files: [
            {
              name: `solution.${pistonLang === 'python3' ? 'py' : pistonLang === 'typescript' ? 'ts' : pistonLang === 'javascript' ? 'js' : pistonLang === 'go' ? 'go' : 'java'}`,
              content: code,
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (!this.enableFallback) {
          throw new Error(`Piston API execution failed: ${response.status} ${response.statusText}`);
        }
        return this.executeLocalFallback(code, language, testCases, startTime);
      }

      const data = (await response.json()) as any;
      const run = data.run || {};
      const stdout = run.stdout || '';
      const stderr = run.stderr || '';
      const exitCode = run.code ?? 0;
      const executionTimeMs = Date.now() - startTime;
      const memoryKb = run.memory || 0;

      const testResults = testCases && testCases.length > 0
        ? this.evaluateTestCases(stdout, testCases, executionTimeMs)
        : undefined;

      return {
        stdout,
        stderr,
        exitCode,
        executionTimeMs,
        memoryKb,
        testResults,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (!this.enableFallback) {
        throw err;
      }
      logger.warn('ai.provider_failed');
      return this.executeLocalFallback(code, language, testCases, startTime);
    }
  }
}
