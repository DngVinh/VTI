# Product requirements

> Reconstruction notice: this is the initial AIP-62 contract reconstructed from the approved task because no prior Question Bank document was present.

## Problem and outcome

Administrators need a governed source of interview questions that can be authored incrementally without exposing answers to candidates or mutating published content. AIP-62 establishes question identity, immutable version history, safe Draft editing, and the Admin authoring experience.

## Users and capabilities

- `ADMIN` receives `QUESTION_READ` and `QUESTION_AUTHOR` in Phase 1.
- Candidate and Interviewer roles receive neither capability.
- Future capability types may name review or publish privileges, but Phase 1 exposes no such action.

Role checks and capability checks are enforced by the backend. A hidden frontend route or navigation item is never an authorization boundary.

## Functional requirements

1. An Admin can create a Question and incomplete Draft version 1 with at least one valid authoring field.
2. An Admin can search, filter, sort, and page Question summaries without receiving reference answers or rubrics.
3. An Admin can view a Question, its Draft or published pointers, and version history.
4. An Admin can edit Question metadata and a Draft using `If-Match` optimistic concurrency.
5. An Admin can create one new Draft from an explicit source version or current published version when no active Draft exists.
6. Create commands are idempotent for the same actor, route, key, and canonical payload.
7. Published and Superseded versions are immutable even though Phase 1 has no publish endpoint.
8. The editor supports bilingual content, classification, optional rubric authoring, safe preview, serialized autosave, local-data-preserving conflict handling, and accessible status feedback.

## Draft completeness

Drafts may contain `null`, `{}`, or `[]` for absent data. Saving a Draft does not require bilingual completeness, taxonomy completeness, a reference answer, or a rubric. Fields that are supplied must still satisfy type, normalization, existence, activity, uniqueness, and size constraints.

Publish-readiness belongs to a later phase. The UI may display incomplete state but must not invent content or taxonomy.

## Non-functional requirements

- Admin API/UI are disabled by default in production configuration.
- Restricted payloads use `Cache-Control: no-store`.
- Responses include a server-generated request ID.
- No raw Mongoose documents or internal identifiers/hashes leak through DTOs.
- Mutations are transactionally consistent on a Mongo replica set.
- Search input is escaped and cannot become arbitrary regular expression input.
- List defaults to page 1 and limit 20; maximum limit is 100.
- New domain/service/repository/mapper code targets at least 85% meaningful line/branch coverage; project threshold remains 70%.

## Explicitly out of scope

- Review queue or decisions, submit-review, approval, publish, retire, restore.
- Selection engine, coverage or quality analytics, and interview generation integration.
- Import/export, AI generation/translation, embeddings, and semantic duplicate detection.
- Hard deletion or cleanup of existing data.

## Acceptance summary

Completion requires all eight Admin operations, transaction-capable integration evidence, idempotency and concurrency tests, frontend unit/component coverage, critical browser E2E evidence, OpenAPI alignment, safe benchmark smoke evidence, and no regression to existing interview behavior. Missing infrastructure or unexecuted mandatory validation must be reported rather than represented as complete.

