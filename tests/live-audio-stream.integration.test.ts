import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/user.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { generateAuthTokens } from '../src/utils/token';
import { container } from '../src/config/di';
import { LiveAudioWebSocketServer } from '../src/infrastructure/websocket/websocketServer';
import { GeminiLiveRelay } from '../src/infrastructure/websocket/GeminiLiveRelay';
import { AudioResampler } from '../src/services/live-audio/AudioResampler';
import { CloudTtsService } from '../src/services/live-audio/CloudTtsService';
import type { LiveServerEvent } from '../src/services/live-audio/types';

let mongo: MongoMemoryReplSet;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await InterviewSessionModel.deleteMany({});
});

describe('Phase 5: Gemini Multimodal Live Audio Stream Integration (Micro-Task 5.10)', () => {
  it('resamples 48kHz Float32 browser audio into 16kHz Int16 PCM and back', () => {
    // Create 1 second of 48kHz sine wave
    const sampleRateIn = 48000;
    const numSamples = 48000;
    const inputFloat32 = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      inputFloat32[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRateIn);
    }

    const pcm16kBuffer = AudioResampler.resampleFloat32ToInt16(inputFloat32, sampleRateIn, 16000);
    expect(pcm16kBuffer.length).toBe(16000 * 2); // 16000 samples * 2 bytes/sample

    const backToFloat = AudioResampler.pcmInt16ToFloat32(pcm16kBuffer);
    expect(backToFloat.length).toBe(16000);
    expect(backToFloat instanceof Float32Array).toBe(true);
  });

  it('synthesizes Vietnamese voice with CloudTtsService and utilizes LRU cache', async () => {
    const ttsService = container.resolve(CloudTtsService);

    const text = 'Xin chào, đây là hệ thống phỏng vấn AI.';
    const result1 = await ttsService.synthesizeVietnamese(text);
    expect(result1.audioBase64).toBeDefined();
    expect(result1.sampleRate).toBe(16000);

    // Second call should hit memory cache
    const result2 = await ttsService.synthesizeVietnamese(text);
    expect(result2.audioBase64).toBe(result1.audioBase64);
  });

  it('runs full-duplex live session with interrupt and audio streaming', async () => {
    const candidate = await User.create({
      fullName: 'Audio Candidate',
      email: 'audio.candidate@example.com',
      password: 'Password123!',
      role: 'CANDIDATE',
    });

    const tokens = generateAuthTokens(candidate._id.toString(), 'CANDIDATE');

    const session = await InterviewSessionModel.create({
      userId: candidate._id,
      jobPosition: new mongoose.Types.ObjectId(),
      level: new mongoose.Types.ObjectId(),
      techStacks: [new mongoose.Types.ObjectId()],
      language: 'VI',
      status: 'IN_PROGRESS',
      secondsPerQuestion: 300,
      totalQuestions: 5,
      currentQuestionIndex: 0,
    });

    const relay = container.resolve(GeminiLiveRelay);
    const mockRepo = {
      findById: async (id: string) => {
        const found = await InterviewSessionModel.findById(id).lean();
        if (!found) return null;
        return {
          id: (found as any)._id.toString(),
          userId: (found as any).userId.toString(),
          status: (found as any).status,
        };
      },
    };

    const wsServer = new LiveAudioWebSocketServer(relay, mockRepo as any);

    const sentServerEvents: LiveServerEvent[] = [];
    const clientListeners: Record<string, Function> = {};

    const mockSocket = {
      send: vi.fn((data: string) => {
        sentServerEvents.push(JSON.parse(data));
      }),
      on: vi.fn((event: string, cb: Function) => {
        clientListeners[event] = cb;
      }),
      close: vi.fn(),
      readyState: 1,
    };

    const req = {
      url: `/api/v1/interviews/${session._id.toString()}/live-audio?token=${tokens.accessToken}`,
      headers: {},
    };

    // 1. Handshake & connect
    await wsServer.handleConnection(mockSocket as any, req as any);
    expect(mockSocket.close).not.toHaveBeenCalled();

    // 2. Client initiates START_SESSION
    await clientListeners['message'](
      JSON.stringify({
        type: 'START_SESSION',
        sessionId: session._id.toString(),
        questionId: 'q-1',
      })
    );

    expect(sentServerEvents).toContainEqual(
      expect.objectContaining({
        type: 'SESSION_STARTED',
        sampleRate: 16000,
      })
    );
    expect(sentServerEvents).toContainEqual(
      expect.objectContaining({
        type: 'AUDIO_RESPONSE',
      })
    );

    // 3. Client streams AUDIO_CHUNK
    sentServerEvents.length = 0;
    const dummyAudioChunk = Buffer.alloc(1600, 1).toString('base64');
    await clientListeners['message'](
      JSON.stringify({
        type: 'AUDIO_CHUNK',
        pcmBase64: dummyAudioChunk,
      })
    );

    expect(sentServerEvents).toContainEqual(
      expect.objectContaining({
        type: 'TRANSCRIPT_UPDATE',
        role: 'CANDIDATE',
      })
    );
    expect(sentServerEvents).toContainEqual(
      expect.objectContaining({
        type: 'AUDIO_RESPONSE',
      })
    );

    // 4. Candidate interrupts AI
    sentServerEvents.length = 0;
    await clientListeners['message'](
      JSON.stringify({
        type: 'INTERRUPT',
      })
    );

    expect(sentServerEvents).toContainEqual({
      type: 'INTERRUPTED',
    });

    // Subsequent audio chunk after interrupt should not generate AI audio
    sentServerEvents.length = 0;
    await clientListeners['message'](
      JSON.stringify({
        type: 'AUDIO_CHUNK',
        pcmBase64: dummyAudioChunk,
      })
    );
    const audioResponses = sentServerEvents.filter((e) => e.type === 'AUDIO_RESPONSE');
    expect(audioResponses.length).toBe(0);

    // 5. Client stops session
    await clientListeners['message'](
      JSON.stringify({
        type: 'STOP_SESSION',
      })
    );
  });
});
