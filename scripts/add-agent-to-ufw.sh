#!/usr/bin/env bash
# Abre acceso SSH temporal para el agente en un droplet ya preparado con knockd.
#
# El flujo mantiene dos capas cerradas:
#   1. Añade por poco tiempo la IP actual a SSH y a los puertos UDP de knock
#      del Cloud Firewall de DigitalOcean.
#   2. Envía el knock. knockd crea una regla UFW temporal (máx. 15 min) para
#      esa misma IP; al salir, este script la cierra y restaura el firewall DO.
#
# Requiere que scripts/harden-droplet.sh se haya aplicado en el droplet. Nunca
# elimina ni modifica la regla fija del usuario (186.96.190.247).
set -euo pipefail

readonly USER_IP="186.96.190.247"
readonly DEFAULT_SSH_KEY="/home/runner/.ssh/do_banxico_derived"
readonly API_BASE="https://api.digitalocean.com/v2"
declare -a KNOCK_PORTS=()

TARGET=""
AGENT_IP=""
SSH_KEY="$DEFAULT_SSH_KEY"
SSH_USER="root"
NO_EGRESS_CHECK=false
PRINT_KNOCK_PORTS=false
declare -a REMOTE_COMMAND=()

usage() {
  cat <<'EOF'
Uso:
  DIGITALOCEAN_TOKEN=... scripts/add-agent-to-ufw.sh --target production [opciones] [-- comando-remoto]

Opciones:
  --target production|sandbox  Droplet a abrir temporalmente (obligatorio).
  --agent-ip IPV4              IP pública actual del agente. Si se omite, se detecta.
  --ssh-key RUTA               Llave SSH a usar (por defecto: llave derivada de DO).
  --ssh-user USUARIO           Usuario SSH (por defecto: root).
  --skip-egress-check          No comparar --agent-ip con la IP de salida detectada.
  --print-knock-ports          Imprimir la secuencia para preparar harden-droplet.sh.
  -h, --help                   Mostrar esta ayuda.

El token se lee solo desde DIGITALOCEAN_TOKEN; no se acepta por argumentos para
no exponerlo en la lista de procesos. También requiere DO_SSH_SEED, ya usada
para la llave SSH: se usa solo para derivar los puertos de knock y no se
transmite al droplet. Si se pasa un comando después de --, se ejecuta por SSH
y el acceso se cierra al terminar. Sin comando abre una sesión interactiva,
que también se cierra al salir.
EOF
}

fail() {
  echo "Error: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "falta el comando requerido: $1"
}

