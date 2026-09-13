# API and application design

> Reconstruction notice: this contract was reconstructed from AIP-62 because the referenced API design was not present on the branch.

## Runtime namespace

All implemented routes are below `/api/v1/admin/question-bank`. The namespace sets `no-store` first, then applies authentication, Admin authorization, feature availability, the route capability check, strict validation, and finally the controller.

| Method | Route | Phase 1 behavior |
|---|---|---|
| GET | `/questions` | List/search/filter/sort summaries |
| POST | `/questions` | Create Question plus Draft v1 |
| GET | `/questions/{questionId}` | Admin detail |
| PATCH | `/questions/{questionId}` | Update mutable Question metadata |
| GET | `/questions/{questionId}/versions` | Version summaries/history |
| POST | `/questions/{questionId}/versions` | Create one Draft version |
| GET | `/questions/{questionId}/versions/{versionNumber}` | Version detail |
| PATCH | `/questions/{questionId}/versions/{versionNumber}` | Update Draft snapshot |

| POST | `/questions/{questionId}/versions/{versionNumber}/translation-preview` | AI Translation Preview (Read-only DB, diff preview) |
| POST | `/questions/{questionId}/versions/{versionNumber}/translation-apply` | AI Translation Apply (DRAFT only, If-Match ETag, Idempotency, overwrite confirm) |
| POST | `/embeddings/backfill` | Embedding Vector Backfill (Bounded batches, cursor pagination) |
| POST | `/semantic-duplicates` | Semantic Duplicate Detection (Advisory, cosine similarity & fingerprint) |

No public or Candidate Question Bank endpoint exists.

## Transport contract

Success:

```json
{"success":true,"data":{},"requestId":"123e4567-e89b-42d3-a456-426614174000"}
```

Error:

```json
{"success":false,"message":"Dữ liệu đầu vào không hợp lệ","code":"VALIDATION_ERROR","errors":[{"field":"rubric","message":"Tổng trọng số rubric phải bằng 100"}],"requestId":"123e4567-e89b-42d3-a456-426614174000"}
```

Unexpected production failures use `INTERNAL_SERVER_ERROR` and a generic message. Mongo duplicate metadata, stack traces, request bodies, hashes, and persistence internals are not echoed.

All Question Bank responses, including guard failures, send `Cache-Control: no-store` and `X-Request-Id`. PATCH accepts `application/merge-patch+json`; project-compatible `application/json` may also be accepted when covered by the same strict schema.

## Preconditions and idempotency

- `POST /questions`, `POST /versions`, and `POST /questions/.../translation-apply` require `Idempotency-Key`, 16–128 printable safe characters.
- The fingerprint covers canonical JSON plus actor and route scope.
- Same scope/key/fingerprint replays the logical result; different payload returns `409 IDEMPOTENCY_KEY_REUSED`.
- PATCH and `translation-apply` require a weak deterministic `If-Match` ETag. Missing returns 428; malformed or stale values never trigger an unguarded write.
- Successful detail/update responses return the current weak ETag.
- A client must retain the same idempotency key when retrying an unknown outcome.

## List behavior

Default `page=1`, `limit=20`, maximum `100`. Search length is 2–200 and is escaped before use. Sort is allowlisted to `updatedAt`, `createdAt`, or `code`, with explicit `sortOrder` direction.

Filters are lifecycle, Draft/version status, role, level, technology, difficulty, type, and origin. `status=PUBLISHED` means the Question has a current published pointer, even when a newer Draft also exists. The list response therefore reports separate `draftStatus` and `selectionStatus`.

List DTOs contain code, prompt preview, bounded taxonomy IDs, classification type/difficulty/origin, lifecycle, Draft/selection status, version numbers, and timestamps. They never contain a full reference answer, rubric, review payload, full provenance, raw embedding vectors, `_id`, `__v`, internal hashes, idempotency metadata, or outbox data.

Admin detail may include reference answers and rubric through an explicit mapper allowlist.

## Validation and errors

Body, query, and params are strict Zod objects. Object IDs and positive version numbers are rejected before repository access. Server-owned code, statuses, actors, provenance, pointers, timestamps, and revisions are not assignable. The Phase 1 aggregate metadata PATCH is deliberately minimal and accepts only `{ "ownerId": "<ObjectId>" }`; ownership transfer still requires the Question ETag. This is the smallest compatible metadata operation while lifecycle transitions remain out of scope.

Stable codes covered in Phase 1-4 tests:

```text
VALIDATION_ERROR
AUTH_UNAUTHORIZED
AUTH_FORBIDDEN
QUESTION_BANK_FEATURE_DISABLED
QUESTION_NOT_FOUND
QUESTION_VERSION_NOT_FOUND
QUESTION_REVISION_CONFLICT
QUESTION_VERSION_IMMUTABLE
QUESTION_ACTIVE_DRAFT_EXISTS
QUESTION_INVALID_STATE_TRANSITION
QUESTION_CODE_CONFLICT
IDEMPOTENCY_KEY_REUSED
PRECONDITION_REQUIRED
QUESTION_TRANSLATION_SOURCE_MISSING
QUESTION_TRANSLATION_OVERWRITE_CONFIRMATION_REQUIRED
QUESTION_TRANSLATION_SCHEMA_ERROR
QUESTION_TRANSLATION_DISABLED
QUESTION_EMBEDDING_PROVIDER_UNAVAILABLE
QUESTION_EMBEDDING_INVALID_DIMENSIONS
QUESTION_EMBEDDING_BACKFILL_IN_PROGRESS
QUESTION_EMBEDDING_BACKFILL_DISABLED
QUESTION_SEMANTIC_SEARCH_DISABLED
QUESTION_SEMANTIC_SEARCH_UNAVAILABLE
QUESTION_DUPLICATE_QUERY_INVALID
INTERVIEW_QUESTION_SOURCE_DISABLED
INTERVIEW_QUESTION_BANK_EMPTY_POOL
INTERVIEW_QUESTION_BANK_INSUFFICIENT_POOL
INTERVIEW_QUESTION_BUNDLE_INVALID
INTERVIEW_QUESTION_SOURCE_TIMEOUT
INTERVIEW_QUESTION_DUPLICATE_DETECTED
INTERVIEW_QUESTION_SESSION_NOT_FOUND
INTERVIEW_QUESTION_GENERATION_CONFLICT
INTERVIEW_QUESTION_INCONSISTENT_STATE
INTERNAL_SERVER_ERROR
```

## Phase 5 Candidate DTO & Interview Sanitization Boundary

Candidate-facing endpoints (`/api/v1/interviews/*`) interact with Interview Question generation governed by `InterviewQuestionGenerationOrchestrator`:
- Candidates cannot specify `questionSourceMode`, `questionBankQuestionId`, or individual question IDs.
- `toCandidateSafeInterviewSession` ensures all Question Bank identifiers, version numbers, content hashes, embeddings, and provenance metadata are completely stripped before serialization.
- SSE stream emits only minimal state changes (`{ "status": "<STATUS>" }`).

The machine-readable contract is `openapi-question-bank.yaml`. In Phase 4-5, all 25 Admin operations across Phase 1 to Phase 4 remain implemented, and Phase 5 introduces the internal Question Bank Selector for safe interview question sourcing.
