import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUESTION_COUNT,
  DEFAULT_SEED,
  DEFAULT_VERSION_COUNT,
  assertSafeWriteTarget,
  generateQuestionMetadata,
  generateVersionMetadata,
  parseCliArgs,
  summarizeDataset,
  type BenchmarkOptions,
} from '../scripts/question-bank-benchmark';

const writeOptions = (overrides: Partial<BenchmarkOptions> = {}): BenchmarkOptions => ({
  questionCount: 100,
  versionCount: 300,
  seed: DEFAULT_SEED,
  write: true,
  uri: 'mongodb://127.0.0.1:27017',
  database: 'aip62_benchmark_test',
  confirmDisposableDatabase: 'aip62_benchmark_test',
  runId: 'unit-test-run',
  batchSize: 100,
  ...overrides,
});

describe('Question Bank synthetic benchmark', () => {
  it('defaults to a deterministic 100k/300k dry run', () => {
    expect(parseCliArgs([])).toMatchObject({
      questionCount: DEFAULT_QUESTION_COUNT,
      versionCount: DEFAULT_VERSION_COUNT,
      seed: DEFAULT_SEED,
      write: false,
    });
  });

  it('generates stable server-shaped metadata with bilingual synthetic prompts', () => {
    const options = { questionCount: 20, versionCount: 60, seed: 1234 };
    const firstQuestions = [...generateQuestionMetadata(options)];
    const firstVersions = [...generateVersionMetadata(options)];
    const repeatedVersions = [...generateVersionMetadata(options)];

    expect(firstQuestions).toHaveLength(20);
    expect(firstVersions).toHaveLength(60);
    expect(firstVersions).toEqual(repeatedVersions);
    expect(firstQuestions[0].code).toMatch(/^QB-2026-\d{6}$/);
    expect(firstVersions[0].prompt.vi).toContain('Câu hỏi tổng hợp');
    expect(firstVersions[0].prompt.en).toContain('Synthetic question');
    expect(firstVersions.some((item) => item.status === 'DRAFT')).toBe(true);
    expect(firstVersions.some((item) => item.status === 'PUBLISHED')).toBe(true);
    expect(firstVersions.some((item) => item.status === 'SUPERSEDED')).toBe(true);
  });

  it('produces deterministic counts, digest, and hot/long-tail taxonomy skew', () => {
    const options = { questionCount: 2_000, versionCount: 6_000, seed: 9876 };
    const first = summarizeDataset(options);
    const second = summarizeDataset(options);

    expect(first).toEqual(second);
    expect(first.questions).toBe(2_000);
    expect(first.versions).toBe(6_000);
    expect(first.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.taxonomy.hot / first.versions).toBeGreaterThan(0.75);
    expect(first.taxonomy.longTail).toBeGreaterThan(0);
  });

  it('rejects unsafe counts and unknown CLI options before any connection', () => {
    expect(() => parseCliArgs(['--questions=10', '--versions=9'])).toThrow(/greater than or equal/);
    expect(() => parseCliArgs(['--questions=1000000', '--versions=1000000'])).toThrow(/six sequence digits/);
    expect(() => parseCliArgs(['--surprise=true'])).toThrow(/Unknown option/);
  });

  it('accepts only explicitly confirmed local disposable write targets', () => {
    expect(() => assertSafeWriteTarget(writeOptions())).not.toThrow();
    expect(() => assertSafeWriteTarget(writeOptions({ uri: undefined }))).toThrow(/requires/);
    expect(() => assertSafeWriteTarget(writeOptions({ uri: 'mongodb+srv://cluster.example/test' }))).toThrow(/local/);
    expect(() => assertSafeWriteTarget(writeOptions({ uri: 'mongodb://db.example.com:27017' }))).toThrow(/local/);
    expect(() => assertSafeWriteTarget(writeOptions({ database: 'production' }))).toThrow(/disposable/);
    expect(() => assertSafeWriteTarget(writeOptions({ confirmDisposableDatabase: 'different_test' }))).toThrow(/exactly match/);
  });

  it('does not require or inspect a database target in dry-run mode', () => {
    expect(() => assertSafeWriteTarget({
      questionCount: 10,
      versionCount: 30,
      seed: 1,
      write: false,
      batchSize: 10,
    })).not.toThrow();
  });
});

