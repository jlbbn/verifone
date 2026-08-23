#!/usr/bin/env bash
set -euo pipefail
: "${TRON_ALERT_HOOK_PATH:?TRON_ALERT_HOOK_PATH is required}"

output=""
if output="$(/usr/local/sbin/tron-node-healthcheck 2>&1)"; then
  logger -t tron-node-monitor -- "$output"
  exit 0
else
  status=$?
fi

logger -p daemon.alert -t tron-node-monitor -- "TRON NODE UNHEALTHY: $output"

# Approved delivery adapter. The installer refuses to proceed until this exists;
# failures are surfaced so systemd records both the node and alerting failure.
printf '%s' "$output" | "$TRON_ALERT_HOOK_PATH"
exit "$status"