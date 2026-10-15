import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PcmRecorderProcessor (Micro-Task 5.6)', () => {
  let PcmRecorderProcessor: any;
  let mockPort: {
    postMessage: any;
  };

  beforeEach(async () => {
    mockPort = {
      postMessage: vi.fn(),
    };

    // Mock AudioWorkletProcessor base class if not present in Node environment
    (globalThis as any).AudioWorkletProcessor = class {
      port = mockPort;
    };

    // Load worklet module
    const workletModule = await import('../../../../public/pcm-recorder-worklet.js' as any);
    PcmRecorderProcessor = workletModule.PcmRecorderProcessor;
  });

  it('converts Float32 audio samples to Int16 PCM correctly', () => {
    const processor = new PcmRecorderProcessor();
    const floatSamples = new Float32Array([0, 1.0, -1.0, 0.5, -0.5]);
    const inputs = [[floatSamples]];
    const outputs = [[]];

    const shouldContinue = processor.process(inputs, outputs, {});

    expect(shouldContinue).toBe(true);
    expect(mockPort.postMessage).toHaveBeenCalledTimes(1);

    const postedBuffer = mockPort.postMessage.mock.calls[0][0];
    const int16Result = new Int16Array(postedBuffer);

    expect(int16Result[0]).toBe(0);
    expect(int16Result[1]).toBe(32767);
    expect(int16Result[2]).toBe(-32768);
    expect(int16Result[3]).toBe(16383); // 0.5 * 0x7FFF ≈ 16383
    expect(int16Result[4]).toBe(-16384); // -0.5 * 0x8000 = -16384
  });

  it('clamps audio values exceeding [-1.0, 1.0] range', () => {
    const processor = new PcmRecorderProcessor();
    const floatSamples = new Float32Array([2.5, -3.0]);
    const inputs = [[floatSamples]];

    processor.process(inputs, [[]], {});

    const postedBuffer = mockPort.postMessage.mock.calls[0][0];
    const int16Result = new Int16Array(postedBuffer);

    expect(int16Result[0]).toBe(32767);
    expect(int16Result[1]).toBe(-32768);
  });

  it('returns true and handles empty or missing inputs gracefully', () => {
    const processor = new PcmRecorderProcessor();

    const emptyInputsResult = processor.process([], [[]], {});
    expect(emptyInputsResult).toBe(true);

    const emptyChannelsResult = processor.process([[]], [[]], {});
    expect(emptyChannelsResult).toBe(true);
  });
});
