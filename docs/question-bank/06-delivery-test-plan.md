# Delivery and test plan

> Reconstruction notice: this plan was reconstructed from the AIP-62 acceptance contract because no earlier Question Bank test plan was available.

## Test layers

### Backend unit

- State mutability and future transition definitions.
- Unicode/line-ending/key-order canonicalization and deterministic SHA-256 hashing.
- Rubric, tag, taxonomy, and partial-Draft validation.
- ETag generation/parsing/mismatch.
- Idempotency fingerprint and key-reuse behavior.
- DTO negative-disclosure tests.
- Search escaping and sort/filter allowlists.

### Backend integration and API

Use a uniquely named `MongoMemoryReplSet` database per run/worker. Test indexes with model initialization and index inspection; never use a shared database or production `syncIndexes()`.

Cover transaction success/abort, concurrent sequence/version creation, idempotency replay/reuse/concurrency, list semantics, details/history, ETag updates, missing/malformed/stale preconditions, immutable statuses, strict invalid inputs, role matrix, flags, request IDs, no-store, generic production 500, and restricted-field omissions.

### Frontend unit/component

Use Vitest, jsdom, Testing Library, `MemoryRouter`, fake timers where appropriate, and controlled fetch promises. Cover URL state/reset, all list states, enum fallbacks, partial editor, rubric interactions, validation/focus, serialized autosave, ETag/conflict behavior, navigation guard, safe preview, feature/role routes, labels, keyboard flow, and `aria-live` status.

### Browser E2E

Required scenarios are Admin create/edit/reload, URL filter state, two-context conflict, denied Candidate/Interviewer access, and disabled feature behavior. At reconstruction time the repository has no browser E2E runner. These checks cannot be claimed as passed until an approved runner and browser binaries are installed and executed.

## Coverage gates

- New domain/service/repository/mapper code: target at least 85% meaningful line and branch coverage.
- Overall project threshold: at least 70% lines/statements/functions/branches.
- Both backend and client coverage include allowlists at baseline; the Question Bank paths must be added so the gate actually measures them.

## Commands

```text
npm run build
npm test
npm run test:coverage
npm run test:contract
npm --prefix client run lint
npm --prefix client run test
npm --prefix client run test:coverage
npm --prefix client run build
npm run benchmark:question-bank:smoke
git diff --check
git status --short
```

Run the browser E2E command only after the runner exists. Do not add a fake `test:e2e` script that executes unit tests.

First execution of `mongodb-memory-server` may need to acquire a Mongo binary. Dependency installation and binary download require explicit environment/network permission. Test databases must be local, disposable, uniquely named, and owned by the run.

### Contract tests

`tests/openapi-question-bank.contract.test.ts` parses the JSON-compatible YAML and validates the operation inventory (25 operations implemented across Phases 1–4, 0 planned), auth, mutation headers (`If-Match`, `Idempotency-Key`), response headers, strict DTO schemas, and stable error codes.

### Phase 4 Test Matrix

- **`tests/question-bank-phase4.domain.test.ts`**: Cosine similarity algorithm, zero-vector handling, dimension verification, discoverability canonical text construction, deterministic tie-breaking ranking, Mock provider error behaviors.
- **`tests/question-bank-phase4.integration.test.ts`**: Read-only preview translation, overwrite detection and mandatory confirmation, selective target field updates, DRAFT status validation, optimistic concurrency CAS revision enforcement, bounded embedding backfill with cursor resumption, exact fingerprint prioritization, retired question exclusion, collection isolation zero-document check.
- **`client/src/features/QuestionBank/pages/QuestionPhase4Components.test.tsx`**: TranslationModal preview/diff/apply flow with mandatory overwrite checkbox, and SemanticDuplicatePanel advisory check with similarity badges, taxonomy overlap, and non-blocking notification.

## Benchmark evidence

The smoke generator uses 1,000 Question and 3,000 version metadata records; the default uses 100,000 and 300,000. Both remain dry-run/count unless fully guarded `--write` arguments are passed. Record seed, counts, distributions, digest, elapsed time, runtime, Mongo version, and indexes. Never infer production latency from generator time.

