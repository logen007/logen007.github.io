#!/usr/bin/env bash
# An owner-only Unix socket and a fresh cluster; never uses the normal local DB.
set -Eeuo pipefail
command -v initdb >/dev/null
root="$(mktemp -d "${TMPDIR:-/tmp}/g2g-pg-drill.XXXXXXXX")"
cleanup(){ pg_ctl -D "$root/pg" -m fast -w stop >/dev/null 2>&1 || true; rm -rf -- "$root"; }
trap cleanup EXIT
chmod 700 "$root"
mkdir -m 700 "$root/socket"
initdb -D "$root/pg" -U postgres -A trust --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$root/pg" -l "$root/postgres.log" -o "-k $root/socket -p 55439 -c listen_addresses=''" -w start >/dev/null
export PGHOST="$root/socket" PGPORT=55439 PGUSER=postgres G2G_BACKUP_DISPOSABLE=true
bash tests/backup-real.integration.sh
