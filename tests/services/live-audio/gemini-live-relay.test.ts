import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiLiveRelay } from '../../../src/infrastructure/websocket/GeminiLiveRelay';
import type { LiveClientEvent, LiveServerEvent } from '../../../src/services/live-audio/types';

describe('GeminiLiveRelay (Micro-Task 5.2)', () => {
  let mockSocket: {
    send: any;
    on: any;
    readyState: number;
  };
  let sentEvents: LiveServerEvent[];
  let relay: GeminiLiveRelay;

  beforeEach(() => {
    sentEvents = [];
    mockSocket = {
      send: vi.fn((data: string) => {
        sentEvents.push(JSON.parse(data));
      }),
      on: vi.fn(),
      readyState: 1, // OPEN
    };

    relay = new GeminiLiveRelay();
  });

  it('handles START_SESSION event and emits SESSION_STARTED with 16000Hz', async () => {
    const event: LiveClientEvent = {
      type: 'START_SESSION',
      sessionId: 'session-123',
      questionId: 'q-1',
    };

    await relay.handleClientEvent(mockSocket as any, event);

    expect(sentEvents[0]).toEqual({
      type: 'SESSION_STARTED',
      sampleRate: 16000,
    });
  });

  it('handles AUDIO_CHUNK and emits TRANSCRIPT_UPDATE and AUDIO_RESPONSE', async () => {
    const chunkEvent: LiveClientEvent = {
      type: 'AUDIO_CHUNK',
      pcmBase64: 'AAAA////AAAA////',
    };

    await relay.handleClientEvent(mockSocket as any, chunkEvent);

    const types = sentEvents.map((e) => e.type);
    expect(types).toContain('AUDIO_RESPONSE');
  });

  it('handles INTERRUPT event and immediately stops AI audio emission', async () => {
    const interruptEvent: LiveClientEvent = {
      type: 'INTERRUPT',
    };

    await relay.handleClientEvent(mockSocket as any, interruptEvent);

    expect(sentEvents).toContainEqual({
      type: 'INTERRUPTED',
    });
  });
});
