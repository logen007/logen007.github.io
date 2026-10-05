#!/usr/bin/env bash
set -euo pipefail

TRAEFIK_CONTAINER="${TRAEFIK_CONTAINER:-root-traefik-1}"
N8N_CONTAINER="${N8N_CONTAINER:-root-n8n-1}"

printf '\n=== G2G Exam VPS preflight (READ ONLY) ===\n'
printf 'Host: '; hostname || true
printf 'Time: '; date -Is || true
printf 'Docker: '; docker --version || true
printf 'Compose: '; docker compose version || true

printf '\n=== Running containers ===\n'
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

printf '\n=== Ports 80/443/8787 ===\n'
if command -v ss >/dev/null 2>&1; then
  ss -lntp 2>/dev/null | grep -E '(:80 |:443 |:8787 )' || true
else
  netstat -lntp 2>/dev/null | grep -E '(:80 |:443 |:8787 )' || true
fi

printf '\n=== Traefik networks ===\n'
if docker inspect "$TRAEFIK_CONTAINER" >/dev/null 2>&1; then
  docker inspect "$TRAEFIK_CONTAINER" --format '{{range $name, $v := .NetworkSettings.Networks}}{{println $name}}{{end}}'
  printf '\n=== Traefik command ===\n'
  docker inspect "$TRAEFIK_CONTAINER" --format '{{json .Config.Cmd}}'
  printf '\n\n=== Traefik labels ===\n'
  docker inspect "$TRAEFIK_CONTAINER" --format '{{json .Config.Labels}}'
  printf '\n'
else
  printf 'Không tìm thấy container %s\n' "$TRAEFIK_CONTAINER"
fi

printf '\n=== n8n health/context ===\n'
if docker inspect "$N8N_CONTAINER" >/dev/null 2>&1; then
  docker inspect "$N8N_CONTAINER" --format 'name={{.Name}} status={{.State.Status}} image={{.Config.Image}}'
  printf 'networks:\n'
  docker inspect "$N8N_CONTAINER" --format '{{range $name, $v := .NetworkSettings.Networks}}{{println " -" $name}}{{end}}'
else
  printf 'Không tìm thấy container %s\n' "$N8N_CONTAINER"
fi

printf '\n=== Candidate conflicts ===\n'
docker ps --format '{{.Names}} {{.Ports}}' | grep -E '8787|8080->|5432->' || true

printf '\n=== Disk / memory ===\n'
df -h / || true
free -h || true

printf '\nPreflight hoàn tất. Script này không restart, stop, remove hay sửa container nào.\n'
