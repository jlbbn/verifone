#!/usr/bin/env bash
# Offline/bootstrap helper. It never accepts an unverified snapshot.
set -euo pipefail

[[ "${1:-}" == "--execute" ]] || {
  echo "PREPARE ONLY. Usage: SNAPSHOT_URL=https://... SNAPSHOT_SHA256=<64hex> bash bootstrap-snapshot.sh --execute"
  exit 0
}
: "${SNAPSHOT_URL:?SNAPSHOT_URL required}"
: "${SNAPSHOT_SHA256:?SNAPSHOT_SHA256 required}"
: "${TRON_DATA_DIR:=/var/lib/tron/database}"
[[ "$SNAPSHOT_URL" == https://* ]] || { echo "Snapshot URL must use HTTPS" >&2; exit 1; }
[[ "$SNAPSHOT_SHA256" =~ ^[0-9a-f]{64}$ ]] || { echo "Invalid SHA-256" >&2; exit 1; }
[[ "$(id -u)" == "0" ]] || { echo "Run as root" >&2; exit 1; }
[[ "$TRON_DATA_DIR" == /* && "$TRON_DATA_DIR" != "/" ]] || { echo "TRON_DATA_DIR must be a safe absolute path" >&2; exit 1; }
systemctl is-active --quiet tron-node && { echo "Stop tron-node before replacing its database" >&2; exit 1; }

install -d -m 0755 /run/lock
exec 9>/run/lock/tron-snapshot.lock
flock -n 9 || { echo "Another snapshot operation is already running" >&2; exit 1; }

data_parent="$(dirname "$TRON_DATA_DIR")"
mkdir -p "$data_parent"
stage="$(mktemp -d "$data_parent/.snapshot.XXXXXX")"
archive="$stage/snapshot.tgz"
backup="${TRON_DATA_DIR}.pre-snapshot.$(date -u +%Y%m%dT%H%M%SZ)"
old_moved="false"
new_installed="false"
masked="false"
cleanup() {
  rc=$?
  if [[ "$rc" -ne 0 && "$old_moved" == "true" ]]; then
    echo "Snapshot install failed; restoring previous database." >&2
    [[ "$new_installed" == "false" ]] || rm -rf --one-file-system "$TRON_DATA_DIR"
    mv "$backup" "$TRON_DATA_DIR" || echo "CRITICAL: automatic database restore failed" >&2
  fi
  [[ "$masked" == "false" ]] || systemctl unmask --runtime tron-node.service >/dev/null 2>&1 || true
  rm -rf --one-file-system "$stage"
  exit "$rc"
}
trap cleanup EXIT

systemctl mask --runtime tron-node.service
masked="true"
curl --fail --location --proto '=https' --tlsv1.2 "$SNAPSHOT_URL" -o "$archive"
echo "$SNAPSHOT_SHA256  $archive" | sha256sum --check --status || {
  echo "Snapshot checksum mismatch; archive deleted." >&2; exit 1;
}
python3 - "$archive" "$data_parent" <<'PY'
import os, pathlib, sys, tarfile
archive, parent = sys.argv[1:]
available = os.statvfs(parent).f_bavail * os.statvfs(parent).f_frsize
total = 0
count = 0
with tarfile.open(archive, "r:gz") as tf:
    for member in tf:
        count += 1
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or ".." in path.parts:
            raise SystemExit(f"unsafe snapshot path: {member.name}")
        if not (member.isfile() or member.isdir()):
            raise SystemExit(f"unsupported snapshot member type: {member.name}")
        total += member.size
        if count > 5_000_000:
            raise SystemExit("snapshot contains too many members")
if total <= 0:
    raise SystemExit("snapshot is empty")
if total > int(available * 0.90):
    raise SystemExit("insufficient free space for safe staged extraction")
PY
mkdir "$stage/extracted"
tar --extract --gzip --file "$archive" --directory "$stage/extracted" \
  --no-same-owner --no-same-permissions

entries=("$stage/extracted"/*)
[[ "${#entries[@]}" -eq 1 && -d "${entries[0]}" ]] || {
  echo "Unexpected snapshot layout; inspect manually. No database changed." >&2; exit 1;
}
if [[ -e "$TRON_DATA_DIR" ]]; then
  mv "$TRON_DATA_DIR" "$backup"
  old_moved="true"
fi
mv "${entries[0]}" "$TRON_DATA_DIR"
new_installed="true"
chown -R tron:tron "$TRON_DATA_DIR"
chmod 0700 "$TRON_DATA_DIR"
old_moved="false"
systemctl unmask --runtime tron-node.service
masked="false"
echo "Snapshot staged at $TRON_DATA_DIR. Previous database: $backup"
echo "Start manually, run healthcheck, and retain the rollback copy until fully synced."