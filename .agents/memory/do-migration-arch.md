---
name: DigitalOcean production migration architecture
description: Production app + DB are migrating from Replit hosting to DigitalOcean (compliance plan, Etapa 1) — target architecture, naming, and hard rules.
---

# DigitalOcean migration (compliance plan, decided 2026-08-11)

**Decision:** User confirmed (twice) the literal compliance plan: production DB **and** app runtime move to DigitalOcean so the DB can live VPC-only without public exposure. Replit stays as the dev workspace; Replit production deployment will be retired after DNS cutover.

**Why:** The compliance plan (Etapa 1, Tareas 3-5) requires a DB with no public IP reachable only inside a private network. The app on Replit cannot reach a VPC-only DB, and Replit has no fixed egress IP, so trusted-source firewalling doesn't work from Replit. Option B (public hardened endpoint) was rejected as cost without real control gain.

**Target architecture (region nyc3):**
- VPC `banxico-plus-vpc` — 10.10.0.0/20. DO VPCs have a single ip_range; no separate subnets (documented honestly in bitácora).
- Managed PostgreSQL 18 `banxico-plus-db` inside the VPC (db-s-1vcpu-1gb, ~$15/mes). Tarea 4 = restrict trusted sources to app droplet + bastion (DO managed DBs always expose a hostname; the firewall is what removes effective public access).
- App droplet `banxico-plus-app` Ubuntu 24.04 (s-1vcpu-2gb, $12/mes) in the same VPC. Chosen over App Platform because Etapa 2 (SSH hardening, fail2ban, bastion) presumes real servers.
- SSH: dedicated ed25519 key at `/home/runner/.ssh/do_banxico_ed25519` (workspace-local, not in repo), DO key name `banxico-plus-admin`. Key-only auth, no passwords.

**How to apply:**
- All DO API calls: `Authorization: Bearer $DIGITALOCEAN_TOKEN` (Replit secret). Never print the token or DB passwords; jq-filter credentials out of any `/v2/databases` output shown in chat or logs.
- Hard rules agreed with the user: no paid resource created without explicit confirmation; live-data migration only with verified backup + maintenance window + rollback path (DNS points back to Replit deployment).
- Build in the Replit workspace, ship artifacts to the droplet (2GB RAM: avoid building on-server). Secrets go to the droplet via SSH into a root-owned env file (never committed).
- Budget honesty: the plan's spreadsheet budgeted $0 for the managed DB and nothing for app hosting; real ~$27/mes fits in the plan's buffer lines — flagged to the user, accepted.
- The bitácora `docs/compliance/fase1-log.md` records only real, verified events (anti-fabrication boundary).

## Lección: /home/runner/.ssh NO persiste
- Un reinicio del entorno de Replit borra `/home/runner/.ssh` (llaves + known_hosts). La llave
  privada del droplet se pierde y NO debe respaldarse dentro del workspace (se comparte/commitea).
- Recuperación estándar: generar llave nueva, registrarla en la cuenta DO vía API
  (`POST /v2/account/keys`), y pedir al usuario pegar UNA línea en la Droplet Console web
  (`echo '<pubkey>' >> /root/.ssh/authorized_keys`). La console web entra como root sin
  contraseña gracias al droplet-agent preinstalado en imágenes DO Ubuntu.
- Regla: al inicio de cada sesión que toque el droplet, verificar `ls ~/.ssh` antes de asumir acceso.
- Llaves DO en cuenta: banxico-plus-admin (58416636, privada perdida, inofensiva) y
  banxico-plus-admin-2 (58433245, activa).

## Llave SSH derivada (estándar actual)
- La llave de administración del droplet se regenera con `scripts/derive-do-ssh-key.sh`
  (lee el secreto DO_SSH_SEED; SHA-256 → semilla ed25519; escribe /home/runner/.ssh/do_banxico_derived).
- Tras cualquier reinicio del entorno: correr ese script y usar `-i /home/runner/.ssh/do_banxico_derived`.
- Registrada en la cuenta DO (banxico-plus-admin-derived). Las llaves admin (58416636) y
  admin-2 (58433245) tienen la parte privada perdida: inofensivas, no reutilizar.

## DNS del dominio
- banxicoplusllc.org ya usa nameservers de CLOUDFLARE (cuenta del usuario). A raíz → IP GCP de Replit,
  TTL 3600, registro sin proxy; www NO existe (crearlo en el cutover). Cutover = editar registro A en
  panel CF del usuario; secuencia: gris (directo) → Caddy emite LE → luego nube naranja + WAF (Etapa 2).

## Pipeline de migración de datos (ensayado OK 2026-08-12)
- Export: executeSql prod → json_agg por tabla → base64 → /tmp/rehearsal-data/*.json (decodificar
  con Buffer DENTRO de "use impure"; el ámbito durable del sandbox no tiene Buffer).
- Import/verify: scripts/migration/import-data.mjs y verify-import.mjs (DB_URL + DATA_DIR;
  NODE_EXTRA_CA_CERTS con la CA del clúster re-descargable vía API /v2/databases/{id}/ca).
- El sandbox de CodeExecution comparte /tmp con el shell del workspace (verificado con marker).
- Regla PII: tras verificar, borrar dumps de /tmp y la base de ensayo (no dejar copias).
- Día real: mismo pipeline contra defaultdb + delta re-sync post-propagación DNS.

## Runbook del cutover (todo preparado, esperando ventana del usuario)
1. Export fresco: mismo pipeline del ensayo (CodeExecution → /tmp) contra prod.
2. Import a `defaultdb` (NO a base de ensayo; ya borrada): scripts/migration/import-data.mjs
   + verify-import.mjs con DB_URL de defaultdb; luego `systemctl restart banxico-plus`.
   OJO: el import TRUNCATE-a todo — la app del droplet debe estar detenida o el seed re-corre
   al reiniciar (storage.initialize() es idempotente sobre datos ya presentes: verificar que
   respeta filas existentes tras import real).
3. Activar dominio: `cp /etc/caddy/Caddyfile.cutover /etc/caddy/Caddyfile && systemctl reload caddy`.
4. Usuario en Cloudflare: registro A banxicoplusllc.org → 165.227.125.34 (gris primero; crear
   www también). TTL idealmente ya bajado a 5 min ANTES.
5. Smoke: https + login + saldos. Luego delta re-sync: comparar prod Replit (executeSql, filas
   nuevas desde export por created_at/id) y re-aplicar en DO.
6. Post-estabilidad: trusted sources de la BD a solo el droplet (Tarea 4), apagar Replit prod,
   nube naranja CF + WAF (Etapa 2), restringir llave OKX a IP 165.227.125.34 y revisar permiso
   withdraw (hallazgo: llave sin restricción de IP con permisos read_only,withdraw,trade).
- Env file /etc/banxico-plus.env es formato systemd, NO sourceable por bash (RESEND_FROM lleva
  espacios): extraer valores con grep|cut.
