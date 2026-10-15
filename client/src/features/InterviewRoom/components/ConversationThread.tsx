import React from 'react';
import type { ConversationTurn } from '../types';

export interface ConversationThreadProps {
  turns: ConversationTurn[];
  isLoading?: boolean;
  currentLang?: 'vi' | 'en';
  onSpeak?: (text: string) => void;
}

export const ConversationThread: React.FC<ConversationThreadProps> = ({
  turns,
  isLoading = false,
  currentLang = 'vi',
  onSpeak,
}) => {
  return (
    <div className="flex flex-col gap-4 w-full" aria-label="Luồng hội thoại phỏng vấn">
      {turns.map((turn, index) => {
        const isInterviewer = turn.role === 'INTERVIEWER';
        const text =
          currentLang === 'en'
            ? turn.content.en || turn.content.vi
            : turn.content.vi || turn.content.en;

        return (
          <div
            key={turn.id || turn._id || `turn-${index}`}
            className={`flex flex-col ${isInterviewer ? 'items-start' : 'items-end'}`}
          >
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-xs font-semibold text-slate-500">
                {isInterviewer
                  ? turn.type === 'FOLLOW_UP'
                    ? 'AI Phản biện (Follow-up)'
                    : 'AI Interviewer'
                  : 'Ứng viên'}
              </span>
              {isInterviewer && onSpeak && (
                <button
                  type="button"
                  onClick={() => onSpeak(text)}
                  className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                  aria-label="Đọc câu hỏi"
                  title="Nghe đọc nội dung"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                </button>
              )}
            </div>

            <div
              className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${
                isInterviewer
                  ? turn.type === 'FOLLOW_UP'
                    ? 'bg-indigo-950/60 border border-indigo-500/30 text-indigo-100 rounded-tl-sm'
                    : 'bg-slate-800/80 border border-slate-700 text-slate-200 rounded-tl-sm'
                  : 'bg-emerald-600 text-white rounded-tr-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{text}</p>

              {turn.metadata?.gapAnalysis && turn.metadata.gapAnalysis.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-indigo-500/20 text-xs text-indigo-200">
                  <div className="font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                    <span>Lỗ hổng kiến thức cần làm rõ:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                    {turn.metadata.gapAnalysis.map((gap, i) => {
                      const gapText =
                        typeof gap === 'string'
                          ? gap
                          : currentLang === 'en'
                            ? gap.en || gap.vi
                            : gap.vi || gap.en;
                      return <li key={i}>{gapText}</li>;
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {isLoading && (
        <div className="flex flex-col items-start animate-fade-in">
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-xs font-semibold text-slate-500">AI Interviewer</span>
          </div>
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl rounded-tl-sm p-4 text-sm text-indigo-200 flex items-center gap-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>AI đang phân tích câu trả lời và soạn câu hỏi phản biện...</span>
          </div>
        </div>
      )}
    </div>
  );
};
