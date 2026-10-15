# AIP-AIU-02 — Phase 2: Multi-Agent Evaluation Panel & Rubric Consensus

## 1. Executive Summary & Acceptance Criteria

Pha 2 nâng cấp module chấm điểm phỏng vấn (`EVALUATION`). Thay vì gửi 1 prompt duy nhất cho LLM để chấm từ 0-10 (dễ dẫn đến ảo giác điểm, thiên vị, hoặc đánh giá phiến diện), hệ thống kích hoạt **Hội đồng Phỏng vấn Đa Tác Nhân (Multi-Agent Panel)** gồm 4 agent chuyên trách:

```
                  ┌────────────────────────┐
                  │   Candidate Answers    │
                  │ + Conversation History │
                  └───────────┬────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Tech Lead     │  │   Bar Raiser    │  │ HR / Behavioral │
│     Agent       │  │     Agent       │  │      Agent      │
│(Arch/Code/Scale)│  │ (Security/Edge) │  │  (Comm/STAR)    │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ Judge / Arbiter │
                     │  Agent (Consensus)
                     └────────┬────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ Calibrated Score│
                     │ + Learning Path │
                     └─────────────────┘
```

### Acceptance Criteria (AC):
1. **AC-01 (Agent Persona Specialization)**: Mỗi agent sở hữu system instruction chuyên biệt, rubric riêng biệt và thang điểm đánh giá độc lập. Tất cả đều ưu tiên tiếng Việt (`vi` là ngôn ngữ chính).
2. **AC-02 (Parallel Execution with Resilience)**: 3 đánh giá ban đầu (Tech Lead, Bar Raiser, HR) chạy song song qua `Promise.allSettled`. Nếu 1 agent gặp sự cố timeout/network, hệ thống tự động fallback sử dụng trọng số của 2 agent còn lại mà không làm đổ vỡ toàn bộ phiên chấm.
3. **AC-03 (Judge Consensus Protocol)**: Judge Agent so sánh điểm giữa các agent. Nếu độ lệch điểm giữa các agent đối với một tiêu chí vượt ngưỡng dung sai (`AIU_EVAL_MAX_VARIANCE_TOLERANCE = 3.0`), Judge gắn cờ `HIGH_VARIANCE_FLAG` và đưa ra lập luận hiệu chuẩn (Calibrated Reasoning).
4. **AC-04 (Conversation Turn Inclusion)**: Dữ liệu đưa vào chấm điểm bao gồm cả lịch sử phản biện từ Pha 1 (`ConversationTurn`), ghi nhận mức độ tiếp thu gợi ý của ứng viên (`Coachability Metric`).
5. **AC-05 (Backward Compatibility)**: Kết quả cuối cùng trả về vẫn tuân thủ interface chuẩn `EvaluationResult` để frontend không cần viết lại toàn bộ trang `ResultPage`.

---

## 2. Danh Sách Micro-Tasks (1 Seam - 1 File)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Micro-Task 2.1: Định nghĩa Types & Schemas Hội Đồng Đa Tác Nhân        │
│ Micro-Task 2.2: Prompt & Validator Cho Tech Lead Agent                 │
│ Micro-Task 2.3: Prompt & Validator Cho Bar Raiser Agent                │
│ Micro-Task 2.4: Prompt & Validator Cho HR / Behavioral Agent           │
│ Micro-Task 2.5: Prompt & Validator Cho Judge / Arbiter Agent           │
│ Micro-Task 2.6: Triển khai Service MultiAgentEvaluator                 │
│ Micro-Task 2.7: Tích hợp MultiAgentEvaluator vào InProgressState        │
│ Micro-Task 2.8: Mở rộng Model InterviewEvaluationResult Lưu Persona Data│
│ Micro-Task 2.9: Frontend ResultPage — Thêm Tab "Góc Nhìn Hội Đồng"    │
│ Micro-Task 2.10: Integration Test Toàn Diện Multi-Agent Evaluation    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Chi Tiết Từng Micro-Task

---

### Micro-Task 2.1: Định nghĩa Types & Schemas Hội Đồng Đa Tác Nhân

