# Active exam sync and capacity investigation

## Implemented

Active exam polling now reads only the authenticated owner's attempt through
`GET /api/attempts/:id/sync`. The indexed primary-key lookup selects public data
only. It does not load questions, exam snapshots, other attempts or answer keys.
Missing and foreign attempts both return 404. Auth still runs on every request.

The 15-second timer remains; it skips hidden tabs, pending polls, writes and
outbox sends. A content-derived ETag suppresses unchanged responses. Only the
attempt is merged into the client's already-loaded exam. Local pending answers
remain overlaid. Generation guards discard reads overtaken by saves or navigation.
Other views retain their existing synchronization. Initial exam loading, submit,
grading, deadlines and the question bank's editing rules are unchanged.

## Isolated evidence (not VPS capacity)

Ran production state/sync functions with SQL in an in-memory PGlite database on
an Apple M3 Pro, 12 logical CPUs, 18 GiB RAM. Synthetic fixture: 1,000 questions,
200 separate students/attempts, 40 answers per attempt. No real student data,
production database, website requests or emails were used.

| Burst | SQL queries | Total ms | p95 ms | Mean response bytes |
|---|---:|---:|---:|---:|
| Previous full-state, 50 calls | 450 | 544 | 543 | 642,544 |
| Attempt-only, 50 calls | 50 | 7 | 7 | 447 |
| Attempt-only, 100 calls | 100 | 14 | 13 | 447 |
| Attempt-only, 200 calls | 200 | 28 | 26 | 447 |

Single local run, warm SQL engine, not a controlled end-to-end throughput test.
Excludes HTTP, authentication, proxy, PostgreSQL connection pool, concurrent
saves/submission, media, cold caches, and network latency. These numbers prove
the smaller query/payload scope for this fixture; **they do not establish that
production can support 200 students**. Before/after response sizes are full 200
responses; unchanged polls also benefit by avoiding full-state construction.

Reproduce with an external temporary PGlite installation (not a production dependency):

```
G2G_PGLITE_PATH=/absolute/path/to/pglite/dist/index.js node tests/sync-benchmark.mjs
npm run test:sync
```

## Production read-only inspection (via user's Termius session)

Observed 2026-10-12, around 08:58 server time:

- Ubuntu 22.04.5, x86_64, VMware, 4 vCPUs, Intel Xeon Gold 6148 @2.40GHz.
- RAM: 3911 MiB total, 2707 MiB used, 943 MiB available in the first sample.
- Swap: 4095 MiB total, 2733 MiB occupied. Occupied swap alone does not prove
  ongoing thrashing; the short vmstat sample showed one nonzero swap-in sample.
- Disk: 39 GiB total, 30 GiB used, 9.8 GiB available (75% used).
- Load averages: 2.73 / 3.28 / 3.48. Several 1-second vmstat samples reached
  99–100% user CPU; this is a short observation, not a sustained-load profile.
- Exam app ~44.6 MiB; PostgreSQL ~32.5 MiB; neither has a container CPU or RAM cap.
- Shared discovery worker ~1.3 GiB and ~190% Docker CPU in a later sample
  (about 1.9 cores, not 190% of the whole 4-core machine). n8n ~589 MiB.
- PostgreSQL 16: max_connections 100, 7 observed connections including inspection;
  1297 questions, 1 in-progress attempt, 6 grading and 2 published attempts.

Only resource reads and aggregate SQL queries were run. No services were stopped,
reconfigured or stress-tested, and no student answers or secrets were retrieved.
The competing workloads materially limit what can be inferred from nominal VPS
specs. Bandwidth entitlement and sustained available resources remain unknown.

## Remaining acceptance work

Obtain a separate test host matching the VPS's CPU/RAM limits and database version.
Local Docker/PostgreSQL binaries are not currently available. Do not run the load generator or test stack
on the production host. Use synthetic accounts, independent database/volumes,
disabled SMTP and no real OAuth users. Match media size distribution without
copying private student data.

Test 50/100/200/500 students with staggered starts, then simultaneous starts and
submissions. Include a save every 10 seconds, 15-second sync, media prefetch and
continuous-writing bursts; run each level long enough to expose queue growth.
Record p95/p99 API latency, failures, pool wait, CPU, RAM, disk and bandwidth.
Verify final answers and duplicate-submit behavior, not only HTTP status codes.
Suggested gates: save/sync p95 <500ms, p99 <1s, server errors <0.1%, no lost
acknowledged answers and stable resource/queue usage. Derive an operating limit
below the highest passing level with 30% headroom. These are proposed gates,
not measured production results.
