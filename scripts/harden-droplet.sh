#!/usr/bin/env bash
# Aplica hardening de SO a un droplet Ubuntu 24.04.
# Args: ninguno. Corre como root en el droplet remoto.
# NO toca la aplicación banxico-plus.service.
set -euo pipefail

USER_IP="186.96.190.247"
AGENT_UFW_TTL_SECONDS=900

# El runner de confianza deriva esta secuencia (con add-agent-to-ufw.sh
# --print-knock-ports) y entrega únicamente los puertos al droplet. La semilla
# SSH nunca se transmite ni se almacena aquí.
[[ "${AGENT_UFW_KNOCK_PORTS:-}" =~ ^[0-9]+,[0-9]+,[0-9]+$ ]] || {
  echo "falta AGENT_UFW_KNOCK_PORTS (tres puertos separados por coma)" >&2
  exit 1
}
IFS=, read -r -a KNOCK_PORTS <<<"$AGENT_UFW_KNOCK_PORTS"
declare -A seen_knock_ports=()
for port in "${KNOCK_PORTS[@]}"; do
  ((port >= 20000 && port < 50000)) || { echo "puerto de knock fuera de rango" >&2; exit 1; }
  [[ -z "${seen_knock_ports[$port]:-}" ]] || { echo "puertos de knock repetidos" >&2; exit 1; }
  seen_knock_ports[$port]=1
done

echo ">>> [1/6] Endureciendo sshd_config..."
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<'EOF'
# Hardening aplicado por auditoría ago-2026
PermitRootLogin prohibit-password
PasswordAuthentication no
MaxAuthTries 3
LoginGraceTime 30
AllowAgentForwarding no
AllowTcpForwarding no
X11Forwarding no
PrintLastLog yes
EOF
sshd -t && (systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true)
echo "    sshd recargado OK"

echo ">>> [2/6] Ajustando UFW: restringir SSH a IP fija del usuario..."
# Eliminar reglas abiertas de SSH (ANY)
ufw --force delete allow OpenSSH 2>/dev/null || true
ufw --force delete allow 22/tcp 2>/dev/null || true
# Agregar regla específica para la IP del usuario (idempotente)
ufw allow from "$USER_IP" to any port 22 proto tcp comment "SSH admin usuario fijo"
ufw --force enable
ufw status verbose
echo "    UFW OK"

echo ">>> [3/6] Instalando acceso temporal del agente mediante knockd..."
# knockd escucha paquetes UDP antes de que UFW los descarte. Solo el script
# add-agent-to-ufw.sh abre esos puertos y SSH en el Cloud Firewall, por un
# periodo corto y exclusivamente para la IP de salida actual del agente.
DEBIAN_FRONTEND=noninteractive apt-get install -y -q knockd

cat > /usr/local/sbin/agent-ufw-gate <<'EOF'
#!/usr/bin/env bash
# Se invoca exclusivamente desde knockd. Crea una regla SSH temporal para la
# IP que superó el knock y programa su retiro aunque el cliente se desconecte.
set -euo pipefail

readonly USER_IP="186.96.190.247"
readonly COMMENT_TAG="agent-ssh-temporary"
readonly LEASE_DIR="/var/lib/agent-ufw-gate"

usage() {
  echo "uso: agent-ufw-gate open|close IPV4 [ttl-segundos]" >&2
  exit 64
}

