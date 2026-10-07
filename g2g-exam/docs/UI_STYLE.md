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

- Admin and student navigation uses centered pills in the white rounded header;
  overflow wraps to a scrollable second row. Show only working controls.
- Preserve the role label and existing navigation action hooks used by modules.
- Question text + right controls share one row; answers fill a separate full row.
  `--editor-control` and `--editor-gap` determine the complete right-column height;
  the textarea stretches to match. Use the same controls for every skill.
- Audio uses one border around file label/play state. Uploaded answer images
  replace the placeholder icon, with hover/focus preview and click-to-replace.
- Setup/settings dialogs use the same input components as other forms.
- Exam navigation stays after the questions: no sticky surface/background/border.
  Exam structure navigation is preview-only.

## Brand settings

Production master settings save globally through the existing protected API.
Demo settings are explicitly local to that browser, never a privileged server write.
Validate hex input, preview locally before save, then apply to every route. Cached
theme application must not wait for a network response to render the page.

## Verification

Run syntax checks, automated tests and G2G Exam Check before updating main.
The user requested to perform browser checks personally; do not open a browser
for verification unless they change that preference. Report that visual checks
were not performed when handing off.
