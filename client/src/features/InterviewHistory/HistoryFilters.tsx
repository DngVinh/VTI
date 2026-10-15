import type { BaseEntity, InterviewHistoryStatus } from '../../services/api/interviewApi';
import type { HistoryFilters as HistoryFilterState } from './types';
import { useTranslation } from '../../locales/I18nContext';

interface Props {
  filters: HistoryFilterState;
  roles: BaseEntity[];
  levels: BaseEntity[];
  technologies: BaseEntity[];
  onChange: (patch: Partial<HistoryFilterState>) => void;
}

const selectClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-2xs outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 hover:border-slate-300';

export const HistoryFilters = ({ filters, roles, levels, technologies, onChange }: Props) => {
  const { t } = useTranslation();

  const statuses: Array<{ value: InterviewHistoryStatus; label: string }> = [
    { value: 'PENDING', label: t('history.statusPending', 'Chờ xử lý') },
    { value: 'GENERATING', label: t('history.statusGenerating', 'Đang tạo câu hỏi') },
    { value: 'IN_PROGRESS', label: t('history.statusInProgress', 'Đang phỏng vấn') },
    { value: 'EVALUATING', label: t('history.statusEvaluating', 'Đang đánh giá') },
    { value: 'COMPLETED', label: t('history.statusCompleted', 'Hoàn thành') },
    { value: 'FAILED', label: t('history.statusFailed', 'Thất bại') },
  ];

  const quickStatusTabs: Array<{ value: InterviewHistoryStatus | ''; label: string; countBadge?: string }> = [
    { value: '', label: t('history.allStatuses', 'Tất cả trạng thái') },
    { value: 'IN_PROGRESS', label: t('history.inProgressDraft', 'Đang làm dở') },
    { value: 'COMPLETED', label: t('history.completedDone', 'Đã hoàn thành') },
    { value: 'EVALUATING', label: t('history.evaluatingScoring', 'Đang chấm điểm') },
    { value: 'FAILED', label: t('history.statusFailed', 'Thất bại') },
  ];

  const hasActiveFilters = Boolean(
    filters.role ||
    filters.level ||
    filters.technology ||
    filters.status ||
    filters.from ||
    filters.to ||
    filters.sort !== 'newest' ||
    filters.limit !== 10
  );

  const handleResetFilters = () => {
    onChange({
      role: '',
      level: '',
      technology: '',
      status: '',
      from: '',
      to: '',
      sort: 'newest',
      limit: 10,
      page: 1,
    });
  };

  return (
    <div className="space-y-5">
      {/* Quick Status Pill Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t('history.quickFilterAria', 'Bộ lọc nhanh trạng thái')}>
          {quickStatusTabs.map((tab) => {
            const isActive = filters.status === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange({ status: tab.value, page: 1 })}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-2xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t('history.resetFilters', 'Đặt lại bộ lọc')}
          </button>
        )}
      </div>

      {/* Structured Filters Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="history-role" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {t('history.filterRole', 'Vai trò phỏng vấn')}
          </label>
          <select
            id="history-role"
            value={filters.role}
            onChange={(e) => onChange({ role: e.target.value, page: 1 })}
            className={selectClass}
          >
            <option value="">{t('history.allRoles', 'Tất cả vai trò')}</option>
            {roles.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="history-level" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {t('history.filterLevel', 'Cấp độ')}
          </label>
          <select
            id="history-level"
            value={filters.level}
            onChange={(e) => onChange({ level: e.target.value, page: 1 })}
            className={selectClass}
          >
            <option value="">{t('history.allLevels', 'Tất cả cấp độ')}</option>
            {levels.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="history-technology" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            {t('history.filterTechnology', 'Công nghệ')}
          </label>
          <select
            id="history-technology"
            value={filters.technology}
            onChange={(e) => onChange({ technology: e.target.value, page: 1 })}
            className={selectClass}
          >
            <option value="">{t('history.allTechnologies', 'Tất cả công nghệ')}</option>
            {technologies.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="history-status" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('history.filterStatus', 'Trạng thái')}
          </label>
          <select
            id="history-status"
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value as InterviewHistoryStatus | '', page: 1 })}
            className={selectClass}
          >
            <option value="">{t('history.allStatuses', 'Tất cả trạng thái')}</option>
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="history-from" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {t('history.filterFrom', 'Từ ngày')}
          </label>
          <input
            id="history-from"
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value, page: 1 })}
            className={selectClass}
          />
        </div>

        <div>
          <label htmlFor="history-to" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {t('history.filterTo', 'Đến ngày')}
          </label>
          <input
            id="history-to"
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value, page: 1 })}
            className={selectClass}
          />
        </div>

        <div>
          <label htmlFor="history-sort" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            {t('history.sortLabel', 'Sắp xếp')}
          </label>
          <select
            id="history-sort"
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value as HistoryFilterState['sort'], page: 1 })}
            className={selectClass}
          >
            <option value="newest">{t('history.sortNewest', 'Mới nhất trước')}</option>
            <option value="oldest">{t('history.sortOldest', 'Cũ nhất trước')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="history-limit" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            {t('history.limitLabel', 'Số mục mỗi trang')}
          </label>
          <select
            id="history-limit"
            value={filters.limit}
            onChange={(e) => onChange({ limit: Number(e.target.value), page: 1 })}
            className={selectClass}
          >
            {[10, 20, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value} {t('history.itemsCount', 'mục')}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

