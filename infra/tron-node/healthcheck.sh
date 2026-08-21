#!/usr/bin/env bash
set -euo pipefail
: "${TRON_HTTP_URL:=http://127.0.0.1:8090}"
: "${TRON_MAX_HEAD_AGE_SECONDS:=180}"
: "${TRON_MIN_ACTIVE_PEERS:=3}"

started="$(date +%s%3N)"
block="$(curl --fail --silent --show-error --max-time 8 \
  -H 'Content-Type: application/json' -d '{}' "$TRON_HTTP_URL/wallet/getnowblock")"
node="$(curl --fail --silent --show-error --max-time 8 \
  -H 'Content-Type: application/json' -d '{}' "$TRON_HTTP_URL/wallet/getnodeinfo")"

height="$(jq -er '.block_header.raw_data.number' <<<"$block")"
timestamp_ms="$(jq -er '.block_header.raw_data.timestamp' <<<"$block")"
peers="$(jq -r '.activeConnectCount // 0' <<<"$node")"
now_ms="$(date +%s%3N)"
age_seconds="$(((now_ms - timestamp_ms) / 1000))"
latency_ms="$((now_ms - started))"

if (( height <= 0 || age_seconds < 0 || age_seconds > TRON_MAX_HEAD_AGE_SECONDS || peers < TRON_MIN_ACTIVE_PEERS )); then
  jq -n --argjson height "$height" --argjson age "$age_seconds" --argjson peers "$peers" \
    '{healthy:false,blockNumber:$height,headAgeSeconds:$age,activePeers:$peers}'
  exit 2
fi

jq -n --argjson height "$height" --argjson age "$age_seconds" \
  --argjson peers "$peers" --argjson latency "$latency_ms" \
  '{healthy:true,blockNumber:$height,headAgeSeconds:$age,activePeers:$peers,latencyMs:$latency}'