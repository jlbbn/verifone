#!/usr/bin/env bash
set -euo pipefail
: "${TRON_ALERT_HOOK_PATH:?TRON_ALERT_HOOK_PATH is required}"
[[ -x "$TRON_ALERT_HOOK_PATH" ]] || { echo "Alert hook is not executable" >&2; exit 1; }
payload='{"test":true,"service":"tron-node","severity":"critical","message":"TRON alert delivery test"}'
if [[ "$(id -u)" == "0" ]]; then
  id tron >/dev/null 2>&1 || { echo "Runtime user tron does not exist" >&2; exit 1; }
  printf '%s' "$payload" | runuser -u tron -- "$TRON_ALERT_HOOK_PATH"
elif [[ "$(id -un)" == "tron" ]]; then
  printf '%s' "$payload" | "$TRON_ALERT_HOOK_PATH"
else
  echo "Run as root (the hook will execute as tron) or directly as tron." >&2
  exit 1
fi
echo "Alert hook accepted the test payload. Confirm receipt with the designated responder."