- **File test**: `tests/services/ai/multi-agent-types.unit.test.ts`
- **File source**: `src/services/ai/multi-agent/types.ts` (MỚI)
- **Đặc tả TypeScript**:
  ```typescript
  export type AgentRole = 'TECH_LEAD' | 'BAR_RAISER' | 'BEHAVIORAL' | 'JUDGE';

  export interface PersonaEvaluation {
    role: AgentRole;
    score: number; // 0 - 10
    strengths: { vi: string; en: string }[];
    weaknesses: { vi: string; en: string }[];
    specificFeedback: { vi: string; en: string };
    dimensionScores: Record<string, number>;
  }

  export interface ConsensusReport {
    finalOverallScore: number;
    personaBreakdown: PersonaEvaluation[];
    varianceFlags: Array<{
      dimension: string;
      variance: number;
      arbiterResolution: { vi: string; en: string };
    }>;
    calibratedDimensions: Array<{
      name: string;
      score: number;
      reasoning: string;
    }>;
    learningPath: Array<{
      topic: { en: string; vi: string };
      priority: 'High' | 'Medium' | 'Low';
      suggestion: { en: string; vi: string };
    }>;
  }
  ```
- **Lệnh kiểm tra**: `npx vitest run tests/services/ai/multi-agent-types.unit.test.ts`

---

### Micro-Task 2.2: Prompt & Validator Cho Tech Lead Agent

- **File test**: `tests/services/ai/tech-lead-agent.unit.test.ts`
- **File source**: `src/services/ai/multi-agent/TechLeadAgent.ts` (MỚI)
- **Nhiệm vụ**: Đánh giá kiến trúc hệ thống, Design Patterns, Clean Code, tính mở rộng (Scalability), và độ sâu công nghệ.
- **Tiêu chí chấm (0-10)**:
  - `Architecture & Design`: 30%
  - `Code Quality & Clean Architecture`: 25%
  - `Scalability & Performance`: 25%
  - `Technical Depth`: 20%
- **Lệnh kiểm tra**: `npx vitest run tests/services/ai/tech-lead-agent.unit.test.ts`

---

### Micro-Task 2.3: Prompt & Validator Cho Bar Raiser Agent

- **File test**: `tests/services/ai/bar-raiser-agent.unit.test.ts`
- **File source**: `src/services/ai/multi-agent/BarRaiserAgent.ts` (MỚI)
- **Nhiệm vụ**: "Soi" lỗi bảo mật (OWASP Top 10), thiếu validation dữ liệu đầu vào, nguy cơ race condition, memory leak, và khả năng xử lý edge cases.
- **Tiêu chí chấm (0-10)**:
  - `Security Awareness`: 30%
  - `Edge Case Robustness`: 30%
  - `Fault Tolerance & Recovery`: 20%
  - `Validation Completeness`: 20%
- **Lệnh kiểm tra**: `npx vitest run tests/services/ai/bar-raiser-agent.unit.test.ts`

---

### Micro-Task 2.4: Prompt & Validator Cho HR / Behavioral Agent

- **File test**: `tests/services/ai/behavioral-agent.unit.test.ts`
- **File source**: `src/services/ai/multi-agent/BehavioralAgent.ts` (MỚI)
- **Nhiệm vụ**: Đánh giá cấu trúc trả lời theo mô hình STAR, độ mạch lạc trong giao tiếp kỹ thuật, tư duy giải quyết vấn đề, và khả năng tiếp thu phản biện (Coachability).
- **Tiêu chí chấm (0-10)**:
  - `Communication Clarity`: 30%
  - `STAR Structuring`: 25%
  - `Problem Solving Mindset`: 25%
  - `Coachability & Guidance Acceptance`: 20%
- **Lệnh kiểm tra**: `npx vitest run tests/services/ai/behavioral-agent.unit.test.ts`

---

### Micro-Task 2.5: Prompt & Validator Cho Judge / Arbiter Agent

