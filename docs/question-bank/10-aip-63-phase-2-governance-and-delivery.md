# AIP-63 — Question Bank Phase 2 governance and delivery contract

- Status: implemented and locally verified
- Date: 2026-09-10
- Baseline: AIP-62 Phase 0–1 working tree, not a committed release

This document is the normative Phase 2 contract. Sections labelled **Implemented** describe runtime behavior only after the corresponding code and tests exist. Sections labelled **Planned** remain acceptance targets and must not be reported as delivered.

## Product outcome and acceptance criteria

Phase 2 adds a governed path from an authored immutable snapshot candidate to an approved, published snapshot, plus reversible Question retirement. It does not connect the bank to Interview generation.

## Isolation boundary (non-negotiable)

Question Bank is an independent Admin bounded context. AIP-63 must not change the behavior of Interview creation, including the existing flow that creates five interview questions.

- Its only backend entry point is `/api/v1/admin/question-bank`; its own route middleware, capabilities, feature flags, collections, transactions, idempotency records, review audit, and outbox events are scoped to that prefix/context.
- It must not read from, write to, select for, enrich, replace, or reorder any Interview question payload, Interview aggregate, Interview controller/service, or Interview route.
- Publishing a Question Bank version means only that the version is eligible for a **future, separately approved** selection integration. It has no effect on any existing or newly created Interview.
- The API and UI switches default to off. Enabling them exposes only Admin Question Bank operations; it does not enable any Interview integration.
- Any future use of Question Bank in Interview generation requires a separate delivery with an explicit selection policy, a compatibility/migration plan, regression tests for fixed-count generation (including five-question requests), and a user-approved change to this boundary.

Acceptance requires:

1. An author with `QUESTION_AUTHOR` can submit the current complete Draft for review.
2. A reviewer with `QUESTION_REVIEW` can list a summary-only queue, inspect one read-only snapshot with completeness findings and decision history, approve it, or return it to Draft with a required reason.
3. A publisher with `QUESTION_PUBLISH` can publish only an APPROVED complete version.
4. With `QUESTION_BANK_REVIEW_FOUR_EYES=true` (the default), every user that created or updated the Draft is excluded from approve and publish actions for that version.
5. A lifecycle manager with `QUESTION_LIFECYCLE_MANAGE` can retire or restore a Question using an aggregate ETag. Retirement preserves history and pointers; it does not delete data.
6. Every mutation is strict, preconditioned, idempotent, auditable, and emits a safe transactional outbox event.
7. No list or Candidate-facing DTO includes reference answers, rubrics, review comments, provenance, hashes, or persistence internals.
8. Published and Superseded snapshots are immutable. Publish never exposes a mutable current snapshot or two current published pointers.

## State machines

### Version workflow

```text
DRAFT --submit--> IN_REVIEW
IN_REVIEW --approve--> APPROVED
IN_REVIEW --request-changes(reason)--> DRAFT
APPROVED --request-changes(reason)--> DRAFT
APPROVED --publish--> PUBLISHED
PUBLISHED --superseded-by-publish--> SUPERSEDED
SUPERSEDED --terminal--> SUPERSEDED
```

`PUBLISHED` and `SUPERSEDED` are terminal and content-immutable. A request-changes transition increments the version revision but does not create a new snapshot; subsequent author edits remain Draft-only. A retired Question blocks submit, decision, publish, author updates, and new versions until restore.

### Aggregate lifecycle

```text
ACTIVE --retire(reason)--> RETIRED
RETIRED --restore(reason)--> ACTIVE
```

Retire/restore preserve `draftVersionId`, `currentPublishedVersionId`, version statuses, reviews, and history. Retired content is unavailable to future selection work even if a published pointer is retained.

## Capability matrix

| Capability | Backend-authorized actions |
|---|---|
| `QUESTION_READ` | Question list/detail, safe version history, review detail when separately authorized |
| `QUESTION_AUTHOR` | Create/update Draft, create version, submit current Draft |
| `QUESTION_REVIEW` | Review queue/detail, approve, request changes |
| `QUESTION_PUBLISH` | Publish an approved version |
| `QUESTION_LIFECYCLE_MANAGE` | Retire and restore Question aggregates |

Phase 2 grants all five capabilities to active `ADMIN` users under the repository's current role model. Candidate and Interviewer receive none. UI capability checks only control affordances; route middleware and service rules remain authoritative.

