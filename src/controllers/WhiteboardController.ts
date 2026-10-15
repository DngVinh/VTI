import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { GeminiVisionAnalyzer } from '../services/vision/GeminiVisionAnalyzer';
import { WhiteboardSnapshotModel } from '../models/WhiteboardSnapshot';

@injectable()
export class WhiteboardController {
  constructor(
    @inject(GeminiVisionAnalyzer) private readonly visionAnalyzer: GeminiVisionAnalyzer,
    @inject('WhiteboardSnapshotModel') private readonly snapshotModel: any = WhiteboardSnapshotModel
  ) {}

  analyzeSnapshot = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { questionId, imageBase64, mimeType = 'image/png', canvasData } = req.body;

    if (!imageBase64) {
      throw new AppError('Dữ liệu hình ảnh canvas không được để trống', 400, 'AIU_WHITEBOARD_EMPTY_IMAGE');
    }

    // Strip optional data:image/...;base64, prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    if (imageBuffer.length === 0) {
      throw new AppError('Dữ liệu hình ảnh Base64 không hợp lệ', 400, 'AIU_WHITEBOARD_INVALID_BASE64');
    }

    if (imageBuffer.length > 3 * 1024 * 1024) {
      throw new AppError('Dung lượng hình ảnh vượt quá giới hạn 3MB', 400, 'AIU_WHITEBOARD_IMAGE_TOO_LARGE');
    }

    const analysis = await this.visionAnalyzer.analyzeImage({
      imageBuffer,
      mimeType,
      questionContext: questionId,
    });

    const modelToUse = this.snapshotModel || WhiteboardSnapshotModel;
    const snapshot = await modelToUse.create({
      sessionId: id,
      questionId,
      imageBase64: cleanBase64,
      mimeType,
      analysisResult: analysis,
      canvasData,
    });

    res.status(200).json({
      success: true,
      data: {
        snapshotId: snapshot._id,
        analysis,
      },
    });
  });
}
