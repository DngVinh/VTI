import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  escapeCsvCell,
  formatCsvRow,
  parseCsvString,
  sanitizeFormulaInjection,
} from '../src/domain/question-bank/csv';
import {
  deterministicShuffle,
  evaluateSelectionPool,
} from '../src/domain/question-bank/selection';
import { QuestionSelectionItem } from '../src/domain/question-bank/types';

describe('Question Bank Phase 3 Domain - CSV and Formula Injection', () => {
  it('escapes cells starting with formula trigger characters (=, +, -, @, \\t, \\r)', () => {
    expect(sanitizeFormulaInjection('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(sanitizeFormulaInjection('+cmd|/C calc')).toBe("'+cmd|/C calc");
    expect(sanitizeFormulaInjection('-123')).toBe("'-123");
    expect(sanitizeFormulaInjection('@calc')).toBe("'@calc");
    expect(sanitizeFormulaInjection('Safe text')).toBe('Safe text');
  });

  it('formats CSV rows with quotes and escaped inner quotes', () => {
    const row = ['Code', 'Prompt, with comma', 'He said "Hello"', '=1+1'];
    const formatted = formatCsvRow(row);
    expect(formatted).toBe('Code,"Prompt, with comma","He said ""Hello""","\'=1+1"');
  });

  it('parses CSV strings correctly into rows', () => {
    const csv = 'col1,col2\n"val,1","val""2"\nval3,val4';
    const parsed = parseCsvString(csv);
    expect(parsed).toEqual([
      ['col1', 'col2'],
      ['val,1', 'val"2'],
      ['val3', 'val4'],
    ]);
  });
});

describe('Question Bank Phase 3 Domain - Selection Algorithm', () => {
  const mockItem = (id: string, code: string): QuestionSelectionItem => ({
    questionId: id,
    code,
    versionNumber: 1,
    prompt: { vi: `Câu hỏi ${code}`, en: `Question ${code}` },
    type: 'TECHNICAL',
    difficulty: 'MEDIUM',
    taxonomy: {
      primaryRoleId: 'role1',
      additionalRoleIds: [],
      levelIds: ['level1'],
      technologyIds: ['tech1'],
      topic: 'Testing',
      tags: ['javascript'],
    },
  });

  it('produces identical deterministic order when given identical seed', () => {
    const items = [
      mockItem('1', 'Q-000001'),
      mockItem('2', 'Q-000002'),
      mockItem('3', 'Q-000003'),
      mockItem('4', 'Q-000004'),
      mockItem('5', 'Q-000005'),
    ];

    const run1 = deterministicShuffle([...items], 'test-seed-123');
    const run2 = deterministicShuffle([...items], 'test-seed-123');
    const run3 = deterministicShuffle([...items], 'different-seed-456');

    expect(run1.map((i) => i.code)).toEqual(run2.map((i) => i.code));
    expect(run1.map((i) => i.code)).not.toEqual(run3.map((i) => i.code));
  });

  it('evaluates pool sufficiency and provides clear diagnostics', () => {
    const items = [
      mockItem('1', 'Q-000001'),
      mockItem('2', 'Q-000002'),
    ];

    const result = evaluateSelectionPool(items, 5, 'seed-abc');
    expect(result.selected).toHaveLength(2);
    expect(result.diagnostics.poolSize).toBe(2);
    expect(result.diagnostics.requestedCount).toBe(5);
    expect(result.diagnostics.selectedCount).toBe(2);
    expect(result.diagnostics.isPoolSufficient).toBe(false);
    expect(result.diagnostics.insufficientReason).toContain('Chỉ có 2 câu hỏi');
  });

  it('returns exact requested count when pool is sufficient', () => {
    const items = [
      mockItem('1', 'Q-000001'),
      mockItem('2', 'Q-000002'),
      mockItem('3', 'Q-000003'),
      mockItem('4', 'Q-000004'),
    ];

    const result = evaluateSelectionPool(items, 2, 'seed-xyz');
    expect(result.selected).toHaveLength(2);
    expect(result.diagnostics.isPoolSufficient).toBe(true);
    expect(result.diagnostics.insufficientReason).toBeNull();
  });
});

describe('Question Bank Phase 3 Domain - Mock AI Provider', () => {
  it('generates valid structured draft in SUCCESS mode', async () => {
    const { MockAiQuestionDraftProvider } = await import(
      '../src/services/providers/mock-ai-question-draft.provider'
    );
    const provider = new MockAiQuestionDraftProvider();
    const draft = await provider.generateDraft({
      topic: 'React Server Components',
      roleId: '507f1f77bcf86cd799439011',
      levelId: '507f1f77bcf86cd799439012',
      difficulty: 'HARD',
      type: 'TECHNICAL',
      language: 'both',
    });

    expect(draft.prompt.vi).toContain('React Server Components');
    expect(draft.prompt.en).toContain('React Server Components');
    expect(draft.referenceAnswer.vi).toBeTruthy();
    expect(draft.referenceAnswer.en).toBeTruthy();
    expect(draft.rubric.length).toBeGreaterThanOrEqual(2);
    const totalWeight = draft.rubric.reduce((sum, r) => sum + r.weight, 0);
    expect(totalWeight).toBe(100);
  });

  it('handles simulated failure modes (timeout, rate limit, error, schema)', async () => {
    const { MockAiQuestionDraftProvider } = await import(
      '../src/services/providers/mock-ai-question-draft.provider'
    );
    const provider = new MockAiQuestionDraftProvider();
    const spec = {
      topic: 'GraphQL',
      roleId: '507f1f77bcf86cd799439011',
      levelId: '507f1f77bcf86cd799439012',
      difficulty: 'MEDIUM' as const,
      type: 'TECHNICAL' as const,
    };

    provider.setScenario('TIMEOUT');
    await expect(provider.generateDraft(spec)).rejects.toThrow('timeout');

    provider.setScenario('RATE_LIMIT');
    await expect(provider.generateDraft(spec)).rejects.toThrow('rate limit');

    provider.setScenario('SERVER_ERROR');
    await expect(provider.generateDraft(spec)).rejects.toThrow('lỗi nội bộ');

    provider.setScenario('INVALID_SCHEMA');
    await expect(provider.generateDraft(spec)).rejects.toThrow('không đúng cấu trúc');
  });
});

