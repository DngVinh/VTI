import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeExecutionController } from '../../src/controllers/CodeExecutionController';
import type { ISandboxProvider } from '../../src/services/code-sandbox/types';
import type { AiCodeReviewer } from '../../src/services/code-sandbox/AiCodeReviewer';

describe('CodeExecutionController (Micro-Task 3.6a)', () => {
  let mockSandbox: ISandboxProvider;
  let mockAiReviewer: Partial<AiCodeReviewer>;
  let controller: CodeExecutionController;

  beforeEach(() => {
    mockSandbox = {
      execute: vi.fn().mockResolvedValue({
        stdout: 'Hello World\n',
        stderr: '',
        exitCode: 0,
        executionTimeMs: 120,
        memoryUsageKb: 1024,
      }),
      getSupportedLanguages: vi.fn().mockReturnValue(['javascript', 'typescript', 'python']),
    };

    mockAiReviewer = {
      review: vi.fn().mockResolvedValue({
        astComplexity: {
          estimatedTimeComplexity: 'O(1)',
          estimatedSpaceComplexity: 'O(1)',
          cyclomaticComplexity: 1,
          maxLoopNesting: 0,
          hasRecursion: false,
          detectedSmells: [],
        },
        feedback: { vi: 'Tốt', en: 'Good' },
        suggestions: [],
        cleanCodeScore: 100,
      }),
    };

    controller = new CodeExecutionController(mockSandbox, mockAiReviewer as AiCodeReviewer);
  });

  it('successfully executes code and returns stdout with status 200', async () => {
    const req: any = {
      params: { id: '654321654321654321654321' },
      body: {
        questionId: 'q-1',
        code: 'console.log("Hello World");',
        language: 'javascript',
      },
    };

    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await controller.executeCode(req, res);

    expect(mockSandbox.execute).toHaveBeenCalledWith(
      'console.log("Hello World");',
      'javascript',
      undefined
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          execution: expect.objectContaining({
            stdout: 'Hello World\n',
            exitCode: 0,
          }),
        }),
      })
    );
  });

  it('includes AI review when withAiReview flag is true', async () => {
    const req: any = {
      params: { id: '654321654321654321654321' },
      body: {
        questionId: 'q-1',
        code: 'console.log("Hello World");',
        language: 'javascript',
        withAiReview: true,
      },
    };

    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await controller.executeCode(req, res);

    expect(mockAiReviewer.review).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          review: expect.objectContaining({
            cleanCodeScore: 100,
          }),
        }),
      })
    );
  });
});
