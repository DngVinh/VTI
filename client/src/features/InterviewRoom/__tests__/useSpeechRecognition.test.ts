import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

// Mock SpeechRecognition factory
interface MockRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

const createMockSpeechRecognition = () => {
  const instance: MockRecognitionInstance = {
    lang: '',
    continuous: false,
    interimResults: false,
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    onresult: null,
    onerror: null,
    onend: null,
  };
  return instance;
};

describe('useSpeechRecognition', () => {
  let originalSpeechRecognition: unknown;
  let originalWebkitSpeechRecognition: unknown;
  let mockRecognitionInstance: MockRecognitionInstance;

  beforeEach(() => {
    originalSpeechRecognition = (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    originalWebkitSpeechRecognition = (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    mockRecognitionInstance = createMockSpeechRecognition();
    function MockConstructor() {
      return mockRecognitionInstance;
    }
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = MockConstructor;
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = undefined;
  });

  afterEach(() => {
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = originalSpeechRecognition;
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = originalWebkitSpeechRecognition;
    vi.clearAllMocks();
  });

  it('returns isSupported=false when browser lacks SpeechRecognition API', () => {
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = undefined;
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = undefined;

    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(false);
    expect(result.current.isListening).toBe(false);
  });

  it('starts and stops listening correctly', () => {
    const { result } = renderHook(() => useSpeechRecognition({ lang: 'vi-VN' }));
    expect(result.current.isSupported).toBe(true);
    expect(result.current.isListening).toBe(false);

    act(() => {
      result.current.startListening();
    });

    expect(mockRecognitionInstance.start).toHaveBeenCalled();
    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.stopListening();
    });

    expect(mockRecognitionInstance.stop).toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
  });

  it('accumulates finalTranscript from recognition results', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    const mockEvent = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Xin chào các bạn' }], { isFinal: true })
      ]
    };

    act(() => {
      mockRecognitionInstance.onresult?.(mockEvent);
    });

    expect(result.current.finalTranscript).toBe('Xin chào các bạn');
    expect(result.current.interimTranscript).toBe('');
  });

  it('separates interim and final transcripts', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    const mockEvent = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Tôi đang nói' }], { isFinal: false })
      ]
    };

    act(() => {
      mockRecognitionInstance.onresult?.(mockEvent);
    });

    expect(result.current.finalTranscript).toBe('');
    expect(result.current.interimTranscript).toBe('Tôi đang nói');
  });

  it('computes WPM metrics from finalTranscript and duration', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    // Advance 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    // 10 words
    const mockEvent = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'một hai ba bốn năm sáu bảy tám chín mười' }], { isFinal: true })
      ]
    };

    act(() => {
      mockRecognitionInstance.onresult?.(mockEvent);
    });

    act(() => {
      result.current.stopListening();
    });

    expect(result.current.metrics.wordCount).toBe(10);
    expect(result.current.metrics.durationSeconds).toBeGreaterThanOrEqual(30);
    // 10 words in 30 seconds = 20 WPM
    expect(result.current.metrics.wpm).toBe(20);
    vi.useRealTimers();
  });

  it('detects Vietnamese filler words (à, ừm, kiểu như)', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    const mockEvent = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'À tôi nghĩ là ừm giải pháp này kiểu như rất tốt' }], { isFinal: true })
      ]
    };

    act(() => {
      mockRecognitionInstance.onresult?.(mockEvent);
    });

    expect(result.current.metrics.fillerWords).toContain('à');
    expect(result.current.metrics.fillerWords).toContain('ừm');
    expect(result.current.metrics.fillerWords).toContain('kiểu như');
    expect(result.current.metrics.fillerCount).toBeGreaterThanOrEqual(3);
  });

  it('detects English filler words (um, like, basically)', () => {
    const { result } = renderHook(() => useSpeechRecognition({ lang: 'en-US' }));

    act(() => {
      result.current.startListening();
    });

    const mockEvent = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Um basically I would like use Redis for caching' }], { isFinal: true })
      ]
    };

    act(() => {
      mockRecognitionInstance.onresult?.(mockEvent);
    });

    expect(result.current.metrics.fillerWords).toContain('um');
    expect(result.current.metrics.fillerWords).toContain('basically');
    expect(result.current.metrics.fillerWords).toContain('like');
  });

  it('resets transcript and metrics on resetTranscript()', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    act(() => {
      mockRecognitionInstance.onresult?.({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'Xin chào' }], { isFinal: true })]
      });
    });

    expect(result.current.finalTranscript).toBe('Xin chào');

    act(() => {
      result.current.resetTranscript();
    });

    expect(result.current.finalTranscript).toBe('');
    expect(result.current.interimTranscript).toBe('');
    expect(result.current.metrics.wordCount).toBe(0);
    expect(result.current.metrics.fillerCount).toBe(0);
  });

  it('calls onResult callback when final transcript is received', () => {
    const onResultMock = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onResult: onResultMock }));

    act(() => {
      result.current.startListening();
    });

    act(() => {
      mockRecognitionInstance.onresult?.({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'Câu trả lời mẫu' }], { isFinal: true })]
      });
    });

    expect(onResultMock).toHaveBeenCalledWith('Câu trả lời mẫu');
  });

  it('sets error when recognition fails with not-allowed', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    act(() => {
      mockRecognitionInstance.onerror?.({ error: 'not-allowed' });
    });

    expect(result.current.error).toBe('Quyền truy cập microphone bị từ chối.');
    expect(result.current.isListening).toBe(false);
  });

  it('cleans up recognition instance on unmount', () => {
    const { result, unmount } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    unmount();
    expect(mockRecognitionInstance.stop).toHaveBeenCalled();
  });
});
