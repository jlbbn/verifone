---
name: Sandbox droplet isolation history
description: banxico-plus-app-sandbox droplet used to share prod DB/keys, then was isolated after a security scare — check current state before assuming either way
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
for real. It now runs its own **local Postgres** on the droplet (not a DO managed DB)
and its env file no longer contains real broker/payment secrets — only
`DATABASE_URL` (local), `OKX_WEBHOOK_SECRET`, `SESSION_SECRET`, `SANDBOX_ENV`.

**Why:** Money-moving test flows on a droplet wired to real credentials meant any "test"
swap was a real trade with real funds. Once the account showed signs it could be probed
(open DB firewall), that risk was no longer acceptable to the user.

**How to apply:** Before treating this droplet as either "safe to test destructively" or
"shares prod data", re-check the live `/etc/banxico-plus.env` on the box — do not trust
either state from memory. The production managed DB (`banxico-plus-db`) now also has a
DigitalOcean firewall rule restricting connections to the production droplet only; if
that firewall is ever found empty again, treat it as a live incident, not a one-off.
