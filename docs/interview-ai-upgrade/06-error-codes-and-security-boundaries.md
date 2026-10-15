# AIP-AIU-06 — Error Codes, Security Boundaries & Anti-Leak Specifications

## 1. Mục Tiêu & Phạm Vi (Scope)

Tài liệu này chuẩn hóa toàn bộ **Danh mục Mã Lỗi (Error Code Catalog)**, **Ranh Giới Bảo Mật Đầu Vào/Đầu Ra (Security Boundaries)**, và **Cơ Chế Chống Rò Rỉ Dữ Liệu (Anti-Leak Invariants)** cho tất cả 5 pha nâng cấp AI của hệ thống phỏng vấn.

Mọi mã lỗi và quy tắc bảo vệ ở đây là bất biến (invariants), không được phép tự ý thay đổi khi Gemini 3.8 Flash sinh code.

---

## 2. Bảng Danh Mục Mã Lỗi Toàn Hệ Thống (Standard Error Codes)

Tất cả lỗi từ hệ thống phải kế thừa từ `AppError(message, statusCode, errorCode)`:

| Mã Lỗi (`code`) | HTTP Status | Mô Tả & Tình Huống Kích Hoạt | Pha Áp Dụng |
| :--- | :---: | :--- | :---: |
| `AIU_STATE_CONFLICT` | 409 | Chuyển đổi trạng thái bất hợp lệ trong State Machine (ví dụ: gọi follow-up khi session đã `COMPLETED`). | Pha 1 |
| `AIU_QUESTION_NOT_FOUND` | 404 | `questionId` cung cấp không tồn tại trong phiên phỏng vấn hiện tại. | Pha 1 |
| `AIU_MAX_FOLLOW_UPS_EXCEEDED` | 400 | Câu hỏi đã đạt giới hạn 3 lượt phản biện (`AIU_MAX_FOLLOW_UPS_PER_QUESTION`). | Pha 1 |
| `AIU_INPUT_TOO_LONG` | 400 | Độ dài câu trả lời của ứng viên vượt quá 5,000 ký tự cho phép. | Pha 1 |
| `AIU_INPUT_INVALID` | 400 | Payload đầu vào không vượt qua kiểm tra Zod schema. | Toàn cục |
| `AIU_PROMPT_INJECTION_DETECTED` | 400 | Phát hiện chuỗi cố ý phá vỡ prompt ranh giới (ví dụ: `Ignore previous instructions`, `System:`, delimiters giả mạo). | Pha 1-5 |
| `AIU_PROVIDER_RATE_LIMITED` | 429 | Gemini API trả về mã lỗi 429 quá tải; hệ thống đang trong chu kỳ exponential backoff. | Toàn cục |
| `AIU_PROVIDER_TIMEOUT` | 504 | Cuộc gọi AI provider vượt quá deadline timeout (15,000ms cho follow-up, 30,000ms cho evaluation). | Toàn cục |
| `AIU_PROVIDER_INVALID_OUTPUT` | 502 | LLM trả về chuỗi JSON không khớp với Zod schema yêu cầu hoặc thiếu các trường tiếng Việt bắt buộc. | Toàn cục |
| `AIU_EVAL_VARIANCE_EXCEEDED` | 422 | Độ lệch điểm giữa các Agent vượt quá 3.0 nhưng Judge Agent không thể giải quyết được xung đột. | Pha 2 |
| `AIU_SANDBOX_TIMEOUT` | 408 | Mã của ứng viên chạy vượt quá thời gian cho phép (5,000ms). | Pha 3 |
| `AIU_SANDBOX_MEMORY_EXCEEDED` | 400 | Mã của ứng viên tiêu thụ vượt quá 128MB RAM giới hạn. | Pha 3 |
| `AIU_SANDBOX_UNSUPPORTED_LANG` | 400 | Ngôn ngữ lập trình gửi lên không nằm trong danh sách 5 ngôn ngữ hỗ trợ. | Pha 3 |
| `AIU_SANDBOX_RATE_LIMITED` | 429 | Ứng viên vượt quá giới hạn tần suất chạy code (tối đa 10 req / phút). | Pha 3 |
| `AIU_SANDBOX_UNAVAILABLE` | 503 | Dịch vụ sandbox (Piston/Docker) tạm thời không thể kết nối. | Pha 3 |
| `AIU_WHITEBOARD_IMAGE_TOO_LARGE` | 413 | Ảnh sơ đồ kiến trúc canvas gửi lên vượt quá dung lượng tối đa 3MB. | Pha 4 |
| `AIU_WHITEBOARD_INVALID_MIME` | 415 | Định dạng ảnh canvas không phải PNG, JPEG, hoặc WebP. | Pha 4 |
| `AIU_VISION_PARSING_FAILED` | 502 | Gemini Vision không thể đọc được các khối nút kiến trúc từ ảnh sơ đồ mờ hoặc lỗi render. | Pha 4 |
| `AIU_LIVE_WEBSOCKET_UNAUTHORIZED`| 4001 (WS) | Kết nối WebSocket Live Audio không cung cấp JWT token hợp lệ hoặc token đã hết hạn. | Pha 5 |
| `AIU_LIVE_WEBSOCKET_RATE_LIMITED` | 4008 (WS) | Gửi audio chunks vượt quá tần số 50 packets/giây. | Pha 5 |
| `AIU_LIVE_AUDIO_UNSUPPORTED_FMT` | 4003 (WS) | Định dạng âm thanh PCM không đúng cấu hình 16kHz mono 16-bit. | Pha 5 |

