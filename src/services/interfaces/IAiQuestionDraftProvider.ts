import { AiDraftSpec, GeneratedQuestionDraft } from '../../domain/question-bank/types';

export interface IAiQuestionDraftProvider {
  generateDraft(spec: AiDraftSpec): Promise<GeneratedQuestionDraft>;
}
