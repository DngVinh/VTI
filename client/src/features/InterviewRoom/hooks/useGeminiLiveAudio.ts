import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseGeminiLiveAudioReturn {
  isConnected: boolean;
  isStreaming: boolean;
  isAiSpeaking: boolean;
  currentTranscript: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  interrupt: () => void;
  audioLevel: number;
  _getWs?: () => WebSocket | null;
}

export function useGeminiLiveAudio(
  sessionId: string,
  token?: string
): UseGeminiLiveAudioReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const connectAbortControllerRef = useRef<AbortController | null>(null);

  const interrupt = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === 1 /* OPEN */) {
      wsRef.current.send(JSON.stringify({ type: 'INTERRUPT' }));
    }
    setIsAiSpeaking(false);
  }, []);

  const disconnect = useCallback(() => {
    if (connectAbortControllerRef.current) {
      connectAbortControllerRef.current.abort();
      connectAbortControllerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (isMountedRef.current) {
      setIsConnected(false);
      setIsStreaming(false);
      setIsAiSpeaking(false);
      setAudioLevel(0);
    }
  }, []);

  const connect = useCallback(async () => {
    if (wsRef.current) {
      disconnect();
    }

    const abortController = new AbortController();
    connectAbortControllerRef.current = abortController;
    const { signal } = abortController;

    const protocol = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' && window.location?.host ? window.location.host : 'localhost:3000';
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${protocol}//${host}/api/v1/interviews/${sessionId}/live-audio${query}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      if (signal.aborted || !isMountedRef.current) return;
      if (isMountedRef.current) setIsConnected(true);
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (signal.aborted || !isMountedRef.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          mediaStreamRef.current = stream;

          const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            if (signal.aborted || !isMountedRef.current) {
              ctx.close().catch(() => {});
              return;
            }
            audioContextRef.current = ctx;

            if (ctx.audioWorklet) {
              await ctx.audioWorklet.addModule('/pcm-recorder-worklet.js');
              if (signal.aborted || !isMountedRef.current) {
                return;
              }
              if (typeof AudioWorkletNode !== 'undefined') {
                const node = new AudioWorkletNode(ctx, 'pcm-recorder-processor');
                workletNodeRef.current = node;

                node.port.onmessage = (event) => {
                  if (signal.aborted || !isMountedRef.current) return;
                  const buffer = event.data;
                  if (buffer instanceof ArrayBuffer && ws.readyState === 1) {
                    const bytes = new Uint8Array(buffer);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                      binary += String.fromCharCode(bytes[i]);
                    }
                    const base64 = btoa(binary);
                    ws.send(JSON.stringify({ type: 'AUDIO_CHUNK', pcmBase64: base64 }));
                    if (isMountedRef.current) setIsStreaming(true);
                  }
                };

                const source = ctx.createMediaStreamSource(stream);
                sourceRef.current = source;
                source.connect(node);
              }
            }
          }
        }
      } catch {
        // Media error handled gracefully
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'AUDIO_RESPONSE') {
          setIsAiSpeaking(true);
        } else if (data.type === 'TRANSCRIPT_UPDATE') {
          setCurrentTranscript(data.text || '');
        } else if (data.type === 'INTERRUPTED') {
          setIsAiSpeaking(false);
        }
      } catch {
        // Ignore parse error
      }
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      setIsConnected(false);
      setIsStreaming(false);
      setIsAiSpeaking(false);
    };

    ws.onerror = () => {
      if (!isMountedRef.current) return;
      setIsConnected(false);
    };
  }, [sessionId, token, disconnect]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isStreaming,
    isAiSpeaking,
    currentTranscript,
    connect,
    disconnect,
    interrupt,
    audioLevel,
    _getWs: () => wsRef.current,
  };
}
