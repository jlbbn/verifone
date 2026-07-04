---
name: Per-user caja vs central caja
description: How the per-user cash balance (caja) differs from the central/system caja, and the pattern used to add admin-editable per-user fields
---

# Per-user caja vs central caja

This app has two distinct "caja" (cash box) concepts that must not be conflated:

- **Central caja**: system-wide, admin-managed via `saldoAperturaUSD`/`saldoSistemaUSD`
  in `SystemSettings`. It lives in server memory (see admin-settings-arch.md) and its
  "movements" on the `caja.tsx` page are ephemeral/client-side only, not persisted.
- **Per-user caja**: each user's individual cash balance, `users.caja_saldo_usd`
  (a real DB column, `doublePrecision` default 0). It is a flat absolute balance,
  not a ledger — admin overwrites the number directly, there is no movement history.

**Why:** The user explicitly asked for per-user caja editing "tomando en cuenta que
puedo manejar la caja central" (distinct from central caja). Kept it as a flat
persisted number instead of a ledger to match the app's existing simplicity level
(central caja is also just a number, not a ledger).

**How to apply:**
- Adding a new admin-editable per-user field follows this pattern: add the column to
  `shared/schema.ts` + an idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in
  `server/storage.ts` `initialize()`, include it in `publicUser()` in `server/routes.ts`,
  and add a dedicated `PATCH /api/admin/user-<field>/:userId` (ADMIN-only, zod-validated,
  direct `db.update(usersTable)`) mirroring the existing `/api/admin/user-permissions/:userId`
  endpoint rather than going through the storage interface.
- On the frontend (`admin-users.tsx`), per-user admin controls (permission switches, caja
  edit) are only rendered for `u.role !== "ADMIN"` and live in the same
  `flex flex-col gap-1.5 mt-1 pt-2 border-t border-border w-full` block in the user row.
