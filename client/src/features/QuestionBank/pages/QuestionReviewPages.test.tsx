import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '../../../auth/authStore';
import { QuestionReviewQueuePage } from './QuestionReviewQueuePage';
import { QuestionReviewDetailPage } from './QuestionReviewDetailPage';

const api = vi.hoisted(() => ({
  listReviews: vi.fn(),
  getReview: vi.fn(),
  decideReview: vi.fn(),
  publishVersion: vi.fn(),
}));

vi.mock('../api/questionBankApi', () => ({
  questionBankApi: api,
  createIdempotencyKey: () => 'qb-review-page-idempotency-key',
  createVersionEtag: (version: { id: string; revision: number }) =>
    `W/"question-version:${version.id}:${version.revision}"`,
}));

const versionId = '64b000000000000000000002';
const reviewDetail = (allowedActions: Array<'APPROVE' | 'REQUEST_CHANGES' | 'PUBLISH'> = ['APPROVE', 'REQUEST_CHANGES']) => ({
  question: {
    id: '64b000000000000000000001',
    code: 'QB-2026-000001',
    lifecycleStatus: 'ACTIVE',
    ownerId: '64b000000000000000000003',
    revision: 0,
    latestVersionNumber: 1,
    draftVersionNumber: 1,
    currentPublishedVersionNumber: null,
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
  },
  snapshot: {
    id: versionId,
    questionId: '64b000000000000000000001',
    versionNumber: 1,
    status: 'IN_REVIEW',
    revision: 1,
    content: { prompt: { vi: 'Event loop là gì?', en: 'What is the event loop?' }, explanation: { vi: '', en: '' } },
    classification: {
      primaryRoleId: null,
      additionalRoleIds: [],
      levelIds: [],
      technologies: [],
      technologyAgnostic: false,
      classificationComplete: true,
      topic: null,
      tags: [],
      difficulty: 'MEDIUM',
      type: 'TECHNICAL',
    },
    answer: {
      referenceAnswer: { vi: 'Câu trả lời hạn chế', en: 'Restricted answer' },
      learningObjective: { vi: '', en: '' },
      estimatedTimeSeconds: 120,
      followUps: [],
    },
    rubric: [{ key: 'accuracy', title: { vi: 'Độ chính xác', en: 'Accuracy' }, weight: 100, levels: [] }],
    changeSummary: '',
    origin: 'MANUAL',
    provenance: { sourceVersionId: null, sourceReference: null },
    createdBy: '64b000000000000000000003',
    updatedBy: '64b000000000000000000003',
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
  },
  history: [{
    id: '64b000000000000000000004',
    actorId: '64b000000000000000000003',
    action: 'SUBMIT',
    reason: null,
    fromState: 'DRAFT',
    toState: 'IN_REVIEW',
    revision: 1,
    createdAt: '2026-09-10T00:00:00.000Z',
  }],
  completenessErrors: [],
  allowedActions,
});

const admin = {
  id: '64b000000000000000000009',
  email: 'admin@example.test',
  fullName: 'Admin',
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
  createdAt: '2026-09-10T00:00:00.000Z',
};

describe('Question Bank Phase 2 review pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setUser(admin);
  });

  afterEach(() => cleanup());

  it('renders queue loading result, filter and safe empty state', async () => {
    api.listReviews.mockResolvedValueOnce({
      items: [{
        id: versionId,
        questionId: '64b000000000000000000001',
        code: 'QB-2026-000001',
        versionNumber: 1,
        status: 'IN_REVIEW',
        revision: 1,
        promptPreview: { vi: 'Event loop là gì?', en: '' },
        type: 'TECHNICAL',
        difficulty: 'MEDIUM',
        lifecycleStatus: 'ACTIVE',
        contributorIds: [],
        updatedAt: '2026-09-10T00:00:00.000Z',
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }).mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    render(<MemoryRouter><QuestionReviewQueuePage /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải');
    expect(await screen.findByText('Event loop là gì?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'APPROVED' } });
    expect(await screen.findByText('Không có snapshot phù hợp.')).toBeInTheDocument();
    expect(api.listReviews).toHaveBeenLastCalledWith(
      { page: 1, limit: 20, status: 'APPROVED' },
      expect.any(AbortSignal)
    );
  });

  it('shows queue errors and retries', async () => {
    api.listReviews
      .mockRejectedValueOnce({ message: 'Mạng lỗi' })
      .mockResolvedValueOnce({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    render(<MemoryRouter><QuestionReviewQueuePage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Mạng lỗi');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Không có snapshot phù hợp.')).toBeInTheDocument();
  });

  it('renders read-only review history and performs an accessible confirmed decision', async () => {
    api.getReview.mockResolvedValue({
      data: reviewDetail(),
      etag: `W/"question-version:${versionId}:1"`,
    });
    api.decideReview.mockResolvedValue({
      data: { ...reviewDetail(['PUBLISH']), snapshot: { ...reviewDetail().snapshot, status: 'APPROVED', revision: 2 } },
      etag: `W/"question-version:${versionId}:2"`,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={[`/admin/question-bank/reviews/${versionId}`]}>
        <Routes><Route path="/admin/question-bank/reviews/:questionVersionId" element={<QuestionReviewDetailPage />} /></Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Snapshot nội dung')).toBeInTheDocument();
    expect(screen.getByText(/Câu trả lời hạn chế/)).toBeInTheDocument();
    expect(screen.getByText(/DRAFT → IN_REVIEW/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.decideReview).toHaveBeenCalledWith(
      versionId,
      'APPROVE',
      undefined,
      `W/"question-version:${versionId}:1"`,
      'qb-review-page-idempotency-key'
    ));
    expect(window.confirm).toHaveBeenCalled();
  });

  it('hides approve/publish when the server four-eyes allowedActions denies them', async () => {
    api.getReview.mockResolvedValue({
      data: reviewDetail(['REQUEST_CHANGES']),
      etag: `W/"question-version:${versionId}:1"`,
    });
    render(
      <MemoryRouter initialEntries={[`/admin/question-bank/reviews/${versionId}`]}>
        <Routes><Route path="/admin/question-bank/reviews/:questionVersionId" element={<QuestionReviewDetailPage />} /></Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole('button', { name: 'Request changes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
  });
});

