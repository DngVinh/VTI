# AIP-64: Question Bank Phase 3 — Advanced Operations & Delivery Contract

## 1. Executive Summary

AIP-64 hoàn thiện 6 thao tác nâng cao của Question Bank trước đây được đánh dấu là `planned` trong OpenAPI spec:
1. **Deterministic Selection Simulation**: Thuật toán tuyển chọn câu hỏi ngẫu nhiên tất định sử dụng Mulberry32 PRNG, đánh giá độ sẵn sàng và chẩn đoán pool câu hỏi mà không giả mạo dữ liệu.
2. **Taxonomy Coverage Metrics & Gaps**: Báo cáo độ phủ theo Role, Level, Technology, độ khó, loại câu hỏi và ngôn ngữ; tự động phát hiện các khoảng trống nội dung (`ZERO_COVERAGE`, `LOW_COVERAGE`).
3. **Governance Analytics & Activity Timeline**: Thống kê phân bố vòng đời, trạng thái phiên bản, nguồn gốc và lịch sử hoạt động theo ngày (gửi duyệt, duyệt đạt, yêu cầu sửa, publish).
4. **Batch Import with Dry-Run**: Nhập câu hỏi hàng loạt (JSON/CSV) với chế độ kiểm thử (dry-run) báo lỗi từng dòng, đảm bảo tính toàn vẹn qua MongoDB transaction, luôn tạo `DRAFT` với nguồn gốc `IMPORTED`.
5. **Formula-Safe Export**: Xuất dữ liệu (JSON/CSV) an toàn theo chuẩn RFC 4180 kèm cơ chế chống CSV Formula Injection (prefix `'` cho các ô bắt đầu bằng `=`, `+`, `-`, `@`, `\t`, `\r`).
6. **AI-Assisted Draft Generation**: Trợ lý AI phác thảo nhanh đề bài, đáp án chuẩn, mục tiêu học tập và rubric chấm điểm; trừu tượng hóa qua interface `IAiQuestionDraftProvider` kèm Mock Provider hỗ trợ kịch bản kiểm thử (Rate Limit, Timeout, Schema Error, Server Error).

---

## 2. Isolation Invariant Guarantee (Bất biến Cách ly Tuyệt đối)

- **Admin Bounded Context Độc lập**: Toàn bộ thao tác Phase 3 được đặt dưới đường dẫn `/api/v1/admin/question-bank/*` và middleware bảo vệ capability Admin.
- **Không xâm lấn Interview Runtime**: Question Bank tuyệt đối không can thiệp, không đọc/ghi, không inject và không thay đổi luồng runtime phỏng vấn hiện hữu (`InterviewSession`, `InterviewQuestion`, `InterviewService`, luồng tạo 5 câu hỏi phỏng vấn của ứng viên).
- **Kiểm thử hồi quy khóa cứng**: Suite kiểm thử tích hợp `tests/question-bank-phase3.integration.test.ts` xác nhận số lượng tài liệu trong các collection `InterviewSession` và `InterviewQuestion` là `0` trước và sau khi thực thi các thao tác Phase 3.

---

## 3. Security & Governance Invariants

### 3.1 Chống CSV Formula Injection
Khi xuất tệp CSV, mọi giá trị chuỗi bắt đầu bằng các ký tự điều khiển công thức (`=`, `+`, `-`, `@`, `\t`, `\r`) đều tự động được gắn tiền tố dấu nháy đơn (`'`) và bao bọc trong dấu ngoặc kép. Khi mở trong bảng tính (Excel, Google Sheets, LibreOffice), phần mềm sẽ đối xử các ô này như văn bản thuần túy, loại bỏ nguy cơ Remote Code Execution hoặc exfiltration dữ liệu.

### 3.2 Quy tắc Nhập liệu (Import Invariants)
- Mọi câu hỏi nhập vào từ bên ngoài luôn được gán trạng thái `DRAFT` và `origin = 'IMPORTED'`.
- Tuyệt đối không cho phép tự động publish hoặc bypass quy trình review 4-eyes qua ngõ import.
- Hỗ trợ cờ `dryRun = true` để kiểm tra tính hợp lệ của toàn bộ bản ghi mà không ghi vào cơ sở dữ liệu.
- Khi `dryRun = false`, toàn bộ quá trình tạo câu hỏi và phiên bản được thực thi trong một MongoDB multi-document transaction (ACID rollback nếu có lỗi).

### 3.3 Quy tắc Trợ lý AI (AI Generation Invariants)
- Mọi nội dung do AI tạo ra chỉ dừng lại ở bước phác thảo (preview) hoặc lưu thành `DRAFT` với `origin = 'AI_ASSISTED'`.
- Không bao giờ tự động phê duyệt hoặc xuất bản câu hỏi từ AI.
- Hệ thống hỗ trợ interface `IAiQuestionDraftProvider` cho phép cắm mock provider phục vụ kiểm thử đơn vị và tích hợp độc lập không phụ thuộc mạng ngoài.

