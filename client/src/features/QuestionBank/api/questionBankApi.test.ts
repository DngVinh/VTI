import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyQuestionVersionInput } from '../types';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  requestWithMetadata: vi.fn(),
}));

vi.mock('../../../auth/apiClient', () => mocks);

import { createIdempotencyKey, createVersionEtag, questionBankApi } from './questionBankApi';

describe('questionBankApi', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.requestWithMetadata.mockReset();
  });

  it('serializes only defined list query values', async () => {
    mocks.request.mockResolvedValue({ items: [], pagination: {} });
    const signal = new AbortController().signal;
    await questionBankApi.listQuestions({
      page: 2,
      limit: 20,
      search: '',
      difficulty: undefined,
      lifecycleStatus: 'ACTIVE',
      sortBy: 'code',
      sortOrder: 'asc',
    }, signal);

    expect(mocks.request).toHaveBeenCalledWith(
      'admin/question-bank/questions?page=2&limit=20&lifecycleStatus=ACTIVE&sortBy=code&sortOrder=asc',
      { signal }
    );
  });

  it('sends create and update command headers without changing the payload', async () => {
    const draft = emptyQuestionVersionInput();
    mocks.requestWithMetadata.mockResolvedValue({ data: {}, etag: null });

    await questionBankApi.createQuestion(draft, 'idempotency-key-1234');
    expect(mocks.requestWithMetadata).toHaveBeenLastCalledWith(
      'admin/question-bank/questions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Idempotency-Key': 'idempotency-key-1234' },
        body: JSON.stringify(draft),
      })
    );

    await questionBankApi.updateDraft('question-id', 3, draft, 'version-etag');
    expect(mocks.requestWithMetadata).toHaveBeenLastCalledWith(
      'admin/question-bank/questions/question-id/versions/3',
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/merge-patch+json',
          'If-Match': 'version-etag',
        },
      })
    );

    await questionBankApi.updateQuestionOwner('question-id', 'owner-id', 'question-etag');
    expect(mocks.requestWithMetadata).toHaveBeenLastCalledWith(
      'admin/question-bank/questions/question-id',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ ownerId: 'owner-id' }),
      })
    );
  });

  it('uses aggregate CAS and idempotency to create a version', async () => {
    mocks.requestWithMetadata.mockResolvedValue({ data: {}, etag: null });
    await questionBankApi.createVersion(
      'question-id',
      { sourceVersionNumber: 2 },
      'question-etag',
      'idempotency-key-5678'
    );
    expect(mocks.requestWithMetadata).toHaveBeenCalledWith(
      'admin/question-bank/questions/question-id/versions',
      {
        method: 'POST',
        headers: {
          'If-Match': 'question-etag',
          'Idempotency-Key': 'idempotency-key-5678',
        },
        body: JSON.stringify({ sourceVersionNumber: 2 }),
      }
    );
  });

  it('unwraps history and addresses detail endpoints', async () => {
    const signal = new AbortController().signal;
    mocks.request.mockResolvedValueOnce({ items: [{ id: 'version-1' }] });
    expect(await questionBankApi.listVersions('question-id', signal)).toEqual([
      { id: 'version-1' },
    ]);
    expect(mocks.request).toHaveBeenCalledWith(
      'admin/question-bank/questions/question-id/versions',
      { signal }
    );

    mocks.request.mockResolvedValueOnce({ id: 'version-2' });
    await questionBankApi.getVersion('question-id', 2, signal);
    expect(mocks.request).toHaveBeenLastCalledWith(
      'admin/question-bank/questions/question-id/versions/2',
      { signal }
    );

    mocks.requestWithMetadata.mockResolvedValueOnce({ data: {} });
    await questionBankApi.getQuestion('question-id', signal);
    expect(mocks.requestWithMetadata).toHaveBeenLastCalledWith(
      'admin/question-bank/questions/question-id',
      { signal }
    );
  });

  it('creates deterministic weak ETags and printable unique request keys', () => {
    expect(createVersionEtag({
      id: '507f1f77bcf86cd799439011',
      revision: 7,
    } as never)).toBe('W/"question-version:507f1f77bcf86cd799439011:7"');
    expect(createIdempotencyKey()).toMatch(/^qb-admin-.{16,}$/);
  });
});

