---
name: Per-user data ownership scoping
description: How transaction ownership/scoping is enforced in this banking-sim app and why username is the owner key
---

# Transaction ownership scoping

Each USER sees only their own transactions; ADMIN sees all. The owner key is the
**username** (stored in `transactions.createdBy`), NOT the user id.

**Why:** Storage is in-memory (MemStorage) and regenerates user UUIDs on every
restart, so ids are unstable across restarts; `users.username` is unique and the
session keys on username, making it the only stable owner key.

**How to apply:**
- Set the owner server-side from `req.currentUser.username` after parsing the body,
  and `.omit` the owner field from the insert-schema parse so a client can never
  mass-assign ownership.
- All resources that hang off a transaction (payment-methods, security-tokens,
  transaction-logs) must check the **parent transaction's** ownership, looked up by
  the internal `transaction.id` (that is the foreign key used everywhere — not the
  `TXN-...` display id).
- Use a `canAccessTransaction(tx, user)` guard = `ADMIN || tx.createdBy === username`.
- Return **404 (not 403)** on ownership failure everywhere, to avoid an existence
  oracle. Apply the convention uniformly.
- Mutating endpoints that should stay admin-only (e.g. status PATCH) are gated by
  `requireRole("ADMIN")`, not by the ownership guard.