## Four-eyes policy

Each version persists an immutable-by-history contributor set. Creation adds `createdBy`; every Draft content update adds the actor. When four-eyes is enabled, an actor in that set cannot approve or publish the version. Disabling the flag relaxes only this separation-of-duties check; capability, state, completeness, taxonomy, ETag, lifecycle, idempotency, and audit controls remain mandatory.

For backward-compatible records without a contributor set, `createdBy` and `updatedBy` form the conservative contributor set.

## Completeness and taxonomy gate

Submit, approve, and publish re-evaluate the stored snapshot; publish does so inside its transaction. A snapshot is complete only when:

- at least one non-empty prompt locale exists;
- `classificationComplete=true`, type, difficulty, primary role, and at least one level are present;
- `technologyAgnostic=true` with no technologies, or `technologyAgnostic=false` with at least one technology;
- a reference answer exists in every locale used by the prompt;
- rubric has 2–10 criteria, total weight 100, non-empty localized titles, at least one level per criterion, and valid unique keys/scores;
- every assigned role, level, and technology exists and is ACTIVE.

Failures return `QUESTION_CONTENT_INCOMPLETE` with field-level errors. No server placeholder or fabricated translation is allowed.

## Phase 2 API contract

All paths are below `/api/v1/admin/question-bank`, return `Cache-Control: no-store` plus `X-Request-Id`, use strict Zod schemas, and require bearer authentication plus a route capability.

| Method | Path | Capability | Preconditions |
|---|---|---|---|
| POST | `/questions/{questionId}/submit-review` | AUTHOR | version `If-Match`, `Idempotency-Key`, optional bounded reason |
| GET | `/reviews` | REVIEW | strict page/filter query; summary-only response |
| GET | `/reviews/{questionVersionId}` | REVIEW | read-only full snapshot and history |
| POST | `/reviews/{questionVersionId}/decision` | REVIEW | version `If-Match`, `Idempotency-Key`, `APPROVE` or `REQUEST_CHANGES`; reason required for request changes |
| POST | `/questions/{questionId}/versions/{versionNumber}/publish` | PUBLISH | version `If-Match`, `Idempotency-Key`, optional bounded reason |
| POST | `/questions/{questionId}/retire` | LIFECYCLE_MANAGE | question `If-Match`, `Idempotency-Key`, required reason |
| POST | `/questions/{questionId}/restore` | LIFECYCLE_MANAGE | question `If-Match`, `Idempotency-Key`, required reason |

Mutation responses return the resulting resource, its ETag, and `Idempotency-Replayed: true` on replay. Stable Phase 2 errors add `QUESTION_CONTENT_INCOMPLETE`, `QUESTION_FOUR_EYES_VIOLATION`, `QUESTION_REVIEW_NOT_FOUND`, and `IDEMPOTENCY_REQUEST_IN_PROGRESS` to the Phase 1 set.

## Transaction boundaries and invariants

- Submit/decision: validate aggregate lifecycle and stored snapshot, claim idempotency, CAS version status/revision, append immutable review/audit record, enqueue safe outbox event, complete the idempotency record, commit.
- Publish: claim idempotency; re-read ACTIVE aggregate and APPROVED version; recheck completeness, taxonomy, and four-eyes; CAS the target; supersede the old published version when different; set target PUBLISHED; atomically update `currentPublishedVersionId`, clear matching `draftVersionId`, and increment Question revision; append audit/review and outbox records; complete idempotency; commit.
- Retire/restore: claim idempotency; CAS lifecycle plus Question revision; append immutable audit/review and outbox records; complete idempotency; commit.

A partial unique index on `(questionId,status)` for `status=PUBLISHED` is the database backstop. Rollout must inspect for duplicate published versions before index creation; production must not call `syncIndexes()` automatically.

## Short threat model

| Threat | Control |
|---|---|
| Self-approval or self-publish | contributor history plus default-on four-eyes checks |
| Stale or concurrent transition | resource-specific weak ETag and atomic CAS |
| Split-brain publish pointers | replica-set transaction, published unique index, aggregate pointer predicate |
| Taxonomy time-of-check/time-of-use | full stored-snapshot validation inside transition transaction |
| Duplicate review/audit/outbox on retry | actor/route/payload-bound idempotency record in the same transaction |
| Restricted answer/review disclosure | summary DTO allowlists, explicit detail route, `no-store` |
| Reason/log injection | trimmed bounded plain text; logs carry identifiers/codes, never review content |
| Retired content reused | lifecycle check on all workflow mutations and future selection boundary |
| Existing Interview generation changes indirectly | hard route/context isolation; no Question Bank dependency is allowed in Interview runtime |

