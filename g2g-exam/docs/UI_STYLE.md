# G2G visual system

Approved direction: the user's neutral, rounded dashboard reference (8 October 2026).
Dashboard update approved 13 October 2026: white cards (no yellow tint) with 28px corners,
light large numerals, capsule activity bars, CPU line chart, RAM/disk arc gauges
and one charcoal R2 card. Keep the activity/system/storage layout from the approved
demo; technical details remain in disclosures. Scope this styling to the dashboard.
At tablet widths CPU spans both resource columns; on phones cards stack and the
exam table scrolls inside its own wrapper. Display real values and zero bars only.
This document governs presentation only. Exam rules remain in approved `specs/`.

## Visual hierarchy

- Show status through the title color instead of a separate status column:
  published/success green, draft/pending neutral, failed/error red. Preserve a
  readable status description (accessible name or concise text); never rely on
  color alone.
- Table column headings (e.g. Người tạo, Lượt thi) stay on one line
  (white-space: nowrap). On mobile, wide tables scroll inside their wrapper,
  never force the whole page wider. This rule does not apply to exam names,
  page/card titles or body content: those can wrap naturally.
- Mobile is a first-class layout: preserve touch targets, explicit gaps, stable
  alignment and local table overflow; avoid page-wide overflow and layout jumps.
  On touch devices, editable inputs, selects and textareas use 16px text before
  focus (including landscape and dialogs) to avoid automatic input zoom.
  This accessibility rule overrides compact-control font sizes. Keep pinch zoom
  enabled; creating an exam focuses the dialog close button on touch devices
  instead of opening the keyboard immediately.

- Google Sans Flex, optical sizing enabled. Body 15px/1.5 at weight 400;
  form controls 14px; supporting text 12–13px. Mobile editable text can use 16px.
- Page title 28–40px at weight 450; card heading 20–24px at weight 500.
  Avoid heavy uppercase titles and weights above 600 except the small G2G mark.
- Neutral pale gray canvas, white cards, thin neutral borders. No shadows on
  buttons/cards; reserve elevation for dialogs, notifications and image previews.
- Card radius 24px (20px on mobile), input radius 12px, navigation/actions pill.
  Icon-only controls are circular. Spacing follows 8/12/16/20/24/32px.
- Main content, exam and preview share a 1600px maximum via --max.
  The outer app includes 32px gutters on desktop and stays capped at viewport width.

## Shared ownership

Filter dropdowns, profile forms and exam access controls use the shared form rule in styles.css:
44px height, 14px horizontal padding, one native chevron and common focus/hover states.
All dropdown triggers are pill-shaped (`--pill`) across the site, including
filters, settings, preview part selection and compact letter controls. Text inputs
and textareas keep their existing radii; native multiple-selection lists are not dropdowns.
Filter dropdowns use the field name (e.g. Loại đề, Trình độ, Mã lớp) as the
unfiltered/default option instead of “Tất cả”, with no visible label above.
Keep an aria-label even after a value is selected. Preserve the original filter
values and behavior; filters with a required selection retain that selection.
This applies to dropdown filters, not count tabs such as “Tất cả (234)”.
Student exam filters use two compact dropdowns aligned with the action button.
The student exam grid adapts its column count to a 320px minimum card width;
when the viewport is narrower, cards fit 100% without horizontal overflow. Mobile uses one column. Card titles reserve exactly two lines and clamp overflow; the complete
title remains in the accessible text and title tooltip.
On mobile, gradebook filters use two unequal columns (1:1.6): provider, level,
class on the left; reviewer, student, status on the wider right.
Compact list actions use 40px height. Exam settings triggers are icon-only gears with accessible labels.
Exam access layout groups visibility, level and code creation, with feedback beside each form.

- `styles.css` owns tokens, base controls, navigation, page layout, exam and builder.
- `enhancements.css` owns settings/infrastructure layouts using those tokens.
  Do not append another global visual override block here.
- `src/ui/icons.js` owns outline icons. Buttons own the frame; do not use an icon
  asset with a second embedded border. Existing unframed Figma assets may be reused.
