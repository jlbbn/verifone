# Threat Model — Infraestructura de pagos TRON (Banxico Plus)

> Documento de referencia de seguridad. Se centra en la ruta de dinero real:
> dispersión de USDT (TRC-20) en la red TRON a través de un firmante remoto
> aislado. Otras áreas de la app (auth, caja, brokers) tienen su propia
> superficie; aquí solo se cubre lo relacionado con TRON porque es donde una
> falla se traduce en pérdida irreversible de fondos.
>
> Última revisión: 2026-08-24 (ejercicio de escenarios de ataque, pre-activación
> mainnet). Escrituras mainnet aún DESHABILITADAS al momento de escribir.

## Project Overview

La app (Node/Express + PostgreSQL, desplegada en autoscale de Replit,
`banxicoplusllc.org`) dispersa USDT en TRON. La firma de transacciones NO ocurre
en la app: se delega a un **firmante remoto** (`scripts/infra/tron-signer/signer.mjs`)
que corre en un droplet aislado en la VPC de DigitalOcean, junto a un **nodo TRON
privado propio** (java-tron GreatVoyage v4.8.2.1, pinneado por SHA-256). Hay dos
entornos espejo: **Nile** (pruebas) y **mainnet** (dinero real).

Topología (VPC `banxico-plus-vpc`, 10.10.0.0/20):
- App (autoscale Replit) → cliente `server/crypto/tron-signer-client.ts`
- Firmante mainnet `10.10.0.5:9443` (mTLS + HMAC) — custodia la llave privada
- Nodo mainnet `10.10.0.4:8090` (RPC java-tron) — solo construir/difundir/consultar
- Espejo Nile: nodo `10.20.0.2`, firmante `10.20.0.4`

## Assets

- **Llave privada de la wallet mainnet** (`T9ymoq…`). Activo crítico. Vive SOLO
  en `TRON_SIGNER_PRIVATE_KEY` dentro de `/etc/tron-signer/tron-signer.env` del
  firmante mainnet. Su fuga = pérdida total e irreversible de los fondos de la
  hot wallet. Nunca sale del proceso: la app pide firmas, no la llave.
- **Fondos USDT de la hot wallet**. Aunque la llave no se filtre, un atacante que
  logre emitir transferencias autorizadas puede drenar hasta los límites
  configurados. Los límites por-tx y diarios acotan el daño máximo por ventana.
- **Secreto HMAC compartido** (`TRON_SIGNER_HMAC_SECRET`) y **certificados
  cliente mTLS**. Autentican a la app frente al firmante. Su fuga permite pedir
  transferencias hasta los límites (no exfiltra la llave, pero mueve dinero).
- **Estado de idempotencia del firmante** (`state.json`). Garantiza que un
  reintento no cree un segundo pago. Su corrupción podría habilitar doble gasto.
- **Registro de dispersiones** (`hot_wallet_dispersions` en Postgres). Fuente de
  verdad contable y de auditoría; también hace de candado de límite diario.
- **Credenciales de acceso**: llave SSH derivada (`DO_SSH_SEED`), token
  DigitalOcean (`DIGITALOCEAN_TOKEN`), token de logs. Dan control del plano de
  infraestructura (crear/borrar droplets, firewalls).

## Trust Boundaries

- **App ↔ Firmante** (`10.10.0.5:9443`): mTLS obligatorio (TLS 1.3, certificado
  cliente verificado) **más** firma HMAC por petición. La app es semi-confiable:
  aun autenticada, el firmante revalida intención, límites y salud del nodo.
- **Firmante ↔ Nodo TRON** (`10.10.0.4:8090`): el nodo construye y difunde, pero
  **no se confía en él**. El firmante valida byte a byte la transacción sin firmar
  contra la intención aprobada antes de firmar, y verifica identidad de cadena.
- **Firmante ↔ Internet**: egreso denegado por defecto (UFW OUTBOUND); solo
  nodo privado, DNS de DO, NTP y 443 para envío de logs.
- **Admin ↔ App**: las dispersiones se disparan desde rutas `requireRole("ADMIN")`.
  El admin autenticado es el actor de mayor privilegio en la ruta de dinero.
- **Operador ↔ Hosts**: acceso SSH por llave a los droplets. Da acceso al env que
  contiene la llave privada — es el límite más sensible del sistema.

## Scan Anchors

