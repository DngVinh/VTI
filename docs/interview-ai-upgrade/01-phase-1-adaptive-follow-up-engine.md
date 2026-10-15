# AIP-AIU-01 — Phase 1: Adaptive Follow-up Engine & Conversational State Machine

## 1. Executive Summary & Acceptance Criteria

Pha 1 chuyển đổi cơ chế phỏng vấn từ mô hình tĩnh (sinh 5 câu batch, trả lời một mạch, chấm một lần) sang mô hình **hội thoại tương tác nhiều lượt (Turn-by-Turn Conversational Interview)**. AI đóng vai trò người phỏng vấn Socratic: sau mỗi câu trả lời của ứng viên, AI lập tức phân tích lỗ hổng kiến thức (knowledge gaps), phản biện sâu từ 1 đến 3 lượt câu hỏi phụ (`follow-up`), rồi mới chuyển sang câu hỏi tiếp theo.

### Acceptance Criteria (AC):
1. **AC-01 (State Machine Extension)**: Bổ sung trạng thái `FOLLOW_UP` vào State Pattern. Các chuyển đổi trạng thái:
   - `IN_PROGRESS -> FOLLOW_UP` (hợp lệ).
   - `FOLLOW_UP -> IN_PROGRESS` (khi kết thúc lượt follow-up).
   - `FOLLOW_UP -> EVALUATING` (khi ứng viên nộp bài sớm — `InterviewService.submitAnswers` cho phép cả `IN_PROGRESS` và `FOLLOW_UP`).
   - `PENDING / GENERATING / COMPLETED -> FOLLOW_UP` (bị chặn với `InvalidStateTransitionException` 409 `AIU_STATE_CONFLICT`).
2. **AC-02 (Conversation Turn Persistence)**: Lưu trữ đầy đủ lịch sử hội thoại vào collection `conversationturns` với quan hệ `{ sessionId, questionId, turnIndex }` unique compound index và hỗ trợ truy vấn an toàn theo quyền sở hữu người dùng (tenant-scoped).
3. **AC-03 (Vietnamese-First Socratic Prompt)**: Prompt phân tích gap và sinh follow-up tạo song ngữ nhưng ưu tiên tiếng Việt (`vi` là trường chính, ngôn ngữ đàm thoại tự nhiên, chuẩn văn phong phỏng vấn kỹ thuật Việt Nam).
4. **AC-04 (Follow-up Bounded Limit)**: Giới hạn tối đa 3 câu hỏi phụ cho mỗi câu hỏi chính (`AIU_MAX_FOLLOW_UPS_PER_QUESTION = 3`). Khi chạm ngưỡng hoặc ứng viên trả lời trọn vẹn, AI tự động đánh dấu `shouldFollowUp = false`.
5. **AC-05 (Idempotency & Concurrency)**: Endpoint `POST /api/v1/interviews/:id/follow-up` được bảo vệ bởi ownership middleware, rate limiter, và optimistic concurrency version check.
6. **AC-06 (Frontend Studio Integration)**: Giao diện `InterviewRoom` bổ sung component `ConversationThread` dạng bong bóng chat, `AdaptiveDifficultyBadge`, và nút "Tiếp tục phản biện" / "Bỏ qua phản biện".

---

## 2. Danh Sách Micro-Tasks Tuyệt Đối (Chuẩn 1 Seam - 1 File)

