# G2G Exam — Backup & Disaster Recovery (work in progress)

> This branch is a **foundation**, not a production-ready integration. Do not enable unattended backups or assume disaster recovery is complete until a real restore drill passes.

## Architecture

- `scripts/backup/backup.sh` creates a PostgreSQL custom-format dump, copies local authoritative uploads and optionally a separately prepared deployment configuration directory.
- Creates one independent compressed archive, encrypts it with age authenticated encryption, and uploads with Rclone to `G2G Exam/daily`.
- Verifies the remote bytes with SHA-256, retains 7 daily files, and keeps one independent archival copy refreshed after at least 30 days.
- `scripts/backup/restore.sh` only decrypts and extracts to a **new** staging directory. It never changes a running database or Docker volumes.

## Prerequisites

Ubuntu with `bash`, `postgresql-client` (pg_dump compatible with server), `age`, `rclone`, `tar`, `sha256sum`. Rclone must be configured with a private Google OAuth client and a remote named `gdrive`.

Store `BACKUP_AGE_RECIPIENT` and Rclone OAuth credentials **outside** the database and backups, with restrictive file permissions. Preserve these recovery secrets offline; without the password encrypted backups cannot be recovered.

Example manual run (not yet automated):

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

## Outstanding production work

1. Wire master-admin-only Backup settings and Google OAuth with secure token storage.
2. Add scheduler with lock, persisted job statuses, manual trigger and dashboard status.
3. Inventory all deployment secrets/configuration, exclude credentials that must not be copied, and provide a safe encrypted export strategy.
4. Add application-level tests and a full restore drill on an isolated instance.
5. Validate 30-day retention behavior, upload failure recovery, and correct handling of database/media consistency.
6. Confirm volume mounts and backup utilities in the actual VPS runtime before enabling.

## Encryption key setup

Install `age` on both backup and recovery hosts. On a trusted administrator machine, run `age-keygen -o g2g-age-identity.txt`. Save the **private identity** securely offline; copy only the printed `age1...` public recipient to the backup host as `BACKUP_AGE_RECIPIENT`. Never commit or upload the private identity. A lost identity makes archives unrecoverable.

The restore script requires `BACKUP_AGE_IDENTITY=/path/to/private-identity.txt`. The backup server does not need the private identity.

**Important:** Current scripts have not passed an isolated restore drill. Do not run them as a production backup service yet.
