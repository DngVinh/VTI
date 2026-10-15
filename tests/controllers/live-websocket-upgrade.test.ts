import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveAudioWebSocketServer } from '../../src/infrastructure/websocket/websocketServer';
import { GeminiLiveRelay } from '../../src/infrastructure/websocket/GeminiLiveRelay';
import type { IInterviewRepository } from '../../src/repositories/IInterviewRepository';
import * as tokenUtils from '../../src/utils/token';

describe('LiveAudioWebSocketServer (Micro-Task 5.5)', () => {
  let relay: GeminiLiveRelay;
  let mockInterviewRepo: Partial<IInterviewRepository>;
  let wsServer: LiveAudioWebSocketServer;

  beforeEach(() => {
    vi.restoreAllMocks();
    relay = new GeminiLiveRelay();
    vi.spyOn(relay, 'handleClientEvent').mockResolvedValue(undefined);

    mockInterviewRepo = {
      findById: vi.fn(),
    };

    wsServer = new LiveAudioWebSocketServer(relay, mockInterviewRepo as IInterviewRepository);
  });

  it('rejects connection with 4001 when token is missing', async () => {
    const mockSocket = {
      close: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
      readyState: 1,
    };

    const req = {
      url: '/api/v1/interviews/session-123/live-audio',
      headers: {},
    };

    await wsServer.handleConnection(mockSocket as any, req as any);

    expect(mockSocket.close).toHaveBeenCalledWith(4001, expect.stringContaining('AIU_LIVE_WEBSOCKET_UNAUTHORIZED'));
  });

  it('rejects connection when interview session is not found', async () => {
    vi.spyOn(tokenUtils, 'verifyAccessToken').mockReturnValue({
      sub: 'user-123',
      role: 'candidate',
      type: 'access',
      credentialVersion: 1,
    });
    (mockInterviewRepo.findById as any).mockResolvedValue(null);

    const mockSocket = {
      close: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
      readyState: 1,
    };

    const req = {
      url: '/api/v1/interviews/session-999/live-audio?token=valid_token',
      headers: {},
    };

    await wsServer.handleConnection(mockSocket as any, req as any);

    expect(mockSocket.close).toHaveBeenCalledWith(4004, expect.stringContaining('AIU_QUESTION_NOT_FOUND'));
  });

  it('rejects connection when interview does not belong to the user', async () => {
    vi.spyOn(tokenUtils, 'verifyAccessToken').mockReturnValue({
      sub: 'user-other',
      role: 'candidate',
      type: 'access',
      credentialVersion: 1,
    });
    (mockInterviewRepo.findById as any).mockResolvedValue({
      id: 'session-123',
      userId: 'user-owner',
      status: 'IN_PROGRESS',
    });

    const mockSocket = {
      close: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
      readyState: 1,
    };

    const req = {
      url: '/api/v1/interviews/session-123/live-audio?token=valid_token',
      headers: {},
    };

    await wsServer.handleConnection(mockSocket as any, req as any);

    expect(mockSocket.close).toHaveBeenCalledWith(4003, expect.stringContaining('Forbidden'));
  });

  it('accepts connection and binds message handler to GeminiLiveRelay', async () => {
    vi.spyOn(tokenUtils, 'verifyAccessToken').mockReturnValue({
      sub: 'user-owner',
      role: 'candidate',
      type: 'access',
      credentialVersion: 1,
    });
    (mockInterviewRepo.findById as any).mockResolvedValue({
      id: 'session-123',
      userId: 'user-owner',
      status: 'IN_PROGRESS',
    });

    const handlers: Record<string, Function> = {};
    const mockSocket = {
      close: vi.fn(),
      send: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        handlers[event] = cb;
      }),
      readyState: 1,
    };

    const req = {
      url: '/api/v1/interviews/session-123/live-audio?token=valid_token',
      headers: {},
    };

    await wsServer.handleConnection(mockSocket as any, req as any);

    expect(mockSocket.close).not.toHaveBeenCalled();
    expect(handlers['message']).toBeDefined();

    // Test incoming message dispatch
    const payload = JSON.stringify({ type: 'START_SESSION', sessionId: 'session-123', questionId: 'q-1' });
    await handlers['message'](payload);

    expect(relay.handleClientEvent).toHaveBeenCalledWith(mockSocket, {
      type: 'START_SESSION',
      sessionId: 'session-123',
      questionId: 'q-1',
    });
  });

  it('rate limits client sending over 50 audio packets per second', async () => {
    vi.spyOn(tokenUtils, 'verifyAccessToken').mockReturnValue({
      sub: 'user-owner',
      role: 'candidate',
      type: 'access',
      credentialVersion: 1,
    });
    (mockInterviewRepo.findById as any).mockResolvedValue({
      id: 'session-123',
      userId: 'user-owner',
      status: 'IN_PROGRESS',
    });

    const handlers: Record<string, Function> = {};
    const mockSocket = {
      close: vi.fn(),
      send: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        handlers[event] = cb;
      }),
      readyState: 1,
    };

    const req = {
      url: '/api/v1/interviews/session-123/live-audio?token=valid_token',
      headers: {},
    };

    await wsServer.handleConnection(mockSocket as any, req as any);

    // Send 51 AUDIO_CHUNK messages
    const chunkMsg = JSON.stringify({ type: 'AUDIO_CHUNK', pcmBase64: 'AA==' });
    for (let i = 0; i < 51; i++) {
      await handlers['message'](chunkMsg);
    }

    expect(mockSocket.close).toHaveBeenCalledWith(4008, expect.stringContaining('AIU_LIVE_WEBSOCKET_RATE_LIMITED'));
  });
});
