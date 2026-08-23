#!/usr/bin/env bash
# Back up reproducible node configuration, never the live chain database.
set -euo pipefail

OUTPUT_DIR="${TRON_BACKUP_DIR:-/var/backups/tron-node}"
[[ "${1:-}" == "--execute" ]] || {
  echo "DRY RUN: would create a configuration backup under $OUTPUT_DIR"
  echo "The live LevelDB/RocksDB database is intentionally excluded."
  exit 0
}
[[ "$(id -u)" == "0" ]] || { echo "Run as root" >&2; exit 1; }

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
install -d -m 0700 "$OUTPUT_DIR"
install -d -m 0700 "$stage/tron-node"
install -m 0640 /opt/tron/config.conf "$stage/tron-node/config.conf"
install -m 0640 /etc/tron-node/tron-node.env "$stage/tron-node/tron-node.env"
install -m 0644 /etc/systemd/system/tron-node.service "$stage/tron-node/tron-node.service"
sha256sum /opt/tron/FullNode.jar > "$stage/tron-node/FullNode.jar.sha256"
systemctl show tron-node.service > "$stage/tron-node/systemd-runtime.txt"
ufw status verbose > "$stage/tron-node/ufw-status.txt"
tar -czf "$OUTPUT_DIR/tron-node-config-$stamp.tar.gz" -C "$stage" tron-node
chmod 0600 "$OUTPUT_DIR/tron-node-config-$stamp.tar.gz"
sha256sum "$OUTPUT_DIR/tron-node-config-$stamp.tar.gz" \
  > "$OUTPUT_DIR/tron-node-config-$stamp.tar.gz.sha256"
echo "Created $OUTPUT_DIR/tron-node-config-$stamp.tar.gz"