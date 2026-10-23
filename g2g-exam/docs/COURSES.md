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
remain accessible via the clickable chapter title/overview, never deleted or merged.
Reopening a nonempty category must not create a duplicate. Detailed knowledge and
exercise editors omit the Back button, visible lesson-name label and trial checkbox.
Keep the name input accessible; hiding the checkbox must not rewrite existing trial flags.
The chapter title opens its settings, with the actual chapter name editable directly
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
The learning sidebar uses the same two-column category row: short “Kiến thức” and
“Bài tập” buttons without repeated headings, lesson-name lines or question-count
metadata. Keep real lesson titles in tooltips/accessibility labels; when a category
has multiple lessons, number its short buttons so no lesson becomes unreachable.
Course-detail curriculum descriptions remain unchanged; completion/current styles
and trial/enrollment authorization still apply.
Serialize saves, drain edits typed during a request, replay uncertain writes before
newer payloads and retain optimistic version checks. Keep existing publication and
enrollment semantics; publication now uses the exam-style unpublish lock described below.
Internal unpublished storage is not a separate UI mode. Preserve first-click image picking.
Teacher management uses the exam-list table/filter/actions; member management lives
there. Student catalog cards and learning remain unchanged. DOM/SQL regression covers
autosave concurrency/retry, navigation/save failures, previews and publication, not
visual acceptance. Course-specific styling stays scoped; exam layouts are unchanged.

Course images (cover, knowledge and exercise images) use `uploadCourseImage` and
the staff-only `/api/media/course-image` route. Original and optimized uploads are
limited to 1 MiB (labelled 1 MB); the server enforces the same limit independently.
Existing stored images are not rewritten. Exam images retain their 8 MiB limit.

Publication refinement (23 October): reuse the exam publication label renderer and
server label generator, immutable JSONB snapshots and the existing global API gzip
compression (`server/src/index.js`, accepted gzip + JSON over 1 KiB). Do not invent
a separate opaque compressed snapshot format: JSONB storage/media discovery,
backups and legacy releases stay compatible. This is transport compression, not a
new downloadable ZIP or a claimed measured storage saving.
Published courses are read-only in both controller/UI and server, including master
and stale/forged clients. Only explicit `POST /unpublish` unlocks authoring; it hides
new enrollment/catalog access but active/pending enrollment references, content,
progress and scoring remain pinned to their original release. Published identical
save-receipt replays are harmless no-ops; changed writes return 409.
Publication has a separate ordinal/label from optimistic authoring revisions.
New releases store their hash/ordinal/label in release metadata; old release rows
need no rewrite and derive the ordinal from existing release order. Changed content
creates the next publication version; unchanged republishing reuses the previous
snapshot/version as exams do. Serialize publish/unpublish under the course row lock,
check expected authoring revisions and tolerate lost receipts without duplication.
Freeze authoring while publishing; resync authoritative status if its receipt is
lost. Existing already-published authoring becomes read-only without rewriting it.
No schema migration, enrollment repinning or production-data edit. Rolling back UI
may hide the new controls, but retain server write lock/unpublish semantics while
these contracts are in use; old clients must reload rather than edit published data.
CI covers role/version/HTTP guards, no-op/retry publication, UI read-only/unlock,
lost publication receipts and enrolled learning/grading throughout unpublication.

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
Controls reuse the application tokens and focus/selection rules. The writing canvas
alone omits its focus rectangle by owner request; toolbar/input keyboard focus stays
visible. Text paragraphs and H2 headings support left/center/right/justified alignment;
image alignment uses the same toolbar (justify disabled for images). Image tools appear
only for a selected image. Width is an integer 10–100 percent, adjusted by number,
slider or corner handles; centered resizing follows both sides of the center.
Corner keys adjust 1%, Shift 10%, Home/End select bounds. Pointer moves preview only,
pointer-up commits one undoable change, cancellation/blur restores the saved size,
and editor disposal removes drag listeners. Autosave never remounts the writing surface/history.
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
save persists `blocks` with `contentVersion:1` for classic layout, or version 2 when
text has a non-left `align` or image width is not a legacy 25/50/75/100 preset.
Default left text alignment is omitted to keep old normalized shapes stable.
Normalization also mirrors joined
text into `body` and the first image into `imageUrl` for old readers (which cannot
display all new images or their ordering). The server rejects an old client that
would drop blocks from an existing block lesson; it must reload. Saving an existing
version-2 lesson requires the authoring envelope capability `knowledgeLayout:1`,
owned by `KNOWLEDGE_LAYOUT_VERSION`, so an old visual converter cannot silently
strip text alignment/custom width. The new editor can deliberately reset layout
to classic values. No persisted SQL migration or release rewrite is performed.
Block image URLs
remain included in recursive media-reference discovery for drafts and releases.
Rollback may hide the new editor, but must retain the expanded validator/readers
and downgrade-write/capability guards while block records exist. Do not roll back to an old
writer/server that silently strips blocks, and do not remove stored blocks.

CI regressions cover block validation/order, legacy compatibility, stale-client
write rejection, real SQL save/publication/enrollment, actual Tiptap/ProseMirror
formatting/history, paragraph/heading alignment and custom image width through
save/publication/enrollment, pointer resize commit/cancel/disposal with controlled
geometry, mapped caret insertion, image controls and paste/drop entry,
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
