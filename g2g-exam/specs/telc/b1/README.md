# TELC B1 — APPROVED 2026-10-12

Source: [user's structure sheet](https://docs.google.com/spreadsheets/d/1kVs4d41B6_XmqQYBsyO3EuBsGZh2yJdLrMpWWZjwu3M/edit?gid=0#gid=0), re-read Sheet1!A38:G58 on 2026-10-12. The user explicitly requested the sheet, NOT the linked PDF.

The JSON exam and part files own the runtime rules. `extends` deliberately
inherits the existing approved Goethe part referenced in the sheet, with only
the TELC question count, name and per-question score overridden. This includes
the true/false format in Reading 2 and Ja/Nein + shared twice-played audio for
all three listening parts. Do not substitute external TELC formats.

Two direct clarifications override incomplete/conflicting sheet cells:

- Writing: user explicitly chose A2 Writing 1 (free-response), despite the
  current cell saying A1. Its 45 points and 30 minutes come from the TELC column.
- Reading 5: user selected a variable answer bank, minimum ten entries for ten
  gaps, each answer used once. Letters a–y are available; z remains the example.

Reading 4 uses three independent choices per gap; repeating a correct letter
across different gaps is allowed. Reading 4/5 remain in the 90-minute Reading
block while their marks are classified as grammar for the existing TELC result.
Speaking remains teacher-recorded, as in the existing application; its three
parts and 15-minute allocation are recorded in exam.json, not added to the
online written-exam timer. No speech recording or automatic grading is added.

New and empty TELC B1 drafts use this template. Existing custom TELC exams with
authored content are not destructively converted. Attempt snapshots are unchanged.
The former draft transcription has been replaced by these approved specs (the
draft remains recoverable in Git history).
