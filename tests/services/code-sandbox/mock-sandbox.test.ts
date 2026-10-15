import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { MockSandboxProvider } from '../../../src/services/code-sandbox/MockSandboxProvider';
import type { TestCase } from '../../../src/services/code-sandbox/types';

describe('MockSandboxProvider (Micro-Task 3.3)', () => {
  it('executes simple JavaScript code and captures stdout', async () => {
    const sandbox = new MockSandboxProvider();
    const result = await sandbox.execute('console.log("Hello from Mock Sandbox");', 'javascript');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Hello from Mock Sandbox');
    expect(result.stderr).toBe('');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.memoryKb).toBeGreaterThan(0);
  });

  it('handles execution errors and reports stderr with non-zero exit code', async () => {
    const sandbox = new MockSandboxProvider();
    const result = await sandbox.execute('throw new Error("Syntax Error Test");', 'javascript');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Syntax Error Test');
  });

  it('runs test cases and returns structured test results', async () => {
    const sandbox = new MockSandboxProvider();
    const testCases: TestCase[] = [
      { input: '2, 3', expectedOutput: '5', isHidden: false },
      { input: '10, 20', expectedOutput: '30', isHidden: true },
    ];

    const code = `
      function add(a, b) { return a + b; }
      console.log(add(2, 3));
      console.log(add(10, 20));
    `;

    const result = await sandbox.execute(code, 'javascript', testCases);

    expect(result.testResults).toBeDefined();
    expect(result.testResults?.length).toBe(2);
    expect(result.testResults?.[0].passed).toBe(true);
    expect(result.testResults?.[0].isHidden).toBe(false);
    expect(result.testResults?.[1].passed).toBe(true);
    expect(result.testResults?.[1].isHidden).toBe(true);
  });

  it('supports simulated execution for python and typescript', async () => {
    const sandbox = new MockSandboxProvider();
    const pyResult = await sandbox.execute('print("Python execution")', 'python');
    expect(pyResult.stdout).toContain('Python execution');
    expect(pyResult.exitCode).toBe(0);

    const tsResult = await sandbox.execute('const x: number = 42; console.log(x);', 'typescript');
    expect(tsResult.stdout).toContain('42');
    expect(tsResult.exitCode).toBe(0);
  });
});
