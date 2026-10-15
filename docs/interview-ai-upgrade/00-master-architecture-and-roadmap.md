# Master Architecture & Implementation Roadmap: AI Interview Upgrade (AIU)

## 1. Mục Tiêu & Nguyên Tắc Tối Thượng (Guiding Principles)

Tài liệu này đóng vai trò "đường ray kỹ thuật tuyệt đối" (Technical Rail System) cho toàn bộ quá trình nâng cấp hệ thống phỏng vấn AI. Mọi tác tử triển khai (kể cả Gemini 3.8 Flash) bắt buộc tuân thủ 100% các tiêu chuẩn sau:

1. **Vietnamese-First Invariant (Ưu tiên tiếng Việt)**:
   - Tất cả prompt AI của interviewer, câu hỏi follow-up, feedback, gợi ý, và transcript hội thoại mặc định tạo tiếng Việt (`vi`) trước, tiếng Anh (`en`) sau.
   - Text-to-Speech (TTS) và Speech-to-Text (STT) ưu tiên cấu hình `vi-VN` với bộ lọc filler word và prosody chuyên dụng cho tiếng Việt.
2. **Deterministic Micro-Slicing (1 Seam - 1 File)**:
   - Mỗi micro-task chỉ được chạm tối đa **1 file test + 1 file source**.
   - Không thực hiện thay đổi lan rộng (Shotgun Surgery).
3. **Compiler Grounding & Exact Types**:
   - Tất cả kiểu dữ liệu, model schema, DTO, interface phải khớp 100% với TypeScript compiler (`npx tsc --noEmit`). Không được phép dùng `any`.
4. **TDD Sắt Đá (Red-Green-Refactor)**:
   - Luôn viết test đỏ (`RED`) trước -> Chạy terminal xác nhận fail đúng mã lỗi -> Viết mã tối thiểu để xanh (`GREEN`) -> Refactor (`REFACTOR`).
5. **Zero Data Leakage & Backward Compatibility**:
   - Dữ liệu câu hỏi phiên bản cũ và các phiên phỏng vấn `COMPLETED` không bị phá vỡ cấu trúc.
   - Các API candidate-facing tiếp tục áp dụng bộ lọc `safe-dto` nghiêm ngặt, không làm rò rỉ prompt system, vector embedding, hay token nội bộ.

---

## 2. Ma Trận Pha Triển Khai (Phase Matrix)

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHA 1: Adaptive Follow-up & Conversational State Machine               │
│ (Trọng tâm: Turn-by-Turn Socratic Interviewer, SSE, ConversationTurn)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│ PHA 2:       │             │ PHA 3:       │             │ PHA 4:       │
│ Multi-Agent  │             │ Code Sandbox │             │ System       │
│ Evaluation   │             │ & AST Engine │             │ Design Vision│
└──────┬───────┘             └──────┬───────┘             └──────┬───────┘
       │                            │                            │
       └────────────────────────────┼────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHA 5: Gemini Multimodal Live Audio Stream (WebRTC / Live API)         │
