import { QuestionBankDomainError } from './errors';
import { LocalizedText } from './types';

export const validateVector = (
  vector: unknown,
  expectedDimensions?: number
): number[] => {
  if (!Array.isArray(vector)) {
    throw new QuestionBankDomainError(
      'QUESTION_EMBEDDING_INVALID_DIMENSIONS',
      'Embedding vector phải là một mảng số thực'
    );
  }

  if (expectedDimensions !== undefined && vector.length !== expectedDimensions) {
    throw new QuestionBankDomainError(
      'QUESTION_EMBEDDING_INVALID_DIMENSIONS',
      `Vector dimensions (${vector.length}) không khớp kích thước yêu cầu (${expectedDimensions})`
    );
  }

  if (vector.length === 0) {
    throw new QuestionBankDomainError(
      'QUESTION_EMBEDDING_INVALID_DIMENSIONS',
      'Vector không được rỗng'
    );
  }

  for (let i = 0; i < vector.length; i++) {
    const val = vector[i];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw new QuestionBankDomainError(
        'QUESTION_EMBEDDING_INVALID_DIMENSIONS',
        `Phần tử vector tại vị trí ${i} không phải số hữu hạn hợp lệ`
      );
    }
  }

  return vector as number[];
};

export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) {
    throw new QuestionBankDomainError(
      'QUESTION_EMBEDDING_INVALID_DIMENSIONS',
      `Kích thước hai vector không đồng nhất (${a.length} vs ${b.length})`
    );
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  if (!Number.isFinite(similarity)) {
    return 0;
  }

  // Clamp within [-1, 1] then [0, 1] for similarity
  const clamped = Math.max(0, Math.min(1, similarity));
  return clamped;
};

export interface DiscoverabilityPayload {
  prompt: { vi?: string | null; en?: string | null };
  topic?: string | null;
  tags?: string[];
  questionType?: string | null;
  difficulty?: string | null;
}

export const buildDiscoverabilityText = (payload: DiscoverabilityPayload): string => {
  const parts: string[] = [];

  const vi = payload.prompt.vi?.replace(/\s+/gu, ' ').trim();
  if (vi) {
    parts.push(`PROMPT_VI: ${vi}`);
  }

  const en = payload.prompt.en?.replace(/\s+/gu, ' ').trim();
  if (en) {
    parts.push(`PROMPT_EN: ${en}`);
  }

  const topic = payload.topic?.replace(/\s+/gu, ' ').trim();
  if (topic) {
    parts.push(`TOPIC: ${topic}`);
  }

  if (payload.tags && payload.tags.length > 0) {
    const sorted = [...payload.tags]
      .map((t) => t.replace(/\s+/gu, ' ').trim())
      .filter(Boolean)
      .sort();
    if (sorted.length > 0) {
      parts.push(`TAGS: ${sorted.join(', ')}`);
    }
  }

  if (payload.questionType) {
    parts.push(`TYPE: ${payload.questionType}`);
  }

  if (payload.difficulty) {
    parts.push(`DIFFICULTY: ${payload.difficulty}`);
  }

  return parts.join('\n');
};

export interface RankedDuplicateCandidate {
  questionId: string;
  code: string;
  versionNumber: number;
  similarityScore: number;
  matchType: 'EXACT' | 'SEMANTIC';
  promptPreview?: LocalizedText;
  taxonomyOverlap?: {
    roles: string[];
    levels: string[];
    technologies: string[];
    difficultyMatch: boolean;
    typeMatch: boolean;
  };
  topic?: string | null;
}

export const rankDuplicateMatches = <T extends RankedDuplicateCandidate>(
  candidates: T[],
  topK: number
): T[] => {
  const sorted = [...candidates].sort((a, b) => {
    // 1. EXACT match first
    if (a.matchType === 'EXACT' && b.matchType !== 'EXACT') return -1;
    if (b.matchType === 'EXACT' && a.matchType !== 'EXACT') return 1;

    // 2. Similarity score descending
    const diff = b.similarityScore - a.similarityScore;
    if (Math.abs(diff) > 1e-6) {
      return diff;
    }

    // 3. Stable tie-break by code ascending
    return a.code.localeCompare(b.code);
  });

  return sorted.slice(0, topK);
};
