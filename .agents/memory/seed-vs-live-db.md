---
name: Seed code changes don't clean a live Postgres DB
description: Why editing/removing seed blocks in storage.ts is not enough to change what users see — the DB already has old rows.
---

## Rule
This app uses a real persistent PostgreSQL DB (not MemStorage), and all seed blocks in `server/storage.ts` are idempotent ("insert only if a specific ID/row doesn't already exist yet"). Editing or deleting a seed block only changes what gets inserted into an **empty** database — it does nothing to rows already committed in earlier sessions. `pos_terminals` seeds specifically use `onConflictDoNothing`, so even re-running the (changed) seed silently skips existing rows.

**Why:** Spent a full pass rewriting `storage.ts` seed data (removing other users' demo transactions, changing amounts/names) and restarting the workflow, only to find the live `transactions`/`users`/`pos_terminals` tables still had the old data — verified via `psql "$DATABASE_URL"` — because those rows already existed from a prior session's seed run.

## How to apply
Whenever a task requires changing or zeroing out data that was originally seeded (demo transactions, user profile fields, terminal stats, etc.), after editing the seed code you MUST also directly reconcile the live DB with `psql "$DATABASE_URL"`:
- `UPDATE`/`DELETE` rows to match the new intended state (e.g. `DELETE FROM transactions WHERE created_by != 'target_user'`).
- Check for orphaned child rows left behind in `transaction_logs`, `payment_methods`, `security_tokens`, `payment_charges` that reference now-deleted transaction IDs — clean those too, or they can leak stale per-user activity.
- Verify with a `GROUP BY created_by` / `COUNT(*)` query before declaring the task done — don't trust the seed code alone.
