# G2G Exam — Backup & Disaster Recovery

Candidate implementation for G2G Exam only. Start with ACCEPTANCE.md for the
current gates, INSTALL.md for host prerequisites, and RESTORE.md for the
operator/AI recovery procedure.

> An isolated PostgreSQL 16 + age + local-Rclone restore drill has passed.
> Google Drive, the production VPS permissions, and production-data recovery
> are still unverified. Do not enable the systemd timer yet.

## Architecture

- `scripts/backup/backup.sh` creates a PostgreSQL custom-format dump, copies local authoritative uploads and optionally a separately prepared deployment configuration directory.
- Creates one independent compressed archive, encrypts it with age authenticated encryption, and uploads with Rclone to `G2G Exam/daily`.
- Verifies the remote bytes with SHA-256, retains 7 daily files, and keeps one independent archival copy refreshed after at least 30 days.
- `scripts/backup/restore.sh` only decrypts and extracts to a **new** staging directory. It never changes a running database or Docker volumes.

## Prerequisites

Ubuntu with `bash`, `postgresql-client` (pg_dump compatible with server), `age`, `rclone`, `tar`, `sha256sum`. Rclone must be configured with a private Google OAuth client and a remote named `gdrive`.

Store `BACKUP_AGE_RECIPIENT` and Rclone OAuth credentials **outside** the database and backups, with restrictive file permissions. Preserve the age private identity offline; without that identity encrypted backups cannot be recovered.

Example manual run (only after the production gates):

```bash
export DATABASE_URL='postgresql://...'
export UPLOAD_DIR='/data/uploads'
export BACKUP_AGE_RECIPIENT='age1...your-public-recipient'
export BACKUP_RCLONE_REMOTE='gdrive:G2G Exam'
bash scripts/backup/backup.sh
```

On a fresh VPS, download a backup using `rclone copyto`, then:

```bash
BACKUP_AGE_IDENTITY='/secure/age-identity.txt' bash scripts/backup/restore.sh ./g2g-YYYYMMDDTHHMMSSZ.tar.gz.age ./staging
cat ./staging/manifest.json
pg_restore --list ./staging/database.dump
```

**Stop here for human/AI verification.** Provision a fresh database, match application commit/schema and required secrets, then import using `pg_restore` only after explicit approval. Uploads should be restored into a new application-specific volume, not a shared VPS directory. Validate health, login, exam questions, attempts, media, and R2 before switching DNS/Traefik.

## Current production gates

The app integration includes master-admin control/status, Google OAuth flow,
systemd templates, 7-daily/1-monthly retention, a media-write barrier and an
isolated restore drill. The remaining gates are a real Drive upload/download
and a real VPS permission + isolated restore check. See ACCEPTANCE.md.

## Encryption key setup

Install `age` on both backup and recovery hosts. On a trusted administrator machine, run `age-keygen -o g2g-age-identity.txt`. Save the **private identity** securely offline; copy only the printed `age1...` public recipient to the backup host as `BACKUP_AGE_RECIPIENT`. Never commit or upload the private identity. A lost identity makes archives unrecoverable.

The restore script requires `BACKUP_AGE_IDENTITY=/path/to/private-identity.txt`. The backup server does not need the private identity.

**Important:** The isolated drill is not a production approval. The backup host
must receive only the public recipient; keep the private identity off the VPS.