[[ $# -ge 2 ]] || usage
action="$1"
ip="$2"
ttl="${3:-900}"

python3 - "$ip" "$ttl" <<'PY'
import ipaddress
import sys

ip = ipaddress.ip_address(sys.argv[1])
ttl = int(sys.argv[2])
if ip.version != 4 or not 60 <= ttl <= 3600:
    raise SystemExit("IP o TTL inválido")
PY

# La IP de administración del usuario es una regla protegida y jamás se borra
# por este mecanismo. Un knock desde ella es un no-op seguro.
[[ "$ip" != "$USER_IP" ]] || exit 0

mkdir -p /run/agent-ufw-gate
exec 9>/run/agent-ufw-gate/lock
flock -x 9
install -d -o root -g root -m 700 "$LEASE_DIR"

rule_numbers() {
  ufw status numbered |
    grep -F "$ip" |
    grep -F "$COMMENT_TAG" |
    sed -n 's/^[[:space:]]*\[[[:space:]]*\([0-9][0-9]*\)\].*/\1/p' || true
}

remove_temporary_rules() {
  local number
  # Borrar de mayor a menor evita que cambien los números de las reglas.
  while IFS= read -r number; do
    [[ -n "$number" ]] || continue
    ufw --force delete "$number"
  done < <(rule_numbers | sort -rn)
}

lease_file="${LEASE_DIR}/${ip}"

write_lease() {
  local expires_at tmp_file
  expires_at="$(( $(date +%s) + ttl ))"
  tmp_file="$(mktemp "${LEASE_DIR}/.${ip}.XXXXXX")"
  printf '%s\n' "$expires_at" >"$tmp_file"
  chmod 600 "$tmp_file"
  mv -f "$tmp_file" "$lease_file"
}

case "$action" in
  open)
    # La reconciliación es persistente (también tras un reinicio). No se abre
    # una regla si no está activa, pues no habría garantía de caducidad.
    systemctl is-active --quiet agent-ufw-reconcile.timer
    write_lease

    if [[ -z "$(rule_numbers)" ]]; then
      if ! ufw allow from "$ip" to any port 22 proto tcp comment "$COMMENT_TAG"; then
        rm -f "$lease_file"
        exit 1
      fi
    fi
    ;;
  close)
    remove_temporary_rules
    rm -f "$lease_file"
    ;;
  *)
    usage
    ;;
esac
EOF
chmod 700 /usr/local/sbin/agent-ufw-gate

cat > /usr/local/sbin/agent-ufw-reconcile <<'EOF'
#!/usr/bin/env bash
# Retira reglas efímeras vencidas y cualquier regla efímera que perdió su
# concesión. Se ejecuta al arrancar y cada 30 segundos mediante systemd.
set -euo pipefail

readonly LEASE_DIR="/var/lib/agent-ufw-gate"
readonly COMMENT_TAG="agent-ssh-temporary"
now="$(date +%s)"

valid_ipv4() {
  python3 - "$1" <<'PY'
import ipaddress
import sys
ip = ipaddress.ip_address(sys.argv[1])
raise SystemExit(0 if ip.version == 4 else 1)
PY
}

lease_is_current() {
  local ip="$1" expiry
  [[ -f "${LEASE_DIR}/${ip}" ]] || return 1
  read -r expiry <"${LEASE_DIR}/${ip}" || return 1
  [[ "$expiry" =~ ^[0-9]+$ ]] && ((expiry > now))
}

shopt -s nullglob
for lease in "${LEASE_DIR}"/*; do
  ip="${lease##*/}"
  if ! valid_ipv4 "$ip" || ! lease_is_current "$ip"; then
    /usr/local/sbin/agent-ufw-gate close "$ip" 2>/dev/null || rm -f "$lease"
  fi
done

# Si se pierde el archivo de concesión durante un reinicio o una escritura
# interrumpida, se elimina la regla marcada en vez de mantenerla abierta.
while IFS= read -r line; do
  number="$(printf '%s\n' "$line" | sed -n 's/^[[:space:]]*\[[[:space:]]*\([0-9][0-9]*\)\].*/\1/p')"
  ip="$(printf '%s\n' "$line" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -n1 || true)"
  [[ -n "$number" && -n "$ip" ]] || continue
  if ! valid_ipv4 "$ip" || ! lease_is_current "$ip"; then
    ufw --force delete "$number"
    rm -f "${LEASE_DIR}/${ip}"
  fi
done < <(ufw status numbered | grep -F "$COMMENT_TAG" || true)
EOF
chmod 700 /usr/local/sbin/agent-ufw-reconcile

install -d -o root -g root -m 700 /var/lib/agent-ufw-gate
cat > /etc/systemd/system/agent-ufw-reconcile.service <<'EOF'
[Unit]
Description=Retira reglas UFW temporales del agente vencidas
After=ufw.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/agent-ufw-reconcile
EOF

cat > /etc/systemd/system/agent-ufw-reconcile.timer <<'EOF'
[Unit]
Description=Reconciliación persistente de reglas UFW temporales del agente

[Timer]
OnBootSec=15s
OnUnitActiveSec=30s
Persistent=true
Unit=agent-ufw-reconcile.service

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now agent-ufw-reconcile.timer
systemctl is-active --quiet agent-ufw-reconcile.timer

