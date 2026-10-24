# Paired G2G Speaking exams

Owner decisions approved 24 October 2026. This is a custom G2G practice exam,
not an official Goethe/TELC specification. Teacher-authored parts and rubrics
must not change the existing ordinary exam or isolated speaking-trial rules.

## Accepted behavior

- New exam kind `speaking`, distinct from the existing provider registry.
- Teachers configure prompts, part durations and rubric criteria/maxima; publish
  immutable versions and unpublish before editing, like ordinary exams.
- Phone-only candidate delivery initially. Authoring/grading remain desktop-ready.
- Match the same exam, release and level; prefer same class for 60 seconds before
  cross-class matching. Never match a person with themselves or put one account
  into two active queues/sessions. Queue heartbeat/expiry and cancellation are
  durable and concurrency-safe; do not fabricate waiting rank or ETA.
- Show match confirmation, then private preparation for at most 20 minutes.
  Both ready can end preparation early. No video-room token/join before prep ends.
- A candidate sees only their own A/B prompt and shared instructions. The server
  projects private content; never send both roles and hide one with CSS.
- Check media, join call, start recording, and only then start the speaking clock.
  Clock/deadlines and transitions are server-owned and survive reload/restart.
- During a call, pause on missing media; allow 120 seconds to recover. Beyond
  that mark interrupted, not zero, and allow a fresh attempt. Preparation cancel
  lets the remaining person search again. No automatic incomplete-result grade.
- Store one shared recording on the existing private Drive connection, with
  durable job/lease, file ID, checksum verification and retry. Completion of the
  call and successful archive are distinct states. Do not make Drive files public.
- Only exam owner teacher and master may view recordings, save draft grades or
  publish. Separate rubric scores/feedback/publication per candidate. Students
  receive only their own published points/feedback, no recording or draft marks.
- Results are speaking-only, with no automatic level promotion or reinterpretation
  of ordinary Goethe/TELC thresholds. No automatic recording deletion in this slice.
- Keep trial URLs/data/master-only permissions and legacy exam behavior unchanged.
- Local tests/browser authorized for this update with synthetic data/provider
  mocks only. No real 100ms/Drive calls or VPS data edits during verification.

## Implementation contracts

Existing `exams` and `exam_releases` own authoring/publication. New exam JSON uses
`kind:'speaking'`, a separate `provider` (GOETHE/TELC/FID; legacy null remains valid),
`learningLevel:null`, ordinary title/level/status
metadata, `sections:[]`, and `speaking:{stages:[...]}`. Each stage has
`id,title,instruction,promptA,promptB,imageAUrl,imageBUrl,seconds,speakerSeat` and
`criteria:[{id,label,maxScore}]`; speakerSeat is `both`, `A` or `B`.
Store prompts/rubric only in staff authoring and pinned release/session snapshots,
not student catalog metadata. Uploaded images use existing controlled media routes.

Technical safety bounds are not official exam rules: 1–20 published stages,
30–1200 seconds each, total at most 2400 seconds (fits the existing one-hour
recording configuration with join/recovery margin); at least one rubric criterion
per part, unique criterion IDs, finite nonnegative scores capped at its maximum.
Do not open more rooms than the existing configured/account-safe capacity; count
trial and new exam rooms together. Capacity failure is recoverable, not a score.

Shared domain owner `src/speaking/exam-model.js` exports:
`isSpeakingExam(exam)`, `normalizeSpeakingConfig(input)`,
`speakingExamErrors(exam)`, `speakingMaxScore(config)`,
`validateSpeakingReview(config,review,{complete})`,
`speakingSessionView(row,user,now)` and policy constants. Config accepts incomplete
draft text but publication validates complete prompts/timing/rubric. Review input
is `{scores:{[criterionId]:number},feedback}`; normalized result contains
`scores,feedback,total,maxScore,complete`. Never invent criterion values.

Dedicated backend routes under `/api/speaking-exams`:

- POST `/` body `{title,level}` → `{exam}`; GET `/:examId` → `{exam}` (owner/master).
- PUT `/:examId` body `{version,exam}` → `{exam}`, optimistic draft-only save.
- POST `/:examId/publish`, `/:examId/unpublish` body `{version}` → publication receipt;
  POST `/:examId/copy` → a new independent draft `{exam}`.
