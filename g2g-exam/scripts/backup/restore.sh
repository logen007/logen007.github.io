#!/usr/bin/env bash
# Safe, staging-only restore. Never imports DB or overwrites running services.
set -Eeuo pipefail
umask 077
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if (( $# != 2 )); then echo 'Usage: BACKUP_AGE_IDENTITY=/secure/identity.txt restore.sh archive.tar.gz.age /new/staging' >&2; exit 2; fi
: "${BACKUP_AGE_IDENTITY:?Private age identity required}"
archive="$1"; target="$2"
[[ -f "$archive" && -f "$BACKUP_AGE_IDENTITY" ]] || { echo 'Archive or identity not found' >&2; exit 1; }
[[ ! -e "$target" && ! -L "$target" ]] || { echo 'Staging directory must not exist' >&2; exit 1; }
for cmd in age python3 node mktemp pg_restore; do command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 1; }; done
work="$(mktemp -d)"; trap 'rm -rf -- "$work"' EXIT
# Authenticated decryption completes before archive parsing.
age -d -i "$BACKUP_AGE_IDENTITY" -o "$work/archive.tar.gz" "$archive"
mkdir -m 700 -- "$target"
python3 "$HERE/safe-extract.py" "$work/archive.tar.gz" "$target"
node "$HERE/verify-staging.mjs" "$target"
pg_restore --list "$target/database.dump" >/dev/null
printf 'RESTORE_STAGING_OK: %s\n' "$target"
echo 'Database and application NOT changed. Follow RESTORE.md for isolated import.'
