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

## Tareas 2-6 — Estado: BLOQUEADAS

Requieren una cuenta real de DigitalOcean y un token de API (secret) que hoy
no existen en este entorno. No se ejecutan ni se reportan como avanzadas
hasta que exista esa credencial y una ventana de mantenimiento con backup
verificado (ver hoja "Riesgos" del plan original).
