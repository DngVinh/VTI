import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { interviewApi, type BaseEntity } from '../services/api/interviewApi';
import { AnalyticsFilters } from '../features/InterviewAnalytics/AnalyticsFilters';
import { AnalyticsChart } from '../features/InterviewAnalytics/AnalyticsChart';
import { useInterviewAnalytics } from '../features/InterviewAnalytics/useInterviewAnalytics';
import {
  DIMENSIONS,
  DIMENSION_LABELS,
} from '../features/InterviewAnalytics/constants';
import { AppShell } from '../layouts/AppShell';

const averageLabel = (value: number | null) => (value == null ? '—' : `${value.toFixed(2)} / 10`);

export const AnalyticsPage = () => {
  const navigate = useNavigate();
  const { filters, data, isLoading, error, updateFilters, retry } = useInterviewAnalytics();
  const [roles, setRoles] = useState<BaseEntity[]>([]);
  const [levels, setLevels] = useState<BaseEntity[]>([]);
  const [technologies, setTechnologies] = useState<BaseEntity[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      interviewApi.fetchRoles(),
      interviewApi.fetchLevels(),
      interviewApi.fetchTechnologies(),
    ]).then(([nextRoles, nextLevels, nextTechnologies]) => {
      if (cancelled) return;
      setRoles(nextRoles);
      setLevels(nextLevels);
      setTechnologies(nextTechnologies);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dimensionScores = useMemo(
    () => new Map(data?.summary.dimensions.map((dimension) => [dimension.name, dimension.score]) ?? []),
    [data]
  );

  // Identify highest and lowest scoring dimensions for guidance
  const dimensionInsights = useMemo(() => {
    if (!data?.summary.dimensions.length) return { best: null, improve: null };
    const valid = data.summary.dimensions.filter((d) => typeof d.score === 'number' && d.score !== null);
    if (!valid.length) return { best: null, improve: null };

    const sorted = [...valid].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const best = typeof sorted[0]?.score === 'number' && sorted[0].score >= 7.0 ? sorted[0].name : null;
    const improve =
      typeof sorted[sorted.length - 1]?.score === 'number' && (sorted[sorted.length - 1].score ?? 0) < 8.0
        ? sorted[sorted.length - 1].name
        : null;
    return { best, improve };
  }, [data]);

  const ratingBadge = useMemo(() => {
    const avg = data?.summary.averageOverallScore;
    if (avg == null) return null;
    if (avg >= 8) return 'Xuất sắc';
    if (avg >= 6.5) return 'Khá';
    return 'Cần rèn luyện';
  }, [data?.summary.averageOverallScore]);

  return (
    <AppShell>
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
              Analytics & Progress
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Tiến bộ phỏng vấn</h1>
            <p className="mt-1.5 max-w-2xl text-slate-600 text-sm">Theo dõi xu hướng điểm số và đánh giá đa chiều các phiên phỏng vấn đã hoàn thành theo thời gian.</p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/setup')}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 self-start sm:self-auto"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Luyện phỏng vấn mới
          </button>
        </header>

        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
          <div className="border-b border-slate-100 p-6">
            <AnalyticsFilters filters={filters} roles={roles} levels={levels} technologies={technologies} onChange={updateFilters} />
          </div>

          <div className="p-6">
            {isLoading && (
              <div className="flex min-h-56 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-500 text-sm font-medium" role="status" aria-live="polite">
                Đang tải dữ liệu phân tích…
              </div>
            )}

            {!isLoading && error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-5" role="alert">
                <p className="font-bold text-red-800">Không thể tải dữ liệu phân tích</p>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button type="button" onClick={retry} className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100">
                  Thử lại
                </button>
              </div>
            )}

            {!isLoading && !error && data && data.series.length === 0 && (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-2xs mb-3">
                  <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900">Chưa có dữ liệu xu hướng</h2>
                <p className="mt-1 max-w-md text-sm text-slate-600">Hãy hoàn thành thêm một phiên phỏng vấn hoặc thử thay đổi bộ lọc và khoảng thời gian.</p>
                <button
                  type="button"
                  onClick={() => navigate('/setup')}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-xs shadow-indigo-200 transition hover:bg-indigo-700"
                >
                  Bắt đầu phỏng vấn ngay
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            )}

            {!isLoading && !error && data && data.series.length > 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <article className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Phiên hoàn thành</p>
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs">✓</span>
                    </div>
                    <p className="mt-2 text-3xl font-black text-slate-900">{data.summary.totalCompleted}</p>
                    <p className="mt-1 text-xs text-slate-500">Tổng số phiên thi được ghi nhận điểm số</p>
                  </article>

                  <article className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Điểm tổng thể</p>
                      {ratingBadge && (
                        <span className="inline-flex rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                          {ratingBadge}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-3xl font-black text-indigo-700">{averageLabel(data.summary.averageOverallScore)}</p>
                    <p className="mt-1 text-xs text-indigo-600/80">Trung bình cộng điểm số tất cả các phiên</p>
                  </article>

                  {DIMENSIONS.map((name) => {
                    const score = dimensionScores.get(name) ?? null;
                    const percentage = score !== null ? Math.min(100, Math.max(0, (score / 10) * 100)) : 0;
                    const isBest = dimensionInsights.best === name;
                    const isImprove = dimensionInsights.improve === name && !isBest;

                    return (
                      <article key={name} className="relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition hover:border-slate-300">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{DIMENSION_LABELS[name]}</p>
                          {isBest && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                              ★ Thế mạnh
                            </span>
                          )}
                          {isImprove && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                              Cần rèn luyện
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-2xl font-black text-slate-900">{averageLabel(score)}</p>

                        {/* Visual Progress Bar */}
                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              score === null
                                ? 'bg-slate-300'
                                : score >= 8
                                ? 'bg-emerald-500'
                                : score >= 6.5
                                ? 'bg-indigo-500'
                                : score >= 5
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>

                <section className="mt-8" aria-labelledby="analytics-chart-title">
                  <div className="mb-4">
                    <h2 id="analytics-chart-title" className="text-xl font-extrabold text-slate-900">Xu hướng điểm theo ngày</h2>
                    <p className="mt-1 text-sm text-slate-500">Mỗi điểm dữ liệu là trung bình của các phiên hoàn thành trong ngày UTC tương ứng.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-5 shadow-xs">
                    <AnalyticsChart series={data.series} />
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
};

