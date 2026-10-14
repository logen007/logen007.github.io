#!/usr/bin/env bash
# G2G Exam preflight: read-only checks before enabling scheduled backup.
set -Eeuo pipefail
: "${UPLOAD_DIR:=/data/uploads}"
: "${BACKUP_RCLONE_REMOTE:=gdrive:G2G Exam}"
failed=0
check(){ if command -v "$1" >/dev/null 2>&1; then printf 'OK %-12s %s\n' "$1" "$(command -v "$1")"; else printf 'MISSING %s\n' "$1"; failed=1; fi; }
for cmd in bash pg_dump pg_restore tar age rclone sha256sum date mktemp; do check "$cmd"; done
if [[ -d "$UPLOAD_DIR" && -r "$UPLOAD_DIR" ]]; then echo "OK uploads readable"; else echo "MISSING uploads: $UPLOAD_DIR"; failed=1; fi
if [[ -n "${DATABASE_URL:-}" ]] && command -v pg_dump >/dev/null 2>&1; then
  if pg_dump --dbname="$DATABASE_URL" --schema-only --file=/dev/null 2>/dev/null; then echo "OK PostgreSQL dump access"; else echo "FAIL PostgreSQL dump access"; failed=1; fi
else echo "INFO DATABASE_URL unset: database access not checked"; fi
if command -v rclone >/dev/null 2>&1; then
  if rclone lsf "${BACKUP_RCLONE_REMOTE%/}" --max-depth 1 >/dev/null 2>&1; then echo "OK Google Drive access"; else echo "FAIL Google Drive access"; failed=1; fi
fi
if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then echo "OK age recipient present"; else echo "MISSING BACKUP_AGE_RECIPIENT"; failed=1; fi
if [[ -n "${BACKUP_DEPLOY_DIR:-}" && ! -d "$BACKUP_DEPLOY_DIR" ]]; then echo "FAIL deployment directory"; failed=1; fi
if (( failed )); then echo "PREFLIGHT_FAILED"; exit 1; fi
echo "PREFLIGHT_OK (does not prove restore success)"
