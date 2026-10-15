# Question Bank — AIP-62 Phase 1, AIP-63 Phase 2, and AIP-64 Phase 3

> Reconstruction notice: this directory did not exist on the working branch when AIP-62 started. These documents were reconstructed on 2026-09-10 from the approved AIP-62 delivery contract and the repository's running conventions. They are the initial contract baseline, not a claim that earlier Question Bank documentation existed.

This bounded context provides the foundation and governed Admin workflow for a versioned Question Bank. Phase 1 supports incomplete Drafts; Phase 2 adds explicit review, approval, publish/supersede, and reversible retirement; Phase 3 delivers advanced operations: deterministic selection simulation, taxonomy coverage metrics & gap detection, governance analytics, formula-safe batch import/export, and AI-assisted draft generation without connecting the bank to Interview runtime.

## Independence guarantee

Question Bank is isolated under `/api/v1/admin/question-bank`. It does not read, write, select, replace, or reorder questions in an Interview, including the current flow that creates five interview questions. Enabling its feature flags exposes only Admin Question Bank operations. Any Interview integration requires a separate approved delivery and regression coverage for fixed-count Interview generation.

## Phase 1 surface

- Domain policies for lifecycle, version mutability, canonical content hashing, taxonomy normalization, and rubric validation.
- Separate MongoDB `questions`, `question_versions`, and `question_reviews` foundations, plus sequence, idempotency, and outbox records.
- Eight authenticated Admin operations under `/api/v1/admin/question-bank`.
- Admin list, bilingual editor, rubric authoring, safe candidate preview, serialized autosave, and optimistic-concurrency conflict handling.
- Safe-off API/UI feature flags, capability resolution, contract tests, and an opt-in synthetic benchmark generator.

## Phase 2 surface

- Complete stored snapshots move through submit, four-eyes review, approval, publish, and atomic supersede transitions.
- Review queue DTOs remain summary-only; review detail is read-only and exposes immutable decision history plus server-authorized actions.
- Retire/restore preserves all snapshots, pointers, audits, and outbox history.
- Seven additional Admin operations, named indexes, OpenAPI contracts, and accessible queue/detail/editor controls are implemented behind the existing safe-off flags.

## Phase 3 surface

- Deterministic question selection simulation with Mulberry32 PRNG seed and pool diagnostics.
- Taxonomy coverage metrics and gap detection across Role, Level, and Technology dimensions.
- Governance analytics, distribution breakdown, and daily activity timeline.
- Batch import with dry-run validation, atomic transaction, and IMPORTED draft creation.
- Batch export in JSON and RFC 4180 CSV format with Formula Injection protection.
- AI-assisted draft generation creating AI_ASSISTED draft with mockable provider.
- Four new Admin pages (`Selection`, `Analytics`, `ImportExport`, `AiAssistant`) with unified tab navigation.

## Phase 4 surface

- Controlled bilingual translation between VI and EN with side-by-side diff preview and explicit overwrite confirmation guard.
- Production-safe vector embeddings in isolated `question_embeddings` collection with unique compound index and bounded cursor-based backfill engine.
- Advisory semantic duplicate detection combining exact prompt fingerprinting and cosine similarity, returning non-blocking advisory results with taxonomy overlap.
- Zero raw embedding vector or sensitive answer leakage in public DTOs.
- Fail-closed production Gemini adapters with untrusted content delimiter isolation and full deterministic mock provider support.

## Phase 5 surface

- Server-side question sourcing policy with safe-off rollback (`AI_ONLY`, `SHADOW`, `BANK_ONLY`, `HYBRID`).
- Exact-5 invariant persisting either exactly 5 questions or 0 questions atomically.
- Deterministic sampling with Mulberry32 PRNG seed and difficulty quotas (1 Easy, 2 Medium, 2 Hard).
- Immutable provenance recording question snapshot hash, question bank IDs, version number, policy version, and seed fingerprint.
- Strict candidate privacy boundary stripping provenance, version IDs, hashes, and vector data from all candidate responses and SSE stream.
- Concurrent generation and idempotent duplicate delivery safety with unique compound indexing `{ sessionId: 1, order: 1 }`.

## Phase 6 surface

- Comprehensive release qualification covering all source modes (`AI_ONLY`, `SHADOW`, `BANK_ONLY`, `HYBRID`) and exact-five persistence invariants.
- Concurrency race resilience, duplicate job delivery idempotency, and fault injection validation across database, AI, and event publishers.
- Rigorous candidate privacy boundary testing with recursive assertion of zero internal provenance leakage.
- Automated WCAG 2.1 AA accessibility test suite for Admin Question Bank and Candidate interview surfaces.
- Scalable performance and benchmark verification (1,000 and 10,000 pool selection, concurrent session execution, bounded shadow timeout).
- Strict coverage gates satisfied (88.99% branch coverage on Question Source critical paths; 92.80% backend lines, 86.95% backend branches, 81.15% client lines, 71.45% client branches).
- Pre-existing client test harness defect resolved in `InterviewSetupForm.test.tsx` via `MemoryRouter`.
## Phase 7 surface

