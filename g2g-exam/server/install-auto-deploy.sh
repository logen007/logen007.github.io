#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(git -C "$APP_DIR" rev-parse --show-toplevel)"

[ -f "$APP_DIR/server/.env" ] || { echo "Missing $APP_DIR/server/.env" >&2; exit 1; }
[ -f "$APP_DIR/.env" ] || { echo "Missing $APP_DIR/.env" >&2; exit 1; }

# Run the deploy script directly from the checkout so future script improvements
# are picked up automatically after each git update; no stale /usr/local copy.
chmod 0755 "$SCRIPT_DIR/auto-deploy.sh"

cat >/etc/systemd/system/g2g-auto-deploy.service <<EOF
[Unit]
Description=G2G Exam auto deploy from GitHub
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
Environment=G2G_REPO=$REPO_ROOT
Environment=G2G_APP_DIR=$APP_DIR
Environment=G2G_BRANCH=main
Environment=G2G_COMPOSE_FILE=docker-compose.traefik.yml
# A deployment checkout is reset to the remote revision before each build.
# Invoke the interpreter explicitly so deployment never depends on Git
# preserving this script's executable bit.
ExecStart=/bin/sh $APP_DIR/server/auto-deploy.sh
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
EOF

cat >/etc/systemd/system/g2g-auto-deploy.timer <<'EOF'
[Unit]
Description=Check GitHub frequently for G2G Exam updates

[Timer]
OnBootSec=10s
OnUnitInactiveSec=20s
AccuracySec=1s
Persistent=true
Unit=g2g-auto-deploy.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now g2g-auto-deploy.timer
systemctl restart g2g-auto-deploy.timer

echo "Installed G2G auto-deploy."
echo "Repo: $REPO_ROOT"
echo "App:  $APP_DIR"
echo "Poll: about every 20 seconds"
echo
systemctl status g2g-auto-deploy.timer --no-pager -l || true
