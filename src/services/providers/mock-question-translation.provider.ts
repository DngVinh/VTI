import { injectable } from 'tsyringe';
import { QuestionBankDomainError } from '../../domain/question-bank/errors';
import {
  IQuestionTranslationProvider,
  QuestionTranslationOutput,
  QuestionTranslationPayload,
} from '../interfaces/IQuestionTranslationProvider';

export type MockTranslationScenario =
  | 'SUCCESS'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'INVALID_SCHEMA';

@injectable()
export class MockQuestionTranslationProvider implements IQuestionTranslationProvider {
  private scenario: MockTranslationScenario = 'SUCCESS';

  setScenario(scenario: MockTranslationScenario): void {
    this.scenario = scenario;
  }

  getScenario(): MockTranslationScenario {
    return this.scenario;
  }

  async translate(payload: QuestionTranslationPayload): Promise<QuestionTranslationOutput> {
    switch (this.scenario) {
      case 'TIMEOUT':
        throw new QuestionBankDomainError(
          'AI_PROVIDER_TIMEOUT',
          'Yêu cầu dịch câu hỏi bằng AI đã quá thời gian phản hồi (timeout)'
        );
      case 'RATE_LIMIT':
        throw new QuestionBankDomainError(
          'AI_PROVIDER_RATE_LIMIT',
          'Vượt quá giới hạn gọi dịch vụ AI (rate limit). Vui lòng thử lại sau.'
        );
      case 'SERVER_ERROR':
        throw new QuestionBankDomainError(
          'QUESTION_TRANSLATION_SCHEMA_ERROR',
          'Dịch vụ dịch thuật AI gặp lỗi nội bộ không thể xử lý yêu cầu lúc này'
        );
      case 'INVALID_SCHEMA':
        throw new QuestionBankDomainError(
          'QUESTION_TRANSLATION_SCHEMA_ERROR',
          'Phản hồi dịch thuật từ AI không đúng cấu trúc schema yêu cầu'
        );
      case 'SUCCESS':
      default:
        return this.buildDeterministicTranslation(payload);
    }
  }

  private buildDeterministicTranslation(
    payload: QuestionTranslationPayload
  ): QuestionTranslationOutput {
    const { targetLocale, fields } = payload;
    const prefix = targetLocale === 'en' ? '[EN] ' : '[VI] ';

    const translateText = (text: string | null | undefined): string | null => {
      if (!text || !text.trim()) return null;
      // Invert prefix if already present for realistic mock
      if (text.startsWith('[EN] ') && targetLocale === 'vi') {
        return `[VI] ${text.slice(5)}`;
      }
      if (text.startsWith('[VI] ') && targetLocale === 'en') {
        return `[EN] ${text.slice(5)}`;
      }
      return `${prefix}${text.trim()}`;
    };

    const translatedFollowUps = fields.followUps
      ? fields.followUps.map((item) => translateText(item) || item)
      : null;

    const translatedRubric = fields.rubric
      ? fields.rubric.map((crit) => ({
          key: crit.key,
          title: translateText(crit.title) || crit.title,
          description: translateText(crit.description) || crit.description,
          levels: crit.levels.map((lvl) => ({
            score: lvl.score,
            description: translateText(lvl.description) || lvl.description,
          })),
        }))
      : null;

    return {
      translated: {
        prompt: translateText(fields.prompt),
        explanation: translateText(fields.explanation),
        referenceAnswer: translateText(fields.referenceAnswer),
        learningObjective: translateText(fields.learningObjective),
        followUps: translatedFollowUps,
        rubric: translatedRubric,
      },
      warnings: [],
      provider: 'mock',
      model: 'mock-bilingual-translator-v1',
    };
  }
}
