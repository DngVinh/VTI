import { z } from 'zod';

export type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'go';

export const supportedLanguageSchema = z.enum([
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
]);

export interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

export const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  isHidden: z.boolean().optional().default(false),
});

export interface TestCaseResult {
  testCaseIndex: number;
  passed: boolean;
  actualOutput: string;
  expectedOutput: string;
  executionTimeMs: number;
  isHidden: boolean;
}

export const testCaseResultSchema = z.object({
  testCaseIndex: z.number().min(0),
  passed: z.boolean(),
  actualOutput: z.string(),
  expectedOutput: z.string(),
  executionTimeMs: z.number().min(0),
  isHidden: z.boolean(),
});

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  memoryKb: number;
  testResults?: TestCaseResult[];
}

export const executionResultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  executionTimeMs: z.number().min(0),
  memoryKb: z.number().min(0),
  testResults: z.array(testCaseResultSchema).optional(),
});

export const codeExecutionRequestSchema = z.object({
  questionId: z.string().min(1),
  code: z.string().trim().min(1, 'Code cannot be empty').max(20000, 'Code exceeds 20000 characters limit'),
  language: supportedLanguageSchema,
  testCases: z.array(testCaseSchema).optional(),
});

export type CodeExecutionRequest = z.infer<typeof codeExecutionRequestSchema>;

export interface ISandboxProvider {
  execute(
    code: string,
    language: SupportedLanguage,
    testCases?: TestCase[]
  ): Promise<ExecutionResult>;
}
