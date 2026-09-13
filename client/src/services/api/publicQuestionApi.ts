import type {
  PaginatedPublicQuestions,
  PublicQuestionDetail,
  PublicQuestionFilters,
} from '../../features/QuestionLibrary/types';
import {
  PublicQuestionDetailSchema,
  PublicQuestionSummarySchema,
} from '../../features/QuestionLibrary/types';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');

export interface TaxonomyOption {
  _id: string;
  name: string;
  code?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isTaxonomyOption = (value: unknown): value is TaxonomyOption =>
  isRecord(value) &&
  typeof value._id === 'string' &&
  typeof value.name === 'string' &&
  (value.code === undefined || typeof value.code === 'string');

export const publicQuestionApi = {
  fetchPublicQuestions: async (
    filters: PublicQuestionFilters = {}
  ): Promise<PaginatedPublicQuestions> => {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.roleId) params.set('roleId', filters.roleId);
    if (filters.levelId) params.set('levelId', filters.levelId);
    if (filters.technologyId) params.set('technologyId', filters.technologyId);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    if (filters.questionType) params.set('questionType', filters.questionType);
    if (filters.search) params.set('search', filters.search);

    const queryString = params.toString();
    const url = `${API_BASE}/questions/public${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch questions: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const rawData = payload?.data ?? {};

    const items = Array.isArray(rawData.items)
      ? rawData.items.map((item: unknown) => PublicQuestionSummarySchema.parse(item))
      : [];

    return {
      items,
      total: typeof rawData.total === 'number' ? rawData.total : items.length,
      page: typeof rawData.page === 'number' ? rawData.page : 1,
      limit: typeof rawData.limit === 'number' ? rawData.limit : 10,
      totalPages: typeof rawData.totalPages === 'number' ? rawData.totalPages : 1,
    };
  },

  fetchPublicQuestionById: async (id: string): Promise<PublicQuestionDetail> => {
    const url = `${API_BASE}/questions/public/${encodeURIComponent(id)}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Question not found or not published');
      }
      throw new Error(`Failed to fetch question detail: ${response.status}`);
    }

    const payload = await response.json();
    return PublicQuestionDetailSchema.parse(payload.data);
  },

  fetchTaxonomyFilters: async (): Promise<{
    roles: TaxonomyOption[];
    levels: TaxonomyOption[];
    technologies: TaxonomyOption[];
  }> => {
    try {
      const [rolesRes, levelsRes, techsRes] = await Promise.all([
        fetch(`${API_BASE}/roles?limit=100`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_BASE}/levels?limit=100`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_BASE}/technologies?limit=100`).then((r) => (r.ok ? r.json() : null)),
      ]);

      const extract = (json: unknown, key: string): TaxonomyOption[] => {
        if (Array.isArray(json)) return json.filter(isTaxonomyOption);
        if (!isRecord(json) || !isRecord(json.data)) return [];

        const keyedItems = json.data[key];
        if (Array.isArray(keyedItems)) return keyedItems.filter(isTaxonomyOption);

        const items = json.data.items;
        return Array.isArray(items) ? items.filter(isTaxonomyOption) : [];
      };

      return {
        roles: extract(rolesRes, 'roles'),
        levels: extract(levelsRes, 'levels'),
        technologies: extract(techsRes, 'technologies'),
      };
    } catch {
      return { roles: [], levels: [], technologies: [] };
    }
  },
};
