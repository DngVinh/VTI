import type { QuestionListQuery, QuestionSort, SortOrder } from './types';

const POSITIVE_INTEGER = /^\d+$/;
const SORT_FIELDS = new Set<QuestionSort>(['updatedAt', 'createdAt', 'code']);
const SORT_ORDERS = new Set<SortOrder>(['asc', 'desc']);
const FILTER_KEYS = [
  'status',
  'lifecycleStatus',
  'roleId',
  'levelId',
  'technologyId',
  'difficulty',
  'type',
  'origin',
] as const;

const parseInteger = (value: string | null, fallback: number, maximum: number) => {
  if (!value || !POSITIVE_INTEGER.test(value)) return fallback;
  return Math.min(Number(value), maximum);
};

export const parseQuestionListQuery = (params: URLSearchParams): QuestionListQuery => {
  const rawSort = params.get('sortBy') as QuestionSort | null;
  const rawOrder = params.get('sortOrder') as SortOrder | null;
  const search = params.get('search')?.trim();
  const query: QuestionListQuery = {
    page: parseInteger(params.get('page'), 1, Number.MAX_SAFE_INTEGER),
    limit: parseInteger(params.get('limit'), 20, 100),
    sortBy: rawSort && SORT_FIELDS.has(rawSort) ? rawSort : 'updatedAt',
    sortOrder: rawOrder && SORT_ORDERS.has(rawOrder) ? rawOrder : 'desc',
  };

  if (search && search.length >= 2 && search.length <= 200) query.search = search;
  FILTER_KEYS.forEach((key) => {
    const value = params.get(key)?.trim();
    if (value) query[key] = value;
  });
  return query;
};

export const hasQuestionListFilters = (query: QuestionListQuery): boolean => Boolean(
  query.search ||
  query.status ||
  query.lifecycleStatus ||
  query.roleId ||
  query.levelId ||
  query.technologyId ||
  query.difficulty ||
  query.type ||
  query.origin
);

export const replaceQueryValue = (
  current: URLSearchParams,
  key: string,
  value: string | undefined,
  resetPage = true
): URLSearchParams => {
  const next = new URLSearchParams(current);
  if (value) next.set(key, value);
  else next.delete(key);
  if (resetPage) next.set('page', '1');
  return next;
};

