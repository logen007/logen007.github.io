#!/usr/bin/env bash
# Simulates external binaries; does NOT test actual Google/age/PostgreSQL.
set -Eeuo pipefail
HERE="$(cd -- "$(dirname -- "$0")" && pwd)"
ROOT="$(cd -- "$HERE/.." && pwd)"
TMP="$(mktemp -d)";trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/uploads" "$TMP/remote" "$TMP/control" "$TMP/work" "$TMP/deployment"
printf 'audio example' > "$TMP/uploads/sample.mp3"
printf 'deployment example' > "$TMP/deployment/compose.yml"
cat > "$TMP/bin/pg_dump" <<'STUB'
#!/bin/bash
for arg in "$@"; do case "$arg" in --file=*) printf 'PGDMP mock dump' > "${arg#--file=}";; esac; done
STUB
cat > "$TMP/bin/pg_restore" <<'STUB'
#!/bin/bash
[[ -s "${@: -1}" ]]
STUB
cat > "$TMP/bin/age" <<'STUB'
#!/bin/bash
input=''; output=''; prev=''
for arg in "$@"; do
 if [[ "$prev" == '-o' ]]; then output="$arg";prev='';continue;fi
 if [[ "$arg" == '-o' ]]; then prev='-o';continue;fi
 if [[ "$arg" == *.tar.gz ]]; then input="$arg";fi
 if [[ "$arg" == *.age ]]; then input="$arg";fi
done
cp "$input" "$output"
STUB
cat > "$TMP/bin/rclone" <<'STUB'
#!/bin/bash
set -e
cmd="$1";shift
case "$cmd" in
 mkdir) mkdir -p "$1";;
 copyto) [[ "${MOCK_FAIL_UPLOAD:-}" != 1 ]] || { echo "Simulated Drive upload failure" >&2; exit 31; };mkdir -p "$(dirname "$2")";cp "$1" "$2";;
 cat) cat "$1";;
 lsf) folder="$1"; pattern="${@: -1}"; find "$folder" -maxdepth 1 -type f -name "$pattern" -printf '%f\n';;
 moveto) mv "$1" "$2";;
 deletefile) rm -f "$1";;
 *) echo "unsupported rclone $cmd" >&2;exit 1;;
esac
STUB
chmod +x "$TMP/bin/"*
export PATH="$TMP/bin:$PATH" DATABASE_URL='postgres://mock' UPLOAD_DIR="$TMP/uploads" BACKUP_AGE_RECIPIENT='age1mock' BACKUP_GIT_COMMIT='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' BACKUP_RCLONE_REMOTE="$TMP/remote" BACKUP_CONTROL_DIR="$TMP/control" BACKUP_WORKDIR="$TMP/work" BACKUP_DEPLOY_DIR="$TMP/deployment"
bash "$ROOT/scripts/backup/backup.sh"
[[ "$(find "$TMP/remote/daily" -type f | wc -l)" -eq 1 ]]
[[ "$(find "$TMP/remote/monthly" -type f | wc -l)" -eq 1 ]]
archive="$(find "$TMP/remote/daily" -type f | head -n 1)"
mkdir -p "$TMP/identity"; echo 'mock' > "$TMP/identity/key"
BACKUP_AGE_IDENTITY="$TMP/identity/key" bash "$ROOT/scripts/backup/restore.sh" "$archive" "$TMP/restored"
[[ -f "$TMP/restored/uploads/sample.mp3" ]]
node "$ROOT/scripts/backup/verify-staging.mjs" "$TMP/restored" >/dev/null
# A failed Drive upload must not delete or replace the previous verified backup.
previous="$(find "$TMP/remote/daily" -type f | sort | head -n 1)"
previous_hash="$(sha256sum "$previous" | cut -d' ' -f1)"
sleep 1
if MOCK_FAIL_UPLOAD=1 bash "$ROOT/scripts/backup/backup.sh" >/dev/null 2>&1; then
  echo 'Expected simulated Drive failure' >&2; exit 1
fi
[[ -f "$previous" && "$(sha256sum "$previous" | cut -d' ' -f1)" == "$previous_hash" ]]
[[ "$(find "$TMP/remote/daily" -type f | wc -l)" -eq 1 ]]
printf 'MOCK_INTEGRATION_OK_AND_UPLOAD_FAILURE_SAFE\n' 