while (($#)); do
  case "$1" in
    --target)
      (($# >= 2)) || fail "--target requiere un valor"
      TARGET="$2"
      shift 2
      ;;
    --agent-ip)
      (($# >= 2)) || fail "--agent-ip requiere una IPv4"
      AGENT_IP="$2"
      shift 2
      ;;
    --ssh-key)
      (($# >= 2)) || fail "--ssh-key requiere una ruta"
      SSH_KEY="$2"
      shift 2
      ;;
    --ssh-user)
      (($# >= 2)) || fail "--ssh-user requiere un usuario"
      SSH_USER="$2"
      shift 2
      ;;
    --skip-egress-check)
      NO_EGRESS_CHECK=true
      shift
      ;;
    --print-knock-ports)
      PRINT_KNOCK_PORTS=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      REMOTE_COMMAND=("$@")
      break
      ;;
    *)
      fail "opción desconocida: $1 (usa --help)"
      ;;
  esac
done

require_command node
[[ -n "${DO_SSH_SEED:-}" ]] || fail "falta DO_SSH_SEED para derivar la señal de apertura segura"

derive_knock_ports() {
  node <<'NODE'
const crypto = require("crypto");
const seed = process.env.DO_SSH_SEED;
if (!seed) process.exit(1);

const ports = [];
for (let round = 0; ports.length < 3; round += 1) {
  const digest = crypto
    .createHmac("sha256", seed)
    .update(`banxico-plus-agent-ufw-knock-v1:${round}`)
    .digest();
  for (let offset = 0; offset < digest.length && ports.length < 3; offset += 2) {
    const port = 20000 + (digest.readUInt16BE(offset) % 30000);
    if (!ports.includes(port)) ports.push(port);
  }
}
process.stdout.write(`${ports.join("\n")}\n`);
NODE
}

mapfile -t KNOCK_PORTS < <(derive_knock_ports)
((${#KNOCK_PORTS[@]} == 3)) || fail "no se pudo derivar la secuencia de apertura segura"

if [[ "$PRINT_KNOCK_PORTS" == true ]]; then
  (IFS=,; printf '%s\n' "${KNOCK_PORTS[*]}")
  exit 0
fi

[[ -n "$TARGET" ]] || fail "--target es obligatorio"
[[ -n "${DIGITALOCEAN_TOKEN:-}" ]] || fail "falta DIGITALOCEAN_TOKEN"
require_command curl
require_command python3
require_command ssh

case "$TARGET" in
  production)
    # ID y nombre actualizados 2026-09-14: el firewall "production-restricted"
    # (a6c24a6d-9e11-4cf6-b980-a71e6b3690c0) ya NO EXISTE (404 verificado contra la
    # API) — era el de la cuenta DO borrada en el incidente del 2026-09-06. El
    # firewall real de la cuenta reconstruida es "banxico-plus-app-fw".
    # ADVERTENCIA: ese firewall real permite SSH 22 desde 0.0.0.0/0 (no restringido
    # a la IP fija del usuario) y el droplet NO tiene knockd instalado ni UFW activo
    # (verificado en vivo) — el endurecimiento de scripts/harden-droplet.sh nunca se
    # reaplicó tras la reconstrucción. Este script fallará limpiamente con el error
    # "falta la IP fija protegida del usuario en SSH" hasta que se reaplique
    # harden-droplet.sh contra el droplet actual (104.131.190.116).
    FIREWALL_ID="043fb6ff-c009-42a9-8a22-e637cc27a0ec"
    FIREWALL_NAME="banxico-plus-app-fw"
    # IP actualizada tras la reconstrucción de la cuenta DO del 2026-09-06 (la cuenta
    # fue borrada y recreada; ver docs/compliance/fase1-log.md, entrada 2026-09-06).
    # IP anterior (ya no existe): 165.227.125.34
    DROPLET_HOST="104.131.190.116"
    ;;
  sandbox)
    FIREWALL_ID="2907a33f-40bb-411e-aa43-7031e12d39f0"
    FIREWALL_NAME="sandbox-restricted"
    DROPLET_HOST="138.197.79.6"
    ;;
  *)
    fail "--target debe ser production o sandbox"
    ;;
esac

detect_egress_ip() {
  curl --fail --silent --show-error --max-time 10 https://api.ipify.org
}

if [[ -z "$AGENT_IP" ]]; then
  AGENT_IP="$(detect_egress_ip)" || fail "no se pudo detectar la IP de salida del agente"
fi

python3 - "$AGENT_IP" <<'PY'
import ipaddress
import sys

ip = ipaddress.ip_address(sys.argv[1])
if ip.version != 4:
    raise SystemExit("La IP del agente debe ser IPv4.")
PY

if [[ "$NO_EGRESS_CHECK" != true ]]; then
  EGRESS_IP="$(detect_egress_ip)" || fail "no se pudo verificar la IP de salida del agente"
  [[ "$EGRESS_IP" == "$AGENT_IP" ]] || fail \
    "la IP indicada ($AGENT_IP) no coincide con la salida actual ($EGRESS_IP); vuelve a ejecutar con la IP actual"
fi

[[ "$AGENT_IP" != "$USER_IP" ]] || fail \
  "la IP del agente coincide con la IP fija del usuario; este script no opera sobre esa regla protegida"
[[ -r "$SSH_KEY" ]] || fail \
  "no se puede leer la llave SSH: $SSH_KEY (regénérala antes con scripts/derive-do-ssh-key.sh)"

WORKDIR="$(mktemp -d)"
cleanup_done=false
cloud_rule_added=false
ufw_opened=false

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ "$ufw_opened" == true ]]; then
    echo "Cerrando la regla UFW temporal..."
    if send_knock close; then
      ufw_opened=false
    else
      echo "Advertencia: no se pudo cerrar UFW por knock; expirará automáticamente en un máximo de 15 minutos." >&2
    fi
  fi

  if [[ "$cloud_rule_added" == true ]]; then
    echo "Retirando las reglas transitorias del Cloud Firewall..."
    if remove_cloud_rules; then
      cloud_rule_added=false
    else
      echo "Advertencia: no se pudieron retirar automáticamente las reglas del Cloud Firewall." >&2
    fi
  fi

  rm -rf "$WORKDIR"
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

api_get_firewall() {
  curl --fail --silent --show-error --max-time 20 \
    -H "Authorization: Bearer ${DIGITALOCEAN_TOKEN}" \
    "${API_BASE}/firewalls/${FIREWALL_ID}"
}

api_add_rules() {
  local payload_file="$1"
  curl --fail --silent --show-error --max-time 30 \
    -X POST \
    -H "Authorization: Bearer ${DIGITALOCEAN_TOKEN}" \
    -H "Content-Type: application/json" \
    --data-binary "@${payload_file}" \
    "${API_BASE}/firewalls/${FIREWALL_ID}/rules" >/dev/null
}

api_remove_rules() {
  local payload_file="$1"
  curl --fail --silent --show-error --max-time 30 \
    -X DELETE \
    -H "Authorization: Bearer ${DIGITALOCEAN_TOKEN}" \
    -H "Content-Type: application/json" \
    --data-binary "@${payload_file}" \
    "${API_BASE}/firewalls/${FIREWALL_ID}/rules" >/dev/null
}

write_temporary_rule_plan() {
  local source_json="$1"
  local output_file="$2"

  python3 - "$AGENT_IP" "$USER_IP" "$FIREWALL_NAME" "$source_json" "$output_file" "${KNOCK_PORTS[@]}" <<'PY'
import json
import sys

agent_ip, user_ip, expected_name, input_file, output_file, *knock_ports = sys.argv[1:]
firewall = json.load(open(input_file, encoding="utf-8"))["firewall"]
if firewall["name"] != expected_name:
    raise SystemExit(f"El firewall recibido no es {expected_name!r}.")

agent_cidr = f"{agent_ip}/32"
user_cidr = f"{user_ip}/32"
inbound = firewall.get("inbound_rules", [])

def addresses(rule):
    return rule.get("sources", {}).get("addresses", [])

def is_ssh(rule):
    return rule.get("protocol") == "tcp" and rule.get("ports") == "22"

if not any(is_ssh(rule) and user_cidr in addresses(rule) for rule in inbound):
    raise SystemExit("Se negó a actualizar: falta la IP fija protegida del usuario en SSH.")

def agent_already_allowed(protocol, port):
    return any(
        rule.get("protocol") == protocol
        and rule.get("ports") == port
        and agent_cidr in addresses(rule)
        for rule in inbound
    )

# Cada permiso transitorio es una regla independiente con una única IP. Así el
# DELETE posterior no puede borrar o reescribir las reglas preexistentes.
temporary_rules = []
if not agent_already_allowed("tcp", "22"):
    temporary_rules.append({
        "protocol": "tcp",
        "ports": "22",
        "sources": {"addresses": [agent_cidr]},
    })
for port in knock_ports:
    if not agent_already_allowed("udp", port):
        temporary_rules.append({
            "protocol": "udp",
            "ports": port,
            "sources": {"addresses": [agent_cidr]},
        })

json.dump(
    {"inbound_rules": temporary_rules},
    open(output_file, "w", encoding="utf-8"),
    separators=(",", ":"),
)
PY
}

temporary_rule_plan_has_entries() {
  python3 - "$1" <<'PY'
import json
import sys

raise SystemExit(0 if json.load(open(sys.argv[1]))["inbound_rules"] else 1)
PY
}

add_cloud_rules() {
  local current_json="$WORKDIR/firewall-before.json"
  local rules_json="$WORKDIR/temporary-rules.json"

  api_get_firewall >"$current_json"
  write_temporary_rule_plan "$current_json" "$rules_json"
  if ! temporary_rule_plan_has_entries "$rules_json"; then
    echo "La IP del agente ya tiene acceso en el Cloud Firewall; no se añadieron reglas."
    return
  fi

  # Armar el cleanup antes del POST cubre respuestas ambiguas: si DO aplicó la
  # mutación pero la conexión se corta, el trap aún intentará retirar estas
  # reglas exactas y nunca tocará una regla ajena.
  cloud_rule_added=true
  api_add_rules "$rules_json"
}

remove_cloud_rules() {
  api_remove_rules "$WORKDIR/temporary-rules.json"
}

send_knock() {
  local action="$1"
  local ports
  case "$action" in
    open) ports=("${KNOCK_PORTS[@]}") ;;
    close) ports=("${KNOCK_PORTS[2]}" "${KNOCK_PORTS[1]}" "${KNOCK_PORTS[0]}") ;;
    *) return 2 ;;
  esac

  python3 - "$DROPLET_HOST" "${ports[@]}" <<'PY'
