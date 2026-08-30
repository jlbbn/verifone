---
name: Drizzle/pg error wrapping
description: Where to find the real Postgres error code/message when a Drizzle query throws, for branching on things like unique-violations.
---

When a Drizzle query fails (e.g. a primary-key/unique-constraint violation
used as an idempotency guard), the thrown error's `message` is Drizzle's own
"Failed query: insert into ..." wrapper — it does **not** contain the
Postgres error text. The actual driver error (message and `code`, e.g.
`23505` for unique_violation) is on `err.cause`.

**Why:** code that branches on `err.message.includes("duplicate key")` will
never match and will fall through to a generic 500 instead of the intended
clean conflict response.

**How to apply:** when you need to distinguish a specific Postgres failure
(unique violation, FK violation, etc.) after a Drizzle call, check
`err.cause?.code` (e.g. `"23505"`) and/or `err.cause?.message`, not just
`err.message`.
