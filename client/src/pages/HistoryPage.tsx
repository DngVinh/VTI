import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  interviewApi,
  type BaseEntity,
  type InterviewHistoryItem,
} from '../services/api/interviewApi';
import { HistoryFilters } from '../features/InterviewHistory/HistoryFilters';
import { HistoryTable } from '../features/InterviewHistory/HistoryTable';
import { useInterviewHistory } from '../features/InterviewHistory/useInterviewHistory';
import { AppShell } from '../layouts/AppShell';
import { useTranslation } from '../locales/I18nContext';

const catalogMap = (items: BaseEntity[]) =>
  new Map(items.map((item) => [item._id, item.name]));

export const HistoryPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const {
    filters,
    result,
    isLoading,
    error,
    updateFilters,
    retry,
  } = useInterviewHistory();

  const [roles, setRoles] = useState<BaseEntity[]>([]);
  const [levels, setLevels] = useState<BaseEntity[]>([]);
  const [technologies, setTechnologies] = useState<BaseEntity[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      interviewApi.fetchRoles(),
      interviewApi.fetchLevels(),
      interviewApi.fetchTechnologies(),
    ])
      .then(([nextRoles, nextLevels, nextTechnologies]) => {
        if (cancelled) return;

        setRoles(nextRoles);
        setLevels(nextLevels);
        setTechnologies(nextTechnologies);
      })
      .finally(() => {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const roleNames = useMemo(() => catalogMap(roles), [roles]);
  const levelNames = useMemo(() => catalogMap(levels), [levels]);
  const technologyNames = useMemo(
    () => catalogMap(technologies),
    [technologies],
  );

  const openItem = (item: InterviewHistoryItem) => {
    if (item.status === 'COMPLETED') {
      navigate(`/interview/${item.sessionId}/result`);
      return;
    }

    if (item.status !== 'FAILED') {
      navigate(`/interview/${item.sessionId}`);
    }
  };

  const totalPages = result?.pagination.totalPages ?? 0;
  const page = result?.pagination.page ?? filters.page;
  const canPrevious = page > 1 && !isLoading;
  const canNext = page < totalPages && !isLoading;

  const totalCount = result?.pagination.total ?? 0;
  const completedCount = useMemo(
    () => result?.items.filter((i) => i.status === 'COMPLETED').length ?? 0,
    [result],
  );
  const inProgressItems = useMemo(
    () => result?.items.filter((i) => i.status === 'IN_PROGRESS') ?? [],
    [result],
  );
  const draftItem = inProgressItems[0];
  const averageScore = useMemo(() => {
    const scored = result?.items.filter((i) => typeof i.score === 'number' && i.score !== null) ?? [];
    if (!scored.length) return null;
    const sum = scored.reduce((acc, curr) => acc + (curr.score ?? 0), 0);
    return (sum / scored.length).toFixed(1);
  }, [result]);

  return (
    <AppShell>
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
              {t('history.badge', 'Interview History')}
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {t('history.title', 'Lịch sử phỏng vấn')}
            </h1>

            <p className="mt-1.5 max-w-2xl text-slate-600 text-sm">
              {t('history.subtitle', 'Xem lại các phiên phỏng vấn của bạn, lọc theo vị trí, cấp độ, công nghệ và trạng thái.')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/setup')}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 self-start sm:self-auto"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('history.newPractice', 'Luyện phỏng vấn mới')}
          </button>
        </header>

        {/* Quick Stats Banner */}
        {result && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('history.totalSessions', 'Tổng số phiên')}</p>
              <p className="mt-1.5 text-2xl font-black text-slate-900">{totalCount}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{t('history.completed', 'Đã hoàn thành')}</p>
              <p className="mt-1.5 text-2xl font-black text-emerald-700">{completedCount}</p>
            </div>
            <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-700">{t('history.drafts', 'Bản nháp / Đang làm')}</p>
              <p className="mt-1.5 text-2xl font-black text-purple-700">{inProgressItems.length}</p>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">{t('history.pageScore', 'Điểm trang này')}</p>
              <p className="mt-1.5 text-2xl font-black text-indigo-700">{averageScore ? `${averageScore} / 10` : '—'}</p>
            </div>
          </div>
        )}

        {/* Draft Resume Banner */}
        {draftItem && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50/40 to-white p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs shadow-purple-300">
                <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-extrabold text-slate-900 text-sm sm:text-base">
                  {t('history.draftPromptTitle', 'Bạn có phiên phỏng vấn đang làm dở!')}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {t('history.draftPromptDesc', 'Toàn bộ câu trả lời nháp đã được lưu tự động. Nhấn để tiếp tục làm bài bất kỳ lúc nào.')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openItem(draftItem)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-purple-200 transition hover:bg-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-100"
            >
              {t('history.continueNow', 'Tiếp tục bài thi ngay')}
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
          <div className="border-b border-slate-100 p-6">
            <HistoryFilters
              filters={filters}
              roles={roles}
              levels={levels}
              technologies={technologies}
              onChange={updateFilters}
            />

            {catalogLoading && (
              <p
                className="mt-3 text-xs font-medium text-slate-500"
                role="status"
              >
                {t('history.loadingCatalog', 'Đang tải danh mục hiển thị…')}
              </p>
            )}
          </div>

          <div className="p-6">
            {isLoading && (
              <div
                className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-500 text-sm font-medium"
                role="status"
                aria-live="polite"
              >
                {t('history.loadingHistory', 'Đang tải lịch sử phỏng vấn…')}
              </div>
            )}

            {!isLoading && error && (
              <div
                className="rounded-2xl border border-red-200 bg-red-50 px-5 py-5"
                role="alert"
              >
                <p className="font-bold text-red-800">
                  {t('history.errorTitle', 'Không thể tải lịch sử phỏng vấn')}
                </p>

                <p className="mt-1 text-sm text-red-700">{error}</p>

                <button
                  type="button"
                  onClick={retry}
                  className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100"
                >
                  {t('history.retry', 'Thử lại')}
                </button>
              </div>
            )}

            {!isLoading &&
              !error &&
              result &&
              result.items.length === 0 && (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-2xs mb-3">
                    <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {t('history.emptyTitle', 'Chưa có phiên phỏng vấn phù hợp')}
                  </h2>

                  <p className="mt-1 max-w-md text-sm text-slate-600">
                    {t('history.emptyDesc', 'Hãy thay đổi bộ lọc hoặc bắt đầu một phiên phỏng vấn mới.')}
                  </p>

                  <button
                    type="button"
                    onClick={() => navigate('/setup')}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-xs shadow-indigo-200 transition hover:bg-indigo-700"
                  >
                    {t('history.startNow', 'Bắt đầu phỏng vấn ngay')}
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              )}

            {!isLoading &&
              !error &&
              result &&
              result.items.length > 0 && (
                <HistoryTable
                  items={result.items}
                  roleNames={roleNames}
                  levelNames={levelNames}
                  technologyNames={technologyNames}
                  onOpen={openItem}
                />
              )}
          </div>

          {!isLoading && !error && result && (
            <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-slate-500">
                {t('history.page', 'Trang')}{' '}
                <span className="font-bold text-slate-700">{page}</span> /{' '}
                <span className="font-bold text-slate-700">
                  {totalPages}
                </span>{' '}
                · {result.pagination.total} {t('history.sessions', 'phiên')}
              </p>

              <nav
                aria-label={t('history.paginationAria', 'Phân trang lịch sử phỏng vấn')}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  aria-label={t('history.prevAria', 'Trang trước')}
                  disabled={!canPrevious}
                  onClick={() => updateFilters({ page: page - 1 })}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('history.prev', 'Trước')}
                </button>

                <span
                  aria-current="page"
                  className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white"
                >
                  {page}
                </span>

                <button
                  type="button"
                  aria-label={t('history.nextAria', 'Trang sau')}
                  disabled={!canNext}
                  onClick={() => updateFilters({ page: page + 1 })}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('history.next', 'Sau')}
                </button>
              </nav>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
};