## Failure reporting

Report the exact command, exit code, pass/fail/skip counts, and whether a failure is implementation, environment, missing dependency, or pre-existing. Do not delete, skip, loosen, or rewrite unrelated tests to obtain a green run.

## Execution evidence (2026-09-10)

- `npm run build`: passed.
- `npm test`: 11 files and 187 tests passed (the final equivalent full run was executed with coverage enabled).
- `npm run test:coverage`: passed the configured gate with 86.41% lines, 84.54% statements, 89.31% functions, and 71.62% branches. Question Bank domain coverage was 95.39% lines and 83.17% branches; branch-heavy repository and service paths remain the main follow-up coverage area.
- `npm run test:contract`: 5 OpenAPI contract tests passed.
- `npm --prefix client run lint` and `npm --prefix client run build`: passed.
- Targeted client Question Bank, feature-flag, and Home-page regression run: 9 files and 31 tests passed.
- Client coverage excluding the unrelated pre-existing `InterviewSetupForm` test file: 16 files and 76 tests passed, with 91.61% lines, 89.87% statements, 88.01% functions, and 78.65% branches. The Question Bank group measured 96.77% lines and 74.02% branches.
- Full `npm --prefix client run test`: 16 files and 76 tests passed; 4 pre-existing `InterviewSetupForm` tests failed because they render a hook using `useNavigate` without a Router. No Interview Setup runtime or test file was changed for this delivery.
- `npm run benchmark:question-bank:smoke`: generated the deterministic 1,000-question/3,000-version dry-run shape in 49 ms with digest `0f76b00cfc95915ceb1e0aef72719d0dc90a32790828e0e647f3dc292aea7aff`. This is generator evidence only, not database latency evidence.
- Browser E2E was not executed because this repository has no browser runner or installed browser harness. The mandatory scenarios in the Browser E2E section remain an explicit delivery gap and are not represented as passed.

## AIP-63 Phase 2 execution evidence (2026-09-10)

- `npm run build`: passed.
- `npm test`: 13 files and 203 tests passed.
- `npm run test:coverage`: passed with 87.19% lines, 85.16% statements, 89.75% functions, and 72.08% branches.
- `npm run test:contract`: 5 OpenAPI contract tests passed against 15 implemented and 6 planned operations.
- `npm --prefix client run lint` and `npm --prefix client run build`: passed.
- Targeted Question Bank UI run: 2 files and 11 tests passed. Its coverage execution passed all selected tests but exited non-zero on the global 70% gate because unrelated unselected client modules remain in the coverage allowlist; the new queue/detail pages measured 100% and 81.69% lines respectively.
- Full `npm --prefix client test`: 17 files and 80 tests passed; the same 4 pre-existing `InterviewSetupForm` tests failed because `useNavigate` is rendered without a Router. AIP-63 did not change Interview runtime or those tests.
- `npm run benchmark:question-bank:smoke`: deterministic 1,000-question/3,000-version dry run completed in 49 ms with digest `0f76b00cfc95915ceb1e0aef72719d0dc90a32790828e0e647f3dc292aea7aff`.
- Browser E2E remains unavailable; no browser result is claimed. No seed/reset command was executed.

## AIP-64 Phase 3 execution evidence (2026-09-11)

- `npm run build`: passed (backend TypeScript compilation exit code 0).
- `npm test`: 15 test files and 225 tests passed (including 8 Phase 3 domain tests and 14 Phase 3 integration tests).
- `npm run test:contract`: 5 OpenAPI contract tests passed against all 21 implemented operations (0 planned operations remaining).
- `npm --prefix client run lint`: passed with 0 errors and 0 warnings.
- `npm --prefix client run build`: passed (exit code 0, client production build succeeded).
- Targeted Question Bank UI run: `npm test -- src/features/QuestionBank` in client: 9 files and 37 tests passed (including `QuestionPhase3Pages.test.tsx` verifying Selection, Analytics, ImportExport, and AiAssistant pages).
- Full `npm --prefix client test`: 18 files and 84 tests passed; the same 4 pre-existing `InterviewSetupForm` tests failed because `useNavigate` is rendered without a Router (no Interview runtime or test was touched).
- Isolation verification: `tests/question-bank-phase3.integration.test.ts` explicitly verified `InterviewSessionModel` and `InterviewQuestionModel` collections remain 0 documents before and after Phase 3 API calls.

