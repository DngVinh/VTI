# AIP-68 — Question Bank Phase 7: Production Readiness, Progressive Rollout, Observability, Migration Safety & Rollback

## 1. Executive Summary & Objective

AIP-68 (Phase 7) establishes the production rollout control-plane, progressive canary mechanisms, observability infrastructure, read-only verification preflights, safe index migrations, SLO alerts, and emergency rollback drills for the Question Bank bounded context and Interview Question Sourcing pipeline.

### Core Delivery Invariants
1. **Zero-Controllability Cohort Rollout**: Server-side deterministic percentage bucketing based on stable SHA256 hashes of `sessionId:policyVersion:salt`. Candidate requests cannot override, tamper with, or detect rollout cohort boundaries.
2. **Safe-Off Production Defaults**: `INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED=false` and `INTERVIEW_QUESTION_SOURCE_MODE=AI_ONLY` remain default. Any disabled state unconditionally forces 100% baseline AI question generation.
3. **Strict Telemetry Redaction**: Zero question prompts, candidate answers, rubrics, embeddings, CV/JD texts, or raw database ObjectIds are emitted to logs or persisted in telemetry. Session identifiers are strictly SHA256-hashed.
4. **Additive, Non-Destructive Migrations**: Zero runtime `syncIndexes()` on app startup. Index migrations are verify-only by default and require explicit manual authorization via `--apply`.
5. **Immediate Multi-Tier Kill Switch**: Primary flag toggle immediately restores `AI_ONLY` sourcing across all subsequent sessions without mutating existing interview sessions or Question Bank records.
6. **Release Qualification Status**: **BLOCKED** on Phase 6 Browser E2E runner approval. Production deployment is explicitly prohibited until dependency approval is granted.

---

## 2. Architecture & Progressive Rollout Policy

```
Incoming Generation Request (Agenda Job / Orchestrator)
                      │
                      ▼
        [1. Global Integration Enabled?]
             │                      │
            NO                     YES
             │                      │
             ▼                      ▼
        Force AI_ONLY     [2. Configured Mode AI_ONLY?]
                               │                   │
                              YES                  NO
                               │                   │
                               ▼                   ▼
                          Force AI_ONLY    [3. Rollout Percent = 0?]
                                                │               │
                                               YES              NO
                                                │               │
                                                ▼               ▼
                                           Force AI_ONLY   [4. Evaluate Cohort Bucket]
                                                                │
                                                ┌───────────────┴───────────────┐
                                                ▼                               ▼
                                     bucket < rolloutPercent         bucket >= rolloutPercent
                                                │                               │
                                                ▼                               ▼
                                       Configured Source Mode              Force AI_ONLY
                                     (SHADOW / BANK_ONLY / HYBRID)
```

### Deterministic Hash Bucketing Algorithm
- **Input**: `sessionId` (string), `policyVersion` (string), `salt` (`INTERVIEW_QUESTION_BANK_ROLLOUT_SALT`).
- **Digest**: `hash = sha256Hex("${sessionId}:${policyVersion}:${salt}")`.
- **Bucket**: `bucket = parseInt(hash.slice(0, 8), 16) % 100` (integer `0..99`).
- **Condition**: Selected into rollout cohort if and only if `bucket < rolloutPercent`.
- **Monotonic Cohort Expansion**: Because `bucket` is constant for a given session, increasing `rolloutPercent` from `5%` to `25%` strictly preserves all sessions in the 5% cohort while admitting sessions with buckets `5..24`.

---

## 3. Configuration & Environment Variables

