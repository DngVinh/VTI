# ADR — Separate versioned Question snapshots

> Reconstruction notice: this ADR is the initial decision record reconstructed from the AIP-62 decision lock; no earlier ADR for Question Bank snapshots existed on the branch.

- Status: Accepted for AIP-62 Phase 0–1
- Date: 2026-09-10

## Context

Question content evolves while interviews and future governance require a stable historical record. Embedding all revisions in one Question document creates unbounded growth, complicated concurrency, and accidental mutation risk. Reusing the legacy `InterviewQuestion` runtime model would also couple authoring rollout to interview behavior, which is explicitly outside Phase 1.

## Decision

Store stable identity and pointers in `Question`; store each authored snapshot in a separate `QuestionVersion` document with a unique `(questionId, versionNumber)` index.

Only Draft versions are editable. Published and Superseded versions are immutable. A Question can point to one current published snapshot and independently to one active Draft. Question/version creation is transactional; Draft updates use revision-based compare-and-set.

The legacy `InterviewQuestion` and interview generation flow remain unchanged until the later integration phase.

## Consequences

Positive:

- Stable audit/history semantics and bounded documents.
- Safe parallel existence of published content and a newer Draft.
- Explicit concurrency conflicts instead of lost updates.
- Future review/publish/selection can reference immutable version IDs.

Costs:

- Detail and list projections may require joins or denormalized bounded fields.
- Version allocation and active-Draft uniqueness require transactions plus indexes.
- Operators must run Mongo as a replica set for mutation paths.

## Rejected alternatives

- Embed unlimited versions in Question: rejected for document growth and update contention.
- Mutate one live Question record: rejected because published content would not be reproducible.
- Extend `InterviewQuestion` immediately: rejected because it changes interview runtime before the selection/integration phase.
- Store idempotency only in memory: rejected because restarts and multiple instances would permit duplicate commands.

## Follow-up boundaries

Review transitions, four-eyes enforcement, publish/retire, selection, and interview provenance require separate later decisions and endpoints. Their type names in Phase 1 are forward-compatible foundations, not authorization to expose them.

