#!/usr/bin/env bash
# Ensayo Nile automático: cada tick revisa fondos; con fondos ejecuta el ensayo
# completo UNA sola vez (candado, transferencia, idempotencia, recibo, re-cierre).
set -uo pipefail
LOG=/var/log/tron-rehearsal.log
exec >>"$LOG" 2>&1
echo "=== $(date -u +%FT%TZ) tick ==="

CONFIG=/root/rehearsal-client/config.json
ADDRESS=$(jq -r .address "$CONFIG")
CONTRACT=$(jq -r .contract "$CONFIG")
NODE_URL=http://10.20.0.2:8090
DONE_FLAG=/root/rehearsal-client/ENSAYO_COMPLETO

close_lock() {
  sed -i 's/^TRON_SIGNER_WRITES_ENABLED=.*/TRON_SIGNER_WRITES_ENABLED=false/' /etc/tron-signer/tron-signer.env
  systemctl restart tron-signer
}

if [[ -f "$DONE_FLAG" ]]; then
  echo "YA_COMPLETADO $(cat "$DONE_FLAG")"
  exit 0
fi

TRX_SUN=$(curl -s -m 10 -X POST "$NODE_URL/wallet/getaccount" -d "{\"address\":\"$ADDRESS\",\"visible\":true}" | jq -r '.balance // 0')
HEXPARAM=$(node /opt/banxico-plus/scripts/addr-hex.mjs "$ADDRESS")
USDT_HEX=$(curl -s -m 10 -X POST "$NODE_URL/wallet/triggerconstantcontract" -d "{\"owner_address\":\"$ADDRESS\",\"contract_address\":\"$CONTRACT\",\"function_selector\":\"balanceOf(address)\",\"parameter\":\"$HEXPARAM\",\"visible\":true}" | jq -r '.constant_result[0] // "0"')
USDT_ATOMIC=$((16#${USDT_HEX:-0}))
echo "TRX_SUN=$TRX_SUN USDT_ATOMIC=$USDT_ATOMIC"

if (( TRX_SUN < 45000000 || USDT_ATOMIC < 1000000 )); then
  echo "SIN_FONDOS"
  exit 0
fi

echo "FONDOS_OK abriendo candado"
sed -i 's/^TRON_SIGNER_WRITES_ENABLED=.*/TRON_SIGNER_WRITES_ENABLED=true/' /etc/tron-signer/tron-signer.env
systemctl restart tron-signer
sleep 5

KEY="rehearsal-nile2-principal-0001"
R1=$(node /root/rehearsal-client/send-rehearsal.mjs transfer "$KEY" 1000000)
echo "R1=$R1"
TXID=$(sed -n 's/.*"txid":"\([0-9a-fA-F]\{64\}\)".*/\1/p' <<<"$R1")
if [[ -z "$TXID" ]]; then
  echo "FALLO_SIN_TXID"
  close_lock
  exit 1
fi

R2=$(node /root/rehearsal-client/send-rehearsal.mjs transfer "$KEY" 1000000)
echo "R2=$R2"
if grep -q '"duplicate":true' <<<"$R2"; then echo "IDEMPOTENCIA_OK"; else echo "ADVERTENCIA_IDEMPOTENCIA"; fi

# The local Nile node runs in "lite fullnode" mode, which permanently closes
# wallet/gettransactioninfobyid (and gettransactionbyid) regardless of retries
# or wait time. Broadcast/signing/idempotency all go through our own signer
# and node; this receipt check is the sole exception, using the public Nile
# TronGrid API (read-only) purely to confirm the already-broadcast txid.
PUBLIC_NILE_API=https://nile.trongrid.io
RESULT=""
for _ in $(seq 1 30); do
  INFO=$(curl -s -m 10 -X POST "$PUBLIC_NILE_API/wallet/gettransactioninfobyid" -d "{\"value\":\"$TXID\"}")
  RESULT=$(jq -r '.receipt.result // empty' <<<"$INFO" 2>/dev/null)
  [[ -n "$RESULT" ]] && break
  sleep 10
done

close_lock
echo "RECEIPT=${RESULT:-TIMEOUT}"
if [[ "$RESULT" == "SUCCESS" ]]; then
  echo "$TXID" > "$DONE_FLAG"
  echo "ENSAYO_COMPLETO txid=$TXID"
  systemctl disable --now tron-rehearsal.timer >/dev/null 2>&1 || true
else
  echo "ENSAYO_INCOMPLETO txid=$TXID"
fi
