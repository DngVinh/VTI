import { DIFFICULTIES, QUESTION_ORIGINS, QUESTION_TYPES, VERSION_STATUSES } from '../types';
import type { QuestionListQuery } from '../types';

interface Props {
  query: QuestionListQuery;
  search: string;
  onSearchChange: (value: string) => void;
  onChange: (key: string, value?: string) => void;
}

const selectClass = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export const QuestionBankFilters = ({ query, search, onSearchChange, onChange }: Props) => (
  <section aria-labelledby="question-filters-heading" className="space-y-4 border-b border-slate-200 p-5">
    <h2 id="question-filters-heading" className="text-lg font-bold text-slate-900">Tìm kiếm và bộ lọc</h2>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm font-semibold text-slate-700 md:col-span-2">
        Tìm câu hỏi
        <input
          aria-describedby="question-search-hint"
          className={`${selectClass} mt-1 w-full`}
          maxLength={200}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Nhập 2–200 ký tự"
          type="search"
          value={search}
        />
        <span id="question-search-hint" className="mt-1 block text-xs font-normal text-slate-500">
          Kết quả được cập nhật sau 400 ms.
        </span>
      </label>
      <FilterSelect label="Lifecycle" value={query.lifecycleStatus} onChange={(value) => onChange('lifecycleStatus', value)} options={['ACTIVE', 'RETIRED']} />
      <FilterSelect label="Draft/version status" value={query.status} onChange={(value) => onChange('status', value)} options={[...VERSION_STATUSES]} />
      <FilterSelect label="Độ khó" value={query.difficulty} onChange={(value) => onChange('difficulty', value)} options={[...DIFFICULTIES]} />
      <FilterSelect label="Loại câu hỏi" value={query.type} onChange={(value) => onChange('type', value)} options={[...QUESTION_TYPES]} />
      <FilterSelect label="Nguồn" value={query.origin} onChange={(value) => onChange('origin', value)} options={[...QUESTION_ORIGINS]} />
      <FilterSelect label="Sắp xếp" value={query.sortBy} onChange={(value) => onChange('sortBy', value)} options={['updatedAt', 'createdAt', 'code']} includeAll={false} />
      <FilterSelect label="Thứ tự" value={query.sortOrder} onChange={(value) => onChange('sortOrder', value)} options={['desc', 'asc']} includeAll={false} />
      {(['roleId', 'levelId', 'technologyId'] as const).map((key) => (
        <label className="text-sm font-semibold text-slate-700" key={key}>
          {key === 'roleId' ? 'Role ID' : key === 'levelId' ? 'Level ID' : 'Technology ID'}
          <input
            className={`${selectClass} mt-1 w-full font-mono`}
            onChange={(event) => onChange(key, event.target.value.trim() || undefined)}
            placeholder="Mongo ObjectId"
            value={query[key] ?? ''}
          />
        </label>
      ))}
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
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

