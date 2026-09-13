# AIP-66 — Question Bank Phase 5: Safe Interview Integration, Hybrid Question Sourcing & Immutable Provenance

## 1. Executive Summary

AIP-66 completes the operational integration of the Question Bank into the live Interview Session generation pipeline. Building upon the governance, versioning, taxonomy, and vector foundations delivered in Phases 1 through 4 (AIP-62 – AIP-65), Phase 5 introduces a server-side, feature-flagged, and fully rollback-safe question sourcing architecture.

Key delivery invariants enforced:
1. **Exact-5 Invariant**: An interview generation execution persists either exactly 5 valid questions or 0 questions atomically.
2. **Safe-Off & Rollback Fidelity**: When `INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED=false`, the system executes 100% baseline AI generation without querying the Question Bank.
3. **Immutable Snapshot & Provenance**: Questions sourced from the Question Bank store an immutable content snapshot, version reference, content hash, and deterministic seed fingerprint. Subsequent version publishes or retirements in the Question Bank never mutate existing interview sessions.
4. **Candidate Privacy & Anti-Leak Boundary**: All candidate-facing API endpoints (`GET /api/v1/interviews/:id`, `POST /generate`, `POST /progress`, `POST /submit`, and SSE stream) sanitize and strip Question Bank IDs, version IDs, hashes, vectors, and provenance metadata.
5. **Idempotency & Race Immunity**: Concurrent workers and duplicate job delivery resolve safely via atomic CAS checks and unique compound indexing on `{ sessionId: 1, order: 1 }`.

---

## 2. Architecture & Question Sourcing Modes

Question sourcing is decoupled from candidate requests and centrally governed by `InterviewQuestionGenerationOrchestrator` and `InterviewQuestionSourcePolicy`. Candidates cannot supply sourcing modes or question IDs.

```
Candidate / Client (POST /api/v1/interviews/:id/generate)
          │
          ▼
InterviewController / InterviewService
          │
          ▼
Agenda Job: GENERATE_QUESTIONS
          │
          ▼
InterviewQuestionGenerationOrchestrator
          │
          ├──> Mode Resolution (InterviewQuestionSourcePolicy)
          │         │
          │         ├─ AI_ONLY   ──> AiInterviewQuestionSource
          │         ├─ SHADOW    ──> AiInterviewQuestionSource (Primary) + QuestionBankSelector (Shadow metric)
          │         ├─ BANK_ONLY ──> QuestionBankInterviewQuestionSource
          │         └─ HYBRID    ──> HybridInterviewQuestionSource (k Bank + (5-k) AI)
          │
          ├──> Bundle Validation (InterviewQuestionBundleValidator: exact 5, bilingual, no dupes)
          │
          ├──> Atomic Persistence (commitInterviewQuestionsBundle: Mongo Transaction / CAS Standalone)
          │
          └──> Event Notification (IEventPublisher: STATE_CHANGED -> SSE Stream)
```

### Supported Sourcing Modes

| Mode | Primary Source | Fallback / Shadow Behavior | Use Case |
| :--- | :--- | :--- | :--- |
| `AI_ONLY` | Pure Gemini / Mock AI generation | None | Baseline behavior, default safe-off mode. |
| `SHADOW` | AI Generation (persisted) | Question Bank selection executed non-blocking with bounded timeout for telemetry. | Verification of candidate pool matching before live rollout. |
| `BANK_ONLY` | Question Bank | Requires >= 1 Easy, 2 Medium, 2 Hard. Throws error if pool insufficient. | Governed curated assessments. |
| `HYBRID` | Question Bank + AI | Allocates `k` questions from Bank, generates `5 - k` via AI. If Bank has fewer than `k`, selects available and tops up with AI. | Production hybrid blend balancing consistency with freshness. |

---

## 3. Deterministic Sampling & Seed Fingerprint

To ensure reproducible audits and prevent bias:
- **Seed Calculation**: `sha256Hex("${sessionId}:${policyVersion}:${taxKey}")` where `taxKey` is the normalized `roleId|levelId|techIds` string.
- **PRNG**: Mulberry32 32-bit pseudo-random number generator seeded with deterministic 32-bit integer derived from hash.
- **Difficulty Quota**: Standard distribution requires 1 Easy, 2 Medium, 2 Hard.
- **Prompt Sanitization**: In hybrid mode, prompt texts selected from the Bank are stripped of solutions and passed to AI prompt context to guarantee semantic deduplication across sources.

---

## 4. Immutable Provenance & Internal Audit Model

