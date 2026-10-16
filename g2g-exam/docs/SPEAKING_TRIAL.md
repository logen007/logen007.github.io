# Isolated speaking trial — 100ms

Approved scope: user conversation, 16 October 2026. This is a technical trial,
not an approved official TELC B2 examination delivery specification.
Existing TELC oral maxima and offline grading are not changed.

## First test

1. Admin / teacher opens **Thi Nói thử nghiệm**. Only master can configure 100ms.
2. In a separate 100ms Dashboard template create a student role that publishes
   audio/video and subscribes to the same role. Turn OFF all role permissions
   (including end room, recording, streaming, role changes and moderation).
3. Enable one Room composite recording configuration with a dashboard subdomain,
   duration >= 3600 seconds, auto-start OFF, track/stream/custom recordings OFF.
   The backend validates these settings before saving encrypted credentials.
4. Enter Access Key, App Secret, Template ID and student role in the G2G popup.
   Do not send secrets through chat. Rotating credentials is blocked while a
   nonterminal room exists. Use a dedicated 100ms template; changing it externally
   during trials is unsupported.
5. Create a trial with two registered active accounts and a Vietnam time slot.
   A master/teacher can be assigned as a participant to test their own account.
   Teacher access is limited to their own trials; master can manage all trials.
6. Open the shared session link/QR on two phones. Each phone must log in to its
   assigned account; QR does not transfer login credentials. Desktop never joins
   media. Complete local preview and sample recording, listen back, consent and join.
7. Each participant presses Ready. At/after the scheduled time the server checks
   both actual provider peers, camera/mic tracks, then waits for recording RUNNING
   before revealing each participant's current A/B prompt.
8. Advance on the server deadline or two current-stage votes. Missing/muted
   camera/mic pauses the common clock; 5 minutes without recovery interrupts the
   trial. Only one connected device per account is permitted. Rejoining may need
   a short wait for the provider to remove an old disconnected peer.
9. The server independently stops recording and locks/disables the room on finish
   or interruption, even if pages close. A 60-minute provider room limit is a
   second cost safeguard. The app stops at 55 minutes from room creation or
   90 minutes after the scheduled slot. Maximum trial content: 30 minutes.
10. Reopen the trial in admin after processing to play/download the private
    recording and save separate per-person text feedback. Stage markers seek
    into the original recording, including technical pauses.

## Isolation and limits

- Table `speaking_lab_sessions` has no link to attempts, grades, publication,
  level progression or exam content. No production exam schema is changed.
- Example tasks are explicitly G2G practice text, not official TELC tasks.
  The teacher edits all prompts, instructions and durations before creating a trial.
- No AI grading, official score calculation, notifications, automatic pairing,
  long-term video ingestion or formal identity verification in this first slice.
- At most 24 unfinished scheduled trials and 4 nonterminal rooms. Scheduling
  rejects overlapping participant windows (-15 to +90 minutes).
- Recordings remain on 100ms storage by default (15-day vendor retention).
  Download required recordings before expiration; no claim of a 90-day archive.
- Only assigned users can get app tokens/current prompts. Only owning teacher or
  master gets recording links (15-minute presigned links) and feedback.
- Timeouts/provider errors never claim a completed exam. Cleanup retries on the
  server and keeps the slot nonterminal until closing is confirmed.
- Browser user-agent phone checking is a UX gate, not anti-cheating or device attestation.
- No visual browser check was run at the user's request. Live two-phone media and
  recording checks require the user's 100ms credentials and devices.

## Sources and verification

- https://www.100ms.live/docs/get-started/v2/get-started/security-and-tokens
- https://www.100ms.live/docs/server-side/v2/api-reference/policy/configure-recordings
- https://www.100ms.live/docs/server-side/v2/api-reference/recordings/start-recording-for-room
- https://www.100ms.live/docs/server-side/v2/api-reference/active-rooms/list-peers
- https://www.100ms.live/docs/server-side/v2/api-reference/active-rooms/retrieve-peer
- https://www.100ms.live/docs/server-side/v2/api-reference/recording-assets/overview

Run `node tests/speaking-lab.test.mjs`, `speaking-lab.integration.mjs` with an
isolated PGlite runtime, `npm test`, syntax check, and `npm run build:web`.
The integration test replaces only authentication identity and 100ms HTTP; it
executes real route handlers, encryption/JWT signing, state transitions and SQL.
