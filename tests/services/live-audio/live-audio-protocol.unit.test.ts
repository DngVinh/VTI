import { describe, it, expect } from 'vitest';
import {
  liveClientEventSchema,
  liveServerEventSchema,
  type LiveClientEvent,
  type LiveServerEvent,
} from '../../../src/services/live-audio/types';

describe('Live Audio Protocol & Payloads (Micro-Task 5.1)', () => {
  it('validates client start and audio events', () => {
    const startEvent: LiveClientEvent = {
      type: 'START_SESSION',
      sessionId: 'sess-123',
      questionId: 'q-456',
    };
    expect(liveClientEventSchema.safeParse(startEvent).success).toBe(true);

    const chunkEvent: LiveClientEvent = {
      type: 'AUDIO_CHUNK',
      pcmBase64: 'AAAA////AAAA////',
    };
    expect(liveClientEventSchema.safeParse(chunkEvent).success).toBe(true);

    const interruptEvent: LiveClientEvent = {
      type: 'INTERRUPT',
    };
    expect(liveClientEventSchema.safeParse(interruptEvent).success).toBe(true);
  });

  it('validates server session started and audio response events', () => {
    const startedEvent: LiveServerEvent = {
      type: 'SESSION_STARTED',
      sampleRate: 16000,
    };
    expect(liveServerEventSchema.safeParse(startedEvent).success).toBe(true);

    const transcriptEvent: LiveServerEvent = {
      type: 'TRANSCRIPT_UPDATE',
      role: 'INTERVIEWER',
      text: 'Chào bạn, chúng ta bắt đầu phần phỏng vấn.',
      isFinal: true,
    };
    expect(liveServerEventSchema.safeParse(transcriptEvent).success).toBe(true);

    const errorEvent: LiveServerEvent = {
      type: 'ERROR',
      code: 'AIU_LIVE_TIMEOUT',
      message: 'Kết nối âm thanh gián đoạn',
    };
    expect(liveServerEventSchema.safeParse(errorEvent).success).toBe(true);
  });
});
