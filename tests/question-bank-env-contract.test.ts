import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Question Bank environment contract', () => {
  it('documents the exact runtime keys used by AI providers and similarity policy', () => {
    const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');

    for (const key of [
      'QUESTION_BANK_AI_TIMEOUT_MS',
      'QUESTION_BANK_AI_MAX_RETRIES',
      'QUESTION_BANK_SEMANTIC_THRESHOLD',
    ]) {
      expect(envExample).toMatch(new RegExp(`^${key}=`, 'm'));
    }

    for (const obsoleteKey of [
      'QUESTION_BANK_EMBEDDING_TIMEOUT_MS',
      'QUESTION_BANK_EMBEDDING_MAX_RETRIES',
      'QUESTION_BANK_DUPLICATE_THRESHOLD',
    ]) {
      expect(envExample).not.toMatch(new RegExp(`^${obsoleteKey}=`, 'm'));
    }
  });
});
