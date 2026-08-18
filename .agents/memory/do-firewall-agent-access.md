---
name: DigitalOcean SSH firewall vs agent's dynamic egress IP
description: how to keep DO droplet SSH locked to trusted IPs while the agent still needs admin access across sessions
---

Both `banxico-plus-app` (prod) and `banxico-plus-app-sandbox` droplets are protected by
DigitalOcean Cloud Firewalls (`production-restricted`, `sandbox-restricted`) that allow
SSH (22) only from an explicit IP allowlist — never `0.0.0.0/0`. HTTP/HTTPS stay open to
everyone on the prod firewall; the sandbox firewall has no 80/443 rule (closed) since it
isn't meant to serve public traffic. Port 5432 must never be added to either firewall —
DB access is controlled separately via the managed database's own trusted-sources list
(see below).

**Why:** 16-ago-2026 security incident — the production managed database had an empty
trusted-sources list (any IP could attempt a connection with just a password) and SSH
was reachable from anywhere on both droplets. The user asked to lock SSH down but also
explicitly needs the agent to keep working without being locked out.

**The problem:** this CodeExecution sandbox's outbound IP is NOT stable — it changed
within the same conversation (e.g. `35.237.100.170` → `34.24.102.142` a few tool calls
apart). Hardcoding "the agent's IP" into the firewall goes stale almost immediately.

**How to apply:** before any SSH session to either droplet, there are now TWO firewall
layers to update — both must allow the agent IP or the connection is blocked:

**Layer 1 — DO Cloud Firewall (outer):**
1. `MYIP=$(curl -s https://api.ipify.org)` inside the same ShellExec block you'll SSH from.
2. `PUT /v2/firewalls/{id}` (DigitalOcean API, `$DIGITALOCEAN_TOKEN`) with the full
   inbound_rules array, name field required, appending `"$MYIP/32"` to the port-22
   rule's `sources.addresses` — the endpoint replaces the whole rule set, not a diff.
   - prod firewall id: `a6c24a6d-9e11-4cf6-b980-a71e6b3690c0` (production-restricted)
   - sandbox firewall id: `2907a33f-40bb-411e-aa43-7031e12d39f0` (sandbox-restricted)

**Layer 2 — UFW on the droplet OS (inner, added aug-2026 hardening):**
After the cloud firewall step, also add the agent IP to UFW on the droplet itself:
`ufw allow from $MYIP to any port 22 proto tcp comment "agent-temp"`
Do this via the same SSH session that will be used for admin work. Remove the
temporary rule when done: `ufw delete allow from $MYIP to any port 22 proto tcp`

3. Do the SSH work.
4. Optionally prune stale/old agent IPs from the DO cloud firewall later; the user's own
   fixed IP entry (186.96.190.247) must never be removed from either layer.
The managed database's trusted-sources list is separate infrastructure (`/v2/databases/{id}/firewall`) — it is restricted to the production droplet only and should stay that way; do not add the agent's IP there directly, since only the droplet talks to the DB.
