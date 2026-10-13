# Performance changes — 1.3.40

The student session endpoint reads only the owner's selected exam and attempt.
The submission response includes the committed public receipt; the repository
applies it before showing the submitted screen, without a full-state reload.
Returning to the catalog reloads metadata rather than reusing a one-exam session.

Part runtimes receive the view's authorized state and mount once per DOM root.
Timer/answer changes do not trigger state requests. Normal answer controls keep
using the durable outbox and its version/conflict/deadline checks.

Staff dashboard/gradebook reads use `/api/state-summary`, with SQL projections
excluding passages, media, answer bodies, answer keys, full suggestions and the
audit log. Editing/grading hydrates full data before any write. State reads share
in-flight loads and a bounded, identity-specific cache; committed writes invalidate
the cache. External database edits can take up to 60 seconds to appear. Authentication
and role checks still run on every request.

AI submissions enqueue transactionally. Startup backfill selects missing jobs
only; periodic recovery updates failed/stale jobs rather than scanning 200 papers.
A shared job pump reserves slots before awaiting claims. Per-question suggestion
updates lock/re-read the current attempt, avoiding concurrent suggestions overwriting
each other. Provider concurrency remains configurable (default 3).

The dashboard polls the queue every 5 seconds only while visible, with overlap and
late-response guards. Heavy infrastructure reads remain separately cached/shared.
Deadline scans run every 5 seconds against an indexed deadline; saves/submissions
still enforce the exact server deadline. Email publication queues delivery instead
of awaiting SMTP; the worker resumes queued/interrupted notifications after restart.

The production image builds minified, content-addressed ESM assets with esbuild.
Approved specifications are generated from `specs/` into the compiled loader,
not maintained as a second rules source. CSS/JS have gzip/Brotli sidecars and
immutable cache headers; HTML/runtime configuration stay uncached. The new
`g2g_web_assets` volume retains older chunks for open tabs across deployments.
API JSON supports gzip, and conditional state reads retain private ETags.

## Verification

- `npm test` — full domain, architecture, auth/security and UI regression suite.
- `npm run test:performance` and `npm run test:r2`.
- `npm run build:web` and `sh server/check-code.sh`.
- With `G2G_PGLITE_PATH` pointing to a temporary PGlite installation:
  - `node tests/performance.integration.mjs`
  - `node tests/performance-http.integration.mjs`
  - `node tests/backend-access.integration.mjs`
  - `node tests/exam-completion.integration.mjs`

The isolated 200-paper fixture reduced uncompressed staff state from 4,108,334
bytes to 281,453 bytes (93%) while preserving displayed grades. A repeated AI
backfill inserted no existing jobs. Fastify injection accepted 200 simultaneous
submissions and confirmed 20 unchanged conditional requests did not reload the
question bank. These are local synthetic tests, not measured VPS/network/provider
capacity. Browser checks cover the built landing page, dashboard and settings.
