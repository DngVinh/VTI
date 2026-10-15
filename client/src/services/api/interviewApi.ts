/* eslint-disable @typescript-eslint/no-explicit-any */
import { authenticatedFetch, request } from '../../auth/apiClient';
import type { ConversationTurn, FollowUpResponseData } from '../../features/InterviewRoom/types';

export interface BaseEntity {
  _id: string;
  code: string;
  name: string;
}

export interface InterviewSetupPayload {
  jobPosition: string; // role ID
  level: string; // level ID
  techStacks: string[]; // array of technology IDs
  language?: 'VI' | 'EN';
  secondsPerQuestion?: number;
  strategy?: 'STANDARD' | 'ADAPTIVE';
}

export type InterviewHistoryStatus =
  | 'PENDING'
  | 'GENERATING'
  | 'IN_PROGRESS'
  | 'EVALUATING'
  | 'COMPLETED'
  | 'FAILED';

export interface InterviewHistoryQuery {
  page?: number;
  limit?: number;
  role?: string;
  level?: string;
  technology?: string;
  status?: InterviewHistoryStatus;
  from?: string;
  to?: string;
  sort?: 'newest' | 'oldest';
}

export interface InterviewHistoryItem {
  sessionId: string;
  role?: string;
  level?: string;
  technologies: string[];
  score: number | null;
  status: InterviewHistoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewHistoryResult {
  items: InterviewHistoryItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface InterviewSessionData {
  _id: string;
  status?: string;
  // include other fields as needed
}

export interface InterviewAnalyticsQuery {
  role?: string;
  level?: string;
  technology?: string;
  from?: string;
  to?: string;
}

export interface InterviewAnalyticsDimension {
  name: string;
  score: number | null;
}

export interface InterviewAnalyticsSeriesPoint {
  date: string;
  overallScore: number;
  dimensions: InterviewAnalyticsDimension[];
}

export interface InterviewAnalyticsResult {
  summary: {
    totalCompleted: number;
    averageOverallScore: number | null;
    dimensions: InterviewAnalyticsDimension[];
  };
  series: InterviewAnalyticsSeriesPoint[];
}

const extractArrayData = (json: any, key: string): BaseEntity[] => {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.[key])) return json[key];
  if (Array.isArray(json?.items)) return json.items;

  if (json?.data) {
    if (Array.isArray(json.data)) return json.data;
    if (json.data[key] && Array.isArray(json.data[key])) {
      return json.data[key];
    }
    if (json.data.items && Array.isArray(json.data.items)) {
      return json.data.items;
    }
  }

  return [];
};

const operationKey = (
  sessionId: string,
  action: 'generate' | 'submit'
): string => {
  const storageKey = `interview_${sessionId}_${action}_idempotency_key`;
  const existing = sessionStorage.getItem(storageKey);

  if (existing) return existing;

  const created = crypto.randomUUID();
  sessionStorage.setItem(storageKey, created);

  return created;
};

const buildAnalyticsQuery = (
  query: InterviewAnalyticsQuery
): string => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const serialized = params.toString();

  return serialized ? `?${serialized}` : '';
};

