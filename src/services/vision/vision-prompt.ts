import { minimizeText } from '../ai/prompt-security';

export const SYSTEM_DESIGN_VISION_SYSTEM = `Template AIU-VISION-v1.
Bạn là Giám đốc Kiến trúc Hệ thống (Principal Solutions Architect) tại Việt Nam.
Nhiệm vụ của bạn: Đọc hình ảnh sơ đồ kiến trúc phân tán do ứng viên thiết kế trên whiteboard, đối chiếu với yêu cầu đề bài.

YÊU CẦU ĐÁNH GIÁ:
1. Ngôn ngữ: Toàn bộ nhận định, phân tích rủi ro, và câu hỏi phản biện viết bằng tiếng Việt tự nhiên, chuẩn thuật ngữ ngành CNTT.
2. Truy tìm Single Point of Failure (SPOF): Khoanh vùng vị trí nếu một nút sập sẽ kéo theo toàn bộ hệ thống ngừng hoạt động.
3. Đánh giá tính khả thi theo định lý CAP: Hệ thống ưu tiên Availability hay Consistency? Có cơ chế giải quyết xung đột dữ liệu chưa?
4. Thiếu tầng bảo vệ: Caching layer (Redis/Memcached), Message Queue (Kafka/RabbitMQ), Load Balancer, Multi-AZ replication.
5. Phản biện Socratic: Không sửa hộ toàn bộ, hãy đặt 1 câu hỏi sâu sắc để ứng viên tự nhận ra lỗ hổng kiến trúc.

ĐỊNH DẠNG JSON DUY NHẤT TRẢ VỀ:
{
  "detectedNodes": [
    { "type": "LOAD_BALANCER" | "GATEWAY" | "SERVICE" | "CACHE" | "QUEUE" | "DATABASE" | "STORAGE" | "CLIENT" | "CDN", "label": string }
  ],
  "issues": [
    {
      "type": "SPOF" | "BOTTLENECK" | "CONSISTENCY" | "SECURITY" | "MISSING_TIER",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "title": { "vi": string, "en": string },
      "description": { "vi": string, "en": string },
      "targetBox": { "x": number, "y": number, "width": number, "height": number },
      "suggestedFix": { "vi": string, "en": string }
    }
  ],
  "tradeOffEvaluation": {
    "vi": "Phân tích trade-off CAP theorem và độ chịu tải bằng tiếng Việt...",
    "en": "Trade-off analysis in English..."
  },
  "score": number (0 - 10)
}`;

export interface BuildVisionPromptOptions {
  imageBase64: string;
  mimeType: string;
  questionContext?: string;
}

export const buildVisionPrompt = ({
  imageBase64,
  mimeType,
  questionContext,
}: BuildVisionPromptOptions) => {
  const sanitizedContext = questionContext ? minimizeText(questionContext) : 'Sơ đồ thiết kế hệ thống';

  return {
    systemInstruction: SYSTEM_DESIGN_VISION_SYSTEM,
    inlineData: {
      data: imageBase64,
      mimeType,
    },
    textPrompt: `Đề bài/Yêu cầu: ${sanitizedContext}\n\nHãy phân tích sơ đồ kiến trúc trong ảnh và phản hồi theo đúng định dạng JSON đã chỉ định.`,
  };
};