`InterviewQuestionModel` is augmented with dedicated immutable provenance fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `sourceType` | `'AI_GENERATED' \| 'QUESTION_BANK'` | Distinguishes whether the question originated from Bank or AI. |
| `questionBankQuestionId` | `ObjectId \| null` | Reference to the `Question` entity in Question Bank. |
| `questionBankVersionId` | `ObjectId \| null` | Reference to the immutable `QuestionVersion` snapshot. |
| `questionBankVersionNumber` | `number \| null` | Human-readable version number at selection time. |
| `questionBankCode` | `string \| null` | Question bank code (e.g. `QB-2026-000001`). |
| `selectionPolicyVersion` | `string \| null` | Sourcing policy version (e.g. `v1`). |
| `selectionSeedFingerprint` | `string \| null` | SHA256 deterministic seed fingerprint. |
| `promptSnapshotHash` | `string \| null` | Content hash of bilingual prompt snapshot. |
| `selectedAt` | `Date \| null` | Timestamp when question was committed to the session. |

Index: Compound unique index `{ sessionId: 1, order: 1 }` with name `interview_questions_session_order_unique`.

---

## 5. Candidate Security Boundary & DTO Sanitization

Candidate privacy and assessment integrity are enforced at the HTTP boundary via `toCandidateSafeInterviewSession`:
1. **Forbidden Properties**: `sourceType`, `questionBankQuestionId`, `questionBankVersionId`, `questionBankVersionNumber`, `questionBankCode`, `selectionPolicyVersion`, `selectionSeedFingerprint`, `promptSnapshotHash`, and `selectedAt` are strictly excluded from all candidate DTOs.
2. **Input Isolation**: `interviewCreateSchema` uses Zod `.strict()`, rejecting any candidate attempts to supply `questionSourceMode`, `questionBankQuestionId`, or arbitrary injection properties with HTTP 400.
3. **SSE Stream Safety**: The SSE endpoint (`/api/v1/interviews/:id/stream`) emits only `{ status: "..." }` state change notifications.

---

## 6. Concurrency, Idempotency & Legacy Data Safety

1. **Duplicate Delivery & Idempotency**: If a generation job is retried or re-delivered for a session that already has 5 committed questions, the orchestrator returns `IDEMPOTENT_NOOP` with exit code 0 and existing questions without re-generating.
2. **Concurrent Workers**: In a race between concurrent workers, MongoDB transaction / atomic CAS guarantees exactly one worker commits questions; competing workers encounter CAS mismatch and cleanly abort without double-insertion.
3. **Inconsistent State Guard**: If a session is found with 1 to 4 questions (e.g. legacy partial write), generation immediately halts with `INCONSISTENT_STATE` (HTTP 409) preserving existing records untouched.

---

## 7. Configuration & Environment Variables

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED` | boolean | `false` | Global feature flag. When false, forces AI_ONLY mode. |
| `INTERVIEW_QUESTION_SOURCE_MODE` | enum | `AI_ONLY` | Sourcing mode: `AI_ONLY`, `SHADOW`, `BANK_ONLY`, `HYBRID`. |
| `INTERVIEW_QUESTION_BANK_POLICY_VERSION` | string | `v1` | Policy algorithm version tag. |
| `INTERVIEW_QUESTION_BANK_HYBRID_BANK_COUNT` | number | `2` | Number of questions sourced from Question Bank in HYBRID mode (1-4). |
| `INTERVIEW_QUESTION_BANK_SHADOW_TIMEOUT_MS` | number | `3000` | Bounded timeout for shadow selection execution in milliseconds. |
| `INTERVIEW_QUESTION_BANK_ALLOW_FALLBACK_TO_AI` | boolean | `true` | When true, hybrid mode falls back to AI top-up on insufficient bank pool. |
| `INTERVIEW_QUESTION_BANK_SEED_SALT` | string | `default-salt` | Additional salt for deterministic seed hashing. |

---

## 8. Verification Matrix & Evidence

| Suite | File | Tests | Result |
| :--- | :--- | :--- | :--- |
| Unit Tests | `tests/interview-question-source.unit.test.ts` | 18 | Passed |
| Contract Tests | `tests/interview-question-source.contract.test.ts` | 7 | Passed |
| Concurrency & Persistence | `tests/interview-generation-concurrency.integration.test.ts` | 6 | Passed |
| Security & Regression | `tests/interview-security-regression.integration.test.ts` | 6 | Passed |
| Full Backend Regression | `npm test` | 286 | Passed (21 files) |
| OpenAPI Contract | `npm run test:contract` | 5 | Passed |
| Client Lint & Build | `npm --prefix client run lint && build` | - | Passed (0 errors) |
| Client QB Unit | `npm --prefix client test src/features/QuestionBank` | 41 | Passed (10 files) |
