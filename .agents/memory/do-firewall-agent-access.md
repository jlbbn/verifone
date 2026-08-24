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

**Administrator recovery:** A strict UFW allowlist for SSH also blocks
DigitalOcean's ordinary Droplet Console, because that console is network-attached
like SSH. Before removing a setup access path, verify the user's own SSH access
from its intended network and retain a tested Recovery Console path with a root
or sudo password. Recovery Console is out-of-band, but requires password
authentication.

**Why:** A newly isolated host can otherwise remain healthy while both the user's
new-network SSH path and the ordinary browser console are denied by the inner
firewall. The cloud firewall API cannot run commands inside the guest to repair
UFW.

## UFW a nivel host (además del firewall DO)
- Si el host corre UFW propio, permitir SSH también desde los rangos de egreso del agente (34.72.0.0/13 y 35.224.0.0/12), no solo la IP puntual: la IP del agente cambia entre sesiones y ya dejó un host permanentemente inaccesible (hubo que recrearlo).
