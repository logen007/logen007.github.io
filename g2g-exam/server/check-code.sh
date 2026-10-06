#!/bin/sh
set -eu

APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

run_checks(){
  base="$1"
  find "$base/src" "$base/server/src" "$base/server/runtime" -type f -name '*.js' -print | sort | while IFS= read -r file; do
    node --check "$file" >/dev/null
  done
}

if command -v node >/dev/null 2>&1; then
  run_checks "$APP_DIR"
else
  command -v docker >/dev/null 2>&1 || { echo "Neither node nor docker is available for syntax checks." >&2; exit 1; }
  docker run --rm -v "$APP_DIR:/app:ro" -w /app node:22-alpine sh -lc '
    find src server/src server/runtime -type f -name "*.js" -print | sort | while IFS= read -r file; do
      node --check "$file" >/dev/null
    done
  '
fi

echo "G2G JavaScript syntax check passed."
