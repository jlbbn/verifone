#!/bin/bash
# Night scheduler — fires the two overnight sends at exact times (user clock = UTC-6):
#   09:00 UTC (3:00 AM) → send-night1-close.ts
#   12:00 UTC (6:00 AM) → send-night-concluded.ts
# Flags prevent double-sends; late start triggers catch-up send.

WS=/home/runner/workspace
LOG=$WS/scripts/night-run.log
T1=$(date -u -d '2026-08-07 09:00:00' +%s)
T2=$(date -u -d '2026-08-07 12:00:00' +%s)
F1=$WS/.local/night-0900.sent
F2=$WS/.local/night-1200.sent
mkdir -p $WS/.local

echo "[$(date -u '+%F %T')Z] scheduler armed · pid $$ · T1=09:00Z T2=12:00Z" >> "$LOG"

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

  if [ -f "$F1" ] && [ -f "$F2" ]; then
    echo "[$(date -u '+%F %T')Z] all sends complete · scheduler exit" >> "$LOG"
    break
  fi

  # keepalive ping so the environment stays warm
  if [ -n "$REPLIT_DEV_DOMAIN" ]; then
    curl -s -o /dev/null -m 10 "https://$REPLIT_DEV_DOMAIN/" 2>/dev/null
  fi

  sleep 60
done