- `src/settings/palette.js` owns brand colors and contrast; `theme.js` applies and caches them. Use `--brand-primary`
  with `--brand-on-primary` for filled buttons; `--brand-soft`, `--brand-text` and
  `--brand-border` for selected answers/light states. Keep warning/success/error
  semantics fixed. Do not hard-code purple or blue selection states.

## Navigation and forms

- Publishing keeps one button toggling Xuất bản / Bỏ xuất bản immediately on
  success without rebuilding the editor. Unpublish uses an explicit authorized
  action; stale draft saves cannot publish or unpublish a versioned exam.
  Server-owned immutable releases use
  per-exam labels v1.0.0, v1.0.1, etc.; unchanged content reuses its version.
  Builder metadata uses separate small provider and level badges in shared brand
  colors, with the version immediately after the badges, separated by 12px. Version text is always
  v1.0.1 format, including drafts; its tooltip explains publication status. Preview is an eye icon with an accessible name and
  tooltip. No publication progress or success notice; retain error feedback.
  The exam-list action column never displays a version, including after publish/unpublish.
  Builder badges reuse the student-card provider and level colors: each category
  keeps its own recognizable color rather than using the same brand tint for both.
  Provider/level badges use gentle pastel backgrounds and darker same-hue text with
  at least 4.5:1 contrast, shared by student cards and the builder.

- Section prompts are independent ordered blocks, not owned by questions. The
  plus action inserts a prompt directly below the current one; up/down moves its
  text, image and listening audio together. Each block has image upload and, only
  for listening, audio upload. Desktop textarea fills the entire tools-column
  height; mobile stacks the two columns. Preserve existing question-owned content.
  All part types use the same image/max-width/tooltip and up/down/remove/plus
  controls. No position dropdown. Arrows cross adjacent questions or prompts;
  indivisible gap passages and horizontal tables move as one block.
  Image max-width stays visible even before an image is uploaded or after removal.
  Its tooltip is concise, split into two lines and capped at 240px.

- Example groups use one outer frame only. Inner question cards remain
  borderless and transparent even when mobile rearranges reading content
  outside the desktop question-column wrapper.

- Three illustrated A/B/C answers stay in three equal columns on mobile,
  including examples and preview, across all part templates. Use compact card
  padding, wrapped captions and uncropped responsive images.

- Student writing tasks show no question number or automatically generated
  “Schreiben Sie … Wörter” hint above the answer field. Preserve the authored
  prompt, including any word limits it explicitly contains, and the word counter.

- The total beside each skill is the sum of raw question maxima across all
  parts of that skill, including live editor changes. No weights, multipliers,
  normalized exam scales or per-question rounding. Examples contribute zero.

- Every scored answer has an editable score, including each inline gap and
  letter-table row. Use compact two-digit inputs with a visible “đ” unit next
  to answer/action controls. Do not add scores to decorative content or examples;
  preserve rubric-derived totals and existing score ownership.

- Every visible question card in the exam editor has a persistent “N.” label,
  not only a placeholder. Number scored questions sequentially across the exam;
  label zero-point/prefilled examples “Ví dụ” without consuming a question number.
  Preserve existing table number columns and gap-position labels, without duplicates.
  The same whole-exam numbering applies to validation dialogs, question/audio
  labels, preview, exams and result review. Never reset by part or skill, including
  legacy numberWithinSkill profiles. Authored prose and internal IDs are unchanged.

- Question audio controls share one row in this order: compact score, flexible
  audio upload/play, example, remove, add. Keep score input wide enough for two
  digits plus a visible “đ” unit, with an accessible score label; do not hide the
  unit or let the score consume spare row space.
  Audio filename truncates within its area. Keep all actions on the same row on
  mobile, directly below the question number and before the question text.
  Do not put audio on a separate row.

