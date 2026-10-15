import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { CloudTtsService } from '../../../src/services/live-audio/CloudTtsService';

describe('CloudTtsService (Micro-Task 5.4)', () => {
  it('synthesizes Vietnamese speech using Neural2 voice', async () => {
    const mockTtsClient = {
      synthesizeSpeech: vi.fn().mockResolvedValue([
        {
          audioContent: Buffer.from('fake-audio-bytes-pcm'),
        },
      ]),
    };

    const ttsService = new CloudTtsService(mockTtsClient as any);

    const result = await ttsService.synthesizeVietnamese(
      'Chào bạn, hãy giới thiệu về bản thân.'
    );

    expect(result).toBeDefined();
    expect(result.audioBase64).toBeTruthy();
    expect(mockTtsClient.synthesizeSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        voice: expect.objectContaining({
          languageCode: 'vi-VN',
          name: 'vi-VN-Neural2-A',
        }),
      })
    );
  });

  it('uses in-memory cache on subsequent requests for identical text', async () => {
    const mockTtsClient = {
      synthesizeSpeech: vi.fn().mockResolvedValue([
        {
          audioContent: Buffer.from('fake-audio-cached'),
        },
      ]),
    };

    const ttsService = new CloudTtsService(mockTtsClient as any);

    await ttsService.synthesizeVietnamese('Câu hỏi lặp lại');
    await ttsService.synthesizeVietnamese('Câu hỏi lặp lại');

    // Called only once due to cache hit
    expect(mockTtsClient.synthesizeSpeech).toHaveBeenCalledOnce();
  });
});
