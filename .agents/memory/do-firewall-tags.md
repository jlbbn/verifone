---
name: DigitalOcean firewall tags
description: Non-obvious DigitalOcean API behavior when attaching Cloud Firewalls through tags.
---

Create the DigitalOcean tag before creating a Cloud Firewall that targets that
tag. A firewall request referencing a tag that does not exist can return HTTP
422. After attachment by tag, the firewall's `droplet_ids` list may remain empty;
verify the firewall's `tags` and the droplet's matching tag instead.

**Why:** An isolated-infrastructure rollout received an opaque 422 until the tag
was created first, and direct droplet attachment fields did not reflect the
successful tag-based association.

**How to apply:** For new tagged firewalls, create/verify the tag, create the
firewall, tag the droplet, and validate both resources plus an external port
probe. Do not infer that an empty `droplet_ids` list means the firewall is
detached when tag targeting is in use.