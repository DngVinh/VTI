/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import type { StarData } from '../types';
import { serializeStarData } from '../utils/starSerializer';

export { serializeStarData };

export interface StarAnswerHelperProps {
  /** Dữ liệu STAR hiện tại */
  value: StarData;
  /** Callback khi bất kỳ field nào thay đổi */
  onChange: (data: StarData) => void;
}

const SECTIONS = [
  {
    key: 'situation' as const,
    label: 'Situation (Tình huống)',
    icon: '🎯',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    placeholder: 'Mô tả tình huống/bối cảnh bạn gặp phải...',
  },
  {
    key: 'task' as const,
    label: 'Task (Nhiệm vụ)',
    icon: '📋',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    placeholder: 'Nhiệm vụ/mục tiêu bạn cần đạt được...',
  },
  {
    key: 'action' as const,
    label: 'Action (Hành động)',
    icon: '⚡',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    placeholder: 'Hành động cụ thể bạn đã thực hiện...',
  },
  {
    key: 'result' as const,
    label: 'Result (Kết quả)',
    icon: '✅',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    placeholder: 'Kết quả đạt được, số liệu nếu có...',
  },
];

export const StarAnswerHelper: React.FC<StarAnswerHelperProps> = ({ value, onChange }) => {
  const handleFieldChange = (key: keyof StarData, text: string) => {
    onChange({
      ...value,
      [key]: text,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {SECTIONS.map((sec) => (
        <div key={sec.key} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold border ${sec.badgeClass}`}
            >
              <span>{sec.icon}</span>
              <span>{sec.label}</span>
            </span>
          </div>
          <textarea
            id={`star-${sec.key}`}
            aria-label={sec.label}
            value={value[sec.key]}
            onChange={(e) => handleFieldChange(sec.key, e.target.value)}
            placeholder={sec.placeholder}
            rows={3}
            className="w-full bg-slate-50/70 border border-slate-200 rounded-xl p-3 text-slate-700 text-sm leading-relaxed transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 placeholder:text-slate-400 resize-none"
          />
        </div>
      ))}
    </div>
  );
};
