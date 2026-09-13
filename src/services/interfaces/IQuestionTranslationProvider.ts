export interface QuestionTranslationPayload {
  sourceLocale: 'vi' | 'en';
  targetLocale: 'vi' | 'en';
  fields: {
    prompt?: string | null;
    explanation?: string | null;
    referenceAnswer?: string | null;
    learningObjective?: string | null;
    followUps?: string[] | null;
    rubric?: Array<{
      key: string;
      title: string;
      description: string;
      levels: Array<{ score: number; description: string }>;
    }> | null;
  };
}

export interface QuestionTranslationOutput {
  translated: {
    prompt?: string | null;
    explanation?: string | null;
    referenceAnswer?: string | null;
    learningObjective?: string | null;
    followUps?: string[] | null;
    rubric?: Array<{
      key: string;
      title: string;
      description: string;
      levels: Array<{ score: number; description: string }>;
    }> | null;
  };
  warnings: string[];
  provider: string;
  model: string;
}

export interface IQuestionTranslationProvider {
  translate(payload: QuestionTranslationPayload): Promise<QuestionTranslationOutput>;
}
