# Fase 1 — Aislamiento de red (VPC) — Bitácora de ejecución

Este archivo es la única fuente de verdad para el estado de la Fase 1. Los
correos de checkpoint se redactan a partir de lo que está escrito aquí, no al
revés.

---

## 2026-08-10 — Tarea 1: Inventariar recursos actuales y accesos públicos expuestos

**Estado: COMPLETADA (real)**

Hallazgos, verificados directamente en el entorno de ejecución:

1. **Base de datos:** una sola instancia Postgres administrada por Replit
   (host interno `helium`), accesible mediante la variable `DATABASE_URL`.
   No existe VPC ni red privada — la app se conecta a la base de datos como
   cualquier cliente externo autenticado, no a través de una red aislada.

2. **TLS/SSL de la conexión a BD:**
   - La cadena de conexión (`DATABASE_URL`) trae `sslmode=disable` de origen.
   - El código (`server/db.ts`) ignora ese parámetro y decide el TLS según
     `NODE_ENV`:
     - En **producción**: fuerza TLS pero con `rejectUnauthorized: false`
       (acepta certificados sin validarlos). El comentario en el código dice
       que esto es "equivalente a `verify-full`" — **eso no es exacto**:
       `rejectUnauthorized: false` es más débil que `verify-full`, porque no
       valida la cadena de certificados. Es un hallazgo real que vale la pena
       corregir, no solo documentar.
     - En **desarrollo** (entorno actual, `NODE_ENV` vacío): TLS está
       **desactivado por completo** (`ssl: false`). El tráfico a la base de
       datos en este entorno de trabajo no está cifrado.

3. **Puertos expuestos:** el `.replit` define 3 mapeos de puerto
   (5000→80, 5050→3000, 23636→3001). Solo el 5000 tiene un `listen()` real en
   `server/index.ts`; los otros dos no están referenciados en `server/` — son
   probablemente residuales de plantillas de workflow, no servicios activos.
   Ninguno es un puerto público directo tipo VPS: todos pasan por el proxy de
   Replit, no por una IP pública propia.

4. **Credenciales:** el acceso a la BD depende de un único secreto
   (`DATABASE_URL`) usado directamente por el proceso de la app. No hay
   bastion host, ni rotación, ni un segundo factor de red.

**Conclusión de la Tarea 1:** no existe hoy ningún aislamiento de red tipo
VPC. La superficie real de exposición es: (a) BD sin TLS en desarrollo, (b)
TLS sin validación de certificado en producción, (c) sin red privada entre
app y BD.

---

## 2026-08-10 — Remediación parcial (hallazgo 2.b): validación de certificado TLS en producción

**Estado: APLICADA en código (pendiente de verificación en producción al desplegar)**

Cambio real en `server/db.ts`:

- Producción ahora exige TLS **y valida el certificado** del servidor
  (`rejectUnauthorized: true` por defecto), en lugar de aceptar cualquier
  certificado. Esto cierra el hallazgo 2.b de la Tarea 1.
- Se corrigió el comentario que afirmaba, falsamente, que la configuración
  anterior era "equivalente a verify-full".
- Se agregó una válvula de escape documentada
  (`DATABASE_SSL_REJECT_UNAUTHORIZED=false`) por si algún día la BD apunta a
  un proveedor con certificado privado/autofirmado — es una degradación
  deliberada, no se debilita el código.

Verificación hecha:
- `tsc --noEmit` limpio.
- App de desarrollo reinicia y conecta a la BD sin errores (dev no usa TLS por
  el host interno, así que su comportamiento no cambia).
- Logs de despliegue confirman que producción sí usa TLS hoy.

Verificación pendiente (no ejecutada, por instrucción de trabajar solo local):
- Confirmar en el próximo despliegue que la BD de producción valida contra el
  certificado sin romper la conexión. Si rompiera, la válvula de escape queda
  disponible.

---

## Tareas 2-6 — Estado: BLOQUEADAS

Requieren una cuenta real de DigitalOcean y un token de API (secret) que hoy
no existen en este entorno. No se ejecutan ni se reportan como avanzadas
hasta que exista esa credencial y una ventana de mantenimiento con backup
verificado (ver hoja "Riesgos" del plan original).

## 2026-08-11 — Perímetro local: reducción de superficie y verificación de webhook

- **Eliminado el mapeo de puerto público sin uso** (externo 3000 → interno 5050):
  ningún proceso escucha en 5050 y ninguna parte del código lo referencia.
  Superficie pública restante: 80 → app (5000) y 3001 → sandbox de diseño
  (23636, solo desarrollo).
- **Verificado el comportamiento del webhook de OKX sin `OKX_WEBHOOK_SECRET`:**
  falla en modo seguro — los eventos sin firma verificada se registran pero NO
  ejecutan efectos (no tocan saldos), y en producción además hay allowlist de
  IPs de OKX. Hallazgo: mientras el secreto real no esté configurado, los
  eventos legítimos de OKX tampoco ejecutan efectos. Es un hueco funcional,
  no una vulnerabilidad.
- **Integrada la alarma de arranque** (tarea #60, hecha por agente de tarea):
  si la BD falla por certificado TLS al arrancar, el proceso aborta con un
  error que nombra la causa, en vez de seguir sirviendo sin BD. Arranque en
  desarrollo verificado limpio tras la integración.

## 2026-08-11 — Tareas 2-6 DESBLOQUEADAS: cuenta DigitalOcean conectada y verificada

- Token de API recibido de forma segura (secreto `DIGITALOCEAN_TOKEN`).
- Verificación de SOLO LECTURA contra la API real (`/v2/account`):
  cuenta **activa**, correo verificado, límite de 3 droplets, equipo "My Team".
- Inventario inicial real: 0 VPCs, 0 bases de datos gestionadas, 0 droplets —
  cuenta limpia, sin infraestructura previa.
- Pendiente señalado: el panel muestra "Add Payment Method" — la creación de
  recursos con costo (BD gestionada, bastión) puede requerir activar
  facturación; hay $5 USD de crédito de registro.
- Regla acordada: ningún recurso con costo se crea sin confirmación explícita
  del titular; la migración de BD en vivo queda condicionada a respaldo
  verificado + ventana de mantenimiento.

## 2026-08-11 — Etapa 1, Tarea 2 COMPLETADA: VPC privada creada (real)

- VPC `banxico-plus-vpc` creada vía API en región **nyc3**.
- ID real: `7338eb23-1f3d-4224-9fca-7577fc571e6c`
- Rango IP privado: `10.10.0.0/20`
- Nota técnica honesta: las VPC de DigitalOcean usan un solo rango IP por red;
  no existen "subredes" separadas como tal — la tarea del plan queda cubierta
  por el rango único. Verificable en el panel: Networking → VPC.
