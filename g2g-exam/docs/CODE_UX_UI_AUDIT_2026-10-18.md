# Code / UX / UI audit — 18 October 2026

Baseline: main `670499692f6bf0a02c84cb94395686db4bebe235`, app 1.3.209.
Candidate: `audit/code-ux-ui-2026-10`. No production data, schema or exam rules
changed. This is a cross-layer engineering audit, not a complete penetration
test, source-line-by-line certification or WCAG conformance claim.

## Scope and method

Read owner docs (AGENTS, MAINTENANCE, UI_STYLE, ENGINEERING, QUALITY_GATES),
trace security/data/UI entry points, reproduce actionable findings, patch the
responsible layer, then run focused regressions and HIGH. Owner explicitly
allowed local browser verification with synthetic data. Browser used the real
Fastify application and built bundle with PGlite fixtures; no production login,
SMTP, AI, Google Drive or camera/microphone action. The preview listener is bound
to loopback. Infrastructure values shown there are local, not VPS metrics.

| Layer | Evidence reviewed | Boundaries / result |
| --- | --- | --- |
| Authentication / roles | auth cookies, OAuth nonce/state/return routing, requireUser/Role, backend-access tests | Signed HttpOnly/Secure production cookies and server role guards retained; no real OAuth account exercise |
| Browser request boundary | CORS registration, credentialed state/actions/upload routes | Fixed permissive empty production allowlist and missing common write-origin guard |
| Media / delivery | upload filename/type, static sendFile, R2 fallback and brand route | Fixed active-extension risk; existing media is not deleted/renamed |
| Exam / grading / privacy | state projection, attempt review authorization, snapshots, SQL regressions | No scoring changes; snapshot/privacy/publication/deadline behavior tested using fixtures, not official-score revalidation |
| Data flow / performance | API transport, per-user cache, grade autosave, history, performance suites | Metadata projection, conditional requests, outbox/save/flush tests retained; not VPS capacity proof |
| Operations | Docker import closure, semantic deploy probe, required CI gates | Existing 1.3.209 deploy health improvement retained; no backup restore, secret-history scan or SSH verification |
| UX | admin catalog/settings/dashboard, student catalog/results, profile and create-exam dialogs | Verified representative local paths and empty states; complete real-user journeys remain untested |
| UI / design system | token ownership, dark/light, badges, rounded controls, local table scrolling | Existing direction retained; no mass CSS overrides or redesign |
| Accessibility | keyboard/ARIA/focus lifecycle, field sizing, selected badge contrast samples | Fixed confirmation/create-dialog issues; no screen reader, axe scan, zoom-200% or all-components WCAG claim |

## Findings and changes

### P1 — client filenames could produce active same-origin media

Before: upload checked the declared image/audio MIME prefix, but stored the
extension from the supplied filename; delivery inferred the type from that
extension. A declared `image/png` with filename `payload.html` could be stored
as HTML. This is a code-level risk; no production exploit or incident is claimed.

Now: server-owned MIME-to-extension policy, raster image allowlist, safe audio
extensions/fallback, SVG upload rejection with conversion guidance. Legacy
non-inline media is an authenticated attachment with octet-stream + nosniff,
not an R2 redirect. Brand delivery adds nosniff and restrictive sandbox CSP.
PNG/ICO/GIF/etc. logos remain supported; picker no longer advertises SVG uploads.
Existing referenced bytes are untouched. Policy does not inspect/decode file
contents or replace malware/file-signature validation.

Proof: real Fastify multipart injection checks misleading filename, image/audio
suffixes, SVG and wrong-MIME rejection and student denial. Real static delivery
tests check HTML/SVG attachment headers and no redirect, plus audio Range/R2
fallback. `@fastify/static` overwrites inferred Content-Type by default; the
attachment branch explicitly disables its content-type inference.

### P1 conditional — production origin policy was fail-open when unset

Before: empty CORS_ORIGINS accepted arbitrary origins with credentials, and
common write handlers had no shared Origin guard. Exploitability depends on
deployment allowlist/cookies/site context; live private configuration was not read.

