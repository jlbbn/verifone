#!/usr/bin/env bash
# Atomic, checksum-pinned java-tron JAR upgrade with automatic rollback.
set -euo pipefail

: "${TRON_CANDIDATE_JAR_URL:?TRON_CANDIDATE_JAR_URL required}"
: "${TRON_CANDIDATE_JAR_SHA256:?TRON_CANDIDATE_JAR_SHA256 required}"
[[ "$TRON_CANDIDATE_JAR_URL" == https://* ]] || { echo "Candidate URL must use HTTPS" >&2; exit 1; }
[[ "$TRON_CANDIDATE_JAR_SHA256" =~ ^[0-9a-f]{64}$ ]] || { echo "Invalid candidate SHA-256" >&2; exit 1; }

[[ "${1:-}" == "--execute" ]] || {
  echo "DRY RUN: would verify $TRON_CANDIDATE_JAR_URL, stop the node, replace the JAR, restart and health-check."
  exit 0
}
[[ "${I_UNDERSTAND_TRON_MAINNET_UPGRADE:-false}" == "true" ]] || {
  echo "Set I_UNDERSTAND_TRON_MAINNET_UPGRADE=true after reviewing release notes." >&2; exit 1;
}
[[ "$(id -u)" == "0" ]] || { echo "Run as root" >&2; exit 1; }

candidate="$(mktemp)"
backup="/opt/tron/FullNode.jar.pre-upgrade.$(date -u +%Y%m%dT%H%M%SZ)"
swapped="false"
cleanup() {
  rc=$?
  if [[ "$rc" -ne 0 && "$swapped" == "true" ]]; then
    echo "Upgrade failed; restoring previous JAR." >&2
    systemctl stop tron-node.service || true
    install -o root -g tron -m 0640 "$backup" /opt/tron/FullNode.jar
    if ! systemctl start tron-node.service; then
      echo "CRITICAL: rollback JAR restored but node failed to start." >&2
    fi
  fi
  rm -f "$candidate"
  exit "$rc"
}
trap cleanup EXIT
curl --fail --location --proto '=https' --tlsv1.2 "$TRON_CANDIDATE_JAR_URL" -o "$candidate"
echo "$TRON_CANDIDATE_JAR_SHA256  $candidate" | sha256sum --check --status || {
  echo "Candidate checksum mismatch; upgrade aborted." >&2; exit 1;
}

systemctl stop tron-node.service
cp --preserve=mode,ownership,timestamps /opt/tron/FullNode.jar "$backup"
install -o root -g tron -m 0640 "$candidate" /opt/tron/FullNode.jar
swapped="true"
systemctl start tron-node.service
sleep 30
if /usr/local/sbin/tron-node-healthcheck >/dev/null; then
  swapped="false"
  echo "Upgrade healthy. Retain rollback JAR: $backup"
  exit 0
fi

echo "Health check failed; rollback trap will restore the previous JAR." >&2
exit 2