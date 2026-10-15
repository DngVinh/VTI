import { useEffect, useState } from 'react';
import { QuestionBankNav } from '../components/QuestionBankNav';
import { questionBankApi } from '../api/questionBankApi';
import { AppShell } from '../../../layouts/AppShell';
import type { QuestionCoverageResult, QuestionAnalyticsResult } from '../types';
import { enumLabel } from '../components/enumLabels';

export const QuestionAnalyticsPage = () => {
  const [coverage, setCoverage] = useState<QuestionCoverageResult | null>(null);
  const [analytics, setAnalytics] = useState<QuestionAnalyticsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'coverage' | 'analytics'>('coverage');

  const handleRetry = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [covData, anaData] = await Promise.all([
        questionBankApi.getCoverage(),
        questionBankApi.getAnalytics(),
      ]);
      setCoverage(covData);
      setAnalytics(anaData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải số liệu thống kê & độ phủ';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const [covData, anaData] = await Promise.all([
          questionBankApi.getCoverage(),
          questionBankApi.getAnalytics(),
        ]);
        if (!ignore) {
          setCoverage(covData);
          setAnalytics(anaData);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const message = err instanceof Error ? err.message : 'Không thể tải số liệu thống kê & độ phủ';
          setError(message);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <AppShell>
      <main className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-sm font-bold uppercase tracking-widest text-indigo-700">Admin · Question Bank</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Độ phủ & Báo cáo Thống kê</h1>
          <p className="mt-2 text-slate-600">
            Giám sát độ đầy đủ của ngân hàng câu hỏi theo Taxonomy (Role, Level, Technology) và báo cáo quản trị vòng đời câu hỏi.
          </p>
        </header>

        <QuestionBankNav />

        {/* Tab switch */}
        <div className="mb-6 flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('coverage')}
            className={`border-b-2 px-4 py-2 font-bold text-sm transition-colors ${
              activeTab === 'coverage'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Độ phủ Taxonomy & Khoảng trống (Coverage & Gaps)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`border-b-2 px-4 py-2 font-bold text-sm transition-colors ${
              activeTab === 'analytics'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Thống kê Quản trị & Timeline (Analytics)
          </button>
        </div>

        {isLoading && (
          <div aria-live="polite" className="p-12 text-center font-semibold text-slate-600" role="status">
            Đang tải dữ liệu báo cáo…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800" role="alert">
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
              Thử lại
            </button>
          </div>
        )}

        {!isLoading && !error && activeTab === 'coverage' && coverage && (
          <div className="space-y-6">
            {/* Top Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">Tổng số câu hỏi</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{coverage.totalQuestions}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">Đang hoạt động (Active)</p>
                <p className="mt-2 text-3xl font-black text-emerald-600">{coverage.activeQuestions}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">Đã Publish (Active)</p>
                <p className="mt-2 text-3xl font-black text-indigo-600">{coverage.publishedActiveQuestions}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">Chỉ có Draft</p>
                <p className="mt-2 text-3xl font-black text-amber-600">{coverage.draftOnlyQuestions}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">Đã Retire</p>
                <p className="mt-2 text-3xl font-black text-slate-500">{coverage.retiredQuestions}</p>
              </div>
            </div>

            {/* Gaps Banner */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-2">Khoảng trống nội dung cần bổ sung (Coverage Gaps)</h2>
              <p className="text-sm text-slate-600 mb-4">Các chiều Taxonomy có ít hơn 3 câu hỏi đã publish (LOW_COVERAGE) hoặc chưa có câu hỏi nào (ZERO_COVERAGE).</p>
              {coverage.gaps.length === 0 ? (
                <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800 text-sm font-medium">
                  Không phát hiện khoảng trống nào! Tất cả phân loại đều có độ phủ tốt.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {coverage.gaps.map((gap, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-4 ${
                        gap.gapType === 'ZERO_COVERAGE'
                          ? 'border-red-200 bg-red-50 text-red-900'
                          : 'border-amber-200 bg-amber-50 text-amber-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase">{gap.dimension}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          gap.gapType === 'ZERO_COVERAGE' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                        }`}>
                          {gap.gapType === 'ZERO_COVERAGE' ? 'Chưa có câu hỏi' : 'Thiếu câu hỏi'}
                        </span>
                      </div>
                      <p className="mt-2 font-bold text-base">{gap.name || gap.id}</p>
                      <p className="mt-1 text-xs">Đã publish: {gap.publishedCount} câu</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Breakdown by Role and Level */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Độ phủ theo Vai trò (Role)</h2>
                <div className="divide-y divide-slate-100">
                  {coverage.byRole.map((r) => (
                    <div key={r.id} className="py-3 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">{r.name || r.id}</span>
                      <div className="flex gap-4 text-xs">
                        <span className="text-emerald-700 font-bold">{r.publishedCount} published</span>
                        <span className="text-slate-500">{r.draftCount} draft</span>
                        <span className="text-slate-800 font-medium">{r.totalCount} tổng</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Độ phủ theo Cấp độ (Level)</h2>
                <div className="divide-y divide-slate-100">
                  {coverage.byLevel.map((l) => (
                    <div key={l.id} className="py-3 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">{l.name || l.id}</span>
                      <div className="flex gap-4 text-xs">
                        <span className="text-emerald-700 font-bold">{l.publishedCount} published</span>
                        <span className="text-slate-500">{l.draftCount} draft</span>
                        <span className="text-slate-800 font-medium">{l.totalCount} tổng</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !error && activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">Tổng số câu hỏi</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{analytics.summary.totalQuestions}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">Tổng số phiên bản</p>
                <p className="mt-2 text-3xl font-black text-indigo-600">{analytics.summary.totalVersions}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">Đang chờ review</p>
                <p className="mt-2 text-3xl font-black text-amber-600">{analytics.summary.inReviewVersions}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">Phiên bản đã publish</p>
                <p className="mt-2 text-3xl font-black text-emerald-600">{analytics.summary.publishedVersions}</p>
              </div>
            </div>

            {/* Distributions */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-3">Phân bố Nguồn gốc (Origin)</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(analytics.originDistribution).map(([orig, cnt]) => (
                    <div key={orig} className="flex justify-between">
                      <span className="text-slate-600">{enumLabel(orig)}</span>
                      <span className="font-bold text-slate-900">{cnt}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-3">Phân bố Độ khó (Difficulty)</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(analytics.difficultyDistribution).map(([diff, cnt]) => (
                    <div key={diff} className="flex justify-between">
                      <span className="text-slate-600">{enumLabel(diff)}</span>
                      <span className="font-bold text-slate-900">{cnt}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-3">Trạng thái Phiên bản (Version)</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(analytics.versionStatusDistribution).map(([st, cnt]) => (
                    <div key={st} className="flex justify-between">
                      <span className="text-slate-600">{enumLabel(st)}</span>
                      <span className="font-bold text-slate-900">{cnt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">Lịch sử hoạt động theo ngày (Activity Timeline)</h3>
              {analytics.activityTimeline.length === 0 ? (
                <p className="text-center text-slate-500 py-6">Chưa có hoạt động nào được ghi nhận.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                      <tr>
                        <th className="pb-3">Ngày</th>
                        <th className="pb-3 text-center">Gửi duyệt</th>
                        <th className="pb-3 text-center">Duyệt đạt</th>
                        <th className="pb-3 text-center">Yêu cầu sửa</th>
                        <th className="pb-3 text-center">Publish</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analytics.activityTimeline.map((item) => (
                        <tr key={item.date} className="hover:bg-slate-50">
                          <td className="py-2.5 font-mono text-slate-700">{item.date}</td>
                          <td className="py-2.5 text-center font-semibold text-slate-900">{item.submissions}</td>
                          <td className="py-2.5 text-center font-semibold text-emerald-600">{item.approvals}</td>
                          <td className="py-2.5 text-center font-semibold text-amber-600">{item.changesRequested}</td>
                          <td className="py-2.5 text-center font-semibold text-indigo-600">{item.publishes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  </AppShell>
);
};
