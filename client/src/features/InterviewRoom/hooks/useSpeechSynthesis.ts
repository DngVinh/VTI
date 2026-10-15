import { useState, useCallback, useEffect, useRef } from 'react';
import type { SpeechSynthesisState } from '../types';

export interface UseSpeechSynthesisOptions {
  /** Tốc độ đọc (0.5 - 2.0, default: 1.0) */
  rate?: number;
  /** Cao độ giọng (0.5 - 2.0, default: 1.0) */
  pitch?: number;
}

export interface UseSpeechSynthesisReturn extends SpeechSynthesisState {
  /** Đọc văn bản với ngôn ngữ chỉ định */
  speak: (text: string, lang?: 'vi-VN' | 'en-US') => void;
  /** Dừng đọc */
  stop: () => void;
  /** Tạm dừng đọc */
  pause: () => void;
  /** Tiếp tục đọc */
  resume: () => void;
}

export const useSpeechSynthesis = (
  options?: UseSpeechSynthesisOptions
): UseSpeechSynthesisReturn => {
  const { rate = 1.0, pitch = 1.0 } = options || {};

  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== 'undefined' && Boolean(window.speechSynthesis);

  const stop = useCallback(() => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    setIsSpeaking(false);
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.pause();
    } catch {
      // ignore
    }
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.resume();
    } catch {
      // ignore
    }
  }, [isSupported]);

  const speak = useCallback(
    (text: string, lang: 'vi-VN' | 'en-US' = 'vi-VN') => {
      if (!isSupported || !text) return;

      // Cancel previous speech if any
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }

      if (typeof SpeechSynthesisUtterance === 'undefined') return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;

      // Pick optimal voice for requested language
      try {
        const voices = window.speechSynthesis.getVoices();
        const prefix = lang.startsWith('vi') ? 'vi' : 'en';
        const matchingVoice =
          voices.find((v) => v.lang.toLowerCase().startsWith(prefix) && v.localService) ||
          voices.find((v) => v.lang.toLowerCase().startsWith(prefix));

        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
      } catch {
        // ignore voice selection failure
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }
    },
    [isSupported, pitch, rate]
  );

  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        utteranceRef.current.onstart = null;
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
        utteranceRef.current = null;
      }
      if (isSupported) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [isSupported]);

  return {
    isSpeaking,
    isSupported,
    speak,
    stop,
    pause,
    resume,
  };
};
