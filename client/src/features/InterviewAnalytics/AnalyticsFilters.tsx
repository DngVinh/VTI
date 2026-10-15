import type { BaseEntity } from '../../services/api/interviewApi';
import type { AnalyticsFilters as AnalyticsFiltersType } from './types';

interface Props {
  filters: AnalyticsFiltersType;
  roles: BaseEntity[];
  levels: BaseEntity[];
  technologies: BaseEntity[];
  onChange: (next: Partial<AnalyticsFiltersType>) => void;
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-2xs outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 hover:border-slate-300';

export const AnalyticsFilters = ({
  filters,
  roles,
  levels,
  technologies,
  onChange,
}: Props) => {
  const hasActiveFilters = Boolean(
    filters.role || filters.level || filters.technology || filters.from || filters.to
  );

  const handleResetFilters = () => {
    onChange({
      role: undefined,
      level: undefined,
      technology: undefined,
      from: undefined,
      to: undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Bộ lọc dữ liệu phân tích
        </p>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 shadow-2xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Đặt lại bộ lọc
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Vai trò
          <select
            aria-label="Lọc theo vai trò"
            value={filters.role ?? ''}
            onChange={(e) =>
              onChange({ role: e.target.value || undefined })
            }
            className={inputClass}
          >
            <option value="">Tất cả vai trò</option>
            {roles.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Cấp độ
          <select
            aria-label="Lọc theo cấp độ"
            value={filters.level ?? ''}
            onChange={(e) =>
              onChange({ level: e.target.value || undefined })
            }
            className={inputClass}
          >
            <option value="">Tất cả cấp độ</option>
            {levels.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Công nghệ
          <select
            aria-label="Lọc theo công nghệ"
            value={filters.technology ?? ''}
            onChange={(e) =>
              onChange({ technology: e.target.value || undefined })
            }
            className={inputClass}
          >
            <option value="">Tất cả công nghệ</option>
            {technologies.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Từ ngày
          <input
            aria-label="Ngày bắt đầu"
            type="date"
            value={filters.from ?? ''}
            onChange={(e) =>
              onChange({ from: e.target.value || undefined })
            }
            className={inputClass}
          />
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Đến ngày
          <input
            aria-label="Ngày kết thúc"
            type="date"
            value={filters.to ?? ''}
            onChange={(e) =>
              onChange({ to: e.target.value || undefined })
            }
            className={inputClass}
          />
        </label>
      </div>
    </div>
  );
};
