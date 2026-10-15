import { injectable, inject } from 'tsyringe';
import type { LiveClientEvent, LiveServerEvent } from '../../services/live-audio/types';
import { CloudTtsService } from '../../services/live-audio/CloudTtsService';

export interface WebSocketConnection {
  send(data: string): void;
  on(event: string, callback: (...args: any[]) => void): void;
  readyState: number;
}

@injectable()
export class GeminiLiveRelay {
  private isInterrupted = false;

  constructor(
    @inject(CloudTtsService) private readonly ttsService?: CloudTtsService
  ) {}

  async handleClientEvent(
    socket: WebSocketConnection,
    event: LiveClientEvent
  ): Promise<void> {
    switch (event.type) {
      case 'START_SESSION': {
        this.isInterrupted = false;
        const response: LiveServerEvent = {
          type: 'SESSION_STARTED',
          sampleRate: 16000,
        };
        socket.send(JSON.stringify(response));

        // Send initial greeting / question speech
        const greetingAudio = Buffer.alloc(1600).toString('base64');
        const audioResponse: LiveServerEvent = {
          type: 'AUDIO_RESPONSE',
          pcmBase64: greetingAudio,
        };
        socket.send(JSON.stringify(audioResponse));
        break;
      }

      case 'AUDIO_CHUNK': {
        if (this.isInterrupted) return;

        // Simulate voice recognition and response
        const candidateTranscript: LiveServerEvent = {
          type: 'TRANSCRIPT_UPDATE',
          role: 'CANDIDATE',
          text: 'Ứng viên đang trả lời...',
          isFinal: false,
        };
        socket.send(JSON.stringify(candidateTranscript));

        const dummyPcm = Buffer.alloc(3200).toString('base64');
        const audioResponse: LiveServerEvent = {
          type: 'AUDIO_RESPONSE',
          pcmBase64: dummyPcm,
        };
        socket.send(JSON.stringify(audioResponse));
        break;
      }

      case 'INTERRUPT': {
        this.isInterrupted = true;
        const response: LiveServerEvent = {
          type: 'INTERRUPTED',
        };
        socket.send(JSON.stringify(response));
        break;
      }

      case 'STOP_SESSION': {
        this.isInterrupted = true;
        break;
      }
    }
  }
}
