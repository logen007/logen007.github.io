# Courses — implementation contract

Owner request: 23 October 2026. Approved visual reference: Figma
`8tkv1pQzS4DpuXEYgDzcFe`, catalog `5:30`, curriculum `5:46`, learning `5:37`.

## Acceptance

- Courses before Exams in existing navigation. Catalog immediately displays real
  published courses, four columns on desktop, responsive below; no intro page or
  fabricated production enrollments/content.
- Teacher-owned drafts: name, uploaded cover, integer VND price (0 = free), short
  description, description, chapters containing knowledge lessons and exercises.
- Reuse exam question editor/renderers and automatic scoring. Practice includes
  choices, true/false, images/audio, matching, letter/heading matching, inline gaps
  and multiple choice. No manually graded writing/speaking practice.
- Free enrollment grants immediate access. Paid enrollment awaits master-admin
  confirmation; no payment gateway, automatic money collection, discount or
  certificate system is implied. Teacher cannot approve their own paid requests.
- Student learning, resume/progress, saved exercise drafts, automatic results and
  explanations, retakes and completion. Teacher sees their own students/results.
- Server authorizes every read/write. Catalogs contain metadata only. No answer
  keys before submission, no course body before enrollment except explicit trials.
- Published releases and enrollment revision are immutable. Updating authoring
  does not overwrite prior student work. Use optimistic authoring writes and
  idempotent enrollment/submission; archive rather than delete referenced data.

## Ownership / delivery

Course data is isolated from exams, exam attempts and grading. Shared question
components/scoring remain at their existing owners. New schema is additive and
idempotent; old application versions can coexist. Reverting source hides the new
module but retains its tables, enrollments, releases and media. No destructive
migration or production-data rewrite.

Use existing styles, media upload, safe text markup and authentication/origin
guards. Course media must be included in media-reference/backup discovery.

Course cover and knowledge-image buttons open the native picker on the first
click, synchronously within the user gesture. Their hidden file inputs must use
`data-image-picker-direct`: otherwise the global image-paste capture intercepts
the hidden input activation and prevents the picker from opening. Keep the shared
upload validation/transport in `src/media.js`; show upload progress, retain the
previous image and entered text on failure, and allow selecting the same file again.
`tests/courses-ui.test.mjs` binds the real global image-paste handler around course
authoring to cover that interaction, retry and save/publish persistence. The upload
transport is injected in this DOM test; it does not prove a native OS dialog or
browser rendering.

The server must not attach a flowing `data` listener to a multipart stream before
the asynchronous media-backup lock has been acquired: incoming header bytes can
otherwise disappear while waiting. Attach the size counter immediately beside
the pipeline inside the guard. Production-route HTTP regression delays that guard
for JPEG/PNG uploads and checks exact saved bytes, while retaining MIME mismatch,
HTML/SVG rejection and cleanup assertions. This is transport proof, not image
decoding or production/VPS verification.

Owner refinement (23 October): authoring follows the existing exam builder, not a
separate four-step wizard. Reuse its editable title, metadata/back row, settings,
preview/publication toolbar and `goethe-layout` / outline / editor surfaces.
The outline lists chapter names and their lessons with concise kind icons; omit
repeated category headings, empty placeholders and the redundant general-settings
button. General settings stay in the top gear and include cover, level, price and descriptions.
Chapter/lesson selections use the course URL and flush pending edits before
navigation; failed saves retain the current editor. Authoring autosaves without
rebuilding inputs, hides successful-save status and offers retry only on error.
No manual Save button, draft-mode label or member management in the editor.
Serialize saves, drain edits typed during a request, replay uncertain writes before
newer payloads and retain optimistic version checks. Keep existing publication and
enrollment semantics (course publication does not use the exam's unpublish lock);
internal unpublished storage is not a separate UI mode. Preserve first-click image picking.
Teacher management uses the exam-list table/filter/actions; member management lives
there. Student catalog cards and learning remain unchanged. DOM/SQL regression covers
autosave concurrency/retry, navigation/save failures, previews and publication, not
visual acceptance. Course-specific styling stays scoped; exam layouts are unchanged.

For this large update the owner explicitly approved local tests and browser
checks with synthetic data (23 October). The default no-local-test workflow for
other tasks stays unchanged. Add domain,
route/SQL authorization, publication/progress/idempotency and UI regressions to
mandatory CI. No bypass/auto-merge. Browser testing requires explicit permission.
Do not claim production/visual verification from static or mocked evidence.

## Non-goals

No gateway, refund policy, time-limited access, paid-seat expiration, marketing
landing page, scheduled live teaching, manual grading or speculative Goethe/TELC
rules. These require separate owner choices.
