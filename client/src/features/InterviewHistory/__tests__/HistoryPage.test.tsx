import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { HistoryPage } from '../../../pages/HistoryPage';
import { interviewApi } from '../../../services/api/interviewApi';

vi.mock('../../../services/api/interviewApi', async () => {
  const actual =
    await vi.importActual<
      typeof import('../../../services/api/interviewApi')
    >('../../../services/api/interviewApi');

  return {
    ...actual,
    interviewApi: {
      ...actual.interviewApi,
      fetchInterviewHistory: vi.fn(),
      fetchRoles: vi.fn(),
      fetchLevels: vi.fn(),
      fetchTechnologies: vi.fn(),
    },
  };
});

const history = {
  items: [
    {
      sessionId: 'session-completed-1',
      role: 'role-1',
      level: 'level-1',
      technologies: ['tech-1', 'missing-tech'],
      score: 8.5,
      status: 'COMPLETED' as const,
      createdAt: '2026-09-10T08:00:00.000Z',
      updatedAt: '2026-09-10T08:30:00.000Z',
    },
  ],
  pagination: {
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  },
};

const LocationProbe = () => (
  <output data-testid="location">
    {useLocation().pathname}
    {useLocation().search}
  </output>
);

const renderPage = (entry = '/history') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <HistoryPage />
      <LocationProbe />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(interviewApi.fetchRoles).mockResolvedValue([
    {
      _id: 'role-1',
      code: 'BE',
      name: 'Backend Developer',
    },
  ]);

  vi.mocked(interviewApi.fetchLevels).mockResolvedValue([
    {
      _id: 'level-1',
      code: 'JUNIOR',
      name: 'Junior',
    },
  ]);

  vi.mocked(interviewApi.fetchTechnologies).mockResolvedValue([
    {
      _id: 'tech-1',
      code: 'NODE',
      name: 'Node.js',
    },
  ]);

  vi.mocked(interviewApi.fetchInterviewHistory).mockResolvedValue(history);
});

afterEach(() => {
  cleanup();
});

