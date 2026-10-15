import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import User from '../src/models/user.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { generateAuthTokens } from '../src/utils/token';
import { ComplexityAnalyzer } from '../src/services/code-sandbox/ComplexityAnalyzer';
import { AiCodeReviewer } from '../src/services/code-sandbox/AiCodeReviewer';
import { MockSandboxProvider } from '../src/services/code-sandbox/MockSandboxProvider';

let mongo: MongoMemoryReplSet;
let app: any;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await InterviewSessionModel.deleteMany({});
});

describe('Phase 3: Live Code Sandbox & Semantic AST Analysis Integration (Micro-Task 3.10)', () => {
  it('analyzes AST metrics accurately for nested loops and empty catch blocks', () => {
    const analyzer = new ComplexityAnalyzer();
    const code = `
      function twoSum(nums: number[], target: number) {
        try {
          for (let i = 0; i < nums.length; i++) {
            for (let j = i + 1; j < nums.length; j++) {
              if (nums[i] + nums[j] === target) return [i, j];
            }
          }
        } catch (e) {
          // Silent failure
        }
        return [];
      }
    `;

    const result = analyzer.analyze(code);
    expect(result.estimatedTimeComplexity).toBe('O(N^2)');
    expect(result.maxLoopNesting).toBe(2);
    expect(result.cyclomaticComplexity).toBeGreaterThanOrEqual(3);
    expect(result.detectedSmells).toContain('EMPTY_CATCH_BLOCK');
  });

  it('runs sandbox provider and returns standard execution metrics', async () => {
    const sandbox = new MockSandboxProvider();
    const code = `
      const x = 10;
      const y = 20;
      console.log(x + y);
    `;

    const result = await sandbox.execute(code, 'javascript');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('30');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('performs end-to-end code execution and review via HTTP API', async () => {
    const candidate = await User.create({
      fullName: 'Phạm Minh Toàn',
      email: 'toan.code@example.com',
      password: 'Password123!',
      role: 'CANDIDATE',
    });

    const tokens = generateAuthTokens(candidate._id.toString(), 'CANDIDATE');

    const session = await InterviewSessionModel.create({
      userId: candidate._id,
      jobPosition: new mongoose.Types.ObjectId(),
      level: new mongoose.Types.ObjectId(),
      techStacks: [new mongoose.Types.ObjectId()],
      language: 'VI',
      status: 'IN_PROGRESS',
      secondsPerQuestion: 300,
      totalQuestions: 5,
      currentQuestionIndex: 0,
    });

    const codeToTest = `
      function fibonacci(n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
      }
      console.log(fibonacci(6));
    `;

    const res = await request(app)
      .post(`/api/v1/interviews/${session._id}/execute-code`)
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .send({
        questionId: 'q-algo-fib',
        code: codeToTest,
        language: 'javascript',
        withAiReview: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 1. Check Execution
    expect(res.body.data.execution.stdout.trim()).toBe('8');
    expect(res.body.data.execution.exitCode).toBe(0);

    // 2. Check AST & Review
    expect(res.body.data.review).toBeDefined();
    expect(res.body.data.review.astComplexity.hasRecursion).toBe(true);
    expect(res.body.data.review.astComplexity.estimatedTimeComplexity).toBe('O(2^N)');
    expect(res.body.data.review.feedback.vi).toBeTruthy();
    expect(res.body.data.review.cleanCodeScore).toBeGreaterThan(0);
  });
});