- Approved syntax (13 October 2026): shared-bank gaps use {ANZEIGE} directly
  inside the author-only passage. Strip the embedded answer into the private key
  and public option bank before persisting; student passages contain only gap objects.
  No separate correct-answer inputs. One shared score input applies to every question;
  preserve legacy mixed scores until the teacher supplies a common score. Keep
  passage, shared score and distractors inside a single rounded frame, with
  a distractor textarea (one option per nonempty line, with a live count).
  All content textareas have a shared minimum of 100px, including compact/mobile forms;
  the auto-sized exam title is exempt. Letter-matching and true/false question text
  uses a single-line input; long section instructions retain their textarea.
  larger writing areas keep their larger minimum through --textarea-min-height.
  Preserve existing answer text, distractors, scores and question IDs.
  New production attempts shuffle the bank and remap keys in their saved snapshot;
  reloads and existing attempts retain their order. A/B/C gap tasks also use one
  shared score and one rounded outer frame, preserving their separate choice groups.
  Per-question choices retain numbered {31}, {32} positions; {z} is the example.
  Existing shared-bank passages automatically show their current correct answers
  in the new author syntax. Legacy numbered/letter/backtick markers remain readable.
  Legacy square-bracket gap input remains readable during rollout. Keep ambiguous
  legacy [b]…[b] text unchanged and warn in the editor instead of guessing.
  [box]text[/box] explicitly frames instruction text. Existing unambiguous framed
  instruction tokens convert when loaded into the editor and persist on normal save.
  [img] uses the section image at the marker; no repeated trailing image.

- Instruction/prompt text wrapped in square brackets, e.g. [Richtig], renders
  bold inside a thin rectangular inline border. Keep raw text in editors.
  Instruction letters [a]–[h] use the same frame. This instruction-only rule
  does not alter dropdown gap parsing or answer text. Paired formatting and
  reserved image markers retain their existing meaning.

- Resolve the initial URL before allowing any page render. Repository updates
- Startup shows no temporary header, skeleton, or progress line. Keep the page
  neutral until its real content is ready; preserve error feedback and retry.

- Textarea content supports paired `[b]text[/b]` bold markup when rendered.
  Also support `[i]text[/i]` italic and `[u]text[/u]` underline. Cmd/Ctrl B, I,
  U wraps selected textarea text (or inserts a pair at the caret); selecting the
  complete marked span and repeating the shortcut removes that formatting.
  Email HTML/plain-text source fields are excluded. Preserve autosave events.
  The legacy `[b]text[b]` form remains readable. Selecting textarea text exposes
  a compact B action that inserts the new syntax without adding a permanent row.
  Editors preserve the raw markers; renderers escape HTML before formatting.
  In gap passages, a single `[b]` remains an answer marker. Keep formatting
  pairs within text, not across gap markers.
- Reading portraits float beside the opening text; following lines use the full
  width below the portrait. Each reading block contains its own float. Person
  letters use small yellow circular badges; letter-answer controls use weight 600.

- Always arrange controls to optimize space: group related actions beside the
  field they affect instead of adding unnecessary full-width rows. Preserve
  readable inputs, explicit gaps and touch targets on mobile. In B2 Reading 2,
  the image upload, pixel width and remove controls sit to the right of the
  article title; the passage occupies the full row below.

- Mobile skill/part navigation uses 1–5 equal columns matching the part count,
  capped at five. One part fills the row; five parts stay on one row. Keep
  explicit gaps and shrinkable tracks to avoid forced wrapping.

- Minimize visible form labels; prefer concise placeholders inside empty inputs.
  Gray rounded backgrounds are reserved for instruction blocks, not ordinary question wrappers.
  Examples always retain their own rounded border and fixed example colors
  (--example-bg, --example-border), including compact letter and binary editors.
  Short letter-matching questions use an unframed transparent row: number at left,
  answer selector, score and actions at right; a full-width single-line question
  input below. Keep the answer label accessible but visually hidden. No divider.
  Image-based binary questions likewise group image, score and actions beside
  the number, then full-width text and a compact pair of answers; no outer frame.
  Image hover previews fit the image, cap at 336px by 240px, sit above the trigger,
  and suppress duplicate native title hints. Empty upload controls retain paste hints.
  Heading matching uses a correct-answer text input beside each passage's score
  and remove/add controls, plus one distractor textarea (one option per line).
  Do not show a separate lettered option editor. Preserve old answer text and
  private keys when rebuilding the bank; existing attempt snapshots stay unchanged.
  Keep a persistent accessible name (aria-label or visually hidden label).
  For icon-only upload controls, use an accessible name and tooltip instead of
  redundant visible labels. Keep visible labels only when necessary for clarity.

- Simple message/error dialogs use the shared compact width of 500px, capped
  at the available mobile viewport width. Larger editors retain their own size.
