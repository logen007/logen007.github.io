#!/usr/bin/env bash
# Called only inside the optional PostgreSQL media-write barrier.
set -Eeuo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
work="$1"
node "$HERE/validate-deployment.mjs" "$BACKUP_DEPLOY_DIR"
node "$HERE/media-inventory.mjs" "$UPLOAD_DIR" "$work/media-before.json"
# Some pg_dump builds treat PGDATABASE literally rather than as a URI.  Use a
# private libpq service file instead: it preserves URI query options (including
# Unix socket host/port and SSL settings) without putting credentials in argv.
[[ "$DATABASE_URL" != *$'\n'* && "$DATABASE_URL" != *$'\r'* ]] || { echo 'DATABASE_URL must not contain a newline' >&2; exit 1; }
service_file="$(mktemp "$work/.pg_service.XXXXXXXX")"
chmod 600 "$service_file"
cleanup_service_file(){ rm -f -- "$service_file"; }
trap cleanup_service_file EXIT
node "$HERE/libpq-service.mjs" "$DATABASE_URL" "$service_file"
PGSERVICE=g2g_backup_capture PGSERVICEFILE="$service_file" pg_dump --format=custom --file="$work/payload/database.dump"
pg_restore --list "$work/payload/database.dump" >/dev/null
mkdir -m 700 "$work/payload/uploads"
cp -a "$UPLOAD_DIR"/. "$work/payload/uploads"/
node "$HERE/media-inventory.mjs" "$UPLOAD_DIR" "$work/media-after.json"
node "$HERE/compare-inventory.mjs" "$work/media-before.json" "$work/media-after.json"
mkdir -m 700 "$work/payload/deployment"
node "$HERE/validate-deployment.mjs" "$BACKUP_DEPLOY_DIR"
cp -a "$BACKUP_DEPLOY_DIR"/. "$work/payload/deployment"/
node "$HERE/make-manifest.mjs" "$work/payload" "$BACKUP_GIT_COMMIT"
node "$HERE/verify-staging.mjs" "$work/payload" >/dev/null
node "$HERE/verify-media-copy.mjs" "$work/media-after.json" "$work/payload/uploads"
node "$HERE/media-inventory.mjs" "$UPLOAD_DIR" "$work/media-final.json"
node "$HERE/compare-inventory.mjs" "$work/media-after.json" "$work/media-final.json"
