---
name: Stripe key resolution and a stale invalid secret
description: how server/stripeClient.ts picks a Stripe key across candidates, and a known-bad secret value to watch for
---

`server/stripeClient.ts` tries Stripe key candidates in order: `STRIPE_SECRET_KEY` →
`STRIPE_SECRET_KEY_LIVE` → `Secretkey1` → `STRIPE_CONNECTOR_KEY` → the Replit Stripe
connector's live-fetched credential. `isValidKey()` only accepts `sk_live_`, `sk_test_`,
`rk_live_`, `rk_test_` prefixes and explicitly rejects `mk_`-prefixed values.

**Confirmed 16-sep-2026:** `STRIPE_SECRET_KEY` and `Secretkey1` both held a Stripe
**key ID** (the `mk_...` identifier Stripe's dashboard shows for a key, not the usable
secret value) instead of the actual `sk_.../rk_...` value — easy to mistake for the real
key since it's copied from the same dashboard row. The real, working live secret key was
already sitting unused in `STRIPE_SECRET_KEY_LIVE` (verified live via `stripe.balance.retrieve()`
before trusting it), but the code never read that variable — added it as a candidate.
Separately found and fixed a literal typo in the file (`terimport` instead of `import` on
line 1), present since a Jun-2026 commit, which would have hard-failed the dynamic
`import("./stripeClient")` — but a long-lived process can keep serving from its in-memory
ESM module cache after the on-disk file breaks, so a stale "working" log line from an old
process is not proof the current source still parses.
`STRIPE_PUBLISHABLE_KEY` had the same `mk_...` key-ID mixup on the publishable side; no
valid `pk_live_`/`pk_test_` value existed anywhere in project secrets and had to be
re-copied from the Stripe dashboard.

**How to apply:** if Stripe calls fail with "No valid Stripe key found" or a request 500s
inexplicably right after an unrelated code change, (1) check every `STRIPE_*`-ish secret
name for a valid `sk_test_`/`sk_live_`/`rk_..._` prefix — including `*_LIVE` variants that
the code might not be wired to read yet — before assuming the value must be re-requested
from the user, and (2) confirm the importing file's syntax is still currently valid,
since a long-running dev/prod process's success log can predate a since-introduced typo.
