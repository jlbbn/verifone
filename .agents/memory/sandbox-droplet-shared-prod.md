---
name: Sandbox droplet isolation history
description: banxico-plus-app-sandbox droplet used to share prod DB/keys, then was fully isolated (local Postgres, no real secrets, firewall) after a security scare on 2026-08-16
---

The DigitalOcean droplet `banxico-plus-app-sandbox` (138.197.79.6) originally shared
the **same** managed production Postgres and the **same real** broker/payment secrets
(OKX, Stripe, `PLATFORM_TRON_PRIVATE_KEY`) as the production droplet
(`banxico-plus-app`, 165.227.125.34). The user explicitly confirmed (16-ago-2026) that
this was intentional at the time.

**Reversed 16-ago-2026:** after a security scare (production managed DB found with an
empty DigitalOcean firewall — any IP on the internet could attempt to connect with just
a password; plus an unrelated "your DigitalOcean email was changed" notice that turned
out to be a false alarm), the user changed their mind and asked to isolate the sandbox
for real.

**Current isolated state (2026-08-16):**
- DB: Postgres 16 local on the droplet (`banxico_sandbox@localhost`). TLS with a
  self-signed cert; CA copy at `/opt/banxico-plus/db-ca.crt`; password in
  `/root/.sandbox-db-pw`.
- `/etc/banxico-plus.env` contains ONLY: `DATABASE_URL` (local), `SESSION_SECRET`
  (random), `OKX_WEBHOOK_SECRET` (random), `SANDBOX_ENV=1`. No prod DB host, no
  real OKX/Stripe/TRON/MP keys.
- DO Firewall `sandbox-restricted` (id `2907a33f-40bb-411e-aa43-7031e12d39f0`)
  allows only SSH 22 inbound. Ports 80/443 are closed to all IPs.
- Docs: `docs/sandbox-environment.md`.

**Why:** Money-moving test flows on a droplet wired to real credentials meant any "test"
swap was a real trade with real funds. Once the account showed signs it could be probed
(open DB firewall), that risk was no longer acceptable to the user.

**How to apply:** Safe to run smoke-tests and schema experiments — no real money or real
data at risk. Before treating this droplet as either "safe to test destructively" or
"shares prod data", re-check the live `/etc/banxico-plus.env` on the box — do not trust
either state from memory. If the DO firewall is ever found empty again, treat it as a
live incident, not a one-off.

**To open web access temporarily:** add an inbound rule to the `sandbox-restricted` DO
firewall via API or panel, then remove it when done.

**To add real test credentials (sandbox keys):** add them to `/etc/banxico-plus.env`
on the droplet — never the live keys (`sk_live_`, real `OKX_SECRETKEY`, real TRON key).
