---
name: Financial balance mutation locking
description: Every read-then-write against a per-user balance must serialize on the same lock key, across ALL the operations that touch it, not just some.
---

A per-user, per-asset balance (e.g. `(userId, asset)` row) is only safe under
concurrency if **every** operation that reads it and writes it back —
deposit credit, withdrawal reservation, rejection refund, failed-settlement
refund, admin manual adjustment, etc. — takes the same serialization lock
before reading. Adding the lock to only the "obvious" write path (e.g.
withdrawal reservation) and forgetting a less obvious one (e.g. deposit
crediting) still leaves the balance racy, because two different operations
racing against each other is exactly as dangerous as the same operation
racing against itself.

**Why:** a partial rollout — locking only the "obvious" path and assuming an
insert with a unique idempotency key made another path safe — still let two
unrelated operations (e.g. a withdrawal and an exchange) race on the same
balance and overspend it.

**How to apply:** centralize the lock behind one shared helper per balance
dimension rather than inlining the lock call at each site, and audit every
function that mutates that balance to confirm it calls the helper before its
read. When one operation touches two balance dimensions at once (e.g. an
exchange), acquire both locks in a fixed deterministic order to avoid
deadlocking against the reverse operation.
