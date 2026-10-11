# G2G visual system

Approved direction: the user's neutral, rounded dashboard reference (8 October 2026).
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
On mobile, gradebook filters use two unequal columns (1:1.6): provider, level,
class on the left; reviewer, student, status on the wider right.
Compact list actions use 40px height. Exam settings triggers are icon-only gears with accessible labels.
Exam access layout groups visibility, level and code creation, with feedback beside each form.

- `styles.css` owns tokens, base controls, navigation, page layout, exam and builder.
- `enhancements.css` owns settings/infrastructure layouts using those tokens.
  Do not append another global visual override block here.
- `src/ui/icons.js` owns outline icons. Buttons own the frame; do not use an icon
  asset with a second embedded border. Existing unframed Figma assets may be reused.
- `src/settings/theme.js` owns brand colors and contrast. Use `--brand-primary`
  with `--brand-on-primary` for filled buttons; `--brand-soft`, `--brand-text` and
  `--brand-border` for selected answers/light states. Keep warning/success/error
  semantics fixed. Do not hard-code purple or blue selection states.

## Navigation and forms

- Loading skeletons use measured geometry from the same URL and viewport width,
  including actual text wrapping, controls and card dimensions. Store only numeric
  geometry in session storage, never content/HTML/account data. Keep branding static.
  Discard measurements after one hour, on logout, or when route/width differs.
  Without matching measurements use the minimal brand fallback, not a guessed
  generic page skeleton. New server content may legitimately change dimensions.

- Textarea content supports paired `[b]text[/b]` bold markup when rendered.
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

- Mobile skill/part navigation uses an adaptive 2–5-column grid, not a fixed
  three-column layout. Keep explicit row and column gaps; wrap only when needed
  to preserve readable labels and touch targets.

- Minimize visible form labels; prefer concise placeholders inside empty inputs.
  Keep a persistent accessible name (aria-label or visually hidden label).
  For icon-only upload controls, use an accessible name and tooltip instead of
  redundant visible labels. Keep visible labels only when necessary for clarity.

- Simple message/error dialogs use the shared compact width of 500px, capped
  at the available mobile viewport width. Larger editors retain their own size.

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
- Native dropdowns always reserve 42px on the right for one 16px chevron placed
  14px from the edge. Feature modules must not redraw or reposition that icon.
- User-approved exception: single-letter dropdowns embedded in reading text
  are 56×32px (36px high on touch screens), with pill corners and compact padding.
  Reuse the same chevron at 12px, positioned 6px from the right.
  Inline gap menus show the letter plus the full sentence when opened; the
  closed control shows only the letter (or question number when unanswered).
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

- Signature values in paper forms use a handwriting font stack (Snell Roundhand
  on Apple devices, Segoe Script/Bradley Hand/Segoe Print fallbacks), not the UI
  body font. Labels keep the normal UI font.

- Paper-style answer forms use the available width with small side gutters.
  Keep mobile inner padding at 20px vertically and 18px horizontally so content
  does not sit against the paper edge.
  Keep labels and their inputs on the same row on mobile (roughly 32% / 68%);
  wrap long labels within their own column. Headings, notes and images keep full
  rows. Reduce nested side padding and disable paper rotation on mobile to avoid
  wasted space or overflow; keep the paper appearance and score markers.

- In two-column exam content, the shorter column follows the page scroll within
  its own section. Recalculate after image/content resizing; disable this when
  columns stack on mobile. Keep long columns fully readable without nested scroll.

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

Student identity cards use one compact current-level badge, not a level ladder.
Keep name editing inline and group class confirmation with Share. Statistics start
with submitted exam count (“Bài đã thi”), including pending grading.

Production master settings save globally through the existing protected API.
Demo settings are explicitly local to that browser, never a privileged server write.
Validate hex input, preview locally before save, then apply to every route. Cached
theme application must not wait for a network response to render the page.

## Verification

Run syntax checks, automated tests and G2G Exam Check before updating main.
The user requested to perform browser checks personally; do not open a browser
for verification unless they change that preference. Report that visual checks
were not performed when handing off.
