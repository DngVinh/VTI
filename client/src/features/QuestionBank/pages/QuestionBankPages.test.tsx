import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type {
  QuestionAdminDetailDto,
  QuestionSummaryDto,
  QuestionVersionAdminDetailDto,
} from '../types';
import { emptyQuestionVersionInput } from '../types';

const apiMocks = vi.hoisted(() => ({
  listQuestions: vi.fn(),
  getQuestion: vi.fn(),
  createQuestion: vi.fn(),
    createVersion: vi.fn(),
    createQuestionSummaryEtag: vi.fn(),
    publishVersion: vi.fn(),
    transitionLifecycle: vi.fn(),
  updateQuestionOwner: vi.fn(),
  updateDraft: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
}));

vi.mock('../api/questionBankApi', () => ({
  questionBankApi: apiMocks,
  createIdempotencyKey: () => 'qb-page-test-idempotency-key',
  createQuestionSummaryEtag: apiMocks.createQuestionSummaryEtag,
  createVersionEtag: (version: { id: string; revision: number }) =>
    'W/"question-version:' + version.id + ':' + version.revision + '"',
}));

import { QuestionBankListPage } from './QuestionBankListPage';
import { QuestionEditorPage } from './QuestionEditorPage';

const QUESTION_ID = '507f1f77bcf86cd799439011';
const VERSION_ID = '507f1f77bcf86cd799439012';
const ACTOR_ID = '507f191e810c19729de860ea';

