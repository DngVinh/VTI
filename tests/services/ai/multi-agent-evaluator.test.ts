import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { MultiAgentEvaluator } from '../../../src/services/ai/multi-agent/MultiAgentEvaluator';
import { TechLeadAgent } from '../../../src/services/ai/multi-agent/TechLeadAgent';
import { BarRaiserAgent } from '../../../src/services/ai/multi-agent/BarRaiserAgent';
import { BehavioralAgent } from '../../../src/services/ai/multi-agent/BehavioralAgent';
import { JudgeAgent } from '../../../src/services/ai/multi-agent/JudgeAgent';
import type {
  MultiAgentEvaluationInput,
  PersonaEvaluation,
  ConsensusReport,
} from '../../../src/services/ai/multi-agent/types';

describe('MultiAgentEvaluator Service (Micro-Task 2.6)', () => {
  const mockInput: MultiAgentEvaluationInput = {
    sessionId: 'session-multi-123',
    role: 'Fullstack Dev',
    level: 'Middle',
    technologies: ['React', 'NodeJS'],
    questions: [
      {
        order: 1,
        category: 'Fullstack',
        difficulty: 'Medium',
        content: { vi: 'Câu hỏi', en: 'Question' },
      },
    ],
    answers: [
      {
        order: 1,
        candidateAnswer: 'Câu trả lời đầy đủ.',
      },
    ],
  };

  const techEval: PersonaEvaluation = {
    role: 'TECH_LEAD',
    score: 8.5,
    strengths: [{ vi: 'Clean code', en: 'Clean code' }],
    weaknesses: [{ vi: 'Thiếu cache', en: 'Missing cache' }],
    specificFeedback: { vi: 'Tốt', en: 'Good' },
    dimensionScores: { 'Architecture & Design': 8.5 },
  };

  const barEval: PersonaEvaluation = {
    role: 'BAR_RAISER',
    score: 8.0,
    strengths: [{ vi: 'Bảo mật tốt', en: 'Good security' }],
    weaknesses: [{ vi: 'Cần rate limit', en: 'Needs rate limit' }],
    specificFeedback: { vi: 'Đạt chuẩn', en: 'Standard' },
    dimensionScores: { 'Security Awareness': 8.0 },
  };

  const behavEval: PersonaEvaluation = {
    role: 'BEHAVIORAL',
    score: 9.0,
    strengths: [{ vi: 'Giao tiếp rõ', en: 'Clear' }],
    weaknesses: [{ vi: 'Không', en: 'None' }],
    specificFeedback: { vi: 'Rất tốt', en: 'Very good' },
    dimensionScores: { 'Communication Clarity': 9.0 },
  };

  const mockConsensus: ConsensusReport = {
    finalOverallScore: 8.4,
    personaBreakdown: [techEval, barEval, behavEval],
    varianceFlags: [],
    calibratedDimensions: [
      { name: 'Architecture & Design', score: 8.5, reasoning: 'Rõ ràng' },
    ],
    learningPath: [
      {
        topic: { vi: 'Caching', en: 'Caching' },
        priority: 'Medium',
        suggestion: { vi: 'Học Redis', en: 'Learn Redis' },
      },
    ],
  };

  it('runs 3 persona agents in parallel and passes results to Judge', async () => {
    const mockTechLead = { evaluate: vi.fn().mockResolvedValue(techEval) } as unknown as TechLeadAgent;
    const mockBarRaiser = { evaluate: vi.fn().mockResolvedValue(barEval) } as unknown as BarRaiserAgent;
    const mockBehavioral = { evaluate: vi.fn().mockResolvedValue(behavEval) } as unknown as BehavioralAgent;
    const mockJudge = {
      arbitrate: vi.fn().mockResolvedValue(mockConsensus),
      detectLocalVariance: vi.fn().mockReturnValue([]),
    } as unknown as JudgeAgent;

    const evaluator = new MultiAgentEvaluator(
      mockTechLead,
      mockBarRaiser,
      mockBehavioral,
      mockJudge
    );

    const result = await evaluator.evaluate(mockInput);

    expect(result.finalOverallScore).toBe(8.4);
    expect(mockTechLead.evaluate).toHaveBeenCalledWith(mockInput);
    expect(mockBarRaiser.evaluate).toHaveBeenCalledWith(mockInput);
    expect(mockBehavioral.evaluate).toHaveBeenCalledWith(mockInput);
    expect(mockJudge.arbitrate).toHaveBeenCalledWith(
      expect.objectContaining({
        evaluations: {
          techLead: techEval,
          barRaiser: barEval,
          behavioral: behavEval,
        },
      })
    );
  });

  it('resilience: handles failure of one persona agent without crashing', async () => {
    const mockTechLead = { evaluate: vi.fn().mockResolvedValue(techEval) } as unknown as TechLeadAgent;
    const mockBarRaiser = { evaluate: vi.fn().mockRejectedValue(new Error('Timeout')) } as unknown as BarRaiserAgent;
    const mockBehavioral = { evaluate: vi.fn().mockResolvedValue(behavEval) } as unknown as BehavioralAgent;
    const mockJudge = {
      arbitrate: vi.fn().mockResolvedValue(mockConsensus),
      detectLocalVariance: vi.fn().mockReturnValue([]),
    } as unknown as JudgeAgent;

    const evaluator = new MultiAgentEvaluator(
      mockTechLead,
      mockBarRaiser,
      mockBehavioral,
      mockJudge
    );

    const result = await evaluator.evaluate(mockInput);
    expect(result).toBeDefined();
    expect(mockJudge.arbitrate).toHaveBeenCalledWith(
      expect.objectContaining({
        evaluations: {
          techLead: techEval,
          barRaiser: undefined,
          behavioral: behavEval,
        },
      })
    );
  });

  it('converts ConsensusReport to standard EvaluationResult for backward compatibility', () => {
    const mockTechLead = {} as TechLeadAgent;
    const mockBarRaiser = {} as BarRaiserAgent;
    const mockBehavioral = {} as BehavioralAgent;
    const mockJudge = {} as JudgeAgent;

    const evaluator = new MultiAgentEvaluator(
      mockTechLead,
      mockBarRaiser,
      mockBehavioral,
      mockJudge
    );

    const standardResult = evaluator.toEvaluationResult(mockConsensus, mockInput);
    expect(standardResult.overallScore).toBe(8.4);
    expect(standardResult.dimensions.length).toBeGreaterThan(0);
    expect(standardResult.learningPath.length).toBeGreaterThan(0);
  });

  it('differentiates scores and feedback per question based on category and dimensions (M-4 fix)', () => {
    const mockTechLead = {} as TechLeadAgent;
    const mockBarRaiser = {} as BarRaiserAgent;
    const mockBehavioral = {} as BehavioralAgent;
    const mockJudge = {} as JudgeAgent;

    const evaluator = new MultiAgentEvaluator(
      mockTechLead,
      mockBarRaiser,
      mockBehavioral,
      mockJudge
    );

    const multiQuestionInput: MultiAgentEvaluationInput = {
      sessionId: 'session-multi-456',
      role: 'Fullstack Dev',
      level: 'Senior',
      technologies: ['React', 'NodeJS'],
      questions: [
        {
          order: 1,
          category: 'Architecture & Design',
          difficulty: 'Hard',
          content: { vi: 'Câu hỏi kiến trúc', en: 'Architecture question' },
        },
        {
          order: 2,
          category: 'Security Awareness',
          difficulty: 'Hard',
          content: { vi: 'Câu hỏi bảo mật', en: 'Security question' },
        },
      ],
      answers: [
        {
          order: 1,
          questionId: 'q-arch',
          candidateAnswer: 'Thiết kế phân lớp microservices chuẩn clean architecture.',
        },
        {
          order: 2,
          questionId: 'q-sec',
          candidateAnswer: 'Dùng token JWT ngắn hạn kèm HttpOnly cookie chống XSS và CSRF.',
        },
      ],
    };

    const consensusWithDifferentDimensions: ConsensusReport = {
      finalOverallScore: 8.0,
      personaBreakdown: [
        {
          role: 'TECH_LEAD',
          score: 9.5,
          strengths: [{ vi: 'Kiến trúc rất tốt', en: 'Great architecture' }],
          weaknesses: [],
          specificFeedback: { vi: 'Thiết kế chuẩn Clean Architecture', en: 'Clean Architecture design' },
          dimensionScores: { 'Architecture & Design': 9.5 },
        },
        {
          role: 'BAR_RAISER',
          score: 6.0,
          strengths: [{ vi: 'Bảo mật cơ bản', en: 'Basic security' }],
          weaknesses: [{ vi: 'Thiếu rate limiting', en: 'Missing rate limiting' }],
          specificFeedback: { vi: 'Cần gia cố bảo mật và rate limiting', en: 'Needs security hardening' },
          dimensionScores: { 'Security Awareness': 6.0 },
        },
      ],
      varianceFlags: [],
      calibratedDimensions: [
        { name: 'Architecture & Design', score: 9.5, reasoning: 'Kiến trúc xuất sắc' },
        { name: 'Security Awareness', score: 6.0, reasoning: 'Còn thiếu sót bảo mật' },
      ],
      learningPath: [],
    };

    const result = evaluator.toEvaluationResult(consensusWithDifferentDimensions, multiQuestionInput);

    expect(result.evaluations).toHaveLength(2);
    // Scores must not be identical copy of finalOverallScore (8.0)
    expect(result.evaluations[0].score).toBe(9.5);
    expect(result.evaluations[1].score).toBe(6.0);
    expect(result.evaluations[0].score).not.toBe(result.evaluations[1].score);

    // Targeted feedback per question
    expect(result.evaluations[0].feedback.vi).toContain('TECH_LEAD');
    expect(result.evaluations[1].feedback.vi).toContain('BAR_RAISER');
  });
});

