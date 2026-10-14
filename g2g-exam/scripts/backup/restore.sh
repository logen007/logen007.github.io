#!/usr/bin/env bash
# G2G Exam: authenticated decryption into a new staging directory, never into production.
set -Eeuo pipefail
umask 077
if (( $# != 2 )); then echo "Usage: BACKUP_AGE_IDENTITY=/secure/key.txt $0 backup.tar.gz.age /new/staging" >&2; exit 2; fi
: "${BACKUP_AGE_IDENTITY:?Set BACKUP_AGE_IDENTITY to your private age identity file}"
for cmd in age python3 mktemp; do command -v "$cmd" >/dev/null || { echo "Missing: $cmd" >&2; exit 1; }; done
archive="$1"; target="$2"
[[ -f "$archive" && -f "$BACKUP_AGE_IDENTITY" ]] || { echo "Archive or private identity missing" >&2; exit 1; }
[[ ! -e "$target" ]] || { echo "Target already exists; refusing overwrite" >&2; exit 1; }
tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT
# age validates authentication before the tar parser sees any plaintext.
age -d -i "$BACKUP_AGE_IDENTITY" -o "$tmp/archive.tar.gz" "$archive"
mkdir -m 700 -- "$target"
python3 - "$tmp/archive.tar.gz" "$target" <<'PY'
import os, pathlib, sys, tarfile
archive, target = sys.argv[1:]
root = pathlib.Path(target).resolve()
with tarfile.open(archive, "r:gz") as tar:
    members = tar.getmembers()
    if len(members) > 200000:
        raise SystemExit("Too many archive entries")
    for m in members:
        name = m.name
        p = pathlib.PurePosixPath(name)
        if p.is_absolute() or ".." in p.parts or not (m.isfile() or m.isdir()):
            raise SystemExit(f"Unsafe archive entry: {name}")
        if not str((root / name).resolve()).startswith(str(root) + os.sep) and (root / name).resolve() != root:
            raise SystemExit("Path escapes staging")
    for m in members:
        dest = root / m.name
        if m.isdir():
            dest.mkdir(parents=True, exist_ok=True)
        elif m.isfile():
            dest.parent.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(m) as src, open(dest, "xb") as dst:
                while True:
                    block = src.read(1024 * 1024)
                    if not block: break
                    dst.write(block)
for required in ("database.dump", "manifest.json"):
    if not (root / required).is_file(): raise SystemExit(f"Missing {required}")
if not (root / "uploads").is_dir(): raise SystemExit("Missing uploads")
print(f"Verified and extracted to {root}; database NOT imported.")
PY
