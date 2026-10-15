import React from 'react';
import type { SpeechMetrics } from '../types';

const DEFAULT_METRICS: SpeechMetrics = {
  wordCount: 0,
  wpm: 0,
  durationSeconds: 0,
  fillerWords: [],
  fillerCount: 0,
};

export interface SpeechTelemetryHUDProps {
  /** Chỉ số speech */
  metrics?: SpeechMetrics;
  /** Đang lắng nghe mic */
  isListening: boolean;
}

const getWpmStatus = (val: number) => {
  if (val <= 0) return { label: 'Chưa có', color: 'text-slate-400' };
  if (val < 80) return { label: 'Chậm', color: 'text-amber-500' };
  if (val <= 150) return { label: 'Tốt', color: 'text-emerald-500' };
  return { label: 'Nhanh', color: 'text-rose-500' };
};

export const SpeechTelemetryHUD: React.FC<SpeechTelemetryHUDProps> = ({
  metrics = DEFAULT_METRICS,
  isListening,
}) => {
  const { wordCount, wpm, fillerCount } = metrics;
  const wpmStatus = getWpmStatus(wpm);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
      {/* Left: Recording Status or Prompt */}
      <div className="flex items-center gap-2" role="status" aria-live="polite">
        {isListening ? (
          <span className="flex items-center gap-1.5 font-bold text-rose-600 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-600" aria-hidden="true" />
            Đang ghi âm...
          </span>
        ) : wordCount === 0 ? (
          <span className="text-slate-400 font-medium">Bấm mic để bắt đầu nói</span>
        ) : (
          <span className="text-slate-500 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Đã ghi âm
          </span>
        )}
      </div>

      {/* Right: Metrics Dashboard */}
      <div className="flex items-center gap-3 sm:gap-4 font-mono text-[11px]">
        {/* WPM */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400">Tốc độ:</span>
          <span className="font-bold text-slate-700">{wpm} WPM</span>
          <span className={`font-semibold ${wpmStatus.color}`}>({wpmStatus.label})</span>
        </div>

        <span className="text-slate-200 select-none">|</span>

        {/* Word count */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400">Từ:</span>
          <span className="font-bold text-slate-700">{wordCount}</span>
        </div>

        <span className="text-slate-200 select-none">|</span>

        {/* Filler words */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400">Từ đệm:</span>
          <span
            data-testid="filler-count"
            className={`font-bold ${fillerCount > 3 ? 'text-rose-600' : 'text-slate-600'}`}
          >
            {fillerCount}
          </span>
        </div>
      </div>
    </div>
  );
};
