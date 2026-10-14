#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
TMP="$(mktemp -d)";trap 'rm -rf -- "$TMP"' EXIT
mkdir -p "$TMP/uploads" "$TMP/remote" "$TMP/work" "$TMP/control"
output="$(DATABASE_URL=mock UPLOAD_DIR="$TMP/uploads" BACKUP_AGE_RECIPIENT=age1mock BACKUP_GIT_COMMIT=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa BACKUP_RCLONE_REMOTE="$TMP/remote" BACKUP_WORKDIR="$TMP/work" BACKUP_CONTROL_DIR="$TMP/control" bash "$ROOT/scripts/backup/backup.sh" 2>&1)" && { echo 'Unexpected success without deployment config' >&2;exit 1; }
[[ "$output" == *'BACKUP_DEPLOY_DIR is required'* ]]
[[ -z "$(find "$TMP/remote" -type f -print -quit)" ]]
echo 'Required deployment config guard passed'
