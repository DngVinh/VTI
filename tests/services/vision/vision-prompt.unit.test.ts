import { describe, it, expect } from 'vitest';
import {
  SYSTEM_DESIGN_VISION_SYSTEM,
  buildVisionPrompt,
} from '../../../src/services/vision/vision-prompt';

describe('Vision Prompt Builder (Micro-Task 4.3)', () => {
  it('contains strict Vietnamese instruction and system design evaluation criteria', () => {
    expect(SYSTEM_DESIGN_VISION_SYSTEM).toContain('Template AIU-VISION-v1');
    expect(SYSTEM_DESIGN_VISION_SYSTEM).toContain('tiếng Việt');
    expect(SYSTEM_DESIGN_VISION_SYSTEM).toContain('Single Point of Failure');
    expect(SYSTEM_DESIGN_VISION_SYSTEM).toContain('CAP');
  });

  it('builds multimodal prompt payload containing image parts and sanitized context', () => {
    const payload = buildVisionPrompt({
      imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      mimeType: 'image/png',
      questionContext: 'Thiết kế hệ thống URL Shortener tải cao 100k QPS',
    });

    expect(payload.systemInstruction).toBe(SYSTEM_DESIGN_VISION_SYSTEM);
    expect(payload.inlineData.mimeType).toBe('image/png');
    expect(payload.inlineData.data).toBeTruthy();
    expect(payload.textPrompt).toContain('Thiết kế hệ thống URL Shortener');
  });
});
