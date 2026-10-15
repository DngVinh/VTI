import React from 'react';

export interface LiveAiInterviewerAvatarProps {
  isAiSpeaking: boolean;
  isCandidateSpeaking?: boolean;
  audioLevel?: number; // 0 to 1
  onInterrupt?: () => void;
  status?: 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';
}

export const LiveAiInterviewerAvatar: React.FC<LiveAiInterviewerAvatarProps> = ({
  isAiSpeaking,
  isCandidateSpeaking = false,
  audioLevel = 0,
  onInterrupt,
  status = 'IDLE',
}) => {
  let currentStatus: 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' = status;
  if (isAiSpeaking) {
    currentStatus = 'SPEAKING';
  } else if (isCandidateSpeaking) {
    currentStatus = 'LISTENING';
  }

  const getStatusLabel = () => {
    switch (currentStatus) {
      case 'SPEAKING':
        return 'AI đang nói...';
      case 'LISTENING':
        return 'Đang lắng nghe ứng viên...';
      case 'THINKING':
        return 'Đang suy nghĩ...';
      case 'IDLE':
      default:
        return 'Sẵn sàng';
    }
  };

  const getGlowClass = () => {
    switch (currentStatus) {
      case 'SPEAKING':
        return 'ring-4 ring-indigo-500/50 shadow-indigo-500/30';
      case 'LISTENING':
        return 'ring-4 ring-emerald-500/50 shadow-emerald-500/30';
      case 'THINKING':
        return 'ring-4 ring-amber-500/50 shadow-amber-500/30 animate-pulse';
      case 'IDLE':
      default:
        return 'ring-1 ring-slate-700';
    }
  };

  const waveformHeights = [14, 28, 20, 32, 16, 24];

  return (
    <div
      data-testid="live-ai-avatar"
      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-white flex flex-col items-center gap-5 relative overflow-hidden"
    >
      {/* Avatar Graphic with Pulsing Aura */}
      <div
        className={`relative w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-700 via-purple-600 to-pink-500 flex items-center justify-center shadow-2xl transition-all duration-300 ${getGlowClass()}`}
      >
        <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>

        <span
          className={`absolute bottom-1 right-2 w-4 h-4 rounded-full border-2 border-slate-900 ${
            currentStatus === 'SPEAKING'
              ? 'bg-indigo-400 animate-pulse'
              : currentStatus === 'LISTENING'
              ? 'bg-emerald-400'
              : currentStatus === 'THINKING'
              ? 'bg-amber-400 animate-pulse'
              : 'bg-emerald-500'
          }`}
        />
      </div>

      {/* Status Badge */}
      <div data-testid="avatar-status-badge" className="flex items-center gap-2">
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            currentStatus === 'SPEAKING'
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
              : currentStatus === 'LISTENING'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : currentStatus === 'THINKING'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {getStatusLabel()}
        </span>
      </div>

      {/* Waveform Visualization Bars */}
      <div className="flex items-end justify-center gap-1.5 h-10 px-4" aria-hidden="true">
        {waveformHeights.map((baseHeight, idx) => {
          const dynamicHeight =
            currentStatus === 'SPEAKING'
              ? Math.max(6, Math.min(40, baseHeight * (audioLevel > 0 ? audioLevel * 1.5 : 1)))
              : 4;

          return (
            <div
              key={idx}
              data-testid="avatar-waveform-bar"
              className={`w-1.5 rounded-full transition-all duration-150 ${
                currentStatus === 'SPEAKING'
                  ? 'bg-indigo-400 animate-pulse'
                  : currentStatus === 'LISTENING'
                  ? 'bg-emerald-400'
                  : 'bg-slate-700'
              }`}
              style={{
                height: `${dynamicHeight}px`,
                animationDelay: `${idx * 100}ms`,
              }}
            />
          );
        })}
      </div>

      {/* Interrupt Control (Only when AI is speaking) */}
      {isAiSpeaking && onInterrupt && (
        <button
          type="button"
          data-testid="interrupt-button"
          onClick={onInterrupt}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Ngắt lời AI
        </button>
      )}
    </div>
  );
};
