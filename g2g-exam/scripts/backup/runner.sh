#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
: "${BACKUP_CONTROL_DIR:=/var/lib/g2g-exam-backup}"
: "${BACKUP_PRIVATE_DIR:?Set a private directory outside the web control mount}"
mkdir -p -m 700 "$BACKUP_CONTROL_DIR"
# Serialize credential preparation and the entire backup. backup.sh also locks direct calls.
exec 8>"$BACKUP_CONTROL_DIR/runner.lock"
flock -n 8 || { echo "Backup runner already active" >&2; exit 75; }
# A request is acknowledged only after the runner owns the single-flight lock.
rm -f -- "$BACKUP_CONTROL_DIR/requests/request"
node "$HERE/runner-status.mjs" "$BACKUP_CONTROL_DIR" running
trap 'node "$HERE/runner-status.mjs" "$BACKUP_CONTROL_DIR" failed || true' ERR
export RCLONE_CONFIG="$BACKUP_PRIVATE_DIR/rclone.conf"
# Require a shared application-specific control mount.
: "${DATABASE_URL:?Missing database URL}"
[[ "${BACKUP_MEDIA_GUARD_ENABLED:-false}" == true ]] || { echo 'Media-write barrier must be enabled in both runner and app' >&2; false; }
export NODE_ENV=production
if ! node "$HERE/prepare-rclone.mjs"; then
  node "$HERE/runner-status.mjs" "$BACKUP_CONTROL_DIR" failed || true
  echo "Could not prepare Google Drive authorization" >&2
  exit 1
fi
bash "$HERE/backup.sh"
