# AIP-AIU-07 — Delivery, Testing & Quality Assurance Plan

## 1. Mục Tiêu & Cổng Chất Lượng (Quality Gates)

Tài liệu này xác định chiến lược kiểm thử toàn diện cho toàn bộ 5 pha nâng cấp AI của dự án. Không có bất kỳ đoạn code nào được coi là hoàn tất nếu không thỏa mãn đồng thời 4 Cổng Chất Lượng bắt buộc:

```
┌────────────────────────────────────────────────────────────────────────┐
│ CỔNG 1: Compiler Zero-Error (`npx tsc --noEmit` exit code 0)           │
│ CỔNG 2: 100% Tests Pass (`vitest run` toàn bộ suite)                   │
│ CỔNG 3: Độ Phủ Nhánh (Branch Coverage) ≥ 70% toàn hệ thống,            │
│         ≥ 85% trên các file nghiệp vụ cốt lõi (Services & States)       │
│ CỔNG 4: Kiểm Soát Bảo Mật (Zero Secret Leak, Zero Prompt Injection)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Ma Trận Phân Tầng Kiểm Thử (Testing Pyramid)

```
              ┌─────────────────────────┐
              │ E2E System Tests (5%)   │ (Luồng hoàn chỉnh từ Setup -> Interview -> Result)
              ├─────────────────────────┤
              │ Integration Tests (35%) │ (Supertest + MongoMemoryReplSet + SSE Stream)
              ├─────────────────────────┤
              │ Contract Tests (15%)    │ (OpenAPI 3.1 schema & Provider Boundary Contracts)
              ├─────────────────────────┤
              │ Unit Tests (45%)        │ (Zod Schemas, State Machine, AST, Resampler, Prompts)
              └─────────────────────────┘