### 3.4 Tuyển chọn Tất định (Selection Invariants)
- Chỉ tuyển chọn các câu hỏi có trạng thái lifecycle là `ACTIVE` và có phiên bản `PUBLISHED`.
- Sử dụng thuật toán xáo trộn Fisher-Yates kết hợp bộ sinh số ngẫu nhiên giả tất định Mulberry32 (PRNG) với seed có thể kiểm chứng.
- Nếu pool câu hỏi không đủ số lượng yêu cầu, hệ thống trả về kết quả thực tế khả dụng kèm cờ `isPoolSufficient = false` và `insufficientReason` rõ ràng; tuyệt đối không tự bịa đặt hoặc tái sử dụng câu hỏi không hợp lệ.

---

## 4. API Specification & Capabilities

| HTTP Method | Endpoint | Capability | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/admin/question-bank/selection` | `QUESTION_SELECT` | Mô phỏng tuyển chọn câu hỏi tất định kèm chẩn đoán pool |
| `GET` | `/api/v1/admin/question-bank/coverage` | `QUESTION_ANALYTICS` | Lấy số liệu độ phủ Taxonomy và danh sách khoảng trống nội dung |
| `GET` | `/api/v1/admin/question-bank/analytics` | `QUESTION_ANALYTICS` | Thống kê phân bố vòng đời, trạng thái, độ khó và timeline hoạt động |
| `POST` | `/api/v1/admin/question-bank/imports` | `QUESTION_IMPORT_EXPORT` | Nhập dữ liệu hàng loạt (hỗ trợ dryRun, idempotency) |
| `POST` | `/api/v1/admin/question-bank/exports` | `QUESTION_IMPORT_EXPORT` | Xuất dữ liệu JSON/CSV chống Formula Injection |
| `POST` | `/api/v1/admin/question-bank/ai-generations` | `QUESTION_AI_GENERATE` | Phác thảo câu hỏi bằng AI (hỗ trợ persistDraft, idempotency) |

Mọi endpoint đều yêu cầu:
- Header `Authorization: Bearer <token>` với user có role `ADMIN`.
- Cờ môi trường `QUESTION_BANK_ADMIN_API_ENABLED=true`.
- Phản hồi chứa các headers bảo mật bắt buộc: `X-Request-Id`, `Cache-Control: no-store`.

---

## 5. Frontend Admin Interface

Các giao diện Phase 3 được triển khai dưới dạng các trang chuyên biệt, tích hợp thanh điều hướng tab đồng bộ (`QuestionBankNav`):
1. **`QuestionSelectionPage`** (`/admin/question-bank/selection`): Giao diện mô phỏng tuyển chọn, cho phép thiết lập số lượng, seed, bộ lọc độ khó/loại câu hỏi và hiển thị chi tiết chẩn đoán độ sẵn sàng của pool.
2. **`QuestionAnalyticsPage`** (`/admin/question-bank/analytics`): Bảng điều khiển trực quan hiển thị số liệu độ phủ theo Role/Level/Technology, các thẻ cảnh báo khoảng trống (`ZERO_COVERAGE`, `LOW_COVERAGE`) và biểu đồ phân bố, bảng lịch sử hoạt động.
3. **`QuestionImportExportPage`** (`/admin/question-bank/import-export`): Giao diện 2 tab cho phép nhập dữ liệu JSON/CSV có kiểm thử dry-run báo lỗi chi tiết theo dòng và xuất dữ liệu có bảo vệ công thức bảng tính.
4. **`QuestionAiAssistantPage`** (`/admin/question-bank/ai-assistant`): Giao diện cấu hình yêu cầu biên soạn cho trợ lý AI, hiển thị preview cấu trúc câu hỏi và hỗ trợ lưu trực tiếp thành Draft có liên kết mở trình soạn thảo.

---

## 6. Verification Suite & Results

- **Contract Tests**: `npm run test:contract` kiểm tra tài liệu `docs/question-bank/openapi-question-bank.yaml` phiên bản `0.3.0` với đủ 21 operations implemented (`8` Phase 1, `7` Phase 2, `6` Phase 3), 0 planned operations.
- **Domain Tests**: `tests/question-bank-phase3.domain.test.ts` kiểm thử thuật toán PRNG Mulberry32, làm sạch CSV chống injection và các kịch bản Mock AI provider.
- **Integration Tests**: `tests/question-bank-phase3.integration.test.ts` (14/14 tests GREEN) xác nhận tính toàn vẹn của cả 6 operations Phase 3, cách ly Interview collections, bảo vệ quyền hạn và xử lý lỗi chuẩn hóa.
- **Frontend Tests**: `npm test -- src/features/QuestionBank` (37/37 tests GREEN trong 9 test files) bao gồm `QuestionPhase3Pages.test.tsx`.
- **Linter & Type Check**:
  - `npm --prefix client run lint` (0 errors, 0 warnings).
  - `npm --prefix client run build` (exit code 0).
  - `npm test` backend (225/225 tests GREEN trong 15 test files).