- Popup close icons sit absolutely at the top-right inset (8px), with 44px
  targets and reserved title space. They do not occupy a separate header row.
- Listening settings show all parts as compact rows, each with one toggle:
  “Không lặp” / “Lặp 1 lần”. No tabs, flow diagram, advanced controls or
  default-score field. Instructions/examples play once; grouping follows the spec.

- Header account controls use one avatar opening a menu: Profile, other role
  options for authorized admins (Student, Teacher, Admin; omit current role),
  then Log out. No separate role selector or logout icon. Profile edits the
  current user's name; students also have a class confirmation-code field.
- Admin avatars have a small current-role outline badge at their top-left edge,
  absolutely positioned (18px circle, 14px icon) with a surface-colored rim.
  Role colors: Admin purple,
  Teacher blue, Student green. Reuse the menu role icons and keep the role in
  the avatar's accessible name and title; regular users do not have this icon.

- The exam-list title and “Tạo đề thi” action always share one row, including
  mobile: title left, action right, vertically centered. Never apply the generic
  mobile full-width title wrapping rule to this heading.

- Independent UI blocks must never touch: use explicit gap/margin, typically
  16–24px between search/filter controls and the table or card below (20px default).
  Use 8–12px within related control groups. Check spacing at desktop and mobile
  widths; do not rely on incidental text/label margins to separate blocks.
- Roster search fields are compact (maximum 360px, capped at 100% on mobile),
  with an accessible name even when the visible label is omitted.

- Tooltips always appear above and horizontally centered on their triggering
  button/control, never anchored to a table cell or full-width action row.
  Exception: image-paste hints appear below their upload control, centered,
  preserving the two instruction lines.
  Copy feedback follows this same rule and must not shift the layout.
- Student class selection supports typing a class code to filter suggestions.
  Confirm only an existing class; never accept an arbitrary class code.

- Admin and student navigation uses centered pills in the white rounded header;
  overflow wraps to a scrollable second row. Show only working controls.
- Preserve the role label and existing navigation action hooks used by modules.
- Question text + right controls share one row; answers fill a separate full row.
  `--editor-control` and `--editor-gap` determine the complete right-column height;
  the textarea stretches to match. Use the same controls for every skill.
- Audio uses one border around file label/play state. Uploaded answer images
  replace the placeholder icon, with hover/focus preview and click-to-replace.
- Setup/settings dialogs use the same input components as other forms.
- Controls have only two density levels: 44px for normal screens and 40px inside
  the exam builder. Both use a 12px radius, 14px horizontal inset, the shared
  border tokens, and identical hover/focus/disabled states.
  On touch devices both densities are 44px. `--control-font-size` owns text
  size for fields and buttons alike: 14px desktop, 16px touch. File/image/audio
  triggers use the same size, not smaller local values. Builder containers own
  their control density so generic input min-height cannot override compact
  rows. Neutral builder buttons use the same surface and border as inputs;
  primary, selected, disabled and destructive states remain distinct. Textareas
  can grow for content; circular icon controls keep their shared frame.
- Native dropdowns always reserve 42px on the right for one 16px chevron placed
  14px from the edge. Feature modules must not redraw or reposition that icon.
- User-approved exception: single-letter dropdowns embedded in reading text
  are 56×32px (36px high on touch screens), with pill corners and compact padding.
  Inside gap passages, omit the chevron and its reserved space; keep 8px
  horizontal padding and the existing dropdown interaction.
  Inline gap menus show the letter plus the full sentence when opened; the
  closed control shows selected answer text up to 24 characters, otherwise its
  letter (or question number when unanswered).
  Long-sentence choices open in a full-width mobile dialog (12px side gutters),
  with wrapping text, scrollable choices, clear and close actions; desktop caps
  the dialog at 720px. Do not rely on the narrow native iPhone select menu.
  Empty inline choices use the brand fill; selected choices use a pale green
  fill. This indicates answered, never correctness. Clearing restores the
  empty state; saved answers retain the selected styling when reopened.
- Cards use the shared 24px radius and 24px desktop padding. Compact/mobile
  variants may reduce padding to 18–20px but must not introduce a third radius.
