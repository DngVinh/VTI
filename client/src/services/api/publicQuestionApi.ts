import type {
  PaginatedPublicQuestions,
  PublicQuestionDetail,
  PublicQuestionFilters,
} from '../../features/QuestionLibrary/types';
import {
  PublicQuestionDetailSchema,
  PublicQuestionSummarySchema,
} from '../../features/QuestionLibrary/types';

import { interviewApi } from './interviewApi';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');

export interface TaxonomyOption {
  _id: string;
  name: string;
  code?: string;
}

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

  fetchTaxonomyFilters: async (
    roleId?: string
  ): Promise<{
    roles: TaxonomyOption[];
    levels: TaxonomyOption[];
    technologies: TaxonomyOption[];
  }> => {
    try {
      const url = `${API_BASE}/questions/public/taxonomy${
        roleId ? `?roleId=${encodeURIComponent(roleId)}` : ''
      }`;
      const response = await fetch(url);
      if (response.ok) {
        const payload = await response.json();
        const data = payload?.data ?? {};
        const mapItem = (item: Record<string, unknown>): TaxonomyOption => ({
          _id: String(item._id || item.id || ''),
          name: String(item.name || ''),
          code: item.code ? String(item.code) : undefined,
        });

        return {
          roles: Array.isArray(data.roles) ? data.roles.map(mapItem) : [],
          levels: Array.isArray(data.levels) ? data.levels.map(mapItem) : [],
          technologies: Array.isArray(data.technologies) ? data.technologies.map(mapItem) : [],
        };
      }
    } catch {
      // Fallback below
    }

    try {
      const [roles, levels, technologies] = await Promise.all([
        interviewApi.fetchRoles(),
        interviewApi.fetchLevels(),
        interviewApi.fetchTechnologies(roleId),
      ]);

      const mapBase = (item: { _id: string; name: string; code?: string }): TaxonomyOption => ({
        _id: item._id,
        name: item.name,
        code: item.code,
      });

      return {
        roles: roles.map(mapBase),
        levels: levels.map(mapBase),
        technologies: technologies.map(mapBase),
      };
    } catch {
      return { roles: [], levels: [], technologies: [] };
    }
  },
};
