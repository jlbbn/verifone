# Comparativa de brokers — 12 agosto 2026

Enfocada en lo que la plataforma realmente hace con los brokers:
swaps BTC/ETH ↔ USDT (puente de 2 patas: cada swap paga 2 comisiones taker)
y retiros/dispersiones de USDT por red TRON (TRC-20).

OKX esta bloqueado/por vulneracion de claves 

Cybrid excluido a petición del usuario (además no es exchange: es banca-como-servicio).

## Resumen

| Casa | Maker/Taker (nivel base) | Costo real por swap (2 patas taker) | Retiro USDT por TRON | Estado en nuestro código |
|---|---|---|---|---|
| **OKX** | 0.08% / 0.10% | **0.20%** | **1 USDT** (mín. 2) | **Principal — probado en producción y desde el servidor nuevo** |
| **Binance** | 0.10% / 0.10% | 0.20% | 1 USDT (mín. 10) | Cliente escrito; falta el API secret del usuario |
| **Kraken** | 0.25% / 0.40% (mejora con volumen: 0.12/0.22 a $125k/30d) | 0.80% | 2.50 USDT (mín. 5) | Respaldo integrado (inactivo) |
| **Bitstamp** | 0.30% / 0.40% (<$10k/30d) | 0.80% | **Sin red TRON** (retiros USDT por redes caras, ~$5–20) | No existe; integración nueva 2–4 h |

## Lectura honesta

1. **OKX ya es la opción más barata** en las dos dimensiones que importan (swap y retiro TRON),
   y es la única probada de punta a punta: firma verificada contra el API real desde la IP del
   servidor nuevo el 12-08-2026.
2. **Bitstamp es la más cara para nuestro flujo** (4× el costo por swap) y no tiene TRC-20:
   las dispersiones USDT saldrían por Ethereum a $5–20 por transacción vs $1 actual.
   Integrarla hoy no aporta ventaja operativa.
3. **Si se quiere un respaldo activo**, la reintegración lógica es **Binance**: mismo costo
   que OKX, el cliente ya está escrito y solo falta el secret (la llave pública ya está en secrets).
4. Kraken se queda como está: respaldo funcional, más caro, útil solo si OKX y Binance fallan.

## Fuentes (consultadas 12-08-2026)

- OKX fees: okx.com/fees (VIP0 spot 0.08/0.10)
- Bitstamp: bitstamp.net/fee-schedule (tier <$10k: 0.30/0.40; página sin mención de TRON/TRC-20)
- Kraken: support.kraken.com "how trading fees work" (0.25→-0.02% maker, 0.40→0.10% taker por volumen)
- Binance: VIP0 0.10/0.10 (0.075 con descuento BNB)
- Retiros TRC-20: eco.com comparativa 2026 (Binance/OKX 1 USDT, Kraken 2.50, Bitstamp ausente)

Las comisiones cambian; re-verificar antes de cualquier decisión definitiva.
Requisitos de cuenta corporativa por país: verificar directamente con cada casa (no afirmado aquí).

## Brokers con rieles EUR (fiat) — 13 agosto 2026

Búsqueda separada: casas que reciben/entregan **euros reales** (SEPA u otro riel bancario europeo),
no solo pares EUR de cotización. Relevante si se piensa aceptar o dispersar en EUR en algún momento.

