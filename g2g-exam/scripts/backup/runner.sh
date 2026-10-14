#!/usr/bin/env bash
# Dedicated host-side G2G backup runner. Called by systemd timer, never by HTTP request.
set -Eeuo pipefail
umask 077
: "${BACKUP_STATE_DIR:=/var/lib/g2g-exam-backup}"
: "${BACKUP_CONTROL_DIR:=$BACKUP_STATE_DIR}"
: "${BACKUP_SCRIPT_DIR:=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)}"
mkdir -p -m 700 "$BACKUP_STATE_DIR"
mkdir -p -m 700 "$BACKUP_CONTROL_DIR"
rm -f -- "$BACKUP_CONTROL_DIR/request"
exec 9>"$BACKUP_STATE_DIR/backup.lock"
if ! flock -n 9; then echo "Backup already running; skipping overlapping invocation"; exit 0; fi
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
tmp="$(mktemp "$BACKUP_CONTROL_DIR/.status.XXXXXX")"
status(){
  printf '{"state":"%s","startedAt":"%s","finishedAt":"%s"}\n' "$1" "$started" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$tmp"
  mv -f "$tmp" "$BACKUP_CONTROL_DIR/status.json"
}
status running
if output="$(bash "$BACKUP_SCRIPT_DIR/backup.sh" 2>&1)"; then
  status success
  # Store a bounded, non-secret history for the admin UI.
  BACKUP_OUTPUT="$output" BACKUP_CONTROL_DIR="$BACKUP_CONTROL_DIR" node --input-type=module -e '
    import fs from "node:fs";
    import path from "node:path";
    const dir=process.env.BACKUP_CONTROL_DIR;
    const file=path.join(dir,"history.json");
    let items=[];try{items=JSON.parse(fs.readFileSync(file,"utf8"));}catch{}
    const output=process.env.BACKUP_OUTPUT||"";
    const match=output.match(/BACKUP_OK timestamp=([^ ]+) sha256=([^ ]+) file=([^\\s]+)/);
    if(match){
      items.unshift({createdAt:match[1],hash:match[2],name:match[3],type:"daily"});
      items=items.slice(0,8);
      fs.writeFileSync(file+".tmp",JSON.stringify(items),{mode:0o600});
      fs.renameSync(file+".tmp",file);
    }
  '
  printf '%s\n' "$output"
else
  code="$?"
  status failed
  printf '%s\n' "$output" >&2
  exit "$code"
fi