Để đảm bảo Gemini 3.8 Flash không mắc lỗi Shotgun Surgery, mỗi task dưới đây được giới hạn chính xác **1 file test + 1 file source**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Micro-Task 1.0: Cấu hình biến môi trường AIU_* trong src/config/env.ts │
│ Micro-Task 1.1: Mở rộng Domain Types trong src/domain/interview/types.ts│
│ Micro-Task 1.2a: Tạo State Class src/domain/interview/states/FollowUp.ts│
│ Micro-Task 1.2b: Nối State Machine src/domain/interview/InterviewCtx.ts│
│ Micro-Task 1.3: Cập nhật Mongoose Schema src/models/InterviewSession.ts│
│ Micro-Task 1.4: Tạo Schema & Model src/models/ConversationTurn.ts       │
│ Micro-Task 1.5a: Tạo Interface src/repositories/IConversationTurnRepo.ts│
│ Micro-Task 1.5b: Triển khai src/repositories/ConversationTurnRepo.ts   │
│ Micro-Task 1.5c: Đăng ký DI trong src/config/di.ts                     │
│ Micro-Task 1.6: Xây dựng Prompt & Validator services/ai/follow-up.ts   │
│ Micro-Task 1.7a: Triển khai MockAiProvider.generateFollowUp            │
│ Micro-Task 1.7b: Triển khai GeminiAiProvider.generateFollowUp          │
│ Micro-Task 1.8: Triển khai nghiệp vụ InterviewService.processFollowUp  │
│ Micro-Task 1.9a: Schema kiểm thực src/validators/interview.validator.ts│
│ Micro-Task 1.9b: Bộ điều khiển src/controllers/InterviewController.ts │
│ Micro-Task 1.9c: Định tuyến HTTP trong src/routes/interview.route.ts   │
│ Micro-Task 1.10a: Định nghĩa kiểu dữ liệu client/features/.../types.ts │
│ Micro-Task 1.10b: Bổ sung API client trong client/services/.../api.ts  │
│ Micro-Task 1.11: Hook React useFollowUp.ts                             │
│ Micro-Task 1.12: Component giao diện ConversationThread.tsx            │
│ Micro-Task 1.13: Component giao diện AdaptiveDifficultyBadge.tsx       │
│ Micro-Task 1.14: Tích hợp tổng thể màn hình InterviewRoom.tsx          │
│ Micro-Task 1.15: Kịch bản kiểm thử tích hợp toàn diện End-to-End       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Chi Tiết Từng Micro-Task

---

### Micro-Task 1.0: Cấu hình biến môi trường AIU_* trong `src/config/env.ts`

- **Mục tiêu**: Thêm các biến môi trường kiểm soát tính năng phỏng vấn tương tác vào Zod schema validation của `src/config/env.ts`.
- **File test**: `tests/config/aiu-env.unit.test.ts`
- **File source**: `src/config/env.ts`
- **Các biến cần validate**:
  - `AIU_FOLLOW_UP_ENABLED`: `z.enum(['true', 'false']).default('true').transform(v => v === 'true')`
  - `AIU_MAX_FOLLOW_UPS_PER_QUESTION`: `z.coerce.number().int().min(1).max(5).default(3)`
  - `AIU_FOLLOW_UP_TIMEOUT_MS`: `z.coerce.number().int().min(5000).max(60000).default(15000)`
- **Lệnh kiểm tra**: `npx vitest run tests/config/aiu-env.unit.test.ts`

---

### Micro-Task 1.1: Mở rộng Domain Types trong `src/domain/interview/types.ts`

- **Mục tiêu**: Bổ sung `'FOLLOW_UP'` vào union type `InterviewStatus`, thêm `FollowUpPayload`, và khai báo hàm `generateFollowUp()` trên `IAiProvider`.
- **File test**: `tests/domain/interview-follow-up-types.unit.test.ts`
- **File source**: `src/domain/interview/types.ts`
- **Mã nguồn bổ sung**:
  ```typescript
  export type InterviewStatus = 
    | 'PENDING'
    | 'GENERATING'
    | 'IN_PROGRESS'
    | 'FOLLOW_UP'
    | 'EVALUATING'
    | 'COMPLETED'
    | 'FAILED';

  export interface FollowUpPayload {
    questionId: string;
    candidateAnswer: string;
    aiProvider?: IAiProvider;
  }
  ```
- **Lệnh kiểm tra**: `npx vitest run tests/domain/interview-follow-up-types.unit.test.ts`

---

### Micro-Task 1.2a: Tạo State Class `src/domain/interview/states/FollowUpState.ts`

- **Mục tiêu**: Tạo class `FollowUpState` kế thừa `IInterviewState`.
- **File test**: `tests/domain/FollowUpState.unit.test.ts`
- **File source**: `src/domain/interview/states/FollowUpState.ts` (MỚI)
- **Đặc tả logic**:
  - `getName()`: Trả về `'FOLLOW_UP'`.
  - `generate()`: Ném lỗi `InvalidStateTransitionException('Cannot generate while in FOLLOW_UP state')`.
  - `submit()`: Gọi `ctx.changeState('EVALUATING')` (cho phép ứng viên nộp bài sớm).
  - `saveProgress()`: Gọi repo lưu tiến độ trả lời mà không đổi trạng thái.
