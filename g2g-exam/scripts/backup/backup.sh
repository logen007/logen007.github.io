#!/usr/bin/env bash
# G2G Exam standalone full backup. Requires a dedicated least-privilege host account.
set -Eeuo pipefail
umask 077
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
: "${DATABASE_URL:?Set DATABASE_URL}"
: "${UPLOAD_DIR:?Set UPLOAD_DIR to authoritative local uploads}"
: "${BACKUP_AGE_RECIPIENT:?Set age public recipient}"
: "${BACKUP_GIT_COMMIT:?Set pinned full git commit SHA}"
: "${BACKUP_RCLONE_REMOTE:=gdrive:}"
# Rclone root_folder_id points at the OAuth-created G2G Exam folder.
: "${BACKUP_WORKDIR:=/tmp}"
: "${BACKUP_CONTROL_DIR:=/var/lib/g2g-exam-backup}"
[[ -n "${BACKUP_DEPLOY_DIR:-}" && -d "$BACKUP_DEPLOY_DIR" && ! -L "$BACKUP_DEPLOY_DIR" ]] || { echo 'BACKUP_DEPLOY_DIR is required for full disaster recovery' >&2; exit 1; }
for cmd in pg_dump pg_restore node tar age rclone sha256sum flock mktemp; do command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 1; }; done
[[ "$BACKUP_GIT_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo 'Full commit SHA required' >&2; exit 1; }
[[ -d "$UPLOAD_DIR" && ! -L "$UPLOAD_DIR" ]] || { echo 'Invalid uploads directory' >&2; exit 1; }
mkdir -p -m 700 "$BACKUP_CONTROL_DIR"
exec 9>"$BACKUP_CONTROL_DIR/backup.lock"
flock -n 9 || { echo 'Backup already running' >&2; exit 75; }
work="$(mktemp -d "${BACKUP_WORKDIR%/}/g2g-backup.XXXXXXXX")"
trap 'rm -rf -- "$work"' EXIT
mkdir -m 700 "$work/payload"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="g2g-${stamp}.tar.gz.age"
node "$HERE/runner-status.mjs" "$BACKUP_CONTROL_DIR" running || true
fail(){ node "$HERE/runner-status.mjs" "$BACKUP_CONTROL_DIR" failed || true; }
trap 'fail; rm -rf -- "$work"' ERR
if [[ "${BACKUP_MEDIA_GUARD_ENABLED:-false}" == true ]]; then
  node "$HERE/capture.mjs" "$work"
else
  [[ "${NODE_ENV:-}" != production ]] || { echo 'Production requires the media-write barrier' >&2; exit 1; }
  bash "$HERE/capture.sh" "$work"
fi
# Do not persist macOS resource-fork sidecars or platform ACL/xattr metadata:
# they are not payload files and would correctly fail staging-manifest checks.
tar --no-acls --no-xattrs --exclude='._*' --exclude='./._*' --exclude='*/._*' --exclude='./*/._*' -czf "$work/archive.tar.gz" -C "$work/payload" .
age -r "$BACKUP_AGE_RECIPIENT" -o "$work/$file" "$work/archive.tar.gz"
remote="${BACKUP_RCLONE_REMOTE%/}"
rclone mkdir "$remote/daily"
rclone mkdir "$remote/monthly"
existing="$(rclone lsf "$remote/daily" --files-only --include "$file")"
[[ -z "$existing" ]] || { echo 'Archive name already exists; refusing overwrite' >&2; exit 1; }
rclone copyto "$work/$file" "$remote/daily/$file.pending"
local_hash="$(sha256sum "$work/$file" | cut -d' ' -f1)"
remote_hash="$(rclone cat "$remote/daily/$file.pending" | sha256sum | cut -d' ' -f1)"
[[ "$local_hash" == "$remote_hash" ]] || { echo 'Daily upload verification failed' >&2; exit 1; }
rclone moveto "$remote/daily/$file.pending" "$remote/daily/$file"
# Do not prune a previous verified copy before the new one is checked.
monthly_listing="$(rclone lsf "$remote/monthly" --files-only --include 'g2g-*.tar.gz.age')"
monthly_current="$(printf '%s\n' "$monthly_listing" | sort | tail -n 1)"
archived=false
if node "$HERE/archive-due.mjs" "$monthly_current"; then
  rclone copyto "$work/$file" "$remote/monthly/$file.pending"
  [[ "$(rclone cat "$remote/monthly/$file.pending" | sha256sum | cut -d' ' -f1)" == "$local_hash" ]] || { echo 'Monthly verification failed' >&2; exit 1; }
  rclone moveto "$remote/monthly/$file.pending" "$remote/monthly/$file"
  archived=true
  while IFS= read -r old; do
    [[ -z "$old" || "$old" == "$file" ]] || rclone deletefile "$remote/monthly/$old"
  done <<< "$monthly_listing"
fi
daily_listing="$(rclone lsf "$remote/daily" --files-only --include 'g2g-*.tar.gz.age')"
mapfile -t daily < <(printf '%s\n' "$daily_listing" | sed '/^$/d' | sort)
if (( ${#daily[@]} > 7 )); then
  for old in "${daily[@]:0:${#daily[@]}-7}"; do
    [[ "$old" == "$file" ]] || rclone deletefile "$remote/daily/$old"
  done
fi
node "$HERE/record-history.mjs" "$BACKUP_CONTROL_DIR" "$file" "$local_hash" "$archived" "$(wc -c < "$work/$file")"
node "$HERE/runner-status.mjs" "$BACKUP_CONTROL_DIR" success
printf 'BACKUP_OK file=%s sha256=%s\n' "$file" "$local_hash"