Now: production allows the PUBLIC_URL origin plus explicit CORS_ORIGINS, not
arbitrary origins. Origin-bearing POST/PUT/PATCH/DELETE from untrusted or opaque
origins fail before write handlers, including simple text/form requests. Explicit
development allowlists remain effective; no-Origin CLI requests are retained.
This is not a CSRF-token system or an authentication bypass.

Proof: real Fastify handler counter remains zero for external, sibling and
opaque Origins; trusted and no-Origin requests succeed. Before release, verify
production PUBLIC_URL / CORS_ORIGINS match every intended browser entry origin.

### P2 — modal keyboard lifecycle incomplete

Local browser reproduced Tab leaving the confirmation overlay (activeElement
became body). Confirm replacement also removed the DOM without settling the old
caller or cleaning its document listener. Create-exam overlay lacked dialog
semantics and Escape handling. Profile close did not restore the opener focus.

Now: confirmation traps Tab/Shift+Tab, contains outside focus, restores a usable
control, settles superseded callers and accepts each action once. Existing
profile/create overlays share a small keyboard helper; hidden options are not
focus targets. Create-exam has dialog name/role and labeled Close. Required
profile completion is still not dismissible; save/business behavior is unchanged.
Focused jsdom tests cover cancellation, replacement, extras, repeat clicks,
Escape, forward/backward wrapping and required dialogs.

### P2 — unconfigured logo produced broken-image header

Reproduced with default local settings: the header requested absent /brand/logo
and alt text overlapped the name. Now it uses existing G2G text when no logo is
configured, keeps configured-logo behavior, and prevents the logo box shrinking.
No branding settings are changed. Tests cover configured and absent logo cases.

## Browser evidence actually collected

| Screen / state | Viewport evidence |
| --- | --- |
| Admin dashboard, light | Default desktop and 390px screenshot; native disclosure and infrastructure/empty states inspected |
| Settings general | 390px light/dark screenshots; page fits viewport; editable text fields 16px; no unnamed visible buttons in inspected state |
| Admin exam catalog | 320 / 390 / 768 / 1440px: document width matched viewport, wide table stays locally scrollable |
| Create-exam dialog | 390px dark: named dialog, keyboard remains inside, Escape returns focus to create button; no exam created |
| Student catalog | 320 / 390 / 768 / 1440px: no document overflow or unnamed visible buttons in fixture state; 390px dark screenshot |
| Student results | Empty-results message and action to catalog inspected |
| Profile / name confirmation | 390px light baseline reproduction; final dark bundle rechecked: two Tabs return to Cancel inside confirmation, Escape restores usable profile control; screenshot saved, no name submitted |