import socket
import sys
import time

host, *ports = sys.argv[1:]
for port in ports:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.sendto(b"agent-ufw-gate", (host, int(port)))
    sock.close()
    time.sleep(0.45)
PY
}

run_ssh() {
  local -a ssh_args=(
    -i "$SSH_KEY"
    -o BatchMode=yes
    -o ConnectTimeout=8
    -o ConnectionAttempts=1
    -o StrictHostKeyChecking=accept-new
    -o UserKnownHostsFile="$WORKDIR/known_hosts"
    "${SSH_USER}@${DROPLET_HOST}"
  )

  if ((${#REMOTE_COMMAND[@]})); then
    ssh "${ssh_args[@]}" -- "${REMOTE_COMMAND[@]}"
  else
    ssh "${ssh_args[@]}"
  fi
}

echo "Añadiendo acceso transitorio al Cloud Firewall de ${TARGET} para ${AGENT_IP}..."
add_cloud_rules

echo "Enviando señal de apertura UFW..."
send_knock open
ufw_opened=true

echo "Esperando la propagación y conectando por SSH..."
for attempt in {1..12}; do
  if run_ssh; then
    exit 0
  fi
  if ((attempt == 12)); then
    fail "SSH no quedó disponible. Verifica que harden-droplet.sh haya instalado y activado knockd en ${TARGET}."
  fi
  sleep 2
done