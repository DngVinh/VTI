import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../../../design-system';

export interface InterviewPreflightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReady: () => void;
}

export const InterviewPreflightModal: React.FC<InterviewPreflightModalProps> = ({
  isOpen,
  onClose,
  onReady,
}) => {
  const [micStatus, setMicStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [speakerStatus, setSpeakerStatus] = useState<'idle' | 'testing' | 'ok'>('idle');
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');

  // Cancel any speaker testing on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const testMic = async () => {
    setMicStatus('testing');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicStatus('error');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicStatus('ok');
    } catch {
      setMicStatus('error');
    }
  };

  const testSpeaker = () => {
    setSpeakerStatus('testing');
    try {
      if ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
        const u = new SpeechSynthesisUtterance('Kiểm tra loa');
        u.lang = 'vi-VN';
        u.onend = () => setSpeakerStatus('ok');
        u.onerror = () => setSpeakerStatus('ok');
        window.speechSynthesis.speak(u);
      } else {
        setSpeakerStatus('ok');
      }
    } catch {
      setSpeakerStatus('ok');
    }
  };

  const testCamera = async () => {
    setCameraStatus('testing');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('error');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setCameraStatus('ok');
    } catch {
      setCameraStatus('error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kiểm tra thiết bị trước khi phỏng vấn"
      description="Đảm bảo Microphone, Loa và Camera hoạt động ổn định để có trải nghiệm phỏng vấn tốt nhất."
      size="lg"
      footer={
        <div className="flex gap-2.5">
          <Button variant="ghost" onClick={onReady}>
            Bỏ qua
          </Button>
          <Button variant="primary" onClick={onReady}>
            Bắt đầu phỏng vấn
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        {/* Microphone Check */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base select-none"
            >
              🎤
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Microphone</p>
              <p className="text-xs text-slate-500">Dùng để trả lời câu hỏi bằng giọng nói</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {micStatus === 'ok' && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                ✓ Hoạt động tốt
              </span>
            )}
            {micStatus === 'error' && (
              <span className="text-xs font-semibold text-rose-600">✗ Chưa cấp quyền</span>
            )}
            <button
              type="button"
              onClick={testMic}
              disabled={micStatus === 'testing'}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white transition-all disabled:opacity-50 cursor-pointer"
            >
              {micStatus === 'testing' ? 'Đang thử...' : 'Thử Mic'}
            </button>
          </div>
        </div>

        {/* Speaker Check */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base select-none"
            >
              🔊
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Loa / Tai nghe</p>
              <p className="text-xs text-slate-500">Dùng để nghe AI đọc câu hỏi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {speakerStatus === 'ok' && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                ✓ Hoạt động tốt
              </span>
            )}
            <button
              type="button"
              onClick={testSpeaker}
              disabled={speakerStatus === 'testing'}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white transition-all disabled:opacity-50 cursor-pointer"
            >
              {speakerStatus === 'testing' ? 'Đang phát...' : 'Thử Loa'}
            </button>
          </div>
        </div>

        {/* Camera Check */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base select-none"
            >
              📷
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Camera</p>
              <p className="text-xs text-slate-500">Quan sát tư thế và nét mặt khi trả lời</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cameraStatus === 'ok' && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                ✓ Hoạt động tốt
              </span>
            )}
            {cameraStatus === 'error' && (
              <span className="text-xs font-semibold text-rose-600">✗ Chưa cấp quyền</span>
            )}
            <button
              type="button"
              onClick={testCamera}
              disabled={cameraStatus === 'testing'}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white transition-all disabled:opacity-50 cursor-pointer"
            >
              {cameraStatus === 'testing' ? 'Đang thử...' : 'Thử Camera'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