---

## 3. Ranh Giới Bảo Mật Đầu Vào (Input Boundary & Sanitization)

### 3.1 Quy Chuẩn Delimiter Kỹ Thuật
Mọi dữ liệu đầu vào từ người dùng (`candidateAnswer`, `whiteboardNotes`, `transcript`) trước khi đưa vào LLM bắt buộc phải được bọc trong thẻ ranh giới bất biến:

```typescript
export function delimitUntrusted(data: unknown): string {
  const encoded = JSON.stringify(data)
    .replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (encoded.length > 80000) {
    throw new AppError('Input exceeds maximum allowed size', 400, 'AIU_INPUT_TOO_LONG');
  }
  return `<UNTRUSTED_USER_CONTENT length="${encoded.length}">\n${encoded}\n</UNTRUSTED_USER_CONTENT>`;
}
```

### 3.2 Khử Nhiễm PII & Bí Mật (PII & Secret Redaction Regex)
Bất kỳ thông tin cá nhân hoặc secret key nào vô tình có trong câu trả lời phải được che (`[REDACTED]`) trước khi gửi sang AI provider:

```typescript
export const PII_SECRET_REGEX = new RegExp([
  '[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}',                         // Email
  '(?:\\+?\\d[\\s().-]?){9,}',                                      // Phone number
  'https?:\\/\\/\\S+|www\\.\\S+',                                    // URLs (ngăn SSRF injection)
  '\\b(?:bearer|basic)\\s+(?:[A-Za-z0-9+/=]{16,}|eyJ[\\w-]+\\.[\\w-]+)', // Auth tokens
  '\\b(?:password|secret|token|api[_ -]?key|otp)\\s*[:=]\\s*\\S+',   // Secret declarations
  'AIza[\\w-]{20,}',                                                // Google API Keys
  'ghp_[\\w]{36}',                                                  // GitHub Personal Tokens
].join('|'), 'gi');
```

---

## 4. Chống Rò Rỉ Dữ Liệu Ứng Viên (Anti-Leak Invariants)

Khi trả kết quả về cho ứng viên qua REST API hoặc SSE stream:
1. **Tuyệt đối loại bỏ**:
   - `promptVersions`: ID, version, và nội dung prompt nội bộ.
   - `metadata.promptTokens`, `candidatesTokens`: Token metrics nội bộ (chỉ lưu DB để admin theo dõi chi phí).
   - `geminiRawResponse`: Không trả về text thô hoặc cấu trúc JSON nội bộ của Google.
   - `activeOperationId`, `leaseToken`: Thông tin quản lý concurrency.
2. **Quy tắc DTO An Toàn**:
   - Mọi endpoint trả session phải đi qua `toCandidateSafeInterviewSession(session)`.
   - Mọi endpoint trả câu hỏi phải đi qua `toCandidateSafeInterviewQuestion(question)`.
   - Endpoint `POST /follow-up` chỉ trả về `{ shouldFollowUp, followUpQuestion, gapAnalysis, turnIndex, maxTurns }`.

---

## 5. Bảng Giới Hạn Tần Suất (Rate Limiting Matrix)

| Endpoint | Giới Hạn Tối Đa | Cơ Chế Lưu Vết | Hành Động Khi Vượt Ngưỡng |
| :--- | :--- | :--- | :--- |
| `POST /interviews/:id/follow-up` | 10 req / phút | Redis / Mongo `api_rate_limits` | HTTP 429 `AIU_PROVIDER_RATE_LIMITED` |
| `POST /interviews/:id/execute-code` | 10 req / phút | In-memory token bucket per user | HTTP 429 `AIU_SANDBOX_RATE_LIMITED` |
| `POST /interviews/:id/whiteboard` | 5 req / phút | In-memory sliding window | HTTP 429 `AIU_PROVIDER_RATE_LIMITED` |
| `WS /interviews/:id/live-audio` | 50 audio packets / giây | WebSocket connection monitor | Đóng kết nối với code 4008 (`AIU_LIVE_WEBSOCKET_RATE_LIMITED`) |
