export interface QuestionEmbeddingPayload {
  text: string;
}

export interface QuestionEmbeddingOutput {
  vector: number[];
  dimensions: number;
  provider: string;
  model: string;
}

export interface IQuestionEmbeddingProvider {
  generateEmbedding(payload: QuestionEmbeddingPayload): Promise<QuestionEmbeddingOutput>;
}
