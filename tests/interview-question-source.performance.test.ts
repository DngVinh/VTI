import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { QuestionBankInterviewQuestionSource } from '../src/domain/interview/question-source/QuestionBankInterviewQuestionSource';
import { InterviewQuestionGenerationOrchestrator } from '../src/domain/interview/question-source/InterviewQuestionGenerationOrchestrator';
import { AiInterviewQuestionSource } from '../src/domain/interview/question-source/AiInterviewQuestionSource';
import { HybridInterviewQuestionSource } from '../src/domain/interview/question-source/HybridInterviewQuestionSource';
import { QuestionBankCandidateItem, QuestionSourceContext } from '../src/domain/interview/question-source/types';
import { MockAiProvider } from '../src/services/ai/providers/MockAiProvider';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';

// Helper for percentile calculation
function calculatePercentiles(latencies: number[]) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const n = sorted.length;
  return {
    min: sorted[0],
    p50: sorted[Math.floor(n * 0.50)],
    p95: sorted[Math.min(n - 1, Math.floor(n * 0.95))],
    p99: sorted[Math.min(n - 1, Math.floor(n * 0.99))],
    max: sorted[n - 1],
    avg: Number((sorted.reduce((a, b) => a + b, 0) / n).toFixed(2)),
  };
}

// Synthetic pool generator (deterministic)
function createSyntheticPool(count: number): QuestionBankCandidateItem[] {
  const difficulties: Array<'EASY' | 'MEDIUM' | 'HARD'> = ['EASY', 'MEDIUM', 'HARD'];
  const pool: QuestionBankCandidateItem[] = [];

  for (let i = 0; i < count; i++) {
    const diff = difficulties[i % 3];
    const padded = String(i + 1).padStart(6, '0');
    pool.push({
      questionId: `507f1f77bcf86cd799439${padded.slice(-3)}`,
      versionId: `507f1f77bcf86cd799438${padded.slice(-3)}`,
      versionNumber: 1,
      code: `QB-2026-${padded}`,
      prompt: {
        vi: `Câu hỏi tổng hợp kiểm thử hiệu năng số ${i + 1}`,
        en: `Synthetic performance test question number ${i + 1}`,
      },
      difficulty: diff,
      type: 'TECHNICAL',
      primaryRoleId: '507f1f77bcf86cd799439001',
      levelIds: ['507f1f77bcf86cd799439002'],
      technologyIds: ['507f1f77bcf86cd799439003'],
    });
  }

  return pool;
}

