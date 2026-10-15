# AIP-AIU-08 — Operational Runbook, Rollout Telemetry & Kill-Switch Drills

## 1. Mục Tiêu & Nguyên Tắc Vận Hành (Operational Principles)

Tài liệu này xác lập quy trình vận hành sản xuất (Production Operations), hệ thống đo lường từ xa (Telemetry Metrics), kịch bản ứng phó sự cố (Disaster Recovery), và các cơ chế ngắt khẩn cấp (Kill-Switch Drills) cho toàn bộ các tính năng nâng cấp AI.

Mọi tính năng mới phải có khả năng **Tắt Ngay Lập Tức (Instant Zero-Downtime Rollback)** về trạng thái an toàn ban đầu mà không cần redeploy mã nguồn.

---

## 2. Bảng Điều Khiển Cờ Tính Năng Khẩn Cấp (Emergency Kill Switches)

Tất cả các biến cờ này được quản lý qua biến môi trường (`src/config/env.ts`), nạp lại runtime hoặc qua cấu hình ứng dụng:

| Cờ Tính Năng (Feature Flag) | Giá Trị Mặc Định | Hành Vi Khi `false` (Safe Fallback) | Tác Động Hệ Thống |
| :--- | :---: | :--- | :--- |
| `AIU_FOLLOW_UP_ENABLED` | `true` | Hệ thống chuyển về mô hình 5 câu hỏi tĩnh một lần (Baseline Pha 0). Nút "Gửi & Phản biện" chuyển thành "Lưu câu trả lời". | Hoàn toàn tương thích ngược, không chặn ứng viên nộp bài. |
| `AIU_MULTI_AGENT_EVALUATION_ENABLED` | `false` | Hệ thống tự động sử dụng hàm chấm đơn luồng `evaluateSafely`. | Tiết kiệm 75% chi phí token, giảm thời gian chấm xuống < 10s. |
| `AIU_SANDBOX_ENABLED` | `false` | Trình soạn thảo mã chuyển sang chế độ soạn thảo văn bản thuần (không có nút "Chạy Code", không gọi server sandbox). | Bảo vệ hệ thống nếu cụm Piston/Docker bị quá tải. |
| `AIU_VISION_ANALYSIS_ENABLED` | `false` | Canvas lưu ảnh sơ đồ vào database nhưng không gọi Gemini Vision để phản biện kiến trúc. | Giảm chi phí API Vision khi hạn ngạch Google Cloud đạt ngưỡng. |
| `AIU_GEMINI_LIVE_ENABLED` | `false` | Tắt kết nối WebSocket Live Audio. Trình duyệt tự động fallback về Web Speech API cục bộ hoặc Google Cloud TTS. | Đảm bảo ứng viên vẫn nghe được câu hỏi ngay cả khi WebSocket đóng. |

---

## 3. Hệ Thống Đo Lường Từ Xa (Telemetry & Observability)

### 3.1 Cấu Trúc Bản Ghi Telemetry (`AiuTelemetryEvent`)
Mỗi thao tác AI thực hiện đều ghi nhận một sự kiện telemetry có cấu trúc chuẩn vào hệ thống log để theo dõi hiệu năng và chi phí:

```typescript
export interface AiuTelemetryEvent {
  timestamp: string;          // ISO8601 UTC
  sessionId: string;          // ID phiên phỏng vấn
  questionId?: string;        // ID câu hỏi tương ứng
  phase: 'AIU_01' | 'AIU_02' | 'AIU_03' | 'AIU_04' | 'AIU_05';
  action: 
    | 'FOLLOW_UP_GENERATED'
    | 'FOLLOW_UP_SKIPPED'
    | 'MULTI_AGENT_EVALUATED'
    | 'CODE_EXECUTED'
    | 'VISION_CRITIQUED'
    | 'LIVE_AUDIO_STREAMED';
  durationMs: number;         // Thời gian xử lý của provider
  tokenUsage: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
  estimatedCostUsd: number;   // Chi phí quy đổi theo biểu giá Gemini
  outcome: 'SUCCESS' | 'FAILURE' | 'FALLBACK';
  errorCode?: string;         // Mã lỗi nếu thất bại
}
```

### 3.2 Các Chỉ Số Sức Khỏe Trọng Yếu (SLIs / SLOs)

| Chỉ Số Đo Lường (SLI) | Mục Tiêu Cam Kết (SLO) | Hành Động Khi Vi Phạm |
| :--- | :---: | :--- |
| **Độ trễ sinh câu hỏi phản biện** (`FollowUp Latency`) | 95% số lượt < 3,500ms | Chuyển model fallback sang `gemini-3.5-flash-lite`. |
| **Độ trễ phản hồi âm thanh trực tiếp** (`Live Audio Latency`) | 95% số lượt < 1,200ms | Giảm buffer size của AudioWorklet từ 4096 xuống 2048 mẫu. |
| **Tỷ lệ lỗi AI Provider** (`Provider Error Rate`) | < 1.0% tổng số request | Kích hoạt bộ ngắt mạch Circuit Breaker, tự động retry với backoff. |
| **Tỷ lệ thực thi code thành công** (`Sandbox Availability`) | 99.0% số lần chạy | Tự động chuyển cụm Piston sang máy chủ dự phòng. |

---

## 4. Kịch Bản Ứng Phó Sự Cố Chi Tiết (Drill Runbooks)

### Sự Cố 1: Gemini API Trả Về HTTP 429 Hàng Loạt
- **Hiện tượng**: Log xuất hiện liên tục mã lỗi `AIU_PROVIDER_RATE_LIMITED`. Ứng viên thấy thông báo đang chờ xử lý kéo dài.
- **Quy trình xử lý**:
  1. Kiểm tra dashboard Google AI Studio để xác nhận hạn ngạch Request Per Minute (RPM).
  2. Bật biến `AIU_MULTI_AGENT_EVALUATION_ENABLED=false` để lập tức giảm số lượng request gọi AI đi 4 lần.
  3. Bật model fallback ưu tiên `gemini-3.5-flash-lite` trong file cấu hình.

### Sự Cố 2: Dịch Vụ Piston Sandbox Bị Tấn Công Fork-Bomb / Memory Leak
- **Hiện tượng**: CPU hoặc RAM máy chủ sandbox chạm 100%, request chạy code bị treo quá 5,000ms.
- **Quy trình xử lý**:
  1. Đặt `AIU_SANDBOX_ENABLED=false` trong môi trường sản xuất.
  2. Khởi động lại container Docker của Piston với cờ `--pids-limit 64` và `--memory 256m`.
  3. Chạy lệnh kiểm thử đơn vị `npx vitest run tests/services/code-sandbox/piston-provider.test.ts` để kiểm tra độ hồi phục trước khi bật lại.

### Sự Cố 3: Trình Duyệt Không Mở Được Kết Nối WebSocket Live Audio
- **Hiện tượng**: Client báo lỗi WebSocket connection failed, không thể kích hoạt đàm thoại trực tiếp.
- **Quy trình xử lý**:
  1. Kiểm tra reverse proxy (Nginx / Cloudflare): Đảm bảo cấu hình `proxy_set_header Upgrade $http_upgrade;` và `proxy_set_header Connection "upgrade";`.
  2. Kiểm tra JWT token truyền qua query param có hợp lệ và chưa hết hạn.
  3. Nếu sự cố hạ tầng mạng kéo dài: Bật `AIU_GEMINI_LIVE_ENABLED=false`, client tự động hạ cấp xuống Web Speech API và Cloud TTS mà không gián đoạn kỳ thi.
