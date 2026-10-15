import { describe, it, expect } from 'vitest';
import { AudioResampler } from '../../../src/services/live-audio/AudioResampler';

describe('AudioResampler (Micro-Task 5.3)', () => {
  it('resamples float32 array at 48kHz to int16 PCM at 16kHz', () => {
    // Generate 480 samples at 48kHz (10ms of audio)
    const float32Data = new Float32Array(480);
    for (let i = 0; i < float32Data.length; i++) {
      float32Data[i] = Math.sin((2 * Math.PI * 440 * i) / 48000); // 440Hz sine wave
    }

    const pcmBuffer = AudioResampler.resampleFloat32ToInt16(float32Data, 48000, 16000);

    // 480 samples at 48kHz -> 160 samples at 16kHz (each sample is 2 bytes int16)
    expect(pcmBuffer.length).toBe(160 * 2);
  });

  it('converts Int16 PCM buffer to Float32Array', () => {
    const int16Buffer = Buffer.alloc(200); // 100 samples
    for (let i = 0; i < 100; i++) {
      int16Buffer.writeInt16LE(16384, i * 2); // ~0.5 amplitude
    }

    const float32 = AudioResampler.pcmInt16ToFloat32(int16Buffer);
    expect(float32.length).toBe(100);
    expect(float32[0]).toBeCloseTo(0.5, 1);
  });

  it('encodes and decodes base64 PCM strings accurately', () => {
    const original = Buffer.from([0, 1, 2, 3, 4, 5]);
    const base64 = AudioResampler.bufferToBase64(original);
    const decoded = AudioResampler.base64ToBuffer(base64);

    expect(decoded.equals(original)).toBe(true);
  });
});
