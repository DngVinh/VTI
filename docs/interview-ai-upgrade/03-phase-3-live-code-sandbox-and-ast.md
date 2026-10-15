# AIP-AIU-03 — Phase 3: Live Code Sandbox & Semantic AST Analysis

## 1. Executive Summary & Acceptance Criteria

Pha 3 nâng cấp trải nghiệm phỏng vấn lập trình (Coding Round) từ một khung nhập văn bản thuần túy (`CodeWorkspace.tsx`) thành một **Môi trường Thực thi Mã Cô lập (Isolated Code Execution Sandbox)** kết hợp bộ phân tích cú pháp tĩnh trừu tượng (Abstract Syntax Tree - AST) và AI Copilot Reviewer.

### Acceptance Criteria (AC):
1. **AC-01 (Isolated Code Execution)**: Ứng viên bấm "Chạy Code", mã nguồn được thực thi an toàn trong môi trường sandbox với giới hạn tài nguyên nghiêm ngặt (Timeout: 5s, Memory: 128MB, No Network Access).
2. **AC-02 (Multi-Language Support)**: Hỗ trợ chạy 5 ngôn ngữ cốt lõi: JavaScript, TypeScript, Python, Java, Go. Đối với các ngôn ngữ khác (như SQL), hệ thống hiển thị thông báo hỗ trợ phân tích tĩnh qua AST.
3. **AC-03 (Automated Test Case Runner)**: Kiểm tra code dựa trên bộ test cases (bao gồm test cases hiển thị công khai và test cases ẩn).
4. **AC-04 (Static AST Complexity Analysis)**: Phân tích độ phức tạp thuật toán thời gian/không gian ($O(N)$, $O(N^2)$), độ phức tạp Cyclomatic, và phát hiện các code smell tiềm ẩn.
5. **AC-05 (AI Bug Injection Mode)**: AI có thể cố ý đưa ra đoạn code có bug logic / memory leak tinh vi và yêu cầu ứng viên tìm, giải thích, và sửa trực tiếp.

---

## 2. Danh Sách Micro-Tasks (1 Seam - 1 File)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Micro-Task 3.1: Interface & Adapter Cho Sandbox Engine                 │
│ Micro-Task 3.2: Triển khai Piston API Sandbox Provider                 │
│ Micro-Task 3.3: Triển khai Mock / Local In-Memory Sandbox Provider     │
│ Micro-Task 3.4: Xây dựng Service AST Complexity Analyzer (TypeScript)  │
│ Micro-Task 3.5: Triển khai Prompt AI Complexity & Code Review          │
│ Micro-Task 3.6a: Triển khai CodeExecutionController                    │
│ Micro-Task 3.6b: Định tuyến POST /execute-code trong interview.route.ts│
│ Micro-Task 3.7: Client Hook useCodeExecution                           │
│ Micro-Task 3.8: Nâng cấp CodeWorkspace: Console & Test Runner Panel    │
│ Micro-Task 3.9: Component ComplexityMetricsBadge                       │
│ Micro-Task 3.10: Integration Test Toàn Diện Code Sandbox Runner        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Chi Tiết Từng Micro-Task

---

### Micro-Task 3.1: Interface & Adapter Cho Sandbox Engine

- **File test**: `tests/services/code-sandbox/sandbox-interface.unit.test.ts`
- **File source**: `src/services/code-sandbox/types.ts` (MỚI)
- **Đặc tả contracts**:
  ```typescript
  export type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'go';

  export interface TestCase {
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
  }

  export interface TestCaseResult {
    testCaseIndex: number;
    passed: boolean;
    actualOutput: string;
    expectedOutput: string;
    executionTimeMs: number;
    isHidden: boolean;
  }

  export interface ExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
    memoryKb: number;
    testResults?: TestCaseResult[];
  }

  export interface ISandboxProvider {
    execute(code: string, language: SupportedLanguage, testCases?: TestCase[]): Promise<ExecutionResult>;
  }
  ```
- **Lệnh kiểm tra**: `npx vitest run tests/services/code-sandbox/sandbox-interface.unit.test.ts`

---

### Micro-Task 3.2: Triển khai Piston API Sandbox Provider

- **File test**: `tests/services/code-sandbox/piston-provider.test.ts`
- **File source**: `src/services/code-sandbox/PistonSandboxProvider.ts` (MỚI)
- **Cơ chế**: Gửi payload đến Piston REST API endpoint (`POST /api/v2/execute`), quản lý connection pool và timeout circuit breaker.
- **Lệnh kiểm tra**: `npx vitest run tests/services/code-sandbox/piston-provider.test.ts`

---

### Micro-Task 3.3: Triển khai Mock / Local In-Memory Sandbox Provider

