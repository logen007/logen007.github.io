# Exam drafts and navigation

- Next/Previous change the local section only. No request is required to display
  already loaded exam content. Media continues through the bounded preloader.
- IndexedDB stores a user/attempt-scoped outbox before sending. Changes are batched
  after 1.2 seconds; network failures retry after 5 seconds and on reconnect.
- Web Locks permit one editing tab per attempt on this browser. Unsupported or
  blocked local storage prevents editing rather than claiming a safe local save.
- Server updates are atomic, authenticated and constrained to questions in the
  attempt snapshot, including sections no longer displayed. Server deadlines and
  unique-answer rules remain authoritative.
- Each question has an opaque version and operation ID. Duplicate sends are
  idempotent; stale versions fail without overwriting newer device changes.
  Conflicts preserve the local draft and require resolution, never silent merging.
- Submit flushes the outbox before asking the server to finalize. After the
  deadline, unsent local answers are retained but cannot be backdated for scoring.
- Only public attempt data comes back from saves; no full-state reload is needed.
  Synchronized outbox entries are removed. Local section position is retained.
- This does not cache the complete application for offline startup. Reloading a
  closed/offline page may require reconnection; pending answers survive in IndexedDB.
- Verification: outbox unit tests, navigation VM test, SQL stale-version,
  idempotency, authorization and exam deadline tests. Browser visual testing is
  left to the user per project rules.
