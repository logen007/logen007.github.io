# Independent section prompts

Status: APPROVED — user's request, 13 October 2026.

- Applies to the shared exam editor for all providers/levels. No changes to
  question counts, numbering, answers, scores, timing or repetition policies.
- The section owns ordered prompt blocks. Plus inserts
  directly below the selected prompt; move up/down moves all its media and text.
- Blocks support text and image; listening blocks also support audio. Existing
  gap-passage images retain their dedicated article placement.
- The first block keeps legacy instruction fields; subsequent blocks are saved
  in `additionalInstructions`. Existing question-owned prompts are preserved,
  not automatically moved or removed. New section prompts never belong to a question.
- For separate question cards, a position selector places a prompt at the start
  or after a scored question (global exam numbering in the selector). The prompt
  remains section-owned and moves with its image, image-width setting and audio.
  Embedded gap passages, heading banks and horizontal tables remain indivisible.
- Prompt audio plays at its selected position, using the
  existing instruction repeat policy. Preview and real exams use the same planner.
- Copying and attempt snapshots preserve the full ordered content. Removing a
  block or attachment clears references only; media garbage collection retains
  its existing shared-reference protection and grace period.
- Image max-width has a visible px suffix and tooltip explaining automatic
  sizing when empty. Legacy 1px limits are treated as automatic, not invisible images.
- TELC B1 SB2 shows its passage on the left and answer bank on the right;
  narrow screens use the existing responsive column flow. SB1 stays single-column.
