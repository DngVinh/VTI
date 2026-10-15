import { injectable } from 'tsyringe';
import vm from 'vm';
import {
  type ISandboxProvider,
  type SupportedLanguage,
  type TestCase,
  type TestCaseResult,
  type ExecutionResult,
} from './types';

@injectable()
export class MockSandboxProvider implements ISandboxProvider {
  async execute(
    code: string,
    language: SupportedLanguage,
    testCases?: TestCase[]
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const stdoutLogs: string[] = [];

    // Check for explicit error simulation
    const errorMatch = code.match(/throw\s+(?:new\s+Error\(['"](.+?)['"]\)|['"](.+?)['"])/);
    if (errorMatch) {
      const errMsg = errorMatch[1] || errorMatch[2] || 'Error';
      return {
        stdout: '',
        stderr: `Runtime Error: ${errMsg}`,
        exitCode: 1,
        executionTimeMs: Date.now() - startTime + 5,
        memoryKb: 8192,
        testResults: testCases?.map((tc, idx) => ({
          testCaseIndex: idx,
          passed: false,
          actualOutput: `Error: ${errMsg}`,
          expectedOutput: tc.expectedOutput,
          executionTimeMs: 5,
          isHidden: Boolean(tc.isHidden),
        })),
      };
    }

    if (language === 'javascript' || language === 'typescript') {
      try {
        // Strip basic typescript types
        const cleanedCode = code
          .replace(/:\s*[A-Za-z0-9_<>[\]]+(?=\s*[=,);])/g, '')
          .replace(/interface\s+[A-Za-z0-9_]+\s*\{[^}]*\}/g, '')
          .replace(/type\s+[A-Za-z0-9_]+\s*=\s*[^;]+;/g, '');

        const sandboxContext = {
          console: {
            log: (...args: any[]) => {
              stdoutLogs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
            },
            error: (...args: any[]) => {
              stdoutLogs.push(args.join(' '));
            },
          },
        };

        vm.createContext(sandboxContext);
        vm.runInContext(cleanedCode, sandboxContext, { timeout: 2000 });
      } catch (err: any) {
        return {
          stdout: stdoutLogs.join('\n'),
          stderr: String(err?.message || err),
          exitCode: 1,
          executionTimeMs: Date.now() - startTime,
          memoryKb: 10240,
        };
      }
    } else if (language === 'python') {
      // Simulate Python print statements
      const printRegex = /print\((?:["'](.+?)["']|(.+?))\)/g;
      let match;
      while ((match = printRegex.exec(code)) !== null) {
        stdoutLogs.push(match[1] || match[2]);
      }
      if (stdoutLogs.length === 0 && code.trim()) {
        stdoutLogs.push('Python execution completed');
      }
    } else {
      // Java or Go simulation
      stdoutLogs.push(`Execution completed for ${language}`);
    }

    const stdout = stdoutLogs.join('\n') + (stdoutLogs.length > 0 ? '\n' : '');
    const executionTimeMs = Math.max(1, Date.now() - startTime);

    let testResults: TestCaseResult[] | undefined;
    if (testCases && testCases.length > 0) {
      testResults = testCases.map((tc, idx) => {
        const actual = stdoutLogs[idx] !== undefined ? stdoutLogs[idx].trim() : stdout.trim();
        const expected = tc.expectedOutput.trim();
        const passed = actual === expected;

        return {
          testCaseIndex: idx,
          passed,
          actualOutput: actual,
          expectedOutput: expected,
          executionTimeMs: Math.round(executionTimeMs / testCases.length) || 2,
          isHidden: Boolean(tc.isHidden),
        };
      });
    }

    return {
      stdout,
      stderr: '',
      exitCode: 0,
      executionTimeMs,
      memoryKb: 12288,
      testResults,
    };
  }
}