PRIMARY_INTERFACE="$(ip route get 1.1.1.1 | awk '{for (i=1; i<=NF; i++) if ($i == "dev") {print $(i+1); exit}}')"
[[ -n "$PRIMARY_INTERFACE" ]] || { echo "No se pudo detectar la interfaz de red para knockd" >&2; exit 1; }

cat > /etc/knockd.conf <<EOF
[options]
        UseSyslog
        Interface = ${PRIMARY_INTERFACE}

[open-agent-ufw]
        sequence    = ${KNOCK_PORTS[0]}:udp,${KNOCK_PORTS[1]}:udp,${KNOCK_PORTS[2]}:udp
        seq_timeout = 8
        command     = /usr/local/sbin/agent-ufw-gate open %IP% ${AGENT_UFW_TTL_SECONDS}

[close-agent-ufw]
        sequence    = ${KNOCK_PORTS[2]}:udp,${KNOCK_PORTS[1]}:udp,${KNOCK_PORTS[0]}:udp
        seq_timeout = 8
        command     = /usr/local/sbin/agent-ufw-gate close %IP%
EOF
chmod 600 /etc/knockd.conf

# Ubuntu instala knockd deshabilitado por defecto.
if grep -q '^START_KNOCKD=' /etc/default/knockd; then
    sed -i 's/^START_KNOCKD=.*/START_KNOCKD=1/' /etc/default/knockd
else
    echo 'START_KNOCKD=1' >> /etc/default/knockd
fi
systemctl enable --now knockd
systemctl is-active --quiet knockd
echo "    knockd activo; UFW seguirá permitiendo SSH permanente solo a ${USER_IP}"

echo ">>> [4/6] Instalando y configurando fail2ban..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -q fail2ban

cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
# Whitelist IP fija del usuario para no bloquearlo nunca
ignoreip = 127.0.0.1/8 ::1 ${USER_IP}/32
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
maxretry = 5
bantime  = 24h
action   = iptables-multiport[name=sshd, port=ssh, protocol=tcp]
           notify-resend
EOF

# --- fail2ban Resend email notifier ---
# Instalar el script Python que llama a la API de Resend
cat > /usr/local/bin/fail2ban-notify-resend.py <<'PYEOF'
#!/usr/bin/env python3
"""
fail2ban-notify-resend.py
Sends an email alert via Resend API when fail2ban bans an IP.
Called by fail2ban action: <ip> <failures> <jail>

Reads credentials from /etc/fail2ban/resend.env (or /etc/banxico-plus.env as fallback).
"""
import sys, os, json, datetime, subprocess, syslog
import urllib.request, urllib.error

TAG = "fail2ban-resend"

def log_info(msg):
    syslog.openlog(TAG)
    syslog.syslog(syslog.LOG_INFO, msg)

def log_err(msg):
    syslog.openlog(TAG)
    syslog.syslog(syslog.LOG_ERR, msg)

def read_env_file(path):
    env = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, _, v = line.partition('=')
                env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    except Exception as e:
        log_err(f"Error reading {path}: {e}")
    return env

def extract_email(value):
    if '<' in value and '>' in value:
        return value.split('<')[1].split('>')[0].strip()
    return value.strip()

