# Security, governance, and operations

> Reconstruction notice: this initial runbook was reconstructed from the AIP-62 contract because no earlier Question Bank security document was present.

## Authorization and exposure

Every Question Bank response is marked `no-store`; the route then authenticates, requires Admin authorization, evaluates the feature flag, and enforces its route capability before validation. This ordering prevents unauthenticated users from probing whether the feature is enabled. The backend is authoritative; UI flags only control navigation and route experience.

Phase 1 capabilities are `QUESTION_READ` and `QUESTION_AUTHOR`. Phase 2 adds `QUESTION_REVIEW`, `QUESTION_PUBLISH`, and `QUESTION_LIFECYCLE_MANAGE`. Phase 3 adds `QUESTION_SELECT`, `QUESTION_ANALYTICS`, `QUESTION_IMPORT_EXPORT`, and `QUESTION_AI_GENERATE`. Phase 4 adds `QUESTION_AI_TRANSLATE`, `QUESTION_DUPLICATE_READ`, and `QUESTION_EMBEDDING_MANAGE`. All are mapped to active Admin users.

## Restricted data

Reference answers, rubrics, review records, complete provenance, hashes, raw embedding vectors, and authoring history are restricted Admin content. They must not appear in list DTOs, Candidate preview, browser console output, public snapshots, duplicate detection advisory results, telemetry, idempotency records, or outbox metadata unless a minimal safe reference is required. Raw vector embeddings are strictly internal to the `question_embeddings` collection and must NEVER be serialized in public or advisory API responses.

Candidate preview renders prompt and permitted metadata only. It displays plain text or safely rendered code and never uses `dangerouslySetInnerHTML` without an independently reviewed sanitizer.

## Input and output controls

- Strict Zod validation rejects unknown fields, invalid enums, malformed ObjectIds/version numbers, dangerous control characters, duplicates, and field-size violations.
- Repository search escapes metacharacters and never accepts client-provided regular expressions.
- Explicit DTO mappers allowlist output fields; raw Mongoose documents are not serialized.
- Expected domain conflicts map to stable codes. Unexpected production errors are generic and omit stack/request payload/database metadata.
- Every response in the Question Bank namespace sets `Cache-Control: no-store`.
- A server-generated request ID is included in the response header and envelope.
- Helmet, existing CORS policy, and bounded JSON/urlencoded parsers remain active.

## Integrity controls

- Published and Superseded snapshots are immutable at domain, service, and atomic repository layers.
- `If-Match` is mandatory for PATCH; no fallback last-write-wins behavior exists.
- Idempotency is durable, actor/route scoped, payload-bound, and retained at least 24 hours.
- Question/version creation uses replica-set transactions and a durable outbox foundation.
- Server owns codes, status, actor, provenance, pointers, revision, and timestamps.
- There is no hard-delete endpoint.

## Logging and audit

Allowed logs include request ID, stable error code, route template, HTTP status, duration, aggregate ID, version number, and safe actor ID. Do not log prompts, reference answers, rubrics, raw request bodies, authorization headers, idempotency keys, hashes, or Candidate data.

Outbox/audit events use an allowlisted minimal payload. Operational inspection should prefer counts and identifiers over content.

## Kill switch runbook

1. Set `QUESTION_BANK_ADMIN_API_ENABLED=false` in the target environment and redeploy/restart through the normal controlled process.
2. Optionally set the public Admin UI flag false so navigation and routes disappear.
3. Confirm an authenticated Admin receives `QUESTION_BANK_FEATURE_DISABLED`; confirm anonymous requests still receive authentication failure first.
4. Do not drop collections, indexes, or data. Disabling is reversible.
5. Preserve request IDs and relevant safe logs for investigation.

`QUESTION_BANK_REVIEW_FOUR_EYES=true` is retained for future review/publish work and does not enable Phase 1 actions.

## Incident and recovery