describe('HistoryPage', () => {
  it('loads real history data and maps catalog ids to display names once', async () => {
    renderPage();

    expect(
      await screen.findByRole('cell', {
        name: 'Backend Developer',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('cell', {
        name: 'Junior',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('cell', {
        name: /Node\.js/,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Không xác định'),
    ).toBeInTheDocument();

    expect(interviewApi.fetchRoles).toHaveBeenCalledTimes(1);
    expect(interviewApi.fetchLevels).toHaveBeenCalledTimes(1);
    expect(interviewApi.fetchTechnologies).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', async () => {
    vi.mocked(interviewApi.fetchInterviewHistory).mockReturnValue(
      new Promise(() => {}),
    );

    renderPage();

    expect(
      screen.getByText('Đang tải lịch sử phỏng vấn…'),
    ).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    vi.mocked(interviewApi.fetchInterviewHistory).mockResolvedValue({
      ...history,
      items: [],
      pagination: {
        ...history.pagination,
        total: 0,
        totalPages: 0,
      },
    });

    renderPage();

    expect(
      await screen.findByText('Chưa có phiên phỏng vấn phù hợp'),
    ).toBeInTheDocument();
  });

  it('shows error and retries with the same query', async () => {
    vi.mocked(interviewApi.fetchInterviewHistory)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(history);

    renderPage('/history?role=role-1&sort=oldest&page=2');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Network error',
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Thử lại',
      }),
    );

    await waitFor(() =>
      expect(
        interviewApi.fetchInterviewHistory,
      ).toHaveBeenCalledTimes(2),
    );

    expect(
      vi.mocked(interviewApi.fetchInterviewHistory).mock.calls[0][0],
    ).toMatchObject({
      role: 'role-1',
      sort: 'oldest',
      page: 2,
    });

    expect(
      vi.mocked(interviewApi.fetchInterviewHistory).mock.calls[1][0],
    ).toMatchObject({
      role: 'role-1',
      sort: 'oldest',
      page: 2,
    });
  });

  it('restores URL query state on reload and sends it to API', async () => {
    renderPage(
      '/history?role=role-1&level=level-1&technology=tech-1&status=COMPLETED&from=2026-09-01&to=2026-09-10&sort=oldest&page=3&limit=20',
    );

    await screen.findByRole('cell', {
      name: 'Backend Developer',
    });

    expect(
      screen.getByLabelText('Vai trò phỏng vấn'),
    ).toHaveValue('role-1');

    expect(
      screen.getByLabelText('Cấp độ'),
    ).toHaveValue('level-1');

    expect(
      screen.getByLabelText('Công nghệ'),
    ).toHaveValue('tech-1');

    expect(
      screen.getByLabelText('Trạng thái'),
    ).toHaveValue('COMPLETED');

    expect(
      screen.getByLabelText('Từ ngày'),
    ).toHaveValue('2026-09-01');

    expect(
      screen.getByLabelText('Đến ngày'),
    ).toHaveValue('2026-09-10');

    expect(
      screen.getByLabelText('Sắp xếp'),
    ).toHaveValue('oldest');

    expect(
      screen.getByLabelText('Số mục mỗi trang'),
    ).toHaveValue('20');

    expect(
      vi.mocked(interviewApi.fetchInterviewHistory),
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 3,
        limit: 20,
        role: 'role-1',
        level: 'level-1',
        technology: 'tech-1',
        status: 'COMPLETED',
        from: '2026-09-01',
        to: '2026-09-10',
        sort: 'oldest',
      }),
    );
  });

  it('sends filter, sort and pagination changes to the API query', async () => {
    renderPage();

    await screen.findByRole('cell', {
      name: 'Backend Developer',
    });

    fireEvent.change(
      screen.getByLabelText('Vai trò phỏng vấn'),
      {
        target: { value: 'role-1' },
      },
    );

    await waitFor(() =>
      expect(
        interviewApi.fetchInterviewHistory,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          role: 'role-1',
          page: 1,
        }),
      ),
    );

    expect(
      screen.getByTestId('location'),
    ).toHaveTextContent('/history?role=role-1');

    fireEvent.change(
      screen.getByLabelText('Sắp xếp'),
      {
        target: { value: 'oldest' },
      },
    );

    await waitFor(() =>
      expect(
        interviewApi.fetchInterviewHistory,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          role: 'role-1',
          sort: 'oldest',
          page: 1,
        }),
      ),
    );

    expect(
      screen.getByTestId('location'),
    ).toHaveTextContent(
      '/history?role=role-1&sort=oldest',
    );
  });

  it('navigates completed session using the API sessionId and never treats failed as result-ready', async () => {
    vi.mocked(interviewApi.fetchInterviewHistory).mockResolvedValue({
      ...history,
      items: [
        history.items[0],
        {
          ...history.items[0],
          sessionId: 'session-failed-2',
          status: 'FAILED',
        },
      ],
      pagination: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    });

    renderPage();

    const completedButton = await screen.findByRole(
      'button',
      {
        name: 'Xem kết quả',
      },
    );

    expect(completedButton).toBeEnabled();

    fireEvent.click(completedButton);

    expect(
      screen.getByTestId('location'),
    ).toHaveTextContent(
      '/interview/session-completed-1/result',
    );

    const failedButton = screen.getByRole(
      'button',
      {
        name: 'Không khả dụng',
      },
    );

    expect(failedButton).toBeDisabled();
  });

  it('respects pagination boundaries and syncs page changes', async () => {
    vi.mocked(interviewApi.fetchInterviewHistory).mockResolvedValue({
      ...history,
      pagination: {
        total: 21,
        page: 1,
        limit: 10,
        totalPages: 3,
      },
    });

    renderPage();

    await screen.findByRole('cell', {
      name: 'Backend Developer',
    });

    expect(
      screen.getByRole('button', {
        name: 'Trang trước',
      }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Trang sau',
      }),
    );

    await waitFor(() =>
      expect(
        interviewApi.fetchInterviewHistory,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 2,
        }),
      ),
    );

    expect(
      screen.getByTestId('location'),
    ).toHaveTextContent('/history?page=2');
  });

  it('navigates PENDING to its interview session using item.sessionId', async () => {
    vi.mocked(interviewApi.fetchInterviewHistory).mockResolvedValue({
      ...history,
      items: [
        {
          ...history.items[0],
          sessionId: 'session-pending-1',
          status: 'PENDING',
        },
      ],
    });

    renderPage();

    expect(
      await screen.findByRole('cell', {
        name: 'Chờ xử lý',
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Mở phiên',
      }),
    );

    expect(
      screen.getByTestId('location'),
    ).toHaveTextContent(
      '/interview/session-pending-1',
    );
  });

  it('navigates GENERATING to its interview session using item.sessionId', async () => {
    vi.mocked(interviewApi.fetchInterviewHistory).mockResolvedValue({
      ...history,
      items: [
        {
          ...history.items[0],
          sessionId: 'session-generating-1',
          status: 'GENERATING',
        },
      ],
    });

    renderPage();

    expect(
      await screen.findByRole('cell', {
        name: 'Đang tạo câu hỏi',
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Mở phiên',
      }),
    );

    expect(
      screen.getByTestId('location'),
    ).toHaveTextContent(
      '/interview/session-generating-1',
    );
  });

  it('navigates IN_PROGRESS to its interview session using item.sessionId', async () => {
    vi.mocked(interviewApi.fetchInterviewHistory).mockResolvedValue({
      ...history,
      items: [
        {
          ...history.items[0],
          sessionId: 'session-in-progress-1',
          status: 'IN_PROGRESS',
        },
      ],
    });

    renderPage();

    expect(
      await screen.findByRole('cell', {
        name: 'Đang phỏng vấn',
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Mở phiên',
      }),
    );

    expect(
      screen.getByTestId('location'),
    ).toHaveTextContent(
      '/interview/session-in-progress-1',
    );
  });

  it('navigates EVALUATING to its interview session using item.sessionId', async () => {
    vi.mocked(interviewApi.fetchInterviewHistory).mockResolvedValue({
      ...history,
      items: [
        {
          ...history.items[0],
          sessionId: 'session-evaluating-1',
          status: 'EVALUATING',
        },
      ],
    });

    renderPage();

    expect(
      await screen.findByRole('cell', {
        name: 'Đang đánh giá',
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Mở phiên',
      }),
    );

    expect(
      screen.getByTestId('location'),
    ).toHaveTextContent(
      '/interview/session-evaluating-1',
    );
  });

  it('does not navigate FAILED to a result or interview session', async () => {
    vi.mocked(interviewApi.fetchInterviewHistory).mockResolvedValue({
      ...history,
      items: [
        {
          ...history.items[0],
          sessionId: 'session-failed-1',
          status: 'FAILED',
        },
      ],
    });

    renderPage();

    expect(
      await screen.findByRole('cell', {
        name: 'Thất bại',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Không khả dụng',
      }),
    ).toBeDisabled();

    expect(
      screen.getByTestId('location'),
    ).toHaveTextContent('/history');
  });

  it('renders English header and quick stats when I18nContext is English', async () => {
    const { I18nProvider } = await import('../../../locales/I18nContext');

    render(
      <MemoryRouter initialEntries={['/history']}>
        <I18nProvider defaultLocale="en">
          <HistoryPage />
        </I18nProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('New Practice Session')).toBeInTheDocument();
    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
  });
});
