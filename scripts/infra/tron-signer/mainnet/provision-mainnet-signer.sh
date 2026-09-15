#!/usr/bin/env bash
# Aprovisiona el firmante MAINNET aislado (tron-signer-mainnet) de punta a punta.
# Se ejecuta como root EN el host del firmante. Idempotente.
# La llave privada de la wallet y el secreto HMAC nacen aquí y jamás se imprimen ni salen del host.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# IPs privadas verificadas en vivo el 2026-09-15 (la cuenta DO fue reconstruida el
# 2026-09-06 tras el incidente de terminación; las IPs de la topología anterior
# ya no existen). tron-mainnet-lite y tron-signer-mainnet viven en la VPC
# tron-mainnet-vpc (10.30.0.0/20), separada de banxico-plus-vpc (10.10.0.0/20)
# donde vive la app — sin peering entre ambas (cuota de VPC peerings=0 en la
# cuenta), así que APP_IP solo fija la regla de firewall para cuando exista una
# ruta privada real (tarea de conectividad aparte); no implica alcance hoy.
NODE_IP=10.30.0.2          # nodo TRON mainnet lite (privado, VPC tron-mainnet-vpc)
APP_IP=10.10.0.2           # banxico-plus-app (privado, VPC banxico-plus-vpc; sin ruta aún)
BUNDLE=/root/bundle
KEY_ID=banxico-mainnet-v1

# Admin SSH: por defecto SOLO por Tailscale (interfaz tailscale0), nunca por IP pública
# fija. Una IP de admin es dinámica y queda obsoleta; Tailscale usa su propia
# autenticación en vez de un allowlist de IP que hay que mantener a mano.
# ADMIN_SSH_CIDR es un fallback legado opcional: si se exporta antes de correr este
# script (p.ej. `ADMIN_SSH_CIDR=1.2.3.4/32 bash provision-mainnet-signer.sh`) se añade
# ADEMÁS del acceso por Tailscale, nunca en su lugar. Déjalo vacío salvo necesidad real.
ADMIN_SSH_CIDR="${ADMIN_SSH_CIDR:-}"

# IP privada propia dentro de la VPC 10.10.0.0/20
SIGNER_IP=$(ip -4 -o addr show | awk '/ 10\.10\./{print $4}' | cut -d/ -f1 | head -1)
[ -n "$SIGNER_IP" ] || { echo "No se encontró IP privada 10.10.x.x" >&2; exit 1; }

apt-get update -qq >/dev/null
apt-get install -y -qq jq nodejs npm >/dev/null 2>&1

