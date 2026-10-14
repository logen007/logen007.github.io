#!/usr/bin/env bash
# Extract into a new staging directory. Never overwrite a running G2G installation.
set -Eeuo pipefail
umask 077
if (( $# != 2 )); then echo "Usage: BACKUP_PASSWORD=... $0 /path/to/backup.tar.gz.enc /empty/staging-directory" >&2; exit 2; fi
: "${BACKUP_PASSWORD:?BACKUP_PASSWORD is required}"
archive="$1"; target="$2"
[[ -f "$archive" ]] || { echo "Backup file not found" >&2; exit 1; }
[[ ! -e "$target" ]] || { echo "Target already exists; refusing to overwrite" >&2; exit 1; }
mkdir -m 700 -- "$target"
trap 'echo "Restore failed; inspect staging directory" >&2' ERR
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -in "$archive" -pass env:BACKUP_PASSWORD | tar -xz -C "$target" --no-same-owner
[[ -s "$target/database.dump" && -f "$target/manifest.json" && -d "$target/uploads" ]] || { echo "Incomplete backup" >&2; exit 1; }
echo "Extracted to $target. Database NOT imported; services NOT changed."
echo "Review manifest and deployment configuration, then restore PostgreSQL with pg_restore into a NEW database."
