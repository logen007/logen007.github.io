#!/usr/bin/env bash
# Read-only remote verification. Never prunes or changes remote objects.
set -Eeuo pipefail
umask 077
: "${BACKUP_RCLONE_REMOTE:=gdrive:}"
for cmd in rclone sha256sum mktemp; do command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 1; }; done
remote="${BACKUP_RCLONE_REMOTE%/}"
work="$(mktemp -d)"; trap 'rm -rf -- "$work"' EXIT
count=0
for category in daily monthly; do
  listing="$(rclone lsf "$remote/$category" --files-only)" || { echo "Cannot list $category" >&2; exit 1; }
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    [[ "$name" =~ ^g2g-[0-9]{8}T[0-9]{6}Z\.tar\.gz\.age$ ]] || { echo "Unexpected remote filename in $category" >&2; exit 1; }
    # Streaming a full remote file is deliberate: detects truncated/corrupt downloads.
    rclone copyto "$remote/$category/$name" "$work/$name"
    [[ -s "$work/$name" ]] || { echo "Empty archive: $name" >&2; exit 1; }
    digest="$(sha256sum "$work/$name" | cut -d' ' -f1)"
    [[ "$digest" =~ ^[a-f0-9]{64}$ ]] || exit 1
    echo "$category/$name sha256=$digest"
    rm -f -- "$work/$name"
    ((count+=1))
  done <<< "$listing"
done
((count>0)) || { echo 'No archives found' >&2; exit 1; }
echo "REMOTE_READ_OK count=$count (does not prove archive decrypts or restores)"
