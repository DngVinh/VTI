import { EmbeddingStatus } from '../../domain/question-bank/types';
import { IQuestionEmbedding } from '../../models/question-embedding.model';

export interface UpsertEmbeddingInput {
  questionId: string;
  questionVersionId: string;
  contentHash: string;
  provider: string;
  model: string;
  dimensions: number;
  vector: number[];
  status?: EmbeddingStatus;
  lastErrorCode?: string | null;
}

export interface IQuestionEmbeddingRepository {
  findByVersionAndModel(
    versionId: string,
    provider: string,
    model: string,
    contentHash: string
  ): Promise<IQuestionEmbedding | null>;

  upsertEmbedding(input: UpsertEmbeddingInput): Promise<IQuestionEmbedding>;

  findReadyEmbeddingsForVersions(
    versionIds: string[],
    provider: string,
    model: string
  ): Promise<IQuestionEmbedding[]>;

  markStaleByVersion(versionId: string, exceptContentHash: string): Promise<number>;
}
