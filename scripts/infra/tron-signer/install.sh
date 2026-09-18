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
# ADMIN_SSH_CIDR is now optional: a public-IP allowlist is a legacy fallback,
# not the primary path. Primary admin access is via Tailscale (ADMIN_SSH_TAILSCALE=true,
# default), which scopes port 22 to the tailscale0 interface instead of a public IP —
# no stale-IP maintenance needed since Tailscale's own auth replaces IP allowlisting.
: "${ADMIN_SSH_CIDR:=}"
: "${ADMIN_SSH_TAILSCALE:=true}"
if [[ -z "$ADMIN_SSH_CIDR" && "$ADMIN_SSH_TAILSCALE" != "true" ]]; then
  echo "Set ADMIN_SSH_CIDR (legacy public-IP allowlist) or leave ADMIN_SSH_TAILSCALE=true (default, Tailscale-only admin access). Both empty/false would lock out SSH entirely." >&2
  exit 1
fi
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

# Python's stdlib ipaddress.is_private does NOT cover the Tailscale CGNAT
# range (100.64.0.0/10, RFC 6598) — confirmed live: ip_address("100.85.242.110")
# .is_private is False. When the app/node/signer are joined by Tailscale
# instead of a shared cloud VPC, this check must accept that range too, or a
# perfectly valid Tailscale-only deployment gets rejected here. Mirrors
# isPrivateIpv4() in server/crypto/tron-policy.ts and private-ip.mjs.
TAILSCALE_CGNAT = ipaddress.ip_network("100.64.0.0/10")

def is_private_or_tailscale(addr_or_net):
    return addr_or_net.is_private or (
        isinstance(addr_or_net, ipaddress.IPv4Network) and addr_or_net.subnet_of(TAILSCALE_CGNAT)
    ) or (
        isinstance(addr_or_net, ipaddress.IPv4Address) and addr_or_net in TAILSCALE_CGNAT
    )

host = ipaddress.ip_address(sys.argv[1])
app = ipaddress.ip_network(sys.argv[2], strict=False)
admin_raw = sys.argv[3]
if not is_private_or_tailscale(host) or host.is_loopback or host.version != 4:
    raise SystemExit("TRON_SIGNER_HOST must be the host's private or Tailscale IPv4 address")
if not is_private_or_tailscale(app) or app.version != 4 or app.prefixlen < 24:
    raise SystemExit("APP_ALLOWED_CIDR must be a narrowly scoped private/Tailscale IPv4 range (/24 or narrower)")
if admin_raw:
    admin = ipaddress.ip_network(admin_raw, strict=False)
    if admin.prefixlen != admin.max_prefixlen:
        raise SystemExit("ADMIN_SSH_CIDR must identify exactly one IP")
PY
[[ -r "${TRON_SIGNER_TLS_KEY_PATH:-}" && -r "${TRON_SIGNER_TLS_CERT_PATH:-}" && -r "${TRON_SIGNER_CLIENT_CA_PATH:-}" ]] || {
  echo "Signer TLS key, certificate, and client CA must exist before installation." >&2; exit 1;
}

admin_ssh_desc="none"
[[ "$ADMIN_SSH_TAILSCALE" == "true" ]] && admin_ssh_desc="tailscale0 interface only"
[[ -n "$ADMIN_SSH_CIDR" ]] && admin_ssh_desc="$admin_ssh_desc + legacy public IP $ADMIN_SSH_CIDR"
cat <<EOF
Validated signer plan:
  - Bind only to private address $TRON_SIGNER_HOST:$TRON_SIGNER_PORT
  - Network profile $TRON_NETWORK with state $TRON_SIGNER_STATE_PATH
  - Allow signer ingress only from $APP_ALLOWED_CIDR
  - Preserve existing UFW rules and allow SSH only from: $admin_ssh_desc
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
grep -Eq '^Default: deny \(incoming\)' <<<"$ufw_status" || {
  echo "UFW baseline must already default-deny incoming traffic." >&2; exit 1;
}
ufw show added > "/var/backups/tron-signer/ufw-before-install-$(date -u +%Y%m%dT%H%M%SZ).rules"
ufw insert 1 allow from "$APP_ALLOWED_CIDR" to "$TRON_SIGNER_HOST" port "$TRON_SIGNER_PORT" proto tcp \
  comment "Banxico Plus to isolated TRON signer"
ufw insert 2 deny to "$TRON_SIGNER_HOST" port "$TRON_SIGNER_PORT" proto tcp \
  comment "Deny all other TRON signer ingress"
if [[ "$ADMIN_SSH_TAILSCALE" == "true" ]]; then
  # Scoped to the tailscale0 interface, not an IP: takes effect once Tailscale is
  # installed and up, and needs no maintenance when the admin's public IP changes.
  ufw allow in on tailscale0 to any port 22 proto tcp comment "TRON signer admin SSH via Tailscale"
fi
if [[ -n "$ADMIN_SSH_CIDR" ]]; then
  ufw allow from "$ADMIN_SSH_CIDR" to any port 22 proto tcp comment "TRON signer admin SSH (legacy public IP fallback)"
fi
systemctl daemon-reload
systemctl enable tron-signer.service
echo "Signer installed but not started. Writes remain disabled."