```

---

## 3. Danh Sách Đầy Đủ 55 Test Files Theo Từng Pha

### Pha 1: Adaptive Follow-up Engine (15 Test Files)
| STT | File Kiểm Thử | Tầng Test | Mục Tiêu & Trọng Tâm |
| :---: | :--- | :---: | :--- |
| 1 | `tests/domain/interview-follow-up-types.unit.test.ts` | Unit | Kiểm tra legal types `FOLLOW_UP` & DTO mapping |
| 2 | `tests/domain/FollowUpState.unit.test.ts` | Unit | Chuyển đổi trạng thái `IN_PROGRESS -> FOLLOW_UP -> IN_PROGRESS` |
| 3 | `tests/models/interview-session-status.unit.test.ts` | Unit | Schema `InterviewSession` chứa status `FOLLOW_UP` |
| 4 | `tests/models/conversation-turn.model.test.ts` | Unit | Schema `ConversationTurn` & unique compound index |
| 5 | `tests/repositories/conversation-turn.repository.test.ts` | Integration | CRUD, đếm turn, sắp xếp turnIndex, tenant isolation |
| 6 | `tests/services/ai/follow-up-engine.unit.test.ts` | Unit | Zod validator, sanitize text, prompt tiếng Việt |
| 7 | `tests/services/ai/ai-provider-follow-up.test.ts` | Contract | Interface contract trên `MockAiProvider` & `GeminiAiProvider` |
| 8 | `tests/services/interview-service-follow-up.integration.test.ts` | Integration | Logic điều phối turn, giới hạn 3 câu, cập nhật state |
| 9 | `tests/controllers/interview-follow-up-api.integration.test.ts` | Integration | HTTP API endpoint 200, 400, 404, 409 |
| 10 | `client/src/services/api/interviewApi.test.ts` | Client Unit | API client method `requestFollowUp` & `getConversationHistory` |
| 11 | `client/src/features/InterviewRoom/__tests__/useFollowUp.test.ts` | Client Hook | Quản lý state hội thoại, submit, error handling |
| 12 | `client/src/features/InterviewRoom/__tests__/ConversationThread.test.tsx` | Client UI | Render chat bubble, avatar, typing indicator |
| 13 | `client/src/features/InterviewRoom/__tests__/AdaptiveDifficultyBadge.test.tsx` | Client UI | Render badge cấp độ khó và xu hướng điều chỉnh |
| 14 | `client/src/features/InterviewRoom/__tests__/InterviewRoomStudio.test.tsx` | Client UI | Tích hợp layout Studio có luồng follow-up |
| 15 | `tests/e2e-conversational-interview.integration.test.ts` | E2E | Vòng đời trọn vẹn của 1 phiên phỏng vấn hội thoại |

### Pha 2: Multi-Agent Evaluation Panel (10 Test Files)
| STT | File Kiểm Thử | Tầng Test | Mục Tiêu & Trọng Tâm |
| :---: | :--- | :---: | :--- |
| 16 | `tests/services/ai/multi-agent-types.unit.test.ts` | Unit | Schema Zod & TypeScript types cho 4 Persona |
| 17 | `tests/services/ai/tech-lead-agent.unit.test.ts` | Unit | Đánh giá Clean Code, Architecture, Scalability |
| 18 | `tests/services/ai/bar-raiser-agent.unit.test.ts` | Unit | Soi lỗi OWASP, Race conditions, Missing Validation |
| 19 | `tests/services/ai/behavioral-agent.unit.test.ts` | Unit | Đánh giá cấu trúc STAR, Giao tiếp, Coachability |
| 20 | `tests/services/ai/judge-agent.unit.test.ts` | Unit | Tính phương sai, phát hiện lệch điểm > 3.0, phân xử |
| 21 | `tests/services/ai/multi-agent-evaluator.test.ts` | Integration | Chạy 3 agent song song, fallback khi 1 agent fail |
| 22 | `tests/domain/in-progress-multi-agent.integration.test.ts` | Integration | Tích hợp vào `InProgressState` với Feature Flag |
| 23 | `tests/models/evaluation-result-personas.test.ts` | Unit | Schema `personaEvaluations` & `varianceFlags` |
| 24 | `client/src/features/InterviewResult/__tests__/PersonaFeedbackPanel.test.tsx` | Client UI | Tab xem góc nhìn từng chuyên gia trong ResultPage |
| 25 | `tests/multi-agent-evaluation.integration.test.ts` | E2E | Luồng nộp bài và chấm điểm hội đồng hoàn chỉnh |

### Pha 3: Live Code Sandbox & AST Engine (10 Test Files)
| STT | File Kiểm Thử | Tầng Test | Mục Tiêu & Trọng Tâm |
| :---: | :--- | :---: | :--- |
| 26 | `tests/services/code-sandbox/sandbox-interface.unit.test.ts` | Unit | Contract của `ISandboxProvider` |
| 27 | `tests/services/code-sandbox/piston-provider.test.ts` | Integration | Kết nối Piston API, timeout 5s, memory limit 128MB |
| 28 | `tests/services/code-sandbox/mock-sandbox.test.ts` | Unit | Mock sandbox provider cho offline test suite |
| 29 | `tests/services/code-sandbox/complexity-analyzer.test.ts` | Unit | Duyệt AST TypeScript, tính Big-O, Cyclomatic complexity |
| 30 | `tests/services/code-sandbox/ai-code-review.test.ts` | Unit | Prompt AI review mã nguồn kết hợp kết quả AST |
| 31 | `tests/controllers/code-execution-api.integration.test.ts` | Integration | HTTP API chạy code, test case ẩn / hiện, rate limit |
| 32 | `client/src/features/InterviewRoom/__tests__/useCodeExecution.test.ts` | Client Hook | Quản lý state chạy code, execution time, stdout/stderr |
| 33 | `client/src/features/InterviewRoom/__tests__/CodeWorkspaceRunner.test.tsx` | Client UI | Nút chạy code, console output, bảng test cases |
| 34 | `client/src/features/InterviewRoom/__tests__/ComplexityMetricsBadge.test.tsx` | Client UI | Hiển thị Big-O thời gian/không gian |
| 35 | `tests/code-sandbox.integration.test.ts` | E2E | Luồng chạy code, chấm thuật toán hoàn chỉnh |

### Pha 4: System Design Whiteboard (10 Test Files)
| STT | File Kiểm Thử | Tầng Test | Mục Tiêu & Trọng Tâm |
| :---: | :--- | :---: | :--- |
| 36 | `tests/services/vision/whiteboard-types.unit.test.ts` | Unit | Data types cho canvas nodes và issues |
| 37 | `tests/services/vision/gemini-vision-analyzer.test.ts` | Integration | Multimodal image prompt, phát hiện SPOF & CAP |
| 38 | `tests/services/vision/vision-prompt.unit.test.ts` | Unit | Prompt Socratic System Design Architect |
| 39 | `tests/controllers/whiteboard-api.integration.test.ts` | Integration | Upload snapshot ảnh canvas, rate limit, dung lượng |
| 40 | `tests/models/whiteboard-snapshot.model.test.ts` | Unit | Schema `WhiteboardSnapshot` MongoDB |
| 41 | `client/src/features/InterviewRoom/__tests__/SystemDesignCanvas.test.tsx` | Client UI | Kéo thả icon kiến trúc, xuất ảnh canvas |
| 42 | `client/src/features/InterviewRoom/__tests__/ArchitectureCritiqueOverlay.test.tsx` | Client UI | Hộp viền đỏ SPOF và tooltip trên canvas |
| 43 | `client/src/features/InterviewRoom/__tests__/useSystemDesignWhiteboard.test.ts` | Client Hook | Quản lý canvas state, auto-save, API call |
| 44 | `client/src/features/InterviewRoom/__tests__/InterviewRoomWhiteboardMode.test.tsx` | Client UI | Chuyển chế độ AnswerMode `'whiteboard'` |
| 45 | `tests/whiteboard-vision.integration.test.ts` | E2E | Luồng vẽ sơ đồ và nhận phản biện kiến trúc của AI |

### Pha 5: Gemini Multimodal Live Audio Stream (10 Test Files)
| STT | File Kiểm Thử | Tầng Test | Mục Tiêu & Trọng Tâm |
| :---: | :--- | :---: | :--- |
| 46 | `tests/services/live-audio/live-audio-protocol.unit.test.ts` | Unit | WebSocket message schema và event types |
| 47 | `tests/services/live-audio/gemini-live-relay.test.ts` | Integration | WebSocket relay server kết nối Gemini Live Bidi stream |
| 48 | `tests/services/live-audio/audio-resampler.unit.test.ts` | Unit | Chuyển đổi 48kHz Float32 <-> 16kHz Int16 PCM Mono |
| 49 | `tests/services/live-audio/cloud-tts-fallback.test.ts` | Integration | Fallback Google Cloud TTS `vi-VN-Neural2-A` |
| 50 | `tests/controllers/live-websocket-upgrade.test.ts` | Integration | WebSocket upgrade authentication & ownership |
| 51 | `client/src/features/InterviewRoom/__tests__/audioWorklet.test.ts` | Client Unit | AudioWorklet thu thập PCM 16-bit không jank UI |
| 52 | `client/src/features/InterviewRoom/__tests__/useGeminiLiveAudio.test.ts` | Client Hook | Quản lý kết nối WS, audio levels, cắt lời tức thì |
| 53 | `client/src/features/InterviewRoom/__tests__/LiveAiInterviewerAvatar.test.tsx` | Client UI | Sóng âm 5 cột và hiệu ứng hào quang Avatar |
| 54 | `client/src/features/InterviewRoom/__tests__/useMediaPipeGazeTracker.test.ts` | Client Hook | Đo tỷ lệ giao tiếp mắt và cảnh báo nhìn lệch |
| 55 | `tests/live-audio-stream.integration.test.ts` | E2E | Luồng đàm thoại trực tiếp thời gian thực |

---

## 4. Kịch Bản Kiểm Thử Chống Lỗi (Chaos & Reliability Scenarios)

1. **AI Timeout & Exponential Backoff**:
   - Khi Gemini API quá tải hoặc trả về HTTP 429, retry tối đa 3 lần với backoff: 1s -> 2s -> 4s.
   - Nếu vẫn lỗi sau 3 lần: ghi nhận log có mã `AIU_PROVIDER_RATE_LIMITED` và trả về thông báo an toàn cho ứng viên, không làm treo phiên phỏng vấn.
2. **Concurrent Request Race Condition**:
   - Ứng viên bấm gửi câu trả lời 2 lần liên tiếp trong 100ms:
   - Request đầu tiên giữ lease lock và tăng `turnIndex`. Request thứ hai gặp lỗi `AIU_STATE_CONFLICT` hoặc `Idempotency-Key` no-op, không tạo 2 turn trùng lặp trong database.
3. **Sandbox Fork-Bomb & Infinite Loop**:
   - Ứng viên nộp đoạn mã: `while(true) {}` hoặc fork process liên tục.
   - Quá trình chạy bị ngắt cưỡng bức đúng mốc 5,000ms với mã lỗi `AIU_SANDBOX_TIMEOUT` (HTTP 408), giải phóng bộ nhớ ngay lập tức.
4. **Corrupt Base64 Image Upload Attack**:
   - Gửi payload ảnh canvas giả mạo định dạng hoặc buffer bị cắt cụt.
   - Backend bắt lỗi ở tầng controller, trả về HTTP 415 `AIU_WHITEBOARD_INVALID_MIME` mà không gọi Gemini Vision API.
5. **WebSocket Audio Barge-in Race Condition**:
   - Ứng viên bắt đầu nói khi AI đang phát âm thanh dở dang:
   - Server nhận event `INTERRUPT`, lập tức gửi tín hiệu cutoff xuống client trong < 50ms, hủy bộ đệm audio đang phát.
6. **Vietnamese Diacritic Normalization (NFC vs NFD)**:
   - Chuỗi câu trả lời chứa ký tự tiếng Việt dạng tổ hợp (NFD) được chuẩn hóa tự động về dạng dựng sẵn (NFC) qua `normalize('NFKC')` trước khi đưa vào hash hoặc prompt boundary.
7. **Rollback Drill (Kill Switches)**:
   - Khi tắt `AIU_FOLLOW_UP_ENABLED=false`: Hệ thống tự động chuyển về luồng phỏng vấn chuẩn 5 câu tĩnh của baseline mà không phát sinh lỗi 500.
   - Khi tắt `AIU_MULTI_AGENT_EVALUATION_ENABLED=false`: Hệ thống quay về phương pháp chấm điểm đơn luồng `evaluateSafely`.

---

## 5. Cú Pháp Lệnh Chạy Test Chuẩn (CLI Reference)

```powershell
# Chạy test backend (đứng từ root)
npx vitest run tests/domain/interview-follow-up-types.unit.test.ts

# Chạy test client (sử dụng --prefix client, truyền đường dẫn tương đối trong client/)
npm --prefix client test -- src/features/InterviewRoom/__tests__/useFollowUp.test.ts
npm --prefix client test -- src/features/InterviewRoom/__tests__/ConversationThread.test.tsx

# Kiểm tra type toàn hệ thống
npx tsc --noEmit
npx tsc --noEmit -p client/tsconfig.json
```
