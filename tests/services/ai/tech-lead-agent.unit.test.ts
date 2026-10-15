import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import {
  TechLeadAgent,
  TECH_LEAD_SYSTEM,
  validateTechLeadOutput,
} from '../../../src/services/ai/multi-agent/TechLeadAgent';
import type { MultiAgentEvaluationInput } from '../../../src/services/ai/multi-agent/types';
import type { IAiProvider } from '../../../src/domain/interview/types';

describe('TechLeadAgent (Micro-Task 2.2)', () => {
  const mockInput: MultiAgentEvaluationInput = {
    sessionId: 'sess-123',
    role: 'Backend Architect',
    level: 'Senior',
    technologies: ['NodeJS', 'PostgreSQL', 'Redis'],
    questions: [
      {
        order: 1,
        category: 'Architecture',
        difficulty: 'Hard',
        content: {
          vi: 'Thiết kế hệ thống chịu tải 100k RPS cho flash sale?',
          en: 'Design a system handling 100k RPS for flash sale?',
        },
      },
    ],
    answers: [
      {
        order: 1,
        candidateAnswer: 'Sử dụng Redis cache layer, message queue RabbitMQ để buffer đơn hàng, và optimistic locking trong PostgreSQL.',
      },
    ],
    conversationHistory: [
      {
        questionId: 'q-1',
        turnIndex: 1,
        role: 'INTERVIEWER',
        type: 'FOLLOW_UP',
        content: {
          vi: 'Nếu Redis cache bị crash đột ngột thì hệ thống xử lý thế nào?',
          en: 'What if Redis cache crashes suddenly?',
        },
      },
      {
        questionId: 'q-1',
        turnIndex: 2,
        role: 'CANDIDATE',
        type: 'ANSWER',
        content: {
          vi: 'Có Redis Sentinel/Cluster HA dự phòng và circuit breaker ngăn tháo van dồn trực tiếp vào DB.',
          en: 'Use Redis Sentinel/Cluster HA and circuit breaker to prevent DB thundering herd.',
        },
      },
    ],
  };

  describe('buildPrompt', () => {
    it('should generate a structured prompt containing TECH_LEAD_SYSTEM and escaped user input', () => {
      const agent = new TechLeadAgent();
      const prompt = agent.buildPrompt(mockInput);

      expect(prompt.systemInstruction).toBe(TECH_LEAD_SYSTEM);
      expect(prompt.userContent).toContain('<UNTRUSTED_USER_CONTENT');
      expect(prompt.userContent).toContain('Backend Architect');
      expect(prompt.userContent).toContain('Redis Sentinel/Cluster');
    });
  });

  describe('validateTechLeadOutput', () => {
    it('should validate and return PersonaEvaluation with TECH_LEAD role', () => {
      const rawOutput = {
        role: 'TECH_LEAD',
        score: 8.8,
        strengths: [
          {
            vi: 'Tư duy kiến trúc phân tán rất tốt với Redis và message queue.',
            en: 'Great distributed architecture thinking with Redis and message queue.',
          },
        ],
        weaknesses: [
          {
            vi: 'Chưa tính đến chi tiết sharding database khi dữ liệu vượt ngưỡng PB.',
            en: 'Did not detail database sharding when data exceeds PB scale.',
          },
        ],
        specificFeedback: {
          vi: 'Ứng viên thể hiện năng lực kiến trúc vững chắc, xử lý tốt tình huống cache crash.',
          en: 'Candidate demonstrates strong architecture capability, handles cache crash well.',
        },
        dimensionScores: {
          'Architecture & Design': 9,
          'Code Quality & Clean Architecture': 8.5,
          'Scalability & Performance': 9,
          'Technical Depth': 8.5,
        },
      };

      const result = validateTechLeadOutput(rawOutput);
      expect(result.role).toBe('TECH_LEAD');
      expect(result.score).toBe(8.8);
      expect(result.dimensionScores['Architecture & Design']).toBe(9);
    });

    it('should reject invalid role or invalid score range', () => {
      const invalid = {
        role: 'BAR_RAISER', // Invalid role for Tech Lead
        score: 11, // Out of range
        strengths: [],
        weaknesses: [],
        specificFeedback: { vi: 'a', en: 'b' },
        dimensionScores: {},
      };

      expect(() => validateTechLeadOutput(invalid)).toThrow();
    });
  });

  describe('evaluate', () => {
    it('should call aiProvider and return validated PersonaEvaluation', async () => {
      const mockAiProvider: IAiProvider = {
        generateEvaluationPrompt: vi.fn(),
        generateQuestions: vi.fn(),
        evaluateSafely: vi.fn(),
        generateFollowUp: vi.fn(),
      };

      const fakeOutput = {
        role: 'TECH_LEAD',
        score: 8.0,
        strengths: [{ vi: 'Tốt', en: 'Good' }],
        weaknesses: [{ vi: 'Cần cải thiện', en: 'Needs improvement' }],
        specificFeedback: { vi: 'Chi tiết', en: 'Detailed' },
        dimensionScores: { 'Architecture & Design': 8 },
      };

      // Mock evaluatePersona
      mockAiProvider.evaluatePersona = vi.fn().mockResolvedValue({
        data: fakeOutput,
        audit: { promptTokenCount: 100, candidatesTokenCount: 200, totalTokenCount: 300 },
      });

      const agent = new TechLeadAgent(mockAiProvider);
      const evaluation = await agent.evaluate(mockInput);

      expect(evaluation.role).toBe('TECH_LEAD');
      expect(evaluation.score).toBe(8.0);
      expect(mockAiProvider.evaluatePersona).toHaveBeenCalled();
    });
  });
});
