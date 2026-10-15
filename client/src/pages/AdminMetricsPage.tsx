import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  useAdminMetrics
} from '../features/AdminMetrics/useAdminMetrics';

import type {
  AdminMetricsDateRange
} from '../features/AdminMetrics/types';
import { AppShell } from '../layouts/AppShell';
import { useTranslation } from '../locales/I18nContext';

const formatDateForInput = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
};

const toStartOfDayIso = (value: string) => {
  return new Date(
    `${value}T00:00:00.000Z`
  ).toISOString();
};

const toEndExclusiveIso = (value: string) => {
  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString();
};

export const AdminMetricsPage = () => {
  const { t } = useTranslation();
  const {
    dateRange,
    metrics,
    isLoading,
    error,
    handleDateRangeChange,
    handleReload
  } = useAdminMetrics();

  const [from, setFrom] = useState(
    formatDateForInput(dateRange.from)
  );

  const [to, setTo] = useState(
    formatDateForInput(
      new Date(
        new Date(dateRange.to).getTime() -
          24 * 60 * 60 * 1000
      ).toISOString()
    )
  );

  const [validationError, setValidationError] =
    useState<string | null>(null);

  const handleApply = () => {
    if (!from || !to) {
      setValidationError(
        'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.'
      );
      return;
    }

    if (from > to) {
      setValidationError(
        'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.'
      );
      return;
    }

    setValidationError(null);

    const nextRange: AdminMetricsDateRange = {
      from: toStartOfDayIso(from),
      to: toEndExclusiveIso(to)
    };

    handleDateRangeChange(nextRange);
  };

  return (
    <AppShell>
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
              {t('admin.overviewBadge', 'Admin Overview')}
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
              {t('admin.dashboardTitle', 'Dashboard Thống Kê')}
            </h1>
            <p className="mt-1 text-slate-500 text-sm">
              {t('admin.dashboardSubtitle', 'Tổng quan toàn bộ người dùng, số phiên phỏng vấn và lượng token AI tiêu thụ.')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/admin/users"
              className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-semibold shadow-xs hover:bg-slate-50 transition"
            >
              {t('admin.manageUsers', 'Quản lý Users')}
            </Link>
            <Link
              to="/admin/system-prompts"
              className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-semibold shadow-xs hover:bg-slate-50 transition"
            >
              {t('admin.systemPrompts', 'System Prompts')}
            </Link>
            <button
              onClick={handleReload}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('admin.reload', 'Tải lại')}
            </button>
          </div>
        </div>

        {/* Main card */}
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
          {/* Filters */}
          <div className="border-b border-slate-100 p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <label
                  htmlFor="metrics-from"
                  className="mb-1.5 block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  {t('admin.fromDate', 'Từ ngày')}
                </label>

                <input
                  id="metrics-from"
                  type="date"
                  value={from}
                  onChange={(event) =>
                    setFrom(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label
                  htmlFor="metrics-to"
                  className="mb-1.5 block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  {t('admin.toDate', 'Đến ngày')}
                </label>

                <input
                  id="metrics-to"
                  type="date"
                  value={to}
                  onChange={(event) =>
                    setTo(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <button
                type="button"
                onClick={handleApply}
                disabled={isLoading}
                className="self-end rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('admin.apply', 'Áp dụng')}
              </button>
            </div>

            {validationError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {validationError}
              </div>
            )}
          </div>

          {/* Feedback */}
          {(error || isLoading) && (
            <div className="px-6 pt-6">
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              {isLoading && !error && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
                  {t('admin.loadingMetrics', 'Đang tải dữ liệu thống kê...')}
                </div>
              )}
            </div>
          )}

          <div className="p-6">
            {!metrics && !isLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center">
                <p className="text-sm font-semibold text-slate-500">
                  {t('admin.noMetrics', 'Không có số liệu cho khoảng thời gian đã chọn.')}
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* User metrics */}
                <section>
                  <div className="mb-4">
                    <h2 className="text-lg font-bold text-slate-900">
                      {t('admin.usersTitle', 'Người dùng (Users)')}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {t('admin.usersSubtitle', 'Tổng số tài khoản trong hệ thống')}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label={t('admin.totalUsers', 'Tổng người dùng')}
                      value={metrics?.users.total ?? 0}
                    />

                    <MetricCard
                      label={t('admin.activeUsers', 'Hoạt động (Active)')}
                      value={metrics?.users.active ?? 0}
                    />

                    <MetricCard
                      label={t('admin.lockedUsers', 'Bị khóa (Locked)')}
                      value={metrics?.users.locked ?? 0}
                    />

                    <MetricCard
                      label={t('admin.inactiveUsers', 'Chưa kích hoạt (Inactive)')}
                      value={metrics?.users.inactive ?? 0}
                    />
                  </div>
                </section>

                {/* Interview metrics */}
                <section>
                  <div className="mb-4">
                    <h2 className="text-lg font-bold text-slate-900">
                      {t('admin.interviewsTitle', 'Phiên phỏng vấn (Interviews)')}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {t('admin.interviewsSubtitle', 'Số phiên thi được khởi tạo trong khoảng thời gian đã chọn')}
                    </p>
                  </div>

                  <div className="mb-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {t('admin.totalInterviews', 'Tổng số phiên phỏng vấn')}
                    </div>

                    <div className="mt-2 text-3xl font-black text-slate-900">
                      {metrics?.interviews.total ?? 0}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <StatusCard
                      label="Pending"
                      value={
                        metrics?.interviews.byStatus.PENDING ??
                        0
                      }
                    />

                    <StatusCard
                      label="Generating"
                      value={
                        metrics?.interviews.byStatus.GENERATING ??
                        0
                      }
                    />

                    <StatusCard
                      label="In Progress"
                      value={
                        metrics?.interviews.byStatus.IN_PROGRESS ??
                        0
                      }
                    />

                    <StatusCard
                      label="Evaluating"
                      value={
                        metrics?.interviews.byStatus.EVALUATING ??
                        0
                      }
                    />

                    <StatusCard
                      label="Completed"
                      value={
                        metrics?.interviews.byStatus.COMPLETED ??
                        0
                      }
                    />

                    <StatusCard
                      label="Failed"
                      value={
                        metrics?.interviews.byStatus.FAILED ??
                        0
                      }
                    />
                  </div>
                </section>

                {/* Token metrics */}
                <section>
                  <div className="mb-4">
                    <h2 className="text-lg font-bold text-slate-900">
                      Tiêu thụ AI Tokens
                    </h2>
                    <p className="text-xs text-slate-500">
                      Tổng lượng token sử dụng cho sinh câu hỏi và chấm điểm
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      label="Prompt Tokens"
                      value={
                        metrics?.interviews.promptTokens ??
                        0
                      }
                    />

                    <MetricCard
                      label="Candidate Tokens"
                      value={
                        metrics?.interviews
                          .candidatesTokens ?? 0
                      }
                    />

                    <MetricCard
                      label="Total Tokens"
                      value={
                        metrics?.interviews.totalTokens ??
                        0
                      }
                    />
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
};

interface MetricCardProps {
  label: string;
  value: number;
}

const MetricCard = ({
  label,
  value
}: MetricCardProps) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black text-slate-900">
        {value.toLocaleString()}
      </div>
    </div>
  );
};

interface StatusCardProps {
  label: string;
  value: number;
}

const StatusCard = ({
  label,
  value
}: StatusCardProps) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black text-indigo-600">
        {value.toLocaleString()}
      </div>
    </div>
  );
};