import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhiteboardController } from '../../src/controllers/WhiteboardController';
import type { GeminiVisionAnalyzer } from '../../src/services/vision/GeminiVisionAnalyzer';

describe('WhiteboardController (Micro-Task 4.4a)', () => {
  let mockAnalyzer: Partial<GeminiVisionAnalyzer>;
  let mockSnapshotModel: any;
  let controller: WhiteboardController;

  beforeEach(() => {
    mockAnalyzer = {
      analyzeImage: vi.fn().mockResolvedValue({
        detectedNodes: [{ type: 'DATABASE', label: 'Postgres' }],
        issues: [],
        tradeOffEvaluation: { vi: 'Hợp lý', en: 'Reasonable' },
        score: 9,
      }),
    };

    mockSnapshotModel = {
      create: vi.fn().mockResolvedValue({
        _id: 'snapshot-123',
        sessionId: 'session-456',
        questionId: 'q-1',
      }),
    };

    controller = new WhiteboardController(
      mockAnalyzer as GeminiVisionAnalyzer,
      mockSnapshotModel
    );
  });

  it('analyzes image, persists snapshot and returns 200 with analysis result', async () => {
    const validBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const req: any = {
      params: { id: '654321654321654321654321' },
      body: {
        questionId: 'q-1',
        imageBase64: validBase64,
        mimeType: 'image/png',
      },
    };

    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await controller.analyzeSnapshot(req, res);

    expect(mockAnalyzer.analyzeImage).toHaveBeenCalled();
    expect(mockSnapshotModel.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          analysis: expect.objectContaining({ score: 9 }),
        }),
      })
    );
  });
});