- POST `/:examId/queue`, GET `/queue`, POST `/queue/cancel` →
  `{queue:{state,joinedAt,serverNow,...}|null,session:sessionView|null}`.
- GET `/sessions/:id` → sessionView; POST corresponding `/ready` `{revision}`,
  `/join` → `{token,name}`, `/connected` `{consent:true}`, `/next` `{stageIndex}`,
  `/leave` → sessionView. Mutating requests require same-origin and authentication.
- GET `/reviews` → `{sessions:[...]}` (owner/master), GET `/sessions/:id/grading`
  → staff sessionView, PUT `/sessions/:id/review/:studentId`
  `{version,review}` and POST the same path + `/publish` `{version}` → `{review}`.
- GET `/sessions/:id/recording` → authenticated staff-only Range stream.
- GET `/results` → own published speaking results for students, no video URLs.

Review/result lists return at most 100 rows with `nextOffset`; request the next
page with `?offset=N`. Both paths project metadata in SQL. Exact acknowledged or
uncertain-write retries return the existing version when the canonical payload
matches; different stale edits still conflict. New queues require active video
configuration and a completed student profile, and respect maintenance mode.
Speaking access codes are not introduced: only public speaking exams may queue.

Session JSON pins `examSnapshot`, `examId`, `publicationVersion`, members
`[{id,name,seat,classId}]`, `state`, `revision`, `prepDeadline`, `ready`,
`stageIndex`, `deadline`, `remaining`, `votes`, `presence`, recording IDs/status,
`markers`, `driveArchive` and separate versioned `reviews` per member.
States: preparing → joining → starting → running/paused → finishing → processing
→ completed; cancelled/interrupted are terminal. Students' projected preparation
contains only their own staged prompts; staff gets the pinned exam and reviews.

Client feature owner `src/speaking/exams.js` exports
`createSpeakingExamsController({root,context,layout,navigate,notify,onChanged})`
with `mount(route)`, `open(route)`, `beforeLeave()`, `dispose()`.
Routes: `{page:'edit',examId}`, `{page:'queue',examId}`, `{page:'session',id}`,
`{page:'reviews'}`, `{page:'grade',id}`, `{page:'results'}`.
The parent app owns top-level URL integration, create-exam entry, catalog actions,
teacher grading navigation and student results entry. Controllers own their forms,
bounded polling, safe cleanup, autosave and error/retry behavior.

## Release / compatibility

Add queue/session/member SQL tables/indexes, never rewrite legacy rows or releases.
Protect the generic exam writer/start-attempt paths from bypassing speaking guards.
Keep private prompts out of every catalog/full-student projection. Pin releases
before pairing, preserve sessions after unpublish, and block destructive Trash
purges while speaking history/recordings still reference the exam.
Rollback can hide new UI/routes but must retain schema, pinned snapshots and
recording references; no destructive contraction or file purge is authorized.

Required proof includes parallel match/cancel/retry, stale versions, cross-account
and owner negatives, prompt/grade privacy, persisted prep/reconnect deadlines,
recording-start gate, archive failure/idempotency, independent grade publication,
mixed legacy/new behavior, mobile flow and isolated 100ms/Drive failures.

## Verification evidence for 1.10.3

- Pure model and entry tests; isolated PGlite/Fastify lifecycle and guard suites;
  jsdom controller/SDK tests cover the contract above. No real provider requests.
- Recovery tests include lost room/recording-start/stop responses, stale worker
  fencing, live-session polling fairness, late assets, exact save retries and
  connection changes blocked until dependent recordings have safely archived.
- Local browser synthetic fixtures exercised preparation → join → call → cancel
  at a 390px frame, and desktop authoring/grading in light and dark mode. Camera,
  microphones, provider calls and video files were mocked, so this is not proof of
  real iOS/Android capture, real 100ms recording or real Drive credentials/quota.
- Before the first real cohort, the owner should run one complete pair on two
  phones using the configured 100ms/Drive connection and confirm both sides'
  audio/video, full recording playback and separately published results.

Provider recovery queries follow the official 100ms v2
[room listing](https://www.100ms.live/docs/server-side/v2/api-reference/Rooms/list-rooms)
and [recording listing](https://www.100ms.live/docs/server-side/v2/api-reference/recordings/list-all-recordings).
