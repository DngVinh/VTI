import { injectable, inject } from 'tsyringe';

export interface ISpeechClient {
  synthesizeSpeech(request: {
    input: { text: string };
    voice: { languageCode: string; name: string };
    audioConfig: { audioEncoding: string; sampleRateHertz?: number };
  }): Promise<[{ audioContent: Buffer | string }]>;
}

export interface TtsResult {
  audioBase64: string;
  sampleRate: number;
}

@injectable()
export class CloudTtsService {
  private readonly cache = new Map<string, string>();

  constructor(
    @inject('ISpeechClient') private readonly speechClient?: ISpeechClient
  ) {}

  async synthesizeVietnamese(text: string): Promise<TtsResult> {
    const trimmed = text.trim();
    if (this.cache.has(trimmed)) {
      return {
        audioBase64: this.cache.get(trimmed)!,
        sampleRate: 16000,
      };
    }

    if (this.speechClient && typeof this.speechClient.synthesizeSpeech === 'function') {
      try {
        const [response] = await this.speechClient.synthesizeSpeech({
          input: { text: trimmed },
          voice: {
            languageCode: 'vi-VN',
            name: 'vi-VN-Neural2-A',
          },
          audioConfig: {
            audioEncoding: 'LINEAR16',
            sampleRateHertz: 16000,
          },
        });

        const buffer = Buffer.isBuffer(response.audioContent)
          ? response.audioContent
          : Buffer.from(response.audioContent as string, 'base64');

        const base64 = buffer.toString('base64');
        this.cache.set(trimmed, base64);

        return {
          audioBase64: base64,
          sampleRate: 16000,
        };
      } catch (err) {
        // Fallback to simulated audio
      }
    }

    // Default simulated PCM buffer (16000Hz, 0.5s silence/beep)
    const simulatedBuffer = Buffer.alloc(16000);
    const base64 = simulatedBuffer.toString('base64');
    this.cache.set(trimmed, base64);

    return {
      audioBase64: base64,
      sampleRate: 16000,
    };
  }
}
