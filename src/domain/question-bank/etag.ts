export type QuestionBankEtagKind = 'question' | 'question-version';

export interface ParsedQuestionBankEtag {
  kind: QuestionBankEtagKind;
  id: string;
  revision: number;
}

const ETAG_PATTERN = /^W\/"(question|question-version):([a-f\d]{24}):(0|[1-9]\d*)"$/i;

export const createWeakEtag = (
  kind: QuestionBankEtagKind,
  id: string,
  revision: number
): string => {
  if (!/^[a-f\d]{24}$/i.test(id) || !Number.isSafeInteger(revision) || revision < 0) {
    throw new TypeError('Không thể tạo ETag từ định danh hoặc revision không hợp lệ');
  }
  return `W/"${kind}:${id.toLowerCase()}:${revision}"`;
};

export const parseWeakEtag = (value: string | undefined): ParsedQuestionBankEtag | null => {
  if (!value) return null;
  const match = ETAG_PATTERN.exec(value.trim());
  if (!match) return null;

  const revision = Number(match[3]);
  if (!Number.isSafeInteger(revision)) return null;

  return {
    kind: match[1].toLowerCase() as QuestionBankEtagKind,
    id: match[2].toLowerCase(),
    revision,
  };
};

export const createQuestionEtag = (id: string, revision: number): string =>
  createWeakEtag('question', id, revision);

export const createQuestionVersionEtag = (id: string, revision: number): string =>
  createWeakEtag('question-version', id, revision);

export const parseQuestionEtag = (
  value: string | undefined,
  expectedKind?: QuestionBankEtagKind,
  expectedId?: string
): ParsedQuestionBankEtag | null => {
  const parsed = parseWeakEtag(value);
  if (!parsed) return null;
  if (expectedKind && parsed.kind !== expectedKind) return null;
  if (expectedId && parsed.id !== expectedId.toLowerCase()) return null;
  return parsed;
};

export const etagMatches = (
  value: string | undefined,
  expected: ParsedQuestionBankEtag
): boolean => {
  const parsed = parseWeakEtag(value);
  return Boolean(
    parsed &&
      parsed.kind === expected.kind &&
      parsed.id === expected.id.toLowerCase() &&
      parsed.revision === expected.revision
  );
};

