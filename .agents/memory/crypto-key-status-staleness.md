---
name: Crypto key status vs expiration drift
description: Security key "status" is a static seeded column, not derived from expiresAt — it silently goes stale as real time passes.
---

`crypto_keys.status` ("Activa"/"Rotada"/"Expirada") was seeded once and never re-evaluated: several keys had `status: "Activa"` with an `expiresAt` already in the past by the time the app was reviewed months later. Nothing recomputed status against the clock, so the admin "Claves Encriptadas" page and any parameter report kept showing an expired key as active.

**Why:** any field that says "current state as of expiresAt" must be derived at read time, not written once at creation/rotation and left to drift.

**How to apply:** `storage.getCryptoKeys` now computes effective status at read time (`Activa` + `expiresAt <= now` → `Expirada`), so this can't silently drift again regardless of what's stored. When auditing "system parameters" pages for stale/wrong dates, check for this class of bug first: any status/badge field that depends on comparing a stored date to "now".
