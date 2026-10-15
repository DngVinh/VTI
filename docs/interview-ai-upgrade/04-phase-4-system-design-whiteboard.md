# AIP-AIU-04 — Phase 4: System Design Interactive Whiteboard & Multimodal Vision Critique

## 1. Executive Summary & Acceptance Criteria

Pha 4 đưa hệ thống phỏng vấn vào phân khúc cao cấp (Senior, Tech Lead, Principal Engineer, Solutions Architect) bằng tính năng **Bảng vẽ Kiến trúc Trực quan (System Design Whiteboard)** kết hợp **Phân tích Thị giác AI (Multimodal Gemini Vision Critique)**.

### Acceptance Criteria (AC):
1. **AC-01 (Architecture Canvas)**: Tích hợp bảng vẽ kéo-thả trực quan hỗ trợ các khối thành phần hệ thống chuẩn: Client/Mobile, CDN, Load Balancer, API Gateway, Microservice, Message Queue (Kafka/RabbitMQ), Distributed Cache (Redis), Primary/Replica Database, Object Storage (S3).
2. **AC-02 (Canvas Snapshot Export)**: Tự động trích xuất snapshot hình ảnh canvas (Base64 PNG/WebP) với dung lượng tối ưu (< 1MB) khi ứng viên nộp hoặc yêu cầu phản biện.
3. **AC-03 (Multimodal Vision Analysis)**: Gemini Vision đọc ảnh sơ đồ kiến trúc, nhận diện các nút (nodes) và luồng kết nối (edges), tự động phát hiện:
   - Điểm nghẽn duy nhất dẫn đến sập toàn bộ hệ thống (Single Point of Failure - SPOF).
   - Nghẽn cổ chai (Bottlenecks) trong luồng dữ liệu.
   - Vi phạm tính nhất quán dữ liệu (CAP theorem trade-offs).
   - Thiếu sót các tầng bảo vệ (ví dụ: DB đọc tải cao nhưng không có Caching layer, hoặc tác vụ nặng chạy đồng bộ thay vì đẩy vào Message Queue).
4. **AC-04 (Interactive Visual Feedback)**: AI phản hồi bằng nhận xét chuyên sâu bằng tiếng Việt, kèm toạ độ vùng lỗi để canvas vẽ khung cảnh báo màu đỏ trực tiếp lên sơ đồ.

---

## 2. Danh Sách Micro-Tasks (1 Seam - 1 File)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Micro-Task 4.1: Định nghĩa System Design Canvas Data Types             │
│ Micro-Task 4.2: Xây dựng Module Gemini Vision Architecture Analyzer    │
│ Micro-Task 4.3: Prompt Chuyên Sâu Cho System Design Socratic Reviewer  │
│ Micro-Task 4.4a: Triển khai WhiteboardController                       │
│ Micro-Task 4.4b: Định tuyến POST /whiteboard trong interview.route.ts  │
│ Micro-Task 4.5: Schema & Model WhiteboardSnapshot                      │
│ Micro-Task 4.6: Component SystemDesignCanvas (Excalidraw / SVG Canvas) │
│ Micro-Task 4.7: Component ArchitectureCritiqueOverlay                  │
│ Micro-Task 4.8: Hook useSystemDesignWhiteboard                         │
│ Micro-Task 4.9a: Bổ sung AnswerMode 'whiteboard' trong client/types.ts │
│ Micro-Task 4.9b: Tích hợp Workspace Chế Độ Whiteboard vào InterviewRoom│
│ Micro-Task 4.10: Integration Test Toàn Diện Whiteboard Vision Analysis │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Chi Tiết Từng Micro-Task

---

### Micro-Task 4.1: Định nghĩa System Design Canvas Data Types

- **File test**: `tests/services/vision/whiteboard-types.unit.test.ts`
- **File source**: `src/services/vision/types.ts` (MỚI)
- **Đặc tả TypeScript**:
  ```typescript
  export type ArchitectureNodeType = 
    | 'CLIENT' 
    | 'CDN' 
    | 'LOAD_BALANCER' 
    | 'GATEWAY' 
    | 'SERVICE' 
    | 'CACHE' 
    | 'QUEUE' 
    | 'DATABASE' 
    | 'STORAGE';

  export interface CanvasBoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface ArchitectureIssue {
    type: 'SPOF' | 'BOTTLENECK' | 'CONSISTENCY' | 'SECURITY' | 'MISSING_TIER';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    title: { vi: string; en: string };
    description: { vi: string; en: string };
    targetBox?: CanvasBoundingBox;
    suggestedFix: { vi: string; en: string };
  }

  export interface VisionAnalysisResult {
    detectedNodes: Array<{ type: ArchitectureNodeType; label: string }>;
    issues: ArchitectureIssue[];
    tradeOffEvaluation: { vi: string; en: string };
    score: number; // 0 - 10
  }
  ```
- **Lệnh kiểm tra**: `npx vitest run tests/services/vision/whiteboard-types.unit.test.ts`

---

### Micro-Task 4.2: Xây dựng Module Gemini Vision Architecture Analyzer

- **File test**: `tests/services/vision/gemini-vision-analyzer.test.ts`
- **File source**: `src/services/vision/GeminiVisionAnalyzer.ts` (MỚI)
- **Cơ chế**: Nhận buffer hình ảnh sơ đồ từ canvas, nén và mã hóa base64, gọi model `gemini-3.8-flash` với cấu hình multimodal vision parts và strict JSON output.
- **Lệnh kiểm tra**: `npx vitest run tests/services/vision/gemini-vision-analyzer.test.ts`

---

