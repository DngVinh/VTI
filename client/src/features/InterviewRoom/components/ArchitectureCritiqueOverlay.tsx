import React from 'react';
import type { ArchitectureCritiqueData } from '../types';

export interface ArchitectureCritiqueOverlayProps {
  critique: ArchitectureCritiqueData;
  onClose: () => void;
  className?: string;
}

export const ArchitectureCritiqueOverlay: React.FC<ArchitectureCritiqueOverlayProps> = ({
  critique,
  onClose,
  className = '',
}) => {
  const { score, tradeOffEvaluation, issues = [] } = critique;

  return (
    <div
      className={`absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-4 ${className}`}
    >
      {/* Top Banner: Score & Trade-off Evaluation */}
      <div className="pointer-events-auto bg-slate-900/95 border border-slate-700 shadow-2xl rounded-2xl p-4 max-w-xl backdrop-blur-md text-slate-100 flex flex-col gap-2.5 animate-fadeIn">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-sm text-slate-100">
              Phản biện Kiến trúc (AI Vision)
            </span>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono text-xs font-semibold rounded-full border border-emerald-500/30">
              {score.toFixed(1)} / 10
            </span>
          </div>

          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors text-xs font-medium"
          >
            Đóng ✕
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          {tradeOffEvaluation.vi}
        </p>

        {/* Issues List */}
        {issues.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Cảnh báo kiến trúc ({issues.length})
            </span>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border text-xs flex flex-col gap-1 ${
                    issue.severity === 'HIGH'
                      ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                      : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-rose-500/30 text-rose-200 border border-rose-400/30">
                        {issue.type}
                      </span>
                      <span>{issue.title.vi}</span>
                    </span>
                    <span className="text-[10px] font-mono opacity-80">
                      {issue.severity}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90">{issue.description.vi}</p>
                  <div className="text-[11px] text-emerald-300 bg-emerald-950/30 p-1.5 rounded border border-emerald-800/40">
                    💡 Khắc phục: {issue.suggestedFix.vi}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Visual Bounding Boxes Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {issues.map((issue, idx) => {
          if (!issue.targetBox) return null;
          const { x, y, width, height } = issue.targetBox;
          const isHigh = issue.severity === 'HIGH';

          return (
            <div
              key={idx}
              style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${width}px`,
                height: `${height}px`,
              }}
              className={`absolute border-2 rounded-xl pointer-events-auto transition-all ${
                isHigh
                  ? 'border-rose-500 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse'
                  : 'border-amber-400 bg-amber-400/10 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
              }`}
            >
              <span
                className={`absolute -top-3 left-2 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase shadow-sm ${
                  isHigh ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-950'
                }`}
              >
                {issue.type}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
