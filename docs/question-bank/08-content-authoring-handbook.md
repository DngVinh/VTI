# Content authoring handbook

> Reconstruction notice: this handbook was reconstructed as the initial AIP-62 authoring guidance because no earlier handbook existed.

## Draft-first workflow

Start with any meaningful authoring field: a VI or EN prompt, an objective, classification, answer, or rubric work. Incomplete Drafts are expected. Do not add placeholder taxonomy or fabricated translations merely to make the form look complete.

Use the explicit Save action before leaving important work. Autosave waits briefly after changes and serializes requests; it is a convenience, not evidence that an aborted network request rolled back on the server.

## Bilingual content

- Write direct, unambiguous prompts; keep VI and EN semantically equivalent when both exist.
- Preserve code, identifiers, and technology terminology where translation would reduce accuracy.
- Prompts are at most 5,000 characters per language.
- Reference answers are at most 20,000 characters per language.
- Learning objectives and each follow-up are at most 1,000 characters per language; no more than five follow-ups.
- Do not include candidate personal data, secrets, production credentials, or copied proprietary interview material.

Phase 1 displays plain text/code safely. Do not rely on HTML for formatting.

## Classification

Choose one type, difficulty, primary role, optional additional roles, levels, technologies/relevance, topic, tags, origin, and technology-agnostic state as evidence permits.

Tags and rubric keys use lowercase kebab-case. Avoid synonyms that fragment search. Additional roles must not repeat the primary role. New taxonomy assignments must reference active records.

If a question is genuinely technology-neutral, mark it technology-agnostic and leave technology assignments empty. If classification is declared complete and it is not technology-agnostic, assign at least one relevant technology.

## Reference answer and rubric

The reference answer is restricted and never appears in Candidate preview. Describe the expected reasoning, acceptable variants, and important caveats rather than one brittle phrase.

When creating a rubric:

- Use 2–10 independently assessable criteria.
- Give every criterion a unique kebab-case key.
- Use integer weights from 1 to 100 with a final total of 100.
- Define unique levels using scores 0–4; write observable distinctions.
- Keep the learning objective aligned with the highest-weight criteria.

The editor's live total is guidance. Server validation remains authoritative.

## Safe preview

Candidate preview contains only the prompt and permitted classification metadata. It must never display reference answers, rubric criteria/levels, review content, internal provenance, or hashes.

## Conflict handling

If another editor saved first, the API returns `QUESTION_REVISION_CONFLICT`. Your local content remains visible. Compare it with the server revision, copy either side as needed, merge deliberately, then save against the current ETag. Never force overwrite or refresh before preserving local work.

## Version history

History is read-only in Phase 1. Review and audit timeline controls show unavailable/planned rather than fake records. Creating a new version fails when an active Draft already exists.

