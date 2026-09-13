# AIP-65: Question Bank Phase 4 — Production AI Translation, Embeddings & Semantic Duplicate Detection

## 1. Tóm tắt điều hành (Executive Summary)

AIP-65 hoàn thiện 3 trụ cột kỹ thuật mở rộng cho Question Bank an toàn cho môi trường production:
1. **AI-Assisted Bilingual Translation (Song ngữ có kiểm soát)**:
   - Dịch có kiểm soát giữa Tiếng Việt và Tiếng Anh trên các trường: `prompt`, `explanation`, `referenceAnswer`, `learningObjective`, `followUps`, `rubric`.
   - Cơ chế 2 bước bắt buộc: `translation-preview` (read-only, tính toán diff, phát hiện overwrite) và `translation-apply` (chỉ áp dụng cho `DRAFT`, yêu cầu ETag CAS concurrency, idempotency key, và xác nhận `confirmOverwrite` nếu trường đích đã có nội dung).
   - Bảo toàn tuyệt đối `sourceLocale`, chỉ ghi đè `targetLocale` được chỉ định.
2. **Production-Safe Embeddings & Backfill Engine**:
   - Lưu trữ vector biểu diễn ngữ nghĩa trong collection riêng biệt `question_embeddings`.
   - Unique compound index `{ questionVersionId, provider, model, contentHash }` ngăn trùng lặp.
   - Text canonicalization kết hợp taxonomy (`role`, `level`, `technologies`, `topic`, `tags`) cùng nội dung văn bản nhằm tối ưu độ phân giải ngữ nghĩa.
   - Động cơ backfill dạng bounded-batch (`1..50`, mặc định 20), phân trang theo cursor `_id`, graceful resume, tự động bỏ qua các bản ghi đã `READY` có cùng `contentHash`.
3. **Semantic Duplicate Detection & Advisory Engine**:
   - Phát hiện câu hỏi trùng lặp hoặc na ná trước khi xuất bản dựa trên tính toán cosine similarity trên vector kết hợp trùng khớp chính xác fingerprint (`normalizedPromptFingerprint`).
   - Hỗ trợ 2 chế độ: kiểm tra theo câu hỏi hiện có (`target: 'EXISTING'`) hoặc kiểm tra bản nháp đang soạn thảo (`target: 'DRAFT'`).
   - Bộ lọc linh hoạt theo `roleId`, `levelId`, `technologyId`, `difficulty`, `type`.
   - Tính toán taxonomy overlap và ranking tất định với tie-breaking ổn định.
   - Nguyên tắc cố định: **Advisory Non-Blocking** — chỉ đưa ra khuyến cáo/cảnh báo, tuyệt đối không tự động xóa, không tự động xuất bản và không khóa quyền lưu hay xuất bản của tác giả.

---

## 2. Bất biến cách ly và An toàn dữ liệu (Isolation & Security Invariants)

- **Admin Bounded Context Độc lập**: Mọi API Phase 4 nằm dưới `/api/v1/admin/question-bank/*`, yêu cầu authentication và quyền hạn tương ứng (`QUESTION_AI_TRANSLATE`, `QUESTION_EMBEDDING_MANAGE`, `QUESTION_DUPLICATE_READ`).
- **Cách ly tuyệt đối Interview Runtime**: Question Bank hoàn toàn tách rời khỏi Interview Runtime (`InterviewSession`, `InterviewQuestion`, `InterviewService`). Collection runtime có đúng 0 documents được sinh ra bởi các hoạt động của Question Bank.
- **Fail-Closed AI Providers**: Không âm thầm fallback từ Real Gemini provider sang Mock provider khi chạy production hoặc development. Nếu thiếu API key hoặc lỗi provider, hệ thống trả mã lỗi chuẩn hóa (`AI_PROVIDER_ERROR`, `QUESTION_EMBEDDING_PROVIDER_UNAVAILABLE`, `503 Service Unavailable`).
- **Bảo vệ dữ liệu nhạy cảm (Zero Leakage)**:
  - Tuyệt đối không bao giờ trả về raw embedding vectors ra client hoặc API response.
  - Advisory response chỉ bao gồm thông tin công khai: `questionId`, `versionNumber`, `code`, `title` (prompt), `similarityScore`, `matchReason`, `taxonomyOverlap`, `status`.
  - Không để lộ `referenceAnswer`, `rubric`, hay `contentHash` trong DTO phát hiện trùng lặp.
- **Prompt Injection Isolation**: Dữ liệu do người dùng nhập được bao bọc trong ranh giới cô lập `<user_untrusted_content>` khi gửi đến Gemini LLM.

---

## 3. Danh mục API Contract Phase 4