mkdir -p /opt/banxico-plus/scripts/infra/tron-signer /root/app-client-creds/tls
cp "$BUNDLE"/*.mjs "$BUNDLE"/install.sh "$BUNDLE"/tron-signer.service /opt/banxico-plus/scripts/infra/tron-signer/
cd /opt/banxico-plus
if [ -f "$BUNDLE"/rehearsal/lockfile/package-lock.json ]; then
  cp "$BUNDLE"/rehearsal/lockfile/package.json "$BUNDLE"/rehearsal/lockfile/package-lock.json /opt/banxico-plus/
  npm ci --no-audit --no-fund >/dev/null
else
  [ -f package.json ] || echo '{"name":"banxico-signer-host","private":true,"type":"module"}' > package.json
  npm install --no-audit --no-fund tronweb@6.4.0 >/dev/null
fi

# --- TLS: CA propia de la ceremonia mainnet; certificados de 90 días ---
mkdir -p /etc/tron-signer/tls; cd /etc/tron-signer/tls
if [ ! -f server.crt ]; then
  openssl ecparam -name prime256v1 -genkey -noout -out ca.key
  openssl req -x509 -new -key ca.key -sha256 -days 90 -subj "/CN=banxico-mainnet-signer-ca-v1" -out ca.crt
  openssl ecparam -name prime256v1 -genkey -noout -out server.key
  openssl req -new -key server.key -subj "/CN=tron-signer-mainnet" -out server.csr
  printf "subjectAltName=IP:%s\nextendedKeyUsage=serverAuth\n" "$SIGNER_IP" > server.ext
  openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 90 -sha256 -extfile server.ext -out server.crt
  openssl ecparam -name prime256v1 -genkey -noout -out /root/app-client-creds/tls/client.key
  openssl req -new -key /root/app-client-creds/tls/client.key -subj "/CN=banxico-plus-app-v1" -out /tmp/client.csr
  printf "extendedKeyUsage=clientAuth\n" > /tmp/client.ext
  openssl x509 -req -in /tmp/client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 90 -sha256 -extfile /tmp/client.ext -out /root/app-client-creds/tls/client.crt
  cp ca.crt /root/app-client-creds/tls/ca.crt
  rm -f server.csr server.ext /tmp/client.csr /tmp/client.ext
fi

# --- Wallet y HMAC: nacen en el host, nunca se imprimen ---
# Guardia contra estado parcial: config.json sin env del firmante = ceremonia interrumpida.
if [ -f /root/app-client-creds/config.json ] && [ ! -f /opt/banxico-plus/scripts/infra/tron-signer/tron-signer.env ]; then
  echo "Estado parcial detectado: limpia /root/app-client-creds y /etc/tron-signer/tls y re-ejecuta la ceremonia completa." >&2
  exit 1
fi
if [ ! -f /root/app-client-creds/config.json ]; then
  cat > /opt/banxico-plus/gen-wallet.mjs <<'EOF'
import { utils } from "tronweb";
import { writeFileSync } from "node:fs";
const acct = utils.accounts.generateAccount();
writeFileSync("/root/.wallet-priv", acct.privateKey.replace(/^0x/, ""), { mode: 0o600 });
writeFileSync("/root/.wallet-addr", acct.address.base58, { mode: 0o600 });
EOF
  node /opt/banxico-plus/gen-wallet.mjs
  rm -f /opt/banxico-plus/gen-wallet.mjs
  openssl rand -hex 32 > /root/.hmac-secret
  chmod 600 /root/.hmac-secret

  ADDR=$(cat /root/.wallet-addr)
  PK=$(cat /root/.wallet-priv)
  HMAC=$(cat /root/.hmac-secret)

  cat > /opt/banxico-plus/scripts/infra/tron-signer/tron-signer.env <<EOF
TRON_SIGNER_HOST=$SIGNER_IP
TRON_SIGNER_PORT=9443
TRON_NETWORK=mainnet
TRON_NODE_LITE=true
TRON_SIGNER_STATE_PATH=/var/lib/tron-signer/state.json
TRON_FULL_HOST=http://$NODE_IP:8090
TRON_APPROVED_NODE_ORIGIN=http://$NODE_IP:8090
TRON_SIGNER_ADDRESS=$ADDR
TRON_SIGNER_PRIVATE_KEY=$PK
TRON_SIGNER_KEY_ID=$KEY_ID
TRON_SIGNER_HMAC_SECRET=$HMAC
TRON_SIGNER_TLS_KEY_PATH=/etc/tron-signer/tls/server.key
TRON_SIGNER_TLS_CERT_PATH=/etc/tron-signer/tls/server.crt
TRON_SIGNER_CLIENT_CA_PATH=/etc/tron-signer/tls/ca.crt
TRON_SIGNER_WRITES_ENABLED=false
TRON_SIGNER_MAX_PER_TX_USDT=100
TRON_SIGNER_MAX_DAILY_USDT=500
TRON_SIGNER_MIN_TRX_RESERVE=40
TRON_SIGNER_FEE_LIMIT_SUN=40000000
TRON_SIGNER_MAX_HEAD_AGE_MS=180000
TRON_SIGNER_MIN_ACTIVE_PEERS=3
APP_ALLOWED_CIDR=$APP_IP/32
ADMIN_SSH_CIDR=$ADMIN_SSH_CIDR
ADMIN_SSH_TAILSCALE=true
EOF
  chmod 600 /opt/banxico-plus/scripts/infra/tron-signer/tron-signer.env

  # Credenciales del cliente (la app). Se entregan por canal seguro en el wiring; nunca por chat.
  cat > /root/app-client-creds/config.json <<EOF
{"signerUrl":"https://$SIGNER_IP:9443","keyId":"$KEY_ID","hmacSecret":"$HMAC","caPath":"tls/ca.crt","certPath":"tls/client.crt","keyPath":"tls/client.key","address":"$ADDR","network":"mainnet"}
EOF
  chmod -R go-rwx /root/app-client-creds
  rm -f /root/.wallet-priv /root/.hmac-secret
fi
ADDR=$(cat /root/.wallet-addr)

# --- Log forwarding (shipper) ---
if [ -f "$BUNDLE"/logship/ship-logs.sh ]; then
  cp "$BUNDLE"/logship/ship-logs.sh /opt/banxico-plus/ship-logs.sh
  chmod +x /opt/banxico-plus/ship-logs.sh
  cp "$BUNDLE"/logship/ship-logs.service "$BUNDLE"/logship/ship-logs.timer /etc/systemd/system/
  if [ -n "${INFRA_TOKEN:-}" ] && [ ! -f /etc/tron-signer/shipper.env ]; then
    umask 077
    cat > /etc/tron-signer/shipper.env <<EOF
INGEST_URL=https://banxicoplusllc.org/api/infra/logs
INGEST_TOKEN=$INFRA_TOKEN
HOSTTAG=tron-signer-mainnet
UNITS=tron-signer ssh
EOF
    umask 022
  fi
  mkdir -p /var/lib/tron-signer
  systemctl daemon-reload
  systemctl enable --now ship-logs.timer >/dev/null
fi

# --- UFW baseline: deny incoming; sin regla pública de 22 aquí (antes esto abría SSH
# a cualquier IP con solo llaves como candado). install.sh añade la regla real de 22
# scoped a tailscale0 (y, si ADMIN_SSH_CIDR no está vacío, un fallback de IP pública).
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw --force enable >/dev/null

# --- Instalación oficial del firmante (dry-run y ejecución) ---
cd /opt/banxico-plus/scripts/infra/tron-signer
bash install.sh
bash install.sh --execute
systemctl daemon-reload
systemctl start tron-signer
sleep 3
echo "tron-signer: $(systemctl is-active tron-signer)"

# --- Candado de egreso: sólo nodo privado :8090, DNS, HTTPS (logs/apt) y NTP ---
ufw default deny outgoing >/dev/null
ufw allow out to $NODE_IP port 8090 proto tcp comment 'nodo TRON mainnet' >/dev/null
# DNS restringido a los resolvers de DigitalOcean (evita tuneles DNS arbitrarios)
ufw allow out to 67.207.67.2 port 53 comment 'DNS DO' >/dev/null
ufw allow out to 67.207.67.3 port 53 comment 'DNS DO' >/dev/null
# 443 abierto por necesidad del envio de logs (endpoint autoscale sin IP fija); riesgo residual documentado
ufw allow out 443/tcp comment 'envio de logs https' >/dev/null
ufw allow out 123/udp comment 'NTP' >/dev/null
# Tailscale: puerto UDP directo (con fallback automático a DERP relay por 443, ya abierto)
ufw allow out 41641/udp comment 'Tailscale' >/dev/null
ufw reload >/dev/null

echo "PROVISION_OK ADDR=$ADDR SIGNER_IP=$SIGNER_IP"
