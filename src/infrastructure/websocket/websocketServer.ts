import { injectable, inject } from 'tsyringe';
import type { IncomingMessage } from 'http';
import { GeminiLiveRelay, WebSocketConnection } from './GeminiLiveRelay';
import type { IInterviewRepository } from '../../repositories/IInterviewRepository';
import { verifyAccessToken } from '../../utils/token';
import type { LiveClientEvent } from '../../services/live-audio/types';

export interface ExtendedWebSocketConnection extends WebSocketConnection {
  close(code?: number, reason?: string): void;
}

@injectable()
export class LiveAudioWebSocketServer {
  constructor(
    @inject(GeminiLiveRelay) private readonly relay: GeminiLiveRelay,
    @inject('IInterviewRepository') private readonly interviewRepository: IInterviewRepository
  ) {}

  private extractSessionId(urlPath: string): string | null {
    const match = urlPath.match(/\/api\/v1\/interviews\/([^/?]+)\/live-audio/);
    return match ? match[1] : null;
  }

  private extractToken(req: IncomingMessage): string | null {
    if (!req.url) return null;
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const tokenParam = parsedUrl.searchParams.get('token');
      if (tokenParam) return tokenParam;
    } catch {
      // Fallback manual regex for query string
      const match = req.url.match(/[?&]token=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    const protocolHeader = req.headers['sec-websocket-protocol'];
    if (protocolHeader) {
      const protocols = protocolHeader.split(',').map((p) => p.trim());
      if (protocols.length > 0 && protocols[0] !== '') {
        return protocols[0];
      }
    }

    return null;
  }

  async handleConnection(
    socket: ExtendedWebSocketConnection,
    req: IncomingMessage
  ): Promise<void> {
    const url = req.url || '';
    const sessionId = this.extractSessionId(url);
    const token = this.extractToken(req);

    if (!token) {
      socket.close(4001, 'AIU_LIVE_WEBSOCKET_UNAUTHORIZED: Missing access token');
      return;
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      socket.close(4001, 'AIU_LIVE_WEBSOCKET_UNAUTHORIZED: Invalid access token');
      return;
    }

    if (!sessionId) {
      socket.close(4004, 'AIU_QUESTION_NOT_FOUND: Invalid interview route');
      return;
    }

    const interview = await this.interviewRepository.findById(sessionId);
    if (!interview) {
      socket.close(4004, 'AIU_QUESTION_NOT_FOUND: Interview session not found');
      return;
    }

    if (interview.userId && interview.userId !== payload.sub) {
      socket.close(4003, 'Forbidden: User not authorized for this interview session');
      return;
    }

    // Rate limiter state: 50 packets / sec
    let packetCount = 0;
    let windowStart = Date.now();

    socket.on('message', async (data: any) => {
      try {
        const rawString = typeof data === 'string' ? data : data.toString('utf-8');
        const event = JSON.parse(rawString) as LiveClientEvent;

        if (event.type === 'AUDIO_CHUNK') {
          const now = Date.now();
          if (now - windowStart >= 1000) {
            windowStart = now;
            packetCount = 0;
          }
          packetCount++;

          if (packetCount > 50) {
            socket.close(4008, 'AIU_LIVE_WEBSOCKET_RATE_LIMITED: Exceeded 50 audio packets per second');
            return;
          }
        }

        await this.relay.handleClientEvent(socket, event);
      } catch (err: any) {
        if (socket.readyState === 1) {
          socket.send(
            JSON.stringify({
              type: 'ERROR',
              code: 'AIU_INPUT_INVALID',
              message: err?.message || 'Invalid message payload',
            })
          );
        }
      }
    });
  }
}