### Micro-Task 4.3: Prompt Chuyên Sâu Cho System Design Socratic Reviewer

- **File test**: `tests/services/vision/vision-prompt.unit.test.ts`
- **File source**: `src/services/vision/vision-prompt.ts` (MỚI)
- **Quy định prompt tiếng Việt**:
  ```typescript
  export const SYSTEM_DESIGN_VISION_SYSTEM = `Template AIU-VISION-v1.
  Bạn là Giám đốc Kiến trúc Hệ thống (Principal Solutions Architect) tại Việt Nam.
  Nhiệm vụ của bạn: Đọc hình ảnh sơ đồ kiến trúc phân tán do ứng viên thiết kế, đối chiếu với đề bài phỏng vấn.

  YÊU CẦU ĐÁNH GIÁ:
  1. Ngôn ngữ: Toàn bộ nhận định, phân tích rủi ro, và câu hỏi phản biện viết bằng tiếng Việt tự nhiên, chuẩn thuật ngữ ngành.
  2. Truy tìm Single Point of Failure (SPOF): Khoanh vùng vị trí nếu một nút sập sẽ kéo theo toàn hệ thống ngừng hoạt động.
  3. Đánh giá tính khả thi theo định lý CAP: Hệ thống ưu tiên Availability hay Consistency? Có cơ chế giải quyết xung đột dữ liệu chưa?
  4. Phản biện Socratic: Không sửa hộ toàn bộ, hãy đặt 1 câu hỏi sâu sắc để ứng viên tự nhận ra lỗ hổng kiến trúc.`;
  ```
- **Lệnh kiểm tra**: `npx vitest run tests/services/vision/vision-prompt.unit.test.ts`

---

### Micro-Task 4.4a: Triển khai WhiteboardController

- **File test**: `tests/controllers/whiteboard-controller.unit.test.ts`
- **File source**: `src/controllers/WhiteboardController.ts` (MỚI)
- **Logic**: Kiểm tra quyền sở hữu session, validate dung lượng ảnh (< 3MB) và MIME type (PNG, JPEG, WebP).
- **Lệnh kiểm tra**: `npx vitest run tests/controllers/whiteboard-controller.unit.test.ts`

---

### Micro-Task 4.4b: Định tuyến POST /whiteboard trong `src/routes/interview.route.ts`

- **File test**: `tests/controllers/whiteboard-api.integration.test.ts`
- **File source**: `src/routes/interview.route.ts`
- **Lệnh kiểm tra**: `npx vitest run tests/controllers/whiteboard-api.integration.test.ts`

---

### Micro-Task 4.5: Schema & Model WhiteboardSnapshot

- **File test**: `tests/models/whiteboard-snapshot.model.test.ts`
- **File source**: `src/models/WhiteboardSnapshot.ts` (MỚI)
- **Indexes**: `{ sessionId: 1, questionId: 1 }`
- **Lệnh kiểm tra**: `npx vitest run tests/models/whiteboard-snapshot.model.test.ts`

---

### Micro-Task 4.6: Component SystemDesignCanvas (Excalidraw / SVG Canvas)

- **File test**: `client/src/features/InterviewRoom/__tests__/SystemDesignCanvas.test.tsx`
- **File source**: `client/src/features/InterviewRoom/components/SystemDesignCanvas.tsx` (MỚI)
- **Tính năng**:
  - Toolbar kéo thả icon kiến trúc (Server, Database, Redis, Kafka, Cloud).
  - Kết nối mũi tên trực quan có nhãn protocol (HTTP, gRPC, TCP).
  - Nút "Xuất ảnh & Phản biện kiến trúc".
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/SystemDesignCanvas.test.tsx`

---

### Micro-Task 4.7: Component ArchitectureCritiqueOverlay

- **File test**: `client/src/features/InterviewRoom/__tests__/ArchitectureCritiqueOverlay.test.tsx`
- **File source**: `client/src/features/InterviewRoom/components/ArchitectureCritiqueOverlay.tsx` (MỚI)
- **Hiển thị**: Lớp phủ trực quan trên canvas với các hộp màu đỏ (SPOF) và hổ phách (Bottleneck) kèm tooltip giải thích của AI.
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/ArchitectureCritiqueOverlay.test.tsx`

---

### Micro-Task 4.8: Hook useSystemDesignWhiteboard

- **File test**: `client/src/features/InterviewRoom/__tests__/useSystemDesignWhiteboard.test.ts`
- **File source**: `client/src/features/InterviewRoom/hooks/useSystemDesignWhiteboard.ts` (MỚI)
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/useSystemDesignWhiteboard.test.ts`

---

### Micro-Task 4.9a: Bổ sung AnswerMode 'whiteboard' trong `client/src/features/InterviewRoom/types.ts`

- **File test**: `client/src/features/InterviewRoom/__tests__/types.test.ts`
- **File source**: `client/src/features/InterviewRoom/types.ts`
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/types.test.ts`

---

### Micro-Task 4.9b: Tích hợp Workspace Chế Độ Whiteboard vào `InterviewRoom.tsx`

- **File test**: `client/src/features/InterviewRoom/__tests__/InterviewRoomWhiteboardMode.test.tsx`
- **File source**: `client/src/features/InterviewRoom/InterviewRoom.tsx`
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/InterviewRoomWhiteboardMode.test.tsx`

---

### Micro-Task 4.10: Integration Test Toàn Diện Whiteboard Vision Analysis

- **File test**: `tests/whiteboard-vision.integration.test.ts` (MỚI)
- **Lệnh kiểm tra**: `npx vitest run tests/whiteboard-vision.integration.test.ts`
