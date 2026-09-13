---
name: Dev vs prod settings-table writes
description: Why a code default fix never reaches production once a persisted settings row exists, and how to fix production data safely.
---

A table like `system_settings_store` that upserts a single row (id=1) is fully independent per environment once that row is first created. Changing a code default (e.g. `DEFAULT_SYSTEM_SETTINGS.saldoSistemaUSD`) or removing a seed/sync block only affects the *default* used when no row exists, or *dev's* already-committed row if you fix it via a read/write SQL call — it never touches production's row.

**Why:** The agent's production database access is read-only by platform design (see `dev-prod-db-sync.md`). There is no direct-write path to production from the agent for tables like this.

**How to apply:** When a bug traces to a persisted settings/config row in production, do not try to fix it via a direct query — it will fail or is disallowed. Instead point the user at the app's own admin UI field that writes that same row (e.g. `/admin/settings`) and have them make the change themselves through the live app's own DB connection. Same pattern applies to any other single-row/config-style table with a persisted override.
