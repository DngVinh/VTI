import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

describe('useSpeechSynthesis', () => {
  let originalSpeechSynthesis: unknown;
  let mockSpeak: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;
  let mockPause: ReturnType<typeof vi.fn>;
  let mockResume: ReturnType<typeof vi.fn>;
  let mockGetVoices: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalSpeechSynthesis = (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;

    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    mockPause = vi.fn();
    mockResume = vi.fn();
    mockGetVoices = vi.fn().mockReturnValue([
      { name: 'Google US English', lang: 'en-US', localService: true },
      { name: 'Google Vietnamese', lang: 'vi-VN', localService: true },
    ]);

    const mockSynth = {
      speak: mockSpeak,
      cancel: mockCancel,
      pause: mockPause,
      resume: mockResume,
      getVoices: mockGetVoices,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    (window as unknown as { speechSynthesis?: unknown }).speechSynthesis = mockSynth;

    // Mock SpeechSynthesisUtterance
    interface MockUtteranceContext {
      text: string;
      lang: string;
      rate: number;
      pitch: number;
      voice: unknown;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
    }
    function MockUtterance(this: MockUtteranceContext, text?: string) {
      this.text = text || '';
      this.lang = '';
      this.rate = 1;
      this.pitch = 1;
      this.voice = null;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
    (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = MockUtterance;
  });

  afterEach(() => {
    (window as unknown as { speechSynthesis?: unknown }).speechSynthesis = originalSpeechSynthesis;
    vi.clearAllMocks();
  });

  it('returns isSupported=false when browser lacks speechSynthesis', () => {
    (window as unknown as { speechSynthesis?: unknown }).speechSynthesis = undefined;
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSupported).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
  });

  it('calls speechSynthesis.speak with correct utterance properties', () => {
    const { result } = renderHook(() => useSpeechSynthesis({ rate: 1.1, pitch: 1.0 }));
    expect(result.current.isSupported).toBe(true);

    act(() => {
      result.current.speak('Xin chào ứng viên', 'vi-VN');
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalled();
    const utterance = mockSpeak.mock.calls[0][0];
    expect(utterance.text).toBe('Xin chào ứng viên');
    expect(utterance.lang).toBe('vi-VN');
    expect(utterance.rate).toBe(1.1);
  });

  it('sets isSpeaking=true while speaking and false after end', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('Testing voice');
    });

    const utterance = mockSpeak.mock.calls[0][0];

    // Trigger onstart
    act(() => {
      utterance.onstart?.();
    });
    expect(result.current.isSpeaking).toBe(true);

    // Trigger onend
    act(() => {
      utterance.onend?.();
    });
    expect(result.current.isSpeaking).toBe(false);
  });

  it('cancels previous utterance before speaking new one', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('First text');
    });
    expect(mockCancel).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.speak('Second text');
    });
    expect(mockCancel).toHaveBeenCalledTimes(2);
  });

  it('stop() cancels speech and sets isSpeaking=false', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('Hello');
    });
    const utterance = mockSpeak.mock.calls[0][0];
    act(() => {
      utterance.onstart?.();
    });
    expect(result.current.isSpeaking).toBe(true);

    act(() => {
      result.current.stop();
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });

  it('selects Vietnamese voice when lang=vi-VN', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('Xin chào', 'vi-VN');
    });

    const utterance = mockSpeak.mock.calls[0][0];
    expect(utterance.voice).toMatchObject({ lang: 'vi-VN', name: 'Google Vietnamese' });
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useSpeechSynthesis());
    unmount();
    expect(mockCancel).toHaveBeenCalled();
  });
});
