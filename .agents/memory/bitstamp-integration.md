---
name: Bitstamp integration
description: Bitstamp API v2 auth quirks, sandbox limits, and the trading kill-switch convention
---

# Bitstamp integration — durable facts (verificado contra doc oficial + en vivo, ago 2026)

## Auth v2 (esquema por headers — el único válido para llaves nuevas)
- Firma: HMAC-SHA256 hex minúsculas de `"BITSTAMP " + api_key + verbo + host + path + query + Content-Type + nonce + timestamp + "v2" + body`.
- **Content-Type se omite del mensaje Y de los headers cuando no hay cuerpo** (error API0020 si se envía).
- Nonce: 36 chars minúsculas (UUID v4), un solo uso por 150 s. Timestamp: UTC ms, ventana ±150 s (API0017).
- El esquema v1 (nonce+customer_id en el cuerpo POST) está obsoleto; `customer_id` ya no se requiere para credenciales.

## Trampas de la API
- La doc actual NO documenta `/api/v2/balance/` — el endpoint tipado como lista `{currency,total,available,reserved}` es `/api/v2/account_balances/`. El cliente viejo apuntaba a `/balance/` con tipos de `account_balances` (mismatch real encontrado en auditoría).
- Cotiza contra **USD, no USDT**; sin red TRC-20 para retiros USDT (solo ERC-20).
- Sandbox oficial `https://sandbox.bitstamp.net`: endpoints públicos responden sin llaves; mercado ficticio con pares de poca liquidez (varios en 0.00). **No existe WebSocket sandbox** — el único WS es `wss://ws.bitstamp.net` (producción).

## Convención del proyecto: doble candado de trading
- El ejecutor de swaps exige `BITSTAMP_TRADING_ENABLED=true` ADEMÁS de credenciales para elegir Bitstamp (default: apagado).
- **Why:** llaves de sandbox configuradas para pruebas del panel admin no deben poder rutear swaps reales del producto por accidente.
- **How to apply:** cualquier trabajo futuro que "active" Bitstamp debe prender ese flag conscientemente, no solo poner llaves. Selección de entorno: `BITSTAMP_URL` explícita gana; si no, `BITSTAMP_ENV=sandbox`; default producción.
