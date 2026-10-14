# G2G Exam disaster recovery — operator and AI instructions

**Only use a new, isolated VPS and a new empty PostgreSQL database. Never import into a live DB.**

1. Obtain this recovery kit and exact source commit from GitHub. Install Node 22+, Docker, PostgreSQL client matching server major version, `age`, `rclone`, Python 3, and tar.
2. Obtain the **private age identity** separately from the owner. Obtain Google OAuth access via an administrator-owned rclone profile; no existing G2G site is needed.
3. List Drive backups: `rclone lsf 'gdrive:daily'` or `gdrive:monthly` (with the G2G Exam folder ID configured as Rclone `root_folder_id`). Download one complete file with `rclone copyto`.
4. Verify encrypted-file SHA-256 against a separately saved trusted hash from the backup history, if available. Run `BACKUP_AGE_IDENTITY=/secure/identity.txt bash scripts/backup/restore.sh backup.tar.gz.age /new/staging`.
5. Read `/new/staging/manifest.json` and confirm full Git SHA. Restore source at that commit. Verify PostgreSQL dump with `pg_restore --list /new/staging/database.dump`.
6. Provision **new** database and app-specific upload volume. Only after explicit human approval, run `pg_restore --no-owner --no-acl --dbname="$NEW_DATABASE_URL" /new/staging/database.dump` and stage the uploads into the new dedicated volume. Never point this command at the old database.
7. Restore necessary deployment config after checking its content. Re-enter external secrets (database passwords, `SETTINGS_ENCRYPTION_KEY`, cookie secret, OAuth, R2 keys) from secure offline custody. Do not put these secrets into Git or an unencrypted archive.
8. Build and start the pinned application in an isolated network. Check `/api/health`, sample login, permissions, exam questions, student attempts, image/audio files, and R2. Verify that encrypted secrets can still be decrypted with the original settings encryption key.
9. Require owner approval before changing DNS, Traefik routes, or production traffic. Retain the old VPS and backups until validation is complete.

**Critical:** An encrypted DB dump is not sufficient without the original `SETTINGS_ENCRYPTION_KEY` used by G2G's `secrets` table. Preserve that key separately. Backup media and database are copied at different times; live concurrent writes can cause inconsistent snapshots. A deployment must implement or verify a stable snapshot / controlled media-write window before claiming full recovery guarantees.

## Interactive Recovery Kit (recommended)

On a new machine, configure an independent Rclone Drive remote named `gdrive` whose root is the `G2G Exam` folder (or set `BACKUP_RECOVERY_REMOTE` accordingly). Keep the private age identity offline until recovery.

```bash
export BACKUP_AGE_IDENTITY=/secure/offline/g2g-age-identity.txt
bash scripts/backup/recovery.sh
```

Select one of the available daily/monthly archives and provide a **new** absolute staging path. The script downloads, authenticates, extracts, verifies SHA-256 for each file, and checks the PostgreSQL dump format. It **never imports into PostgreSQL** or changes the live application. Continue with the operator-approved isolated restore steps above.
