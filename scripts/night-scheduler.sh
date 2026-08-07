#!/bin/bash
# Day scheduler — fires the run's sends at exact times (user clock = UTC-6):
#   09:00 UTC (3:00 AM)  → send-night1-close.ts      [SENT — flag set]
#   12:00 UTC (6:00 AM)  → send-night-concluded.ts   [SENT — flag set]
#   13:00 UTC (7:00 AM)  → send-morning-open.ts
#   17:00 UTC (11:00 AM) → send-phase5-open.ts
#   19:00 UTC (1:00 PM)  → send-final-delivery.ts    (ETA · run close, incl. client@)
# Flags prevent double-sends; late start triggers catch-up send.
# Runs as supervised workflow "Night dispatcher".

WS=/home/runner/workspace
LOG=$WS/scripts/night-run.log
T1=$(date -u -d '2026-08-07 09:00:00' +%s)
T2=$(date -u -d '2026-08-07 12:00:00' +%s)
T3=$(date -u -d '2026-08-07 13:00:00' +%s)
T4=$(date -u -d '2026-08-07 17:00:00' +%s)
T5=$(date -u -d '2026-08-07 19:00:00' +%s)
F1=$WS/.local/night-0900.sent
F2=$WS/.local/night-1200.sent
F3=$WS/.local/night-1300.sent
F4=$WS/.local/night-1700.sent
F5=$WS/.local/night-1900.sent
mkdir -p $WS/.local

echo "[$(date -u '+%F %T')Z] scheduler armed · pid $$ · T1=09:00Z T2=12:00Z T3=13:00Z T4=17:00Z T5=19:00Z" >> "$LOG"

fire() {
  local flag=$1 script=$2 label=$3
  echo "[$(date -u '+%F %T')Z] firing $label" >> "$LOG"
  cd "$WS" && npx tsx "scripts/$script" >> "$LOG" 2>&1 && touch "$flag"
}

while :; do
  NOW=$(date -u +%s)

  [ ! -f "$F1" ] && [ "$NOW" -ge "$T1" ] && fire "$F1" send-night1-close.ts     "09:00Z (night1-close)"
  [ ! -f "$F2" ] && [ "$NOW" -ge "$T2" ] && fire "$F2" send-night-concluded.ts  "12:00Z (night-concluded)"
  [ ! -f "$F3" ] && [ "$NOW" -ge "$T3" ] && fire "$F3" send-morning-open.ts     "13:00Z (morning-open)"
  [ ! -f "$F4" ] && [ "$NOW" -ge "$T4" ] && fire "$F4" send-phase5-open.ts      "17:00Z (phase5-open)"
  [ ! -f "$F5" ] && [ "$NOW" -ge "$T5" ] && fire "$F5" send-final-delivery.ts   "19:00Z (final-delivery)"

  if [ -f "$F1" ] && [ -f "$F2" ] && [ -f "$F3" ] && [ -f "$F4" ] && [ -f "$F5" ]; then
    echo "[$(date -u '+%F %T')Z] all sends complete · run closed · scheduler parked" >> "$LOG"
    while :; do sleep 3600; done
  fi

  # keepalive ping so the environment stays warm
  if [ -n "$REPLIT_DEV_DOMAIN" ]; then
    curl -s -o /dev/null -m 10 "https://$REPLIT_DEV_DOMAIN/" 2>/dev/null
  fi

  sleep 60
done
