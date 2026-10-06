#!/bin/sh
set -eu

APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

check_tree(){
  dir="$1"
  find "$dir" -type f -name '*.js' -print | sort | while IFS= read -r file; do
    node --check "$file" >/dev/null
  done
}

check_tree "$APP_DIR/src"
check_tree "$APP_DIR/server/src"
check_tree "$APP_DIR/server/runtime"

echo "G2G JavaScript syntax check passed."
