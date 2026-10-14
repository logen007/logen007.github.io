# G2G Exam Backup — implementation contract

Status: **NOT PRODUCTION READY**. Do not merge without tests and isolated restore drill.

## Approved user requirements

- UI section named **Backup**, inside Settings → Nâng cao, master-only.
- Google Drive folder `G2G Exam`, auto-created after OAuth connection.
- Daily full independent encrypted archive at **03:00 Asia/Ho_Chi_Minh**, retain 7 daily versions.
- One independent archive created every 30 days, retain exactly 1 archival version (policy A).
- Latest backup status and timestamp displayed as a compact dashboard line.
- Backup now, history, download/restore instructions; self-contained emergency recovery guide.
- Authoritative media source: local VPS uploads. R2 is a mirror and must not be treated as complete source.
- Back up PostgreSQL, local uploads, and deploy configuration required for an isolated restore. Source code pinned by Git commit.
- Never change shared Traefik, volumes or other services; never overwrite live DB during restore.

## Existing owners to extend

- `src/settings/view.js`: settings cards. Add Backup card with `id=sBackupCard`.
- `src/settings/tabs.js`: append `sBackupCard` to the advanced group.
- `src/settings.js`: call a dedicated `bindBackupSettings()` next to `bindR2Settings()`.
- `src/settings/api.js`: typed request helpers; avoid duplicate HTTP code.
- `server/src/actions/index.js`: dispatch master-only backup actions.
- `server/src/actions/settings.js`: infrastructure status (lightweight, no media scans for summary).
- `src/views/dashboard-infrastructure.js`: one concise Backup line/link.
- `server/src/settings-secrets.js`: existing AES-256-GCM encrypted secrets store; reuse for OAuth tokens.
- `server/src/r2-media.js`: local uploads are authoritative.
- `src/release.js`: bump patch after tested merge.

## Secure connection

Use a **separate Google OAuth client** from the existing student login flow. Scope to `https://www.googleapis.com/auth/drive.file`. Redirect URI must be explicitly configured, with one-time state, expiration and current master-session binding; reject replay/CSRF. Persist encrypted refresh token server-side, never expose it in GET settings, logs, frontend, archive or repository. Refresh access tokens server-side and mark connection expired when revoked. Create/find application-created folder `G2G Exam` and persist folder ID. Note that `drive.file` cannot browse arbitrary pre-existing Drive files. Provide a disconnect action that revokes and clears stored credentials without deleting backups.

## Backup execution

**Do not run `pg_dump` inside a web request handler.** Use a dedicated, least-privilege host-side runner. API queues a job and immediately returns an ID; runner performs work asynchronously. Ensure single-flight with a host lock plus DB lease if multiple app replicas are possible. Timezone-aware daily scheduling must not rely on process uptime. On restart, safely recover stale jobs and missed runs without concurrent duplicates. Track `queued/running/success/failed`, start/end timestamps, file size, hash, failure reason and backup type.

For first release, deploy runner with rclone OAuth config written securely from encrypted server settings into a private runtime config file, never as command-line secret. Prefer a private mounted file descriptor or restricted environment file for `BACKUP_PASSWORD`. Do not expose password in process arguments. Never include host private keys, Google OAuth refresh token or the backup encryption key inside the backup itself. Capture the deployment manifest and necessary non-secret configuration; document required external secrets separately.

Database dump and uploads are captured at different instants. For strict restore consistency, either use a stable media inventory with content-hash verification and retries, or pause only relevant media mutation during snapshot capture. Preserve files referenced by the dump. Fail rather than claim success if the consistency condition cannot be met.

Run backup in a temporary directory with free-space preflight, timeouts, size limits, no symlink escapes, no shell interpolation from user input, and cleanup on failure. Remote verification must cover the entire uploaded archive; never prune old versions until the new one passes. Keep the last verified daily if a scheduled run fails. For 30-day retention, use UTC timestamps and explicit elapsed-day policy. Provide failure visibility and retry.

**Security hardening required before production:** current foundation script uses AES-256-CBC without an authentication tag. Replace with authenticated encryption (e.g. age with a protected identity, or a well-tested authenticated container) and verify tampering fails before extracting. Ensure decrypted tar cannot write outside staging via absolute paths, `..` or links. Do not run tar extraction as root.

## Restore flow

1. Obtain Recovery Kit from GitHub at the pinned commit (not from the broken site).
2. On a **new isolated** VPS, provision Docker/PostgreSQL and necessary application-specific directories.
3. Authenticate Google Drive, select verified archive, retrieve it, decrypt into a fresh staging directory.
4. Verify authenticated encryption, manifest, expected files, checksums, DB dump list and Git commit.
5. Restore into a **new empty DB**, then stage uploads into an app-specific volume.
6. Provide required external secrets via secure out-of-band setup; rebuild matching app revision.
7. Test DB migrations, health, login, permissions, sample exams, attempt results, media and R2.
8. Explicit human approval before switching production traffic. No automatic DNS or Traefik edits.

## Required tests / acceptance

- Master can connect/disconnect; teacher/student forbidden; OAuth CSRF/replay rejected.
- Missing/revoked Google credentials fail with actionable UI, no token leakage.
- Backup now returns promptly and cannot overlap scheduled run.
- Partial upload, checksum mismatch, pg_dump failure, upload changes, low disk space, Google quota and process restart never mark a false success or prune good archives.
- Daily 7 + archive 1; archive refresh only at >=30 elapsed days.
- Tampered archive fails authentication; wrong password fails; malformed tar cannot escape staging.
- Restore drill on isolated PostgreSQL confirms representative exams, accounts, attempts, and every referenced media file.
- Dashboard status reflects last verified upload, not merely scheduler tick.
- Run `sh server/check-code.sh`, relevant tests, `npm test` for architecture/data/security changes, and `npm run test:r2` if R2 behavior changes. CI must pass.

## Current branch contents

- `scripts/backup/backup.sh`: prototype; **not production-safe yet**.
- `scripts/backup/restore.sh`: staging-only extraction; **needs authenticated encryption and tar hardening**.
- `scripts/backup/preflight.sh`: read-only dependency probe.
- `docs/disaster-recovery/README.md`: early runbook.

Do not present the above as a completed or enabled feature. Production deployment and a real backup are separate milestones.