describe('AIP-67 Phase 6 Performance & Latency Benchmark Suite', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
    process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'BANK_ONLY';
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  it('measures deterministic QuestionBank selection performance on 1,000-question pool', async () => {
    const pool1k = createSyntheticPool(1_000);
    const mockSelector = {
      findEligibleQuestions: vi.fn().mockResolvedValue(pool1k),
    };

    const source = new QuestionBankInterviewQuestionSource(mockSelector as any);
    const iterations = 30;
    const latencies: number[] = [];

    const context: QuestionSourceContext = {
      sessionId: 'sess_bench_1k',
      setupData: {
        jobPosition: '507f1f77bcf86cd799439001',
        level: '507f1f77bcf86cd799439002',
        techStacks: ['507f1f77bcf86cd799439003'],
      },
      policyVersion: 'v1',
    };

    let firstBundleCodes: string[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const res = await source.generateQuestions(context);
      const elapsed = performance.now() - start;
      latencies.push(elapsed);

      // Verify exact five & difficulty distribution
      expect(res.questions).toHaveLength(5);
      const easyCount = res.questions.filter((q) => q.difficulty === 'EASY').length;
      const medCount = res.questions.filter((q) => q.difficulty === 'MEDIUM').length;
      const hardCount = res.questions.filter((q) => q.difficulty === 'HARD').length;
      expect(easyCount).toBe(1);
      expect(medCount).toBe(2);
      expect(hardCount).toBe(2);

      // Verify deterministic selection across iterations for same session
      const codes = res.questions.map((q) => q.questionBankCode!);
      if (i === 0) {
        firstBundleCodes = codes;
      } else {
        expect(codes).toEqual(firstBundleCodes);
      }
    }

    const stats = calculatePercentiles(latencies);
    console.log(`[Benchmark 1k Pool] Iterations: ${iterations}, p50: ${stats.p50.toFixed(2)}ms, p95: ${stats.p95.toFixed(2)}ms, p99: ${stats.p99.toFixed(2)}ms, avg: ${stats.avg}ms`);

    // Latency sanity bound (selection on 1k memory items)
    expect(stats.p50).toBeLessThan(200);
  });

  it('measures deterministic QuestionBank selection performance on 10,000-question pool', async () => {
    const pool10k = createSyntheticPool(10_000);
    const mockSelector = {
      findEligibleQuestions: vi.fn().mockResolvedValue(pool10k),
    };

    const source = new QuestionBankInterviewQuestionSource(mockSelector as any);
    const iterations = 15;
    const latencies: number[] = [];

    const context: QuestionSourceContext = {
      sessionId: 'sess_bench_10k',
      setupData: {
        jobPosition: '507f1f77bcf86cd799439001',
        level: '507f1f77bcf86cd799439002',
        techStacks: ['507f1f77bcf86cd799439003'],
      },
      policyVersion: 'v1',
    };

    let firstBundleCodes: string[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const res = await source.generateQuestions(context);
      const elapsed = performance.now() - start;
      latencies.push(elapsed);

      expect(res.questions).toHaveLength(5);

      const codes = res.questions.map((q) => q.questionBankCode!);
      if (i === 0) {
        firstBundleCodes = codes;
      } else {
        expect(codes).toEqual(firstBundleCodes);
      }
    }

    const stats = calculatePercentiles(latencies);
    console.log(`[Benchmark 10k Pool] Iterations: ${iterations}, p50: ${stats.p50.toFixed(2)}ms, p95: ${stats.p95.toFixed(2)}ms, p99: ${stats.p99.toFixed(2)}ms, avg: ${stats.avg}ms`);

    // Latency sanity bound on 10k items (resilient against parallel coverage runner load)
    expect(stats.p50).toBeLessThan(1000);
  });

  it('benchmarks concurrent multi-session generation without latency degradation or collision', async () => {
    const pool = createSyntheticPool(500);
    const mockSelector = {
      findEligibleQuestions: vi.fn().mockResolvedValue(pool),
    };

    const bankSource = new QuestionBankInterviewQuestionSource(mockSelector as any);
    const mockAiProvider = new MockAiProvider();
    const aiSource = new AiInterviewQuestionSource(mockAiProvider);
    const hybridSource = new HybridInterviewQuestionSource(bankSource, aiSource);

    const concurrentSessions = 10;
    const sessionIds = Array.from({ length: concurrentSessions }, (_, i) => `sess_concurrent_${i + 1}`);

    const latencies: number[] = [];
    const results = await Promise.all(
      sessionIds.map(async (sid) => {
        const start = performance.now();
        const res = await bankSource.generateQuestions({
          sessionId: sid,
          setupData: {
            jobPosition: '507f1f77bcf86cd799439001',
            level: '507f1f77bcf86cd799439002',
            techStacks: ['507f1f77bcf86cd799439003'],
          },
          policyVersion: 'v1',
        });
        latencies.push(performance.now() - start);
        return { sid, questions: res.questions };
      })
    );

    expect(results).toHaveLength(concurrentSessions);
    results.forEach((r) => {
      expect(r.questions).toHaveLength(5);
      expect(r.questions.map((q) => q.order)).toEqual([1, 2, 3, 4, 5]);
    });

    const stats = calculatePercentiles(latencies);
    console.log(`[Concurrent Generation] Sessions: ${concurrentSessions}, p50: ${stats.p50.toFixed(2)}ms, p95: ${stats.p95.toFixed(2)}ms, p99: ${stats.p99.toFixed(2)}ms`);
    // Runaway guard (resilient against parallel test runner load per spec)
    expect(stats.p95).toBeLessThan(5000);
  });

  it('verifies SHADOW mode execution is bounded by timeout when shadow source delays', async () => {
    process.env.INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED = 'true';
    process.env.INTERVIEW_QUESTION_SOURCE_MODE = 'SHADOW';
    process.env.INTERVIEW_QUESTION_BANK_SHADOW_TIMEOUT_MS = '40'; // 40ms timeout

    const fastAiProvider = {
      generateQuestions: vi.fn().mockResolvedValue({
        data: [
          { order: 1, difficulty: 'Easy', content: { en: 'Q1', vi: 'Q1' } },
          { order: 2, difficulty: 'Medium', content: { en: 'Q2', vi: 'Q2' } },
          { order: 3, difficulty: 'Medium', content: { en: 'Q3', vi: 'Q3' } },
          { order: 4, difficulty: 'Hard', content: { en: 'Q4', vi: 'Q4' } },
          { order: 5, difficulty: 'Hard', content: { en: 'Q5', vi: 'Q5' } },
        ],
        audit: { promptTokenCount: 10, candidatesTokenCount: 50, totalTokenCount: 60 },
      }),
    };
    const aiSource = new AiInterviewQuestionSource(fastAiProvider as any);

    // Simulated slow question bank selector that takes 300ms
    const slowSelector = {
      findEligibleQuestions: vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 300))
      ),
    };

    const validSessionId = new mongoose.Types.ObjectId().toHexString();
    vi.spyOn(InterviewQuestionModel, 'countDocuments').mockResolvedValue(0 as any);

    const mockRepo = {
      findById: vi.fn().mockResolvedValue({
        id: validSessionId,
        status: 'GENERATING',
        setupData: { jobPosition: 'role_1' },
      }),
      commitInterviewQuestionsBundle: vi.fn().mockResolvedValue({ id: validSessionId }),
      updateStatus: vi.fn(),
    };

    const orchestrator = new InterviewQuestionGenerationOrchestrator(
      mockRepo as any,
      fastAiProvider as any,
      slowSelector as any
    );

    const start = performance.now();
    const result = await orchestrator.generateAndCommit(validSessionId, { jobPosition: 'role_1' });
    const elapsed = performance.now() - start;

    // AI questions returned successfully without blocking on 300ms bank source
    expect(result.questions).toHaveLength(5);
    expect(result.questions.every((q) => q.sourceType === 'AI_GENERATED')).toBe(true);

    // Total duration should be well below 300ms (bounded by ~40ms shadow timeout)
    expect(elapsed).toBeLessThan(200);

    // Diagnostics should indicate shadow failed due to timeout
    expect(result.diagnostics.shadowDiagnostics).toBeDefined();
    expect(result.diagnostics.shadowDiagnostics?.success).toBe(false);
    expect(result.diagnostics.shadowDiagnostics?.errorCode).toBe('INTERVIEW_QUESTION_SOURCE_TIMEOUT');
    console.log(`[Shadow Timeout Benchmark] Total elapsed: ${elapsed.toFixed(2)}ms (shadow bounded < 200ms)`);
  });

  it('verifies bounded heap memory delta across 100 selection cycles (no memory leak)', async () => {
    const pool = createSyntheticPool(2_000);
    const mockSelector = {
      findEligibleQuestions: vi.fn().mockResolvedValue(pool),
    };
    const source = new QuestionBankInterviewQuestionSource(mockSelector as any);

    // Force GC if available or record initial heap
    if (global.gc) global.gc();
    const initialHeap = process.memoryUsage().heapUsed;

    for (let i = 0; i < 100; i++) {
      await source.generateQuestions({
        sessionId: `sess_mem_${i}`,
        setupData: {
          jobPosition: '507f1f77bcf86cd799439001',
          level: '507f1f77bcf86cd799439002',
          techStacks: ['507f1f77bcf86cd799439003'],
        },
      });
    }

    if (global.gc) global.gc();
    const finalHeap = process.memoryUsage().heapUsed;
    const growthMb = (finalHeap - initialHeap) / (1024 * 1024);

    console.log(`[Memory Benchmark] Heap delta after 100 cycles: ${growthMb.toFixed(2)} MB`);
    // Heap growth should be well bounded (< 30 MB)
    expect(growthMb).toBeLessThan(30);
  });
});