- **File test**: `tests/services/code-sandbox/mock-sandbox.test.ts`
- **File source**: `src/services/code-sandbox/MockSandboxProvider.ts` (MỚI)
- **Mục tiêu**: Chạy offline trong test suite và CI/CD mà không cần server Piston bên ngoài.
- **Lệnh kiểm tra**: `npx vitest run tests/services/code-sandbox/mock-sandbox.test.ts`

---

### Micro-Task 3.4: Xây dựng Service AST Complexity Analyzer (TypeScript)

- **File test**: `tests/services/code-sandbox/complexity-analyzer.test.ts`
- **File source**: `src/services/code-sandbox/ComplexityAnalyzer.ts` (MỚI)
- **Kỹ thuật**: Sử dụng TypeScript compiler API (`ts.createSourceFile`) để duyệt AST:
  - Đếm số vòng lặp lồng nhau (`for`, `while`) để ước lượng Big-O ($O(N)$ vs $O(N^2)$).
  - Tính toán độ phức tạp Cyclomatic (số câu lệnh rẽ nhánh `if`, `case`, `catch`, `?`).
- **Lệnh kiểm tra**: `npx vitest run tests/services/code-sandbox/complexity-analyzer.test.ts`

---

### Micro-Task 3.5: Triển khai Prompt AI Complexity & Code Review

- **File test**: `tests/services/code-sandbox/ai-code-review.test.ts`
- **File source**: `src/services/code-sandbox/AiCodeReviewer.ts` (MỚI)
- **Nhiệm vụ**: Kết hợp kết quả AST với Gemini để đưa ra nhận xét chuyên sâu bằng tiếng Việt: cấu trúc dữ liệu tối ưu hơn, cảnh báo edge cases, gợi ý refactor theo Clean Code.
- **Lệnh kiểm tra**: `npx vitest run tests/services/code-sandbox/ai-code-review.test.ts`

---

### Micro-Task 3.6a: Triển khai CodeExecutionController

- **File test**: `tests/controllers/code-execution-controller.unit.test.ts`
- **File source**: `src/controllers/CodeExecutionController.ts` (MỚI)
- **Logic**: Kiểm tra quyền sở hữu session, validate ngôn ngữ, ủy quyền thực thi sang `ISandboxProvider`.
- **Lệnh kiểm tra**: `npx vitest run tests/controllers/code-execution-controller.unit.test.ts`

---

### Micro-Task 3.6b: Định tuyến POST /execute-code trong `src/routes/interview.route.ts`

- **File test**: `tests/controllers/code-execution-api.integration.test.ts`
- **File source**: `src/routes/interview.route.ts`
- **Đặc tả HTTP**:
  - `POST /api/v1/interviews/:id/execute-code`
  - Body: `{ questionId, code, language }`
  - Áp dụng rate limiter: Tối đa 10 lần chạy / phút (`AIU_SANDBOX_RATE_LIMITED`).
- **Lệnh kiểm tra**: `npx vitest run tests/controllers/code-execution-api.integration.test.ts`

---

### Micro-Task 3.7: Client Hook useCodeExecution

- **File test**: `client/src/features/InterviewRoom/__tests__/useCodeExecution.test.ts`
- **File source**: `client/src/features/InterviewRoom/hooks/useCodeExecution.ts` (MỚI)
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/useCodeExecution.test.ts`

---

### Micro-Task 3.8: Nâng cấp CodeWorkspace: Console & Test Runner Panel

- **File test**: `client/src/features/InterviewRoom/__tests__/CodeWorkspaceRunner.test.tsx`
- **File source**: `client/src/features/InterviewRoom/components/CodeWorkspace.tsx`
- **Giao diện bổ sung**:
  - Thanh công cụ phía trên: Nút "Chạy code (Ctrl+Enter)", Bộ chọn ngôn ngữ, Đèn trạng thái máy ảo.
  - Tab console phía dưới: "Đầu ra (Console Stdout)", "Kiểm thử (Test Cases 3/3 Passed)".
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/CodeWorkspaceRunner.test.tsx`

---

### Micro-Task 3.9: Component ComplexityMetricsBadge

- **File test**: `client/src/features/InterviewRoom/__tests__/ComplexityMetricsBadge.test.tsx`
- **File source**: `client/src/features/InterviewRoom/components/ComplexityMetricsBadge.tsx` (MỚI)
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/ComplexityMetricsBadge.test.tsx`

---

### Micro-Task 3.10: Integration Test Toàn Diện Code Sandbox Runner

- **File test**: `tests/code-sandbox.integration.test.ts` (MỚI)
- **Lệnh kiểm tra**: `npx vitest run tests/code-sandbox.integration.test.ts`