export const interviewApi = {
  /**
   * Fetch all Roles (Job Positions)
   */
  fetchRoles: async (): Promise<BaseEntity[]> => {
    try {
      const json = await request<any>('roles?limit=1000');
      return extractArrayData(json, 'roles');
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      return [];
    }
  },

  /**
   * Fetch all Levels
   */
  fetchLevels: async (): Promise<BaseEntity[]> => {
    try {
      const json = await request<any>('levels?limit=1000');
      return extractArrayData(json, 'levels');
    } catch (error) {
      console.error('Failed to fetch levels:', error);
      return [];
    }
  },

  /**
   * Fetch all Technologies, optionally filtered by role
   */
  fetchTechnologies: async (
    roleId?: string
  ): Promise<BaseEntity[]> => {
    try {
      const path = roleId
        ? `technologies?limit=1000&roleId=${encodeURIComponent(roleId)}`
        : 'technologies?limit=1000';

      const json = await request<any>(path);

      return extractArrayData(json, 'technologies');
    } catch (error) {
      console.error('Failed to fetch technologies:', error);
      return [];
    }
  },

  /**
   * Submit interview setup configuration
   */
  setupInterview: async (
    payload: InterviewSetupPayload
  ): Promise<InterviewSessionData> => {
    return request<InterviewSessionData>('interviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Create interview session from selected question bank questions
   */
  createSessionFromQuestions: async (
    questionIds: string[]
  ): Promise<InterviewSessionData> => {
    return request<InterviewSessionData>('interviews/practice-questions', {
      method: 'POST',
      body: JSON.stringify({ questionIds }),
    });
  },

  /**
   * Upload JD file for interview setup
   */
  uploadJdInterview: async (
    payload: FormData
  ): Promise<InterviewSessionData> => {
    const response = await authenticatedFetch(
      'interviews/generate-from-jd',
      {
        method: 'POST',
        body: payload,
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({}));

      throw new Error(
        errorData.message || 'Failed to upload JD'
      );
    }

    const body = await response.json();

    return body.data;
  },

  /**
   * Fetch current-user interview history.
   */
  fetchInterviewHistory: async (
    query: InterviewHistoryQuery = {}
  ): Promise<InterviewHistoryResult> => {
    const params = new URLSearchParams();

    if (query.page !== undefined) {
      params.set('page', String(query.page));
    }

    if (query.limit !== undefined) {
      params.set('limit', String(query.limit));
    }

    if (query.role) {
      params.set('role', query.role);
    }

    if (query.level) {
      params.set('level', query.level);
    }

    if (query.technology) {
      params.set('technology', query.technology);
    }

    if (query.status) {
      params.set('status', query.status);
    }

    if (query.from) {
      params.set('from', query.from);
    }

    if (query.to) {
      params.set('to', query.to);
    }

    if (query.sort) {
      params.set('sort', query.sort);
    }

    const suffix = params.toString()
      ? `?${params.toString()}`
      : '';

    return request<InterviewHistoryResult>(
      `interviews/history${suffix}`
    );
  },

  /**
   * Fetch an existing interview session by ID
   */
  fetchInterviewSession: async (
    sessionId: string
  ): Promise<any> => {
    return request<any>(
      `interviews/${sessionId}?t=${Date.now()}`,
      {
        cache: 'no-store',
      }
    );
  },

  /**
   * Save interview progress
   */
  saveInterviewProgress: async (
    sessionId: string,
    expectedVersion: number | undefined,
    answers: any[]
  ): Promise<any> => {
    const payload: Record<string, any> = { answers };
    if (typeof expectedVersion === 'number' && expectedVersion > 0) {
      payload.expectedVersion = expectedVersion;
    }
    return request<any>(
      `interviews/${sessionId}/progress`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * Generate interview questions for a session
   */
  generateQuestions: async (
    sessionId: string
  ): Promise<any> => {
    return request<any>(
      `interviews/${sessionId}/generate`,
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': operationKey(
            sessionId,
            'generate'
          ),
        },
      }
    );
  },

  /**
   * Submit interview answers
   */
  submitInterview: async (
    sessionId: string,
    expectedVersion: number | undefined,
    answers: any[]
  ): Promise<any> => {
    const payload: Record<string, any> = { answers };
    if (typeof expectedVersion === 'number' && expectedVersion >= 0) {
      payload.expectedVersion = expectedVersion;
    }
    return request<any>(
      `interviews/${sessionId}/submit`,
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': operationKey(
            sessionId,
            'submit'
          ),
        },
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * Fetch current-user interview analytics.
   */
  getAnalytics: async (
    query: InterviewAnalyticsQuery
  ): Promise<InterviewAnalyticsResult> => {
    return request<InterviewAnalyticsResult>(
      `interviews/analytics${buildAnalyticsQuery(query)}`
    );
  },

  /**
   * Submit candidate answer for turn-by-turn Socratic follow-up
   */
  requestFollowUp: async (
    sessionId: string,
    payload: { questionId: string; candidateAnswer: string }
  ): Promise<FollowUpResponseData> => {
    return request<FollowUpResponseData>(
      `interviews/${sessionId}/follow-up`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * Fetch dialogue turns between AI interviewer and candidate
   */
  fetchConversationHistory: async (
    sessionId: string,
    questionId?: string
  ): Promise<ConversationTurn[]> => {
    const query = questionId ? `?questionId=${encodeURIComponent(questionId)}` : '';
    return request<ConversationTurn[]>(
      `interviews/${sessionId}/conversation${query}`,
      {
        method: 'GET',
      }
    );
  },

  /**
   * Execute code in sandbox with optional AI review
   */
  executeCode: async (
    sessionId: string,
    payload: {
      questionId: string;
      code: string;
      language: string;
      testCases?: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
      withAiReview?: boolean;
    }
  ): Promise<{
    execution: {
      stdout: string;
      stderr: string;
      exitCode: number;
      executionTimeMs: number;
      memoryKb: number;
      testResults?: Array<{
        testCaseIndex: number;
        passed: boolean;
        actualOutput: string;
        expectedOutput: string;
        executionTimeMs: number;
        isHidden: boolean;
      }>;
    };
    review?: {
      astComplexity: {
        estimatedTimeComplexity: string;
        estimatedSpaceComplexity: string;
        cyclomaticComplexity: number;
        maxLoopNesting: number;
        hasRecursion: boolean;
        detectedSmells: string[];
      };
      feedback: { vi: string; en: string };
      suggestions: Array<{ vi: string; en: string }>;
      cleanCodeScore: number;
    };
  }> => {
    return request(
      `interviews/${sessionId}/execute-code`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * Submit whiteboard canvas snapshot for vision architecture critique
   */
  submitWhiteboardSnapshot: async (
    sessionId: string,
    payload: {
      questionId: string;
      imageBase64: string;
      mimeType?: string;
      canvasData?: any;
    }
  ): Promise<{ snapshotId: string; analysis: any }> => {
    return request(
      `interviews/${sessionId}/whiteboard`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },
};