---
name: Bitstamp integration
description: Bitstamp API v2 auth quirks and sandbox limitations not obvious from docs or code
---

# Bitstamp — lecciones durables de la API externa

- Auth v2 por headers: el mensaje firmado OMITE Content-Type cuando no hay cuerpo, y el header tampoco debe enviarse en ese caso (error API0020). Nonce de 36 chars en minúsculas, un solo uso; timestamp UTC ms con ventana ±150 s.
- La doc oficial ya NO documenta `/api/v2/balance/`; el endpoint cuya respuesta es la lista `{currency, total, available, reserved}` es `/api/v2/account_balances/`. Cuidado con clientes viejos que apuntan a `/balance/` con los tipos del nuevo (mismatch real encontrado en auditoría).
- No existe WebSocket de sandbox: el único feed WS es el de producción. El sandbox REST (`sandbox.bitstamp.net`) responde endpoints públicos sin llaves, pero es un mercado ficticio con pares casi sin liquidez (varios marcan 0.00).
- Bitstamp cotiza contra USD (no USDT) y no ofrece red TRC-20 para retiros de USDT (solo ERC-20) — apto solo como respaldo, no como ruta principal de dispersión.
- Convención del proyecto: elegir Bitstamp para swaps exige un flag de entorno explícito ADEMÁS de credenciales (doble candado en el ejecutor de brokers). **Why:** llaves de sandbox configuradas para pruebas jamás deben poder rutear operaciones reales por accidente.
