# Cẩm Nang Điều Hướng Triển Khai Toàn Diện (AI Interview Upgrade Handbook)

Bộ tài liệu này là **đường ray kỹ thuật hoàn chỉnh (Complete Engineering Rail System)** được chuẩn hóa ở cấp độ doanh nghiệp, bao gồm 13 văn kiện đặc tả kỹ thuật, sẵn sàng để bất kỳ kỹ sư AI nào (đặc biệt là Gemini 3.8 Flash) thực hiện code chính xác 100%, không suy đoán, không sai lệch.

---

## 1. Bản Đồ 13 Tài Liệu Đặc Tả Kỹ Thuật (Master Specification Index)

| Thứ Tự | Tên File Tài Liệu | Mục Đích Kỹ Thuật | Phạm Vi |
| :---: | :--- | :--- | :---: |
| **00** | [`00-master-architecture-and-roadmap.md`](./00-master-architecture-and-roadmap.md) | Kiến trúc tổng thể, ma trận State Machine mở rộng, hợp đồng biến môi trường `.env`, nguyên tắc bất biến tiếng Việt. | Toàn cục |
| **01** | [`01-phase-1-adaptive-follow-up-engine.md`](./01-phase-1-adaptive-follow-up-engine.md) | **Pha 1**: 15 micro-tasks cho phỏng vấn phản biện hội thoại Socratic, model `ConversationTurn`, prompt tiếng Việt, Chat UI. | Nền tảng cốt lõi |
| **02** | [`02-phase-2-multi-agent-evaluation-panel.md`](./02-phase-2-multi-agent-evaluation-panel.md) | **Pha 2**: 10 micro-tasks cho Hội đồng AI 4 tác nhân (Tech Lead, Bar Raiser, HR, Judge), tính phương sai điểm, rubric consensus. | Chấm điểm |
| **03** | [`03-phase-3-live-code-sandbox-and-ast.md`](./03-phase-3-live-code-sandbox-and-ast.md) | **Pha 3**: 10 micro-tasks cho Máy ảo cô lập Piston, chạy test cases thật, AST phân tích Big-O thời gian/không gian, AI bug injection. | Coding Studio |
| **04** | [`04-phase-4-system-design-whiteboard.md`](./04-phase-4-system-design-whiteboard.md) | **Pha 4**: 10 micro-tasks cho Bảng vẽ kiến trúc Canvas Excalidraw, Gemini Multimodal Vision, tìm điểm SPOF, vi phạm CAP. | System Design |
| **05** | [`05-phase-5-gemini-live-multimodal-voice.md`](./05-phase-5-gemini-live-multimodal-voice.md) | **Pha 5**: 10 micro-tasks cho Gemini Live Audio WebRTC song công, giọng Neural2 tiếng Việt, MediaPipe gaze tracking on-device. | Voice & Vision |
| **06** | [`06-error-codes-and-security-boundaries.md`](./06-error-codes-and-security-boundaries.md) | Bảng mã lỗi chuẩn hệ thống (`AIU_*`), ranh giới dữ liệu người dùng, khử PII & bí mật, ma trận giới hạn tần suất. | Bảo mật & Invariants |
| **07** | [`07-delivery-test-plan.md`](./07-delivery-test-plan.md) | Ma trận kiểm thử 4 tầng, 4 cổng chất lượng (Coverage ≥85%), test fixtures & factories, kịch bản chaos & reliability. | Đảm bảo chất lượng |
| **08** | [`08-operational-runbook-and-rollout.md`](./08-operational-runbook-and-rollout.md) | Quy trình vận hành sản xuất, telemetry metrics, SLOs, kịch bản xử lý sự cố khẩn cấp và công tắc Kill-Switch. | Vận hành & SRE |
| **09** | [`09-prompt-engineering-and-few-shot-catalog.md`](./09-prompt-engineering-and-few-shot-catalog.md) | Bộ sưu tập toàn bộ Prompt hệ thống, cấu trúc đầu ra JSON nghiêm ngặt, và ví dụ Few-Shot tiếng Việt cho từng tác nhân. | AI Prompt Catalog |
| **10** | [`10-database-migration-and-indexing-plan.md`](./10-database-migration-and-indexing-plan.md) | Chi tiết lược đồ mới MongoDB, chiến lược đánh unique index, tập lệnh di trú tự động và kế hoạch rollback index. | Cơ sở dữ liệu |
| **11** | [`11-frontend-design-system-and-ui-specs.md`](./11-frontend-design-system-and-ui-specs.md) | Bảng màu token Tailwind, bố cục bong bóng chat, huy hiệu độ khó thích ứng, giao diện console mã nguồn và bảng vẽ. | Giao diện UI/UX |
| **API**| [`openapi-ai-interview-upgrade.yaml`](./openapi-ai-interview-upgrade.yaml) | Hợp đồng giao tiếp API chuẩn OpenAPI 3.1 cho tất cả các endpoint mới của hệ thống nâng cấp. | API Contract |

---

## 2. Kỷ Luật Thực Thi Của Gemini 3.8 Flash (Rules of Engagement)

Mỗi khi nhận lệnh thực hiện bất kỳ micro-task nào:
1. **Đúng tài liệu**: Đọc kỹ phần đặc tả của micro-task đó trong file tương ứng trước khi sửa code.
2. **Quy tắc 1 Seam - 1 File**: Tuyệt đối không sửa quá **1 file test + 1 file source** trong một lượt làm việc.
3. **Ưu tiên tiếng Việt (Vietnamese-First)**:
   - Các câu hỏi phỏng vấn, phản biện, gợi ý, và phản hồi AI luôn viết bằng tiếng Việt tự nhiên (`vi`) làm trường chính, `en` là bản dịch.
   - Luôn sử dụng đúng thuật ngữ IT chuẩn quốc tế và Việt Nam.
4. **Chu trình TDD 4 bước bắt buộc**:
   ```powershell
   # Bước 1: Viết test đỏ trong tests/
   # Bước 2: Chạy terminal xác nhận test FAIL đúng kỳ vọng
   npx vitest run <path-to-test-file>

   # Bước 3: Viết code nguồn tối thiểu để test PASS (exit code 0)
   npx vitest run <path-to-test-file>

   # Bước 4: Kiểm tra tĩnh TypeScript compiler
   npx tsc --noEmit
   npm run build --prefix client
   ```
5. **Không suy đoán (Compiler Grounding)**:
   - Nếu gặp lỗi type, đọc trực tiếp lỗi từ compiler (`tsc`) để sửa.
   - Không tự ý thêm trường ngoài schema đã định nghĩa trong tài liệu.
