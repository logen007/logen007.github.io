#!/usr/bin/env bash
# G2G Exam: standalone encrypted backup to Google Drive through rclone.
set -Eeuo pipefail
umask 077
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_PASSWORD:?BACKUP_PASSWORD is required (store outside the backup)}"
: "${UPLOAD_DIR:=/data/uploads}"
: "${BACKUP_RCLONE_REMOTE:=gdrive:G2G Exam}"
: "${BACKUP_WORKDIR:=/tmp}"
for cmd in pg_dump tar openssl rclone sha256sum mktemp date; do command -v "$cmd" >/dev/null || { echo "Missing: $cmd" >&2; exit 1; }; done
[[ -d "$UPLOAD_DIR" ]] || { echo "Missing uploads directory: $UPLOAD_DIR" >&2; exit 1; }
work="$(mktemp -d "${BACKUP_WORKDIR%/}/g2g-backup.XXXXXXXX")"
trap 'rm -rf -- "$work"' EXIT
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$work/payload"
pg_dump --dbname="$DATABASE_URL" --format=custom --file="$work/payload/database.dump"
cp -a -- "$UPLOAD_DIR" "$work/payload/uploads"
if [[ -n "${BACKUP_DEPLOY_DIR:-}" ]]; then
  [[ -d "$BACKUP_DEPLOY_DIR" ]] || { echo "Missing deployment directory" >&2; exit 1; }
  cp -a -- "$BACKUP_DEPLOY_DIR" "$work/payload/deployment"
fi
printf '{"format":1,"created_utc":"%s","source":"G2G Exam","git_commit":"%s"}\n' \
  "$stamp" "${G2G_GIT_COMMIT:-unknown}" > "$work/payload/manifest.json"
tar -C "$work/payload" -czf "$work/archive.tar.gz" .
# PBKDF2 + random salt; password is never placed in the archive.
openssl enc -aes-256-cbc -pbkdf2 -iter 250000 -salt -in "$work/archive.tar.gz" \
  -out "$work/g2g-$stamp.tar.gz.enc" -pass env:BACKUP_PASSWORD
remote="${BACKUP_RCLONE_REMOTE%/}"
rclone mkdir "$remote/daily"
rclone mkdir "$remote/monthly"
file="g2g-$stamp.tar.gz.enc"
rclone copyto "$work/$file" "$remote/daily/$file"
# Verify uploaded bytes, not merely a successful HTTP response.
local_hash="$(sha256sum "$work/$file" | awk '{print $1}')"
remote_hash="$(rclone cat "$remote/daily/$file" | sha256sum | awk '{print $1}')"
[[ "$local_hash" == "$remote_hash" ]] || { echo "Remote checksum mismatch; retention skipped" >&2; exit 1; }
# Independent 30-day archival copy; retain one only after new archive is verified.
monthly_files="$(rclone lsf "$remote/monthly" --files-only --include 'g2g-*.tar.gz.enc' | sort)"
latest_monthly="$(printf '%s\n' "$monthly_files" | tail -n 1)"
create_monthly=false
if [[ -z "$latest_monthly" ]]; then
  create_monthly=true
else
  old_stamp="${latest_monthly#g2g-}"; old_stamp="${old_stamp%.tar.gz.enc}"
  if [[ "$old_stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]; then
    old_epoch="$(date -u -d "${old_stamp:0:8} ${old_stamp:9:2}:${old_stamp:11:2}:${old_stamp:13:2}" +%s)"
    now_epoch="$(date -u +%s)"
    (( now_epoch - old_epoch >= 30*86400 )) && create_monthly=true
  else
    echo "Invalid monthly filename; preserving archive" >&2
  fi
fi
if [[ "$create_monthly" == true ]]; then
  rclone copyto "$work/$file" "$remote/monthly/$file"
  monthly_hash="$(rclone cat "$remote/monthly/$file" | sha256sum | awk '{print $1}')"
  [[ "$local_hash" == "$monthly_hash" ]] || { echo "Monthly checksum mismatch" >&2; exit 1; }
  while IFS= read -r old; do [[ -z "$old" || "$old" == "$file" ]] || rclone deletefile "$remote/monthly/$old"; done <<< "$monthly_files"
fi
# Keep seven verified daily archives, delete older ones only after successful upload.
mapfile -t daily_files < <(rclone lsf "$remote/daily" --files-only --include 'g2g-*.tar.gz.enc' | sort)
if (( ${#daily_files[@]} > 7 )); then
  for old in "${daily_files[@]:0:${#daily_files[@]}-7}"; do
    [[ "$old" == "$file" ]] || rclone deletefile "$remote/daily/$old"
  done
fi
echo "BACKUP_OK timestamp=$stamp sha256=$local_hash file=$file"
