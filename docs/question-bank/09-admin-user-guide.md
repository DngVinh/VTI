# Admin user guide

> Reconstruction notice: this is the initial AIP-62 Admin guide reconstructed from the delivery contract because no prior guide was available.

## Availability and access

The Question Bank appears only when the Admin UI flag is enabled and the signed-in user is an Admin. The backend independently requires authentication, Admin capabilities, and the API feature flag.

Routes:

```text
/admin/question-bank
/admin/question-bank/questions/new
/admin/question-bank/questions/{questionId}
/admin/question-bank/questions/{questionId}/edit
```

## Find questions

The list shows code, prompt preview, taxonomy, difficulty, type, lifecycle, Draft status, selection status, version numbers, and last update. Search, filters, page, and sort are stored in the URL so a view can be refreshed or shared with another authorized Admin.

Changing search/filter resets to page 1. Search waits briefly before sending and cancels obsolete reads. Empty database, no matching filters, loading, request error, and retry are distinct states. Unknown future enum values display a safe fallback label.

## Create and edit

Create begins an incomplete Draft. Supply at least one meaningful authoring field. The server assigns code, owner, Draft status, version number, revision, and audit timestamps.

The editor sections are Content, Classification, Answer & Rubric, and History. The save indicator announces unsaved, saving, saved, error, or conflict through an accessible live region. Explicit Save is always available beside autosave.

Autosave runs only for Drafts after a short idle delay and sends one write at a time. Closing a tab or cancelling a request does not prove the server rolled it back. Unsaved navigation prompts before leaving; reference answers and rubrics are never stored in localStorage or sessionStorage.

## Resolve a conflict

1. Keep the conflict screen open; local content is preserved.
2. Review the server revision and compare it with local fields.
3. Copy or merge deliberately into the editor.
4. Save using the latest revision/ETag.

There is no force-overwrite action.

## Version history

Open a version to inspect its Admin detail. Published and Superseded versions are read-only. Create New Version is available only when no active Draft exists and can copy an explicit source or the current published snapshot.

Review/audit timeline is labeled unavailable in Phase 1. Publish, retire, restore, review decisions, import/export, selection, analytics, and AI authoring are not available.

## Operational errors

- `QUESTION_BANK_FEATURE_DISABLED`: feature is temporarily disabled; preserve work and contact the operator.
- `PRECONDITION_REQUIRED`: reload detail to obtain an ETag before editing.
- `QUESTION_REVISION_CONFLICT`: merge local and server content.
- `QUESTION_VERSION_IMMUTABLE`: the selected version cannot be edited.
- `QUESTION_ACTIVE_DRAFT_EXISTS`: continue editing the existing Draft.
- `IDEMPOTENCY_KEY_REUSED`: do not reuse a create key for different content.

Provide the displayed request ID when reporting an error. Do not paste reference answers or rubric content into general support channels.

