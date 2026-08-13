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