- **Lệnh kiểm tra**: `npx vitest run tests/domain/FollowUpState.unit.test.ts`

---

### Micro-Task 1.2b: Nối State Machine `src/domain/interview/InterviewContext.ts`

- **Mục tiêu**: Cập nhật ma trận `legalTransitions` và phương thức factory `createStateFromStatus` trong `InterviewContext`.
- **File test**: `tests/domain/InterviewContext-follow-up.unit.test.ts`
- **File source**: `src/domain/interview/InterviewContext.ts`
- **Ma trận chuyển đổi cập nhật**:
  ```typescript
  const legalTransitions: Record<InterviewStatus, InterviewStatus[]> = {
    PENDING: ['GENERATING'],
    GENERATING: ['IN_PROGRESS', 'FAILED'],
    IN_PROGRESS: ['FOLLOW_UP', 'EVALUATING', 'FAILED'],
    FOLLOW_UP: ['IN_PROGRESS', 'EVALUATING', 'FAILED'],
    EVALUATING: ['COMPLETED', 'FAILED'],
    COMPLETED: [],
    FAILED: ['GENERATING', 'EVALUATING', 'IN_PROGRESS'],
  };
  ```
- **Lệnh kiểm tra**: `npx vitest run tests/domain/InterviewContext-follow-up.unit.test.ts`

---

### Micro-Task 1.3: Cập nhật Mongoose Schema `src/models/InterviewSession.ts`

- **Mục tiêu**: Bổ sung `'FOLLOW_UP'` vào enum trường `status` của schema `InterviewSession`.
- **File test**: `tests/models/interview-session-status.unit.test.ts`
- **File source**: `src/models/InterviewSession.ts`
- **Lệnh kiểm tra**: `npx vitest run tests/models/interview-session-status.unit.test.ts`

---

### Micro-Task 1.4: Tạo Schema & Model `src/models/ConversationTurn.ts`

- **Mục tiêu**: Định nghĩa schema Mongoose cho `conversationturns` kèm compound unique index `{ sessionId: 1, questionId: 1, turnIndex: 1 }`.
- **File test**: `tests/models/conversation-turn.model.test.ts`
- **File source**: `src/models/ConversationTurn.ts` (MỚI)
- **Lệnh kiểm tra**: `npx vitest run tests/models/conversation-turn.model.test.ts`

---

### Micro-Task 1.5a: Tạo Interface `src/repositories/IConversationTurnRepository.ts`

- **Mục tiêu**: Định nghĩa hợp đồng repository cho `ConversationTurn` với bảo đảm an toàn đa người dùng (`forOwner`).
- **File test**: `tests/repositories/conversation-turn-interface.unit.test.ts`
- **File source**: `src/repositories/IConversationTurnRepository.ts` (MỚI)
- **Phương thức**:
  ```typescript
  export interface IConversationTurnRepository {
    forOwner(userId: string): IConversationTurnRepository;
    createTurn(data: Partial<IConversationTurnDocument>): Promise<IConversationTurnDocument>;
    findByQuestion(sessionId: string, questionId: string): Promise<IConversationTurnDocument[]>;
    findBySession(sessionId: string): Promise<IConversationTurnDocument[]>;
    countTurns(sessionId: string, questionId: string): Promise<number>;
    getLatestTurn(sessionId: string, questionId: string): Promise<IConversationTurnDocument | null>;
  }
  ```
- **Lệnh kiểm tra**: `npx vitest run tests/repositories/conversation-turn-interface.unit.test.ts`

---

### Micro-Task 1.5b: Triển khai `src/repositories/ConversationTurnRepository.ts`

- **Mục tiêu**: Cài đặt lớp truy cập dữ liệu MongoDB cho `ConversationTurn`.
- **File test**: `tests/repositories/conversation-turn.repository.test.ts`
- **File source**: `src/repositories/ConversationTurnRepository.ts` (MỚI)
- **Lệnh kiểm tra**: `npx vitest run tests/repositories/conversation-turn.repository.test.ts`

