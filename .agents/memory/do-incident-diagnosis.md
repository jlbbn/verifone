---
name: DigitalOcean destroyed-resources incident diagnosis
description: How to tell a compromised API token/account from a routine billing termination when droplets/snapshots vanish and the API token dies.
---

When all droplets, snapshots, and the API token die at once with DigitalOcean, do not assume a breach — check billing/email first.

**Signals gathered before concluding anything:**
- Resource-level Activity log attributing destructive actions to "Unknown User" — this appears both for API-token-driven actions by an external actor AND for DigitalOcean's own automated account-termination process. It does NOT by itself prove compromise.
- Account-level Activity (`/account/activity`) showing only clean `user.login` events from recognized IPs does NOT rule out token misuse (a stolen token never needs a dashboard login) — but combined with a termination notice, it simply confirms no one logged in because no one needed to.
- VPCs can persist as empty shells after their droplets are destroyed either way (breach or termination) — not a distinguishing signal.

**Ground truth found by checking email:** DigitalOcean sends an explicit "Account Termination Notice" email when an unpaid balance triggers termination, stating resources were "permanently deleted." This is the fastest way to disambiguate — check billing/inbox for this before spending time on incident-response theories.

**Why:** Spent a long session investigating this project's wiped DO account (all droplets + snapshot + dead token) as a suspected credential-compromise incident before the user found the termination email. The account-activity screenshots were red herrings/ambiguous; the email was decisive.

**How to apply:** When droplets/resources vanish unexpectedly and an API token stops working, ask the user to check their email for a DigitalOcean termination/suspension notice and the Billing page for an outstanding balance before proposing security-incident containment tasks.
