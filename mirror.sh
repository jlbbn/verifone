#!/usr/bin/env bash
# mirror.sh — espejo manual y OPCIONAL del POS físico con scrcpy.
# NUNCA arranca solo: lo corres a mano cuando necesites ver/dbg la pantalla del POS.
#
# Uso:
#   ./mirror.sh              # scrcpy al POS por adb (el dispositivo ya conectado)
#   ./mirror.sh 192.168.3.128  # adb connect a esa IP y luego scrcpy
#
# Requiere: adb y scrcpy en PATH. El título de la ventana toma el modelo real
# del dispositivo (adb shell getprop ro.product.model), p. ej. "V3".
set -euo pipefail
cd "$(dirname "$0")"

if [[ -n "${1:-}" ]]; then
  adb connect "${1}:5555" >/dev/null 2>&1 || true
fi

# Sin dispositivo no hay espejo: se dice y se sale, sin loops ni reintentos
if ! adb devices | grep -qE '\tdevice$'; then
  echo "mirror.sh: no hay dispositivo adb. Conecta el POS (USB o 'adb connect <IP>:5555')." >&2
  exit 1
fi

TITLE="$(adb shell getprop ro.product.model 2>/dev/null | tr -d '\r' || true)"

exec scrcpy \
  --video-codec=h265 \
  --max-size=1920 \
  --max-fps=60 \
  --keyboard=uhid \
  --window-title="${TITLE:-POS}" \
  --screen-off-timeout=0
