# Independent section prompts

Status: APPROVED — user's request, 13 October 2026.

- Applies to the shared exam editor for all providers/levels. No changes to
  question counts, numbering, answers, scores, timing or repetition policies.
- The section owns ordered prompt blocks before its questions. Plus inserts
  directly below the selected prompt; move up/down moves all its media and text.
- Blocks support text and image; listening blocks also support audio. Existing
  gap-passage images retain their dedicated article placement.
- The first block keeps legacy instruction fields; subsequent blocks are saved
  in `additionalInstructions`. Existing question-owned prompts are preserved,
  not automatically moved or removed. New section prompts never belong to a question.
- Prompt audio plays in prompt order, before examples/questions, using the
  existing instruction repeat policy. Preview and real exams use the same planner.
- Copying and attempt snapshots preserve the full ordered content. Removing a
  block or attachment clears references only; media garbage collection retains
  its existing shared-reference protection and grace period.
