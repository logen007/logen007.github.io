#!/usr/bin/env bash
# Dedicated host-side G2G backup runner. Called by systemd timer, never by HTTP request.
set -Eeuo pipefail
umask 077
: "${BACKUP_STATE_DIR:=/var/lib/g2g-exam-backup}"
: "${BACKUP_SCRIPT_DIR:=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)}"
mkdir -p -m 700 "$BACKUP_STATE_DIR"
exec 9>"$BACKUP_STATE_DIR/backup.lock"
if ! flock -n 9; then echo "Backup already running; skipping overlapping invocation"; exit 0; fi
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
tmp="$(mktemp "$BACKUP_STATE_DIR/.status.XXXXXX")"
status(){
  printf '{"state":"%s","startedAt":"%s","finishedAt":"%s"}\n' "$1" "$started" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$tmp"
  mv -f "$tmp" "$BACKUP_STATE_DIR/status.json"
}
status running
if output="$(bash "$BACKUP_SCRIPT_DIR/backup.sh" 2>&1)"; then
  status success
  printf '%s\n' "$output"
else
  code="$?"
  status failed
  printf '%s\n' "$output" >&2
  exit "$code"
fi
