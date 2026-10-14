#!/usr/bin/env python3
"""Validate entire tar before extracting. No links, devices, or path traversal."""
import os
import pathlib
import sys
import tarfile

archive, destination = sys.argv[1:]
root = pathlib.Path(destination).resolve(strict=True)
with tarfile.open(archive, 'r:gz') as tar:
    members = tar.getmembers()
    if len(members) > 200_000:
        raise SystemExit('Archive contains too many entries')
    total = 0
    names = set()
    for member in members:
        p = pathlib.PurePosixPath(member.name)
        if p.is_absolute() or '..' in p.parts or '\\' in member.name:
            raise SystemExit('Unsafe archive path')
        dest = (root / member.name).resolve()
        if dest != root and root not in dest.parents:
            raise SystemExit('Archive path escapes staging')
        if member.isfile() and member.size > 2 * 1024**3:
            raise SystemExit('Single file exceeds safety limit')
        if not (member.isfile() or member.isdir()):
            raise SystemExit('Unsupported archive entry')
        if dest in names and dest != root:
            raise SystemExit('Duplicate archive entry')
        names.add(dest)
        total += member.size
        if total > 20 * 1024**3:
            raise SystemExit('Archive uncompressed size exceeds safety limit')
    for member in members:
        dest = (root / member.name).resolve()
        if member.isdir():
            dest.mkdir(parents=True, exist_ok=True)
        elif member.isfile():
            dest.parent.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(member) as source, open(dest, 'xb') as output:
                while chunk := source.read(1024 * 1024):
                    output.write(chunk)
