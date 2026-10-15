import { describe, it, expect } from 'vitest';
import {
  personaEvaluationSchema,
  consensusReportSchema,
  multiAgentEvaluationInputSchema,
  type PersonaEvaluation,
  type ConsensusReport,
  type MultiAgentEvaluationInput,
} from '../../../src/services/ai/multi-agent/types';

describe('Multi-Agent Evaluation Types & Schemas (Micro-Task 2.1)', () => {
  describe('personaEvaluationSchema', () => {
    it('should validate a valid PersonaEvaluation object', () => {
      const validPersona: PersonaEvaluation = {
        role: 'TECH_LEAD',
        score: 8.5,
        strengths: [
          { vi: 'Kiến trúc module sạch sẽ', en: 'Clean modular architecture' },
        ],
        weaknesses: [
          { vi: 'Chưa tối ưu hóa indexing database', en: 'Database indexing not optimized' },
        ],
        specificFeedback: {
          vi: 'Ứng viên nắm chắc kiến trúc phân lớp, nhưng cần chú ý query performance.',
          en: 'Candidate has strong layered architecture grasp, but should watch query performance.',
        },
        dimensionScores: {
          'Architecture & Design': 9,
          'Code Quality & Clean Architecture': 8,
          'Scalability & Performance': 8,
          'Technical Depth': 9,
        },
      };

      const parsed = personaEvaluationSchema.safeParse(validPersona);
      expect(parsed.success).toBe(true);
    });

    it('should reject score less than 0 or greater than 10', () => {
      const invalidLow = {
        role: 'BAR_RAISER',
        score: -0.5,
        strengths: [],
        weaknesses: [],
        specificFeedback: { vi: 'Kém', en: 'Poor' },
        dimensionScores: {},
      };
      expect(personaEvaluationSchema.safeParse(invalidLow).success).toBe(false);

      const invalidHigh = {
        role: 'BAR_RAISER',
        score: 10.5,
        strengths: [],
        weaknesses: [],
        specificFeedback: { vi: 'Quá cao', en: 'Too high' },
        dimensionScores: {},
      };
      expect(personaEvaluationSchema.safeParse(invalidHigh).success).toBe(false);
    });

    it('should reject missing Vietnamese translation in specificFeedback', () => {
      const missingVi = {
        role: 'BEHAVIORAL',
        score: 7,
        strengths: [],
        weaknesses: [],
        specificFeedback: { en: 'Good communication' },
        dimensionScores: {},
      };
      expect(personaEvaluationSchema.safeParse(missingVi).success).toBe(false);
    });
  });

  describe('consensusReportSchema', () => {
    it('should validate a valid ConsensusReport object', () => {
      const validConsensus: ConsensusReport = {
        finalOverallScore: 8.2,
        personaBreakdown: [
          {
            role: 'TECH_LEAD',
            score: 8.5,
            strengths: [{ vi: 'Clean code', en: 'Clean code' }],
            weaknesses: [{ vi: 'Thiếu cache', en: 'Missing cache' }],
            specificFeedback: { vi: 'Tốt', en: 'Good' },
            dimensionScores: { 'Tech Depth': 8.5 },
          },
        ],
        varianceFlags: [
          {
            dimension: 'Security Awareness',
            variance: 3.5,
            arbiterResolution: {
              vi: 'Bar Raiser phát hiện lỗ hổng injection trong câu 2, đồng thuận trừ điểm.',
              en: 'Bar Raiser detected injection vulnerability in question 2, consensus to penalize.',
            },
          },
        ],
        calibratedDimensions: [
          {
            name: 'Technical Accuracy',
            score: 8.0,
            reasoning: 'Hội đồng đồng thuận mức 8 điểm sau khi cân nhắc lỗi bảo mật nhẹ.',
          },
        ],
        learningPath: [
          {
            topic: { en: 'Web Security OWASP', vi: 'Bảo mật Web OWASP' },
            priority: 'High',
            suggestion: {
              en: 'Study input validation and parameterized queries.',
              vi: 'Học kỹ thuật validate input và parameterized query.',
            },
          },
        ],
      };

      const parsed = consensusReportSchema.safeParse(validConsensus);
      expect(parsed.success).toBe(true);
    });

    it('should reject invalid priority in learningPath', () => {
      const invalidReport = {
        finalOverallScore: 7,
        personaBreakdown: [],
        varianceFlags: [],
        calibratedDimensions: [],
        learningPath: [
          {
            topic: { en: 'Git', vi: 'Git' },
            priority: 'Critical', // Invalid enum
            suggestion: { en: 'Rebase', vi: 'Rebase' },
          },
        ],
      };
      expect(consensusReportSchema.safeParse(invalidReport).success).toBe(false);
    });
  });

  describe('multiAgentEvaluationInputSchema', () => {
    it('should validate a complete evaluation input', () => {
      const input: MultiAgentEvaluationInput = {
        sessionId: 'session-123',
        role: 'Fullstack Developer',
        level: 'Senior',
        technologies: ['TypeScript', 'Node.js'],
        questions: [
          {
            order: 1,
            category: 'Architecture',
            difficulty: 'Hard',
            content: { vi: 'Câu hỏi kiến trúc', en: 'Architecture question' },
          },
        ],
        answers: [
          {
            order: 1,
            candidateAnswer: 'Sử dụng Clean Architecture với dependency injection.',
          },
        ],
        conversationHistory: [
          {
            questionId: 'q-1',
            turnIndex: 0,
            role: 'CANDIDATE',
            type: 'ANSWER',
            content: { vi: 'Trả lời ban đầu', en: 'Initial answer' },
          },
        ],
      };

      const parsed = multiAgentEvaluationInputSchema.safeParse(input);
      expect(parsed.success).toBe(true);
    });
  });
});
