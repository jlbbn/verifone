#!/usr/bin/env bash
# Prepare a dedicated Ubuntu host for java-tron.
# Dry-run is the default. No cloud resources or keys are created by this script.
set -euo pipefail

MODE="dry-run"
START_NODE="false"
FIREWALL_POLICY_ACK="false"
for arg in "$@"; do
  case "$arg" in
    --execute) MODE="execute" ;;
    --start) START_NODE="true" ;;
    --apply-firewall-policy) FIREWALL_POLICY_ACK="true" ;;
    --help)
      echo "Usage: bash install.sh [--execute] [--apply-firewall-policy] [--start]"
      echo "Default: validate and print plan only. --execute changes the host."
      exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${TRON_NODE_ENV_FILE:-$BUNDLE_DIR/tron-node.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE (copy tron-node.env.example and fill non-secret values)." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${TRON_HOME:=/opt/tron}"
: "${TRON_DATA_DIR:=/var/lib/tron/database}"
: "${TRON_LOG_DIR:=/var/log/tron}"
: "${TRON_JAR_URL:?TRON_JAR_URL required}"
: "${TRON_JAR_SHA256:?TRON_JAR_SHA256 required}"
: "${TRON_CONFIG_URL:?TRON_CONFIG_URL required}"
: "${TRON_CONFIG_SHA256:?TRON_CONFIG_SHA256 required}"
: "${ADMIN_SSH_CIDR:?ADMIN_SSH_CIDR required}"
: "${TRON_RPC_ALLOWED_CIDR:?TRON_RPC_ALLOWED_CIDR required}"
: "${TRON_ALERT_HOOK_PATH:?TRON_ALERT_HOOK_PATH required}"

[[ "$TRON_JAR_SHA256" =~ ^[0-9a-f]{64}$ ]] || { echo "Invalid TRON_JAR_SHA256" >&2; exit 1; }
[[ "$TRON_CONFIG_SHA256" =~ ^[0-9a-f]{64}$ ]] || { echo "Invalid TRON_CONFIG_SHA256" >&2; exit 1; }
[[ "$ADMIN_SSH_CIDR" != REPLACE* ]] || { echo "Replace ADMIN_SSH_CIDR" >&2; exit 1; }
[[ "$TRON_JAR_URL" == "https://github.com/tronprotocol/java-tron/releases/download/${TRON_RELEASE}/FullNode-x64.jar" ]] || {
  echo "JAR URL does not match the pinned official release" >&2; exit 1;
}
[[ "$TRON_CONFIG_URL" == "https://raw.githubusercontent.com/tronprotocol/java-tron/${TRON_RELEASE}/framework/src/main/resources/config.conf" ]] || {
  echo "Config URL does not match the pinned official release" >&2; exit 1;
}
python3 - "$ADMIN_SSH_CIDR" "$TRON_RPC_ALLOWED_CIDR" <<'PY'
import ipaddress, sys
admin = ipaddress.ip_network(sys.argv[1], strict=False)
rpc = ipaddress.ip_network(sys.argv[2], strict=False)
if admin.prefixlen != admin.max_prefixlen:
    raise SystemExit("ADMIN_SSH_CIDR must identify exactly one IP (/32 or /128)")
if not rpc.is_private or rpc.is_loopback or rpc.is_link_local:
    raise SystemExit("TRON_RPC_ALLOWED_CIDR must be a private VPC range")
if rpc.version != 4 or rpc.prefixlen < 16:
    raise SystemExit("TRON_RPC_ALLOWED_CIDR must be an IPv4 range no broader than /16")
PY
[[ "${TRON_STORAGE_SSD_CONFIRMED:-false}" == "true" ]] || {
  echo "Set TRON_STORAGE_SSD_CONFIRMED=true after verifying the 3 TB filesystem is SSD-backed." >&2; exit 1;
}
[[ "${TRON_NETWORK_100MBPS_CONFIRMED:-false}" == "true" ]] || {
  echo "Set TRON_NETWORK_100MBPS_CONFIRMED=true after verifying sustained 100 Mbps connectivity." >&2; exit 1;
}

cpu_count="$(nproc)"
memory_kib="$(awk '/MemTotal/{print $2}' /proc/meminfo)"
memory_gib="$((memory_kib / 1024 / 1024))"
data_parent="$TRON_DATA_DIR"
while [[ ! -e "$data_parent" && "$data_parent" != "/" ]]; do data_parent="$(dirname "$data_parent")"; done
disk_kib="$(df -Pk "$data_parent" | awk 'NR==2{print $2}')"
disk_gib="$((disk_kib / 1024 / 1024))"

echo "TRON FullNode hardware: CPU=${cpu_count}, RAM=${memory_gib}GiB, data filesystem=${disk_gib}GiB"
if (( cpu_count < 8 || memory_gib < 16 || disk_gib < 2900 )); then
  cat >&2 <<EOF
REFUSED: host is below the official FullNode minimum:
  CPU >= 8 cores, RAM >= 16 GiB, SSD >= 3 TB.
Observed: ${cpu_count} cores, ${memory_gib} GiB, ${disk_gib} GiB.
EOF
  exit 1
fi

arch="$(uname -m)"
[[ "$arch" == "x86_64" ]] || { echo "This pinned bundle is x86_64 only; use the signed aarch64 release and JDK 17 for ARM." >&2; exit 1; }
if command -v java >/dev/null 2>&1; then
  java_major="$(java -version 2>&1 | awk -F[\\\".] '/version/{print ($2 == "1" ? $3 : $2); exit}')"
  [[ "$java_major" == "8" ]] || { echo "java-tron x86_64 requires JDK 8; found Java ${java_major:-unknown}" >&2; exit 1; }
elif [[ "$MODE" == "execute" ]]; then
  echo "JDK 8 is not installed. Install a verified production JDK 8 build before --execute." >&2
  exit 1
fi

cat <<EOF
Validated plan:
  - Install pinned FullNode JAR into $TRON_HOME
  - Store chain database at $TRON_DATA_DIR
  - Open public P2P 18888 TCP/UDP
  - Allow RPC 8090-8092 and 50051/50061/50071 only from $TRON_RPC_ALLOWED_CIDR
  - Allow SSH only from $ADMIN_SSH_CIDR
  - Insert priority RPC deny/allow rules (explicit acknowledgement required)
  - Keep JSON-RPC 8545 disabled (official baseline)
  - Install service disabled${START_NODE:+; start requested=$START_NODE}
EOF

[[ "$MODE" == "execute" ]] || {
  echo "DRY RUN COMPLETE. Re-run with --execute only after infrastructure approval."
  exit 0
}
[[ "$(id -u)" == "0" ]] || { echo "--execute must run as root" >&2; exit 1; }
[[ "$FIREWALL_POLICY_ACK" == "true" ]] || {
  echo "--execute also requires --apply-firewall-policy after reviewing the UFW changes." >&2; exit 1;
}
[[ -x "$TRON_ALERT_HOOK_PATH" ]] || {
  echo "Approved TRON_ALERT_HOOK_PATH must be installed and executable before --execute." >&2; exit 1;
}

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl jq ufw chrony
systemctl enable --now chrony

ufw_status="$(ufw status verbose)"
grep -q '^Status: active' <<<"$ufw_status" || {
  echo "UFW must already be active; establish and verify the host baseline before this installer." >&2; exit 1;
}
grep -Eq '^Default: deny \\(incoming\\)' <<<"$ufw_status" || {
  echo "UFW baseline must already default-deny incoming traffic." >&2; exit 1;
}

getent group tron >/dev/null || groupadd --system tron
id tron >/dev/null 2>&1 || useradd --system --gid tron --home-dir /var/lib/tron --shell /usr/sbin/nologin tron
install -d -o tron -g tron -m 0700 "$TRON_HOME" "$(dirname "$TRON_DATA_DIR")" "$TRON_DATA_DIR" "$TRON_LOG_DIR"
install -d -o root -g tron -m 0750 /etc/tron-node
install -o root -g tron -m 0640 "$ENV_FILE" /etc/tron-node/tron-node.env

tmp_jar="$(mktemp)"
tmp_config="$(mktemp)"
trap 'rm -f "$tmp_jar" "$tmp_config"' EXIT
curl --fail --location --proto '=https' --tlsv1.2 "$TRON_JAR_URL" -o "$tmp_jar"
echo "$TRON_JAR_SHA256  $tmp_jar" | sha256sum --check --status || {
  echo "FullNode JAR checksum mismatch; installation aborted." >&2
  exit 1
}
curl --fail --location --proto '=https' --tlsv1.2 "$TRON_CONFIG_URL" -o "$tmp_config"
echo "$TRON_CONFIG_SHA256  $tmp_config" | sha256sum --check --status || {
  echo "Official config checksum mismatch; installation aborted." >&2
  exit 1
}

# Preserve the official mainnet genesis/seeds and change only local operations:
# absolute DB path + Prometheus metrics. RPC remains protected by two firewalls.
python3 - "$tmp_config" "$TRON_DATA_DIR" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
data_dir = sys.argv[2]
text = path.read_text()
text, n = re.subn(r'db\.directory\s*=\s*"database"', f'db.directory = "{data_dir}"', text, count=1)
if n != 1:
    raise SystemExit("official config no longer has the expected db.directory; review release before install")
text, n = re.subn(
    r'(node\.metrics\s*=\s*\{\s*prometheus\s*\{\s*)enable\s*=\s*false',
    r'\1enable = true',
    text,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit("official config no longer has expected metrics block; review release before install")
path.write_text(text)
PY

install -o root -g tron -m 0640 "$tmp_jar" "$TRON_HOME/FullNode.jar"
install -o root -g tron -m 0640 "$tmp_config" "$TRON_HOME/config.conf"
install -o root -g root -m 0644 "$BUNDLE_DIR/tron-node.service" /etc/systemd/system/tron-node.service
install -o root -g root -m 0755 "$BUNDLE_DIR/healthcheck.sh" /usr/local/sbin/tron-node-healthcheck
install -o root -g root -m 0755 "$BUNDLE_DIR/monitor.sh" /usr/local/sbin/tron-node-monitor
install -o root -g root -m 0755 "$BUNDLE_DIR/backup.sh" /usr/local/sbin/tron-node-backup
install -o root -g root -m 0755 "$BUNDLE_DIR/upgrade.sh" /usr/local/sbin/tron-node-upgrade
install -o root -g root -m 0755 "$BUNDLE_DIR/test-alert.sh" /usr/local/sbin/tron-node-test-alert
install -o root -g root -m 0644 "$BUNDLE_DIR/tron-node-health.service" /etc/systemd/system/tron-node-health.service
install -o root -g root -m 0644 "$BUNDLE_DIR/tron-node-health.timer" /etc/systemd/system/tron-node-health.timer

# Preserve all existing firewall rules. Capture the pre-change state so an
# operator can review or manually restore it; this installer never resets UFW.
install -d -o root -g root -m 0700 /var/backups/tron-node
ufw show added > "/var/backups/tron-node/ufw-before-install-$(date -u +%Y%m%dT%H%M%SZ).rules"
ufw allow from "$ADMIN_SSH_CIDR" to any port 22 proto tcp comment "TRON node admin SSH"
ufw allow 18888/tcp comment "TRON mainnet P2P"
ufw allow 18888/udp comment "TRON discovery"
# UFW is ordered. For each private API, insert the VPC allow first and the
# catch-all deny immediately after it. Later insertions shift both together but
# preserve allow-before-deny for that port, overriding any older broad allows.
for port in 8090 8091 8092 50051 50061 50071 9527; do
  ufw insert 1 deny to any port "$port" proto tcp comment "Deny public TRON RPC/metrics"
  ufw insert 1 allow from "$TRON_RPC_ALLOWED_CIDR" to any port "$port" proto tcp comment "TRON private RPC/metrics"
done
ufw insert 1 deny to any port 8545 proto tcp comment "TRON JSON-RPC disabled"

systemctl daemon-reload
systemctl enable tron-node.service
if [[ "$START_NODE" == "true" ]]; then
  [[ "${I_UNDERSTAND_TRON_MAINNET:-false}" == "true" ]] || {
    echo "--start also requires I_UNDERSTAND_TRON_MAINNET=true" >&2
    exit 1
  }
  systemctl start tron-node.service
  systemctl enable --now tron-node-health.timer
fi
echo "Installation prepared. Writes/keys are not part of the FullNode."