## Rollout and rollback

1. Keep `QUESTION_BANK_ADMIN_API_ENABLED=false` and the UI flag false during schema/index verification.
2. Inspect duplicate workflow/published states and contributor fallback coverage without changing data.
3. Create named indexes through the controlled migration/deployment process; never `syncIndexes()` in production.
4. Deploy backend, run contract/integration smoke checks, then enable API and UI in a controlled environment.
5. Roll back non-destructively by disabling the existing API/UI flags. Preserve all collections, reviews, outbox events, and pointers. A code rollback must remain able to read the additive fields.

## Test plan

Backend unit tests cover transitions including invalid/terminal paths, completeness, taxonomy issue mapping, four-eyes enabled/disabled matrices, immutable DTO mapping, and negative disclosure. Replica-set integration tests cover success/rollback, concurrent submit/decision/publish, missing/stale ETags, idempotency replay/key reuse/in-progress, atomic supersede/pointers, retire/restore, and named indexes. Frontend tests cover queue states/filters/retry, read-only detail/history, completeness display, decision and lifecycle confirmations, capability/flag gating, conflicts, busy states, accessible announcements, and Candidate-safe rendering. Contract tests compare runtime inventory, headers, bodies, responses, schemas, and stable error codes with OpenAPI.

Browser E2E may be reported only if an actual browser runner exists and is executed. At contract authoring time the repository still has no browser E2E harness; this remains a planned validation gap.

## Implementation ledger

### Implemented baseline

- AIP-62 Phase 1 Draft authoring, snapshots, safe list/detail mappers, transactions, CAS/ETag, idempotency foundation, outbox foundation, Admin UI, and tests as recorded in `06-delivery-test-plan.md`.

### Implemented in AIP-63

- Five capability boundaries, including `QUESTION_LIFECYCLE_MANAGE`, with route middleware and server-side state/four-eyes enforcement.
- All seven Phase 2 operations in the API table, strict request schemas, aggregate/version ETags, replay headers, stable errors, UUID request correlation, and summary-only history/queue DTOs.
- Contributor history, stored-snapshot completeness/taxonomy gates, immutable review audit records, transactional safe outbox events, lifecycle preservation, atomic supersede, and the partial unique published-version index.
- Admin review queue/detail UI, server-authorized decision controls, submit review from the editor, retire/restore controls, confirmations, retry/loading/empty/conflict states, and accessibility announcements.
- OpenAPI 3.1 contract version 0.2 with exactly 15 implemented operations (8 Phase 1 and 7 Phase 2); the remaining six operations are explicitly planned.

### Verification evidence (2026-09-10)

- Backend build passed; full backend suite passed 13 files and 203 tests.
- Backend coverage gate passed: 87.19% lines, 85.16% statements, 89.75% functions, and 72.08% branches.
- OpenAPI contract passed 5 tests. The governed-flow integration test covers submit replay, four-eyes denial, queue/detail, approve, first publish, retire/replay/restore, then replacement publish with exactly one PUBLISHED and one SUPERSEDED snapshot.
- Frontend build and lint passed. Targeted Question Bank UI suites passed 2 files and 11 tests; the new queue page measured 100% lines and the new review detail page 81.69% lines in the targeted coverage run.
- The targeted frontend coverage command passed all 11 selected tests but exited non-zero because global coverage includes unrelated unselected client modules and therefore missed the global 70% threshold. Full frontend remains 17 files/80 tests passed plus 4 pre-existing `InterviewSetupForm` failures caused by rendering `useNavigate` without a Router.
- The deterministic dry-run performance shape completed for 1,000 questions and 3,000 versions in 49 ms with digest `0f76b00cfc95915ceb1e0aef72719d0dc90a32790828e0e647f3dc292aea7aff`; this is generator evidence, not database latency.
- Browser E2E was not run because the repository has no browser E2E harness. No seed/reset command was used.

Selection, analytics, interview integration, import/export, AI authoring/translation, embeddings, and semantic duplicate detection remain planned outside AIP-63.
