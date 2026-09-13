#!/bin/bash
set -uo pipefail
TOKEN="$DIGITALOCEAN_TOKEN"
SIZE="s-8vcpu-16gb-amd"
API="https://api.digitalocean.com/v2"

declare -A DROPLETS=(
  [598286569]="banxico-plus-app"
  [598331929]="tron-mainnet-lite"
  [598331938]="tron-signer-mainnet"
  [598331941]="tron-nile-lite"
  [598331946]="tron-signer-nile-2"
)

wait_action() {
  local aid="$1"
  local name="$2"
  local label="$3"
  for i in $(seq 1 60); do
    status=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/actions/$aid" | python3 -c "import json,sys;print(json.load(sys.stdin)['action']['status'])")
    echo "[$name] $label action status: $status (attempt $i)"
    if [ "$status" = "completed" ]; then
      return 0
    fi
    if [ "$status" = "errored" ]; then
      echo "[$name] $label ERRORED"
      return 1
    fi
    sleep 10
  done
  echo "[$name] $label TIMEOUT waiting for completion"
  return 1
}

for id in "${!DROPLETS[@]}"; do
  name="${DROPLETS[$id]}"
  echo "===== $name ($id) starting resize to $SIZE ====="

  # 1. power off
  resp=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"type":"power_off"}' "$API/droplets/$id/actions")
  aid=$(echo "$resp" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('action',{}).get('id',''))" 2>/dev/null)
  if [ -z "$aid" ]; then
    echo "[$name] power_off request failed: $resp"
    continue
  fi
  wait_action "$aid" "$name" "power_off" || { echo "[$name] SKIPPING resize due to power_off failure"; continue; }

  sleep 5

  # 2. resize with disk
  resp=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"type\":\"resize\",\"disk\":true,\"size\":\"$SIZE\"}" "$API/droplets/$id/actions")
  aid=$(echo "$resp" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('action',{}).get('id',''))" 2>/dev/null)
  if [ -z "$aid" ]; then
    echo "[$name] resize request failed: $resp"
    continue
  fi
  wait_action "$aid" "$name" "resize" || { echo "[$name] resize failed, attempting power_on to restore service"; }

  sleep 5

  # 3. power on regardless (resize leaves droplet off)
  resp=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"type":"power_on"}' "$API/droplets/$id/actions")
  aid=$(echo "$resp" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('action',{}).get('id',''))" 2>/dev/null)
  if [ -z "$aid" ]; then
    echo "[$name] power_on request failed: $resp"
    continue
  fi
  wait_action "$aid" "$name" "power_on"

  echo "===== $name DONE ====="
done

echo "ALL DROPLETS PROCESSED"