- Firma y política del firmante: `scripts/infra/tron-signer/signer.mjs`,
  `transaction-policy.mjs`, `network-profile.mjs`.
- Cliente app→firmante: `server/crypto/tron-signer-client.ts`.
- Política/guardas de la app: `server/crypto/tron-policy.ts`.
- Ruta de dispersión (límite diario + idempotencia): `server/routes.ts`
  (`POST` de dispersión con `pg_advisory_xact_lock`, ~línea 1170) y
  `GET /api/admin/tron/status` (~línea 882).
- Runbook operativo y checklist de activación: `docs/tron-node-runbook.md`.
- Reglas de red: `scripts/infra/tron-*/ufw.rules.example` y firewalls cloud de DO.
- Superficies: público (ninguna ruta TRON), admin (dispersión, status, evidencia),
  interno (firmante y nodo, solo dentro de la VPC).

## Escenarios de ataque (STRIDE + verdicto)

Cada escenario indica la amenaza, la defensa existente y el veredicto del
ejercicio del 2026-08-24. Los marcados **[verificado en vivo]** se probaron
contra el firmante mainnet real (candado cerrado) durante el ejercicio.

### Spoofing — impersonar a la app frente al firmante

**Ataque:** un atacante en la red intenta pedir una transferencia haciéndose
pasar por la app.
**Defensa:** doble autenticación. (1) mTLS: sin certificado cliente firmado por
la CA propia, el handshake TLS ni siquiera completa. (2) HMAC por petición sobre
`timestamp.nonce.body` con comparación en tiempo constante.
**Verdicto: CUBIERTO.** [verificado en vivo] Petición sin certificado cliente →
handshake rechazado (curl no obtiene respuesta). Petición con mTLS válido pero
sin firma HMAC → `401 Invalid authentication`.
**Guarantee:** toda escritura DEBE presentar mTLS válido **y** HMAC fresco y
correcto; ninguna de las dos por separado basta.

### Spoofing — nodo TRON falso o suplantado (eclipse)

**Ataque:** redirigir al firmante a un nodo controlado por el atacante que mienta
sobre el estado de la cadena para provocar firmas indebidas o falsos "éxitos".
**Defensa:** el firmante verifica identidad de cadena (genesis / `p2pVersion`),
antigüedad de la cabeza (`MAX_HEAD_AGE_MS`), y mínimo de peers activos
(`MIN_ACTIVE_PEERS`, por defecto 3). El nodo se fija por origen privado exacto
(`TRON_APPROVED_NODE_ORIGIN`), sin fallback público. Semántica fail-closed.
**Verdicto: CUBIERTO, con hallazgo operativo.** [verificado en vivo] `/health`
confirma `chainIdentityMatches:true` vía `p2pVersion=11111`. **Hallazgo:** al
correr el ejercicio el nodo reportaba `activePeers:1` (< 3) y aún sincronizando
(`headAgeMs` ~11 h) → `healthy:false`, escrituras bloqueadas por diseño. Correcto
como comportamiento, pero requiere vigilar la conectividad de peers antes de
activar.
**Guarantee:** el firmante NO DEBE firmar si identidad de cadena, antigüedad de
cabeza o número de peers no cumplen el umbral simultáneamente.

### Tampering — nodo devuelve una transacción sin firmar manipulada

**Ataque:** el nodo (comprometido o con MITM interno) devuelve una transacción
cuyo destino, monto o contrato difiere de lo aprobado, para desviar fondos.
**Defensa:** `validateUnsignedTransferTransaction` revalida byte a byte antes de
firmar: `txCheck` (el txid corresponde al protobuf), exactamente un contrato
`TriggerSmartContract`, `owner`/`contract`/`to`/`monto` exactos, calldata del
`transfer(address,uint256)` reconstruida y comparada, `call_value`/token en cero,
sin memo, `fee_limit` exacto, ventana de `timestamp`/`expiration` y TAPOS válidos.
**Verdicto: CUBIERTO.** Es la defensa central contra un nodo malicioso: aunque el
nodo mienta, una transacción que no coincide con la intención se rechaza antes de
la firma (`UNSIGNED_TRANSACTION_INTENT_MISMATCH`).
**Guarantee:** el firmante DEBE firmar únicamente una transacción cuyos campos
coincidan exactamente con `(owner, contrato, destino, monto)` aprobados.

### Tampering / EoP — manipular monto o límites desde la app

