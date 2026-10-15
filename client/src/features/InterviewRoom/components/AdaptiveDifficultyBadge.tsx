import React from 'react';

export interface AdaptiveDifficultyBadgeProps {
  difficulty: string;
  adjustment?: 'EASIER' | 'SAME' | 'HARDER';
  className?: string;
}

export const AdaptiveDifficultyBadge: React.FC<AdaptiveDifficultyBadgeProps> = ({
  difficulty,
  adjustment = 'SAME',
  className = '',
}) => {
  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'hard':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'medium':
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
  };

  const getAdjustmentInfo = (adj?: 'EASIER' | 'SAME' | 'HARDER') => {
    switch (adj) {
      case 'HARDER':
        return {
          label: 'Tăng độ khó',
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
          icon: '↑',
        };
      case 'EASIER':
        return {
          label: 'Hạ độ khó',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          icon: '↓',
        };
      case 'SAME':
      default:
        return {
          label: 'Duy trì độ khó',
          color: 'text-slate-400 bg-slate-800 border-slate-700',
          icon: '•',
        };
    }
  };

  const adjInfo = getAdjustmentInfo(adjustment);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Base difficulty */}
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getDifficultyColor(
          difficulty
        )}`}
      >
        {difficulty}
      </span>

      {/* Adaptive Trend Badge */}
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${adjInfo.color}`}
        title={`Độ khó phỏng vấn thích ứng: ${adjInfo.label}`}
      >
        <span className="font-bold">{adjInfo.icon}</span>
        <span>{adjInfo.label}</span>
      </span>
    </div>
  );
};
