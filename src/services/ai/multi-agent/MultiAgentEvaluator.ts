import { injectable, inject } from 'tsyringe';
import { TechLeadAgent } from './TechLeadAgent';
import { BarRaiserAgent } from './BarRaiserAgent';
import { BehavioralAgent } from './BehavioralAgent';
import { JudgeAgent } from './JudgeAgent';
import type {
  MultiAgentEvaluationInput,
  ConsensusReport,
  PersonaEvaluation,
} from './types';
import type { EvaluationResult, EvaluatedAnswer } from '../../../domain/interview/types';
import { AppError } from '../../../utils/AppError';
import { logger } from '../../../infrastructure/logging/logger';

@injectable()
export class MultiAgentEvaluator {
  constructor(
    @inject(TechLeadAgent) private techLead: TechLeadAgent,
    @inject(BarRaiserAgent) private barRaiser: BarRaiserAgent,
    @inject(BehavioralAgent) private behavioral: BehavioralAgent,
    @inject(JudgeAgent) private judge: JudgeAgent
  ) {}

  async evaluate(input: MultiAgentEvaluationInput): Promise<ConsensusReport> {
    logger.info('ai.evaluating');

    // 1. Run all 3 persona agents concurrently with resilience
    const [techSettled, barSettled, behavSettled] = await Promise.allSettled([
      this.techLead.evaluate(input),
      this.barRaiser.evaluate(input),
      this.behavioral.evaluate(input),
    ]);

    const techLeadEval: PersonaEvaluation | undefined =
      techSettled.status === 'fulfilled' ? techSettled.value : undefined;
    const barRaiserEval: PersonaEvaluation | undefined =
      barSettled.status === 'fulfilled' ? barSettled.value : undefined;
    const behavioralEval: PersonaEvaluation | undefined =
      behavSettled.status === 'fulfilled' ? behavSettled.value : undefined;

    if (!techLeadEval && !barRaiserEval && !behavioralEval) {
      throw new AppError(
        'Tất cả chuyên gia trong hội đồng đánh giá đều thất bại',
        502,
        'AIU_MULTI_AGENT_ALL_FAILED'
      );
    }

    // 2. Arbitrate consensus through JudgeAgent
    const consensus = await this.judge.arbitrate({
      evaluations: {
        techLead: techLeadEval,
        barRaiser: barRaiserEval,
        behavioral: behavioralEval,
      },
      context: input,
    });

    // 3. Local variance verification & enrichment
    const activePersonas: PersonaEvaluation[] = [];
    if (techLeadEval) activePersonas.push(techLeadEval);
    if (barRaiserEval) activePersonas.push(barRaiserEval);
    if (behavioralEval) activePersonas.push(behavioralEval);

    const localFlags = this.judge.detectLocalVariance(activePersonas);
    if (localFlags.length > 0 && consensus.varianceFlags.length === 0) {
      consensus.varianceFlags.push(...localFlags);
    }

    return consensus;
  }

