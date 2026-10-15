import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import {
  JudgeAgent,
  JUDGE_SYSTEM,
  validateJudgeOutput,
} from '../../../src/services/ai/multi-agent/JudgeAgent';
import type {
  MultiAgentEvaluationInput,
  PersonaEvaluation,
  ConsensusReport,
} from '../../../src/services/ai/multi-agent/types';
import type { IAiProvider } from '../../../src/domain/interview/types';

describe('JudgeAgent (Micro-Task 2.5)', () => {
  const mockContext: MultiAgentEvaluationInput = {
    sessionId: 'sess-judge-123',
    role: 'Senior Backend Developer',
    level: 'Senior',
    technologies: ['NodeJS', 'PostgreSQL'],
    questions: [
      {
        order: 1,
        category: 'Database',
        difficulty: 'Hard',
        content: { vi: 'Câu hỏi DB', en: 'DB Question' },
      },
    ],
    answers: [
      {
        order: 1,
        candidateAnswer: 'Sử dụng index btree và read replica.',
      },
    ],
  };

  const mockTechLead: PersonaEvaluation = {
    role: 'TECH_LEAD',
    score: 9.0,
    strengths: [{ vi: 'Kiến trúc tốt', en: 'Good architecture' }],
    weaknesses: [{ vi: 'Thiếu sharding', en: 'Missing sharding' }],
    specificFeedback: { vi: 'Xuất sắc', en: 'Excellent' },
    dimensionScores: { 'Architecture & Design': 9.0, 'Technical Depth': 9.0 },
  };

  const mockBarRaiser: PersonaEvaluation = {
    role: 'BAR_RAISER',
    score: 5.0, // Variance = 4.0 (> 3.0 threshold)
    strengths: [{ vi: 'Biết dùng index', en: 'Knows indexing' }],
    weaknesses: [{ vi: 'Bỏ qua SQL injection ở câu raw query', en: 'Ignored SQL injection in raw query' }],
    specificFeedback: { vi: 'Rủi ro bảo mật nghiêm trọng', en: 'Critical security risk' },
    dimensionScores: { 'Security Awareness': 4.0, 'Edge Case Robustness': 6.0 },
  };

  const mockBehavioral: PersonaEvaluation = {
    role: 'BEHAVIORAL',
    score: 8.5,
    strengths: [{ vi: 'Giao tiếp rõ ràng', en: 'Clear communication' }],
    weaknesses: [{ vi: 'Chưa có ví dụ cụ thể', en: 'Lacks concrete examples' }],
    specificFeedback: { vi: 'Tốt', en: 'Good' },
    dimensionScores: { 'Communication Clarity': 8.5 },
  };

  describe('buildPrompt', () => {
    it('should generate structured prompt with JUDGE_SYSTEM and all persona feedback', () => {
      const judge = new JudgeAgent();
      const prompt = judge.buildPrompt({
        evaluations: {
          techLead: mockTechLead,
          barRaiser: mockBarRaiser,
          behavioral: mockBehavioral,
        },
        context: mockContext,
      });

      expect(prompt.systemInstruction).toBe(JUDGE_SYSTEM);
      expect(prompt.userContent).toContain('TECH_LEAD');
      expect(prompt.userContent).toContain('BAR_RAISER');
      expect(prompt.userContent).toContain('BEHAVIORAL');
      expect(prompt.userContent).toContain('SQL injection');
    });
  });

  describe('detectLocalVariance', () => {
    it('should identify variance > 3.0 between agent scores', () => {
      const judge = new JudgeAgent();
      const flags = judge.detectLocalVariance([mockTechLead, mockBarRaiser, mockBehavioral]);

      expect(flags.length).toBeGreaterThan(0);
      expect(flags[0].variance).toBe(4.0);
      expect(flags[0].dimension).toContain('Score Variance');
    });
  });

  describe('validateJudgeOutput', () => {
    it('should validate complete ConsensusReport', () => {
      const validReport: ConsensusReport = {
        finalOverallScore: 7.5,
        personaBreakdown: [mockTechLead, mockBarRaiser, mockBehavioral],
        varianceFlags: [
          {
            dimension: 'Security vs Architecture',
            variance: 4.0,
            arbiterResolution: {
              vi: 'Tech Lead đánh giá cao giải pháp tối ưu nhưng Bar Raiser phát hiện lỗi injection. Trọng tài quyết định trừ điểm bảo mật nhưng ghi nhận năng lực kiến trúc.',
              en: 'Tech Lead rated architecture high but Bar Raiser identified injection bug. Arbiter penalizes security while recognizing architecture skill.',
            },
          },
        ],
        calibratedDimensions: [
          {
            name: 'Technical Accuracy & Architecture',
            score: 8.5,
            reasoning: 'Nắm vững index và replica, tuy nhiên cần cải thiện kiến thức query sanitization.',
          },
        ],
        learningPath: [
          {
            topic: { vi: 'Bảo mật SQL Injection trong NodeJS', en: 'SQL Injection Prevention in NodeJS' },
            priority: 'High',
            suggestion: {
              vi: 'Thực hành viết parameterized query và sử dụng ORM an toàn.',
              en: 'Practice writing parameterized queries and using safe ORMs.',
            },
          },
        ],
      };

      const result = validateJudgeOutput(validReport);
      expect(result.finalOverallScore).toBe(7.5);
      expect(result.varianceFlags.length).toBe(1);
    });
  });

  describe('arbitrate', () => {
    it('should call aiProvider and produce finalized ConsensusReport', async () => {
      const mockReport: ConsensusReport = {
        finalOverallScore: 7.8,
        personaBreakdown: [mockTechLead, mockBarRaiser],
        varianceFlags: [],
        calibratedDimensions: [
          { name: 'Core Skill', score: 8.0, reasoning: 'Đồng thuận đa số.' },
        ],
        learningPath: [
          {
            topic: { vi: 'Chủ đề', en: 'Topic' },
            priority: 'Medium',
            suggestion: { vi: 'Học tập', en: 'Study' },
          },
        ],
      };

      const mockAiProvider: IAiProvider = {
        generateQuestions: vi.fn(),
        evaluateAnswers: vi.fn(),
        evaluatePersona: vi.fn().mockResolvedValue({
          data: mockReport,
          audit: { promptTokenCount: 200, candidatesTokenCount: 300, totalTokenCount: 500 },
        }),
      };

      const judge = new JudgeAgent(mockAiProvider);
      const report = await judge.arbitrate(
        {
          evaluations: { techLead: mockTechLead, barRaiser: mockBarRaiser },
          context: mockContext,
        }
      );

      expect(report.finalOverallScore).toBe(7.8);
      expect(mockAiProvider.evaluatePersona).toHaveBeenCalled();
    });
  });
});