└────────────────────────────────────────────────────────────────────────┘
```

| Pha | Mã Đề Án | Trọng Tâm Kỹ Thuật | Trạng Thái Phụ Thuộc |
| :--- | :--- | :--- | :--- |
| **Pha 1** | `AIU-01` | Mở rộng State Machine (`FOLLOW_UP`), Model `ConversationTurn`, Prompt Socratic tiếng Việt, API Follow-up, Conversation Thread UI. | Nền tảng bắt buộc |
| **Pha 2** | `AIU-02` | Multi-Agent Evaluation Panel (Tech Lead, Bar Raiser, Behavioral, Judge/Synthesizer), Rubric Consensus, Variance Detection. | Phụ thuộc Pha 1 |
| **Pha 3** | `AIU-03` | Isolated Code Execution Sandbox (Docker / Piston), AST Complexity Analyzer, Unit Test Runner, Live Bug Injection. | Phụ thuộc Pha 1 |
| **Pha 4** | `AIU-04` | System Design Interactive Whiteboard, Architecture Canvas (Excalidraw), Gemini Multimodal Vision Critique, SPOF / CAP Analysis. | Phụ thuộc Pha 1 |
| **Pha 5** | `AIU-05` | Gemini Multimodal Live API (WebRTC / WebSocket Relay), Vietnamese Neural Voice, Full-Duplex Interruption, Prosody Telemetry. | Phụ thuộc Pha 1 |

---

## 3. Kiến Trúc State Machine Mở Rộng

### 3.1 Bảng Chuyển Đổi Trạng Thái Hợp Lệ (State Transitions Table)

```
                 ┌─────────────┐
                 │   PENDING   │
                 └──────┬──────┘
                        │ generate()
                        ▼
                 ┌─────────────┐
                 │ GENERATING  │
                 └──────┬──────┘
                        │ success
                        ▼
     ┌──────────────────> IN_PROGRESS <──────────────────┐
     │                         │                         │
     │                         │ requestFollowUp()       │
     │                         ▼                         │
     │                  ┌─────────────┐                  │
     │                  │  FOLLOW_UP  │                  │
     │                  └──────┬──────┘                  │
     │                         │                         │
     │                         ├─ completeFollowUp() ────┘
     │                         │
     │                         │ submit() (nộp bài sớm)
     │                         ▼
     │                  ┌─────────────┐
     │                  │ EVALUATING  │
     │                  └──────┬──────┘
     │                         │
     │                         ├─ success ──> COMPLETED
     │                         │
     └────── retry() ──────────┴─ failure ──> FAILED
```

```typescript
export const LEGAL_STATE_TRANSITIONS: Record<InterviewStatus, InterviewStatus[]> = {
  PENDING: ['GENERATING'],
  GENERATING: ['IN_PROGRESS', 'FAILED'],
  IN_PROGRESS: ['FOLLOW_UP', 'EVALUATING', 'FAILED'],
  FOLLOW_UP: ['IN_PROGRESS', 'EVALUATING', 'FAILED'],
  EVALUATING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: ['GENERATING', 'EVALUATING', 'IN_PROGRESS'],
};
```

---

## 4. Danh Mục Biến Môi Trường (Environment Contract)

Các biến cấu hình mới được bổ sung vào `src/config/env.ts` với strict Zod validation:

```env
# ==========================================
# AI INTERVIEW UPGRADE (AIU) CONFIGURATION
# ==========================================
# Pha 1: Follow-up Engine
AIU_FOLLOW_UP_ENABLED=true
AIU_MAX_FOLLOW_UPS_PER_QUESTION=3
AIU_FOLLOW_UP_TIMEOUT_MS=15000

# Pha 2: Multi-Agent Evaluation
AIU_MULTI_AGENT_EVALUATION_ENABLED=false
AIU_EVAL_MAX_VARIANCE_TOLERANCE=3.0

# Pha 3: Code Execution Sandbox
AIU_SANDBOX_ENABLED=false
AIU_SANDBOX_PROVIDER=piston # piston | docker | wasm
AIU_SANDBOX_TIMEOUT_MS=5000
AIU_SANDBOX_MEMORY_LIMIT_MB=128

# Pha 4: System Design Vision
AIU_VISION_ANALYSIS_ENABLED=false

# Pha 5: Live Audio Stream
AIU_GEMINI_LIVE_ENABLED=false
AIU_DEFAULT_TTS_VOICE=vi-VN-Neural2-A
```

---

## 5. Quy Chuẩn Đặt Tên & Đường Dẫn Tài Liệu

Mỗi pha triển khai sở hữu 1 file đặc tả kỹ thuật chi tiết tại `docs/interview-ai-upgrade/`:
- `01-phase-1-adaptive-follow-up-engine.md`: Toàn bộ micro-tasks Pha 1.
- `02-phase-2-multi-agent-evaluation-panel.md`: Toàn bộ micro-tasks Pha 2.
- `03-phase-3-live-code-sandbox-and-ast.md`: Toàn bộ micro-tasks Pha 3.
- `04-phase-4-system-design-whiteboard.md`: Toàn bộ micro-tasks Pha 4.
- `05-phase-5-gemini-live-multimodal-voice.md`: Toàn bộ micro-tasks Pha 5.
