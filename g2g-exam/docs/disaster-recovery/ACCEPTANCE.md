# Integration status — 14 October 2026

Candidate branch: feature/g2g-drive-backup. Overlay: g2g-exam-backup-v12.zip.
Do not enable scheduled backup or merge to main until the remaining gates pass.

## Implemented in this candidate

- Merged current main without replacing the backup branch work.
- Integrated v12 backup, authenticated age staging restore, SHA-256 inventory,
  retention and recovery scripts.
- Unified status/history writers; recorded archive size and SHA-256.
- Bound OAuth callbacks to a signed browser cookie and one-use expiring state.
- Moved Rclone credentials to BACKUP_PRIVATE_DIR, outside the web mount.
- Web may write only requests/request; status/history are mounted read-only.
- Backup UI disables overlapping requests and refreshes without overlapping
  requests or polling hidden tabs. Uses the existing confirmation dialog.
- Added a Linux CI drill with real PostgreSQL 16, age and Rclone local storage,
  separate source/restore databases, media comparison and bad-key/tamper checks.
  This drill does not validate Google Drive or the production VPS.

## Required production gates

## Verified evidence

- Linux CI at commit 1168519: G2G Exam Check passed.
- G2G Backup isolated checks passed: all backup Node tests, shell syntax,
  mocked failure tests and the real PostgreSQL 16/age/Rclone-local restore drill.
- Real drill verified restored relational rows and UTF-8 answers, byte-identical
  media, manifest digests, rejection of the wrong age identity and tampered archive.
- Drive OAuth tests use controlled doubles. No Google Drive connection, live VPS
  permissions, production data restore or scheduled run has been verified.
- Current main remains v1.3.149. No backup release/version bump is claimed.

## Production prerequisites still outstanding

The owner reports no configured VPS access, Backup OAuth client or age key yet.
No production changes or timer activation have been made by this task.

1. Establish owner-authorized VPS access. Inspect only G2G containers, network,
   volumes, installed utilities and service identity. Never change shared services.
2. Create the dedicated Google OAuth client and authorize the master account.
   Verify drive.file, the created G2G Exam folder ID, token refresh, upload,
   download, checksum and revoked-token failure on the actual Drive.
3. Generate an age identity on the owner's trusted recovery machine. Preserve
   the private identity and SETTINGS_ENCRYPTION_KEY offline. Only the age public
   recipient belongs on the backup host. Do not send secrets through chat.
4. Configure host PostgreSQL connectivity with a restricted backup role and
   read-only authoritative uploads. Existing PostgreSQL has no exposed host port;
   do not open it publicly. Choose and verify the actual runner network strategy.
5. Provision the host control directory owned by g2g-backup:g2g-backup, mode 2750,
   and its requests child mode 2770. Use the actual numeric group ID in the
   optional docker-compose.backup.yml override. Rclone config belongs only in
   the private /run/g2g-exam-backup directory, never in either shared mount.
   Status/history are 0640; runner and app must pass a real permissions probe.
6. Provide an allowlisted non-secret deployment export and exact deployed Git SHA.
   Verify a G2G-only media write barrier/snapshot covering PostgreSQL dump and media
   capture. v12 inventory scans alone do not guarantee transactional consistency.
7. Perform a real isolated restore with representative G2G data and media, using
   the private identity on the separate recovery machine. Check login, ownership,
   exams, attempts, settings decryption and every referenced media file.
8. Only then increase the app version, merge/push main, install the verified
   systemd units and enable the 03:00 Asia/Ho_Chi_Minh timer. Test manual requests,
   scheduled execution, restart behavior and status on the actual VPS.

The unit files are templates, not proof of working installation. Existing
auto-deploy does not automatically include docker-compose.backup.yml; configure
that G2G-specific integration only after validating the host setup.