## AIP-65 Phase 4 execution evidence (2026-09-11)

- `npm run build`: passed (backend TypeScript compilation exit code 0).
- `npm test`: 17 test files and 249 tests passed (including 11 Phase 4 integration tests).
- `npm run test:contract`: 5 OpenAPI contract tests passed against all 25 implemented operations (0 planned operations remaining).
- `npm --prefix client run lint`: passed with 0 errors and 0 warnings.
- `npm --prefix client run build`: passed (exit code 0, client production build succeeded).
- Targeted Question Bank UI run: `npm test -- src/features/QuestionBank` in client: 10 files and 41 tests passed (including `QuestionPhase4Components.test.tsx` verifying AI translation preview/diff and duplicate detection).

## AIP-66 Phase 5 execution evidence (2026-09-11)

- `npm run build`: passed (backend TypeScript compilation exit code 0).
- `npm test`: 21 test files and 286 tests passed (including 18 unit tests, 7 contract tests, 6 concurrency integration tests, and 6 security regression integration tests).
- `npm run test:contract`: 5 OpenAPI contract tests passed.
- `npm --prefix client run lint`: passed with 0 errors.
- `npm --prefix client run build`: passed (exit code 0, client production build succeeded).
- Targeted Question Bank UI run: `npm test -- src/features/QuestionBank` in client: 10 files and 41 tests passed.
- Concurrency and Idempotency: `tests/interview-generation-concurrency.integration.test.ts` verified 10 iterations of concurrent workers without double-insertion, duplicate delivery returning IDEMPOTENT_NOOP, partial legacy state aborting with INCONSISTENT_STATE, and immutable prompt snapshots upon Question Bank version publish / retirement.
- Security and Rollback: `tests/interview-security-regression.integration.test.ts` verified rejection of candidate-supplied sourcing parameters (Zod 400), full candidate DTO sanitization (zero leakage of provenance, QB IDs, hashes, or vectors), safe-off flag forcing pure AI sourcing with 0 Question Bank queries, and end-to-end interview lifecycle (create -> generate -> stream -> progress -> submit -> evaluate).

## AIP-67 Phase 6 execution evidence (2026-09-11)

- `npm run build`: passed (backend TypeScript compilation exit code 0).
- `npm test`: 26 test files and 375 tests passed (100% pass rate across unit, integration, contract, security anti-leak, mode matrix, fault injection, and performance suites).
- `npm run test:coverage`: passed all thresholds with 92.80% lines, 92.53% statements, 95.19% functions, and 86.95% branches. Question Source critical paths measured 88.99% branch coverage (299/336 branches), exceeding the 85% requirement.
- `npm run test:contract`: 5 OpenAPI contract tests passed.
- `npm --prefix client run lint`: passed with 0 errors and 0 warnings.
- `npm --prefix client run test`: 21 test files and 98 tests passed (including automated WCAG 2.1 AA accessibility suite and resolved `InterviewSetupForm` router harness).
- `npm --prefix client run test:coverage`: passed all client thresholds with 81.15% lines, 79.98% statements, 76.23% functions, and 71.45% branches.
- `npm --prefix client run build`: passed (Vite production build succeeded with exit code 0).
- `npm run benchmark:question-bank:smoke`: deterministic 1,000-question/3,000-version dry run completed in 53 ms with digest `0f76b00cfc95915ceb1e0aef72719d0dc90a32790828e0e647f3dc292aea7aff`.
- `git diff --check`: passed (0 whitespace errors or conflict markers).
- Scope A (Mode & Exact-Five Matrix): `tests/interview-mode-matrix.integration.test.ts` verified all 8 scenarios across `AI_ONLY`, `SHADOW`, `BANK_ONLY`, and `HYBRID` modes.
- Scope B (Reliability & Fault Injection): `tests/interview-reliability-fault-injection.integration.test.ts` verified concurrency (10 parallel workers), retry idempotency, write concern failure rollback, AI provider failure handling, and event publishing failure decoupling.
- Scope C (Security & Candidate Anti-Leak): `tests/interview-security-antileak.integration.test.ts` verified complete candidate DTO and SSE stream sanitization (0 internal provenance leakage) and rejection of candidate-supplied source parameters.
- Scope E (Accessibility): `client/src/test/accessibility.test.tsx` verified semantic table headers, live regions, fieldsets, and labeled controls.
- Scope F (Performance & Scalability): `tests/interview-question-source.performance.test.ts` verified sub-50ms 1k pool, sub-200ms 10k pool, concurrent session throughput, and bounded memory delta.
- Browser E2E Evaluation: repository lacks browser E2E test dependencies (`@playwright/test` / `cypress`). Strict authorization boundary preserved; mandatory blocker recorded: *"Phase 6 implementation and non-browser qualification completed; Browser E2E remains blocked on explicit dependency/browser approval. Phase 6 is not fully release-qualified."*

