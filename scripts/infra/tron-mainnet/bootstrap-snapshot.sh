#!/usr/bin/env bash
# Bootstrap del LiteFullNode MAINNET desde los mirrors oficiales de TRON.
#
# Los mirrors oficiales (docs de TRON) sirven solo HTTP. Mitigación:
# - MD5 publicado por el mirror verificado sobre el stream completo;
# - Content-Length exacto exigido;
# - SHA-256 local registrado para auditoría;
# - la identidad de cadena se valida después contra peers de mainnet
#   (p2pVersion 11111) y el healthcheck de head/peers: un snapshot
#   adulterado no puede seguir a la red real.
set -euo pipefail

: "${TRON_DATA_ROOT:=/var/lib/tron-mainnet}"
: "${SNAPSHOT_URL:?SNAPSHOT_URL is required}"
: "${SNAPSHOT_MD5:?SNAPSHOT_MD5 is required}"
: "${SNAPSHOT_BYTES:?SNAPSHOT_BYTES is required}"
: "${MAX_EXPANDED_BYTES:=144955146240}"
: "${RESERVE_BYTES:=12884901888}"

[[ "$SNAPSHOT_URL" =~ ^http://(34\.86\.86\.229|34\.143\.247\.77)/backup[0-9]{8}/LiteFullNode_output-directory\.tgz$ ]] || {
  echo "Snapshot debe venir de un mirror oficial aprobado (34.86.86.229 o 34.143.247.77)" >&2
  exit 1
}
[[ "$SNAPSHOT_MD5" =~ ^[0-9a-f]{32}$ ]] || { echo "SNAPSHOT_MD5 invalido" >&2; exit 1; }
[[ "$SNAPSHOT_BYTES" =~ ^[1-9][0-9]*$ ]] || { echo "SNAPSHOT_BYTES invalido" >&2; exit 1; }

if [[ "${1:-}" != "--execute" ]]; then
  cat <<EOF
PREPARE ONLY
URL: $SNAPSHOT_URL
Expected bytes: $SNAPSHOT_BYTES
Target: $TRON_DATA_ROOT/output-directory
Run again with --execute after verifying the published MD5 and Content-Length.
EOF
  exit 0
fi

[[ "$(id -u)" == "0" ]] || { echo "Run --execute as root" >&2; exit 1; }
command -v curl >/dev/null
command -v pv >/dev/null
command -v python3 >/dev/null
python3 -c 'import sys; assert sys.version_info >= (3, 12), "Python 3.12+ required"'
systemctl is-active --quiet tron-mainnet-node.service && {
  echo "Stop tron-mainnet-node before bootstrap" >&2
  exit 1
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
stage="$TRON_DATA_ROOT/.snapshot-staging"
target="$TRON_DATA_ROOT/output-directory"
digest_file="$TRON_DATA_ROOT/snapshot-digest.txt"
[[ ! -e "$target" ]] || { echo "Target already exists; refusing overwrite" >&2; exit 1; }

install -d -m 0700 "$TRON_DATA_ROOT"
available_bytes="$(df --output=avail -B1 "$TRON_DATA_ROOT" | tail -1 | tr -d ' ')"
if (( available_bytes <= RESERVE_BYTES )); then
  echo "Insufficient free space after required reserve" >&2
  exit 1
fi
rm -rf --one-file-system "$stage"
install -d -m 0700 "$stage"
trap 'rc=$?; if (( rc != 0 )); then rm -rf --one-file-system "$stage"; fi' EXIT

curl --fail --proto '=http,https' \
  --retry 8 --retry-delay 5 --connect-timeout 20 "$SNAPSHOT_URL" \
  | pv -f -n -s "$SNAPSHOT_BYTES" \
  | "$script_dir/stream-extract.py" \
      "$SNAPSHOT_MD5" "$SNAPSHOT_BYTES" \
      "$MAX_EXPANDED_BYTES" "$RESERVE_BYTES" \
      "$stage" "$digest_file"

mapfile -t roots < <(find "$stage" -mindepth 1 -maxdepth 1 -printf '%f\n')
[[ "${#roots[@]}" -eq 1 && "${roots[0]}" == "output-directory" && -d "$stage/output-directory" ]] || {
  printf 'Unexpected snapshot layout: %s\n' "${roots[*]:-empty}" >&2
  exit 1
}

mv "$stage/output-directory" "$target"
rmdir "$stage"
install -d -o 65532 -g 65532 -m 0700 /var/log/tron-mainnet
chown -R 65532:65532 "$target"
chmod 0700 "$target"
echo "Verified mainnet Lite snapshot installed at $target"
