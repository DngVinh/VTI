# AIP-62 baseline, targets, and deviations

> Reconstruction notice: no prior Question Bank baseline or decision pack existed on this branch. This file records only evidence available in the repository on 2026-09-10 and the decisions locked by AIP-62.

## Existing measurable signals

| Signal | Current evidence |
|---|---|
| Interview generation duration | not yet instrumented as a stable aggregate |
| AI failure rate | status `FAILED` exists; a Question Bank-specific baseline is not yet instrumented |
| Prompt/candidate/total token use | fields exist on interview metadata and Admin metrics aggregates them |
| Repeated-question proxy | not yet instrumented |
| Question Bank API latency | not yet instrumented; API did not exist at baseline |
| Question Bank content volume | zero/not applicable at baseline; collections did not exist |

No numeric production value is inferred from fixtures or tests.

## Phase 1 targets

Targets are acceptance thresholds for controlled synthetic/local measurement, not claims about production:

- List p95 target: at most 500 ms for an indexed page of 20 against the 100k/300k synthetic shape.
- Detail p95 target: at most 300 ms by identifier with bounded joins/projections.
- Create/update p95 target: at most 750 ms on a healthy single-region replica set, excluding client network latency.
- Error rate target for valid synthetic commands: below 1%, excluding deliberately injected conflicts.
- No restricted-field disclosure in list/error payloads: zero tolerated.

Results remain `not yet measured` until a command, environment, sample size, and raw summary are recorded.

## Measurement method

- Generate deterministic metadata using `npm run benchmark:question-bank`; dry-run verifies counts/distributions without database writes.
- Database measurement is opt-in only against an explicitly named local disposable benchmark DB.
- Record warm-up count, sample count, concurrency, Node/Mongo versions, dataset seed, index list, p50/p95/p99, and error counts.
- AI failure/token metrics remain sourced from current interview metadata; AIP-62 does not change interview runtime.
- A future repeat proxy can hash normalized prompts and compare selected fingerprints within a bounded role/level/technology window. It is not yet instrumented.

## Locked decisions

1. Stable Question identity and separate version snapshots.
2. Partial Draft persistence; completeness is a later publish gate.
3. Published/Superseded immutability.
4. One active Draft per Question.
5. Mongo replica-set transactions for aggregate creation/version creation.
6. Server sequence code allocation; abort gaps allowed.
7. Mongo-backed idempotency and compare-and-set optimistic concurrency.
8. Separate Draft and selection status in list DTOs.
9. Safe-off feature flags and Admin-only capabilities.
10. Phase 1 Question metadata PATCH is limited to strict `ownerId` transfer with an aggregate ETag; lifecycle and pointer changes remain future server-owned transitions.

## Reconstructed-contract deviations

- The requested Question Bank documentation and OpenAPI source were absent, so this directory establishes their first version from the task contract.
- The referenced AIP-52 hardening document was absent. Runtime baseline had Helmet and CORS but no request-ID middleware or explicit no-store policy. AIP-62 therefore documents and tests those requirements directly.
- The repository had JSON-only manual OpenAPI contract tests and no YAML parser dependency. The `.yaml` contract uses JSON syntax, which is valid YAML, so it is parseable with the existing runtime without adding a package.
- No browser E2E runner was present at baseline. Browser-context acceptance evidence must remain open until appropriate tooling is explicitly approved and executed; it must not be simulated by unit tests.

## Ownership and operations

- Feature owner: backend/admin authoring team for AIP-62.
- Operational owner: application on-call for the deployed environment.
- Kill switch: `QUESTION_BANK_ADMIN_API_ENABLED=false`; UI navigation separately uses the public UI flag.
- Runbook: [Security, governance, and operations](./05-security-governance-operations.md).

