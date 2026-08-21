#!/usr/bin/env bash
# apply-fail2ban-alerts.sh
# Aplica la acción de alertas por email (Resend) en un droplet existente con fail2ban ya instalado.
# Corre como root DIRECTAMENTE en el droplet remoto (no en Replit workspace).
#
# Uso desde tu terminal:
#   ssh -i ~/.ssh/<tu-llave> root@165.227.125.34 'bash -s' < scripts/apply-fail2ban-alerts.sh
#   ssh -i ~/.ssh/<tu-llave> root@138.197.79.6  'bash -s' < scripts/apply-fail2ban-alerts.sh
set -euo pipefail

echo ">>> Configurando fail2ban alertas Resend en $(hostname)..."

# 1. Instalar el script Python notificador
cat > /usr/local/bin/fail2ban-notify-resend.py <<'PYEOF'
#!/usr/bin/env python3
"""
fail2ban-notify-resend.py — alerta por email via Resend API cuando fail2ban banea una IP.
Llamado por fail2ban action: <ip> <failures> <jail>
Lee credenciales de /etc/fail2ban/resend.env (y /etc/banxico-plus.env como fallback).
"""
import sys, json, datetime, subprocess, syslog
import urllib.request, urllib.error

TAG = "fail2ban-resend"

def log_info(msg):
    syslog.openlog(TAG); syslog.syslog(syslog.LOG_INFO, msg)

def log_err(msg):
    syslog.openlog(TAG); syslog.syslog(syslog.LOG_ERR, msg)

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
        "from": sender, "to": [alert_to], "subject": subject, "html": html
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails", data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            resp = r.read().decode("utf-8", errors="replace")
            log_info(f"Alert sent for {ip} ({failures} failures, jail={jail}) on {droplet} -> {resp}")
    except urllib.error.HTTPError as e:
        log_err(f"Resend HTTP {e.code} for {ip}: {e.read().decode('utf-8', errors='replace')}")
    except Exception as e:
        log_err(f"Failed to send alert for {ip}: {e}")

if __name__ == "__main__":
    main()
PYEOF
chmod +x /usr/local/bin/fail2ban-notify-resend.py
echo "    [OK] /usr/local/bin/fail2ban-notify-resend.py instalado"

# 2. Instalar el archivo de acción fail2ban
cat > /etc/fail2ban/action.d/notify-resend.conf <<'ACTIONEOF'
# /etc/fail2ban/action.d/notify-resend.conf
# Envia alerta por email via Resend API cuando fail2ban banea una IP.

[Definition]
actionban   = /usr/local/bin/fail2ban-notify-resend.py <ip> <failures> <name>
actionunban =

[Init]
ACTIONEOF
echo "    [OK] /etc/fail2ban/action.d/notify-resend.conf instalado"

# 3. Actualizar jail.local para incluir la acción (solo si no está ya configurada)
if grep -q "notify-resend" /etc/fail2ban/jail.local 2>/dev/null; then
    echo "    [SKIP] jail.local ya incluye notify-resend"
else
    # Insertar la directiva action en la sección [sshd]
    python3 - <<'PYEOF2'
import re, sys

path = "/etc/fail2ban/jail.local"
with open(path) as f:
    content = f.read()

# Add action lines to [sshd] section if not present
action_block = (
    "action   = iptables-multiport[name=sshd, port=ssh, protocol=tcp]\n"
    "           notify-resend\n"
)

if "notify-resend" not in content:
    # Insert after the last key=value line in [sshd] section
    content = re.sub(
        r'(\[sshd\].*?bantime\s*=\s*\S+)',
        r'\1\n' + action_block,
        content,
        flags=re.DOTALL
    )
    with open(path, "w") as f:
        f.write(content)
    print("    [OK] jail.local actualizado con accion notify-resend")
else:
    print("    [SKIP] notify-resend ya presente en jail.local")
PYEOF2
fi

# 4. Crear /etc/fail2ban/resend.env con las credenciales
if [ -f /etc/fail2ban/resend.env ]; then
    echo "    [SKIP] /etc/fail2ban/resend.env ya existe"
else
    # Intentar extraer RESEND_API_KEY del env file del servicio
    if [ -f /etc/banxico-plus.env ]; then
        RKEY=$(grep -oP '(?<=^RESEND_API_KEY=)[^\n]+' /etc/banxico-plus.env | tr -d '"' || true)
        RFROM=$(grep -oP '(?<=^RESEND_FROM=)[^\n]+' /etc/banxico-plus.env | tr -d '"' || true)
        SMTP_FROM=$(grep -oP '(?<=^SMT_FROM=)[^\n]+' /etc/banxico-plus.env | tr -d '"' || true)
        if [ -n "$RKEY" ]; then
            ALERT_EMAIL="${SMTP_FROM:-admin@banxicoplusllc.org}"
            # Extraer solo el email si tiene formato "Nombre <email>"
            if echo "$ALERT_EMAIL" | grep -q '<'; then
                ALERT_EMAIL=$(echo "$ALERT_EMAIL" | grep -oP '(?<=<)[^>]+')
            fi
            {
                echo "RESEND_API_KEY=$RKEY"
                echo "RESEND_FROM=${RFROM:-Banxico Plus Security <noreply@banxicoplusllc.org>}"
                echo "ALERT_EMAIL=$ALERT_EMAIL"
            } > /etc/fail2ban/resend.env
            chmod 600 /etc/fail2ban/resend.env
            echo "    [OK] /etc/fail2ban/resend.env creado (ALERT_EMAIL=$ALERT_EMAIL)"
        else
            echo "    [WARN] RESEND_API_KEY no encontrada en banxico-plus.env"
            echo "           Crea /etc/fail2ban/resend.env manualmente:"
            echo "           RESEND_API_KEY=re_xxxx"
            echo "           ALERT_EMAIL=tu@email.com"
        fi
    else
        echo "    [WARN] /etc/banxico-plus.env no existe"
        echo "           Crea /etc/fail2ban/resend.env manualmente con RESEND_API_KEY y ALERT_EMAIL"
    fi
fi

# 5. Recargar fail2ban
systemctl reload fail2ban 2>/dev/null || systemctl restart fail2ban
sleep 1
echo "    [OK] fail2ban recargado"
fail2ban-client status sshd

# 6. Test de conectividad a Resend (sin enviar email)
echo "=== Test de conectividad a api.resend.com ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 5 "https://api.resend.com/" || echo "    [WARN] No se pudo alcanzar api.resend.com"

echo ""
echo "=== Verificar la configuracion ==="
echo "Script notificador:"
ls -la /usr/local/bin/fail2ban-notify-resend.py
echo "Accion fail2ban:"
ls -la /etc/fail2ban/action.d/notify-resend.conf
echo "Credenciales (redactadas):"
[ -f /etc/fail2ban/resend.env ] && grep -v 'API_KEY' /etc/fail2ban/resend.env || echo "    [WARN] No existe resend.env"
echo ""
echo "CONFIGURACION COMPLETADA en $(hostname)"
echo ""
echo "Para probar manualmente:"
echo "  fail2ban-client set sshd banip 1.2.3.4"
echo "  (recibirás el email de alerta)"
echo "  fail2ban-client set sshd unbanip 1.2.3.4"
