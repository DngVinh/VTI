import { GoogleGenerativeAI } from '@google/generative-ai';
import { injectable } from 'tsyringe';
import { QuestionBankDomainError } from '../../domain/question-bank/errors';
import { validateVector } from '../../domain/question-bank/similarity';
import {
  IQuestionEmbeddingProvider,
  QuestionEmbeddingOutput,
  QuestionEmbeddingPayload,
} from '../interfaces/IQuestionEmbeddingProvider';
import { getEnv } from '../../config/env';

@injectable()
export class GeminiQuestionEmbeddingProvider implements IQuestionEmbeddingProvider {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName: string;
  private dimensions: number;
  private timeoutMs: number;
  private maxRetries: number;

  constructor() {
    const env = getEnv();
    const apiKey = env.GEMINI_API_KEY || '';
    this.modelName = env.QUESTION_BANK_EMBEDDING_MODEL;
    this.dimensions = env.QUESTION_BANK_EMBEDDING_DIMENSIONS;
    this.timeoutMs = env.QUESTION_BANK_AI_TIMEOUT_MS;
    this.maxRetries = env.QUESTION_BANK_AI_MAX_RETRIES;

    if (apiKey.trim()) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async generateEmbedding(
    payload: QuestionEmbeddingPayload
  ): Promise<QuestionEmbeddingOutput> {
    if (!this.genAI) {
      throw new QuestionBankDomainError(
        'QUESTION_EMBEDDING_PROVIDER_UNAVAILABLE',
        'GEMINI_API_KEY chưa được cấu hình cho Question Bank Embedding'
      );
    }

    const model = this.genAI.getGenerativeModel({ model: this.modelName });

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new QuestionBankDomainError(
                  'AI_PROVIDER_TIMEOUT',
                  'Yêu cầu sinh embedding đã quá thời gian phản hồi (timeout)'
                )
              ),
            this.timeoutMs
          )
        );

        const callPromise = model.embedContent(payload.text);

        const result = await Promise.race([callPromise, timeoutPromise]);
        const values = result.embedding?.values;

        if (!values || !Array.isArray(values)) {
          throw new QuestionBankDomainError(
            'QUESTION_EMBEDDING_INVALID_DIMENSIONS',
            'Phản hồi từ embedding model không chứa vector hợp lệ'
          );
        }

        const validated = validateVector(values, this.dimensions);

        return {
          vector: validated,
          dimensions: this.dimensions,
          provider: 'gemini',
          model: this.modelName,
        };
      } catch (err: any) {
        if (err instanceof QuestionBankDomainError) {
          throw err;
        }

        attempt++;
        if (attempt > this.maxRetries) {
          if (err.status === 429 || err.message?.includes('429')) {
            throw new QuestionBankDomainError(
              'AI_PROVIDER_RATE_LIMIT',
              'Vượt quá giới hạn gọi dịch vụ embedding AI (rate limit)'
            );
          }
          throw new QuestionBankDomainError(
            'QUESTION_EMBEDDING_PROVIDER_UNAVAILABLE',
            'Dịch vụ sinh vector embedding AI tạm thời không khả dụng'
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }

    throw new QuestionBankDomainError(
      'QUESTION_EMBEDDING_PROVIDER_UNAVAILABLE',
      'Không thể sinh vector embedding sau nhiều lần thử'
    );
  }
}
