import { useState, useCallback, useRef, useEffect } from 'react';
import type { SpeechRecognitionState, SpeechMetrics } from '../types';

/** Danh sách từ đệm tiếng Việt và tiếng Anh */
const FILLER_WORDS_VI = ['à', 'ừm', 'ờ', 'kiểu như', 'kiểu', 'thì', 'là', 'cái này', 'đại loại'];
const FILLER_WORDS_EN = ['um', 'uh', 'like', 'basically', 'actually', 'you know', 'so', 'well', 'literally'];

export interface UseSpeechRecognitionOptions {
  /** Ngôn ngữ nhận diện: 'vi-VN' | 'en-US' */
  lang?: string;
  /** Có nhận diện liên tục không (default: true) */
  continuous?: boolean;
  /** Có trả về kết quả tạm không (default: true) */
  interimResults?: boolean;
  /** Callback khi có transcript mới (final) */
  onResult?: (transcript: string) => void;
}

export interface UseSpeechRecognitionReturn extends SpeechRecognitionState {
  /** Bắt đầu lắng nghe */
  startListening: () => void;
  /** Dừng lắng nghe */
  stopListening: () => void;
  /** Reset transcript về rỗng */
  resetTranscript: () => void;
  /** Chỉ số speech telemetry */
  metrics: SpeechMetrics;
}

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: {
    [index: number]: SpeechRecognitionResultItem[] & { isFinal?: boolean };
    length: number;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

const getSpeechRecognitionConstructor = (): (new () => BrowserSpeechRecognition) | null => {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
};

export const useSpeechRecognition = (
  options?: UseSpeechRecognitionOptions
): UseSpeechRecognitionReturn => {
  const {
    lang = 'vi-VN',
    continuous = true,
    interimResults = true,
    onResult,
  } = options || {};

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const isExplicitStopRef = useRef(false);

  const SpeechRecognitionClass = getSpeechRecognitionConstructor();
  const isSupported = Boolean(SpeechRecognitionClass);

  // Timer effect for speaking duration (avoids ref access & impure Date.now in render)
  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(() => {
      setDurationSeconds((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setFinalTranscript('');
    setInterimTranscript('');
    setDurationSeconds(0);
  }, []);

  const stopListening = useCallback(() => {
    isExplicitStopRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore if already stopped
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionClass) return;
    setError(null);
    isExplicitStopRef.current = false;

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = lang;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = '';
        let newlyFinal = '';

        const results = event.results;
        const startIndex = event.resultIndex || 0;
        for (let i = startIndex; i < results.length; i++) {
          const item = results[i];
          const transcriptChunk = item?.[0]?.transcript || '';
          if (item?.isFinal) {
            newlyFinal += transcriptChunk;
          } else {
            interim += transcriptChunk;
          }
        }

        if (newlyFinal) {
          const trimmedChunk = newlyFinal.trim();
          setFinalTranscript((prev) => (prev ? `${prev} ${trimmedChunk}` : trimmedChunk));
          if (onResultRef.current && trimmedChunk) {
            onResultRef.current(trimmedChunk);
          }
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const errType = event.error;
        if (errType === 'not-allowed') {
          setError('Quyền truy cập microphone bị từ chối.');
        } else if (errType === 'no-speech') {
          return;
        } else {
          setError(errType ? `Lỗi nhận diện giọng nói: ${errType}` : 'Lỗi nhận diện giọng nói.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        if (!isExplicitStopRef.current && continuous) {
          try {
            recognition.start();
            return;
          } catch {
            // failed to restart
          }
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // already started or failed
    }
  }, [SpeechRecognitionClass, continuous, interimResults, lang]);

  useEffect(() => {
    return () => {
      isExplicitStopRef.current = true;
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  // Compute metrics purely from state
  const cleanFinal = finalTranscript.trim();
  const wordTokens = cleanFinal ? cleanFinal.split(/\s+/).filter(Boolean) : [];
  const wordCount = wordTokens.length;

  const wpm = wordCount > 0 && durationSeconds > 0
    ? Math.round((wordCount / durationSeconds) * 60)
    : 0;

  // Detect filler words (case-insensitive with Unicode support)
  const lowerTranscript = cleanFinal.toLowerCase();
  const allFillers = [...FILLER_WORDS_VI, ...FILLER_WORDS_EN];
  const detectedFillers: string[] = [];
  let fillerCount = 0;

  const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

  for (const filler of allFillers) {
    const escaped = escapeRegex(filler);
    const regex = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'gui');
    const matches = [...lowerTranscript.matchAll(regex)];
    if (matches.length > 0) {
      detectedFillers.push(filler);
      fillerCount += matches.length;
    }
  }

  const metrics: SpeechMetrics = {
    wordCount,
    durationSeconds,
    wpm,
    fillerWords: detectedFillers,
    fillerCount,
  };

  return {
    isListening,
    interimTranscript,
    finalTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    metrics,
  };
};
