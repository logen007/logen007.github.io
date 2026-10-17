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

- User preference (17 October 2026): never use an outer ring/outline to indicate
  selection. Keep keyboard-only focus-visible indicators distinct from selected
  state. In colored filter groups, selected items retain their color while other
  items turn neutral gray; selecting the active item again clears the filter and
  restores all colors.

- Personal light/dark mode (17 October 2026) uses a 44px moon/sun button directly
  before the account avatar. Save the choice in browser storage and restore before
  first paint. Dark uses near-black canvas, charcoal cards, raised neutral controls
  and readable light text, following the supplied SmartThings references. Shared
  tokens own surfaces and semantic colors; derive readable dark accents from the
  configured brand hue. Switching never rebuilds a page or interrupts input.
  Provider/level, result status and AI badges use corresponding light/dark token
  pairs throughout the site. Dark badges use fresh saturated blue, violet, pink,
  teal, amber and coral fills with clear light text, following the staking reference
  approved 17 October; avoid gray-tinted muted fills. Charts use vivid saturated
  accents from the same hue families. Keep neutral statuses neutral.
  Status-colored titles share dedicated tokens: vivid coral for failed and fresh
  green for passed/published in dark mode; pending titles keep the normal text.
  Exam entry/exit coverage uses the current surface color. The theme button has no tooltip, keeping
  its accessible label. Light expands from the button; switching to dark contracts
  the light snapshot back into that button. Use an 800ms radial mask with a broad
  120–260px alpha feather, keeping text sharp and avoiding a hard circular edge.
  Startup, reduced motion and browsers without View Transitions switch immediately.

- Exam-list published titles use success green with no tinted row background (15 October 2026).
  Elsewhere use success green, draft/pending neutral, failed/error red. Preserve a
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
Student catalog refinement (16 October): scope compact type under `.student-catalog`.
Profile name is 20px mobile / up to 24px desktop; exam titles use the shared
18px `--student-exam-title-size` across catalog, result list and detailed result
header; secondary text 12–13px. Numeric profile metrics stay 20–22px, while text
outcomes use 15–16px and wrap. Catalog buttons use 14px labels with 44px minimum
touch targets; editable touch controls retain the shared 16px accessibility rule.
Use text-size-adjust:100% in this catalog only to stabilize automatic inflation,
without disabling browser zoom. Keep long text wrap-safe and exam typography unchanged.
The catalog filter row uses compact 132px/116px maximum desktop tracks and
shrinkable mobile tracks. “Nhập mã đề” always occupies the rightmost track and
aligns to the right edge, not immediately after the dropdowns.
Detailed results use a result-only 14px body/control scale, 20–22px name,
18px section headings, 16px part headings, and readable 15px answer text.
Keep the total score 34px desktop / 28px mobile; secondary metrics 24px / 22px.
Preserve semantic badges, score colors, touch targets, editable-field sizing,
browser zoom and teacher grading typography.
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

- Page navigation creates browser history entries; repeat renders do not. Class
  detail, result, grading, editor/preview parts and settings tabs have direct URLs.
  Back/Forward flush pending edits before restoring the authorized destination.
- The exam title in the builder uses page-heading sizing, including on touch
  screens; the 16px form-control override excludes this title.


- Published exams must be unpublished before editing content. The editor remains
  available read-only for preview and unpublishing; the server also rejects stale
  content saves. Existing attempt snapshots remain unchanged.
  Published editors omit the permanent unpublish reminder. Clicking the editing
  surface shows “Hãy bỏ xuất bản trước khi chỉnh sửa bài thi.”; preview, section
  navigation and unpublishing remain available.

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
- The part editor header shows its name, then icon toggles for one/two pages
  and (listening only) “Không lặp” / “Lặp 1 lần”, above a divider. Two pages
  places prompts on the left on desktop; mobile remains one column. Skill
  settings retain the time field only. Instructions/examples play once;
  grouping follows the spec.

