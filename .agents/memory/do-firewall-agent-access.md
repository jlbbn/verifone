---
name: DigitalOcean SSH firewall vs agent's dynamic egress IP
description: policy for temporary agent SSH access through a cloud firewall and an inner UFW layer
---

**Rule:** Agent SSH access must pass both the outer cloud firewall and UFW, and
must have an automatic inner-layer expiry. Do not create a broad or permanent
agent allowlist. The administrator's fixed SSH allowlist entry is protected and
must never be removed by temporary-access automation.

**Why:** The runner's egress IP changes unpredictably, so a manual IP allowlist
either locks the agent out or accumulates stale access. UFW rules persist over
reboots, so an in-memory expiry is not sufficient.

**How to apply:** Prepare the droplets with the hardening script, then use the
temporary-access helper for each SSH session. The helper performs granular cloud
rule changes only, while the droplet gate records a durable UFW lease and a
boot-time reconciler removes expired or orphaned temporary rules. Knock ports
are derived only in the trusted runner; pass their derived values to setup, not
the SSH seed. If an outer firewall cleanup is interrupted, it is not sufficient
to open UFW without the derived signal, but stale outer entries should still be
reconciled later.