const version = (
  overrides: Partial<QuestionVersionAdminDetailDto> = {}
): QuestionVersionAdminDetailDto => ({
  ...emptyQuestionVersionInput(),
  id: VERSION_ID,
  questionId: QUESTION_ID,
  versionNumber: 1,
  status: 'DRAFT',
  revision: 0,
  origin: 'MANUAL',
  provenance: { sourceVersionId: null, sourceReference: null },
  createdBy: ACTOR_ID,
  updatedBy: ACTOR_ID,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const detail = (
  draftVersion: QuestionVersionAdminDetailDto | null,
  currentPublishedVersion: QuestionVersionAdminDetailDto | null = null
): QuestionAdminDetailDto => ({
  question: {
    id: QUESTION_ID,
    code: 'QB-2026-000001',
    lifecycleStatus: 'ACTIVE',
    ownerId: ACTOR_ID,
    revision: 0,
    latestVersionNumber: currentPublishedVersion && draftVersion ? 2 : 1,
    draftVersionNumber: draftVersion?.versionNumber ?? null,
    currentPublishedVersionNumber: currentPublishedVersion?.versionNumber ?? null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  draftVersion,
  currentPublishedVersion,
});

const summary: QuestionSummaryDto = {
  id: QUESTION_ID,
  code: 'QB-2026-000001',
  lifecycleStatus: 'ACTIVE',
  revision: 0,
  promptPreview: { vi: 'Event loop hoạt động thế nào?', en: 'How does the event loop work?' },
  taxonomy: {
    primaryRoleId: null,
    additionalRoleIds: [],
    levelIds: [],
    technologyIds: [],
    technologyAgnostic: true,
    topic: 'Runtime',
    tags: ['node-js'],
  },
  difficulty: 'MEDIUM',
  type: 'TECHNICAL',
  origin: 'MANUAL',
  draftStatus: 'DRAFT',
  selectionStatus: 'UNAVAILABLE',
  latestVersionNumber: 1,
  draftVersionNumber: 1,
  currentPublishedVersionNumber: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const LocationProbe = () => {
  const location = useLocation();
  return <output aria-label="location">{location.pathname + location.search}</output>;
};

const renderEditor = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/question-bank/questions/new" element={<QuestionEditorPage />} />
        <Route path="/admin/question-bank/questions/:questionId/edit" element={<QuestionEditorPage />} />
        <Route path="/admin/question-bank/questions/:questionId" element={<QuestionEditorPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );

describe('Question Bank pages', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    apiMocks.createQuestionSummaryEtag.mockImplementation(
      (question: { id: string; revision: number }) => `W/"question:${question.id}:${question.revision}"`
    );
    apiMocks.listVersions.mockResolvedValue([]);
    apiMocks.getVersion.mockResolvedValue(version());
  });

  it('loads the list, keeps filters in the URL, and pages through results', async () => {
    apiMocks.listQuestions.mockResolvedValue({
      items: [summary],
      pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/question-bank']}>
        <Routes>
          <Route path="/admin/question-bank" element={<QuestionBankListPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    );

    expect(screen.getByText('Đang tải câu hỏi…')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'QB-2026-000001' })).toBeInTheDocument();
    expect(screen.getByText(/Trang 1\/2/)).toBeInTheDocument();
    expect(screen.queryByText('Hàng đợi duyệt')).not.toBeInTheDocument();
    expect(screen.queryByText('Import / Export')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Độ khó'), 'MEDIUM');
    await waitFor(() =>
      expect(screen.getByLabelText('location')).toHaveTextContent('difficulty=MEDIUM')
    );
    await user.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(screen.getByLabelText('location')).toHaveTextContent('page=2'));
  });

  it('hides a question from the library and can restore it', async () => {
    const retiredSummary = { ...summary, lifecycleStatus: 'RETIRED', revision: 1 };
    apiMocks.listQuestions
      .mockResolvedValueOnce({
        items: [summary],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      })
      .mockResolvedValue({
        items: [retiredSummary],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    apiMocks.transitionLifecycle.mockResolvedValue({ data: detail(null), etag: 'W/"question:' + QUESTION_ID + ':1"' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/question-bank']}>
        <Routes>
          <Route path="/admin/question-bank" element={<QuestionBankListPage />} />
        </Routes>
      </MemoryRouter>
    );

    const hideButton = await screen.findByRole('button', { name: 'Ẩn QB-2026-000001' });
    expect(hideButton).not.toBeDisabled();
    await user.click(hideButton);
    expect(confirm).toHaveBeenCalled();
    expect(apiMocks.createQuestionSummaryEtag).toHaveBeenCalledWith(summary);
    await waitFor(() => expect(apiMocks.transitionLifecycle).toHaveBeenCalledWith(
      QUESTION_ID,
      'retire',
      'Admin ẩn QB-2026-000001 khỏi thư viện',
      'W/"question:' + QUESTION_ID + ':0"',
      'qb-page-test-idempotency-key'
    ));
    await user.click(await screen.findByRole('button', { name: 'Khôi phục QB-2026-000001' }));
    await waitFor(() => expect(apiMocks.transitionLifecycle).toHaveBeenCalledWith(
      QUESTION_ID,
      'restore',
      'Admin khôi phục QB-2026-000001 vào thư viện',
      'W/"question:' + QUESTION_ID + ':1"',
      'qb-page-test-idempotency-key'
    ));
    confirm.mockRestore();
  });

  it('shows distinct empty, filtered-empty, and retry states', async () => {
    apiMocks.listQuestions
      .mockRejectedValueOnce({ message: 'Mạng tạm thời lỗi' })
      .mockResolvedValueOnce({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/question-bank?difficulty=HARD']}>
        <Routes>
          <Route path="/admin/question-bank" element={<QuestionBankListPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Mạng tạm thời lỗi');
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Không tìm thấy kết quả')).toBeInTheDocument();
  });

  it('validates and creates a library question, retaining the idempotency key', async () => {
    const createdVersion = version({
      content: {
        ...emptyQuestionVersionInput().content,
        prompt: { vi: 'Prompt mới', en: '' },
      },
    });
    const createdDetail = detail(createdVersion);
    apiMocks.createQuestion.mockResolvedValue({
      data: createdDetail,
      etag: 'W/"question-version:' + VERSION_ID + ':0"',
    });
    apiMocks.publishVersion.mockResolvedValue({
      data: version({ ...createdVersion, status: 'PUBLISHED', revision: 1 }),
      etag: 'W/"question-version:' + VERSION_ID + ':1"',
    });
    apiMocks.getQuestion.mockResolvedValue({
      data: createdDetail,
      etag: 'W/"question-version:' + VERSION_ID + ':0"',
    });
    const user = userEvent.setup();
    renderEditor('/admin/question-bank/questions/new');

    await user.click(screen.getByRole('button', { name: 'Thêm vào thư viện' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Cần nhập câu hỏi');

    await user.type(screen.getByLabelText('Câu hỏi (VI)'), 'Prompt mới');
    await user.type(screen.getByLabelText('Giải thích (VI)'), 'Giải thích cơ chế và các ý chính cần nắm.');
    await user.selectOptions(screen.getByLabelText('Loại câu hỏi'), 'TECHNICAL');
    await user.selectOptions(screen.getByLabelText('Độ khó'), 'MEDIUM');
    await user.type(screen.getByLabelText('Đáp án (VI)'), 'Đáp án mẫu');
    await user.type(screen.getByLabelText('Mục tiêu đánh giá (VI)'), 'Đánh giá khả năng hiểu và giải thích đúng bản chất.');
    await user.click(screen.getByRole('button', { name: 'Thêm vào thư viện' }));
    await waitFor(() => expect(apiMocks.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          prompt: expect.objectContaining({ vi: 'Prompt mới' }),
        }),
      }),
      'qb-page-test-idempotency-key'
    ));
    await waitFor(() => expect(apiMocks.publishVersion).toHaveBeenCalledWith(
      QUESTION_ID,
      1,
      'W/"question-version:' + VERSION_ID + ':0"',
      'qb-page-test-idempotency-key',
      'Admin tạo câu hỏi và đưa vào thư viện',
      true
    ));
    await waitFor(() => expect(screen.getByLabelText('location')).toHaveTextContent(
      '/admin/question-bank/questions/' + QUESTION_ID + '/edit'
    ));
  });

  it('shows only the focused authoring fields', () => {
    renderEditor('/admin/question-bank/questions/new');

    expect(screen.getByLabelText('Câu hỏi (VI)')).toBeInTheDocument();
    expect(screen.getByLabelText('Câu hỏi (EN) — tùy chọn')).toBeInTheDocument();
    expect(screen.getByLabelText('Giải thích (VI)')).toBeInTheDocument();
    expect(screen.getByLabelText('Giải thích (EN) — tùy chọn')).toBeInTheDocument();
    expect(screen.getByLabelText('Đáp án (VI)')).toBeInTheDocument();
    expect(screen.getByLabelText('Mục tiêu đánh giá (VI)')).toBeInTheDocument();
    expect(screen.getByLabelText('Loại câu hỏi')).toBeInTheDocument();
    expect(screen.getByLabelText('Độ khó')).toBeInTheDocument();
    expect(screen.getByLabelText('Topic — tùy chọn')).toBeInTheDocument();
    expect(screen.getByLabelText('Tags — phân cách bằng dấu phẩy')).toBeInTheDocument();
    expect(screen.getByText('Rubric')).toBeInTheDocument();
    expect(screen.queryByText('Preview cho Candidate')).not.toBeInTheDocument();
    expect(screen.queryByText('AI Translate')).not.toBeInTheDocument();
  });

  it('loads and explicitly saves an existing Draft with its ETag', async () => {
    const existing = version({
      content: {
        ...emptyQuestionVersionInput().content,
        prompt: { vi: 'Prompt ban đầu', en: '' },
      },
    });
    apiMocks.getQuestion.mockResolvedValue({
      data: detail(existing),
      etag: 'W/"question-version:' + VERSION_ID + ':0"',
    });
    apiMocks.updateDraft.mockResolvedValue({
      data: version({
        ...existing,

        revision: 1,
        content: { ...existing.content, prompt: { vi: 'Prompt đã sửa', en: '' } },
      }),
      etag: 'W/"question-version:' + VERSION_ID + ':1"',

    });
    const user = userEvent.setup();
    renderEditor('/admin/question-bank/questions/' + QUESTION_ID + '/edit');

    const prompt = await screen.findByLabelText('Câu hỏi (VI)');
    fireEvent.change(prompt, { target: { value: 'Prompt đã sửa' } });
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(apiMocks.updateDraft).toHaveBeenCalledWith(
      QUESTION_ID,
      1,
      expect.objectContaining({
        content: expect.objectContaining({
          prompt: expect.objectContaining({ vi: 'Prompt đã sửa' }),
        }),
      }),
      'W/"question-version:' + VERSION_ID + ':0"'
    ));
    expect(await screen.findByText((_, element) =>
      element?.tagName === 'P' && element.textContent?.includes('Revision 1') === true
    )).toBeInTheDocument();
  });

  it('preserves local content and exposes server state on an ETag conflict', async () => {
    const local = version({
      content: {
        ...emptyQuestionVersionInput().content,
        prompt: { vi: 'Bản server', en: '' },
      },
    });
    apiMocks.getQuestion.mockResolvedValue({
      data: detail(local),
      etag: 'W/"question-version:' + VERSION_ID + ':0"',
    });
    apiMocks.updateDraft.mockRejectedValue({
      status: 409,
      code: 'QUESTION_REVISION_CONFLICT',
      message: 'Revision đã thay đổi',
    });
    const user = userEvent.setup();
    renderEditor('/admin/question-bank/questions/' + QUESTION_ID + '/edit');

    const prompt = await screen.findByLabelText('Câu hỏi (VI)');
    fireEvent.change(prompt, { target: { value: 'Bản local cần giữ' } });
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText(/Xung đột chỉnh sửa/)).toBeInTheDocument();
    expect(screen.getByLabelText('Câu hỏi (VI)')).toHaveValue('Bản local cần giữ');
    expect(screen.getByText((_, element) =>
      element?.tagName === 'P' &&
      element.textContent?.includes('Server prompt VI: Bản server') === true
    )).toBeInTheDocument();
  });

  it('creates a new Draft from the current published snapshot', async () => {
    const published = version({ status: 'PUBLISHED', revision: 2 });
    const nextDraft = version({
      id: '507f1f77bcf86cd799439013',
      versionNumber: 2,
      provenance: { sourceVersionId: VERSION_ID, sourceReference: null },
    });
    apiMocks.getQuestion
      .mockResolvedValueOnce({
        data: detail(null, published),
        etag: 'W/"question:' + QUESTION_ID + ':0"',
      })
      .mockResolvedValueOnce({
        data: detail(nextDraft, published),
        etag: 'W/"question-version:' + nextDraft.id + ':0"',
      });
    apiMocks.createVersion.mockResolvedValue({
      data: nextDraft,
      etag: 'W/"question-version:' + nextDraft.id + ':0"',
    });
    const user = userEvent.setup();
    renderEditor('/admin/question-bank/questions/' + QUESTION_ID);

    await user.click(await screen.findByRole('button', {
      name: 'Tạo bản nháp chỉnh sửa',
    }));
    await waitFor(() => expect(apiMocks.createVersion).toHaveBeenCalledWith(
      QUESTION_ID,
      { sourceVersionNumber: 1 },
      'W/"question:' + QUESTION_ID + ':0"',
      'qb-page-test-idempotency-key'
    ));
    await waitFor(() =>
      expect(screen.getByLabelText('location')).toHaveTextContent('/edit')
    );
  });
});

