# Goethe A2 — approved user configuration

Approved in the project conversation on 2026-10-10. This is the site's
user-approved practice format, not an independently inferred official format.

| Skill | Parts | Scored questions | Maximum | Online minutes |
| --- | --- | --- | --- | --- |
| Reading | 4 | 5 each | 20 | 30 |
| Listening | 4 | 5 each | 20 | 30 |
| Writing | 2 | 1 each | 20 | 30 |
| Speaking | Offline | Teacher-entered total | 25 | Excluded |

Reading 1–3: shared text/image left, ABC questions right; stacked on mobile.
Reading 4: long prompts, one-letter inputs, no repeated letter including example.
The alphabet in the question profile is an answer encoding, not a claim that
every exam contains 26 stimuli; the teacher's instruction lists the actual texts.

Listening 1: ABC text, example once then each question twice.
Listening 2: shared image, person/answer table, dropdown a–i, letters not reusable.
Example once followed by shared recording once.
Listening 3: ABC images, example and each question once.
Listening 4: Ja/Nein, example once then shared recording twice.
One audio session, no replay; whole-exam deadline overrides playback.

Shared recording is stored on the first scored question; editor explicitly labels
this convention. Never save instruction audio fields retired by the user.

Writing 1: SMS 20–30 words, 10 marks.
Writing 2: letter 30–40 words, 10 marks.
Each has a separate manual grade, aggregated into Writing /20.
Each skill passes at 60%, including offline Speaking /25.

Examples are prefilled, unscored. Every new part gets its own independent example.
Changing answers to blank must never award option-A marks.

Verification: goethe-a2.test.mjs and the A2 block in backend-access.integration.mjs,
plus the full existing suite. Visual browser verification is left to the user
under docs/UI_STYLE.md.