- Primary, secondary, destructive and icon-only actions reuse `.nut`, `.nguy`
  and `.icon-btn`; feature modules own labels and behavior, not button geometry.
- Prefer a meaningful shared outline icon beside button labels. Keep existing
  icon-only navigation rules. Confirmation actions use two equal-width columns,
  matching height and centered icon/label groups; allow long labels to wrap.
  Exception: the exam cancellation link is centered, muted gray and text-only,
  labelled “Hủy bài thi”, with 12px separation below the primary actions.
  Submission and cancellation dialogs, buttons and completion feedback are in Vietnamese.
- File/audio/image pickers use the same border, radius, hover and focus language
  as text controls. Shadows remain reserved for overlays and media previews.
- Exam navigation stays after the questions: no sticky surface/background/border.
  Exam structure navigation is preview-only.
- Site-wide back/previous/next navigation shows arrow icons only, including
  preview headers, builder, grading, results, class details and return-to-edit
  dialogs, with accessible names and
  tooltips. Keep wide pill targets (at least 80px wide and 44px high on mobile),
  not small circular icon buttons. Preserve disabled states. Final submission
  and other non-navigation actions retain clear text labels.
  Borderless back arrows are the exception: use automatic width with no minimum
  width or horizontal padding, while preserving 44px height. Preview's part picker
  aligns to the right edge of its row.

## Preview layout

- Every student room entry uses the shared entry transition: normal start, code
  entry and resuming through a direct link. Reload/F5 during an exam skips the entry
  animation. Resuming never creates another
  attempt. Section navigation and answer updates do not replay the transition.

- Successful submission (including timeout) and confirmed cancellation reuse the
  same 1.5-second contracting wave/fade (entry stays 3 seconds); only color and status differ.
  Keep the full 1.1-second white coverage before changing pages. Center text states
  “Đã nộp bài”, “Đã hủy bài thi”, or “Hết giờ — Đã nộp bài” as appropriate. Server completion precedes
  the exit; errors keep the exam visible. Reduced motion skips exit animation delays.
  Do not repeat successful exit status in a corner toast; retain errors and unsynced-answer warnings.
  Confirmed cancellation uses shared danger red; submission/timeout use primary.
  All exit waves have feathered inner/outer edges and fade as they contract.
  Every exit ends with its wave at 1.5 seconds, without an extra overlay fade.
  After full white coverage, the white layer fades over the final 400ms, rather
  than being removed abruptly; logo, wave and white layer finish together.
  Coverage must paint before replacing the page; start revealing only after the
  destination has rendered, never at the same moment coverage begins.
  Exit awaits the destination render's state-loading promise (including recursive
  scope hydration), not just the initial synchronous render call.
  Exit logo/text share the wave's 1.5-second linear fade envelope; do not
  reuse the delayed entry caption, which leaves the logo visible after the wave.
  Entry retains its original primary-color animation.

- Writing-answer textareas default to notebook ruling and handwriting font.
  The exam editor owns a pen-icon “Viết tay / Viết thường” toggle button per writing
  question, saved with that question. Students and preview only render the saved
  style; never show them a style toggle. Style does not affect answers or scoring.
  Place this button between the score field and example button. Use the same
  circular icon-only control as its neighbors: pen for handwriting, T for normal
  type, with an accessible name and tooltip. Clicking switches immediately; no dropdown.
  Both writing-style states retain the standard neutral icon-button surface;
  distinguish them by icon, not a colored fill.

- Signature values in paper forms use a handwriting font stack (Snell Roundhand
  on Apple devices, Segoe Script/Bradley Hand/Segoe Print fallbacks), not the UI
  body font. Labels keep the normal UI font.

- Paper-style answer forms use the available width with small side gutters.
  On desktop cap paper forms at 760px and center them; mobile remains full width.
  Keep mobile inner padding at 20px vertically and 18px horizontally so content
  does not sit against the paper edge.
  Keep labels and their inputs on the same row on mobile (roughly 32% / 68%);
  wrap long labels within their own column. Headings, notes and images keep full
  rows. Reduce nested side padding and disable paper rotation on mobile to avoid
  wasted space or overflow; keep the paper appearance and score markers.

