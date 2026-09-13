# Domain and data design

> Reconstruction notice: this initial design was reconstructed from AIP-62 because the referenced prior data-design document was absent.

## Aggregate boundary

`Question` is the stable aggregate identity. `QuestionVersion` is a separate, bounded snapshot collection. Version history is never embedded as an unbounded array.

### Question

Core fields are `code`, `lifecycleStatus`, `ownerId`, `currentPublishedVersionId`, `draftVersionId`, `latestVersionNumber`, `revision`, and server audit timestamps/actors. Code is server-generated, immutable, unique, and formatted `QB-YYYY-NNNNNN`.

Lifecycle is `ACTIVE | RETIRED`. A published version pointer is independent of an active Draft pointer: one Question can have a selected published snapshot while a newer Draft is being authored.

### QuestionVersion

Core fields are `questionId`, `versionNumber`, `status`, `revision`, localized content, classification, rubric, change summary, provenance, and audit fields. Status is:

```text
DRAFT | IN_REVIEW | APPROVED | PUBLISHED | SUPERSEDED
```

Phase 1 writes only Draft operations. Published and Superseded versions are immutable. Transition definitions exist for later phases, but routes cannot invoke them in AIP-62.

### Localized content and classification

- Prompt: optional VI/EN, trimmed, maximum 5,000 characters each.
- Reference answer: optional VI/EN, maximum 20,000 each.
- Learning objective: optional VI/EN, maximum 1,000 each.
- Follow-ups: maximum five; each localized value maximum 1,000.
- Estimated time: 30–3,600 seconds when present.
- Tags: maximum 20, unique lowercase kebab-case.
- Additional roles: maximum 10, unique, excluding primary role.
- Levels: maximum 10 unique IDs.
- Technologies: maximum 20, unique by ID, with bounded relevance metadata.
- Assigned taxonomy references must exist and be active for a new assignment.

When classification is explicitly marked complete and `technologyAgnostic=false`, at least one technology is required. A partial Draft may remain incomplete without fabricated technology.

### Rubric

A rubric, when created, contains 2–10 criteria. Criterion keys are unique kebab-case values, weights are integers from 1–100, and levels use unique scores 0–4. The complete rubric weight total is 100. Partial authoring may be represented explicitly by the editor, but persisted supplied values remain bounded and structurally valid.

### Foundations

- `QuestionReview`: `questionVersionId`, revision, actor, decision/note foundation; no Phase 1 endpoint.
- `QuestionCounter`: atomic yearly sequence allocation. Sequence gaps after an aborted command are acceptable and do not weaken uniqueness.
- `IdempotencyRecord`: actor/route/key scope hash, request fingerprint, state, safe result reference, expiry of at least 24 hours.
- `OutboxEvent`: aggregate/event identifiers, payload, delivery status, attempt count, and `nextAttemptAt`; Phase 1 creates durable authoring audit events but does not expose an event API.

## Required named indexes

```text
questions.code                                           unique
questions.lifecycleStatus + updatedAt
questions.currentPublishedVersionId                     sparse where appropriate
questions.ownerId + lifecycleStatus + updatedAt
question_versions.questionId + versionNumber            unique
question_versions.questionId + status
question_versions.status + primaryRoleId + difficulty
question_versions.status + technologies.technologyId + difficulty
question_versions.normalizedPromptFingerprint
question_reviews.questionVersionId + revision + actorId
idempotency_records.scope + route + actorId + keyHash   unique
idempotency_records.expiresAt                            TTL
outbox_events.status + nextAttemptAt
```

No compound index may combine two parallel array fields. Index verification uses an isolated test database with `Model.init()`/index inspection. Production must not call `syncIndexes()` automatically because it can drop indexes.

## Consistency rules

### Create Question transaction

Claim idempotency, allocate a sequence, insert Question, insert Draft version 1, set the Draft pointer, insert outbox event, and complete the idempotency record in one replica-set transaction. A failed transaction leaves no partial aggregate. Safe sequence gaps are documented.

### Update Draft compare-and-set

The atomic predicate includes version ID, Question ID, version number, `status: DRAFT`, and expected revision. Only allowlisted fields are updated; revision increments once and actor/time are server-owned. On no match, a safe reread distinguishes not-found, immutable, and stale-revision outcomes.

### Create version transaction

At most one active Draft is permitted. Transactional pointer checks plus unique/conditional consistency prevent concurrent duplicate Draft creation. One contender wins; the other receives an idempotent replay or `QUESTION_ACTIVE_DRAFT_EXISTS`.

## Canonical hashing

Canonicalization normalizes Unicode, line endings, key ordering, and explicitly modeled empty values before SHA-256 hashing. Hashes support request idempotency and duplicate prompts but are internal and never returned by Admin DTOs.

