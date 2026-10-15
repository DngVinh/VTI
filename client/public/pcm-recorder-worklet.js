class PcmRecorderProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    // Convert Float32Array [-1.0, 1.0] to Int16Array
    const int16Buffer = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    this.port.postMessage(int16Buffer.buffer, [int16Buffer.buffer]);
    return true;
  }
}

if (typeof registerProcessor === 'function') {
  registerProcessor('pcm-recorder-processor', PcmRecorderProcessor);
}

export { PcmRecorderProcessor };