- In two-column exam content, the shorter column follows the page scroll within
  its own section. Recalculate after image/content resizing; disable this when
  columns stack on mobile. Keep long columns fully readable without nested scroll.
  Global rule (2026-10-12): all content inside a floating column must stay
  together in one wrapper and move as a single unit. Never float individual
  images, paragraphs, cards, or successive passage groups independently within
  the same column. Apply this to every multi-column floating layout.
  On mobile, restore each passage followed immediately by its corresponding
  questions. Desktop grouping must never put all passages before all questions
  on mobile. Reuse the same nodes and preserve answers across viewport changes.

- Keep the preview header and reading content on the same 1600px maximum column.
  Show exam title, a small preview badge, a short no-results notice and return to
  editing in one header, not several banners.
- Place a labeled native dropdown section switcher above the paper, with the
  current section selected and answer counts in its options. Whole-exam progress
  and a quiet reset link sit beside it. Do not render this in real exams.
- Show the current section heading once. Group its instruction and questions
  in one white paper surface, separated by whitespace rather than horizontal rules.
  Instruction/stimulus images fill their content column with automatic height;
  never cap their height or crop the text students need to read.
  Teachers may set an optional image maximum width in px; blank means full
  content-column width. Preserve aspect ratio and viewport responsiveness.
  Letter-table headings are teacher-editable, not fixed to Person.
  Questions worth zero points show their correct answer read-only and are excluded
  from question counts and progress. Consecutive standard example questions share
  one “Beispiel” frame and heading with 16px internal gaps; do not prefix them with
  an underscore or dash. Keep scored question pairs separate.
  In letter-answer question lists, display the example as "0." instead of "_";
  it still does not advance the scored-question numbering.
- Put prompt and audio control together; answer options fill the following row.
  Short text choices share one row with 2, 3 or 4 equal columns matching the
  visible option count, including mobile and examples. Keep gaps and 44px touch
  height; long text and image choices retain their readable layouts.
  Binary +/−, Ja/Nein and Richtig/Falsch controls sit beside the question when
  space permits, without A/B prefixes. Preserve radio semantics and 44px touch
  targets; wrap below the question on narrow screens. Apply to examples too.
  Selecting an answer does not bold its body text; retain normal weight and
  use the existing fill and border. Option letters stay bold.
  Selectable answer cards that already show selection with a border and fill
  have no visible radio dot and reserve no space for one, including image cards
  and examples. Keep native radio semantics, keyboard controls and a visible
  focus outline. This does not remove paper-form check marks or standalone radios.
  Image answers get a readable image area, not a tiny thumbnail beside long text.
- Current-section answered count lives once in the bottom navigation. Previous
  and next remain in normal flow without background, border or sticky positioning.
  Section changes return scroll and keyboard focus to the new heading.
- Scope preview-only presentation under `.thi--preview`. It uses local answers;
  The final Preview button reads “Kết thúc” (not an arrow) and returns to the
  editor of the exam being previewed, including direct-link previews.
  production part runtimes must never attach a live attempt to preview content.
- Builder return navigation is a compact borderless arrow to the left of provider/level on the same row, without a hover underline.
  The role-appropriate header menu remains visible when editing exams or grading.
  Preview return navigation remains before the exam title.
  The builder has no draft-save button or successful-save message; retain pending/error feedback.
  Flush pending edits before returning, switching sections, previewing or publishing.

## Brand settings

General admin settings use the shared two-column card grid on desktop and one
column at the existing mobile breakpoint. Do not constrain this panel to a single
left-aligned 760px column. R2 uses the same input/card/button tokens, with masked
credential inputs, a local live status and independent test/save actions. Its fields
remain disabled until the protected configuration loads; failed loading offers retry.

Exam image uploads are converted before upload to JPEG (quality 85%, maximum
2400px long edge, no upscaling), with white transparency background. Only the
optimized file is uploaded; never upload a second original. Use short English
position names (reading-2-q3-a.jpg), with a short unique suffix on the server.
Existing referenced uploads are not renamed or deleted as part of new uploads.
Clicking an image picker selects and focuses it for native Cmd/Ctrl+V; it must
not open the file dialog on the first click, including clicks on its icon.
The border changes to the brand color; clicking the selected picker again opens
the file dialog. Keep selection until focus/click moves away; hovering another
image never changes the destination. Use the shared tooltip with a short hint:
“Bấm lần 1 để chọn vùng dán” then “Bấm lần 2 để chọn ảnh” on a new line,
below the icon/control. No extra toolbar or buttons.
Tab selects the file input, Enter opens its picker, and Escape dismisses selection.
Keep text paste in editable fields untouched. Confirm image replacement and reuse the normal
file validation, compression and save path. Logo/favicon retain their formats.
Image removal buttons sit slightly outside the thumbnail's upper-right corner,
with reserved right spacing and visible overflow so they do not obscure the
thumbnail or overlap the next input. Preserve their existing touch target.

