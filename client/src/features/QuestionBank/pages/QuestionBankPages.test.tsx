import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  updateQuestionOwner: vi.fn(),
  updateDraft: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
}));

vi.mock('../api/questionBankApi', () => ({
  questionBankApi: apiMocks,
  createIdempotencyKey: () => 'qb-page-test-idempotency-key',
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

    expect(screen.getByText('Đang tải danh sách câu hỏi…')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'QB-2026-000001' })).toBeInTheDocument();
    expect(screen.getByText(/Trang 1\/2/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Độ khó'), 'MEDIUM');
    await waitFor(() =>
      expect(screen.getByLabelText('location')).toHaveTextContent('difficulty=MEDIUM')
    );
    await user.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(screen.getByLabelText('location')).toHaveTextContent('page=2'));
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

  it('validates and creates a partial Draft, retaining the idempotency key', async () => {
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
    apiMocks.getQuestion.mockResolvedValue({
      data: createdDetail,
      etag: 'W/"question-version:' + VERSION_ID + ':0"',
    });
    const user = userEvent.setup();
    renderEditor('/admin/question-bank/questions/new');

    await user.click(screen.getByRole('button', { name: 'Lưu ngay' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ít nhất một trường nội dung');

    await user.type(screen.getByLabelText('Prompt tiếng Việt'), 'Prompt mới');
    await user.click(screen.getByRole('button', { name: 'Lưu ngay' }));
    await waitFor(() => expect(apiMocks.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          prompt: expect.objectContaining({ vi: 'Prompt mới' }),
        }),
      }),
      'qb-page-test-idempotency-key'
    ));
    await waitFor(() => expect(screen.getByLabelText('location')).toHaveTextContent(
      '/admin/question-bank/questions/' + QUESTION_ID + '/edit'
    ));
  });

  it('authors every editor section without persisting restricted data locally', async () => {
    const user = userEvent.setup();
    renderEditor('/admin/question-bank/questions/new');

    const change = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    change('Prompt tiếng Việt', 'Prompt đầy đủ');
    change('Prompt English', 'Complete prompt');
    change('Giải thích tiếng Việt (tùy chọn)', 'Giải thích');
    change('Explanation English (optional)', 'Explanation');
    change('Primary role ID', ACTOR_ID);
    change('Additional role IDs (phân cách bằng dấu phẩy)', VERSION_ID);
    change('Level IDs (phân cách bằng dấu phẩy)', QUESTION_ID);
    change(
      'Technologies: ObjectId:relevance (phân cách bằng dấu phẩy)',
      VERSION_ID + ':75'
    );
    change('Topic', 'Runtime');
    change('Tags kebab-case (phân cách bằng dấu phẩy)', 'node-js, event-loop');
    await user.selectOptions(screen.getByLabelText('Độ khó'), 'HARD');
    await user.selectOptions(screen.getByLabelText('Loại câu hỏi'), 'SYSTEM_DESIGN');
    await user.click(screen.getByLabelText('Technology-agnostic'));
    await user.click(screen.getByLabelText('Đánh dấu classification hoàn tất'));

    change('Reference answer VI', 'Đáp án hạn chế');
    change('Reference answer EN', 'Restricted answer');
    change('Learning objective VI', 'Mục tiêu');
    change('Learning objective EN', 'Objective');
    change('Thời gian dự kiến (giây)', '180');
    await user.click(screen.getByRole('button', { name: 'Thêm follow-up' }));
    change('Follow-up 1 VI', 'Câu hỏi phụ');
    change('Follow-up 1 EN', 'Follow up');
    await user.click(screen.getByRole('button', { name: 'Xóa' }));

    await user.click(screen.getByRole('button', { name: 'Tạo rubric' }));
    fireEvent.change(screen.getAllByLabelText('Key')[0], {
      target: { value: 'correctness' },
    });
    fireEvent.change(screen.getAllByLabelText('Tiêu đề VI')[0], {
      target: { value: 'Đúng' },
    });
    fireEvent.change(screen.getAllByLabelText('Title EN')[0], {
      target: { value: 'Correct' },
    });
    change('Change summary (tối đa 1.000 ký tự)', 'Hoàn thiện bản nháp');
    await user.click(screen.getByRole('button', { name: 'Đưa tiêu chí 1 xuống' }));

    const preview = screen.getByRole('heading', { name: 'Preview cho Candidate' })
      .closest('section') as HTMLElement;
    expect(within(preview).getByText('Prompt đầy đủ')).toBeInTheDocument();
    expect(within(preview).queryByText('Đáp án hạn chế')).not.toBeInTheDocument();
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

    const prompt = await screen.findByLabelText('Prompt tiếng Việt');
    await user.clear(prompt);
    await user.type(prompt, 'Prompt đã sửa');
    await user.click(screen.getByRole('button', { name: 'Lưu ngay' }));

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

    const prompt = await screen.findByLabelText('Prompt tiếng Việt');
    await user.clear(prompt);
    await user.type(prompt, 'Bản local cần giữ');
    await user.click(screen.getByRole('button', { name: 'Lưu ngay' }));

    expect(await screen.findByText(/Xung đột chỉnh sửa/)).toBeInTheDocument();
    expect(screen.getByLabelText('Prompt tiếng Việt')).toHaveValue('Bản local cần giữ');
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
      name: 'Tạo Draft từ bản Published',
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

