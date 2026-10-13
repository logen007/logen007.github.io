# Publication releases

Publishing writes one immutable, private exam snapshot to exam_releases, then
atomically changes the server-owned publication pointer. Versions are per exam:
1.0.0, 1.0.1, etc. Stable content hashes exclude timestamps and operational
metadata. Retries with unchanged content reuse the same release.

The publication endpoint streams real stages over its single authenticated POST.
Only successful transaction commit produces the completion receipt. Client
disconnect does not undo a committed publication; retry is safe.

The authoring exams/questions remain the draft. Student catalog/session/start
read the publication snapshot, with current visibility/access restrictions.
Existing attempt snapshots are preserved; new attempts still own a full shuffled
snapshot for compatibility. This release does not migrate attempts to references,
publish answer keys on a CDN, or implement the separate dashboard SSE proposal.

Published snapshots are precomputed in PostgreSQL and primed in a bounded
16 MiB private server cache. Media files are referenced, not copied or preloaded.
GC includes all releases. Deleting a trashed exam through the existing authorized
workflow cascades release deletion; ordinary editing never deletes releases.

## Rollout / recovery

- Additive schema only. Legacy published exams work before conversion; before
  their first edit, freeze a compatibility baseline. No bulk attempt rewrite.
- Back up the database before deployment using the existing deployment procedure.
- Prefer a forward fix. Do not simply roll back to a server that ignores release
  pointers: it would serve authoring drafts for new attempts. If rollback is
  unavoidable, pause new starts and publishing, preserve both draft and release
  tables, and restore a compatible application/database backup together.
- Leave the new table in place during any rollback. Do not contract/drop it or
  remove media as part of recovery.

Verification: publication.test.mjs plus publication.integration.mjs (isolated
PGlite via G2G_PGLITE_PATH), full npm test and backend-access.integration.mjs.
