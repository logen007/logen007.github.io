#!/bin/sh
set -eu

REPO_ROOT="${G2G_REPO:-/opt/g2g-source}"
APP_DIR="${G2G_APP_DIR:-$REPO_ROOT/g2g-exam}"
BRANCH="${G2G_BRANCH:-main}"
COMPOSE_FILE="${G2G_COMPOSE_FILE:-docker-compose.traefik.yml}"
LOCK_FILE="${G2G_DEPLOY_LOCK:-/run/g2g-auto-deploy.lock}"

log(){ printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
short(){ printf '%s' "$1" | cut -c1-12; }

command -v git >/dev/null 2>&1 || { log "git not found"; exit 1; }
command -v docker >/dev/null 2>&1 || { log "docker not found"; exit 1; }
command -v flock >/dev/null 2>&1 || { log "flock not found"; exit 1; }
[ -d "$REPO_ROOT/.git" ] || { log "repo missing: $REPO_ROOT"; exit 1; }
[ -f "$APP_DIR/server/.env" ] || { log "server/.env missing; refusing deploy"; exit 1; }
[ -f "$APP_DIR/.env" ] || { log ".env missing; refusing deploy"; exit 1; }

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

cd "$REPO_ROOT"
before="$(git rev-parse HEAD)"
git fetch --quiet origin "$BRANCH"
target="$(git rev-parse "origin/$BRANCH")"

if [ "$before" = "$target" ]; then
  exit 0
fi

if git diff --quiet "$before" "$target" -- g2g-exam/; then
  log "repo advanced $(short "$before") -> $(short "$target"); no g2g-exam changes"
  git reset --hard "$target" >/dev/null
  exit 0
fi

log "deploying G2G $(short "$before") -> $(short "$target")"
# VPS is a deployment checkout. Tracked local edits are intentionally discarded;
# untracked/ignored runtime secrets such as .env files are preserved.
git reset --hard "$target" >/dev/null

cd "$APP_DIR"
if ! sh server/check-code.sh; then
  log "syntax check FAILED at $(short "$target"); live container left unchanged"
  exit 1
fi

docker compose -f "$COMPOSE_FILE" up -d --build app

sleep 4
if docker compose -f "$COMPOSE_FILE" exec -T app node -e "fetch('http://127.0.0.1:8080/api/health').then(async r=>{const t=await r.text();if(!r.ok)throw new Error(t);console.log(t)}).catch(e=>{console.error(e);process.exit(1)})"; then
  log "deploy healthy at $(short "$target")"
else
  log "deploy health check FAILED at $(short "$target")"
  exit 1
fi
