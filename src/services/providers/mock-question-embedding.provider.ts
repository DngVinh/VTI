import { createHash } from 'node:crypto';
import { injectable } from 'tsyringe';
import { QuestionBankDomainError } from '../../domain/question-bank/errors';
import {
  IQuestionEmbeddingProvider,
  QuestionEmbeddingOutput,
  QuestionEmbeddingPayload,
} from '../interfaces/IQuestionEmbeddingProvider';
import { getEnv } from '../../config/env';

export type MockEmbeddingScenario =
  | 'SUCCESS'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'INVALID_DIMENSIONS';

@injectable()
export class MockQuestionEmbeddingProvider implements IQuestionEmbeddingProvider {
  private scenario: MockEmbeddingScenario = 'SUCCESS';
  private dimensions: number = 768;

  constructor() {
    const rawDim = getEnv().QUESTION_BANK_EMBEDDING_DIMENSIONS;
    if (rawDim && rawDim > 0) {
      this.dimensions = rawDim;
    }
  }

  setScenario(scenario: MockEmbeddingScenario): void {
    this.scenario = scenario;
  }

  setDimensions(dim: number): void {
    this.dimensions = dim;
  }

  async generateEmbedding(
    payload: QuestionEmbeddingPayload
  ): Promise<QuestionEmbeddingOutput> {
    switch (this.scenario) {
      case 'TIMEOUT':
        throw new QuestionBankDomainError(
          'AI_PROVIDER_TIMEOUT',
          'Yêu cầu tạo embedding bằng AI đã quá thời gian phản hồi (timeout)'
        );
      case 'RATE_LIMIT':
        throw new QuestionBankDomainError(
          'AI_PROVIDER_RATE_LIMIT',
          'Vượt quá giới hạn gọi dịch vụ embedding AI (rate limit)'
        );
      case 'SERVER_ERROR':
        throw new QuestionBankDomainError(
          'QUESTION_EMBEDDING_PROVIDER_UNAVAILABLE',
          'Dịch vụ sinh vector embedding AI tạm thời không khả dụng'
        );
      case 'INVALID_DIMENSIONS':
        // Returns malformed vector for negative test
        return {
          vector: [0.1, 0.2], // wrong dimension
          dimensions: 2,
          provider: 'mock',
          model: 'mock-text-embedding-004',
        };
      case 'SUCCESS':
      default:
        return this.buildDeterministicVector(payload.text);
    }
  }

  private buildDeterministicVector(text: string): QuestionEmbeddingOutput {
    // Generate deterministic seed from text hash
    const hash = createHash('sha256').update(text.trim().normalize('NFC')).digest('hex');
    let seed = parseInt(hash.slice(0, 8), 16);

    // Mulberry32 generator
    const nextRandom = (): number => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const vector: number[] = [];
    let norm = 0;
    for (let i = 0; i < this.dimensions; i++) {
      // Gaussian approx by Box-Muller or uniform centered at 0
      const val = nextRandom() * 2 - 1;
      vector.push(val);
      norm += val * val;
    }

    // Unit normalization
    const sqrtNorm = Math.sqrt(norm) || 1;
    const normalized = vector.map((v) => Number((v / sqrtNorm).toFixed(6)));

    return {
      vector: normalized,
      dimensions: this.dimensions,
      provider: 'mock',
      model: 'mock-text-embedding-004',
    };
  }
}
