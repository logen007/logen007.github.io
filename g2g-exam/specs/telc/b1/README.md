# TELC B1 — APPROVED 2026-10-12

Source: [user's structure sheet](https://docs.google.com/spreadsheets/d/1kVs4d41B6_XmqQYBsyO3EuBsGZh2yJdLrMpWWZjwu3M/edit?gid=0#gid=0), re-read Sheet1!A38:G58 on 2026-10-12. The user explicitly requested the sheet, NOT the linked PDF.

The JSON exam and part files own the runtime rules. `extends` deliberately
inherits the existing approved Goethe part referenced in the sheet, with only
the TELC question count, name and per-question score overridden. This includes
Ja/Nein + shared twice-played audio for
all three listening parts. Do not substitute external TELC formats.

Two direct clarifications override incomplete/conflicting sheet cells:

- Reading 2 (updated 2026-10-12): the user corrected each question to three
  choices a/b/c, replacing the inherited true/false format. Count and scores stay unchanged.
  The user also requested a two-column reading layout: instructions on the left,
  questions on the right; mobile stacks the columns.

- Reading 1 (updated 2026-10-12): five passages, a shared bank of ten
  teacher-entered headings a–j, and an explicit correct-letter selection per
  question. The bank's letters remain fixed; the earlier automatic five-heading
  shuffle is superseded. Existing headings and answer keys remain in place when
  opening older drafts.
- The user subsequently requested ×/+ controls per answer. Ten options remain
  the initial default; the shared bank can contain 5–26 options (a–z). Five is
  the minimum for five unique answers. Insertion/removal relabels choices while
  preserving the same answer text; removing a correct answer clears its key
  and blocks publication until the teacher explicitly selects another answer.

- Writing: user explicitly chose A2 Writing 1 (free-response), despite the
  current cell saying A1. Its 45 points and 30 minutes come from the TELC column.
- Reading 4 and 5 (updated 2026-10-12): no example question or required [z].
- Reading 5 uses the Goethe B2 Reading 2 interface: passage and shared lettered
  answer bank, with one input per answer. Keep TELC's ten questions and variable
  bank (10–25 options a–y), each answer used once. Plus/minus changes the bank
  size without changing existing answer keys; an answer in use cannot be removed.

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
