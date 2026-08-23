---
name: Silent deploy promote crashes
description: Build succeeds but promote fails with zero runtime logs — how to diagnose an import-time crash in the production bundle.
---

# Deploy promote fails with zero logs

**Rule:** when a publish shows a fully successful build phase (image pushed)
but the deployment fails with NO promote lines in the build log and NO runtime
logs at all, suspect an import-time (module top-level) throw in the server
bundle — the container dies before the health probe or any logging.

**Why:** the autoscale startup probe needs `GET /` → 200; a module-scope throw
crash-loops instantly, and failed-revision logs are not surfaced by the
deployment log tools. Meanwhile the previous revision keeps serving with its
PINNED environment — so "live site works" proves nothing about what a NEW
container receives (env like DATABASE_URL can differ between revisions).

**How to apply:**
1. Reproduce locally: `npm run build` then run the actual bundle with
   `NODE_ENV=production PORT=<free> node dist/index.js` and curl `/` for 200.
   Test guard paths with synthetic env (e.g. crafted DATABASE_URL values) —
   the pg Pool is lazy, so URL-policy code runs at import without connecting.
2. Check what changed at module scope since the last good publish; keep env
   validation lazy (inside functions) wherever possible.
3. Confirming state via prod SQL: schema untouched by the app's idempotent
   startup migration = the new container never ran initialize().
