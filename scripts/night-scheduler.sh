#!/bin/bash
# Night scheduler — fires the overnight/morning sends at exact times (user clock = UTC-6):
#   09:00 UTC (3:00 AM) → send-night1-close.ts      [SENT manually 09:02Z — flag set]
#   12:00 UTC (6:00 AM) → send-night-concluded.ts   (wake-up API callback, incl. client@)
#   13:00 UTC (7:00 AM) → send-morning-open.ts      (morning block open)
# Flags prevent double-sends; late start triggers catch-up send.
# Runs as supervised workflow "Night dispatcher".

WS=/home/runner/workspace
LOG=$WS/scripts/night-run.log
T1=$(date -u -d '2026-08-07 09:00:00' +%s)
T2=$(date -u -d '2026-08-07 12:00:00' +%s)
T3=$(date -u -d '2026-08-07 13:00:00' +%s)
F1=$WS/.local/night-0900.sent
F2=$WS/.local/night-1200.sent
F3=$WS/.local/night-1300.sent
mkdir -p $WS/.local

echo "[$(date -u '+%F %T')Z] scheduler armed · pid $$ · T1=09:00Z T2=12:00Z T3=13:00Z" >> "$LOG"

while :; do
  NOW=$(date -u +%s)

  if [ ! -f "$F1" ] && [ "$NOW" -ge "$T1" ]; then
    echo "[$(date -u '+%F %T')Z] firing 09:00Z send (night1-close)" >> "$LOG"
    cd "$WS" && npx tsx scripts/send-night1-close.ts >> "$LOG" 2>&1 && touch "$F1"
  fi

  if [ ! -f "$F2" ] && [ "$NOW" -ge "$T2" ]; then
    echo "[$(date -u '+%F %T')Z] firing 12:00Z send (night-concluded)" >> "$LOG"
    cd "$WS" && npx tsx scripts/send-night-concluded.ts >> "$LOG" 2>&1 && touch "$F2"
  fi

  if [ ! -f "$F3" ] && [ "$NOW" -ge "$T3" ]; then
    echo "[$(date -u '+%F %T')Z] firing 13:00Z send (morning-open)" >> "$LOG"
    cd "$WS" && npx tsx scripts/send-morning-open.ts >> "$LOG" 2>&1 && touch "$F3"
  fi

  if [ -f "$F1" ] && [ -f "$F2" ] && [ -f "$F3" ]; then
    echo "[$(date -u '+%F %T')Z] all sends complete · scheduler parked" >> "$LOG"
    while :; do sleep 3600; done
  fi

  # keepalive ping so the environment stays warm
  if [ -n "$REPLIT_DEV_DOMAIN" ]; then
    curl -s -o /dev/null -m 10 "https://$REPLIT_DEV_DOMAIN/" 2>/dev/null
  fi

  sleep 60
done
