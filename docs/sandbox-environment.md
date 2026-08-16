# Entorno sandbox (banxico-plus-app-sandbox) — en qué se diferencia de producción

Última actualización: 2026-08-16 (tarea de aislamiento tras el incidente de seguridad del 16-ago-2026).

## Servidores

| | Producción | Sandbox |
|---|---|---|
| Droplet | `banxico-plus-app` (165.227.125.34) | `banxico-plus-app-sandbox` (138.197.79.6) |
| Base de datos | Postgres gestionado `banxico-plus-db` (host privado de la VPC, TLS verify-full con la CA del clúster) | **Postgres 16 local en el propio droplet** (`banxico_sandbox@localhost`, TLS con certificado propio CN=localhost verificado vía `NODE_EXTRA_CA_CERTS`) |
| Datos | Datos reales de clientes | Solo datos semilla generados por `storage.initialize()` al arrancar |
| Secretos de broker/pago | Llaves reales (OKX, Stripe live, TRON, Mercado Pago, Resend) | **Ninguno.** El archivo de entorno solo contiene `DATABASE_URL` local, `SESSION_SECRET` propio, `OKX_WEBHOOK_SECRET` propio (aleatorio, no coincide con el de OKX) y `SANDBOX_ENV=1` |
| Dominio | banxicoplusllc.org (tras el cutover) | Sin dominio; Caddy sirve por IP en :80 |
| Firewall DO | Según plan de compliance | **80/443 cerrados a toda IP.** Solo SSH 22 (llave derivada). Firewall DO `sandbox-restricted` (id `2907a33f-40bb-411e-aa43-7031e12d39f0`) |

## Comportamiento esperado en el sandbox

- **Stripe / Mercado Pago / Resend / TRON / OKX privado:** cualquier operación que
  los necesite falla con un error explícito ("No valid Stripe key found",
  "MP_ACCESS_TOKEN no configurado", etc.). Esto es intencional: el sandbox no
  puede mover dinero real ni enviar correos reales. Los precios públicos de OKX
  (API pública sin firma) siguen funcionando.
- **Base de datos:** cualquier escritura toca solo la copia local. Borrar y
  recrear la base (`DROP DATABASE banxico_sandbox` + `drizzle-kit push` +
  reiniciar el servicio) devuelve el sandbox a estado limpio.
- El archivo de entorno es `/etc/banxico-plus.env` (root, 600). La contraseña
  de la BD local está en `/root/.sandbox-db-pw`. Ya **no existe** ninguna copia
  de los secretos de producción en este droplet.

## Si algún día se necesitan credenciales de prueba

Usar llaves *dedicadas de sandbox* (Stripe `sk_test_...`, cuenta demo de OKX,
wallet TRON de testnet) — nunca las llaves reales de producción.

## Historia

Hasta el 16-ago-2026 este droplet compartía la BD gestionada de producción y
las llaves reales de broker/pago (decisión anterior del titular). Tras el
incidente de seguridad de esa fecha, el titular revirtió esa decisión y se
aisló el entorno por completo.
