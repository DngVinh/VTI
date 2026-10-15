import React from 'react';

export interface WebcamPreviewProps {
  /** Ref gắn vào HTMLVideoElement */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Stream đang hoạt động */
  isActive: boolean;
  /** Camera đang bật */
  isCameraOn: boolean;
  /** Mic đang bật */
  isMicOn: boolean;
  /** Mức âm lượng mic (0 - 100) */
  audioLevel: number;
  /** Callback bật/tắt camera */
  onToggleCamera: () => void;
  /** Callback bật/tắt mic */
  onToggleMic: () => void;
  /** Lỗi thiết bị nếu có */
  error: string | null;
  /** Callback bật camera lần đầu */
  onStart?: () => void;
}

export const WebcamPreview: React.FC<WebcamPreviewProps> = ({
  videoRef,
  isActive,
  isCameraOn,
  isMicOn,
  audioLevel,
  onToggleCamera,
  onToggleMic,
  error,
  onStart,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl text-white flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isActive && isCameraOn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Camera ứng viên</h4>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-mono">
            {isCameraOn ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* Video Stream Stage */}
      <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-950 border border-slate-800/80 flex items-center justify-center">
        {error ? (
          <div className="p-4 text-center">
            <svg className="w-8 h-8 text-rose-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          </div>
        ) : !isActive ? (
          <div className="text-center p-4">
            <p className="text-xs text-slate-400 mb-3">Chưa kết nối camera</p>
            {onStart && (
              <button
                onClick={onStart}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all"
              >
                Bật Camera
              </button>
            )}
          </div>
        ) : !isCameraOn ? (
          <div className="text-center p-4 flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <p className="text-xs text-slate-400 font-medium">Camera đã tắt</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        )}
      </div>

      {/* Audio Level Meter */}
      <div
        className="space-y-1"
        role="meter"
        aria-label="Mức âm lượng mic"
        aria-valuenow={Math.round(audioLevel)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="flex justify-between items-center text-[10px] text-slate-400 select-none">
          <span>Mic volume</span>
          <span>{isMicOn ? `${Math.round(audioLevel)}%` : 'Muted'}</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
          <div
            data-testid="audio-level-meter"
            className={`h-full rounded-full transition-all duration-100 ${
              audioLevel > 80 ? 'bg-rose-500' : audioLevel > 50 ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
            style={{ width: `${isMicOn ? Math.max(0, Math.min(100, audioLevel)) : 0}%` }}
          />
        </div>
      </div>

      {/* Media Controls */}
      <div className="flex items-center justify-center gap-3 pt-1">
        <button
          type="button"
          onClick={onToggleCamera}
          aria-label={isCameraOn ? 'Tắt camera' : 'Bật camera'}
          className={`p-2.5 rounded-xl border transition-all text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
            isCameraOn
              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              : 'bg-rose-600/20 border-rose-500/40 text-rose-300 hover:bg-rose-600/30'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>{isCameraOn ? 'Tắt cam' : 'Bật cam'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleMic}
          aria-label={isMicOn ? 'Tắt mic' : 'Bật mic'}
          className={`p-2.5 rounded-xl border transition-all text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
            isMicOn
              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              : 'bg-rose-600/20 border-rose-500/40 text-rose-300 hover:bg-rose-600/30'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <span>{isMicOn ? 'Tắt mic' : 'Bật mic'}</span>
        </button>
      </div>
    </div>
  );
};
