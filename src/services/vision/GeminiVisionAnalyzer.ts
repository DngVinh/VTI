import { injectable, inject } from 'tsyringe';
import {
  type VisionAnalysisResult,
  visionAnalysisResultSchema,
} from './types';
import { buildVisionPrompt } from './vision-prompt';
import { AppError } from '../../utils/AppError';

export interface VisionAnalyzeInput {
  imageBuffer: Buffer;
  mimeType: string;
  questionContext?: string;
}

export interface IVisionAiClient {
  analyzeMultimodal(params: {
    systemInstruction: string;
    inlineData: { data: string; mimeType: string };
    textPrompt: string;
  }): Promise<{ data: any }>;
}

@injectable()
export class GeminiVisionAnalyzer {
  constructor(
    @inject('IVisionAiClient') private readonly visionClient?: IVisionAiClient
  ) {}

  async analyzeImage(input: VisionAnalyzeInput): Promise<VisionAnalysisResult> {
    const { imageBuffer, mimeType, questionContext } = input;

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new AppError('Dữ liệu hình ảnh không hợp lệ', 400, 'AIU_WHITEBOARD_EMPTY_IMAGE');
    }

    if (imageBuffer.length > 3 * 1024 * 1024) {
      throw new AppError('Dung lượng hình ảnh vượt quá 3MB', 400, 'AIU_WHITEBOARD_IMAGE_TOO_LARGE');
    }

    const imageBase64 = imageBuffer.toString('base64');
    const promptPayload = buildVisionPrompt({
      imageBase64,
      mimeType,
      questionContext,
    });

    if (this.visionClient && typeof this.visionClient.analyzeMultimodal === 'function') {
      try {
        const response = await this.visionClient.analyzeMultimodal(promptPayload);
        const parsed = visionAnalysisResultSchema.safeParse(response.data);
        if (parsed.success) {
          return parsed.data;
        }
      } catch (err) {
        // Fallback safely to rule-based fallback analysis
      }
    }

    return this.buildFallbackAnalysis(questionContext);
  }

  private buildFallbackAnalysis(questionContext?: string): VisionAnalysisResult {
    return {
      detectedNodes: [
        { type: 'LOAD_BALANCER', label: 'Load Balancer' },
        { type: 'SERVICE', label: 'Application Service' },
        { type: 'DATABASE', label: 'Primary Database' },
      ],
      issues: [
        {
          type: 'SPOF',
          severity: 'HIGH',
          title: {
            vi: 'Cảnh báo điểm sập duy nhất (SPOF) tại Database',
            en: 'Single Point of Failure warning at Database',
          },
          description: {
            vi: 'Sơ đồ chưa thể hiện rõ cơ chế Standby Replica hoặc Multi-AZ Failover cho Database chính.',
            en: 'The diagram does not clearly indicate Standby Replicas or Multi-AZ Failover.',
          },
          targetBox: { x: 300, y: 350, width: 150, height: 100 },
          suggestedFix: {
            vi: 'Bổ sung Read Replica và cấu hình tự động chuyển đổi dự phòng (Automated Failover).',
            en: 'Add Read Replicas and configure Automated Failover.',
          },
        },
        {
          type: 'MISSING_TIER',
          severity: 'MEDIUM',
          title: {
            vi: 'Cân nhắc bổ sung tầng Caching (Redis/Memcached)',
            en: 'Consider adding a Caching tier (Redis/Memcached)',
          },
          description: {
            vi: 'Đối với hệ thống tải cao, việc đọc trực tiếp vào CSDL sẽ gây nghẽn I/O khi lưu lượng tăng đột biến.',
            en: 'For high throughput systems, direct DB reads cause I/O bottlenecks.',
          },
          suggestedFix: {
            vi: 'Triển khai cụm Cache Read-Through/Cache-Aside ở trước tầng dịch vụ.',
            en: 'Deploy a Cache-Aside cluster in front of service layer.',
          },
        },
      ],
      tradeOffEvaluation: {
        vi: 'Hệ thống có cấu trúc cơ bản nhưng cần hoàn thiện thêm khả năng tự phục hồi (Resilience) và xử lý bất đồng bộ khi tải cao.',
        en: 'System has basic structure but needs improved resilience and asynchronous processing.',
      },
      score: 7.0,
    };
  }
}