**Ataque:** cliente admin manipulado envía un monto arbitrario o intenta exceder
límites.
**Defensa:** montos parseados sin coma flotante (`parseUsdtAmount`, unidades
atómicas). Límite por-tx y **diario** aplicados en DOS capas: la app reserva el
cupo diario dentro de una transacción con `pg_advisory_xact_lock` (serializa
concurrentes) y el firmante impone su propio `MAX_PER_TX`/`MAX_DAILY` de forma
independiente. El límite efectivo es el menor de los candidatos configurados.
**Verdicto: CUBIERTO.** Defensa en profundidad: comprometer la app no salta el
límite del firmante.
**Guarantee:** ninguna ruta de escritura DEBE poder dispersar por encima del
menor límite configurado; el firmante nunca confía en el límite de la app.

### Elevation of Privilege — robo de la llave privada (host comprometido)

**Ataque:** el objetivo final del adversario — leer `TRON_SIGNER_PRIVATE_KEY`.
**Defensa:** la llave nace y vive solo en el host firmante; el env es `600/640`
(solo root y el servicio). La app nunca la recibe. La guarda
`legacyLocalSigningKeyPresent` impide escribir si `PLATFORM_TRON_PRIVATE_KEY`
sigue presente en el entorno de la app. Egreso del firmante denegado por defecto
(exfiltración dificultada). Acceso al host solo por SSH con llave.
**Verdicto: RESIDUAL — el nodo/host firmante es el punto único de mayor valor.**
Quien obtenga root en el firmante puede leer la llave. Mitigaciones vigentes:
aislamiento de red, superficie mínima, egreso restringido, imagen pinneada.
**Guarantee:** la llave privada NUNCA DEBE transmitirse fuera del proceso
firmante, aparecer en logs, ni copiarse a un dispositivo o chat. Rotación/backup
solo por ceremonia controlada en el propio host.

### Repudiation / doble gasto — reintentos y concurrencia

**Ataque:** provocar un segundo pago vía reintentos, condición de carrera, o
crash a mitad de la difusión.
**Defensa:** idempotencia de extremo a extremo. La app deduplica por
`idempotencyKey` en DB bajo advisory lock. El firmante persiste la transacción
**firmada** y su txid determinista en estado `prepared` ANTES de difundir; un
reintento solo puede redifundir esos mismos bytes (mismo txid), nunca crear un
segundo pago. Conflictos de huella → `IDEMPOTENCY_CONFLICT`. Reconciliación de
`prepared` al reiniciar.
**Verdicto: CUBIERTO.** [verificado en Nile] El ensayo prueba explícitamente que
un segundo POST idéntico responde `duplicate:true`.
**Guarantee:** un `idempotencyKey` DEBE producir como máximo una transferencia
on-chain, aun ante reintentos, reinicios o difusión concurrente.

### Repudiation — liquidación falsa (broadcast ≠ confirmado)

**Ataque:** tratar como "pagado" algo que la cadena no confirmó, o confirmar un
pago hacia un destino/monto distinto.
**Defensa (política):** el estado `broadcast` NO es liquidación. Una dispersión
solo se marca liquidada con recibo on-chain `SUCCESS` + evento `Transfer` exacto
(fuente, destino, contrato, monto atómico). Ver runbook, checklist punto 4.
**Verdicto: CUBIERTO por diseño; RE-VERIFICAR en el wiring mainnet** — este
consumo vive en la capa de la app y debe validarse cuando se conecte mainnet.
**Guarantee:** ninguna dispersión DEBE contarse como liquidada sin recibo
`SUCCESS` y evento `Transfer` que coincida exactamente con la intención.

### Denial of Service — saturar el firmante o el nodo

**Ataque:** agotar recursos del firmante (1 vCPU / 1 GB) o del nodo para frenar
pagos.
**Defensa:** cuerpo máximo 32 KB, `requestTimeout`/`headersTimeout`, timeouts en
todas las llamadas salientes al nodo, procesamiento serializado, límite de tamaño
de respuesta en el cliente. Puerto del firmante accesible solo desde la app
(firewall). El nodo `8090` solo desde firmante y app.
**Verdicto: CUBIERTO contra abuso externo** (superficie no alcanzable desde
internet). Riesgo residual de capacidad: un DoS solo frena pagos temporalmente;
no arriesga fondos. Un nodo caído deja el sistema fail-closed (no firma).
**Guarantee:** la indisponibilidad del nodo o firmante DEBE bloquear escrituras,
nunca degradarlas a un modo inseguro.