---

### Micro-Task 1.5c: Đăng ký DI trong `src/config/di.ts`

- **Mục tiêu**: Đăng ký singleton `IConversationTurnRepository` vào tsyringe container.
- **File test**: `tests/config/di-conversation-turn.test.ts`
- **File source**: `src/config/di.ts`
- **Lệnh kiểm tra**: `npx vitest run tests/config/di-conversation-turn.test.ts`

---

### Micro-Task 1.6: Xây dựng Prompt & Validator `src/services/ai/follow-up-engine.ts`

- **Mục tiêu**: Module xây dựng prompt phản biện tiếng Việt và Zod validator cho output của AI.
- **File test**: `tests/services/ai/follow-up-engine.unit.test.ts`
- **File source**: `src/services/ai/follow-up-engine.ts` (MỚI)
- **Lệnh kiểm tra**: `npx vitest run tests/services/ai/follow-up-engine.unit.test.ts`

---

### Micro-Task 1.7a: Triển khai `MockAiProvider.generateFollowUp`

- **Mục tiêu**: Thêm hàm giả lập phản biện trong `MockAiProvider` phục vụ test suite tự động.
- **File test**: `tests/services/ai/mock-ai-follow-up.test.ts`
- **File source**: `src/services/ai/providers/MockAiProvider.ts`
- **Lệnh kiểm tra**: `npx vitest run tests/services/ai/mock-ai-follow-up.test.ts`

---

### Micro-Task 1.7b: Triển khai `GeminiAiProvider.generateFollowUp`

- **Mục tiêu**: Tích hợp gọi Google Generative AI API sinh câu hỏi phản biện với JSON schema và exponential backoff.
- **File test**: `tests/services/ai/gemini-ai-follow-up.test.ts`
- **File source**: `src/services/ai/providers/GeminiAiProvider.ts`
- **Lệnh kiểm tra**: `npx vitest run tests/services/ai/gemini-ai-follow-up.test.ts`

---

### Micro-Task 1.8: Triển khai nghiệp vụ `InterviewService.processFollowUp`

- **Mục tiêu**: Xử lý luồng phản biện: kiểm tra trạng thái, đếm turn (tối đa 3), lưu lượt trả lời, gọi AI, cập nhật State Machine, đồng thời cho phép nộp bài sớm khi ở trạng thái `FOLLOW_UP`.
- **File test**: `tests/services/interview-service-follow-up.integration.test.ts`
- **File source**: `src/services/InterviewService.ts`
- **Lệnh kiểm tra**: `npx vitest run tests/services/interview-service-follow-up.integration.test.ts`

---

### Micro-Task 1.9a: Schema kiểm thực `src/validators/interview.validator.ts`

- **Mục tiêu**: Bổ sung `followUpSchema` kiểm tra tính hợp lệ của `questionId` (ObjectId) và `candidateAnswer` (1-5000 ký tự).
- **File test**: `tests/validators/follow-up-validator.unit.test.ts`
- **File source**: `src/validators/interview.validator.ts`
- **Lệnh kiểm tra**: `npx vitest run tests/validators/follow-up-validator.unit.test.ts`

---

### Micro-Task 1.9b: Bộ điều khiển `src/controllers/InterviewController.ts`

- **Mục tiêu**: Bổ sung phương thức `requestFollowUp` và `getConversationHistory` trong `InterviewController`.
- **File test**: `tests/controllers/interview-controller-follow-up.unit.test.ts`
- **File source**: `src/controllers/InterviewController.ts`
- **Lệnh kiểm tra**: `npx vitest run tests/controllers/interview-controller-follow-up.unit.test.ts`

---

### Micro-Task 1.9c: Định tuyến HTTP trong `src/routes/interview.route.ts`

- **Mục tiêu**: Mở endpoint `POST /:id/follow-up` và `GET /:id/conversation` kèm middleware `authenticate`, `requireInterviewOwner`, và `rateLimit`.
- **File test**: `tests/controllers/interview-follow-up-api.integration.test.ts`
- **File source**: `src/routes/interview.route.ts`
- **Lệnh kiểm tra**: `npx vitest run tests/controllers/interview-follow-up-api.integration.test.ts`

