# Settings performance review — 2026-10-12

## Findings and implemented changes

- Opening Settings previously invoked the full infrastructure report: all active exams/questions, database table sizes, recursive upload/application scans and per-exam media file stats. Settings now requests connection status only. The server exits before all seven expensive report operations. Dashboard's detailed report remains available and unchanged.
- Concurrent Settings loads now share one promise. Save and SMTP-secret buttons reject duplicate submissions while pending.
- Connection refresh and SMTP-secret updates previously rebuilt the entire form, clearing unsaved edits and selected files. They now update only status elements.
- Hidden exam restart permission is preserved when saving; removing its UI must not change exam behavior.
- Theme layout uses three existing CSS variables, an allowlist shared with the server, and cached startup values. No new dependency, animation loop, polling or database table.
- Desktop email cards share two columns; narrow screens stack. Appearance has its own tab and isolated preview until Save.

## Existing protections verified in source

- Catalog scope sends metadata, not full questions, answer keys or attempt snapshots. SQL integration fixture measured 8,207 versus 651,956 bytes (fixture only, not a production latency benchmark).
- Background polling skips hidden tabs, active writes, full loads and in-flight polling. Scope/generation guards reject stale responses.
- Stable revisions and conditional responses avoid unchanged state emission. Active exams, editors and Settings suppress background rerenders.
- Settings enhancements batch through one animation frame and observe direct app child changes, not the whole subtree.

## Remaining risks / limits

- Full state revisions still require loading/serializing state before returning 304. Large administrative datasets can remain expensive; a version counter requires transactional invalidation across all writes and is not safely replaced by an arbitrary cache.
- The dashboard's full storage report still scans files and loads active question data. At larger scale, lazy detailed reports or a bounded cached aggregate should be measured and implemented separately.
- No production load test, browser rendering profile or visual browser verification was performed. No claim of zero lag or measured CPU reduction is made.

## Verification

- Full npm suite, JavaScript syntax checks and diff whitespace checks.
- Real-SQL isolated integration: lightweight status response, denied non-master access, rejected invalid layout, catalog access and existing exam flows.
- Theme tests: invalid values, contrast, cached startup, persistence, removed permission UI and appearance controls.
