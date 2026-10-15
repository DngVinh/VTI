import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MultiAgentEvaluator } from '../src/services/ai/multi-agent/MultiAgentEvaluator';
import { TechLeadAgent } from '../src/services/ai/multi-agent/TechLeadAgent';
import { BarRaiserAgent } from '../src/services/ai/multi-agent/BarRaiserAgent';
import { BehavioralAgent } from '../src/services/ai/multi-agent/BehavioralAgent';
import { JudgeAgent } from '../src/services/ai/multi-agent/JudgeAgent';
import { InterviewEvaluationResultModel } from '../src/models/InterviewEvaluationResult';
import type { MultiAgentEvaluationInput } from '../src/services/ai/multi-agent/types';
import type { IAiProvider } from '../src/domain/interview/types';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await InterviewEvaluationResultModel.deleteMany({});
});

describe('Multi-Agent Evaluation Panel Integration (Micro-Task 2.10)', () => {
  it('executes complete 4-agent evaluation pipeline with variance detection and stores in DB', async () => {
    const sessionId = new mongoose.Types.ObjectId();
    const operationId = new mongoose.Types.ObjectId();
    const q1Id = new mongoose.Types.ObjectId();
    const q2Id = new mongoose.Types.ObjectId();

    const input: MultiAgentEvaluationInput = {
      sessionId: sessionId.toString(),
      role: 'Fullstack Senior Engineer',
      level: 'Senior',
      technologies: ['NodeJS', 'TypeScript', 'PostgreSQL', 'Redis'],
      questions: [
        {
          order: 1,
          category: 'Architecture',
          difficulty: 'Hard',
          content: {
            vi: 'Thiết kế hệ thống URL Shortener xử lý 10.000 QPS?',
            en: 'Design a URL Shortener handling 10,000 QPS?',
          },
        },
        {
          order: 2,
          category: 'Security',
          difficulty: 'Hard',
          content: {
            vi: 'Cơ chế xác thực token stateless và chống replay attack?',
            en: 'Stateless token authentication and replay attack prevention?',
          },
        },
      ],
      answers: [
        {
          questionId: q1Id.toString(),
          order: 1,
          candidateAnswer: 'Dùng base62 encode ID tăng dần từ Redis distributed counter. Cache 20% link hot trên Redis cluster. Sharding DB theo short URL.',
        },
        {
          questionId: q2Id.toString(),
          order: 2,
          candidateAnswer: 'Dùng JWT với expiration ngắn (15p), refresh token lưu trong HttpOnly cookie, kết hợp jti nonce và Redis blacklist để thu hồi.',
        },
      ],
      conversationHistory: [
        {
          questionId: q1Id.toString(),
          turnIndex: 1,
          role: 'INTERVIEWER',
          type: 'FOLLOW_UP',
          content: {
            vi: 'Nếu Redis counter bị mất điện đột ngột thì dãy số bị trùng hay không?',
            en: 'If Redis counter loses power, will sequences collide?',
          },
        },
        {
          questionId: q1Id.toString(),
          turnIndex: 2,
          role: 'CANDIDATE',
          type: 'ANSWER',
          content: {
            vi: 'Redis persistence AOF everysec hoặc dùng Range allocator: mỗi node nhận trước block 1000 ID, nếu crash thì bỏ qua block đó.',
            en: 'Use Redis AOF everysec or Range allocator: each node reserves block of 1000 IDs, skips block on crash.',
          },
        },
      ],
    };

    // Mock AI responses for each persona
    const mockAiProvider: IAiProvider = {
      generateQuestions: vi.fn(),
      evaluateAnswers: vi.fn(),
      evaluatePersona: vi.fn().mockImplementation(async (prompt: { systemInstruction: string }) => {
        if (prompt.systemInstruction.includes('AIU-TECHLEAD-v1')) {
          return {
            data: {
              role: 'TECH_LEAD',
              score: 9.2,
              strengths: [{ vi: 'Range allocator thông minh, tránh trùng ID.', en: 'Smart range allocator, avoids collisions.' }],
              weaknesses: [{ vi: 'Cần tính toán dung lượng DB dài hạn.', en: 'Needs long term DB capacity planning.' }],
              specificFeedback: { vi: 'Kiến trúc rất ấn tượng.', en: 'Very impressive architecture.' },
              dimensionScores: { 'Architecture & Design': 9.5, 'Scalability & Performance': 9.0 },
            },
            audit: { promptTokenCount: 100, candidatesTokenCount: 150, totalTokenCount: 250 },
          };
        }

        if (prompt.systemInstruction.includes('AIU-BARRAISER-v1')) {
          return {
            data: {
              role: 'BAR_RAISER',
              score: 5.5, // Intentionally divergent to trigger variance flag!
              strengths: [{ vi: 'Sử dụng HttpOnly cookie và jti.', en: 'Uses HttpOnly cookie and jti.' }],
              weaknesses: [{ vi: 'Chưa bảo vệ chống DDoS enumeration short URL.', en: 'Did not mitigate DDoS enumeration of short URLs.' }],
              specificFeedback: { vi: 'Rủi ro rò rỉ và quét brute-force URL.', en: 'Risk of URL leakage and brute-force scanning.' },
              dimensionScores: { 'Security Awareness': 5.5, 'Edge Case Robustness': 5.5 },
            },
            audit: { promptTokenCount: 100, candidatesTokenCount: 150, totalTokenCount: 250 },
          };
        }

        if (prompt.systemInstruction.includes('AIU-BEHAVIORAL-v1')) {
          return {
            data: {
              role: 'BEHAVIORAL',
              score: 8.8,
              strengths: [{ vi: 'Tiếp thu gợi ý về lỗi mất điện rất nhanh.', en: 'Quickly adapted to power outage edge case.' }],
              weaknesses: [{ vi: 'Diễn đạt có phần ngắn gọn.', en: 'Slightly terse phrasing.' }],
              specificFeedback: { vi: 'Tác phong linh hoạt, chuyên nghiệp.', en: 'Flexible, professional demeanor.' },
              dimensionScores: { 'Communication Clarity': 8.5, 'Coachability & Guidance Acceptance': 9.0 },
            },
            audit: { promptTokenCount: 100, candidatesTokenCount: 150, totalTokenCount: 250 },
          };
        }

        if (prompt.systemInstruction.includes('AIU-JUDGE-v1')) {
          return {
            data: {
              finalOverallScore: 8.0,
              personaBreakdown: [
                {
                  role: 'TECH_LEAD',
                  score: 9.2,
                  strengths: [{ vi: 'Kiến trúc tốt', en: 'Good architecture' }],
                  weaknesses: [{ vi: 'Thiếu sizing', en: 'Missing sizing' }],
                  specificFeedback: { vi: 'Ấn tượng', en: 'Impressive' },
                  dimensionScores: { 'Architecture & Design': 9.5 },
                },
                {
                  role: 'BAR_RAISER',
                  score: 5.5,
                  strengths: [{ vi: 'Dùng cookie an toàn', en: 'Safe cookies' }],
                  weaknesses: [{ vi: 'Nguy cơ DDoS enumeration', en: 'DDoS enumeration risk' }],
                  specificFeedback: { vi: 'Cảnh báo bảo mật', en: 'Security warning' },
                  dimensionScores: { 'Security Awareness': 5.5 },
                },
                {
                  role: 'BEHAVIORAL',
                  score: 8.8,
                  strengths: [{ vi: 'Coachability cao', en: 'High coachability' }],
                  weaknesses: [{ vi: 'Cần chi tiết hơn', en: 'Needs more details' }],
                  specificFeedback: { vi: 'Chuyên nghiệp', en: 'Professional' },
                  dimensionScores: { 'Communication Clarity': 8.5 },
                },
              ],
              varianceFlags: [
                {
                  dimension: 'Architecture vs Security (Tech Lead 9.2 vs Bar Raiser 5.5)',
                  variance: 3.7,
                  arbiterResolution: {
                    vi: 'Tech Lead đánh giá cao khả năng chịu tải nhưng Bar Raiser nêu rõ nguy cơ DDoS. Trọng tài quyết định mức điểm 8.0 cân bằng.',
                    en: 'Tech Lead praised scalability while Bar Raiser raised DDoS risk. Arbiter calibrated to balanced 8.0 score.',
                  },
                },
              ],
              calibratedDimensions: [
                {
                  name: 'Architecture & Scalability',
                  score: 9.0,
                  reasoning: 'Hệ thống thiết kế chịu tải phân tán tốt.',
                },
                {
                  name: 'Security & Robustness',
                  score: 6.5,
                  reasoning: 'Cần bổ sung rate limiting và WAF ngăn enumeration.',
                },
              ],
              learningPath: [
                {
                  topic: { vi: 'Chống Brute-force & Enumeration trên Web', en: 'Anti Brute-force & Enumeration on Web' },
                  priority: 'High',
                  suggestion: {
                    vi: 'Triển khai Token bucket rate limiter và WAF bảo vệ short URL.',
                    en: 'Deploy Token bucket rate limiter and WAF for short URL protection.',
                  },
                },
              ],
            },
            audit: { promptTokenCount: 200, candidatesTokenCount: 250, totalTokenCount: 450 },
          };
        }

        throw new Error(`Unknown prompt: ${prompt.systemInstruction}`);
      }),
    };

    const techLead = new TechLeadAgent(mockAiProvider);
    const barRaiser = new BarRaiserAgent(mockAiProvider);
    const behavioral = new BehavioralAgent(mockAiProvider);
    const judge = new JudgeAgent(mockAiProvider);

    const evaluator = new MultiAgentEvaluator(techLead, barRaiser, behavioral, judge);

    // 1. Run evaluation
    const consensus = await evaluator.evaluate(input);

    expect(consensus.finalOverallScore).toBe(8.0);
    expect(consensus.personaBreakdown.length).toBe(3);
    expect(consensus.varianceFlags.length).toBeGreaterThan(0);
    expect(consensus.varianceFlags[0].variance).toBeGreaterThanOrEqual(3.0);
    expect(consensus.varianceFlags[0].arbiterResolution.vi).toContain('Trọng tài');

    // 2. Convert to standard EvaluationResult
    const standardEvaluation = evaluator.toEvaluationResult(consensus, input);
    expect(standardEvaluation.overallScore).toBe(8.0);
    expect(standardEvaluation.evaluations.length).toBe(2);

    // 3. Persist to MongoDB
    const persisted = await InterviewEvaluationResultModel.create({
      sessionId,
      submissionVersion: 1,
      operationId,
      overallScore: standardEvaluation.overallScore,
      evaluations: standardEvaluation.evaluations.map((ev, i) => ({
        questionId: [q1Id, q2Id][i],
        feedback: ev.feedback,
        score: ev.score,
      })),
      dimensions: standardEvaluation.dimensions,
      learningPath: standardEvaluation.learningPath,
      personaEvaluations: consensus.personaBreakdown,
      varianceFlags: consensus.varianceFlags,
    });

    expect(persisted._id).toBeDefined();

    // 4. Verify MongoDB query
    const retrieved = await InterviewEvaluationResultModel.findById(persisted._id);
    expect(retrieved?.overallScore).toBe(8.0);
    expect(retrieved?.personaEvaluations?.length).toBe(3);
    expect(retrieved?.varianceFlags?.length).toBeGreaterThan(0);
    expect(retrieved?.varianceFlags?.[0].dimension).toContain('Architecture vs Security');
  });
});
