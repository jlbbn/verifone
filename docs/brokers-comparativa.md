# Comparativa de brokers — 12 agosto 2026

Enfocada en lo que la plataforma realmente hace con los brokers:
swaps BTC/ETH ↔ USDT (puente de 2 patas: cada swap paga 2 comisiones taker)
y retiros/dispersiones de USDT por red TRON (TRC-20).

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
