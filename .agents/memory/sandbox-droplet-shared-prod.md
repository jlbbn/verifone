---
name: Sandbox droplet shares production DB and real broker keys
description: banxico-plus-app-sandbox droplet is not isolated — read before assuming it's safe to test against
---

The DigitalOcean droplet `banxico-plus-app-sandbox` (138.197.79.6) looks like an
empty/unused sandbox from the outside (no domain, no firewall, no load balancer),
but it already runs a full copy of the app (`banxico-plus.service` + Caddy on :80)
wired to the **same** managed production Postgres
(`private-banxico-plus-db-do-user-41954069-0.l.db.ondigitalocean.com`) and the
**same real** broker/payment secrets (OKX, Stripe, `PLATFORM_TRON_PRIVATE_KEY`) as
the production droplet (`banxico-plus-app`, 165.227.125.34).

**Why:** Discovered 16-ago-2026 while scoping an isolated smoke-test environment.
The user explicitly confirmed (after being told the implications) that this sharing
is intentional and must stay as-is — they want to test against real production data
and real broker credentials on this box, not an isolated copy.

**How to apply:** Never assume this droplet is a safe place to run destructive or
money-moving tests without re-confirming with the user first — any broker "test" swap
executed there is a real trade with real funds, and any DB write there touches real
production data. It also has no network restriction on ports 80/443 (open to any IP)
— a follow-up task (see project tasks) proposes locking that down, but it was not
done because the user only asked to leave the service reactivated, nothing else.
