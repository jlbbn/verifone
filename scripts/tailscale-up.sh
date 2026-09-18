#!/usr/bin/env bash
# Joins this container to the Tailscale tailnet in userspace mode — no root,
# no TUN device. Downloads the static tailscale/tailscaled binaries (never
# via apt/nix) on first run and caches them under bin/tailscale-dist/.
#
# Exposes a local SOCKS5 + HTTP-CONNECT proxy on 127.0.0.1:1055 that Node
# uses (see server/net/tailscale-proxy.ts) to reach the mainnet TRON node
# and signer over their tailnet (100.64.0.0/10) addresses.
#
# Safe to run repeatedly: skips the download if the binaries already exist,
# and skips starting tailscaled if it is already up. Never exits non-zero —
# a Tailscale failure must not block the app from starting.
set -uo pipefail

DIST_DIR="$(pwd)/bin/tailscale-dist"
SOCK="/tmp/tailscaled.sock"
STATE="mem:"
SOCKS_ADDR="127.0.0.1:1055"
HOSTNAME_TAG="${TAILSCALE_HOSTNAME:-replit-banxico}"
LOG_DIR="/tmp/tailscale-logs"
mkdir -p "$LOG_DIR"

log() { echo "[tailscale-up] $*"; }

if [ -z "${TS_AUTHKEY:-}" ]; then
  log "TS_AUTHKEY no está configurado — omito el arranque de Tailscale."
  exit 0
fi

# ── 1. Binario estático (no apt, no nix) ────────────────────────────────────
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  TS_ARCH="amd64" ;;
  aarch64) TS_ARCH="arm64" ;;
  *) log "Arquitectura no soportada: $ARCH"; exit 0 ;;
esac

if [ ! -x "$DIST_DIR/tailscale" ] || [ ! -x "$DIST_DIR/tailscaled" ]; then
  log "Descargando binario estático de tailscale (${TS_ARCH})..."
  mkdir -p "$DIST_DIR"
  TARBALL="/tmp/tailscale_${TS_ARCH}.tgz"
  if ! curl -fsSL "https://pkgs.tailscale.com/stable/tailscale_latest_${TS_ARCH}.tgz" -o "$TARBALL"; then
    log "No se pudo descargar tailscale — sin conectividad al tailnet en esta sesión."
    exit 0
  fi
  EXTRACT_DIR="/tmp/tailscale-extract"
  rm -rf "$EXTRACT_DIR"
  mkdir -p "$EXTRACT_DIR"
  tar -xzf "$TARBALL" -C "$EXTRACT_DIR"
  INNER_DIR="$(find "$EXTRACT_DIR" -maxdepth 1 -type d -name 'tailscale_*' | head -n1)"
  cp "$INNER_DIR/tailscale" "$DIST_DIR/tailscale"
  cp "$INNER_DIR/tailscaled" "$DIST_DIR/tailscaled"
  chmod +x "$DIST_DIR/tailscale" "$DIST_DIR/tailscaled"
  rm -rf "$TARBALL" "$EXTRACT_DIR"
  log "Binario listo en $DIST_DIR"
fi

TAILSCALE="$DIST_DIR/tailscale"
TAILSCALED="$DIST_DIR/tailscaled"

# ── 2. tailscaled en modo userspace (sin root, sin TUN) ─────────────────────
if [ -S "$SOCK" ] && "$TAILSCALE" --socket="$SOCK" status >/dev/null 2>&1; then
  log "tailscaled ya está corriendo en $SOCK."
else
  rm -f "$SOCK"
  log "Iniciando tailscaled (userspace-networking, socks5+http-proxy en $SOCKS_ADDR)..."
  nohup "$TAILSCALED" \
    --tun=userspace-networking \
    --state="$STATE" \
    --socket="$SOCK" \
    --socks5-server="$SOCKS_ADDR" \
    --outbound-http-proxy-listen="$SOCKS_ADDR" \
    > "$LOG_DIR/tailscaled.log" 2>&1 &
  disown

  for i in $(seq 1 20); do
    [ -S "$SOCK" ] && break
    sleep 0.5
  done
  if [ ! -S "$SOCK" ]; then
    log "tailscaled no levantó el socket a tiempo. Ver $LOG_DIR/tailscaled.log"
    exit 0
  fi
fi

# ── 3. Unirse al tailnet ─────────────────────────────────────────────────────
log "Autenticando con el tailnet (hostname=$HOSTNAME_TAG)..."
if "$TAILSCALE" --socket="$SOCK" up --authkey="$TS_AUTHKEY" --hostname="$HOSTNAME_TAG" --accept-dns=false > "$LOG_DIR/tailscale-up.log" 2>&1; then
  log "Conectado al tailnet."
else
  log "Fallo 'tailscale up' — ver $LOG_DIR/tailscale-up.log. La app sigue arrancando sin tailnet."
fi

# ── 4. Estado ────────────────────────────────────────────────────────────────
"$TAILSCALE" --socket="$SOCK" status 2>&1 | tee "$LOG_DIR/status.log" | sed 's/^/[tailscale-status] /'

exit 0
