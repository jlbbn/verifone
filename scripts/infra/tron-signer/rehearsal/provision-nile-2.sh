#!/usr/bin/env bash
# Aprovisiona el firmante Nile de ensayo (tron-signer-nile-2) de punta a punta.
# Se ejecuta como root EN el host del firmante. Idempotente.
# La llave privada de la wallet y el secreto HMAC nacen aquí y jamás se imprimen.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

SIGNER_IP=10.20.0.4
NODE_IP=10.20.0.2
BUNDLE=/root/bundle
USDT_NILE=TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf

apt-get install -y -qq jq >/dev/null

mkdir -p /opt/banxico-plus/scripts/infra/tron-signer /opt/banxico-plus/scripts /root/rehearsal-client/tls
cp "$BUNDLE"/*.mjs "$BUNDLE"/install.sh "$BUNDLE"/tron-signer.service /opt/banxico-plus/scripts/infra/tron-signer/
cp "$BUNDLE"/rehearsal/addr-hex.mjs /opt/banxico-plus/scripts/
cd /opt/banxico-plus
if [ -f "$BUNDLE"/rehearsal/lockfile/package-lock.json ]; then
  # Dependencias fijadas por lockfile (build reproducible)
  cp "$BUNDLE"/rehearsal/lockfile/package.json "$BUNDLE"/rehearsal/lockfile/package-lock.json /opt/banxico-plus/
  npm ci --no-audit --no-fund >/dev/null
else
  [ -f package.json ] || echo '{"name":"banxico-signer-host","private":true,"type":"module"}' > package.json
  npm install --no-audit --no-fund tronweb@6.4.0 >/dev/null
fi

# --- TLS: CA propia de la ceremonia; certificados de 90 días ---
cd /etc/tron-signer/tls 2>/dev/null || { mkdir -p /etc/tron-signer/tls; cd /etc/tron-signer/tls; }
if [ ! -f server.crt ]; then
  openssl ecparam -name prime256v1 -genkey -noout -out ca.key
  openssl req -x509 -new -key ca.key -sha256 -days 90 -subj "/CN=banxico-nile-rehearsal-ca-v2" -out ca.crt
  openssl ecparam -name prime256v1 -genkey -noout -out server.key
  openssl req -new -key server.key -subj "/CN=tron-signer-nile-2" -out server.csr
  printf "subjectAltName=IP:%s\nextendedKeyUsage=serverAuth\n" "$SIGNER_IP" > server.ext
  openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 90 -sha256 -extfile server.ext -out server.crt
  openssl ecparam -name prime256v1 -genkey -noout -out /root/rehearsal-client/tls/client.key
  openssl req -new -key /root/rehearsal-client/tls/client.key -subj "/CN=banxico-rehearsal-client-v2" -out /tmp/client.csr
  printf "extendedKeyUsage=clientAuth\n" > /tmp/client.ext
  openssl x509 -req -in /tmp/client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 90 -sha256 -extfile /tmp/client.ext -out /root/rehearsal-client/tls/client.crt
  cp ca.crt /root/rehearsal-client/tls/ca.crt
  rm -f server.csr server.ext /tmp/client.csr /tmp/client.ext
fi

# --- Wallet y HMAC: nacen en el host, nunca se imprimen ---
if [ ! -f /root/rehearsal-client/config.json ]; then
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
TRON_NETWORK=nile
TRON_NODE_LITE=true
TRON_SIGNER_STATE_PATH=/var/lib/tron-signer/nile-state.json
TRON_FULL_HOST=http://$NODE_IP:8090
TRON_APPROVED_NODE_ORIGIN=http://$NODE_IP:8090
TRON_SIGNER_ADDRESS=$ADDR
TRON_SIGNER_PRIVATE_KEY=$PK
TRON_SIGNER_KEY_ID=banxico-rehearsal-nile-v2
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
APP_ALLOWED_CIDR=$SIGNER_IP/32
ADMIN_SSH_CIDR=186.96.190.247/32
EOF
  chmod 600 /opt/banxico-plus/scripts/infra/tron-signer/tron-signer.env

  cat > /root/rehearsal-client/config.json <<EOF
{"signerUrl":"https://$SIGNER_IP:9443","keyId":"banxico-rehearsal-nile-v2","hmacSecret":"$HMAC","caPath":"/root/rehearsal-client/tls/ca.crt","certPath":"/root/rehearsal-client/tls/client.crt","keyPath":"/root/rehearsal-client/tls/client.key","address":"$ADDR","contract":"$USDT_NILE","network":"nile"}
EOF
  chmod 600 /root/rehearsal-client/config.json
  rm -f /root/.wallet-priv /root/.hmac-secret
fi
ADDR=$(cat /root/.wallet-addr)

# --- Cliente de ensayo + unidades systemd ---
cp "$BUNDLE"/rehearsal/send-rehearsal.mjs "$BUNDLE"/rehearsal/rehearse-if-funded.sh /root/rehearsal-client/
chmod +x /root/rehearsal-client/rehearse-if-funded.sh
cp "$BUNDLE"/rehearsal/tron-rehearsal.service "$BUNDLE"/rehearsal/tron-rehearsal.timer /etc/systemd/system/

# --- Log forwarding (shipper): instalar siempre; sólo actúa si existe shipper.env ---
if [ -f "$BUNDLE"/logship/ship-logs.sh ]; then
  cp "$BUNDLE"/logship/ship-logs.sh /opt/banxico-plus/ship-logs.sh
  chmod +x /opt/banxico-plus/ship-logs.sh
  cp "$BUNDLE"/logship/ship-logs.service "$BUNDLE"/logship/ship-logs.timer /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now ship-logs.timer >/dev/null
fi

# --- UFW: baseline deny + SSH admin + rangos del agente (evita el bloqueo anterior) ---
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow from 186.96.190.247 to any port 22 proto tcp comment 'admin SSH' >/dev/null
ufw allow from 187.190.15.99 to any port 22 proto tcp comment 'admin SSH 2' >/dev/null
ufw allow from 34.72.0.0/13 to any port 22 proto tcp comment 'agente temporal' >/dev/null
ufw allow from 35.224.0.0/12 to any port 22 proto tcp comment 'agente temporal' >/dev/null
ufw --force enable >/dev/null

# --- Instalación oficial del firmante (dry-run y ejecución) ---
cd /opt/banxico-plus/scripts/infra/tron-signer
bash install.sh
bash install.sh --execute
systemctl daemon-reload
systemctl start tron-signer
systemctl enable --now tron-rehearsal.timer >/dev/null
sleep 3
echo "tron-signer: $(systemctl is-active tron-signer)"
echo "PROVISION_OK ADDR=$ADDR"
