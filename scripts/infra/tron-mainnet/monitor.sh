#!/usr/bin/env bash
# Wraps healthcheck.sh so an unhealthy/unreachable mainnet FullNode is always
# recorded at daemon.alert severity (visible via `journalctl -p alert`, or any
# log shipper already forwarding this host's journal), even before an external
# paging hook is provisioned.
#
# TRON_ALERT_HOOK_PATH is optional here (unlike scripts/infra/tron-node's
# monitor.sh, which hard-requires it): mainnet has no approved delivery
# adapter installed yet. If/when one is provisioned and confirmed per
# docs/tron-node-runbook.md's "Certificados y alertas" ceremony, set
# TRON_ALERT_HOOK_PATH in /etc/tron-mainnet/monitor.env and this script will
# also forward to it.
set -euo pipefail

output=""
if output="$(/opt/tron-mainnet/healthcheck.sh 2>&1)"; then
  logger -t tron-mainnet-monitor -- "$output"
  exit 0
else
  status=$?
fi

logger -p daemon.alert -t tron-mainnet-monitor -- "TRON MAINNET NODE UNHEALTHY (exit $status): ${output:-no response from node}"

if [[ -n "${TRON_ALERT_HOOK_PATH:-}" ]]; then
  if [[ -x "$TRON_ALERT_HOOK_PATH" ]]; then
    printf '%s' "${output:-no response from node}" | "$TRON_ALERT_HOOK_PATH" || \
      logger -p daemon.alert -t tron-mainnet-monitor -- "alert hook failed to deliver"
  else
    logger -p daemon.alert -t tron-mainnet-monitor -- "TRON_ALERT_HOOK_PATH is set but not executable: $TRON_ALERT_HOOK_PATH"
  fi
fi

exit "$status"