- The account profile dialog is a compact 440px surface with a small avatar and
  selectable read-only email summary, name field and optional student class code.
  Email is display-only and is never included in profile save payloads. Use shared
  light/dark surfaces, 16px field gaps and one full-width save button.
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
- Class list and class/visitor roster tables use content-driven column widths
  without the generic 760px table minimum, with 12px horizontal cell padding
  (10px on phones). Keep identity columns readable and wrap long emails locally;
  compact level/code/action columns without reducing button touch targets.
  Preserve local horizontal scrolling when content still needs more width.

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

- TELC B1 student Writing and its preview use the shared equal-width split:
  all section and question prompts/images on the left, response fields and word
  count on the right. Preserve authored content, answer hooks and values.
  At 760px and below, stack prompt above response using the shared split rules.

- AI grading rules are private authoring content, including legacy copies in
  the writing question title. Never render those copies in preview or student
  questions; preserve the actual task prompts and images.
- Section prompts can move before and after each example as well as scored
  questions. Preserve legacy scored-question positions and keep prompt media
  and audio in the same order. Inline passages and horizontal tables remain whole.

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

System cards use two independent columns: CPU then AI grading on the left;
resources, R2 then Backup on the right. Phones stack the left group before the
right group, keeping AI directly below CPU and Backup directly below R2.
On multi-column screens stretch both groups to equal height; CPU flexes to fill
the difference above AI. Size-contain CPU with a readable 360px minimum so SVG
intrinsic aspect ratio cannot force the column taller; flex the active plot inside
the available height. Backup anchors to the right column's bottom if the left
content sets the minimum height. Mobile keeps natural card heights. No resize polling.

The compact Backup card has no visible title. Use a bold primary-text timestamp,
archived app version directly underneath, and status centered vertically beside
that two-line group. Omit the left icon;
the right action uses a 44px backup icon button instead of an arrow. Display the
actual archived version from job/Drive metadata, never the current app version.

AI provider pills filter the accuracy list by the saved grading provider. Selecting
the active provider again clears the filter. Keep selected state through refreshes,
recompute matched/total per provider before grouping, and preserve overall pill
counts. Use native buttons with aria-pressed and visible keyboard focus. Selection
keeps only the chosen provider colored; the others become neutral. No selected ring.

The dashboard starts directly with its charts: no visible Tổng quan heading,
current-date subtitle or create-exam button. Keep exam creation in the exam catalog.

Refinement requested 16 October 2026: keep the existing charts and compact the
mobile cards, with a separate Backup row below system resources linking to the
Backup page. Keep its last successful backup time separate from running/error
states; a restore verification does not count as a new backup. Empty AI accuracy
states have one concise explanation. Idle AI polling runs once per minute.

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
- Exam distribution reuses existing blue, teal, violet, coral, green and yellow
  fill tokens, with matching slice/legend colors rather than a muddy single-hue
  gradient. The donut uses a 160px desktop plot and a responsive 120–160px mobile
  plot. Keep the legend content-width, with aligned names/counts separated by
  10px. Position this compact legend block on the right, with names left-aligned and counts right-aligned;
  do not stretch the gap between names and counts. Preserve real counts and empty states.
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

- Shared assessment colors: Đạt green, Khá violet, Giỏi blue, Xuất sắc teal,
  Chưa đạt red; pending/temporary remain gray. Use this mapping for progress,
  score badges, total scores and geometric emblems across grading and results.

- Total score is emphasized at 34px/600 desktop and 28px/600 mobile; other
  statistics keep their existing sizing. Color follows the published assessment
  using shared progress fill tokens. Unpublished/missing totals stay neutral.

- Every skill detail tab keeps its title visible on the left of the score row,
  with score/status on the right and progress below, both before publication and
  after publication. Background updates preserve this label.

