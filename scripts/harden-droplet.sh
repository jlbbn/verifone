#!/usr/bin/env bash
# Aplica hardening de SO a un droplet Ubuntu 24.04.
# Args: ninguno. Corre como root en el droplet remoto.
# NO toca la aplicación banxico-plus.service.
set -euo pipefail

USER_IP="186.96.190.247"

echo ">>> [1/5] Endureciendo sshd_config..."
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

echo ">>> [2/5] Ajustando UFW: restringir SSH a IP fija del usuario..."
# Eliminar reglas abiertas de SSH (ANY)
ufw --force delete allow OpenSSH 2>/dev/null || true
ufw --force delete allow 22/tcp 2>/dev/null || true
# Agregar regla específica para la IP del usuario (idempotente)
ufw allow from "$USER_IP" to any port 22 proto tcp comment "SSH admin usuario fijo"
ufw --force enable
ufw status verbose
echo "    UFW OK"

echo ">>> [3/5] Instalando y configurando fail2ban..."
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
EOF

systemctl enable --now fail2ban
sleep 2
fail2ban-client status sshd
echo "    fail2ban OK"

echo ">>> [4/5] Verificando unattended-upgrades..."
systemctl is-active unattended-upgrades || systemctl enable --now unattended-upgrades
apt-get -s upgrade 2>/dev/null | grep -c security || echo "    0 actualizaciones de seguridad pendientes"

echo ">>> [5/5] Estado final..."
echo "--- UFW ---"
ufw status verbose
echo "--- sshd ---"
sshd -T 2>/dev/null | grep -E 'permitrootlogin|passwordauthentication|maxauthtries|allowtcpforwarding|x11forwarding'
echo "--- fail2ban ---"
fail2ban-client status
echo "--- unattended-upgrades ---"
systemctl is-active unattended-upgrades

echo "HARDENING COMPLETADO"
