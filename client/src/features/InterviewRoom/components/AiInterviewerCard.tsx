import React from 'react';
import type { LocalizedContent } from '../types';

export interface AiInterviewerCardProps {
  /** Nội dung câu hỏi song ngữ */
  questionContent: LocalizedContent;
  /** Ngôn ngữ hiện tại */
  currentLang: 'vi' | 'en';
  /** AI đang nói hay không (điều khiển animation sóng âm) */
  isSpeaking: boolean;
  /** Callback khi bấm nút đọc câu hỏi */
  onSpeak: () => void;
  /** Callback khi bấm nút dừng đọc */
  onStopSpeaking: () => void;
  /** TTS có được hỗ trợ không */
  isTtsSupported: boolean;
}

export const AiInterviewerCard: React.FC<AiInterviewerCardProps> = ({
  currentLang = 'vi',
  isSpeaking,
  onSpeak,
  onStopSpeaking,
  isTtsSupported,
}) => {
  const aiLabels = {
    vi: {
      subtitle: 'Trợ lý phỏng vấn kỹ thuật',
      speaking: 'Đang nói...',
      ready: 'Sẵn sàng',
      frequency: 'Tần số âm thanh',
      unsupported: 'Trình duyệt không hỗ trợ đọc',
      stopSpeaking: 'Dừng đọc',
      readQuestion: 'Đọc câu hỏi',
    },
    en: {
      subtitle: 'Technical Interview Assistant',
      speaking: 'Speaking...',
      ready: 'Ready',
      frequency: 'Audio Frequency',
      unsupported: 'Text-to-speech not supported',
      stopSpeaking: 'Stop Speaking',
      readQuestion: 'Read Question',
    },
  } as const;
  const al = aiLabels[currentLang];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-white flex flex-col gap-5">
      {/* Header with Avatar and Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                isSpeaking ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-500'
              }`}
            />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 leading-tight">AI Interviewer</h3>
            <p className="text-xs text-slate-400 mt-0.5">{al.subtitle}</p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isSpeaking ? (
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
              {al.speaking}
            </span>
          ) : (
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700/60"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              {al.ready}
            </span>
          )}
        </div>
      </div>

      {/* Waveform Visualization Box */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl px-5 py-4 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium select-none">{al.frequency}</span>
        <div className="flex items-end gap-1.5 h-7" aria-hidden="true">
          {[14, 24, 18, 26, 12].map((heightPx, i) => (
            <div
              key={i}
              data-testid="waveform-bar"
              className={`w-1.5 rounded-full transition-all duration-200 ${
                isSpeaking
                  ? 'bg-indigo-400 animate-pulse'
                  : 'h-1.5 bg-slate-700'
              }`}
              style={isSpeaking ? { height: `${heightPx}px`, animationDelay: `${i * 120}ms` } : {}}
            />
          ))}
        </div>
      </div>

      {/* Speak Action Button */}
      <div>
        {!isTtsSupported ? (
          <button
            type="button"
            disabled
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed text-center"
          >
            {al.unsupported}
          </button>
        ) : isSpeaking ? (
          <button
            type="button"
            onClick={onStopSpeaking}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-900/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="w-2 h-2 rounded-xs bg-white" aria-hidden="true" />
            {al.stopSpeaking}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSpeak}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-900/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
            {al.readQuestion}
          </button>
        )}
      </div>
    </div>
  );
};