def main():
    ip       = sys.argv[1] if len(sys.argv) > 1 else "unknown"
    failures = sys.argv[2] if len(sys.argv) > 2 else "?"
    jail     = sys.argv[3] if len(sys.argv) > 3 else "sshd"

    env = {}
    env.update(read_env_file("/etc/banxico-plus.env"))
    env.update(read_env_file("/etc/fail2ban/resend.env"))

    api_key = env.get("RESEND_API_KEY", "").strip()
    if not api_key:
        log_err(f"No RESEND_API_KEY found — skipping alert for {ip}")
        sys.exit(0)

    sender = env.get("RESEND_FROM", "").strip() or "Banxico Plus Security <noreply@banxicoplusllc.org>"
    alert_to_raw = (
        env.get("ALERT_EMAIL")
        or env.get("SMT_FROM")
        or env.get("SMTP_USER")
        or "admin@banxicoplusllc.org"
    )
    alert_to = extract_email(alert_to_raw)

    try:
        droplet = subprocess.check_output(["hostname"], text=True).strip()
    except Exception:
        droplet = "unknown-droplet"

    ts = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    subject = f"[fail2ban] IP {ip} baneada en {droplet}"
    html = f"""<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:0 auto">
<h2 style="color:#c0392b">IP Bloqueada por fail2ban</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
  <tr><td style="background:#f5f5f5"><b>Droplet</b></td><td>{droplet}</td></tr>
  <tr><td style="background:#f5f5f5"><b>IP Baneada</b></td><td><code>{ip}</code></td></tr>
  <tr><td style="background:#f5f5f5"><b>Intentos fallidos</b></td><td>{failures}</td></tr>
  <tr><td style="background:#f5f5f5"><b>Jail</b></td><td>{jail}</td></tr>
  <tr><td style="background:#f5f5f5"><b>Fecha / Hora</b></td><td>{ts}</td></tr>
</table>
<p style="color:#555;font-size:13px">IP baneada por 24 horas. Sin accion requerida a menos que el patron se repita.</p>
</body></html>"""

    payload = json.dumps({
        "from":    sender,
        "to":      [alert_to],
        "subject": subject,
        "html":    html
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type":  "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            resp_body = r.read().decode("utf-8", errors="replace")
            log_info(f"Alert sent for {ip} ({failures} failures, jail={jail}) on {droplet} -> {resp_body}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        log_err(f"Resend HTTP {e.code} for {ip}: {body}")
    except Exception as e:
        log_err(f"Failed to send alert for {ip}: {e}")

if __name__ == "__main__":
    main()
PYEOF
chmod +x /usr/local/bin/fail2ban-notify-resend.py

# Instalar el archivo de acción fail2ban
cat > /etc/fail2ban/action.d/notify-resend.conf <<'ACTIONEOF'
# /etc/fail2ban/action.d/notify-resend.conf
# Envia alerta por email via Resend API cuando fail2ban banea una IP.

[Definition]
actionban   = /usr/local/bin/fail2ban-notify-resend.py <ip> <failures> <name>
actionunban =

[Init]
ACTIONEOF

# Crear /etc/fail2ban/resend.env con la clave de Resend (leída de banxico-plus.env)
if [ -f /etc/banxico-plus.env ]; then
    # Extraer RESEND_API_KEY del env file del servicio
    RKEY=$(grep -oP '(?<=^RESEND_API_KEY=)[^\n]+' /etc/banxico-plus.env | tr -d '"' || true)
    RFROM=$(grep -oP '(?<=^RESEND_FROM=)[^\n]+' /etc/banxico-plus.env | tr -d '"' || true)
    RFROM_ADDR=$(echo "${RFROM:-}" | grep -oP '(?<=<)[^>]+' || echo "${RFROM:-}")
    if [ -n "$RKEY" ]; then
        printf 'RESEND_API_KEY=%s\nRESEND_FROM=%s\nALERT_EMAIL=%s\n' \
            "$RKEY" "${RFROM:-Banxico Plus Security <noreply@banxicoplusllc.org>}" "${RFROM_ADDR:-admin@banxicoplusllc.org}" \
            > /etc/fail2ban/resend.env
        chmod 600 /etc/fail2ban/resend.env
        echo "    resend.env creado desde banxico-plus.env"
    else
        echo "    AVISO: RESEND_API_KEY no encontrada en banxico-plus.env — configura /etc/fail2ban/resend.env manualmente"
    fi
else
    echo "    AVISO: /etc/banxico-plus.env no existe — crea /etc/fail2ban/resend.env manualmente con RESEND_API_KEY y ALERT_EMAIL"
fi

systemctl enable --now fail2ban
sleep 2
systemctl reload fail2ban 2>/dev/null || systemctl restart fail2ban
sleep 1
fail2ban-client status sshd
echo "    fail2ban OK"

echo ">>> [5/6] Verificando unattended-upgrades..."
systemctl is-active unattended-upgrades || systemctl enable --now unattended-upgrades
apt-get -s upgrade 2>/dev/null | grep -c security || echo "    0 actualizaciones de seguridad pendientes"

echo ">>> [6/6] Estado final..."
echo "--- UFW ---"
ufw status verbose
echo "--- sshd ---"
sshd -T 2>/dev/null | grep -E 'permitrootlogin|passwordauthentication|maxauthtries|allowtcpforwarding|x11forwarding'
echo "--- fail2ban ---"
fail2ban-client status
echo "--- unattended-upgrades ---"
systemctl is-active unattended-upgrades

echo "HARDENING COMPLETADO"
