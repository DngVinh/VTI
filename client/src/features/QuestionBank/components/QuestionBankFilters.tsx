import { DIFFICULTIES, QUESTION_TYPES, VERSION_STATUSES } from '../types';
import type { QuestionListQuery } from '../types';
import { enumLabel } from './enumLabels';

interface Props {
  query: QuestionListQuery;
  search: string;
  onSearchChange: (value: string) => void;
  onChange: (key: string, value?: string) => void;
}

const selectClass = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export const QuestionBankFilters = ({ query, search, onSearchChange, onChange }: Props) => (
  <section aria-labelledby="question-filters-heading" className="space-y-4 border-b border-slate-200 p-5">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id="question-filters-heading" className="text-lg font-bold text-slate-900">Tìm và lọc câu hỏi</h2>
        <p className="text-sm text-slate-500">Tìm theo mã, nội dung hoặc topic.</p>
      </div>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <label className="text-sm font-semibold text-slate-700 md:col-span-2">
        Từ khóa
        <input
          aria-describedby="question-search-hint"
          className={`${selectClass} mt-1 w-full`}
          maxLength={200}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Ví dụ: event loop, React..."
          type="search"
          value={search}
        />
        <span id="question-search-hint" className="mt-1 block text-xs font-normal text-slate-500">
          Kết quả cập nhật tự động.
        </span>
      </label>
      <FilterSelect label="Vòng đời" value={query.lifecycleStatus} onChange={(value) => onChange('lifecycleStatus', value)} options={['ACTIVE', 'RETIRED']} />
      <FilterSelect label="Trạng thái bản nháp" value={query.status} onChange={(value) => onChange('status', value)} options={[...VERSION_STATUSES]} />
      <FilterSelect label="Độ khó" value={query.difficulty} onChange={(value) => onChange('difficulty', value)} options={[...DIFFICULTIES]} />
      <FilterSelect label="Loại câu hỏi" value={query.type} onChange={(value) => onChange('type', value)} options={[...QUESTION_TYPES]} />
    </div>
  </section>
);

interface FilterSelectProps {
  label: string;
  value?: string;
  options: string[];
  onChange: (value?: string) => void;
  includeAll?: boolean;
}

const FilterSelect = ({ label, value, options, onChange, includeAll = true }: FilterSelectProps) => (
  <label className="text-sm font-semibold text-slate-700">
    {label}
    <select className={`${selectClass} mt-1 w-full`} onChange={(event) => onChange(event.target.value || undefined)} value={value ?? ''}>
      {includeAll && <option value="">Tất cả</option>}
      {options.map((option) => <option key={option} value={option}>{enumLabel(option)}</option>)}
    </select>
  </label>
);