- Server-side deterministic percentage canary rollout (`INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT=100`, `INTERVIEW_QUESTION_BANK_ROLLOUT_SALT=qb-rollout-salt`).
- Zero-controllability cohort expansion ensuring monotonic cohort sizing and candidate tamper immunity.
- Non-sensitive operational telemetry persisting structured metadata (`QuestionSourcingEvent`) with strict anti-leak boundary.
- Admin metrics extension providing additive `questionSourcing` section protected by `authenticate + requireAdmin`.
- Read-only rollout preflight diagnostic runner (`scripts/question-bank-rollout-preflight.ts`).
- Controlled, non-destructive database index migration script with default verify-only mode (`scripts/question-bank-migration-indexes.ts`).
- Vendor-neutral Service Level Objectives (SLOs), error budgets, and P0–P3 alert severity definitions.
- Progressive canary rollout runbook covering Gate 0 (Blocked) through Gate 4 (BANK_ONLY).
- Primary (`INTEGRATION_ENABLED=false`) and secondary (`ROLLOUT_PERCENT=0`) kill switches and automated rollback drill.
- Post-rollout read-only reconciliation suite (`scripts/question-bank-rollout-reconciliation.ts`).

## Documents

- [Product requirements](./01-product-requirements.md)
- [Domain and data design](./02-domain-data-design.md)
- [API and application design](./03-api-application-design.md)
- [AIP-62 baseline and decisions](./04-aip-62-baseline-and-decisions.md)
- [Security, governance, and operations](./05-security-governance-operations.md)
- [Delivery and test plan](./06-delivery-test-plan.md)
- [ADR: versioned snapshots](./07-adr-versioned-question-snapshots.md)
- [Content authoring handbook](./08-content-authoring-handbook.md)
- [Admin user guide](./09-admin-user-guide.md)
- [AIP-63 Phase 2 governance and delivery contract](./10-aip-63-phase-2-governance-and-delivery.md)
- [AIP-64 Phase 3 advanced operations and delivery contract](./11-aip-64-phase-3-advanced-operations.md)
- [AIP-65 Phase 4 AI translation, embeddings and semantic duplicate contract](./12-aip-65-phase-4-ai-translation-embeddings-semantic-duplicates.md)
- [AIP-66 Phase 5 safe interview integration contract](./13-aip-66-phase-5-safe-interview-integration.md)
- [AIP-67 Phase 6 release qualification](./14-aip-67-phase-6-release-qualification.md)
- [AIP-68 Phase 7 production rollout, observability & safety](./15-aip-68-phase-7-production-rollout.md)
- [OpenAPI contract](./openapi-question-bank.yaml)

## Feature flags

All new production entry points are safe by default:

```text
QUESTION_BANK_ADMIN_API_ENABLED=false
QUESTION_BANK_ADMIN_UI_ENABLED=false
QUESTION_BANK_REVIEW_FOUR_EYES=true
QUESTION_BANK_AI_TRANSLATION_ENABLED=false
QUESTION_BANK_SEMANTIC_DUPLICATES_ENABLED=false
QUESTION_BANK_EMBEDDING_BACKFILL_ENABLED=false
QUESTION_BANK_AI_PROVIDER=gemini
QUESTION_BANK_TRANSLATION_MODEL=gemini-2.5-flash
QUESTION_BANK_EMBEDDING_MODEL=text-embedding-004
QUESTION_BANK_EMBEDDING_DIMENSIONS=768
QUESTION_BANK_SEMANTIC_THRESHOLD=0.75
QUESTION_BANK_DUPLICATE_TOP_K=10
INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED=false
INTERVIEW_QUESTION_SOURCE_MODE=AI_ONLY
INTERVIEW_QUESTION_BANK_POLICY_VERSION=v1
INTERVIEW_QUESTION_BANK_HYBRID_BANK_COUNT=2
INTERVIEW_QUESTION_BANK_SHADOW_TIMEOUT_MS=3000
INTERVIEW_QUESTION_BANK_ALLOW_FALLBACK_TO_AI=true
INTERVIEW_QUESTION_BANK_SEED_SALT=default-salt
```

The browser receives only the UI flag via its explicitly public Vite equivalent. Backend authorization and the API kill switch remain authoritative.

## Local verification

```text
npm run test:contract
npm run benchmark:question-bank:smoke
npm run benchmark:question-bank
```

Both benchmark commands are dry-run generators unless `--write` and all disposable-database confirmations are supplied. To provision the 20 bilingual sample questions for the candidate study library, run `npm run db:seed` in a development/test database. The seeder is idempotent and skips sample questions in production unless `SEED_SAMPLE_QUESTION_BANK=true` is set explicitly.