- Unknown mutation outcome: retry with the same idempotency key, never a new key.
- Revision conflict: retain local content, fetch server detail, and merge explicitly; never force overwrite.
- Duplicate/partial aggregate suspicion: inspect by request ID/idempotency scope and transaction state; do not run cleanup scripts.
- Index discrepancy: inspect the named index set. Never run production `syncIndexes()` automatically.
- Outbox delivery issue: retry only through the future bounded delivery worker; do not modify aggregate content to recreate an event.

## Benchmark safety

The benchmark is dry-run by default. Write mode accepts only local Mongo hosts, requires an explicitly disposable database name and matching confirmation, writes only benchmark-prefixed collections, and never deletes data. Production-like names, remote/SRV URIs, TLS remote-style targets, missing confirmations, and ambiguous targets are rejected.

## Phase 5 Interview Integration Security & Kill Switch Runbook

### Interview Sourcing Kill Switch (Immediate Rollback)
1. Set `INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED=false` in environment variables and reload/restart the backend service.
2. Confirm interview question generation reverts immediately to baseline pure AI generation (`AI_ONLY`), with 0 Question Bank queries.
3. Existing interview sessions previously generated with Question Bank questions remain fully functional and immutable.
4. No database schema migration, rollback, or collection dropping is required.

### Candidate Anti-Leak Boundary
- Strict schema parsing prevents candidates from passing `questionSourceMode`, `questionBankQuestionId`, or internal identifiers.
- `toCandidateSafeInterviewSession` ensures candidate responses contain only interview runtime data (order, content, score, feedback), completely stripping provenance, hashes, vectors, and question bank IDs.

## Phase 7 Operational Telemetry, Privacy Redaction & Rollout Governance

### Sourcing Telemetry Zero-PII Invariant
- **Model**: `QuestionSourcingEventModel` (`question_sourcing_events` collection) with `strict: 'throw'` Mongoose schema.
- **Payload Whitelist**: Only operational metrics and metadata are stored (`eventType`, `sessionHash`, `resolvedMode`, `requestedMode`, `durationMs`, `itemCount`, `bankCount`, `aiCount`, `sourceDistribution`, `fallbackTriggered`, `fallbackReason`, `errorCode`, `rolloutBucket`, `rolloutPercent`).
- **Anonymization**: Session identifiers are hashed using SHA-256 (`sessionHash: sha256(sessionId)`). Raw ObjectIds, prompts, reference answers, rubrics, candidate profiles, AI responses, and embedding vectors are strictly prohibited and blocked by schema validation.
- **Data Lifecycle**: Indexed TTL expiration via `QUESTION_SOURCING_EVENT_RETENTION_DAYS` (default 30 days) on `createdAt`.
- **Telemetry Kill Switch**: Setting `QUESTION_SOURCING_TELEMETRY_ENABLED=false` bypasses all telemetry logging without interrupting interview generation or throwing errors.

### Admin Observability & Metrics Access Control
- Endpoint: `GET /api/v1/admin/metrics`
- Security Gate: Requires valid JWT token and `ADMIN` role. Anonymous (401) and Candidate/User (403) access are strictly blocked.
- Metric Envelope: Additive `questionSourcing` section aggregating sourcing event counts, mode distribution, fallback frequency, p50/p90/p95/p99 duration histograms, and error code distributions within a bounded `[from, to)` time range.

### Deterministic Rollout & Kill Switch Drill
- **Hashing Function**: `crc32(salt + ":" + sessionId) % 100` guarantees deterministic cohort assignment across node restarts and scaling.
- **Primary Kill Switch (Global Off)**:
  1. Set `INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED=false`.
  2. Reload/restart backend service.
  3. All requests instantly resolve to `AI_ONLY` with 0 Question Bank queries, regardless of rollout percentage or requested mode.
- **Secondary Kill Switch (Rollout Drain)**:
  1. Set `INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT=0`.
  2. Reduces Question Bank sourcing cohort to 0% while maintaining integration plumbing.
- **Safety Guarantee**: In-flight and completed interviews retain existing immutable question data. No schema rollback or destructive database operations are performed.