### Information Disclosure — fuga de secretos en logs/errores

**Ataque:** exfiltrar llave, HMAC o direcciones vía logs o mensajes de error.
**Defensa:** logs estructurados con dirección enmascarada (`maskAddress`), sin
llave ni HMAC; errores públicos con códigos acotados (`safeErrorCode`), sin
stack traces; `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
**Verdicto: CUBIERTO.**
**Guarantee:** ningún log ni respuesta DEBE contener material de llave, secreto
HMAC ni direcciones completas más allá de lo estrictamente necesario.

### EoP — cuenta admin comprometida (el riesgo más realista tras la activación)

**Ataque:** con la llave aislada y la red endurecida, la vía práctica para mover
fondos es a través de una sesión admin legítima comprometida (phishing, sesión
robada, credencial reutilizada) disparando dispersiones dentro de los límites.
**Defensa:** rutas `requireRole("ADMIN")`; límites por-tx y diario acotan el daño
por ventana; todo pago queda registrado y auditable; el destino de cada tx queda
on-chain. Ver también las tareas abiertas del proyecto sobre invalidación de
sesión y persistencia de cambios de contraseña.
**Verdicto: RESIDUAL — principal foco tras activar mainnet.** Recomendado antes
de subir límites: MFA/refuerzo del login admin, expiración e invalidación robusta
de sesión, alerta en tiempo real por cada dispersión, y arranque con límites
diarios conservadores.
**Guarantee:** el daño máximo a
acotado por el límite diario y ser detectable de inmediato por alerta y auditoría.

### Tampering (supply chain) — binario o dependencia envenenada

**Ataque:** sustrajeton el binario java-tron o una dependencia por una versión
maliciosa que filtre la llave o altere transacciones.
**Defensa:** imagen java-tron pinneada por SHA-256 (v4.8.2.1); snapshot con MD5
verificado; `tronweb` fijado (decisión: no actualizar hasta post-activación).
**Verdicto: CUBIERTO para el binario del nodo; mantener disciplina de pinning**
en dependencias del firmante y revisar CVEs antes de cada upgrade.
**Guarantee:** ningún componente en la ruta de firma DEBE actualizarse sin fijar
y verificar su hash y revisar notas de seguridad (procedimiento del runb

### EoP (plano de infraestructura) — token DO / llave SSH comprometidos

**Ataque:** con `DIGITALOCEAN_TOKEN` o la llave SSH,después del droplet de tron firewalls,
abre puertos, o accede a perfiles antiguos **Defensa:** secretos gestionados por Replit, nunca impresos; llave SSH derivada
en caliente y borrada entre usos; firewall cloud + UFW; auto-alta de IP del
operador solo temporal.
**Verdicto: RESIDUAL — proteger estos secretos equivale a proteger todo el
plano.** Recomendado: rotación periódica del token DO y de la semilla SSH, y
revisión de que ninguna IP amplia quede permitida de forma permanente.
**Guarantee:** los secretos del plano de infraestructura NUNCA DEBEN imprimirse,
persistirse en el repo, ni compartirse por chat.

## Resumen de veredictos

- **CUBIERTO (verificado):** spoofing app→firmante (mTLS+HMAC), doble gasto/
  idempotencia, tamperado de tx sin firmar, límites en dos capas, fail-closed por
  salud del nodo, no-disclosure en logs.
- **RESIDUAL (foco antes/después de activar mainnet):**
  1. **Cuenta admin comprometida** — reforzar login/sesión + alertas + límites
     conservadores al inicio.
  2. **Compromiso del host firmante** — punto único de la llave; mantener
     aislamiento, superficie mínima y considerar rotación/custodia offline.
  3. **Secretos del plano DO/SSH** — rotación y disciplina de no exposición.
  4. **Liquidación on-chain** — re-verificar en el wiring mainnet que solo
     `SUCCESS` + evento `Transfer` exacto marca liquidado.
- **HALLAZGO OPERATIVO (2026-08-24):** el nodo mainnet reportó `activePeers:1`
  (< mínimo 3) y seguía sincronizando; correcto que bloquee escrituras, pero hay
  que estabilizar peers y terminar la sincronización antes de activar.
