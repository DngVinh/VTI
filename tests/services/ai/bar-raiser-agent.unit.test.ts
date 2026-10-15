import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import {
  BarRaiserAgent,
  BAR_RAISER_SYSTEM,
  validateBarRaiserOutput,
} from '../../../src/services/ai/multi-agent/BarRaiserAgent';
import type { MultiAgentEvaluationInput } from '../../../src/services/ai/multi-agent/types';
import type { IAiProvider } from '../../../src/domain/interview/types';

describe('BarRaiserAgent (Micro-Task 2.3)', () => {
  const mockInput: MultiAgentEvaluationInput = {
    sessionId: 'sess-bar-123',
    role: 'Security Engineer',
    level: 'Senior',
    technologies: ['NodeJS', 'TypeScript', 'Docker'],
    questions: [
      {
        order: 1,
        category: 'Security',
        difficulty: 'Hard',
        content: {
          vi: 'Làm thế nào ngăn chặn triệt để SQL Injection và XSS trong ứng dụng ExpressJS?',
          en: 'How to thoroughly prevent SQL Injection and XSS in ExpressJS apps?',
        },
      },
    ],
    answers: [
      {
        order: 1,
        candidateAnswer: 'Sử dụng ORM Prisma/TypeORM với parameterized queries. Thêm Helmet headers và sanitize input bằng DOMPurify/validator.',
      },
    ],
    conversationHistory: [
      {
        questionId: 'q-1',
        turnIndex: 1,
        role: 'INTERVIEWER',
        type: 'FOLLOW_UP',
        content: {
          vi: 'Nếu có dữ liệu HTML phong phú (Rich Text) do người dùng gửi thì xử lý XSS ra sao?',
          en: 'If rich text HTML is submitted by user, how to handle XSS?',
        },
      },
      {
        questionId: 'q-1',
        turnIndex: 2,
        role: 'CANDIDATE',
        type: 'ANSWER',
        content: {
          vi: 'Sử dụng sanitize-html hoặc DOMPurify server-side với whitelist tags/attributes nghiêm ngặt, kết hợp CSP header.',
          en: 'Use sanitize-html or DOMPurify server-side with strict whitelist, plus CSP header.',
        },
      },
    ],
  };

  describe('buildPrompt', () => {
    it('should generate structured prompt containing BAR_RAISER_SYSTEM and escaped content', () => {
      const agent = new BarRaiserAgent();
      const prompt = agent.buildPrompt(mockInput);

      expect(prompt.systemInstruction).toBe(BAR_RAISER_SYSTEM);
      expect(prompt.userContent).toContain('<UNTRUSTED_USER_CONTENT');
      expect(prompt.userContent).toContain('Security Engineer');
      expect(prompt.userContent).toContain('DOMPurify');
    });
  });

  describe('validateBarRaiserOutput', () => {
    it('should validate and return PersonaEvaluation with BAR_RAISER role', () => {
      const rawOutput = {
        role: 'BAR_RAISER',
        score: 9.0,
        strengths: [
          {
            vi: 'Nắm vững kỹ thuật phòng vệ theo chiều sâu (Defense-in-Depth) với CSP và DOMPurify.',
            en: 'Solid Defense-in-Depth mindset with CSP and DOMPurify.',
          },
        ],
        weaknesses: [
          {
            vi: 'Chưa đề cập đến SSR hydration attacks với rich text.',
            en: 'Did not mention SSR hydration attacks with rich text.',
          },
        ],
        specificFeedback: {
          vi: 'Ứng viên có tư duy bảo mật chủ động và xử lý rất tốt các tình huống lỗ hổng web.',
          en: 'Candidate demonstrates proactive security mindset and handles web vulnerabilities well.',
        },
        dimensionScores: {
          'Security Awareness': 9.5,
          'Edge Case Robustness': 8.5,
          'Fault Tolerance & Recovery': 9.0,
          'Validation Completeness': 9.0,
        },
      };

      const result = validateBarRaiserOutput(rawOutput);
      expect(result.role).toBe('BAR_RAISER');
      expect(result.score).toBe(9.0);
      expect(result.dimensionScores['Security Awareness']).toBe(9.5);
    });

    it('should reject invalid role or invalid score range', () => {
      const invalid = {
        role: 'TECH_LEAD', // Wrong role
        score: 9.0,
        strengths: [],
        weaknesses: [],
        specificFeedback: { vi: 'a', en: 'b' },
        dimensionScores: {},
      };

      expect(() => validateBarRaiserOutput(invalid)).toThrow();
    });
  });

  describe('evaluate', () => {
    it('should call aiProvider.evaluatePersona and return validated PersonaEvaluation', async () => {
      const mockAiProvider: IAiProvider = {
        generateQuestions: vi.fn(),
        evaluateAnswers: vi.fn(),
        evaluatePersona: vi.fn().mockResolvedValue({
          data: {
            role: 'BAR_RAISER',
            score: 8.5,
            strengths: [{ vi: 'Bảo mật tốt', en: 'Good security' }],
            weaknesses: [{ vi: 'Cần chú ý edge cases', en: 'Watch edge cases' }],
            specificFeedback: { vi: 'Chi tiết', en: 'Detailed' },
            dimensionScores: { 'Security Awareness': 9.0 },
          },
          audit: { promptTokenCount: 120, candidatesTokenCount: 180, totalTokenCount: 300 },
        }),
      };

      const agent = new BarRaiserAgent(mockAiProvider);
      const evaluation = await agent.evaluate(mockInput);

      expect(evaluation.role).toBe('BAR_RAISER');
      expect(evaluation.score).toBe(8.5);
      expect(mockAiProvider.evaluatePersona).toHaveBeenCalled();
    });
  });
});
