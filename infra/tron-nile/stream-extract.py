#!/usr/bin/env python3
"""Safely extract a gzip tar stream while hashing the compressed bytes."""

import hashlib
import pathlib
import shutil
import sys
import tarfile


if sys.version_info < (3, 12):
    raise RuntimeError("Python 3.12+ is required for tar extraction filters")

(
    expected_md5,
    expected_bytes_raw,
    max_expanded_bytes_raw,
    reserve_bytes_raw,
    stage,
    digest_file,
) = sys.argv[1:]
expected_bytes = int(expected_bytes_raw)
max_expanded_bytes = int(max_expanded_bytes_raw)
reserve_bytes = int(reserve_bytes_raw)


class HashingReader:
    def __init__(self, raw):
        self.raw = raw
        self.md5 = hashlib.md5(usedforsecurity=False)
        self.sha256 = hashlib.sha256()
        self.bytes = 0

    def read(self, size=-1):
        data = self.raw.read(size)
        if data:
            self.md5.update(data)
            self.sha256.update(data)
            self.bytes += len(data)
        return data


reader = HashingReader(sys.stdin.buffer)
root = pathlib.Path(stage).resolve()
member_count = 0
expanded_bytes = 0

try:
    with tarfile.open(fileobj=reader, mode="r|gz") as archive:
        for member in archive:
            member_count += 1
            expanded_bytes += member.size
            member_path = pathlib.PurePosixPath(member.name)
            if member_path.is_absolute() or ".." in member_path.parts:
                raise RuntimeError(f"unsafe snapshot path: {member.name}")
            if not (member.isfile() or member.isdir()):
                raise RuntimeError(f"unsupported snapshot member: {member.name}")
            if member_count > 5_000_000:
                raise RuntimeError("snapshot contains too many members")
            if expanded_bytes > max_expanded_bytes:
                raise RuntimeError("snapshot exceeds expanded-size limit")
            if shutil.disk_usage(root).free - member.size < reserve_bytes:
                raise RuntimeError("snapshot would consume the reserved free space")
            archive.extract(member, root, filter="data")

    actual_md5 = reader.md5.hexdigest()
    actual_sha256 = reader.sha256.hexdigest()
    if reader.bytes != expected_bytes:
        raise RuntimeError(
            f"snapshot byte count mismatch: {reader.bytes} != {expected_bytes}"
        )
    if actual_md5 != expected_md5:
        raise RuntimeError(f"snapshot MD5 mismatch: {actual_md5}")

    pathlib.Path(digest_file).write_text(
        f"bytes={reader.bytes}\n"
        f"md5={actual_md5}\n"
        f"sha256={actual_sha256}\n"
        f"members={member_count}\n"
        f"expanded_bytes={expanded_bytes}\n",
        encoding="utf-8",
    )
except Exception:
    shutil.rmtree(root, ignore_errors=True)
    raise