- Approved hero result badges (14 October): geometric layered SVG emblems with
  beveled faces, an integrated white uppercase label and six presentations:
  Chờ chấm (gray), Chưa đạt (red), Đạt (green), Khá (violet), Giỏi (blue),
  Xuất sắc (teal). All labels use the same 11px/600 size at every breakpoint
  and stay on one line. Published assessment is the existing saved result,
  never recomputed from the animated total. Use 158.4px desktop and 127.6px mobile
  artwork, without a background card. Keep the frame, accents, plate and label
  still. On opening, animate only the symbol once: a 180-degree hourglass flip
  held at its final angle (pending), a drawn check (passed), one scale emphasis
  from 1 to .86 to 1.06 to 1 with the full cross visible (failed).
  Successful ranks have distinct signatures: one star turn with a slowing
  finish over 1.4s (Khá), a solid eight-face diamond rotating around its vertical
  axis over 1.5s (Giỏi), and a faceted, extruded star tilting to -32/+32 degrees
  and returning over 1.6s (Xuất sắc). Both solids share perspective, depth sorting,
  hidden-face culling and lighting. No particles or repeated loops.
  Other effects finish within 1.2 seconds. Honor reduced motion and stop
  on hidden pages. Teacher unpublished outcomes use the same gray hourglass
  “CHỜ CHẤM” emblem and symbol animation; never expose a draft verdict.

- Student result lists have no Back button. Keep the exam count to the right
  of the page title on the same row, including mobile. Compact cards show the
  actual exam name, shared provider/level badges, saved attempt number and date.
  Published scores include the saved maximum when available and Vietnamese
  decimal formatting. Pending results say “Chờ công bố”; the action is
  “Xem kết quả”. Load metadata in the existing catalog request, never per card.

- TELC written child skills share one rounded, thin-border inner frame with
  16px padding and gaps; no vertical guide line, no separate frame per skill.

- TELC block titles are the left label in the score row, with score and badge
  on the right and the track directly below. No separate heading above that row.
  Block labels use 18px/600; child skill labels keep their normal body size.

- Published TELC block verdicts are shared rounded badges immediately to the
  right of their score, above the track; never a separate line below it.
  Preserve binary Đạt/Chưa đạt labels during counter animation.

- Pending score rows retain an empty neutral progress track, including Speaking
  and the TELC oral block. Label “Chờ điểm”; never imply a zero score or verdict.
  Align the pending badge right even when the row title is visually hidden.
  All result status badges use the same 14px/500 text, line height, padding and
  pill radius. Chờ điểm and Tạm tính share neutral gray; only colors differ from
  assessment badges. Keep any maximum outside the badge in smaller regular text.

- Omit the “Điểm từng phần” heading. Progress always uses the same grade-based
  palette across providers, independently of whether assessment badges are shown.
  Estimated scores use a compact gray rounded “Tạm tính” badge, not a text suffix;
  their progress retains the shared palette rather than a gray-blue override.

- Unpublished and published reviews keep the same skill grouping, order and tabs.
  Overview aggregates parts into skills; part marks stay in the matching detail
  tab. Missing component marks keep the skill pending; a writing estimate marks
  its aggregate temporary too. Speaking retains its position before publication.

- Standard TELC results use one shared card: Khối thi viết (with four nested
  skill rows) and Khối thi nói. Use shared bars without grade badges on children;
  hide threshold text and show only published block verdicts. Both blocks retain
  progress even while pending. Give the total statistic 1.8 shares of width
  versus 1 for each remaining statistic, including mobile. Missing written
  components leave the total pending; estimated writing makes the block total
  explicitly temporary. Keep this hierarchy during background updates.

