import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { GeminiVisionAnalyzer } from '../../../src/services/vision/GeminiVisionAnalyzer';
import type { VisionAnalysisResult } from '../../../src/services/vision/types';

describe('GeminiVisionAnalyzer (Micro-Task 4.2)', () => {
  it('analyzes image and returns validated architecture critique', async () => {
    const mockVisionAi = {
      analyzeMultimodal: vi.fn().mockResolvedValue({
        data: {
          detectedNodes: [
            { type: 'LOAD_BALANCER', label: 'AWS ALB' },
            { type: 'SERVICE', label: 'Backend Pods' },
            { type: 'DATABASE', label: 'Aurora MySQL' },
          ],
          issues: [
            {
              type: 'SPOF',
              severity: 'HIGH',
              title: { vi: 'Chưa có Read Replica', en: 'No Read Replica' },
              description: {
                vi: 'Cơ sở dữ liệu Aurora chỉ có 1 instance ghi duy nhất.',
                en: 'Aurora DB only has single write instance.',
              },
              suggestedFix: {
                vi: 'Kích hoạt Multi-AZ Auto-failover và Read Replica.',
                en: 'Enable Multi-AZ Auto-failover and Read Replicas.',
              },
            },
          ],
          tradeOffEvaluation: {
            vi: 'Hệ thống đảm bảo tính ACID cao nhưng chi phí phần cứng sẽ tăng.',
            en: 'High ACID consistency at higher infrastructure cost.',
          },
          score: 8,
        },
      }),
    };

    const analyzer = new GeminiVisionAnalyzer(mockVisionAi as any);

    const imageBuffer = Buffer.from('fake-image-bytes-base64');
    const result: VisionAnalysisResult = await analyzer.analyzeImage({
      imageBuffer,
      mimeType: 'image/png',
      questionContext: 'Thiết kế hệ thống TMĐT',
    });

    expect(result.score).toBe(8);
    expect(result.detectedNodes.length).toBe(3);
    expect(result.issues[0].type).toBe('SPOF');
    expect(result.issues[0].title.vi).toBe('Chưa có Read Replica');
    expect(mockVisionAi.analyzeMultimodal).toHaveBeenCalledOnce();
  });

  it('falls back safely to default analysis when AI provider errors', async () => {
    const mockVisionAi = {
      analyzeMultimodal: vi.fn().mockRejectedValue(new Error('AI Service Unavailable')),
    };

    const analyzer = new GeminiVisionAnalyzer(mockVisionAi as any);

    const imageBuffer = Buffer.from('fake-image-bytes');
    const result = await analyzer.analyzeImage({
      imageBuffer,
      mimeType: 'image/png',
    });

    expect(result.score).toBeGreaterThanOrEqual(5);
    expect(result.tradeOffEvaluation.vi).toBeTruthy();
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
  });
});
