# Where to make changes

Keep UI changes separate from grading, transport and persistence changes.

| Responsibility | Owner |
| --- | --- |
| Approved exam structure, timing, scoring rules | `specs/`, loaded through `src/exam-specs/` |
| Automatic single-question arithmetic | `src/domain/question-score.js` (local + server) |
| Skill totals / pass conditions | `src/domain/gradebook.js`, `result-summary.js` |
| Published result projection / answer-key visibility | `src/domain/attempt-review.js` |
| Result loading in browser or local preview | `src/controllers/student-review.js` |
| Result authorization and database reads | `server/src/actions/attempt-review.js` |
| Result rendering, tabs and sharing | `src/views/attempt-result.js` |
| Screen state / navigation wiring | `src/app.js` — delegate rules and data loading |
| Server action routing | `server/src/actions/index.js` — delegate handlers |

## Safe change checklist

1. Identify the owner above. Extend it instead of copying its rules into a view or route.
2. Add a regression case before changing behavior. Pure domain tests do not need the VPS.
3. For structural changes run `npm test` and `sh server/check-code.sh` before and after.
4. Run `npm run test:sync` for synchronization, `npm run test:r2` for media changes.
5. When a backend import adds a shared module, update `server/Dockerfile`.
   `tests/vps-backend.test.mjs` checks the transitive shared imports are packaged.
6. Preserve snapshot precedence, server-owned attempt status, ownership checks,
   and hiding unpublished answer keys. Never fall back to catalog metadata after
   a detail request fails.

`tests/maintainability.test.mjs` covers the scoring and result-loading boundaries
with an isolated database double. It neither connects to production nor creates
real student results. Existing UI rules remain in `docs/UI_STYLE.md`.
