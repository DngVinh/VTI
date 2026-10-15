import React from 'react';
import type { AnswerMode } from '../types';

export interface AnswerModeSelectorProps {
  /** Chế độ hiện tại */
  activeMode: AnswerMode;
  /** Callback khi đổi chế độ */
  onModeChange: (mode: AnswerMode) => void;
}

const MODES: { id: AnswerMode; label: string; icon: string }[] = [
  { id: 'text', label: 'Văn bản', icon: '📝' },
  { id: 'code', label: 'Code', icon: '💻' },
  { id: 'star', label: 'STAR', icon: '⭐' },
  { id: 'whiteboard', label: 'Bảng vẽ', icon: '🏛️' },
];

export const AnswerModeSelector: React.FC<AnswerModeSelectorProps> = ({
  activeMode,
  onModeChange,
}) => {
  return (
    <div
      role="group"
      aria-label="Chọn chế độ trả lời"
      className="bg-slate-100 p-1 rounded-xl inline-flex gap-1 border border-slate-200/80"
    >
      {MODES.map((mode) => {
        const isActive = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            aria-pressed={isActive}
            type="button"
            onClick={() => onModeChange(mode.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isActive
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            <span aria-hidden="true">{mode.icon}</span>
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
};
