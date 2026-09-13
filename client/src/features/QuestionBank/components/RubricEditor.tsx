import type { RubricCriterion } from '../types';

interface Props {
  value: RubricCriterion[];
  disabled?: boolean;
  onChange: (value: RubricCriterion[]) => void;
}

const defaultCriterion = (index: number): RubricCriterion => ({
  key: `criterion-${index}`,
  title: { vi: '', en: '' },
  description: { vi: '', en: '' },
  weight: 50,
  levels: [0, 1, 2, 3, 4].map((score) => ({ score, description: { vi: '', en: '' } })),
});

export const RubricEditor = ({ value, disabled = false, onChange }: Props) => {
  const totalWeight = value.reduce((sum, criterion) => sum + criterion.weight, 0);
  const update = (index: number, next: RubricCriterion) => onChange(value.map((item, itemIndex) => itemIndex === index ? next : item));
  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= value.length) return;
    const next = [...value];
    [next[index], next[destination]] = [next[destination], next[index]];
    onChange(next);
  };

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <legend className="text-lg font-extrabold text-slate-900">Rubric</legend>
      <div aria-live="polite" className={`rounded-lg px-3 py-2 text-sm font-bold ${value.length === 0 || totalWeight === 100 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
        {value.length === 0 ? 'Chưa tạo rubric' : `Tổng trọng số: ${totalWeight}/100`}
      </div>
      {value.map((criterion, index) => (
        <section aria-label={`Tiêu chí rubric ${index + 1}`} className="rounded-xl border border-slate-200 p-4" key={`${criterion.key}-${index}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900">Tiêu chí {index + 1}</h3>
            {!disabled && <div className="flex gap-2">
              <button aria-label={`Đưa tiêu chí ${index + 1} lên`} className="rounded border px-2 py-1 disabled:opacity-40" disabled={index === 0} onClick={() => move(index, -1)} type="button">↑</button>
              <button aria-label={`Đưa tiêu chí ${index + 1} xuống`} className="rounded border px-2 py-1 disabled:opacity-40" disabled={index === value.length - 1} onClick={() => move(index, 1)} type="button">↓</button>
              <button className="rounded border border-red-200 px-2 py-1 font-semibold text-red-700" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} type="button">Xóa</button>
            </div>}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Key" value={criterion.key} onChange={(key) => update(index, { ...criterion, key })} />
            <Field label="Tiêu đề VI" value={criterion.title.vi} onChange={(vi) => update(index, { ...criterion, title: { ...criterion.title, vi } })} />
            <Field label="Title EN" value={criterion.title.en} onChange={(en) => update(index, { ...criterion, title: { ...criterion.title, en } })} />
            <label className="text-sm font-semibold">Trọng số
              <input className="mt-1 w-full rounded-lg border px-3 py-2" max={100} min={1} onChange={(event) => update(index, { ...criterion, weight: Number(event.target.value) })} type="number" value={criterion.weight} />
            </label>
          </div>
          <div className="mt-4 space-y-2">
            {criterion.levels.map((level, levelIndex) => (
              <div className="grid items-center gap-2 md:grid-cols-[5rem_1fr_1fr]" key={level.score}>
                <span className="text-sm font-bold">Điểm {level.score}</span>
                <Field label={`Mô tả VI mức ${level.score}`} hideLabel value={level.description.vi} onChange={(vi) => update(index, { ...criterion, levels: criterion.levels.map((item, itemIndex) => itemIndex === levelIndex ? { ...item, description: { ...item.description, vi } } : item) })} />
                <Field label={`Description EN level ${level.score}`} hideLabel value={level.description.en} onChange={(en) => update(index, { ...criterion, levels: criterion.levels.map((item, itemIndex) => itemIndex === levelIndex ? { ...item, description: { ...item.description, en } } : item) })} />
              </div>
            ))}
          </div>
        </section>
      ))}
      {!disabled && (value.length === 0 ? (
        <button className="rounded-lg border border-indigo-300 px-4 py-2 font-bold text-indigo-700" onClick={() => onChange([defaultCriterion(1), defaultCriterion(2)])} type="button">Tạo rubric</button>
      ) : (
        <button className="rounded-lg border border-indigo-300 px-4 py-2 font-bold text-indigo-700 disabled:opacity-40" disabled={value.length >= 10} onClick={() => onChange([...value, { ...defaultCriterion(value.length + 1), weight: 1 }])} type="button">Thêm tiêu chí</button>
      ))}
    </fieldset>
  );
};

const Field = ({ label, value, onChange, hideLabel = false }: { label: string; value: string; onChange: (value: string) => void; hideLabel?: boolean }) => (
  <label className="text-sm font-semibold">
    <span className={hideLabel ? 'sr-only' : ''}>{label}</span>
    <input aria-label={hideLabel ? label : undefined} className="mt-1 w-full rounded-lg border px-3 py-2" onChange={(event) => onChange(event.target.value)} value={value} />
  </label>
);