## AIP-68 Phase 7 execution evidence (2026-09-11)

- `npm run build`: passed (backend TypeScript compilation exit code 0).
- `npm test`: 31 test files and 404 tests passed (100% pass rate across unit, integration, contract, security anti-leak, rollout policy, observability, preflight, rollback, and reconciliation suites).
- `npm run test:contract`: 5 OpenAPI contract tests passed against all 25 operations.
- `npm --prefix client run lint`: passed with 0 errors and 0 warnings.
- `npm --prefix client run test`: 21 test files and 98 tests passed.
- `npm --prefix client run build`: passed (Vite production build succeeded with exit code 0).
- `npm run benchmark:question-bank:smoke`: deterministic 1,000-question/3,000-version dry run completed in 50 ms with digest `0f76b00cfc95915ceb1e0aef72719d0dc90a32790828e0e647f3dc292aea7aff`.
- `git diff --check`: passed (0 whitespace errors or conflict markers).
- Scope A (Deterministic Percentage Rollout): `tests/interview-rollout-policy.unit.test.ts` (11/11 passed) verified CRC32-based bucket assignment (0-99), uniform distribution, stable cohorting across node restarts, 0% and 100% boundaries, salt randomization, and global kill switch override.
- Scope B (Operational Telemetry & Admin Metrics): `tests/interview-rollout-observability.integration.test.ts` (7/7 passed) verified non-blocking asynchronous event capture, `strict: 'throw'` anti-leak schema rejection of prompts/rubrics/embeddings, SHA-256 session ID anonymization, Admin metrics aggregation (events count, mode distribution, fallback frequency, p50/p90/p95/p99 duration histograms), and strict endpoint authorization (401 unauthenticated, 403 candidate, 200 admin).
- Scope C & D (Read-Only Preflight & Safe Index Migration): `tests/question-bank-rollout-preflight.integration.test.ts` (6/6 passed) verified 12 invariant groups, clean state `GO_READY`, corrupted duplicate session `BLOCKED`, broken QB references `CONDITIONAL_WARNING`, and guaranteed zero-write side-effects. Index migration verified idempotent non-destructive index creation.
- Scope G (Kill Switch & Rollback Drill): `tests/interview-rollout-rollback.integration.test.ts` (2/2 passed) verified primary kill switch (`INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED=false`) instantly drops all traffic to pure AI (`AI_ONLY`) with zero Question Bank queries while maintaining immutability of existing sessions, and secondary kill switch (`INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT=0`) drains rollout cohort.
- Scope H (Post-Rollout Reconciliation): `tests/interview-rollout-reconciliation.integration.test.ts` (3/3 passed) verified read-only drift detection, exact-five invariant verification, missing provenance checks, and anomaly reporting.
- Production Rollout Qualification Conclusion: **BLOCKED**. Phase 7 production-readiness artifacts, scripts, and policies are fully verified, but end-to-end production qualification remains gated on Browser E2E runner approval (Phase 6 blocker). Zero production traffic or cloud changes authorized.


