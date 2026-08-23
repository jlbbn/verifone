#!/usr/bin/env bash
# Prepare the isolated signer host. Dry-run is the default.
set -euo pipefail

MODE="dry-run"
[[ "${1:-}" != "--execute" ]] || MODE="execute"
[[ "${1:-}" == "" || "${1:-}" == "--execute" ]] || {
  echo "Usage: bash install.sh [--execute]" >&2; exit 2;
}
BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${TRON_SIGNER_ENV_FILE:-$BUNDLE_DIR/tron-signer.env}"
[[ -f "$ENV_FILE" ]] || {
  echo "Missing $ENV_FILE (copy tron-signer.env.example on the signer host)." >&2; exit 1;
}
# shellcheck disable=SC1090
source "$ENV_FILE"
: "${TRON_SIGNER_HOST:?TRON_SIGNER_HOST required}"
: "${TRON_SIGNER_PORT:=9443}"
: "${TRON_NETWORK:=mainnet}"
: "${TRON_SIGNER_STATE_PATH:=/var/lib/tron-signer/state.json}"
: "${APP_ALLOWED_CIDR:?APP_ALLOWED_CIDR required}"
: "${ADMIN_SSH_CIDR:?ADMIN_SSH_CIDR required}"
[[ "$TRON_NETWORK" == "mainnet" || "$TRON_NETWORK" == "nile" ]] || {
  echo "TRON_NETWORK must be exactly mainnet or nile." >&2; exit 1;
}
if [[ "$TRON_NETWORK" == "nile" ]]; then
  [[ "$TRON_SIGNER_STATE_PATH" != "/var/lib/tron-signer/state.json" && "${TRON_SIGNER_STATE_PATH,,}" == *nile* ]] || {
    echo "Nile requires a separate TRON_SIGNER_STATE_PATH containing 'nile'." >&2; exit 1;
  }
fi

python3 - "$TRON_SIGNER_HOST" "$APP_ALLOWED_CIDR" "$ADMIN_SSH_CIDR" <<'PY'
import ipaddress, sys
host = ipaddress.ip_address(sys.argv[1])
app = ipaddress.ip_network(sys.argv[2], strict=False)
admin = ipaddress.ip_network(sys.argv[3], strict=False)
if not host.is_private or host.is_loopback or host.version != 4:
    raise SystemExit("TRON_SIGNER_HOST must be the host's private IPv4 address")
if not app.is_private or app.version != 4 or app.prefixlen < 24:
    raise SystemExit("APP_ALLOWED_CIDR must be a narrowly scoped private IPv4 range (/24 or narrower)")
if admin.prefixlen != admin.max_prefixlen:
    raise SystemExit("ADMIN_SSH_CIDR must identify exactly one IP")
PY
[[ -r "${TRON_SIGNER_TLS_KEY_PATH:-}" && -r "${TRON_SIGNER_TLS_CERT_PATH:-}" && -r "${TRON_SIGNER_CLIENT_CA_PATH:-}" ]] || {
  echo "Signer TLS key, certificate, and client CA must exist before installation." >&2; exit 1;
}

cat <<EOF
Validated signer plan:
  - Bind only to private address $TRON_SIGNER_HOST:$TRON_SIGNER_PORT
  - Network profile $TRON_NETWORK with state $TRON_SIGNER_STATE_PATH
  - Allow signer ingress only from $APP_ALLOWED_CIDR
  - Preserve existing UFW rules and allow SSH only from $ADMIN_SSH_CIDR
  - Install service with writes enabled=${TRON_SIGNER_WRITES_ENABLED:-false}
EOF
[[ "$MODE" == "execute" ]] || { echo "DRY RUN COMPLETE."; exit 0; }
[[ "$(id -u)" == "0" ]] || { echo "--execute must run as root" >&2; exit 1; }
[[ "${TRON_SIGNER_WRITES_ENABLED:-false}" == "false" ]] || {
  echo "Installation requires TRON_SIGNER_WRITES_ENABLED=false; activate only after tests." >&2; exit 1;
}

getent group tron-signer >/dev/null || groupadd --system tron-signer
id tron-signer >/dev/null 2>&1 || useradd --system --gid tron-signer \
  --home-dir /var/lib/tron-signer --shell /usr/sbin/nologin tron-signer
install -d -o tron-signer -g tron-signer -m 0700 /var/lib/tron-signer
install -d -o root -g tron-signer -m 0750 /etc/tron-signer
install -o root -g tron-signer -m 0600 "$ENV_FILE" /etc/tron-signer/tron-signer.env
install -o root -g root -m 0644 "$BUNDLE_DIR/tron-signer.service" /etc/systemd/system/tron-signer.service
for path in "$TRON_SIGNER_TLS_KEY_PATH" "$TRON_SIGNER_TLS_CERT_PATH" "$TRON_SIGNER_CLIENT_CA_PATH"; do
  chown root:tron-signer "$path"
done
chmod 0640 "$TRON_SIGNER_TLS_KEY_PATH"
chmod 0644 "$TRON_SIGNER_TLS_CERT_PATH" "$TRON_SIGNER_CLIENT_CA_PATH"
runuser -u tron-signer -- test -r "$TRON_SIGNER_TLS_KEY_PATH" || {
  echo "tron-signer cannot read its TLS private key after permission setup" >&2; exit 1;
}

install -d -o root -g root -m 0700 /var/backups/tron-signer
ufw_status="$(ufw status verbose)"
grep -q '^Status: active' <<<"$ufw_status" || {
  echo "UFW must already be active; establish and verify the host baseline first." >&2; exit 1;
}
grep -Eq '^Default: deny \\(incoming\\)' <<<"$ufw_status" || {
  echo "UFW baseline must already default-deny incoming traffic." >&2; exit 1;
}
ufw show added > "/var/backups/tron-signer/ufw-before-install-$(date -u +%Y%m%dT%H%M%SZ).rules"
ufw insert 1 allow from "$APP_ALLOWED_CIDR" to "$TRON_SIGNER_HOST" port "$TRON_SIGNER_PORT" proto tcp \
  comment "Banxico Plus to isolated TRON signer"
ufw insert 2 deny to "$TRON_SIGNER_HOST" port "$TRON_SIGNER_PORT" proto tcp \
  comment "Deny all other TRON signer ingress"
ufw allow from "$ADMIN_SSH_CIDR" to any port 22 proto tcp comment "TRON signer admin SSH"
systemctl daemon-reload
systemctl enable tron-signer.service
echo "Signer installed but not started. Writes remain disabled."