Student identity cards use one compact current-level badge, not a level ladder.
Keep name editing inline and group class confirmation with Share. Statistics start
with submitted exam count (“Bài đã thi”), including pending grading.

Production master settings save globally through the existing protected API.
Demo settings are explicitly local to that browser, never a privileged server write.
Validate hex input, preview locally before save, then apply to every route. Cached
theme application must not wait for a network response to render the page.

## Admin dashboard

- Show the same-account session snapshot immediately while loading fresh dashboard
  data. Retain it up to 24 hours and clear it on logout; never cache answers,
  credentials or full exam content. Patch changed DOM nodes without rebuilding
  unchanged cards. Keep open disclosures and user-selected CPU ranges.
- Coalesce infrastructure requests, reuse responses for 30 seconds, refresh the
  visible infrastructure at most once per minute; hidden tabs do not poll.
- Entering dashboard from catalog loads summary immediately, never on the next
  polling tick. Catalog data cannot overwrite the dashboard snapshot. Authenticated
  warm startup displays that snapshot before summary loads; AI accuracy does not
  wait for infrastructure metrics.

- Only CPU uses a time-series chart with its own range picker; RAM, disk and R2
  retain their ring/stat layouts. UpCloud-style CPU presentation approved on
  13 October 2026: compact left-column chart, yellow line/area, labelled time axis, five
  percentage ticks, underline range tabs and a visible maximum/average/current
  summary. The maximum/average/current summary uses three equal-width columns,
  without a redundant CPU column or horizontal scrolling.
  CPU SVG charts also scale to 100% of their card on mobile; do not set a fixed
  minimum chart width or make the period panel horizontally scrollable.
  Collect one real sample per minute independently of visits; retain
  366 days in PostgreSQL. Offer 1h/24h/1w/1m/1y ranges. Long views show bucket
  averages; statistics use original samples. Missing periods break lines and
  filled areas, and empty history remains empty. CPU has compact 12px controls
  and statistics; omit its technical details disclosure. Exam storage is full-width outside
  System; exam titles open the existing exam editor through its normal action.

- CPU percentage uses differences in host CPU busy/total counters sampled over
  approximately one second, with concurrent requests sharing the sample and a
  five-second cache. Display load averages separately as 1/5/15-minute numbers
  with core count, never as a percentage. Missing measurements remain unavailable.

