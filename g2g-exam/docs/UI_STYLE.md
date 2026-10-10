# G2G visual system

Approved direction: the user's neutral, rounded dashboard reference (8 October 2026).
This document governs presentation only. Exam rules remain in approved `specs/`.

## Visual hierarchy

- Google Sans Flex, optical sizing enabled. Body 15px/1.5 at weight 400;
  form controls 14px; supporting text 12–13px. Mobile editable text can use 16px.
- Page title 28–40px at weight 450; card heading 20–24px at weight 500.
  Avoid heavy uppercase titles and weights above 600 except the small G2G mark.
- Neutral pale gray canvas, white cards, thin neutral borders. No shadows on
  buttons/cards; reserve elevation for dialogs, notifications and image previews.
- Card radius 24px (20px on mobile), input radius 12px, navigation/actions pill.
  Icon-only controls are circular. Spacing follows 8/12/16/20/24/32px.
- Main content remains capped at 1500px. Exam reading width is 1040px.

## Shared ownership

Filter dropdowns, profile forms and exam access controls use the shared form rule in styles.css:
44px height, 12px corner radius, 14px horizontal padding, one native chevron and common focus/hover states.
Student exam filters use two labeled dropdowns (provider and learning level), aligned with the action button.
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
- Cards use the shared 24px radius and 24px desktop padding. Compact/mobile
  variants may reduce padding to 18–20px but must not introduce a third radius.
- Primary, secondary, destructive and icon-only actions reuse `.nut`, `.nguy`
  and `.icon-btn`; feature modules own labels and behavior, not button geometry.
- File/audio/image pickers use the same border, radius, hover and focus language
  as text controls. Shadows remain reserved for overlays and media previews.
- Exam navigation stays after the questions: no sticky surface/background/border.
  Exam structure navigation is preview-only.

## Preview layout

- Keep the preview header and reading content on the same 1040px column.
  Show exam title, a small preview badge, a short no-results notice and return to
  editing in one header, not several banners.
- Place a labeled native dropdown section switcher above the paper, with the
  current section selected and answer counts in its options. Whole-exam progress
  and a quiet reset link sit beside it. Do not render this in real exams.
- Show the current section heading once. Group its instruction and questions
  in one white paper surface with internal dividers rather than nested cards.
- Put prompt and audio control together; answer options fill the following row.
  Image answers get a readable image area, not a tiny thumbnail beside long text.
- Current-section answered count lives once in the bottom navigation. Previous
  and next remain in normal flow without background, border or sticky positioning.
  Section changes return scroll and keyboard focus to the new heading.
- Scope preview-only presentation under `.thi--preview`. It uses local answers;
  production part runtimes must never attach a live attempt to preview content.
- Builder return navigation is a text link to the left of provider/level on the same row, without a hover underline.
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
