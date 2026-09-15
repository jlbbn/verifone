#!/usr/bin/env bash
# Ventana temporal para parchear el SO del firmante con el candado de egreso activo.
# El candado normal (ver provision-mainnet-signer.sh) NO deja 80/tcp de salida abierto
# de forma permanente porque mirrors.digitalocean.com / security.ubuntu.com resuelven
# a IPs rotativas (CDN/pool) que una regla ufw fija no puede seguir de forma segura.
# En vez de eso, esta ventana abre 80/tcp+443/tcp de salida solo mientras corre
# apt update/upgrade y los vuelve a cerrar al terminar, pase lo que pase (trap).
set -euo pipefail

[ "$(id -u)" = "0" ] || { echo "Debe correr como root." >&2; exit 1; }

OPENED_80=false
cleanup() {
  if [ "$OPENED_80" = true ]; then
    ufw delete allow out 80/tcp comment 'ventana temporal de parcheo apt' >/dev/null 2>&1 || true
    ufw reload >/dev/null 2>&1 || true
    echo "80/tcp de salida cerrado de nuevo."
  fi
}
trap cleanup EXIT

echo "Abriendo 80/tcp de salida temporalmente para apt (443/tcp ya está abierto para logs)..."
ufw allow out 80/tcp comment 'ventana temporal de parcheo apt' >/dev/null
ufw reload >/dev/null
OPENED_80=true

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get -y -qq upgrade
apt-get -y -qq autoremove >/dev/null 2>&1 || true

echo "Parcheo completado: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