  private resolveQuestionEvaluation(
    q: MultiAgentEvaluationInput['questions'][number] | undefined,
    ans: MultiAgentEvaluationInput['answers'][number],
    consensus: ConsensusReport
  ): { score: number; feedback: { vi: string; en: string } } {
    const answerText = (ans.candidateAnswer || '').trim();
    if (answerText.length === 0) {
      return {
        score: 0,
        feedback: {
          vi: 'Ứng viên chưa cung cấp câu trả lời cho câu hỏi này.',
          en: 'Candidate did not provide an answer for this question.',
        },
      };
    }

    const catLower = (q?.category || '').toLowerCase().trim();
    const techPersona = consensus.personaBreakdown.find((p) => p.role === 'TECH_LEAD');
    const barPersona = consensus.personaBreakdown.find((p) => p.role === 'BAR_RAISER');
    const behavPersona = consensus.personaBreakdown.find((p) => p.role === 'BEHAVIORAL');

    // 1. Determine matched dimension from calibratedDimensions
    let matchedDimension = consensus.calibratedDimensions.find((d) => {
      const dName = d.name.toLowerCase();
      return dName === catLower || dName.includes(catLower) || catLower.includes(dName);
    });

    // Keyword matching if not directly matched
    const isSecurity = /security|auth|token|owasp|vulnerability|bảo mật|attack/i.test(catLower);
    const isBehavioral = /behavioral|communication|soft|giao tiếp|hành vi|star|problem solving/i.test(catLower);
    const isTechnical = /arch|system|clean|design|scale|scalability|performance|kiến trúc|tech|code|algorithm|database|backend|frontend/i.test(catLower);

    if (!matchedDimension) {
      matchedDimension = consensus.calibratedDimensions.find((d) => {
        const dName = d.name.toLowerCase();
        if (isSecurity && /security|robustness|edge case|bảo mật/i.test(dName)) return true;
        if (isBehavioral && /communication|behavioral|problem solving|giao tiếp/i.test(dName)) return true;
        if (isTechnical && /architecture|design|scalability|code|clean|technical|kiến trúc/i.test(dName)) return true;
        return false;
      });
    }

    // 2. Resolve score
    let calculatedScore: number | undefined;

    if (matchedDimension) {
      calculatedScore = matchedDimension.score;
    } else {
      // Check persona dimensionScores
      for (const p of consensus.personaBreakdown) {
        if (p.dimensionScores) {
          for (const [dimName, s] of Object.entries(p.dimensionScores)) {
            const dLower = dimName.toLowerCase();
            if (dLower === catLower || dLower.includes(catLower) || catLower.includes(dLower)) {
              calculatedScore = s;
              break;
            }
          }
        }
        if (calculatedScore !== undefined) break;
      }

      // Check persona overall score by domain specialty
      if (calculatedScore === undefined) {
        if (isSecurity && barPersona) {
          calculatedScore = barPersona.score;
        } else if (isBehavioral && behavPersona) {
          calculatedScore = behavPersona.score;
        } else if (isTechnical && techPersona) {
          calculatedScore = techPersona.score;
        } else {
          calculatedScore = consensus.finalOverallScore;
        }
      }
    }

    // Apply brief answer penalty if too short
    if (answerText.length < 15) {
      calculatedScore = Math.min(calculatedScore, 3.0);
    }

    const finalScore = Math.min(10, Math.max(0, Math.round(calculatedScore * 10) / 10));

    // 3. Resolve targeted feedback
    let primaryPersona = techPersona;
    if (isSecurity && barPersona) {
      primaryPersona = barPersona;
    } else if (isBehavioral && behavPersona) {
      primaryPersona = behavPersona;
    } else if (!primaryPersona && consensus.personaBreakdown.length > 0) {
      primaryPersona = consensus.personaBreakdown[0];
    }

    let viFeedback = primaryPersona
      ? `[${primaryPersona.role}]: ${primaryPersona.specificFeedback.vi}`
      : 'Đánh giá câu trả lời từ hội đồng.';
    let enFeedback = primaryPersona
      ? `[${primaryPersona.role}]: ${primaryPersona.specificFeedback.en}`
      : 'Answer evaluation from panel.';

    if (matchedDimension?.reasoning) {
      const reasoningVi =
        typeof matchedDimension.reasoning === 'string'
          ? matchedDimension.reasoning
          : matchedDimension.reasoning.vi;
      const reasoningEn =
        typeof matchedDimension.reasoning === 'string'
          ? matchedDimension.reasoning
          : matchedDimension.reasoning.en;
      if (reasoningVi) viFeedback += `\n[Đánh giá]: ${reasoningVi}`;
      if (reasoningEn) enFeedback += `\n[Evaluation]: ${reasoningEn}`;
    }

    return {
      score: finalScore,
      feedback: {
        vi: viFeedback,
        en: enFeedback,
      },
    };
  }

  toEvaluationResult(
    consensus: ConsensusReport,
    input: MultiAgentEvaluationInput
  ): EvaluationResult {
    const evaluations: EvaluatedAnswer[] = input.answers.map((ans, idx) => {
      const q =
        input.questions.find((item) => item.order === ans.order) ||
        input.questions[idx];
      const evaluated = this.resolveQuestionEvaluation(q, ans, consensus);

      return {
        questionId: ans.questionId || `q-${ans.order}`,
        score: evaluated.score,
        feedback: evaluated.feedback,
      };
    });

    return {
      overallScore: consensus.finalOverallScore,
      evaluations,
      dimensions: consensus.calibratedDimensions.map((d) => ({
        name: d.name,
        score: d.score,
        reasoning: d.reasoning,
      })),
      learningPath: consensus.learningPath.map((item) => ({
        topic: item.topic,
        priority: item.priority,
        suggestion: item.suggestion,
      })),
    };
  }
}