- Animate result counters, skill bars and answer distribution once per opened
  review over 900ms, with a subtle card entrance. Preserve exact final values,
  skip reduced motion, and stop updates when hidden or detached. No new requests.
  Skill labels and bar colors follow the animated displayed score through the
  shared gradeBand thresholds, then restore the exact final assessment.
  Progress fills use stronger mid-tone variants of the pastel assessment palette,
  leaving badge backgrounds soft. The answer ring shares the excellent/failed
  fill tokens for correct/wrong answers; unanswered stays neutral. Keep the
  short color transition as the displayed score crosses a grade threshold.

- Header groups the student avatar, “Kết quả thi” with the actual exam level,
  student name and an icon-only Share button immediately beside the name.
  Exam provider/title/date remain below; the large result badge sits top-right.
- Use skill tabs, native point scales, a compact answer-distribution ring and
  labeled score bars. Counts exclude examples and oral grading; objective
  correct/wrong counts exclude manually graded answers. Never substitute answer
  accuracy for weighted examination score. Before publication, preserve this layout
  with exact automatic scores, objective counts and answer distribution. Only
  estimated writing scores use slate blue and “– điểm tạm tính”, following
  `specs/provisional-results.md`. No AI wording or overall pass/fail assessment;
  unavailable scores say “Chờ điểm”. Teacher's draft scores remain private.
- Skill tabs expose submitted answers, published correct answers and an optional
  wrong/unanswered filter. Teacher identity and general feedback are real saved
  values, not generated commentary. Pending oral scores are not zero.
- Sharing uses the native share sheet or copies a text summary only; no public
  review link, private feedback, student email or answer keys. Result deep links
  remain authenticated and owner-only. Keep mobile layouts within the viewport.

## Teacher grading

- Answer/correct-answer comparisons share two equal columns on one row, including
  phones, in grading and student review. Images scale within their column without
  cropping; long text wraps locally. A lone answer retains the full available width.

- Score breakdown reuses Result's structure without the “Điểm từng phần”
  heading or a multi-column skill grid. Standard TELC B1/B2 use the shared
  written/oral blocks and nested child frame, with no child assessments.
  Teacher draft totals stay visible but block verdicts require publication.
  Pending speaking retains its neutral track and shared gray badge.

- Place manual grading tabs first, with Publish on the same toolbar; no Back
  button beside Publish.
  No save/status text beside Publish; preserve autosave, flush-before-publish,
  validation and error notifications.
  Published attempts remain editable without reverting publication status.
  Each explicit Publish, including republishing unchanged results, prepares a
  fresh result email. Autosave never resends email. Keep prior delivery records;
  preserve permission checks and one-time level promotion.
  Oral grading belongs in a tab too. Keep the outcome badge at the header right.
  Show Result's shared skill score bars below the workspace, then automatic
  answers and published history. Reuse Result tokens and controls.
- Grading identity uses one compact Result-style header. Reuse Result's heading,
  identity, provider and exam-title classes; avatar/name
  precede provider/title/date, with the emblem at the right and stats below.
  Keep classroom and elapsed-time metadata, without changing grading controls.
  Submission and feedback
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
- Plot only published, complete scores for the same student/provider/level.
  History uses attempt order on X and native earned points on Y, not percentages.
  Show exact points beside each mark without a /maximum suffix or a repeated
  “Lần 1, Lần 2…” list beneath the chart. Keep numeric attempt ticks on X.
  The Y scale spans zero to the largest native maximum/score among shown attempts.
  No extra polling or fabricated historical values.

## Speaking trial (16 October 2026)

