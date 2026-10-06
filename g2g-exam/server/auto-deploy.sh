#!/bin/sh
set -eu

REPO_ROOT="${G2G_REPO:-/opt/g2g-source}"
APP_DIR="${G2G_APP_DIR:-$REPO_ROOT/g2g-exam}"
BRANCH="${G2G_BRANCH:-main}"
COMPOSE_FILE="${G2G_COMPOSE_FILE:-docker-compose.traefik.yml}"
LOCK_FILE="${G2G_DEPLOY_LOCK:-/run/g2g-auto-deploy.lock}"
STATE_DIR="${G2G_DEPLOY_STATE_DIR:-/var/lib/g2g-auto-deploy}"
DEPLOYED_FILE="$STATE_DIR/deployed-sha"

log(){ printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
short(){ printf '%s' "$1" | cut -c1-12; }

command -v git >/dev/null 2>&1 || { log "git not found"; exit 1; }
command -v docker >/dev/null 2>&1 || { log "docker not found"; exit 1; }
command -v flock >/dev/null 2>&1 || { log "flock not found"; exit 1; }
[ -d "$REPO_ROOT/.git" ] || { log "repo missing: $REPO_ROOT"; exit 1; }
[ -f "$APP_DIR/server/.env" ] || { log "server/.env missing; refusing deploy"; exit 1; }
[ -f "$APP_DIR/.env" ] || { log ".env missing; refusing deploy"; exit 1; }

mkdir -p "$STATE_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

cd "$REPO_ROOT"
git fetch --quiet origin "$BRANCH"
target="$(git rev-parse "origin/$BRANCH")"
deployed="$(cat "$DEPLOYED_FILE" 2>/dev/null || true)"

# Only skip when we know this exact commit was successfully deployed. The old
# implementation compared the checkout HEAD; a failed build advanced HEAD and
# then prevented every later retry of that same commit.
if [ -n "$deployed" ] && [ "$deployed" = "$target" ]; then
  exit 0
fi

# If both commits are known and G2G itself did not change, advance the recorded
# deployed revision without rebuilding the app.
if [ -n "$deployed" ] && git cat-file -e "$deployed^{commit}" 2>/dev/null; then
  if git diff --quiet "$deployed" "$target" -- g2g-exam/; then
    log "repo advanced $(short "$deployed") -> $(short "$target"); no g2g-exam changes"
    git reset --hard "$target" >/dev/null
    printf '%s\n' "$target" >"$DEPLOYED_FILE"
    exit 0
  fi
fi

log "deploying G2G ${deployed:+$(short "$deployed") -> }$(short "$target")"
# VPS is a deployment checkout. Tracked local edits are intentionally discarded;
# untracked/ignored runtime secrets such as .env files are preserved.
git reset --hard "$target" >/dev/null

cd "$APP_DIR"
if ! sh server/check-code.sh; then
  log "syntax check FAILED at $(short "$target"); will retry next timer run"
  exit 1
fi

if ! docker compose -f "$COMPOSE_FILE" up -d --build app; then
  log "docker build/start FAILED at $(short "$target"); will retry next timer run"
  exit 1
fi

# Return as soon as the new container is healthy. A failed health check is NOT
# recorded as deployed, so the next timer run retries automatically.
i=0
while [ "$i" -lt 20 ]; do
  if docker compose -f "$COMPOSE_FILE" exec -T app node -e "fetch('http://127.0.0.1:8080/api/health').then(async r=>{if(!r.ok)throw new Error(await r.text());process.exit(0)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    printf '%s\n' "$target" >"$DEPLOYED_FILE"
    log "deploy healthy at $(short "$target")"
    exit 0
  fi
  i=$((i+1))
  sleep 1
done

log "deploy health check FAILED at $(short "$target"); will retry next timer run"
exit 1
