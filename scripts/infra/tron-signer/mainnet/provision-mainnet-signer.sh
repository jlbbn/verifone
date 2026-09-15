#!/usr/bin/env bash
# Aprovisiona el firmante MAINNET aislado (tron-signer-mainnet) de punta a punta.
# Se ejecuta como root EN el host del firmante. Idempotente.
# La llave privada de la wallet y el secreto HMAC nacen aquí y jamás se imprimen ni salen del host.
#
# Uso: bash provision-mainnet-signer.sh [--backup-gpg <fingerprint>]
#   --backup-gpg <fingerprint>  Cifra la llave privada recién nacida a
#                                /root/wallet-backup.gpg (gpg -r <fingerprint>) antes
#                                de borrar el archivo en texto plano. Sin esta bandera
#                                la llave solo queda dentro de tron-signer.env en este
#                                host, sin ningún respaldo cifrado independiente.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

BACKUP_GPG_FINGERPRINT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --backup-gpg) BACKUP_GPG_FINGERPRINT="${2:?--backup-gpg requiere un fingerprint}"; shift 2 ;;
    *) echo "Argumento desconocido: $1 (uso: --backup-gpg <fingerprint>)" >&2; exit 2 ;;
  esac
done

# --- Guardia dura: Tailscale debe estar operativo ANTES de tocar nada del host. ---
# El acceso admin por SSH depende exclusivamente de tailscale0 (ver install.sh); si
# Tailscale no está listo, abortamos ya mismo en vez de dejar el host sin forma
# fiable de administrarlo tras el candado de egreso.
command -v tailscale >/dev/null 2>&1 || {
  echo "tailscale no está instalado. Instálalo y ejecuta 'tailscale up' antes de correr esta ceremonia." >&2
  exit 1
}
ip link show tailscale0 >/dev/null 2>&1 || {
  echo "La interfaz tailscale0 no existe. Ejecuta 'tailscale up' y confirma que la interfaz aparece antes de continuar." >&2
  exit 1
}
tailscale status >/dev/null 2>&1 || {
  echo "'tailscale status' falló. Tailscale está instalado pero no operativo en este host." >&2
  exit 1
}

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

# IP privada propia del firmante dentro de tron-mainnet-vpc (10.30.0.0/20; el mismo
# rango del nodo NODE_IP). Verificado en vivo: tron-signer-mainnet = 10.30.0.3.
# banxico-plus-app vive en 10.10.0.0/20, una VPC distinta — nunca confundir ambas.
SIGNER_IP=$(ip -4 -o addr show | awk '/ 10\.30\./{print $4}' | cut -d/ -f1 | head -1)
[ -n "$SIGNER_IP" ] || { echo "No se encontró IP privada 10.30.x.x (tron-mainnet-vpc) en este host." >&2; exit 1; }

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
  echo "RECORDATORIO: /etc/tron-signer/tls/ca.key debe salir de este host tras la ceremonia (vault/USB offline; nunca a Replit ni por chat). server.crt/client.crt/ca.crt vencen en 90 días — agenda su rotación ya."
fi

# --- Wallet y HMAC: nacen en el host, nunca se imprimen ---
# Idempotencia dura: la fuente de verdad es tron-signer.env, no config.json ni los
# archivos temporales /root/.wallet-*. Si tron-signer.env ya existe en CUALQUIERA de
# sus dos rutas posibles (recién copiado, o ya instalado por install.sh en
# /etc/tron-signer), la wallet YA nació en este host — jamás se genera una nueva,
# exista o no config.json.
SRC_ENV=/opt/banxico-plus/scripts/infra/tron-signer/tron-signer.env
INSTALLED_ENV=/etc/tron-signer/tron-signer.env
EXISTING_ENV=""
[ -f "$SRC_ENV" ] && EXISTING_ENV="$SRC_ENV"
[ -z "$EXISTING_ENV" ] && [ -f "$INSTALLED_ENV" ] && EXISTING_ENV="$INSTALLED_ENV"

if [ -n "$EXISTING_ENV" ]; then
  echo "tron-signer.env ya existe en $EXISTING_ENV: reutilizando la wallet existente, no se genera una nueva."
  # shellcheck disable=SC1090
  set -a; source "$EXISTING_ENV"; set +a
  ADDR="${TRON_SIGNER_ADDRESS:-}"
  HMAC="${TRON_SIGNER_HMAC_SECRET:-}"
  KEY_ID="${TRON_SIGNER_KEY_ID:-$KEY_ID}"
  [ -n "$ADDR" ] && [ -n "$HMAC" ] || {
    echo "El tron-signer.env existente no trae TRON_SIGNER_ADDRESS/TRON_SIGNER_HMAC_SECRET. Revisa a mano — no se continúa generando nada nuevo por seguridad." >&2
    exit 1
  }
  if [ ! -f /opt/banxico-plus/scripts/infra/tron-signer/tron-signer.env ]; then
    cp "$EXISTING_ENV" /opt/banxico-plus/scripts/infra/tron-signer/tron-signer.env
    chmod 600 /opt/banxico-plus/scripts/infra/tron-signer/tron-signer.env
  fi
  if [ ! -f /root/app-client-creds/config.json ]; then
    mkdir -p /root/app-client-creds/tls
    cat > /root/app-client-creds/config.json <<EOF
{"signerUrl":"https://$SIGNER_IP:9443","keyId":"$KEY_ID","hmacSecret":"$HMAC","caPath":"tls/ca.crt","certPath":"tls/client.crt","keyPath":"tls/client.key","address":"$ADDR","network":"mainnet"}
EOF
    chmod -R go-rwx /root/app-client-creds
    echo "config.json reconstruido desde el tron-signer.env existente (la wallet no se tocó)."
  fi
else
  if [ -f /root/app-client-creds/config.json ]; then
    echo "Estado inconsistente: existe config.json pero no hay tron-signer.env en ninguna ruta conocida ($SRC_ENV, $INSTALLED_ENV). Revisa a mano antes de continuar — no se genera una wallet nueva automáticamente." >&2
    exit 1
  fi
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
TRON_SIGNER_MIN_ACTIVE_PEERS=2
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

  # --- Respaldo cifrado de la llave privada, opcional pero recomendado ---
  if [ -n "$BACKUP_GPG_FINGERPRINT" ]; then
    command -v gpg >/dev/null 2>&1 || apt-get install -y -qq gnupg >/dev/null 2>&1
    gpg --batch --yes --trust-model always -r "$BACKUP_GPG_FINGERPRINT" \
      -o /root/wallet-backup.gpg --encrypt /root/.wallet-priv
    chmod 600 /root/wallet-backup.gpg
    echo "Llave cifrada en /root/wallet-backup.gpg para $BACKUP_GPG_FINGERPRINT. Retírala de este host cuanto antes (USB/vault offline); nunca por chat ni a Replit."
  else
    echo "AVISO: se ejecutó sin --backup-gpg. La llave privada no queda respaldada de forma independiente; solo vive en texto plano dentro de tron-signer.env en este host." >&2
  fi
  rm -f /root/.wallet-priv /root/.hmac-secret
fi

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