Only admin navigation includes the Thi Nói thử nghiệm tab (17 October 2026).
Management, scheduling, account search, recording review and archive controls
require admin on the server as well as in direct-link routing. Assigned candidates
retain their separate phone entry and room access. Reuse
shared tables and controls; scheduling, 100ms setup and review are native dialogs.
Phone delivery uses the approved Review04: compact header, equal 9:16 video
slots and a white task sheet. Show each account's full name, never “Bạn”, in
primary/secondary name labels with contrasting text; seat order stays stable.
During the task/paused views, video tiles expand to the available two-column
width (214px maximum per tile), reserving 300px for header/task/actions on short
screens. Video name labels use 8px text (two thirds of the previous 12px), with
proportionally compact padding; preflight video sizing remains unchanged.
Keep device checks before entering; no camera, mic, help or leave controls in
the call. Camera video fills the portrait slot without stretching (center crop
landscape input); do not apply this crop to task images or recording playback.
Disclose recording without a consent checkbox; require only the undisturbed-environment
confirmation. Show “Đảm bảo thấy hình và nghe rõ tiếng”; no separate picture/sound
checkbox. Recording and playback are optional, never entry prerequisites. Buttons are “Thu thử” and
“Nghe lại”. Open camera/microphone automatically on participant entry; only show
“Thử lại” on failure/interruption. Omit fixed-phone/clear-face instructions.
Explicit speaker turns hide the listener's prompt server-side.
“Tôi đã nói xong” keeps video/task visible and hides its completed action footer,
with no redundant waiting sentence, confirmation dialog or “Tiếp tục nói”. The listener confirms
“Xong” after the speaker finishes. Only two confirmations or the existing
server deadline advance a stage. A new DTZ photo trial uses the approved source
stimulus; its configurable G2G timings are not official exam rules. Do not change
existing trial content. New trials have photo turns for each participant and a shared
experience exchange. Scheduling offers Thi ngay (both ready) and Hẹn giờ (time and
both ready); account email/name suggestions are staff-only, debounced and bounded.
Both ready and scheduled time reached show “Hãy sẵn sàng” with a compact spinner,
not a countdown or artificial delay. Only request recording when both media streams
are available, and reveal the task after 100ms confirms recording is running.
Both confirmations or expiry show “Đang chuyển phần…” with a
small spinner until the next server stage, then a brief content entrance. Keep
video nodes stable and respect reduced motion; do not add polling requests.
Omit supporting sentences below phone action buttons and the “Chờ bạn cùng thi”
line. Keep essential recording disclosure above the preflight actions, device
errors when necessary, and the small stage-transition loading status.
Suggestions use an input-anchored, border-only white list with a medium-weight
name and muted email underneath; no native datalist, avatars or decorative badges.
Preserve touch selection, arrow/Enter/Escape navigation and cached requests.
Show recording saved only after server confirmation.
After 100ms completes its single composite recording, a durable worker copies it
to the existing Drive connection's `G2G Exam / Video thi nói` subfolder. Keep
backup archives and retention separate. Show queued/uploading/saved/retrying
states, verify size and checksum, reuse a durable file ID on retry, and clean
temporary VPS files. Do not delete the 100ms source or make Drive videos public.
Teacher playback goes through the authenticated recording endpoint (Range
supported) once archived, with 100ms playback available before transfer completes.
Only admins may view/review finished trials or control live
trials. Review saves use a version check to prevent overwriting another teacher.
This remains isolated feedback, not official exam scoring. Admin pairing remains
manual in this release; automatic candidate matchmaking is a separate feature.
Assigned candidates already using the mobile website automatically open the
speaking preflight when the room's entry window opens (15 minutes before a
scheduled trial, immediately for instant trials). Check only the signed-in
account's eligible session ID, every 10 seconds on safe visible screens; never
interrupt exams, editing, grading, open dialogs or active inputs. Recheck identity
after loading and guard once per account/session/browser tab to avoid redirect
loops. This does not bypass device permission, environment checks or readiness.
The ending icon follows actual state: warning for interruption, cross for
cancellation, clock for processing/closing, and completion tick only for completed.
Keep the status and server clock on one row. Desktop displays only a phone QR.
Use explicit trial labels; never imply an official TELC task or real published score.

## Verification

Run syntax checks, automated tests and G2G Exam Check before updating main.
The user requested to perform browser checks personally; do not open a browser
for verification unless they change that preference. Report that visual checks
were not performed when handing off.
