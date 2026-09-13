import { injectable } from 'tsyringe';
import { QuestionBankDomainError } from '../../domain/question-bank/errors';
import { AiDraftSpec, GeneratedQuestionDraft } from '../../domain/question-bank/types';
import { IAiQuestionDraftProvider } from '../interfaces/IAiQuestionDraftProvider';

export type MockAiScenario =
  | 'SUCCESS'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'INVALID_SCHEMA';

@injectable()
export class MockAiQuestionDraftProvider implements IAiQuestionDraftProvider {
  private scenario: MockAiScenario = 'SUCCESS';

  setScenario(scenario: MockAiScenario): void {
    this.scenario = scenario;
  }

  getScenario(): MockAiScenario {
    return this.scenario;
  }

  async generateDraft(spec: AiDraftSpec): Promise<GeneratedQuestionDraft> {
    switch (this.scenario) {
      case 'TIMEOUT':
        throw new QuestionBankDomainError(
          'AI_PROVIDER_TIMEOUT',
          'Yêu cầu tạo câu hỏi bằng AI đã quá thời gian phản hồi (timeout)'
        );
      case 'RATE_LIMIT':
        throw new QuestionBankDomainError(
          'AI_PROVIDER_RATE_LIMIT',
          'Vượt quá giới hạn gọi dịch vụ AI (rate limit). Vui lòng thử lại sau.'
        );
      case 'SERVER_ERROR':
        throw new QuestionBankDomainError(
          'AI_PROVIDER_ERROR',
          'Dịch vụ AI gặp lỗi nội bộ không thể xử lý yêu cầu lúc này'
        );
      case 'INVALID_SCHEMA':
        throw new QuestionBankDomainError(
          'AI_PROVIDER_SCHEMA_ERROR',
          'Phản hồi từ AI không đúng cấu trúc schema yêu cầu'
        );
      case 'SUCCESS':
      default:
        return this.buildDeterministicDraft(spec);
    }
  }

  private buildDeterministicDraft(spec: AiDraftSpec): GeneratedQuestionDraft {
    const topic = spec.topic.trim();
    const promptVi = `Trình bày hiểu biết của bạn về chủ đề: ${topic}. Nêu ví dụ thực tế và các lưu ý khi triển khai trong dự án.`;
    const promptEn = `Explain your understanding of: ${topic}. Provide practical examples and key considerations when implementing in production.`;

    const answerVi = `Phân tích chi tiết về ${topic}: nguyên lý hoạt động, ưu nhược điểm, best practices và các trường hợp sử dụng phù hợp.`;
    const answerEn = `Detailed analysis of ${topic}: working principles, pros and cons, best practices, and appropriate use cases.`;

    return {
      prompt: {
        vi: spec.language === 'en' ? null : promptVi,
        en: spec.language === 'vi' ? null : promptEn,
      },
      explanation: {
        vi: `Câu hỏi đánh giá mức độ am hiểu về ${topic} ở độ khó ${spec.difficulty}.`,
        en: `Question assessing comprehension of ${topic} at ${spec.difficulty} level.`,
      },
      referenceAnswer: {
        vi: spec.language === 'en' ? null : answerVi,
        en: spec.language === 'vi' ? null : answerEn,
      },
      learningObjective: {
        vi: `Nắm vững lý thuyết và thực hành liên quan đến ${topic}.`,
        en: `Master core concepts and practical patterns regarding ${topic}.`,
      },
      estimatedTimeSeconds: 300,
      followUps: [
        {
          vi: `Những cạm bẫy (pitfalls) phổ biến khi áp dụng ${topic} là gì?`,
          en: `What are common pitfalls when applying ${topic}?`,
        },
      ],
      rubric: [
        {
          key: 'technical-knowledge',
          title: {
            vi: 'Kiến thức kỹ thuật',
            en: 'Technical knowledge',
          },
          description: {
            vi: 'Độ chính xác và chiều sâu của kiến thức',
            en: 'Accuracy and depth of technical understanding',
          },
          weight: 60,
          levels: [
            {
              score: 0,
              description: {
                vi: 'Không trả lời được hoặc sai lệch hoàn toàn',
                en: 'Unable to answer or completely incorrect',
              },
            },
            {
              score: 2,
              description: {
                vi: 'Hiểu được khái niệm cơ bản nhưng thiếu ví dụ',
                en: 'Understands basic concepts but lacks concrete examples',
              },
            },
            {
              score: 4,
              description: {
                vi: 'Hiểu sâu sắc, giải thích rõ ràng và có ví dụ thực tế',
                en: 'Deep understanding, explains clearly with real-world examples',
              },
            },
          ],
        },
        {
          key: 'problem-solving',
          title: {
            vi: 'Khả năng giải quyết vấn đề',
            en: 'Problem solving',
          },
          description: {
            vi: 'Tư duy phân tích và tiếp cận giải pháp',
            en: 'Analytical thinking and solution approach',
          },
          weight: 40,
          levels: [
            {
              score: 0,
              description: {
                vi: 'Chưa có phương pháp giải quyết phù hợp',
                en: 'No appropriate solution approach',
              },
            },
            {
              score: 2,
              description: {
                vi: 'Đề xuất giải pháp khả thi ở mức cơ bản',
                en: 'Proposes viable solution at basic level',
              },
            },
            {
              score: 4,
              description: {
                vi: 'Đề xuất giải pháp tối ưu, tính đến hiệu năng và mở rộng',
                en: 'Proposes optimal solution, considering scale and performance',
              },
            },
          ],
        },
      ],
      topic,
      tags: [
        topic
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'ai-generated',
      ],
    };
  }
}
