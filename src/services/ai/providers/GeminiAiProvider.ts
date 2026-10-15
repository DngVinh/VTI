import { inject, injectable } from 'tsyringe';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppEnv } from '../../../config/env';
import { logger } from '../../../infrastructure/logging/logger';
import { IAiProvider, InterviewSetupPayload, AnswerPayload, LocalizedContent, SystemPromptContext } from '../../../domain/interview/types';
import {
  EvaluationQuestion,
  generationPrompt,
  evaluationPrompt,
  parseProviderJson,
  validateGeneration,
  validateEvaluation,
  validateUsage,
  outputError,
} from '../prompt-security';
import { buildFollowUpPrompt, validateFollowUpResponse } from '../follow-up-engine';
import { providerRetry } from '../provider-retry';

@injectable()
export class GeminiAiProvider implements IAiProvider {
  private readonly genAI: GoogleGenerativeAI;

  constructor(@inject('AppEnv') env: AppEnv) {
    this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }

  private async request(systemInstruction: string, userContent: string) {
    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'];
    let lastError: unknown;
    for (const modelName of candidateModels) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          systemInstruction,
          generationConfig: {
            temperature: 0.5,
            responseMimeType: 'application/json',
            maxOutputTokens: 8192,
          },
        });
        const result = await providerRetry(
          (signal) => model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userContent }] }],
          }, { signal }),
        );
        if (
          result.response.promptFeedback?.blockReason ||
          result.response.candidates?.length !== 1 ||
          result.response.candidates[0].finishReason !== 'STOP'
        ) {
          throw outputError();
        }
        let value: unknown;
        try {
          value = parseProviderJson(result.response.text());
        } catch {
          throw outputError();
        }
        const usage = result.response.usageMetadata;
        const audit = validateUsage({
          promptTokenCount: usage?.promptTokenCount ?? 0,
          candidatesTokenCount: usage?.candidatesTokenCount ?? 0,
          totalTokenCount: usage?.totalTokenCount ?? 0,
        });
        return { value, audit };
      } catch (err: any) {
        if (err?.code === 'AI_OUTPUT_INVALID') {
          throw err;
        }
        lastError = err;
        console.warn(`[GeminiAiProvider] Model ${modelName} unavailable, attempting fallback:`, err?.message || err);
      }
    }
    throw lastError;
  }

  async generateQuestions(setupData: InterviewSetupPayload) {
    const prompt = generationPrompt(setupData);
    logger.info('ai.generating');
    const { value, audit } = await this.request(prompt.systemInstruction, prompt.userContent);
    return { data: validateGeneration(value), audit };
  }

  async evaluateAnswers(questions: EvaluationQuestion[], answers: AnswerPayload[]) {
    const prompt = evaluationPrompt(questions, answers);
    logger.info('ai.evaluating');
    const { value, audit } = await this.request(prompt.systemInstruction, prompt.userContent);
    return { data: validateEvaluation(value, prompt.questions, prompt.answers), audit };
  }

  async generateFollowUp(
    originalQuestion: LocalizedContent,
    candidateAnswer: string,
    history: Array<{ role: string; content: string }>,
    systemPrompt?: SystemPromptContext
  ) {
    const prompt = buildFollowUpPrompt(originalQuestion, candidateAnswer, history);
    logger.info('ai.generating');
    const { value, audit } = await this.request(prompt.systemInstruction, prompt.userContent);
    return { data: validateFollowUpResponse(value), audit };
  }
}