Sample computed dark colors from the actual student catalog (not guessed from
screenshots), with the existing colorContrast function: Goethe 6.49:1
(#C5E3FF / #174D85), A1 6.81:1 (#A4FFE0 / #075C49), primary button 7.18:1
(black / #94979E). These samples do not certify every token/background/state.
44px action height is a project ergonomics rule, not a claim that every 44px
criterion is WCAG 2.1 AA. Screenshot fixtures use the default brand, not the
production brand settings. No automatic aesthetic/coverage score is assigned.

## Follow-up, not silently implemented

- P2: file-signature validation / decoding policy for raster/audio; use format
  fixtures and preserve current authored assets, not a broad delete or rename.
- P2: verify all intended production entry origins before releasing the stricter
  request policy. No reading secrets or altering infrastructure to do this audit.
- P2: complete role-by-role browser journeys for real exam/preview/writing,
  published results, teacher grading, Backup and speaking permission failures;
  current automated SQL/domain/DOM tests do not replace these browser journeys.
- P2: screen reader, 200% zoom, reduced-motion device settings and real Safari/iOS
  keyboard/camera testing. The local browser is not a physical iPhone test.
- P2: visual-regression baseline/axe pilot with reviewed synthetic fixtures. This
  turn did not install a new browser framework or approve baselines automatically.
- P2: split app.js (1623 lines at baseline) by ownership as related tasks justify
  it; CSS (1553 lines) and enhancements (269) remain coupled. No bulk refactor,
  duplicate palette or new scoring source of truth in an audit patch.
- P2 ops: real restore drill, external-provider delivery, live deployment SHA and
  secret-history scan remain outside the evidence. No claim of zero risk.

## Reference criteria

Security recommendations follow [OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
and [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
Modal keyboard expectations follow [WAI-ARIA APG modal dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
Findings above come from this repository/tests/local browser, not from assuming
that a generic guideline proves a production vulnerability.

## Candidate verification and delivery

- Local macOS Node 26.5.0: HIGH **36/36 passed**, full build and dependency audits
  web/backend exit 0 (0 reported vulnerabilities at the time of the run).
- New real-library/SQL/DOM tests exercised the fixes without external services.
  An old source-string assertion for extra-action changed to reflect the
  idempotent handler; added DOM proof still verifies close-before-extra-action.
  The logo assertion now checks both absent and configured-logo behavior.
- `git diff --check` passed. No schema migration, existing-file deletion, app
  version bump or production deployment in this audit candidate.
- Local browser evidence lives outside Git in the chat workspace's
  `audit-evidence/`: `confirmation-dark-after.jpg`, `student-catalog-dark-after.jpg`.
  No real user data is included. Desktop/mobile checks remain representative,
  not an exhaustive visual regression suite or independent accessibility review.
- CI Node22 Ubuntu and PR metadata are recorded on the candidate PR; read its
  current status rather than inferring completion from this local report.

### Release preparation 1.3.210

Owner requested continuation after the audit. Read-only public checks on
18 October: health ok/database true, running version 1.3.209 and publicUrl
https://exam.g2gcareer.com. OPTIONS preflight on saveAnswers returned204 with
credentialed allow-origin for that canonical origin. A sibling test origin and
an external test origin returned500 without CORS permission under the old code.
This confirms the canonical origin is already explicitly permitted by existing
deployment configuration; the candidate retains it. No business write, login
or secret read was performed. Exact private environment values and any other
intended entry origins were not inspected. Added real Fastify+CORS preflight
regression (trusted204/credentials, untrusted no allow-origin) before release.
Version bumped to1.3.210; earlier no-version/no-deploy notes describe the initial
audit-only stage. PR checks must pass this final candidate before merge. Public
health/version will be checked after deployment; no SSH/timer proof is claimed.

## Follow-up: local role journey, 18 October

Verified against main 10ba8eb (1.3.210), using the loopback-only performance
fixture with PGlite and signed synthetic admin role switching. No real accounts,
production business writes, AI requests, Drive operations or email delivery.

- Student: started Fixture, selected incorrect B, reloaded the page and observed
  B still selected with 1/1 answered. Submitted through the confirmation dialog;
  results showed 0 correct, 1 incorrect and awaiting teacher publication.
- Teacher test role: opened that same attempt from Bài Thi, entered oral score
  10/15 and a synthetic feedback string, published and reloaded. Score and
  feedback persisted. Student home then showed latest score 10; result detail
  settled at 10/16 total, 10/15 oral, 0/1 reading, 1 incorrect and the feedback.
  Intermediate animated counters were not treated as final values.
- Screenshot outside Git: chat workspace audit-evidence/
  published-result-journey.jpg. No product changes or version bump were needed.

Limits: the fixture has one reading question and legacy A1 oral scoring; this is
not validation of a complete approved exam structure. Role switching is not proof
of authorization boundaries for independent teacher/student accounts. Writing,
media playback, interrupted-network recovery, Backup/restore, speaking device
permissions, real Safari and external-provider delivery remain unverified by
this browser journey. Existing SQL/domain tests provide separate evidence only.

## Extended audit and fix: 1.3.211

Owner requested completing remaining feasible checks. No production data or
external provider was used. New product change is limited to a persistent German
accessible name on free-response writing textareas in the shared student/preview
renderer, retaining question-number context where present. Browser accessibility
tree exposed an unnamed writing field; a regression failed before the fix and
passed afterward. No visible text, layout, authored prompt, score or exam rule
changed (business specification N/A). Reuses the existing renderer, no new styles.

### Executed evidence

- `node tests/preview.test.mjs`: 43 checks passed, including the new field name
  for single-question and numbered writing tasks.
- `node tests/exam-outbox.test.mjs`: passed. Added durable multiline German-text
  recovery after network failure, HTTP 429 and 503; reload overlays pending
  values, retains operation IDs, then removes acknowledged writes from storage.
  Existing conflict, in-flight edits and disk-failure cases remain. These use
  transport/storage doubles, not a browser disconnected from the Internet.
- Local browser, desktop and 390x844 viewport: started preview-only writing
  fixture, entered a 23-word message with newlines/umlauts/ß, reloaded and observed
  the exact answer and count, submitted, then verified the writing answer in the
  unpublished result detail. No page-wide overflow at 390px. Screenshot outside
  Git: audit-evidence/writing-reload-mobile.jpg. Viewport emulation is not touch
  input or physical iOS testing. The fixture tests transport, not a full exam.
- HIGH 36/36 passed on baseline and again on the final 1.3.211 product/test
  candidate, macOS Node 26.5. Both dependency audits reported 0 vulnerabilities
  at execution time. Includes independent-identity SQL authorization, answer-key privacy,
  provider leases/retries, submission idempotency, audio-flow/domain tests,
  media delivery/ranges, speaking permission/recorder errors and phone DOM states.
  Do not count doubles as real camera/100ms/AI delivery or actual audio output.
- Real isolated restore drill **passed**, exit 0 on macOS, Homebrew PostgreSQL
  16.15, age and Rclone local backend. Command: `PATH=/opt/homebrew/opt/coreutils/libexec/gnubin:/opt/homebrew/opt/util-linux/bin:/opt/homebrew/bin:/usr/bin:/bin TMPDIR=/private/tmp /opt/homebrew/bin/bash tests/backup-local.integration.sh`.
  Initial missing-tool attempts were unavailable, not passes. Final run used a
  fresh owner-only Unix-socket cluster, imported the real schema, backed up and
  restored Unicode answers, account roles, settings and media with SHA-256 checks.
  Wrong identity and tampered archives were rejected without a staging directory.
  Real media barrier excluded concurrent writers. Both temporary databases and
  archives were cleaned up by the drill; no normal database was targeted.

### Remaining external/manual evidence

Physical Safari/iOS, screen reader announcements, real camera/microphone and
audio output, live AI responses, SMTP, 100ms recording and Drive delivery still
need their respective devices/services. They are not silently treated as passed.
Google Drive was not tested by the local restore drill. No live restore, VPS
deployment SHA or guarantee of exhaustive WCAG/security coverage is claimed.
These limitations do not authorize changing production credentials or data.

## Audio-loading follow-up: 1.3.212

Reproduced a pending metadata request with no error/loadedmetadata event: the
shared section player had no timeout and retained its busy/disabled state.
The regression failed on baseline. `readAudioDuration` now bounds the wait to
15 seconds, removes listeners/timer on success/failure, and handles a synchronous
load failure. This is a transport wait, not an exam time or scoring rule.

Also verified/fixed resume-rejection cleanup in `playSectionSegment`: cancel its
animation frame and queued resume, remove handlers, and never replay after the
segment has ended. Server-owned start/complete permissions, max sessions and
configured repetitions are unchanged. No schema or saved exam changes.

- `tests/audio-runtime.test.mjs` executes the actual app helpers with controlled
  media/timers. Covers missing/late/valid/error metadata, throwing load, resume
  rejection, queued replay after completion, caller busy-state cleanup, retry
  without starting a server session, and successful two-repeat start/complete.
  It is imported by preview tests so normal suite/CI execute it.
- Focused audio + preview tests passed; HIGH 36/36 passed (macOS Node26.5,
  dependency audits reported 0 vulnerabilities). The final expanded caller tests
  were rerun with the focused suite after HIGH; CI must test the committed head.
- Browser on loopback synthetic fixture decoded a generated PCM WAV (duration
  1 second, readyState4), ran the configured two-repeat playback and reached
  ended=true/currentTime1 with no media error. UI showed already played, button
  remained disabled and audioBusy cleared. This proves browser decoding and
  playback lifecycle, not that a person heard sound from a physical speaker.
  Screenshot outside Git: audit-evidence/audio-playback-complete.jpg.
- Preview-only fixtures include an intentionally open WAV response to exercise
  metadata timeout; they are never enabled by the quality runner/production app.
  Preview IDs now use UUIDs to permit separate synthetic attempts in one run.
- The intentionally open response was also exercised in the built browser:
  metadata stayed at readyState0 without a media error; after timeout the UI said
  Audio konnte nicht geladen werden, the play button was enabled and audioBusy
  was absent. Screenshot: audit-evidence/audio-timeout-recovered.jpg.

The existing physical-device/external-service limitations above still apply.

## Device-failure verification follow-up

Extended `speaking-devices.test.mjs` without changing product code or version.
Explicit cases now exercise unsupported API; denied/missing/busy devices;
disabled, muted or ended audio/video tracks; rejected video playback; interrupted
sample recording; recorder errors and handler/recorder cleanup. All passed on
Node26.5 macOS. `speaking-phone.test.mjs` also passed with the isolated jsdom
runtime, covering retry/entry gating and phone lifecycle. Syntax and diff checks
passed. Prior HIGH evidence still applies to the unchanged product source;
CI must run on the final test-only commit before merge.

No new product failure was reproduced. These are controlled device/DOM doubles,
not browser permission prompts, physical camera capture or an iPhone call.
Remaining physical iOS and live AI/Drive/SMTP/100ms checks require a separately
authorized real-device/service session; the earlier local-only browser permission
does not authorize those external actions or disclosure of recordings.

## New-image signature follow-up: 1.3.213

Owner explicitly excluded speaking from further work. Continued the upload-policy
follow-up instead, using isolated SQL/Fastify, no production uploads or deletions.
Reproduced HTML declared as image/png receiving HTTP200; the new HTTP assertion
expected400 and failed on baseline. Earlier extension/nosniff protections remain;
this result alone does not prove script execution in a victim browser.

The existing media-upload-policy owner now checks a bounded 4096-byte header
against the declared supported raster type: JPEG, PNG, GIF, WebP, BMP, ICO and
standard AVIF ftyp brands. Upload auth, size limits, generated extensions and
audio compatibility are unchanged. A mismatch throws400 with conversion guidance.
New rejected files are removed inside the existing media-mutation barrier, as are
truncated/oversized files. No existing file is renamed, scanned or deleted.

- New pure header tests cover every supported MIME alias, normalized MIME,
  HTML/SVG spoofing, wrong MIME, truncated PNG, zero dimensions, high-bit marker
  spoofing and bounded malformed AVIF boxes. These fixtures prove header policy,
  not complete image decoding. Imported by R2 routes so CI executes them.
- Real multipart/Fastify/SQL regression: genuine PNG payload with a .html name
  still gets a generated .png URL; HTML, empty/truncated PNG and PNG declared
  JPEG return400, leaving exactly the pre-existing upload directory contents.
  This test passed after the fix. Student upload remains forbidden.
- Focused header tests, test:r2 and final HIGH36/36 passed on macOS Node26.5;
  web/backend dependency audits reported0 vulnerabilities at execution time.
  Required CI must pass the exact committed head before merge.
- Header markers cross-checked with the official [WebP container specification](https://developers.google.com/speed/webp/docs/riff_container)
  and [AVIF specification](https://aomediacodec.github.io/av1-avif/latest-approved.html).

Limit: signatures are not a full decoder, CRC checker, re-encoder or malware scan;
a deliberately crafted file with a matching header can still pass. AVIF probing
is bounded to its initial4096 bytes; unusual newer container variants may require
conversion to JPG/PNG. Do not claim all invalid images are rejected. Full decode
and audio-content validation remain separate policy/compatibility work. No new
runtime dependency, schema change or exam-rule change. Roll back by reverting
this PR normally; previously stored assets are untouched.

## Lost answer-receipt recovery: 1.3.214

Reproduced with the real Fastify actions, signed synthetic student cookie and
isolated SQL: save operation A commits, its receipt is discarded, student edits B
and reloads. The old outbox retained only B with the original base version, so
the server correctly returned409 against A. This was a false cross-tab conflict
from the student's perspective, not data deletion on the server. The regression
failed on baseline and passed after the fix.

The outbox now durably records the exact in-flight operation before sending.
Unknown outcomes (network/5xx/429) replay that operation unchanged after retry or
reload, using the server's existing idempotency check, then rebase the newer
pending edit on its acknowledged operation. Explicit terminal rejections discard
only the rejected in-flight envelope, retaining current answers so corrected
validation input can be submitted. Genuine version conflicts are not rebased
blindly. Deadline, scoring, auth and server actions remain unchanged.

- Real HTTP/SQL regression covers lost receipt after commit, newer edit, durable
  reload, exact operation replay, correct latest answer and acknowledged cleanup.
- A competing client update still returns409 and retains the local latest answer;
  it cannot overwrite the competitor. Retrying submit returns the original
  submittedAt receipt. No new attempt is created by this retry.
- Pure outbox tests include correcting a400-rejected answer; existing restore,
  429/503/offline, disk failure and concurrent-edit tests passed. test:sync passed.
- Legacy local drafts without the optional inflight field remain readable; no
  IndexedDB version or backend schema migration. The existing single-tab lock
  remains. A rollback to the old client loses this new recovery behavior; do not
  delete local drafts or restore production data as a source-code rollback.
- Preview-only controls can discard successful save responses until restored and show
  the synthetic latest writing answer for browser proof. These routes exist only
  in the loopback test fixture, never in the production server.

No live exam, recording or external provider was used. Speaking remains excluded
from active audit work. Browser proof and final gate/release status follow below.

- HIGH36/36 passed on the product/test candidate (macOS Node26.5), including real
  SQL/HTTP recovery tests; web/backend dependency audits reported0 vulnerabilities.
  Final preview-control refinements were exercised in-browser and syntax checked;
  required CI must pass the final committed head before merge.
- Built local browser proof: discard successful save receipts, confirm the
  database stores Erste Antwort while the client gets no acknowledgement; edit
  Neueste Antwort and F5 while receipts are still blocked. The client retains
  Neueste Antwort and database still shows Erste Antwort. Restore receipts, then
  read back database showing the exact latest text with fünf/Grüße/Köln/äöü/ß.
  No conflict was shown. Screenshots outside Git: audit-evidence/
  answer-ack-recovery.jpg and answer-ack-server-proof.jpg. This is controlled
  loopback connection failure, not a real mobile-network outage.

## Draft cleanup ordering: 1.3.215

Reproduced with the actual ApiRepository method and a delayed write: calling
closeExamDraft stopped the queue but closed its store/released the editing lock
while the network write was still pending. Its later acknowledgement can still
persist through ExamOutbox. The new regression failed at closed=1 versus0 on
baseline. This is a lifecycle race; it is not evidence that a real student's
answer was lost. The prior durable in-flight recovery protection remains.

The existing cleanup owner now waits for both the current persisted snapshot
and active drain promise to settle (success or failure), then closes its store
and releases its captured lock. The queue is detached/stopped immediately, so no
new background batches are scheduled. Existing bounded API request timeouts
remain; no new network wait, scoring, deadline or sign-out policy is introduced.
No local database version or server schema migration.

- test:sync passed with delayed success/failure, immediate queue stop, delayed
  close/lock release and repeated-cleanup exactly-once assertions.
- Added a real ExamOutbox+ApiRepository combined regression with a guarded store:
  a delayed send finishes after cleanup begins, persists the empty acknowledged
  queue, then closes the store and releases the lock. No write to a closed store.
- Existing outbox recovery and performance tests passed. Local HIGH passed all
  36 checks on Node 26.5, with zero dependency audit vulnerabilities. Required CI
  must pass the final candidate before merge. No browser UI change was made; these
  are controlled lifecycle/storage tests, not physical tab-close certification.

Speaking remains excluded. No production account was logged out and no live
attempt was changed. Rollback is a normal PR revert; do not delete drafts or
restore production data. Public post-deploy proof remains health/version only.
