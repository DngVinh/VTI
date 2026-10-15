import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useGeminiLiveAudio } from '../hooks/useGeminiLiveAudio';

class MockWebSocket {
  url: string;
  readyState: number = 0;
  onopen: any = null;
  onclose: any = null;
  onmessage: any = null;
  onerror: any = null;
  sentData: string[] = [];

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen(new Event('open'));
    }, 10);
  }

  send(data: string) {
    this.sentData.push(data);
  }

  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose(new CloseEvent('close'));
  }
}

describe('useGeminiLiveAudio (Micro-Task 5.7)', () => {
  let originalWebSocket: any;

  beforeEach(() => {
    cleanup();
    originalWebSocket = (globalThis as any).WebSocket;
    (globalThis as any).WebSocket = MockWebSocket;

    // Mock AudioContext and MediaDevices
    (globalThis as any).AudioContext = class {
      state = 'running';
      audioWorklet = {
        addModule: vi.fn().mockResolvedValue(undefined),
      };
      createMediaStreamSource = vi.fn().mockReturnValue({
        connect: vi.fn(),
      });
      createBufferSource = vi.fn().mockReturnValue({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      });
      close = vi.fn().mockResolvedValue(undefined);
    };

    if (!navigator.mediaDevices) {
      (navigator as any).mediaDevices = {};
    }
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });
  });

  afterEach(() => {
    (globalThis as any).WebSocket = originalWebSocket;
    cleanup();
  });

  it('initializes with default disconnected state', () => {
    const { result } = renderHook(() => useGeminiLiveAudio('session-123', 'token-abc'));

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isAiSpeaking).toBe(false);
    expect(result.current.currentTranscript).toBe('');
    expect(result.current.audioLevel).toBe(0);
  });

  it('connects to websocket and transitions isConnected to true', async () => {
    const { result } = renderHook(() => useGeminiLiveAudio('session-123', 'token-abc'));

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('handles AUDIO_RESPONSE and TRANSCRIPT_UPDATE events from server', async () => {
    const { result } = renderHook(() => useGeminiLiveAudio('session-123', 'token-abc'));

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    const activeWs = (result.current as any)._getWs?.();

    act(() => {
      activeWs.onmessage({
        data: JSON.stringify({
          type: 'TRANSCRIPT_UPDATE',
          role: 'INTERVIEWER',
          text: 'Xin chào bạn, hãy giới thiệu bản thân nhé.',
          isFinal: true,
        }),
      });
      activeWs.onmessage({
        data: JSON.stringify({
          type: 'AUDIO_RESPONSE',
          pcmBase64: 'AAAA',
        }),
      });
    });

    expect(result.current.currentTranscript).toBe('Xin chào bạn, hãy giới thiệu bản thân nhé.');
    expect(result.current.isAiSpeaking).toBe(true);
  });

  it('interrupt() sends INTERRUPT message and resets isAiSpeaking', async () => {
    const { result } = renderHook(() => useGeminiLiveAudio('session-123', 'token-abc'));

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    const activeWs = (result.current as any)._getWs?.();

    act(() => {
      activeWs.onmessage({
        data: JSON.stringify({
          type: 'AUDIO_RESPONSE',
          pcmBase64: 'AAAA',
        }),
      });
    });
    expect(result.current.isAiSpeaking).toBe(true);

    act(() => {
      result.current.interrupt();
    });

    expect(result.current.isAiSpeaking).toBe(false);
    expect(activeWs.sentData).toContainEqual(JSON.stringify({ type: 'INTERRUPT' }));
  });

  it('disconnect() shuts down websocket and resets connection status', async () => {
    const { result } = renderHook(() => useGeminiLiveAudio('session-123', 'token-abc'));

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isStreaming).toBe(false);
  });
});
