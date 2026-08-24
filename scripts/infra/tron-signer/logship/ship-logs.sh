#!/usr/bin/env bash
# Reenvía líneas nuevas del journal (firmante TRON, ensayo y SSH) al endpoint
# de ingesta de la app: POST $INGEST_URL con bearer token dedicado.
# Config requerida: /etc/tron-signer/shipper.env con INGEST_URL e INGEST_TOKEN.
#
# Envío por lotes acotados en bytes (~400 KB) y líneas (1000) para no exceder
# el límite de 1 MB por request del servidor, sin importar el tamaño del
# backlog. Si cualquier lote falla, se restaura el cursor completo: el próximo
# tick reenvía desde ahí (duplicados posibles, pérdida no).
set -u
CONF=/etc/tron-signer/shipper.env
[ -f "$CONF" ] || exit 0
. "$CONF"
: "${INGEST_URL:?falta INGEST_URL}" "${INGEST_TOKEN:?falta INGEST_TOKEN}"
HOSTTAG=${HOSTTAG:-$(hostname)}
CUR=/var/lib/tron-signer/ship-cursor

exec 9>/run/ship-logs.lock
flock -n 9 || exit 0

FIRST_ARGS=()
if [ -f "$CUR" ]; then
  cp "$CUR" "$CUR.bak"
else
  FIRST_ARGS=(--since "-15min")
fi

TMP=$(mktemp) BATCH=$(mktemp)
trap 'rm -f "$TMP" "$BATCH"' EXIT

journalctl -u tron-signer -u tron-rehearsal -u ssh "${FIRST_ARGS[@]}" \
  --cursor-file="$CUR" -o short-iso --no-pager -q > "$TMP"
if [ ! -s "$TMP" ]; then rm -f "$CUR.bak"; exit 0; fi

send_batch() {
  local payload http
  payload=$(jq -Rs --arg h "$HOSTTAG" \
    '{host:$h, source:"journal", lines:(split("\n")|map(select(length>0)))}' < "$1")
  http=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -X POST \
    -H "Authorization: Bearer $INGEST_TOKEN" -H "Content-Type: application/json" \
    -d "$payload" "$INGEST_URL")
  [ "$http" = "204" ] || [ "$http" = "200" ]
}

: > "$BATCH"
bytes=0 count=0 ok=1
while IFS= read -r line; do
  line=${line:0:4000}
  printf '%s\n' "$line" >> "$BATCH"
  bytes=$((bytes + ${#line} + 1))
  count=$((count + 1))
  if [ "$bytes" -ge 400000 ] || [ "$count" -ge 1000 ]; then
    send_batch "$BATCH" || { ok=0; break; }
    : > "$BATCH"; bytes=0; count=0
  fi
done < "$TMP"
if [ "$ok" -eq 1 ] && [ -s "$BATCH" ]; then
  send_batch "$BATCH" || ok=0
fi

if [ "$ok" -eq 1 ]; then
  rm -f "$CUR.bak"
else
  [ -f "$CUR.bak" ] && mv "$CUR.bak" "$CUR"
  echo "$(date -Is) envio fallido (lote rechazado o sin conexion)" >> /var/log/ship-logs.err
  exit 1
fi