| Variable | Type | Default | Production Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED` | boolean | `false` | `false` | Global master kill switch. When false, forces pure AI_ONLY. |
| `INTERVIEW_QUESTION_SOURCE_MODE` | enum | `AI_ONLY` | `AI_ONLY` | Sourcing target mode: `AI_ONLY`, `SHADOW`, `BANK_ONLY`, `HYBRID`. |
| `INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT` | integer (0..100) | `100` | `0` | Canary percentage. When omitted or 100, selects 100% of sessions. 0 disables non-AI modes. |
| `INTERVIEW_QUESTION_BANK_ROLLOUT_SALT` | string | `qb-rollout-salt` | `prod-qb-rollout-salt-v1` | Rollout hash salt ensuring distinct cohorts per release policy. |
| `QUESTION_SOURCING_TELEMETRY_ENABLED` | boolean | `true` | `true` | Structured telemetry persistence switch. |
| `QUESTION_SOURCING_EVENT_RETENTION_DAYS` | integer (7..365) | `90` | `90` | Documented retention window for operational telemetry events. |
| `INTERVIEW_QUESTION_BANK_POLICY_VERSION` | string | `v1` | `v1` | Algorithm policy tag for audit reproducibility. |
| `INTERVIEW_QUESTION_BANK_HYBRID_BANK_COUNT` | integer (1..5) | `2` | `2` | Quota of questions allocated from Question Bank in HYBRID mode. |
| `INTERVIEW_QUESTION_BANK_SHADOW_TIMEOUT_MS` | integer (500..30000) | `3000` | `3000` | Bounded execution timeout ceiling for SHADOW bank selector. |
| `INTERVIEW_QUESTION_BANK_ALLOW_FALLBACK_TO_AI` | boolean | `true` | `true` | Fail-safe fallback to AI questions if bank pool is insufficient. |

---

## 4. Telemetry Schema & Anti-Leak Redaction Boundary

### Telemetry Model: `QuestionSourcingEvent` (`questionsourcingevents`)
All operational generation events are persisted via `QuestionSourcingTelemetryService`.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `eventId` | string | Unique identifier (`qse_<uuid>`). |
| `sessionHash` | string | SHA256 hex digest of `sessionId` (64 chars). Raw session ObjectId is strictly redacted. |
| `eventType` | enum | `ATTEMPT`, `SUCCESS`, `FAILURE`, `IDEMPOTENT_NOOP`, `CONFLICT`, `INCONSISTENT_STATE`. |
| `effectiveMode` | enum | `AI_ONLY`, `SHADOW`, `BANK_ONLY`, `HYBRID`. |
| `configuredMode` | enum | Configured target mode at execution time. |
| `rolloutPercent` | number | Configured rollout percent (0..100). |
| `isCohortSelected` | boolean | Whether session bucket fell within rollout percent. |
| `rolloutBucket` | number | Deterministic hash bucket (0..99). |
| `policyVersion` | string | Sourcing policy version (`v1`). |
| `durationMs` | number | Total pipeline elapsed time in milliseconds. |
| `bankQuestionCount` | number | Number of questions sourced from Question Bank (0..5). |
| `aiQuestionCount` | number | Number of questions generated via AI (0..5). |
| `fallbackOccurred` | boolean | Flag indicating whether HYBRID fallback to AI took place. |
| `fallbackReasonCode` | string \| null | Allowlisted error code if fallback occurred. |
| `poolInsufficient` | boolean | True if pool lacked required difficulty quota. |
| `shadowSuccess` | boolean \| null | Status of shadow selection run. |
| `shadowTimeout` | boolean | True if shadow selection hit bounded ceiling. |
| `bundleValid` | boolean | True if exact-five bundle passed validation. |
| `exactFiveViolated` | boolean | Critical violation flag (true if persisted count !== 5). |
| `tokens` | object | `{ promptTokens, candidatesTokens, totalTokens }`. |
| `reasonCode` | string \| null | Canonical safe error code. |
| `createdAt` | Date | Timestamp of event. |

### Prohibited Fields Boundary
The schema enforces `strict: 'throw'`. The following properties are forbidden from telemetry:
- Question contents, localized prompts, titles, or descriptions.
- Candidate answers, transcripts, or uploaded CV/JD texts.
- Reference answers, rubrics, evaluation criteria, or solution guides.
- Embeddings, vector arrays, similarity scores, or model weights.
- Raw AI provider request/response dumps or debug stack traces.
- Question Bank entity IDs (`questionBankQuestionId`, `questionBankVersionId`).
- User PII, raw user IDs, emails, auth tokens, or cookies.

---

## 5. Admin Metrics Endpoint (`GET /api/v1/admin/metrics`)

### Access Control
- `authenticate` middleware (requires valid Bearer JWT).
- `requireAdmin` middleware (strictly enforces `role === 'ADMIN'`).
- Candidate or unauthenticated requests are rejected with `403` or `401`.

### Additive Response Contract
Bounded query parameters: `?from=YYYY-MM-DDTHH:mm:ss.sssZ&to=YYYY-MM-DDTHH:mm:ss.sssZ`.
The endpoint returns:
```json
{
  "success": true,
  "data": {
    "users": { "total": 100, "active": 95, "locked": 2, "inactive": 3 },
    "interviews": {
      "total": 50,
      "byStatus": { "PENDING": 0, "GENERATING": 0, "IN_PROGRESS": 10, "EVALUATING": 0, "COMPLETED": 38, "FAILED": 2 },
      "promptTokens": 15000,
      "candidatesTokens": 7500,
      "totalTokens": 22500
    },
    "questionSourcing": {
      "totalEvents": 120,
      "attempts": 55,
      "successes": 50,
      "failures": 2,
      "idempotentNoops": 3,
      "conflicts": 0,
      "inconsistentStates": 0,
      "exactFiveViolations": 0,
      "byEffectiveMode": { "AI_ONLY": 20, "SHADOW": 10, "BANK_ONLY": 0, "HYBRID": 20 },
      "cohortSelectionRate": 60.00,
      "totalSelectedFromBank": 40,
      "totalSelectedFromAi": 210,
      "fallbackCount": 1,
      "poolInsufficientCount": 1,
      "shadowTimeoutCount": 0,
      "shadowFailureCount": 0,
      "latency": { "avgMs": 142, "p95Ms": 310 },
      "tokens": { "promptTokens": 15000, "candidatesTokens": 7500, "totalTokens": 22500 }
    }
  }
}
```

---

## 6. Service Level Objectives (SLOs), Error Budgets & Alerts

### Invariant SLOs
| Metric | Objective | Window | Error Budget |
| :--- | :--- | :--- | :--- |
| **Exact-Five Violations** | `0` violations | Permanent | 0 (Immediate P0) |
| **Candidate Provenance Leak** | `0` leaked internal fields | Permanent | 0 (Immediate P0) |
| **Duplicate Token Charging** | `0` double-charged retries | 30 days | 0 (Immediate P1) |
| **Partial Bundle Writes** | `0` sessions with 1–4 questions | Permanent | 0 (Immediate P0) |

### Operational SLOs
| Dimension | Metric | SLO Target | Alert Threshold |
| :--- | :--- | :--- | :--- |
| **Availability** | Generation Success Rate | `>= 99.5%` | `< 99.0%` over 15m (P1) |
| **Latency (AI_ONLY)** | Generation Duration p95 | `< 2500 ms` | `> 4000 ms` over 15m (P2) |
| **Latency (HYBRID)** | Generation Duration p95 | `< 2000 ms` | `> 3500 ms` over 15m (P2) |
| **Quality (HYBRID)** | Fallback to AI Rate | `< 5.0%` | `> 10.0%` over 1h (P2) |
| **Shadow Quality** | Shadow Evaluation Timeout Rate | `< 1.0%` | `> 2.0%` over 1h (P2) |
| **Coverage** | Taxonomy Quota Deficiencies | `0` hot taxonomies | `> 0` hot taxonomies (P3) |

### Alert Severity Matrix
- **P0 (Critical Data Integrity / Security)**:
  - Trigger: Candidate provenance leak, exact-five violation, or partial database commit.
  - Action: Immediate automatic kill switch (`INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED=false`). PagerDuty on-call dispatch.
- **P1 (High Availability / Reliability Spike)**:
  - Trigger: Generation failure rate > 1.0%, CAS concurrency conflict spike, database transaction rollback storm.
  - Action: Rollback cohort percent to `0%` (`INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT=0`). Investigate error logs.
- **P2 (Quality & Latency Degradation)**:
  - Trigger: Fallback rate > 10%, shadow timeout rate > 2%, p95 latency regression > 500ms above baseline.
  - Action: Halt canary progression. Operator review within observation window.
- **P3 (Telemetry & Taxonomy Maintenance)**:
  - Trigger: Embedding backfill backlog > 50, missing bilingual versions in long-tail categories.
  - Action: Scheduled ticket for Question Bank curators.

---

## 7. Read-Only Preflight Procedure

Before any deployment or stage transition, operators execute:
```bash
npx tsx scripts/question-bank-rollout-preflight.ts
```

### Preflight Verification Scope
1. Active Question Bank questions & published version mappings.
2. Missing or dangling `currentPublishedVersionId` references.
3. Duplicate published versions per question.
4. Bilingual prompt completeness (`prompt.vi` and `prompt.en`).
5. Difficulty distribution (ensures >= 1 Easy, >= 2 Medium, >= 2 Hard per active role).
6. Unique compound index `{ sessionId: 1, order: 1 }` on `interviewquestions`.
7. Session consistency: scans for anomalous sessions with 1–4 or >5 questions.
8. Operational telemetry collection readiness.

---

## 8. Database Index Migration Runbook

Database index creation is completely decoupled from application startup.

### Verification Mode (Default, Read-Only)
```bash
npx tsx scripts/question-bank-migration-indexes.ts
```
Reports whether required indexes exist (`PRESENT` vs `MISSING`) without performing any write operation.

### Apply Mode (Requires Explicit Authorization)
```bash
npx tsx scripts/question-bank-migration-indexes.ts --apply
```
Safely applies:
1. `interviewquestions`: `interview_questions_session_order_unique` on `{ sessionId: 1, order: 1 }` (`unique: true`).
2. `questionsourcingevents`: `qse_created_event_type_idx` on `{ createdAt: -1, eventType: 1 }`.
3. `questionsourcingevents`: `qse_created_mode_idx` on `{ createdAt: -1, effectiveMode: 1 }`.
4. `questionsourcingevents`: `qse_ttl_retention_idx` on `{ createdAt: 1 }` (`expireAfterSeconds: 7776000` - 90 days).

---

## 9. Progressive Rollout Runbook (Stage Gates)

### Gate 0 — Blocked Gate (Current State)
- **Status**: **BLOCKED**
- **Reason**: Phase 6 Browser E2E runner is not installed (`@playwright/test` pending explicit approval).
- **Action**: Zero production rollout permitted. All environment configurations maintain safe defaults.

### Gate 1 — Safe-Off Deployment
- **Prerequisites**: Code deployed to production with `INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED=false`.
- **Config**: `INTERVIEW_QUESTION_SOURCE_MODE=AI_ONLY`, `INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT=0`.
- **Validation**: 100% sessions use AI generator; Admin metrics report 0 bank queries.

### Gate 2 — SHADOW Canary
- **Prerequisites**: Gate 1 stable for >= 24 hours. Preflight report returns `GO_READY`.
- **Config**: `INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED=true`, `INTERVIEW_QUESTION_SOURCE_MODE=SHADOW`.
- **Progression**:
  - Step 2.1: `ROLLOUT_PERCENT=5` (Observe 2 hours, verify shadow latency < 200ms, shadow timeout < 0.5%).
  - Step 2.2: `ROLLOUT_PERCENT=25` (Observe 4 hours).
  - Step 2.3: `ROLLOUT_PERCENT=50` (Observe 4 hours).
  - Step 2.4: `ROLLOUT_PERCENT=100` (Observe 24 hours).
- **Persisted Questions**: 100% from AI. Candidate experience is completely unaffected.

### Gate 3 — HYBRID Canary
- **Prerequisites**: Gate 2 completed with shadow success rate >= 99.0%.
- **Config**: `INTERVIEW_QUESTION_SOURCE_MODE=HYBRID`, `INTERVIEW_QUESTION_BANK_HYBRID_BANK_COUNT=2`.
- **Progression**:
  - Step 3.1: `ROLLOUT_PERCENT=1` (Canary test cohort, observe 1 hour).
  - Step 3.2: `ROLLOUT_PERCENT=5` (Observe 2 hours, monitor fallback rate < 3%).
  - Step 3.3: `ROLLOUT_PERCENT=25` (Observe 6 hours).
  - Step 3.4: `ROLLOUT_PERCENT=50` (Observe 12 hours).
  - Step 3.5: `ROLLOUT_PERCENT=100` (Full production hybrid sourcing).

### Gate 4 — BANK_ONLY Mode
- **Policy**: Restricted to specific assessment tracks with verified 100% difficulty pool sufficiency. Requires Product Director sign-off.

---

## 10. Emergency Kill Switch & Rollback Procedures

### Primary Kill Switch (Immediate AI_ONLY Restoration)
Set environment variable:
```bash
INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED=false
```
- **Effect**: Next generation job immediately executes `AI_ONLY`.
- **Integrity**: Existing sessions keep original questions and provenance. No database mutations.

### Secondary Kill Switch (Instant 0% Canary Evacuation)
Set environment variable:
```bash
INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT=0
```
- **Effect**: Excludes 100% of new sessions from non-AI modes while preserving deployed code.

---

## 11. Post-Rollout Reconciliation Procedure

Operators periodically run post-rollout reconciliation:
```bash
npx tsx scripts/question-bank-rollout-reconciliation.ts
```
The script performs read-only cross-verification:
- Computes exact-five session count vs total sessions.
- Validates question bank vs AI generation distribution.
- Verifies every Question Bank question references an existing `Question` and `QuestionVersion`.
- Asserts zero missing provenance on bank questions.
- Reports `verdict: 'HEALTHY'` and `recommendedAction: 'CONTINUE_ROLLOUT'`, or triggers `TRIGGER_KILL_SWITCH_AND_INVESTIGATE` if corruption is found.

---

## 12. Release Qualification Statement

> **Phase 7 production-readiness implementation completed, but production rollout remains BLOCKED because Phase 6 Browser E2E qualification has not passed. No production configuration, migration, traffic, deployment, or external resource was changed.**
