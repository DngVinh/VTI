export class AudioResampler {
  /**
   * Resamples Float32Array PCM audio from sourceSampleRate to targetSampleRate
   * and converts to 16-bit signed integer (Int16) Little-Endian Buffer.
   */
  static resampleFloat32ToInt16(
    float32Data: Float32Array,
    sourceSampleRate: number,
    targetSampleRate: number
  ): Buffer {
    if (sourceSampleRate === targetSampleRate) {
      const buffer = Buffer.alloc(float32Data.length * 2);
      for (let i = 0; i < float32Data.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Data[i]));
        const val = s < 0 ? s * 0x8000 : s * 0x7fff;
        buffer.writeInt16LE(Math.floor(val), i * 2);
      }
      return buffer;
    }

    const ratio = sourceSampleRate / targetSampleRate;
    const newLength = Math.round(float32Data.length / ratio);
    const buffer = Buffer.alloc(newLength * 2);

    for (let i = 0; i < newLength; i++) {
      const originalIndex = i * ratio;
      const index1 = Math.floor(originalIndex);
      const index2 = Math.min(index1 + 1, float32Data.length - 1);
      const fraction = originalIndex - index1;

      // Linear interpolation
      const sample = (1 - fraction) * float32Data[index1] + fraction * float32Data[index2];
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16Val = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      buffer.writeInt16LE(Math.floor(int16Val), i * 2);
    }

    return buffer;
  }

  /**
   * Converts a 16-bit signed integer PCM buffer to Float32Array (-1.0 to 1.0).
   */
  static pcmInt16ToFloat32(int16Buffer: Buffer): Float32Array {
    const sampleCount = Math.floor(int16Buffer.length / 2);
    const float32 = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      const int16 = int16Buffer.readInt16LE(i * 2);
      float32[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7fff;
    }

    return float32;
  }

  static bufferToBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  static base64ToBuffer(base64: string): Buffer {
    return Buffer.from(base64, 'base64');
  }
}
