#!/usr/bin/env bash
set -euo pipefail

: "${NILE_DATA_ROOT:=/var/lib/tron-nile}"
: "${NILE_SNAPSHOT_URL:?NILE_SNAPSHOT_URL is required}"
: "${NILE_SNAPSHOT_MD5:?NILE_SNAPSHOT_MD5 is required}"
: "${NILE_SNAPSHOT_BYTES:?NILE_SNAPSHOT_BYTES is required}"
: "${NILE_MAX_EXPANDED_BYTES:=128849018880}"
: "${NILE_RESERVE_BYTES:=12884901888}"

[[ "$NILE_SNAPSHOT_URL" =~ ^https://snapshots\.nileex\.io/backup[0-9]{8}/LiteFullNode_output-directory\.tgz$ ]] || {
  echo "Snapshot must be an HTTPS Nile LiteFullNode snapshot" >&2
  exit 1
}
[[ "$NILE_SNAPSHOT_MD5" =~ ^[0-9a-f]{32}$ ]] || {
  echo "NILE_SNAPSHOT_MD5 must contain 32 lowercase hex characters" >&2
  exit 1
}
[[ "$NILE_SNAPSHOT_BYTES" =~ ^[1-9][0-9]*$ ]] || {
  echo "NILE_SNAPSHOT_BYTES must be a positive integer" >&2
  exit 1
}

if [[ "${1:-}" != "--execute" ]]; then
  cat <<EOF
PREPARE ONLY
URL: $NILE_SNAPSHOT_URL
Expected bytes: $NILE_SNAPSHOT_BYTES
Target: $NILE_DATA_ROOT/output-directory
Run again with --execute after verifying the public MD5 and Content-Length.
EOF
  exit 0
fi

[[ "$(id -u)" == "0" ]] || {
  echo "Run --execute as root" >&2
  exit 1
}
command -v curl >/dev/null
command -v pv >/dev/null
command -v python3 >/dev/null
python3 -c 'import sys; assert sys.version_info >= (3, 12), "Python 3.12+ required"'
systemctl is-active --quiet tron-nile-node.service && {
  echo "Stop tron-nile-node before bootstrap" >&2
  exit 1
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
stage="$NILE_DATA_ROOT/.snapshot-staging"
target="$NILE_DATA_ROOT/output-directory"
digest_file="$NILE_DATA_ROOT/snapshot-digest.txt"
[[ ! -e "$target" ]] || {
  echo "Target already exists; refusing overwrite" >&2
  exit 1
}

install -d -m 0700 "$NILE_DATA_ROOT"
available_bytes="$(df --output=avail -B1 "$NILE_DATA_ROOT" | tail -1 | tr -d ' ')"
if (( available_bytes <= NILE_RESERVE_BYTES )); then
  echo "Insufficient free space after required reserve" >&2
  exit 1
fi
rm -rf --one-file-system "$stage"
install -d -m 0700 "$stage"
trap 'rc=$?; if (( rc != 0 )); then rm -rf --one-file-system "$stage"; fi' EXIT

curl --fail --proto '=https' --tlsv1.2 \
  --retry 8 --retry-delay 5 --connect-timeout 20 "$NILE_SNAPSHOT_URL" \
  | pv -f -n -s "$NILE_SNAPSHOT_BYTES" \
  | "$script_dir/stream-extract.py" \
      "$NILE_SNAPSHOT_MD5" "$NILE_SNAPSHOT_BYTES" \
      "$NILE_MAX_EXPANDED_BYTES" "$NILE_RESERVE_BYTES" \
      "$stage" "$digest_file"

mapfile -t roots < <(find "$stage" -mindepth 1 -maxdepth 1 -printf '%f\n')
[[ "${#roots[@]}" -eq 1 && "${roots[0]}" == "output-directory" && -d "$stage/output-directory" ]] || {
  printf 'Unexpected snapshot layout: %s\n' "${roots[*]:-empty}" >&2
  exit 1
}

mv "$stage/output-directory" "$target"
rmdir "$stage"
install -d -o 65532 -g 65532 -m 0700 /var/log/tron-nile
chown -R 65532:65532 "$target"
chmod 0700 "$target"
echo "Verified Nile Lite snapshot installed at $target"
