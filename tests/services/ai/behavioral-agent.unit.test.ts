import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import {
  BehavioralAgent,
  BEHAVIORAL_SYSTEM,
  validateBehavioralOutput,
} from '../../../src/services/ai/multi-agent/BehavioralAgent';
import type { MultiAgentEvaluationInput } from '../../../src/services/ai/multi-agent/types';
import type { IAiProvider } from '../../../src/domain/interview/types';

describe('BehavioralAgent (Micro-Task 2.4)', () => {
  const mockInput: MultiAgentEvaluationInput = {
    sessionId: 'sess-behav-123',
    role: 'Lead Developer',
    level: 'Senior',
    technologies: ['React', 'NodeJS'],
    questions: [
      {
        order: 1,
        category: 'Behavioral',
        difficulty: 'Medium',
        content: {
          vi: 'Hãy kể về một lần bạn xử lý xung đột kỹ thuật gay gắt trong team phát triển?',
          en: 'Tell about a time you resolved a heated technical dispute in your team?',
        },
      },
    ],
    answers: [
      {
        order: 1,
        candidateAnswer: 'Tình huống: Hai senior dev bất đồng về việc chọn REST hay GraphQL. Nhiệm vụ: Tôi là lead cần đưa ra quyết định dựa trên dữ liệu. Hành động: Tôi tổ chức benchmark POC cả hai phương án trong 2 ngày, đánh giá theo tiêu chí caching và bandwidth. Kết quả: Cả team đồng thuận dùng REST cho mobile và GraphQL cho internal dashboard.',
      },
    ],
    conversationHistory: [
      {
        questionId: 'q-1',
        turnIndex: 1,
        role: 'INTERVIEWER',
        type: 'FOLLOW_UP',
        content: {
          vi: 'Nếu một thành viên vẫn tỏ thái độ bất mãn sau quyết định thì bạn xử lý thế nào?',
          en: 'What if one member still felt dissatisfied after the decision?',
        },
      },
      {
        questionId: 'q-1',
        turnIndex: 2,
        role: 'CANDIDATE',
        type: 'ANSWER',
        content: {
          vi: 'Tôi sẽ có buổi 1-on-1 riêng lắng nghe cảm xúc, ghi nhận đóng góp và giao quyền sở hữu phần kiến trúc mà họ đam mê.',
          en: 'I would hold a private 1-on-1 to listen, acknowledge contributions and delegate ownership of modules they are passionate about.',
        },
      },
    ],
  };

  describe('buildPrompt', () => {
    it('should generate structured prompt containing BEHAVIORAL_SYSTEM and escaped content', () => {
      const agent = new BehavioralAgent();
      const prompt = agent.buildPrompt(mockInput);

      expect(prompt.systemInstruction).toBe(BEHAVIORAL_SYSTEM);
      expect(prompt.userContent).toContain('<UNTRUSTED_USER_CONTENT');
      expect(prompt.userContent).toContain('Lead Developer');
      expect(prompt.userContent).toContain('1-on-1');
    });
  });

  describe('validateBehavioralOutput', () => {
    it('should validate and return PersonaEvaluation with BEHAVIORAL role', () => {
      const rawOutput = {
        role: 'BEHAVIORAL',
        score: 9.2,
        strengths: [
          {
            vi: 'Cấu trúc câu trả lời theo chuẩn STAR rất rõ ràng, tư duy giải quyết xung đột bằng dữ liệu (data-driven).',
            en: 'Crystal clear STAR structure, data-driven conflict resolution approach.',
          },
        ],
        weaknesses: [
          {
            vi: 'Nên chia sẻ thêm về phương pháp đo lường tinh thần đồng đội sau buổi 1-on-1.',
            en: 'Should share more on measuring team morale post 1-on-1.',
          },
        ],
        specificFeedback: {
          vi: 'Ứng viên có kỹ năng lãnh đạo thấu cảm, khả năng tiếp thu và mở rộng gợi ý xuất sắc.',
          en: 'Candidate demonstrates empathetic leadership and outstanding coachability.',
        },
        dimensionScores: {
          'Communication Clarity': 9.5,
          'STAR Structuring': 9.5,
          'Problem Solving Mindset': 9.0,
          'Coachability & Guidance Acceptance': 9.0,
        },
      };

      const result = validateBehavioralOutput(rawOutput);
      expect(result.role).toBe('BEHAVIORAL');
      expect(result.score).toBe(9.2);
      expect(result.dimensionScores['STAR Structuring']).toBe(9.5);
    });

    it('should reject invalid role or invalid score range', () => {
      const invalid = {
        role: 'JUDGE', // Wrong role
        score: 9.0,
        strengths: [],
        weaknesses: [],
        specificFeedback: { vi: 'a', en: 'b' },
        dimensionScores: {},
      };

      expect(() => validateBehavioralOutput(invalid)).toThrow();
    });
  });

  describe('evaluate', () => {
    it('should call aiProvider.evaluatePersona and return validated PersonaEvaluation', async () => {
      const mockAiProvider: IAiProvider = {
        generateQuestions: vi.fn(),
        evaluateAnswers: vi.fn(),
        evaluatePersona: vi.fn().mockResolvedValue({
          data: {
            role: 'BEHAVIORAL',
            score: 8.8,
            strengths: [{ vi: 'Giao tiếp tốt', en: 'Good communication' }],
            weaknesses: [{ vi: 'Cần nhấn mạnh kết quả', en: 'Emphasize results' }],
            specificFeedback: { vi: 'Rõ ràng', en: 'Clear' },
            dimensionScores: { 'Communication Clarity': 9.0 },
          },
          audit: { promptTokenCount: 110, candidatesTokenCount: 190, totalTokenCount: 300 },
        }),
      };

      const agent = new BehavioralAgent(mockAiProvider);
      const evaluation = await agent.evaluate(mockInput);

      expect(evaluation.role).toBe('BEHAVIORAL');
      expect(evaluation.score).toBe(8.8);
      expect(mockAiProvider.evaluatePersona).toHaveBeenCalled();
    });
  });
});
