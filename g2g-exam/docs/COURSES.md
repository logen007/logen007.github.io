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
The outline truncates chapter names on one line (full name in the tooltip) and
places two short category buttons, “Kiến thức” and “Bài tập”, on one row beneath
each chapter. Clicking a category opens its first existing lesson's detailed editor
directly; an empty category creates one lesson and opens it. Existing extra lessons
remain accessible via the editor's Back action and chapter overview, never deleted
or merged. Reopening a nonempty category must not create a duplicate.
The chapter gear opens its settings, with the actual chapter name editable directly
in the heading row (no separate “Chương N” heading or duplicate name field).
Category lists omit that entire chapter-settings toolbar and show only their own
lessons and actions. Renaming still uses the existing autosave/navigation flush.
Each chapter uses an explicit `minmax(0,1fr)`
track and a shrinkable title button: text ellipsis alone cannot constrain an
implicit auto track's intrinsic width. Omit empty placeholders and the redundant
general-settings button. General settings stay in the top gear and include cover,
level, price and descriptions. Hide the redundant cover/description headings
visually while retaining accessible labels. The cover uses a taller 4:3 preview.
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

Course images (cover, knowledge and exercise images) use `uploadCourseImage` and
the staff-only `/api/media/course-image` route. Original and optimized uploads are
limited to 1 MiB (labelled 1 MB); the server enforces the same limit independently.
Existing stored images are not rewritten. Exam images retain their 8 MiB limit.

Knowledge now uses one visual writing canvas, not separate raw textareas. The
WordPress-like interaction reference is the official
[Image block](https://wordpress.org/documentation/article/image-block/): insert
at the caret, select an image to expose its tools, move/replace/remove it and adjust
alignment/width/alt text. Support multi-file picking and native image-file paste/drop
through the same 1 MiB upload path. Capture/mapping of the selection during an
asynchronous upload must preserve newly typed text; insertion next to a selected
image must not silently replace it. An image batch is one undo operation.

Use the MIT Tiptap core/PM/StarterKit/Image packages pinned at 3.32.0, bundled locally
and lazy-loaded only when opening a knowledge editor. This dependency owns rich
selection, composition, native image dragging and undo/redo instead of a bespoke
contenteditable implementation. No CDN, editor account, service key or WordPress
server/plugin installation. Initial scope is paragraphs, bold/italic/underline,
H2 headings, images and history, not a complete WordPress CMS or arbitrary HTML.
Controls reuse the application tokens and focus/selection rules. Image tools appear
only for a selected image. Autosave never remounts the writing surface/history.
There is no duplicate preview underneath; the top global preview remains.

The editor's document is temporary UI state. Save the existing ordered safe
text/image `blocks`, at most 100, using the existing formatting markers (including
`[headline]`); do not introduce a new stored document schema. Preserve old image,
text and formatting content on opening. Repair missing/duplicate paragraph IDs
created by splitting/pasting before saving. Reject content over existing limits.
Pasted HTML is parsed through a restricted editor schema, external pasted image
tags are removed, and uploaded files alone use the image path. No active HTML,
iframes, links, embedded data URLs, new image URL shortcuts or scripts are stored.
Failed uploads retain content/selection and successful partial batches; retry only
the unuploaded files. Destroy the editor and pending selection bookmarks on exit.

Compatibility: unedited legacy `body`/`imageUrl` records and immutable releases
remain readable without a migration. Editing adapts them in memory; the next normal
save persists `blocks` with `contentVersion:1`. Normalization also mirrors joined
text into `body` and the first image into `imageUrl` for old readers (which cannot
display all new images or their ordering). The server rejects an old client that
would drop blocks from an existing block lesson; it must reload. Block image URLs
remain included in recursive media-reference discovery for drafts and releases.
Rollback may hide the new editor, but must retain the expanded validator/readers
and downgrade-write guard while block records exist. Do not roll back to an old
writer/server that silently strips blocks, and do not remove stored blocks.

CI regressions cover block validation/order, legacy compatibility, stale-client
write rejection, real SQL save/publication/enrollment, actual Tiptap/ProseMirror
formatting/history, mapped caret insertion, image controls and paste/drop entry,
1 MiB client/HTTP limits, and media-GC references. Codec/transport mocks and DOM
drag events are not evidence of native picker, drag UX, or visual acceptance.

For the original 1.7.0 update the owner explicitly approved local tests and browser
checks with synthetic data (23 October). That approval does not carry over to these
later refinements; use the default no-local-test workflow unless newly requested. Add domain,
route/SQL authorization, publication/progress/idempotency and UI regressions to
mandatory CI. No bypass/auto-merge. Browser testing requires explicit permission.
Do not claim production/visual verification from static or mocked evidence.

## Non-goals

No gateway, refund policy, time-limited access, paid-seat expiration, marketing
landing page, scheduled live teaching, manual grading or speculative Goethe/TELC
rules. These require separate owner choices.
