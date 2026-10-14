# Backup deployment checklist (not an automatic installer)

1. Copy the `scripts/backup` directory into the deployed G2G Exam app tree. Verify app-specific database/volume paths on the VPS. Do not touch shared Traefik or other services.
2. Create dedicated `g2g-backup` user with **read-only** PostgreSQL dump access, read-only uploads, and write access only to `/var/lib/g2g-exam-backup` and an isolated scratch area. It needs access to the application's encrypted secrets and the matching `SETTINGS_ENCRYPTION_KEY` for OAuth credential handoff.
3. Install `pg_dump`, `pg_restore`, `node`, `age`, `rclone`, `tar`, `sha256sum`, `flock`, `python3`. Configure an OAuth client specifically for Backup with redirect URI `https://exam.g2gcareer.com/api/backup/google/callback` and Drive scope `drive.file`.
4. Set `/etc/g2g-exam/backup.env` (owner root, mode 0600): `DATABASE_URL`, `UPLOAD_DIR`, `BACKUP_GIT_COMMIT`, `BACKUP_AGE_RECIPIENT`, `BACKUP_GOOGLE_CLIENT_ID`, `BACKUP_GOOGLE_CLIENT_SECRET`, `SETTINGS_ENCRYPTION_KEY`, and `BACKUP_DEPLOY_DIR` (required). Never commit this file. `BACKUP_DEPLOY_DIR` must contain only files approved for encrypted backup, not other VPS service data.
5. The runner Rclone config uses the OAuth-created folder ID as \`root_folder_id\`, so \`BACKUP_RCLONE_REMOTE=gdrive:\` (not \`gdrive:G2G Exam\`). Ensure Rclone and the web app share the dedicated OAuth client ID and that Rclone can refresh tokens.
6. The Node app and host runner must share the same **app-specific** control directory. If the Node app runs in Docker, mount `/var/lib/g2g-exam-backup` into its container at the configured `BACKUP_CONTROL_DIR` with appropriate permissions. A request marker is only a queue signal; it must never execute arbitrary user-provided shell commands.
6. Copy systemd units from this directory to `/etc/systemd/system`, adjust ExecStart and filesystem access to actual deployment, run `systemctl daemon-reload`, then enable timer/path **only after** an isolated restore drill. Do not enable on the production VPS before acceptance tests.
7. Verify the daily upload, remote checksum, archive retention, restore in isolated environment, and dashboard status. Confirm Google token refresh and account quota handling.

The timer uses `Asia/Ho_Chi_Minh` and the retention policy is 7 daily plus 1 archive refreshed after 30 elapsed days. Note that Google Drive `drive.file` only sees files created or explicitly authorized by this app; do not manually move archives into unrelated folders.

## Consistency and limitations
The runner now rejects a backup when the authoritative uploads inventory changes between the pre-dump and post-copy scans, or when copied media differs from the source. This detects ordinary concurrent changes but does not guarantee an atomic database/media snapshot under adversarial races. For a formal point-in-time guarantee, pause only G2G Exam media writes or take a consistent application-specific filesystem snapshot while dumping PostgreSQL.
