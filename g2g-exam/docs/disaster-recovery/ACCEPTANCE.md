# Integration status — 16 October 2026

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

- The local isolated drill passed with PostgreSQL 16, age and Rclone local
  storage: dump, encrypted archive, checksum verification, staging restore,
  relational rows, UTF-8 answers, settings, media bytes, wrong-key rejection
  and tamper rejection.
- Drive OAuth tests use controlled doubles. No Google Drive connection, live VPS
  permissions, production data restore or scheduled run has been verified.
- Public-policy main is already v1.3.153; do not revert that version when
  merging this backup branch. No backup release/version bump is claimed.

## Production prerequisites still outstanding

The VPS has been inspected read-only. OAuth publishing is in production, but
Drive API/scope, redirect configuration, credentials and a connected Drive have
not been verified. No production changes or timer activation have been made.

1. Use the already authorized VPS session only to continue read-only inspection
   until the remaining gates pass; never change shared services.
2. Reuse the existing Google OAuth Web client without removing login callbacks.
   Add the Backup callback and drive.file scope, then authorize the master account.
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