| HTTP Method | Endpoint | Capability | Headers bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/admin/question-bank/questions/:questionId/versions/:versionNumber/translation-preview` | `QUESTION_AI_TRANSLATE` | `Authorization` | Xem trước bản dịch, diff song song, cảnh báo trường sẽ bị ghi đè (Read-only DB) |
| `POST` | `/api/v1/admin/question-bank/questions/:questionId/versions/:versionNumber/translation-apply` | `QUESTION_AI_TRANSLATE` | `Authorization`, `If-Match`, `Idempotency-Key` | Áp dụng bản dịch vào QuestionVersion ở trạng thái DRAFT với bảo vệ CAS ETag |
| `POST` | `/api/v1/admin/question-bank/embeddings/backfill` | `QUESTION_EMBEDDING_MANAGE` | `Authorization` | Chạy tác vụ tính toán embeddings theo lô có giới hạn và cursor |
| `POST` | `/api/v1/admin/question-bank/semantic-duplicates` | `QUESTION_DUPLICATE_READ` | `Authorization` | Phát hiện câu hỏi trùng lặp hoặc tương đồng ngữ nghĩa (Advisory) |

---

## 4. Cấu hình Môi trường (Environment Variables)

| Biến môi trường | Kiểu | Mặc định | Ý nghĩa |
| :--- | :--- | :--- | :--- |
| `QUESTION_BANK_AI_TRANSLATION_ENABLED` | boolean | `false` | Bật/tắt tính năng dịch thuật AI |
| `QUESTION_BANK_SEMANTIC_DUPLICATES_ENABLED` | boolean | `false` | Bật/tắt tính năng phát hiện trùng lặp ngữ nghĩa |
| `QUESTION_BANK_EMBEDDING_BACKFILL_ENABLED` | boolean | `false` | Bật/tắt API backfill embeddings |
| `QUESTION_BANK_AI_PROVIDER` | string | `gemini` | Provider sử dụng (`gemini` hoặc `mock` trong test) |
| `QUESTION_BANK_TRANSLATION_MODEL` | string | `gemini-2.5-flash` | Model AI thực hiện dịch thuật song ngữ |
| `QUESTION_BANK_EMBEDDING_MODEL` | string | `text-embedding-004` | Model tạo vector embedding |
| `QUESTION_BANK_EMBEDDING_DIMENSIONS` | number | `768` | Kích thước vector của model |
| `QUESTION_BANK_AI_TIMEOUT_MS` | number | `10000` | Giới hạn thời gian gọi AI provider |
| `QUESTION_BANK_AI_MAX_RETRIES` | number | `2` | Số lần thử lại tối đa khi gặp lỗi mạng/transient |
| `QUESTION_BANK_SEMANTIC_THRESHOLD` | number | `0.75` | Ngưỡng cosine similarity tối thiểu để tính là trùng lặp |
| `QUESTION_BANK_DUPLICATE_TOP_K` | number | `10` | Số lượng kết quả trùng lặp tối đa trả về |
| `GEMINI_API_KEY` | string | (none) | Khóa API của Google Gemini AI |

---

## 5. Giao diện Người dùng (Frontend UX)

1. **AI-Assisted Bilingual Translation Modal**:
   - Được mở từ `QuestionEditorPage` khi đang chỉnh sửa `DRAFT`.
   - Lựa chọn chiều dịch: Tiếng Việt → English hoặc English → Tiếng Việt.
   - Chọn danh sách trường cần dịch (hỗ trợ chọn từng trường hoặc tất cả).
   - Nút "Xem trước bản dịch (Preview)" kích hoạt API preview không làm thay đổi DB.
   - Bảng diff so sánh song song giữa văn bản gốc và bản đề xuất dịch kèm badge trực quan `[Nội dung mới]` hoặc `[Sẽ ghi đè]`.
   - Cảnh báo bắt buộc tích chọn `"Tôi đồng ý ghi đè nội dung hiện có"` nếu có bất kỳ trường đích nào đã chứa văn bản.
   - Áp dụng thành công tự động cập nhật draft form, cập nhật ETag, thông báo toast và không làm mất các thay đổi chưa lưu khác.
2. **Semantic Duplicate Advisory Panel**:
   - Tích hợp trong cả `QuestionEditorPage` và `QuestionAiAssistantPage`.
   - Nút "Kiểm tra trùng lặp" kiểm tra nội dung hiện tại với toàn bộ câu hỏi đã xuất bản.
   - Hiển thị badge độ tương đồng:
     - Đỏ: `>= 95%` hoặc `EXACT_FINGERPRINT` — Trùng khớp chính xác.
     - Vàng/Cam: `>= 85%` — Tương đồng ngữ nghĩa cao.
     - Xanh: `< 85%` — Tương đồng tiềm năng.
   - Hiển thị tỷ lệ `Taxonomy overlap`, trạng thái câu hỏi, nội dung trích đoạn và liên kết "Xem câu hỏi đối chứng".
   - Luôn mang tính chất khuyến cáo tham khảo, không khóa các nút lưu hay xuất bản.

---

## 6. Kết quả Kiểm thử & Nghiệm thu (Verification Summary)

- **Backend Domain Unit Tests**: `tests/question-bank-phase4.domain.test.ts` (13/13 passed).
  - Cosine similarity, vector dimensions validation, discoverability text canonicalization, tie-breaking ranking.
- **Backend Integration Tests**: `tests/question-bank-phase4.integration.test.ts` (11/11 passed).
  - Preview translation read-only invariant.
  - Would-overwrite warning & confirmation requirement.
  - SourceLocale protection & selective target field update.
  - Draft state validation & ETag revision CAS guard.
  - Backfill cursor iteration & skip ready cache.
  - Exact fingerprint priority & retired exclusion.
  - Collection isolation zero-document check.
- **OpenAPI Contract Tests**: `npm run test:contract` (5/5 passed).
  - OpenAPI 3.1.0 spec version `0.4.0` chứa đủ 25 implemented operations (Phase 1: 8, Phase 2: 7, Phase 3: 6, Phase 4: 4), 0 planned.
- **Full Backend Suite**: `npm test` (17/17 test files, 249/249 tests passed).
- **Client Linting**: `npm --prefix client run lint` (0 errors, 0 warnings).
- **Client Build**: `npm --prefix client run build` (Clean build, exit code 0).
- **Client Question Bank Tests**: `npm --prefix client test -- src/features/QuestionBank` (10/10 files, 41/41 tests passed).
- **Benchmark Smoke Test**: `npm run benchmark:question-bank:smoke` (1000 questions, 3000 versions, elapsedMs: 52, exit code 0).