- Dashboard redesign approved 13 October 2026 from the user's visual references:
  use independent compact cards with a clear numeric hierarchy. Keep the three
  activity cards first, then a system grid: CPU on the left;
  resource and R2 cards stack on the right. On phones stack the system cards, with
  mobile gutters and controls remaining readable. Only CPU uses a line chart.
  Healthy connections show a label and status dot; errors show their state too.
  Storage breakdown and sync timestamps use one clearly labelled disclosure per
  card. CPU has no disclosure. Warnings remain visible immediately.
  This replaces the prior expanded resource-breakdown presentation.
  Reference principles: [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
  and [Carbon simple charts](https://v10.carbondesignsystem.com/data-visualization/simple-charts/).

- New-student counts appear in the card heading (e.g. 3 học viên), without a
  duplicate large total. Default to the week/month/year range with the highest
  share of nonzero bins; ties prefer the shorter range. Keep true zero bins
  and respect manual period selection.
- Overview starts with charts; omit the four summary cards for pending work,
  exams, students and teachers (user request, 12 October 2026).
- Use aligned equal-height panels, adaptive day/week/month/year bars with editable
  date ranges, exam distribution and top students by submitted attempts in the range.
  Do not show grader rankings. Zero values
  have zero-height bars. Counts and labels remain readable without interpreting color.
- Surface CPU, RAM, disk and overall data size; detailed resource breakdown uses
  its card disclosure. Per-exam storage stays expanded outside System, largest first.
- Show missing metrics as unavailable, never as zero or a successful health check.
  Garbage collection has an explicit not-yet-scanned state. Keep failures visible.
- Use existing theme tokens and actions; no chart library or extra polling.
- AI grading omits the suggested/waiting count cards. Replace the healthy
  status badge with one horizontal row of provider pills, each showing
  its completed-job count. Give Groq yellow, Gemini blue, Grok purple and Mistral
  orange backgrounds with dark text and no outline. Provider pills have a 26px minimum
  height. Settings tabs stay on one line; Google login lives in Advanced and the
  remaining access tab is labelled Thi. Do not show an AI preference selector.
  Accuracy rows aggregate providers by exam and writing part; omit provider badges
  and keep the linked exam name truncated alongside the part and matched/total count.
  The list grows naturally without a nested scroll area. The pills
  may move together below the heading on narrow phones, never scroll sideways.
  On phones distribute all four providers equally across the available width;
  their counts may wrap within a pill while provider names stay on one row.
  Failures remain visible separately with the retry action.
- Technical details remain available but must not dominate the default screen.
- System connection statuses use a compact strip, not nested cards. Place CPU
  beside stacked resource/R2 cards, stacking on mobile. Exam storage is a
  separate full-width card with Last edit, using the same authoring timestamp
  calculation as the exam catalog.
- CPU uses SVG time-series with visible numeric labels; storage allocation uses
  a horizontal proportional strip beside its numeric total. Keep missing data distinct from zero. Never
  fabricate line-chart history from a single reading. R2 scan status is not
  browser delivery success. Reuse theme tokens without a chart dependency.

## Student result detail

- Header groups the student avatar, “Kết quả thi” with the actual exam level,
  student name and an icon-only Share button immediately beside the name.
  Exam provider/title/date remain below; the large result badge sits top-right.
- Use skill tabs, native point scales, a compact answer-distribution ring and
  labeled score bars. Counts exclude examples and oral grading; objective
  correct/wrong counts exclude manually graded answers. Never substitute answer
  accuracy for weighted examination score. Unpublished scores stay unavailable.
- Skill tabs expose submitted answers, published correct answers and an optional
  wrong/unanswered filter. Teacher identity and general feedback are real saved
  values, not generated commentary. Pending oral scores are not zero.
- Sharing uses the native share sheet or copies a text summary only; no public
  review link, private feedback, student email or answer keys. Result deep links
  remain authenticated and owner-only. Keep mobile layouts within the viewport.

## Teacher grading

- Place manual grading tabs first, with Back and Publish on the same toolbar.
  Oral grading belongs in a tab too. Keep the outcome badge at the header right.
  Show Result's shared skill score bars below the workspace, then automatic
  answers and published history. Reuse Result tokens and controls.
- Grading identity uses one compact Result-style header. Submission and feedback
  share a single split surface, stacked on mobile. Skill bars form a compact
  responsive grid. Automatic answer detail is a collapsed native disclosure;
  teachers open it when they need to inspect answers. Keep every filter available.
- Show the student's real avatar/name and current class, or “Chưa có lớp”.
- Use writing tabs without unmounting score inputs. Keep the approved per-part
  or grouped scoring keys and maxima; navigation never creates new score groups.
- “Trắc nghiệm” uses skill tabs and two-column answer cards (one on mobile),
  with separate wrong/unanswered filters and visible answer keys for teachers.
- Reuse the result-page outcome badge after publication. Open the next pending
  attempt from another student in the same real class, ordered by submission;
  if none remains, stay on the published detail. Bottom previous/next arrows
  navigate authorized submissions in that class after flushing pending grades.
  Before publication display “Đang chấm”, never a final pass/fail verdict.
- Plot only published, complete scores for the same student/provider/level;
  normalize differing totals to percentages and expose the native point scales.
  No extra polling or fabricated historical values.

## Verification

Run syntax checks, automated tests and G2G Exam Check before updating main.
The user requested to perform browser checks personally; do not open a browser
for verification unless they change that preference. Report that visual checks
were not performed when handing off.