| Casa | Riel EUR | Comisión depósito EUR | Comisión trading (nivel base) | Retiro EUR | API | Estado en nuestro código |
|---|---|---|---|---|---|---|
| **Bitvavo** (NL) | SEPA nativo | Gratis (SEPA normal) | **0.15% / 0.25%**, baja hasta 0%/0.02% con volumen | Gratis (SEPA normal) | REST + WebSocket, documentada | No integrado |
| **Bitstamp** (LU, de Robinhood) | SEPA nativo (instant y normal) | Gratis a bajo costo según método | 0.30–0.40% en el nivel base, mejora con volumen | Gratis a bajo costo | v2 REST | **Ya construido** (respaldo #3, ver arriba) |
| **Kraken** | SEPA nativo | Gratis/variable según método | 0.25% / 0.40% en el nivel base (Pro), mejora con volumen | Variable según método | REST | **Ya construido** (respaldo #2) |
| **Bit2Me** (ES) | SEPA nativo | **1.99%** del depósito | No verificado en este pase | Gratis por transferencia bancaria | REST documentada | No integrado |
| **Binance** | SEPA (EUR/GBP) | Gratis vía SEPA | 0.10% / 0.10% (baja con volumen y BNB) | Gratis/variable | REST | Cliente ya escrito para USDT; falta secret |
| OKX (referencia, el principal actual) | Sin riel EUR fuerte — es cripto-a-cripto | — | 0.08% / 0.10% | — | REST | Principal en producción |

### Lectura honesta

1. **Bitvavo es la opción más barata y nativa en EUR** de todo el grupo: comisión de trading más baja
   que Kraken y Bitstamp en el nivel base, SEPA gratis en ambos sentidos, y API documentada. Es el
   candidato lógico si en algún momento se necesita aceptar o dispersar en euros reales — hoy no está
   integrado.
2. **Bit2Me es la más cara para fondear en EUR** (1.99% solo por el depósito), a pesar de ser española
   y con soporte en español — no conviene como riel principal de entrada de euros.
3. **Kraken y Bitstamp ya están integrados como respaldos** en la cadena de brokers y ambos tienen
   soporte EUR/SEPA real, así que ya hay dos rutas EUR construidas sin trabajo adicional — la limitación
   actual es que ambos siguen inactivos (sin uso real en el flujo) porque OKX cubre todo el volumen hoy.
4. **OKX, el broker principal actual, no tiene riel EUR fuerte** — es una casa cripto-a-cripto. Si el
   negocio necesita mover euros de verdad (no solo USDT), OKX no resuelve eso por sí solo.
5. Ninguna cifra aquí es definitiva de cuenta corporativa/KYC empresarial — falta verificar requisitos
   de onboarding B2B con cada casa antes de decidir.

### Fuentes (consultadas 13-08-2026)

- Bitvavo: bitvavo.com/en/fees (tabla de tiers EUR)
- Bitstamp: bitstamp.net/fee-schedule (tiers maker/taker y spread SEPA)
- Kraken: kraken.com/features/fee-schedule, support.kraken.com "how trading fees work on Kraken"
- Bit2Me: bit2me.freshdesk.com "Fees and Limits for Euro and Cryptocurrency Deposits and Withdrawals"
- Binance: binance.info/en/fee/cryptoFee, binance.com FAQ SEPA/Faster Payments

## Desglose de opciones + enrutamiento compatible — 13 agosto 2026

Punto importante de arquitectura: `broker-executor.ts` hoy resuelve **un solo problema** —
swap cripto↔cripto (puente USDT) y dispersión de USDT por TRC-20. Es una cadena de prioridad
(`OKX → Kraken → Bitstamp → interno`) pensada para ese único flujo. **Ninguna casa EUR resuelve
lo mismo**: aceptar/entregar euros reales es un flujo distinto (fiat on/off-ramp vía SEPA), con
su propia cola, KYC y reconciliación contable. Por eso el enrutamiento no puede ser "una sola
cadena" — son dos cadenas independientes que comparten casas de bolsa donde coinciden.

### Cadena 1 — swap/dispersión cripto (ya existe, sin cambios necesarios)

`OKX → Kraken → Bitstamp → interno`. Bitvavo, Bit2Me o Binance podrían añadirse aquí como
respaldos adicionales (todas permiten trading cripto), pero no aportan ventaja real: ninguna
baja del costo de OKX, y Binance ya está a medio integrar (solo falta el secret) si se quiere
un respaldo #2 más barato que Kraken.

### Cadena 2 — riel EUR (fiat), no existe todavía

Este es el flujo nuevo que habría que construir si el negocio empieza a mover euros reales
(depósito de usuario en EUR → conversión a cripto/USDT, o al revés para retiros). Propuesta de
enrutamiento por compatibilidad real con lo ya construido:

| Prioridad | Casa | Rol | Por qué esta posición |
|---|---|---|---|
| **1 — principal EUR** | **Bitvavo** | Recibe/envía EUR por SEPA, ejecuta el swap EUR→cripto | Más barata (0.15%/0.25% baja con volumen), SEPA gratis, API documentada. Ningún cliente escrito todavía. |
| **2 — respaldo EUR** | **Kraken** | Mismo rol si Bitvavo falla o está fuera de límites | Ya integrado en el proyecto (cliente existe), soporta SEPA, solo falta activar el flujo EUR (hoy el cliente solo se usa para el swap USDT). |
| **3 — respaldo EUR** | **Bitstamp** | Mismo rol, último recurso | Ya integrado, SEPA nativo, pero su trading fee base es el más caro del grupo EUR. |
| — no recomendado | Bit2Me | — | 1.99% solo por depositar EUR lo saca de competencia como riel principal o de respaldo. Serviría solo si se necesita presencia regulatoria española específica, no por costo. |
| — evaluar aparte | Binance | — | Fees más bajos que Bitvavo en trading, pero requiere revisar restricciones regulatorias EUR/MiCA por país antes de meterlo a una cadena fiat; no evaluado en este pase. |

### Compatibilidad técnica con el código actual

- El patrón de cliente (`*-client.ts` con auth, `ping()`, `hasPrivateCredentials()`) es reusable
  tal cual para Bitvavo — mismo molde que OKX/Kraken/Bitstamp.
- `broker-executor.ts` tendría que ganar una **segunda función de ejecución** (p. ej.
  `executeEurRoute`) separada de `executeViaOKX/Kraken/Bitstamp`, con su propia cadena de
  prioridad — no se debe mezclar con la cadena cripto porque resuelven objetivos distintos
  (una mueve USDT entre exchanges, la otra debe reconciliar depósitos/retiros bancarios en EUR).
- Nada de esto está construido todavía; es la ruta recomendada si se decide avanzar.

## Corrección + arquitectura de dos brokers por región — 13 agosto 2026

Verifiqué contra fuentes oficiales la propuesta de arquitectura "un broker por zona monetaria"
(Bit2Me para EUR/Europa, Bitso para USD/MXN México) que surgió de otra conversación externa.
Corrijo aquí mi lectura anterior de Bit2Me, que era incompleta.

### Corrección sobre Bit2Me

Antes dije que Bit2Me "sale de competencia" por su comisión de depósito EUR del 1.99%. Esa cifra
es la **tarifa retail** (app de consumidor). Bit2Me tiene un producto B2B separado, **Full API**,
con su propio modelo de cuentas — y **no publica una tarifa institucional pública**, así que el
1.99% retail no debe usarse para descartarlo en un contexto B2B. Este vacío de información ya lo
señalaron en la otra conversación como pendiente de verificar en una llamada comercial — coincido,
es el paso correcto antes de decidir.

Verificado directamente en fuentes oficiales de Bit2Me (13-08-2026):

| Afirmación | Verificación |
|---|---|
| CASP autorizado por la CNMV bajo MiCA | **Confirmado** — Bit2Me (Bitcoinforme S.L.) fue la primera fintech hispanohablante autorizada como CASP bajo MiCA por la CNMV, 31-oct-2025. |
| API solo REST + WebSocket, sin FIX | **Confirmado** — bit2me.com/api: "Access the functionalities... through RESTful JSON APIs and Websocket." No se menciona FIX en ningún lado. |
| Cuentas omnibus o individuales en el modelo Full API | **Confirmado** — blog oficial de Bit2Me: "the possibility of creating omnibus or individual accounts" es parte explícita del modelo Full API. |
| Repos públicos en GitHub con SDKs JS/TS listos | **Parcialmente inexacto** — la propia página bit2me.com/api dice "Official SDKs (**coming soon**)" incluyendo el ícono de Node.js, es decir, todavía no hay SDK oficial de producción. Existe un repo comunitario (`bit2me-dev/bit2me-api-node-tool`, 3 estrellas) pero es pequeño y no se puede asumir listo para producción. |
| Auth simple API Key + Secret sin esquema de nonce | No verificado en este pase — requiere revisar la documentación de autenticación en api.bit2me.com directamente antes de comprometerse. |

### Sobre Bitso (lado USD/MXN)

Bitso es una Institución de Tecnología Financiera (ITF) regulada en México bajo la Ley Fintech,
con supervisión de CNBV/Banxico — consistente con la afirmación "ya regulado" de la otra
conversación. Bitso Business ofrece rieles de pago (SPEI, cross-border) vía API, relevante para
el lado MXN/USD de una arquitectura de dos brokers. No verifiqué en este pase su cobertura real
de USD retail en EE.UU. (la otra conversación ya señaló esto como pendiente, y coincido).

### Lectura honesta actualizada

1. La arquitectura de dos brokers por zona monetaria (Bit2Me EUR/Europa + Bitso USD/MXN) es
   **más sólida regulatoriamente** que forzar a Bitvavo o Kraken a cubrir todo: cada uno está
   autorizado en la jurisdicción donde opera.
2. Antes de comprometerse hay que resolver los mismos 3 pendientes que ya identificó la otra
   conversación: (1) tarifa institucional real de Bit2Me, (2) límites del WebSocket, (3) cómo
   se cubre USD retail en EE.UU. si Bitso Business no llega ahí completo.
3. Recomiendo la llamada comercial con Bit2Me antes de escribir código — el 1.99% retail no debe
   usarse para presupuestar, y sin la tarifa real no se puede comparar de forma justa contra
   Bitvavo.

## Plan de resolución de riesgos técnicos — Bitstamp — 13 agosto 2026

Corrección: los 4 riesgos de la sección anterior son sobre **Bitstamp**, no Bit2Me — Bitstamp es
el que ya tenemos parcialmente construido (`server/crypto/bitstamp-client.ts`, respaldo #3 en
`broker-executor.ts`), así que aquí sí hay trabajo hecho que reduce el tiempo real restante.
Verifiqué las 4 incógnitas contra la documentación oficial de Bitstamp (bitstamp.net/api,
bitstamp.net/fix/v2, bitstamp.net/websocket/v2):

| # | Riesgo | Verificación / qué falta | Tiempo estimado |
|---|---|---|---|
| 1 | **FIX v2.3 vs WebSocket v2** | **Confirmado que ambos existen por separado**: Bitstamp tiene un "Public FIX Interface v2" (acceso solo por contacto con soporte, pensado para trading institucional de baja latencia) además de su WebSocket API v2 (datos de mercado y cuenta en tiempo real). Nuestro cliente ya usa REST v2 + está pensado para WS v2 — **no hay razón para meter FIX** salvo que el volumen futuro lo justifique. Falta decidirlo formalmente y, si se descarta FIX, no hay trabajo técnico aquí. | **0.5 h** (decisión y nota en el doc, ya sin llamada pendiente porque la doc pública lo confirma) |
| 2 | **Modelo de cuentas separadas (sin atómica)** | Bitstamp ya es un broker independiente en la cadena de respaldo (`OKX → Kraken → Bitstamp → interno`) — nunca hubo atomicidad entre casas, la cadena ya asume fallback secuencial, no transacción conjunta. Lo que falta es confirmar que el manejo de "el swap se ejecutó en Bitstamp pero el retiro falló" está cubierto igual que en los otros brokers de la cadena. | **1.5 h** — revisar `broker-executor.ts` y confirmar que el mismo patrón de rollback/registro que usan OKX/Kraken aplica sin cambios a Bitstamp |
| 3 | **Manejo estricto de nonces y firmas** | **Ya resuelto en código**: `bitstamp-client.ts` ya implementa HMAC-SHA256 sobre `nonce + customer_id + api_key` con nonce por `Date.now()` (el bug de nonce reutilizado ya se corrigió en el diseño). Lo único pendiente es la prueba con credenciales reales, que sigue bloqueada hasta que generes `BITSTAMP_API_KEY` / `BITSTAMP_API_SECRET` / `BITSTAMP_CUSTOMER_ID`. | **1 h** (prueba real de firma) — bloqueada por credenciales, no por diseño |
| 4 | **Límites de conexión del WebSocket** | Verificado en fuentes de rate limits de Bitstamp: **400 solicitudes/segundo** compartidas entre REST y WebSocket, con ráfaga máxima de **10,000 solicitudes por ventana de 10 minutos**. Falta implementar un wrapper de reconexión/backoff para el WebSocket antes de depender de él para precios en tiempo real (hoy el cliente solo hace llamadas REST puntuales, no mantiene conexión WS persistente). | **2 h** (wrapper de reconexión + manejo de límite) |

**Total estimado: ~5 horas** (bajó de la estimación inicial porque nonces/firma y la decisión de
FIX ya están resueltos o casi resueltos). De eso, **1 hora sigue bloqueada por las credenciales
reales** (punto 3); las otras ~4 horas (decisión FIX, revisión de rollback, wrapper de WebSocket)
se pueden hacer ya, sin esperar nada del usuario.

### Ejecutado — 13 agosto 2026

- **#1 FIX v2.3 vs WebSocket v2 — decidido**: el proyecto se construye sobre REST v2 + WebSocket
  v2. No se integra FIX; es una capa de baja latencia pensada para trading institucional de alto
  volumen que no aporta nada al patrón actual (swap ocasional + respaldo de última instancia).
  Se revisita solo si el volumen algún día lo justifica.
- **#2 Cuentas separadas sin atómica — confirmado**: revisé `broker-executor.ts` — Bitstamp ya
  sigue exactamente el mismo patrón de try/catch secuencial que OKX y Kraken (si el swap o el
  retiro fallan, se registra el error y se intenta el siguiente broker de la cadena; no hay
  transacción conjunta entre casas, nunca la hubo). No requirió cambios de código.
- **#4 Límites del WebSocket — resuelto**: `server/crypto/bitstamp-websocket.ts` (nuevo)
  implementa un cliente con reconexión por backoff exponencial (1 s → 30 s), detección de
  conexión muerta por ausencia de heartbeat (20 s) y reseteo del backoff tras una reconexión
  exitosa — para no entrar en bucles agresivos de reconexión que choquen contra el límite de
  400 solicitudes/segundo. Compila limpio (`tsc --noEmit`); todavía no está conectado a ningún
  flujo en producción (es infraestructura lista para cuando se necesite streaming de precios).
- **#3 Nonces y firmas — sigue bloqueado por credenciales**, sin cambios (ver arriba).

### Fuentes verificadas de Bitstamp (13-08-2026)

- bitstamp.net/api/ (HTTP API, request limits)
- bitstamp.net/fix/v2/ (Public FIX Interface v2 — acceso por contacto con soporte)
- bitstamp.net/websocket/v2/ (WebSocket API v2)
- apis.io/rate-limits/bitstamp/rate-limits (400 req/s, ráfaga 10,000/10min — fuente agregadora, no oficial; confirmar contra la doc propia de Bitstamp antes de programar contra ese número si el volumen es alto)

### Fuentes adicionales (consultadas 13-08-2026)

- casplist.eu/casp/bit2me-9598007r, thecryptoregister.com/eu/exchange/bit2me, prnewswire.com (autorización CASP/MiCA)
- bit2me.com/api, blog.bit2me.com "How Do the Different Bit2Me Crypto API Integration Models Work" (Full API, omnibus/individual, SDKs "coming soon")
- github.com/bit2me-dev/bit2me-api-node-tool (repo comunitario, 3 estrellas)
- bitso.com, business.bitso.com (Bitso Business, SPEI/cross-border)
