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
    """Parse a KEY=VALUE env file, stripping quotes."""
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
    """Extract plain email from 'Name <email>' format."""
    if '<' in value and '>' in value:
        return value.split('<')[1].split('>')[0].strip()
    return value.strip()

def main():
    ip       = sys.argv[1] if len(sys.argv) > 1 else "unknown"
    failures = sys.argv[2] if len(sys.argv) > 2 else "?"
    jail     = sys.argv[3] if len(sys.argv) > 3 else "sshd"

    # Load credentials — dedicated file takes priority over app env file
    env = {}
    env.update(read_env_file("/etc/banxico-plus.env"))
    env.update(read_env_file("/etc/fail2ban/resend.env"))

    api_key = env.get("RESEND_API_KEY", "").strip()
    if not api_key:
        log_err(f"No RESEND_API_KEY found — skipping alert for {ip}")
        sys.exit(0)

    # Resolve sender
    sender = env.get("RESEND_FROM", "").strip() or "Banxico Plus Security <noreply@banxicoplusllc.org>"

    # Resolve recipient — prefer explicit ALERT_EMAIL, else use SMT_FROM / SMTP_USER
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
<h2 style="color:#c0392b">&#x1F6A8; IP Bloqueada por fail2ban</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
  <tr><td style="background:#f5f5f5"><b>Droplet</b></td><td>{droplet}</td></tr>
  <tr><td style="background:#f5f5f5"><b>IP Baneada</b></td><td><code>{ip}</code></td></tr>
  <tr><td style="background:#f5f5f5"><b>Intentos fallidos</b></td><td>{failures}</td></tr>
  <tr><td style="background:#f5f5f5"><b>Jail</b></td><td>{jail}</td></tr>
  <tr><td style="background:#f5f5f5"><b>Fecha / Hora</b></td><td>{ts}</td></tr>
</table>
<p style="color:#555;font-size:13px">IP baneada por 24 horas. Sin acci&oacute;n requerida a menos que el patr&oacute;n se repita.</p>
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
            log_info(f"Alert sent for {ip} ({failures} failures, jail={jail}) on {droplet} → {resp_body}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        log_err(f"Resend HTTP {e.code} for {ip}: {body}")
    except Exception as e:
        log_err(f"Failed to send alert for {ip}: {e}")

if __name__ == "__main__":
    main()