---

### Micro-Task 1.10a: Định nghĩa kiểu dữ liệu `client/src/features/InterviewRoom/types.ts`

- **Mục tiêu**: Thêm các interface `ConversationTurn`, `FollowUpResponseData` tại frontend.
- **File test**: `client/src/features/InterviewRoom/__tests__/types.test.ts`
- **File source**: `client/src/features/InterviewRoom/types.ts`
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/types.test.ts`

---

### Micro-Task 1.10b: Bổ sung API client trong `client/src/services/api/interviewApi.ts`

- **Mục tiêu**: Thêm phương thức `requestFollowUp` và `fetchConversationHistory` vào `interviewApi`.
- **File test**: `client/src/services/api/interviewApi.test.ts`
- **File source**: `client/src/services/api/interviewApi.ts`
- **Lệnh kiểm tra**: `npm --prefix client test -- src/services/api/interviewApi.test.ts`

---

### Micro-Task 1.11: Hook React `useFollowUp.ts`

- **Mục tiêu**: Hook điều phối trạng thái đàm thoại, tự động sync turns, quản lý trạng thái loading và lỗi.
- **File test**: `client/src/features/InterviewRoom/__tests__/useFollowUp.test.ts`
- **File source**: `client/src/features/InterviewRoom/hooks/useFollowUp.ts` (MỚI)
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/useFollowUp.test.ts`

---

### Micro-Task 1.12: Component giao diện `ConversationThread.tsx`

- **Mục tiêu**: Xây dựng UI danh sách tin nhắn hội thoại dạng chat bubble, hiển thị nhận xét gap và hiệu ứng AI đang suy nghĩ.
- **File test**: `client/src/features/InterviewRoom/__tests__/ConversationThread.test.tsx`
- **File source**: `client/src/features/InterviewRoom/components/ConversationThread.tsx` (MỚI)
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/ConversationThread.test.tsx`

---

### Micro-Task 1.13: Component giao diện `AdaptiveDifficultyBadge.tsx`

- **Mục tiêu**: Huy hiệu thể hiện độ khó hiện tại kèm chỉ báo xu hướng (Tăng / Giảm / Duy trì).
- **File test**: `client/src/features/InterviewRoom/__tests__/AdaptiveDifficultyBadge.test.tsx`
- **File source**: `client/src/features/InterviewRoom/components/AdaptiveDifficultyBadge.tsx` (MỚI)
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/AdaptiveDifficultyBadge.test.tsx`

---

### Micro-Task 1.14: Tích hợp tổng thể màn hình `InterviewRoom.tsx`

- **Mục tiêu**: Nhúng `ConversationThread`, `useFollowUp`, `AdaptiveDifficultyBadge` vào màn hình `InterviewRoom.tsx`.
- **File test**: `client/src/features/InterviewRoom/__tests__/InterviewRoomStudio.test.tsx`
- **File source**: `client/src/features/InterviewRoom/InterviewRoom.tsx`
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/InterviewRoomStudio.test.tsx`

---

### Micro-Task 1.15: Kịch bản kiểm thử tích hợp toàn diện End-to-End

- **Mục tiêu**: Chạy luồng phỏng vấn trọn vẹn: Tạo session -> Sinh câu hỏi -> Trả lời turn 1 -> AI phản biện turn 2 -> Nộp bài -> Chấm điểm.
- **File test**: `tests/e2e-conversational-interview.integration.test.ts` (MỚI)
- **Lệnh kiểm tra**: `npx vitest run tests/e2e-conversational-interview.integration.test.ts`

---

## 4. Kỷ Luật Terminal Bắt Buộc Cho Gemini 3.8 Flash

```powershell
# 1. Chạy test ĐỎ trước khi sửa code (phải fail đúng lỗi kỳ vọng)
npx vitest run <path-to-test>

# 2. Sửa file mã nguồn tương ứng

# 3. Chạy lại test XANH (exit code 0)
npx vitest run <path-to-test>

# 4. Kiểm tra trình biên dịch TypeScript không phát sinh lỗi
npx tsc --noEmit
npx tsc --noEmit -p client/tsconfig.json
```
