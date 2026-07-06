---
name: Caja multi-currency ingestion from real transactions
description: How /api/caja/summary derives cash-register totals from the transactions table, and gotchas around currency/protocol field conventions.
---

Caja (cash register) balances are computed live in `GET /api/caja/summary` by merging two sources: completed transactions of ingreso-eligible types (`CAJA_INGRESO_TX_TYPES` in `shared/schema.ts`) converted to USD via `convertToUSD()`, plus manually-entered `cajaMovements` rows. There is no persisted "caja transaction" table for transaction-derived rows — they're computed on every request.

**Why:** Previously Caja only showed manually-entered movements, so real POS/SR-Link transactions (especially non-MXN ones) never appeared. Recomputing from the transactions table on read keeps it always in sync without dual-writing.

**How to apply / gotchas:**
- Drizzle `decimal(...)` columns (e.g. `transactions.amount`) come back as **strings** at the JS/TS level, not numbers — always `Number(tx.amount)` before arithmetic or passing to a numeric-typed helper, or `tsc` will flag it (or worse, string concatenation bugs at runtime).
- The `protocol` field is stored inconsistently across creation paths: the main POS flow stores bare codes like `"201.3"`, but the SR-Link flow prefixes with `"P"` (e.g. `"P201.3"`). Any classification logic keyed on protocol prefix must strip leading non-digit characters first (`tx.protocol?.replace(/^\D+/, "")`) or it will silently miscategorize SR-Link rows.
- The POS terminal's main payment form (protocol 201.x) has no currency selector and always sends `currency: "MXN"` to the backend; only the SR-Link form exposes a currency picker (EUR/USD/MXN/GBP). Keep this in mind when reasoning about which flow produces which currency.
