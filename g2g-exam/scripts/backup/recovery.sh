#!/usr/bin/env bash
# Interactive, non-destructive recovery kit. Requires rclone configured on a fresh host.
set -Eeuo pipefail
umask 077
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
: "${BACKUP_RECOVERY_REMOTE:=gdrive:}"
for tool in rclone age node pg_restore mktemp; do
  command -v "$tool" >/dev/null || { echo "Missing dependency: $tool" >&2; exit 1; }
done
: "${BACKUP_AGE_IDENTITY:?Set BACKUP_AGE_IDENTITY to your offline age identity file}"
[[ -f "$BACKUP_AGE_IDENTITY" ]] || { echo 'age identity file not found' >&2; exit 1; }
# Avoid user-controlled file paths: enumerate known-good archive names only.
archives=()
for kind in daily monthly; do
  listing="$(rclone lsf "${BACKUP_RECOVERY_REMOTE%/}/$kind" --files-only)" || { echo "Cannot list $kind backups" >&2; exit 1; }
  while IFS= read -r name; do
    [[ "$name" =~ ^g2g-[0-9]{8}T[0-9]{6}Z\.tar\.gz\.age$ ]] || continue
    archives+=("$kind/$name")
  done <<< "$listing"
done
(( ${#archives[@]} > 0 )) || { echo 'No backup archives found on Google Drive' >&2; exit 1; }
echo 'G2G Exam — Recovery Kit'
for i in "${!archives[@]}"; do printf '%2d. %s\n' "$((i+1))" "${archives[$i]}"; done
printf 'Choose archive number: '
read -r selection
[[ "$selection" =~ ^[0-9]+$ ]] && (( selection >= 1 && selection <= ${#archives[@]} )) || { echo 'Invalid selection' >&2; exit 2; }
chosen="${archives[$((selection-1))]}"
printf 'Enter a NEW staging directory path (must not exist): '
read -r staging
[[ -n "$staging" && "$staging" = /* && ! -e "$staging" && ! -L "$staging" ]] || { echo 'Provide an absolute, nonexistent staging path' >&2; exit 2; }
tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT
filename="${chosen##*/}"
rclone copyto "${BACKUP_RECOVERY_REMOTE%/}/$chosen" "$tmp/$filename"
BACKUP_AGE_IDENTITY="$BACKUP_AGE_IDENTITY" bash "$HERE/restore.sh" "$tmp/$filename" "$staging"
echo 'Recovery staging verified. No production database, volume, or network settings changed.'
echo 'Continue with docs/RESTORE.md after explicit operator approval.'
