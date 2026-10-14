#!/usr/bin/env bash
# Read-only environment preflight for the host runner.
set -Eeuo pipefail
: "${UPLOAD_DIR:?Set authoritative UPLOAD_DIR}"
: "${BACKUP_DEPLOY_DIR:?Set BACKUP_DEPLOY_DIR}"
: "${BACKUP_CONTROL_DIR:=/var/lib/g2g-exam-backup}"
missing=0
for tool in bash pg_dump pg_restore node python3 tar age rclone sha256sum flock; do
  if command -v "$tool" >/dev/null 2>&1; then echo "OK $tool"; else echo "MISSING $tool"; missing=1; fi
done
for dir in "$UPLOAD_DIR" "$BACKUP_DEPLOY_DIR"; do
  if [[ -d "$dir" && -r "$dir" && ! -L "$dir" ]]; then echo "OK directory $dir"; else echo "INVALID directory $dir"; missing=1; fi
done
if [[ -d "$BACKUP_CONTROL_DIR" && -r "$BACKUP_CONTROL_DIR" && -w "$BACKUP_CONTROL_DIR" ]]; then
  echo 'OK shared control directory'
else
  echo 'INVALID shared control directory (web app and host runner need coordinated permissions)'
  missing=1
fi
if [[ -n "${BACKUP_AGE_RECIPIENT:-}" && "${BACKUP_AGE_RECIPIENT}" == age1* ]]; then
  echo 'OK age public recipient'
else
  echo 'MISSING age public recipient'; missing=1
fi
((missing==0)) || exit 1
echo 'PREFLIGHT_OK (Google OAuth and live restore not tested)'
