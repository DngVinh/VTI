import { injectable } from 'tsyringe';
import { IAiProvider, InterviewSetupPayload, AnswerPayload, LocalizedContent, SystemPromptContext } from '../../../domain/interview/types';
import { logger } from '../../../infrastructure/logging/logger';
import {
  DIMENSIONS,
  EvaluationQuestion,
  generationPrompt,
  evaluationPrompt,
  validateGeneration,
  validateEvaluation,
} from '../prompt-security';

@injectable()
export class MockAiProvider implements IAiProvider {
  async generateQuestions(setupData: InterviewSetupPayload) {
    generationPrompt(setupData);
    logger.info('ai.generating');
    const content = [
      { en: 'What is a variable?', vi: 'Biến là gì?' },
      { en: 'Explain closure in JavaScript.', vi: 'Giải thích closure trong JavaScript.' },
      { en: 'Compare let and const.', vi: 'So sánh let và const.' },
      { en: 'Explain the event loop.', vi: 'Giải thích event loop.' },
      { en: 'How does prototypal inheritance work?', vi: 'Kế thừa nguyên mẫu hoạt động như thế nào?' },
    ];
    const data = validateGeneration(content.map((text, index) => ({
      order: index + 1,
      difficulty: ['Easy', 'Medium', 'Medium', 'Hard', 'Hard'][index],
      category: 'Language fundamentals',
      content: text,
    })));
    return {
      data,
      audit: { promptTokenCount: 10, candidatesTokenCount: 50, totalTokenCount: 60 },
    };
  }

  async evaluateAnswers(questions: EvaluationQuestion[], answers: AnswerPayload[]) {
    const prompt = evaluationPrompt(questions, answers);
    logger.info('ai.evaluating');
    const data = validateEvaluation({
      evaluations: prompt.questions.map((question) => ({
        questionId: question.id,
        score: 8,
        feedback: {
          en: 'Explain the technical tradeoffs in more detail.',
          vi: 'Giải thích kỹ hơn về các đánh đổi kỹ thuật.',
        },
      })),
      overallScore: 8,
      dimensions: DIMENSIONS.slice(0, 4).map((name) => ({
        name,
        score: 8,
        reasoning: 'Demonstrates technical understanding.',
      })),
      learningPath: [{
        topic: { en: 'Language fundamentals', vi: 'Kiến thức ngôn ngữ' },
        priority: 'Medium',
        suggestion: {
          en: 'Practice with small examples.',
          vi: 'Luyện tập với các ví dụ nhỏ.',
        },
      }],
    }, prompt.questions, prompt.answers);
    return {
      data,
      audit: { promptTokenCount: 20, candidatesTokenCount: 100, totalTokenCount: 120 },
    };
  }

  async generateFollowUp(
    originalQuestion: LocalizedContent,
    candidateAnswer: string,
    history: Array<{ role: string; content: string }>,
    systemPrompt?: SystemPromptContext
  ) {
    logger.info('ai.generating');
    const isShort = candidateAnswer.trim().length < 50;
    const shouldFollowUp = isShort;
    return {
      data: {
        shouldFollowUp,
        followUpQuestion: shouldFollowUp ? {
          vi: 'Bạn có thể giải thích chi tiết hơn về cơ chế hoạt động thực tế không?',
          en: 'Can you explain in more detail about how it works under the hood?',
        } : undefined,
        gapAnalysis: shouldFollowUp ? ['Thiếu chi tiết kỹ thuật chuyên sâu.'] : [],
        difficultyAdjustment: 'SAME' as const,
        confidenceScore: 0.85,
        summary: {
          vi: shouldFollowUp ? 'Câu trả lời chưa đủ chi tiết kỹ thuật.' : 'Câu trả lời đầy đủ và đạt yêu cầu.',
          en: shouldFollowUp ? 'Answer lacks in-depth technical details.' : 'Answer is comprehensive and meets requirements.',
        },
      },
      audit: { promptTokenCount: 15, candidatesTokenCount: 35, totalTokenCount: 50 },
    };
  }
}

