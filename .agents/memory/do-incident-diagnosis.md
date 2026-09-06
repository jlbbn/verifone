---
name: DigitalOcean incident diagnosis signals
description: How to tell a token-based unauthorized wipe from a UI/filter confusion when DO resources appear to vanish.
---

# Diagnosing "my droplets disappeared" on DigitalOcean

- The account Activity log (cloud.digitalocean.com/projects/<id>/activity, or a project's Activity tab) attributes each event to an actor. Actions taken via a logged-in dashboard session show the user's email; **destructive actions performed via an API token show as "Unknown User"** — this is the strongest signal to distinguish a compromised/misused API token from a UI mistake or wrong-project filter.
- An empty-looking Droplets page does not by itself confirm project/team confusion. **VPC Networks persist even after every droplet inside them is destroyed** — seeing the expected VPC names still listed is not evidence the droplets are just "hidden by a filter"; check the Activity log instead of assuming a UI/filter issue.
- If the API token that was working earlier in a session suddenly returns 401 on every endpoint (including `/v2/account`), treat it as revoked/rotated/compromised, not transient — retries did not help in the observed case.

**Why:** without knowing this, a sudden empty resource list plus a dead token looks ambiguous (filter issue? account switch? real incident?) and wastes time before triggering an actual security response.

**How to apply:** when a user reports DO resources "missing" or a previously-working `DIGITALOCEAN_TOKEN` starts failing, ask them to check the Activity log's actor column before anything else — "Unknown User" on `destroy`/`remove` events is the incident signal.
