import { describe, it, expect } from 'vitest';
import {
  supportedLanguageSchema,
  testCaseSchema,
  executionResultSchema,
  codeExecutionRequestSchema,
  type SupportedLanguage,
  type TestCase,
  type ExecutionResult,
} from '../../../src/services/code-sandbox/types';

describe('Sandbox Engine Types & Contracts (Micro-Task 3.1)', () => {
  describe('supportedLanguageSchema', () => {
    it('should allow supported languages', () => {
      const validLangs: SupportedLanguage[] = ['javascript', 'typescript', 'python', 'java', 'go'];
      validLangs.forEach((lang) => {
        expect(supportedLanguageSchema.safeParse(lang).success).toBe(true);
      });
    });

    it('should reject unsupported languages', () => {
      expect(supportedLanguageSchema.safeParse('ruby').success).toBe(false);
      expect(supportedLanguageSchema.safeParse('php').success).toBe(false);
    });
  });

  describe('testCaseSchema', () => {
    it('should validate standard and hidden test cases', () => {
      const standardCase: TestCase = {
        input: '[2, 7, 11, 15], 9',
        expectedOutput: '[0, 1]',
        isHidden: false,
      };
      expect(testCaseSchema.safeParse(standardCase).success).toBe(true);

      const hiddenCase: TestCase = {
        input: '[3, 3], 6',
        expectedOutput: '[0, 1]',
        isHidden: true,
      };
      expect(testCaseSchema.safeParse(hiddenCase).success).toBe(true);
    });
  });

  describe('executionResultSchema', () => {
    it('should validate complete execution output', () => {
      const result: ExecutionResult = {
        stdout: 'Hello world\n',
        stderr: '',
        exitCode: 0,
        executionTimeMs: 45,
        memoryKb: 12400,
        testResults: [
          {
            testCaseIndex: 0,
            passed: true,
            actualOutput: '[0, 1]',
            expectedOutput: '[0, 1]',
            executionTimeMs: 12,
            isHidden: false,
          },
        ],
      };

      const parsed = executionResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('codeExecutionRequestSchema', () => {
    it('should validate request payload', () => {
      const req = {
        questionId: 'q-1',
        code: 'function twoSum(nums, target) { return [0, 1]; }',
        language: 'typescript',
      };
      expect(codeExecutionRequestSchema.safeParse(req).success).toBe(true);
    });

    it('should reject empty code or unsupported language', () => {
      const reqEmpty = {
        questionId: 'q-1',
        code: '   ',
        language: 'javascript',
      };
      expect(codeExecutionRequestSchema.safeParse(reqEmpty).success).toBe(false);
    });
  });
});
