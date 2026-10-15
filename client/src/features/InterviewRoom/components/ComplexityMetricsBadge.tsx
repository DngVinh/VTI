import React from 'react';

export interface AstComplexityData {
  estimatedTimeComplexity: string;
  estimatedSpaceComplexity: string;
  cyclomaticComplexity: number;
  maxLoopNesting: number;
  hasRecursion: boolean;
  detectedSmells: string[];
}

export interface ComplexityMetricsBadgeProps {
  metrics: AstComplexityData;
  className?: string;
}

export const ComplexityMetricsBadge: React.FC<ComplexityMetricsBadgeProps> = ({
  metrics,
  className = '',
}) => {
  const { estimatedTimeComplexity, maxLoopNesting, cyclomaticComplexity, hasRecursion } = metrics;

  const getBadgeStyle = (timeComp: string) => {
    switch (timeComp) {
      case 'O(1)':
      case 'O(log N)':
        return {
          bg: 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300',
          dot: 'bg-emerald-400',
          label: 'Tối ưu',
        };
      case 'O(N)':
      case 'O(N log N)':
        return {
          bg: 'bg-sky-950/60 border-sky-700/60 text-sky-300',
          dot: 'bg-sky-400',
          label: 'Chấp nhận được',
        };
      case 'O(N^2)':
      case 'O(N^3+)':
      case 'O(2^N)':
      default:
        return {
          bg: 'bg-amber-950/60 border-amber-700/60 text-amber-300',
          dot: 'bg-amber-400 animate-pulse',
          label: 'Cần tối ưu',
        };
    }
  };

  const badgeStyle = getBadgeStyle(estimatedTimeComplexity);

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono select-none ${badgeStyle.bg} ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${badgeStyle.dot}`} />
        <span className="font-bold">{estimatedTimeComplexity}</span>
        <span className="text-[11px] opacity-80">({badgeStyle.label})</span>
      </div>

      <div className="flex items-center gap-2 text-[11px] opacity-90 border-l border-current/30 pl-2">
        <span>Lặp lồng: {maxLoopNesting}</span>
        <span>Rẽ nhánh: {cyclomaticComplexity}</span>
        {hasRecursion && (
          <span className="px-1.5 py-0.2 bg-purple-500/30 text-purple-300 rounded font-semibold">
            Đệ quy
          </span>
        )}
      </div>
    </div>
  );
};