- **File test**: `tests/services/ai/judge-agent.unit.test.ts`
- **File source**: `src/services/ai/multi-agent/JudgeAgent.ts` (MỚI)
- **Nhiệm vụ**: Thu thập 3 bản nhận xét, tính độ lệch phương sai. Phân xử các xung đột điểm số (ví dụ: Tech Lead cho 9 nhưng Bar Raiser cho 4 vì lỗi bảo mật nghiêm trọng). Tổng hợp điểm số đồng thuận cuối cùng và lộ trình học tập thích ứng.
- **Lệnh kiểm tra**: `npx vitest run tests/services/ai/judge-agent.unit.test.ts`

---

### Micro-Task 2.6: Triển khai Service MultiAgentEvaluator

- **File test**: `tests/services/ai/multi-agent-evaluator.test.ts`
- **File source**: `src/services/ai/multi-agent/MultiAgentEvaluator.ts` (MỚI)
- **Logic điều phối**:
  ```typescript
  @injectable()
  export class MultiAgentEvaluator {
    constructor(
      private techLead: TechLeadAgent,
      private barRaiser: BarRaiserAgent,
      private behavioral: BehavioralAgent,
      private judge: JudgeAgent,
    ) {}

    async evaluate(input: MultiAgentEvaluationInput): Promise<ConsensusReport> {
      // 1. Chạy 3 agent song song
      const [techResult, barResult, behavResult] = await Promise.allSettled([
        this.techLead.evaluate(input),
        this.barRaiser.evaluate(input),
        this.behavioral.evaluate(input),
      ]);
      // 2. Chuyển kết quả hợp lệ vào Judge
      return this.judge.arbitrate({ techResult, barResult, behavResult }, input);
    }
  }
  ```
- **Lệnh kiểm tra**: `npx vitest run tests/services/ai/multi-agent-evaluator.test.ts`

---

### Micro-Task 2.7: Tích hợp MultiAgentEvaluator vào InProgressState

- **File test**: `tests/domain/in-progress-multi-agent.integration.test.ts`
- **File source**: `src/domain/interview/states/InProgressState.ts`
- **Kiểm tra Feature Flag**:
  - Nếu `AIU_MULTI_AGENT_EVALUATION_ENABLED=true`: sử dụng `MultiAgentEvaluator`.
  - Nếu `false`: sử dụng `evaluateSafely` như cũ (zero breaking changes).
- **Lệnh kiểm tra**: `npx vitest run tests/domain/in-progress-multi-agent.integration.test.ts`

---

### Micro-Task 2.8: Mở rộng Model InterviewEvaluationResult Lưu Persona Data

- **File test**: `tests/models/evaluation-result-personas.test.ts`
- **File source**: `src/models/InterviewEvaluationResult.ts`
- **Thêm trường**: `personaEvaluations` và `varianceFlags` vào schema MongoDB.
- **Lệnh kiểm tra**: `npx vitest run tests/models/evaluation-result-personas.test.ts`

---

### Micro-Task 2.9: Frontend ResultPage — Thêm Tab "Góc Nhìn Hội Đồng"

- **File test**: `client/src/features/InterviewResult/__tests__/PersonaFeedbackPanel.test.tsx`
- **File source**: `client/src/features/InterviewResult/components/PersonaFeedbackPanel.tsx` (MỚI)
- **UI**: Cho phép ứng viên chuyển tab xem nhận xét chi tiết của riêng từng chuyên gia:
  - Tab 1: "Tổng quan & Điểm đồng thuận"
  - Tab 2: "Tech Lead: Kiến trúc & Code"
  - Tab 3: "Bar Raiser: Bảo mật & Biên giới lỗi"
  - Tab 4: "HR: Tác phong & Giao tiếp"
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewResult/__tests__/PersonaFeedbackPanel.test.tsx`

---

### Micro-Task 2.10: Integration Test Toàn Diện Multi-Agent Evaluation

- **File test**: `tests/multi-agent-evaluation.integration.test.ts` (MỚI)
- **Kịch bản**: Mô phỏng nộp 5 câu trả lời, kích hoạt 3 agent mock, judge phân xử, kiểm tra dữ liệu lưu chuẩn xác trong database.
- **Lệnh kiểm tra**: `npx vitest run tests/multi-agent-evaluation.integration.test.ts`
