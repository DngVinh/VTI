import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  request: vi.fn(),
  authenticatedFetch: vi.fn(),
}));

vi.mock('../../auth/apiClient', () => apiMocks);

import { interviewApi } from './interviewApi';

describe('interview API concurrency contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    apiMocks.request.mockResolvedValue({});
  });

  it('reuses one idempotency key for generate retries in the same session', async () => {
    await interviewApi.generateQuestions('session-1');
    await interviewApi.generateQuestions('session-1');

    const firstHeaders = apiMocks.request.mock.calls[0][1].headers;
    const secondHeaders = apiMocks.request.mock.calls[1][1].headers;
    expect(firstHeaders['Idempotency-Key']).toBe(secondHeaders['Idempotency-Key']);
    expect(firstHeaders['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('submits the expected aggregate version and a stable idempotency key', async () => {
    const answers = [{ questionId: 'question-1', state: 'ANSWERED', candidateAnswer: 'answer' }];
    await interviewApi.submitInterview('session-2', 8, answers);
    await interviewApi.submitInterview('session-2', 8, answers);

    const [, firstInit] = apiMocks.request.mock.calls[0];
    const [, secondInit] = apiMocks.request.mock.calls[1];
    expect(JSON.parse(firstInit.body)).toEqual({ expectedVersion: 8, answers });
    expect(firstInit.headers['Idempotency-Key']).toBe(secondInit.headers['Idempotency-Key']);
  });

  it('sends progress with optimistic-concurrency state and no client actor identifier', async () => {
    const answers = [{ questionId: 'question-1', state: 'SKIPPED' }];
    await interviewApi.saveInterviewProgress('session-3', 4, answers);
    await interviewApi.setupInterview({ jobPosition: 'role', level: 'level', techStacks: ['ts'] });

    expect(JSON.parse(apiMocks.request.mock.calls[0][1].body)).toEqual({ expectedVersion: 4, answers });
    expect(JSON.parse(apiMocks.request.mock.calls[1][1].body)).toEqual({
      jobPosition: 'role',
      level: 'level',
      techStacks: ['ts'],
    });
  });

  it('uses the refresh-aware authenticated path for JD uploads', async () => {
    apiMocks.authenticatedFetch.mockResolvedValue(new Response(JSON.stringify({
      data: { _id: 'session-4' },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    const formData = new FormData();
    formData.append('jdFile', new File(['pdf'], 'jd.pdf', { type: 'application/pdf' }));

    await expect(interviewApi.uploadJdInterview(formData)).resolves.toEqual({ _id: 'session-4' });
    expect(apiMocks.authenticatedFetch).toHaveBeenCalledWith('interviews/generate-from-jd', {
      method: 'POST',
      body: formData,
    });
    expect(formData.has('userId')).toBe(false);
  });

  it('creates interview session from practice questions', async () => {
    apiMocks.request.mockResolvedValue({ _id: 'session-5', status: 'IN_PROGRESS' });
    const questionIds = ['q-1', 'q-2'];

    const result = await interviewApi.createSessionFromQuestions(questionIds);
    expect(result).toEqual({ _id: 'session-5', status: 'IN_PROGRESS' });
    expect(apiMocks.request).toHaveBeenCalledWith('interviews/practice-questions', {
      method: 'POST',
      body: JSON.stringify({ questionIds }),
    });
  });

  it('loads authenticated taxonomy data and safely encodes the role filter', async () => {
    const role = { _id: 'role-1', code: 'BE', name: 'Backend' };
    const level = { _id: 'level-1', code: 'INTERN', name: 'Intern' };
    const technology = { _id: 'tech-1', code: 'NODE', name: 'Node.js' };
    apiMocks.request
      .mockResolvedValueOnce({ items: [role] })
      .mockResolvedValueOnce({ levels: [level] })
      .mockResolvedValueOnce({ data: { technologies: [technology] } });

    await expect(interviewApi.fetchRoles()).resolves.toEqual([role]);
    await expect(interviewApi.fetchLevels()).resolves.toEqual([level]);
    await expect(interviewApi.fetchTechnologies('role/with spaces')).resolves.toEqual([technology]);
    expect(apiMocks.request.mock.calls.map(([path]) => path)).toEqual([
      'roles?limit=1000',
      'levels?limit=1000',
      'technologies?limit=1000&roleId=role%2Fwith%20spaces',
    ]);
  });

  it('reads a session through the authenticated no-store request path', async () => {
    apiMocks.request.mockResolvedValue({ _id: 'session-5', status: 'IN_PROGRESS', version: 3 });

    await expect(interviewApi.fetchInterviewSession('session-5')).resolves.toMatchObject({ version: 3 });
    expect(apiMocks.request).toHaveBeenCalledWith(
      expect.stringMatching(/^interviews\/session-5\?t=\d+$/),
      { cache: 'no-store' }
    );
  });

  it('returns safe taxonomy fallbacks and surfaces the server JD upload message', async () => {
    apiMocks.request.mockRejectedValueOnce(new Error('offline'));
    await expect(interviewApi.fetchRoles()).resolves.toEqual([]);

    apiMocks.authenticatedFetch.mockResolvedValue(new Response(JSON.stringify({
      message: 'JD không hợp lệ',
    }), { status: 422, headers: { 'Content-Type': 'application/json' } }));
    await expect(interviewApi.uploadJdInterview(new FormData())).rejects.toThrow('JD không hợp lệ');
  });

  it('requests follow-up with questionId and candidateAnswer payload', async () => {
    const mockResponse = { shouldFollowUp: true, turnIndex: 1, maxTurns: 3 };
    apiMocks.request.mockResolvedValueOnce(mockResponse);

    const result = await (interviewApi as any).requestFollowUp('session-6', {
      questionId: 'q-1',
      candidateAnswer: 'Candidate answer',
    });

    expect(result).toEqual(mockResponse);
    expect(apiMocks.request).toHaveBeenCalledWith('interviews/session-6/follow-up', {
      method: 'POST',
      body: JSON.stringify({ questionId: 'q-1', candidateAnswer: 'Candidate answer' }),
    });
  });

  it('fetches conversation history with optional questionId query', async () => {
    const mockTurns = [{ turnIndex: 0, role: 'CANDIDATE', content: { vi: 'a', en: 'a' } }];
    apiMocks.request.mockResolvedValueOnce(mockTurns);

    const result = await (interviewApi as any).fetchConversationHistory('session-7', 'q-2');
    expect(result).toEqual(mockTurns);
    expect(apiMocks.request).toHaveBeenCalledWith('interviews/session-7/conversation?questionId=q-2', {
      method: 'GET',
    });
  });
});

