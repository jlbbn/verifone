---
name: Per-user multi-asset crypto balances architecture
description: How internal (non-blockchain) crypto balances are modeled, kept atomic, and exposed to admins — mirrors the per-user caja pattern but generalized to N assets.
---

# Per-user multi-asset crypto balances

The crypto "exchange" and "dispersion" features are entirely internal bookkeeping —
no real blockchain, custody, or KYC. Balances are just numbers in Postgres that get
debited/credited atomically.

**Why a normalized table instead of N columns on `users`:** unlike the single-value
caja (`per-user-caja.md`), crypto has 9 assets (`CRYPTO_ASSETS` in `shared/schema.ts`).
A normalized `user_crypto_balances` table (userId, asset, balance) with a unique
`(userId, asset)` constraint avoids adding 9 columns to `users` and scales if more
assets are added later.

**How to apply:**
- Swap/exchange and dispersion (fiat→crypto credit) both run inside `db.transaction`
  in `server/storage.ts` (`exchangeCrypto`, `creditCryptoBalance`) so debit+credit
  never partially apply. `exchangeCrypto` checks sufficient balance inside the
  transaction and throws a specific error the route maps to 400
  `{error: "Saldo insuficiente del activo de origen"}`.
- Upserts use `onConflictDoUpdate` on the `(userId, asset)` unique index rather than
  manual read-then-write, to avoid race conditions.
- User-facing endpoints (`GET /api/crypto-balances`, `POST /api/crypto/exchange`,
  `POST /api/crypto/dispersion`) act on the logged-in session user only. Admin
  endpoints (`GET /api/admin/crypto-balances`, `PATCH /api/admin/user-crypto/:userId/:asset`)
  are separate and ADMIN-gated, returning/accepting an absolute balance (flat
  overwrite, no ledger — consistent with the caja pattern).
- Frontend: `client/src/pages/exchange.tsx` reads `/api/crypto-balances` for the
  swap "You send"/"You get" balance display + MAX button and client-side validates
  before submitting (server re-validates regardless). Admin editing lives in a
  dedicated "Cripto por Usuario" card in `admin-users.tsx` (separate from the users
  list card) since 9 assets per user doesn't fit the inline single-value caja UI —
  each asset renders as its own inline-editable chip keyed by `(userId, asset)`.
- New crypto balances always start at 0 for every user (no backfill needed) since no
  persisted crypto balance state existed before this feature — only derived fiat
  balances from POS transactions.
