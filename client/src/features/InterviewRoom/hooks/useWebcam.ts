import { useState, useRef, useCallback, useEffect } from 'react';
import type { WebcamState } from '../types';

export interface UseWebcamReturn extends WebcamState {
  /** Ref để gắn vào <video> element */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Bật camera + mic */
  start: () => Promise<void>;
  /** Tắt camera + mic */
  stop: () => void;
  /** Toggle camera on/off */
  toggleCamera: () => void;
  /** Toggle mic on/off */
  toggleMic: () => void;
  /** Camera đang bật */
  isCameraOn: boolean;
  /** Mic đang bật */
  isMicOn: boolean;
}

export const useWebcam = (): UseWebcamReturn => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastLevelUpdateRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const startAbortControllerRef = useRef<AbortController | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const cleanupAudioAnalyser = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const stop = useCallback(() => {
    if (startAbortControllerRef.current) {
      startAbortControllerRef.current.abort();
      startAbortControllerRef.current = null;
    }
    cleanupAudioAnalyser();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (isMountedRef.current) {
      setIsActive(false);
    }
  }, [cleanupAudioAnalyser]);

  const toggleCamera = useCallback(() => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      setIsCameraOn((prev) => {
        const nextState = !prev;
        videoTracks.forEach((track) => {
          track.enabled = nextState;
        });
        return nextState;
      });
    }
  }, []);

  const toggleMic = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      setIsMicOn((prev) => {
        const nextState = !prev;
        audioTracks.forEach((track) => {
          track.enabled = nextState;
        });
        if (!nextState) {
          setAudioLevel(0);
        }
        return nextState;
      });
    }
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      if (isMountedRef.current) setError('Trình duyệt không hỗ trợ truy cập Camera/Microphone.');
      return;
    }

    // Stop any existing stream before starting a new one to prevent hardware leaks
    stop();
    if (isMountedRef.current) setError(null);

    const abortController = new AbortController();
    startAbortControllerRef.current = abortController;
    const { signal } = abortController;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 } },
        audio: true,
      });

      if (signal.aborted || !isMountedRef.current) {
        stream.getTracks().forEach((track) => {
          try { track.stop(); } catch { /* ignore */ }
        });
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      if (isMountedRef.current) {
        setIsActive(true);
        setIsCameraOn(true);
        setIsMicOn(true);
        setHasPermission(true);
        setHasMicPermission(true);
      }

      // Setup audio level analyser
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          if (signal.aborted || !isMountedRef.current) {
            audioCtx.close().catch(() => {});
            return;
          }
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const monitorLevel = () => {
            if (!streamRef.current || !isMountedRef.current || signal.aborted) return;
            analyser.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const level = Math.min(100, Math.round((average / 128) * 100));

            const now = Date.now();
            if (now - lastLevelUpdateRef.current > 100) {
              if (isMountedRef.current) setAudioLevel(level);
              lastLevelUpdateRef.current = now;
            }

            animFrameRef.current = requestAnimationFrame(monitorLevel);
          };

          animFrameRef.current = requestAnimationFrame(monitorLevel);
        }
      } catch {
        // audio analyzer is enhancement, don't fail entire stream
      }
    } catch (err: unknown) {
      if (!isMountedRef.current || signal.aborted) return;
      const e = err as { name?: string; message?: string };
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setError('Quyền truy cập Camera/Microphone bị từ chối.');
        setHasPermission(false);
        setHasMicPermission(false);
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setError('Không tìm thấy thiết bị Camera hoặc Microphone.');
      } else {
        setError('Không thể kết nối Camera/Microphone.');
      }
      setIsActive(false);
    }
  }, [stop]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stop();
    };
  }, [stop]);

  return {
    videoRef,
    isActive,
    isCameraOn,
    isMicOn,
    hasPermission,
    hasMicPermission,
    error,
    audioLevel,
    start,
    stop,
    toggleCamera,
    toggleMic,
  };
};
