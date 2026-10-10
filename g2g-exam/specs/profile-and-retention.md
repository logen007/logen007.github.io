# Profile and retention — APPROVED

User update, 2026-10-10. Applies to the existing Goethe/TELC application without altering question audio policies or scoring.

- Section instruction audio is retired. Remove the authoring upload and playback segment, strip retired fields from exam writes and existing exams. Question and example audio remain unchanged.
- Trash expires after five days, checked every 15 minutes and shortly after server startup. The server owns the trash timestamp; restoring resets it.
- Permanently delete only records without live or historical references. Keep exams with attempts, questions referenced by exams/attempts, and referenced media. Existing media GC handles orphaned uploads.
- Student profile shows name, class value, current proficiency badge and concise statistics. No full proficiency ladder or explanatory rank text.
- Students edit their own full name inline; blur or Enter saves, Escape cancels. They cannot change class or proficiency through this endpoint.
- Class confirmation input action sits beside Share. Teacher confirmation codes have Copy buttons with success/error feedback.
- “Bài đã thi” counts submitted/completed attempts, including pending grading; excludes in-progress and abandoned attempts.
