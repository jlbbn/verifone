---
name: Stripe key resolution and a stale invalid secret
description: how server/stripeClient.ts picks a Stripe key across candidates, and a known-bad secret value to watch for
---

`server/stripeClient.ts` tries Stripe key candidates in order: `STRIPE_SECRET_KEY` →
`Secretkey1` → `STRIPE_CONNECTOR_KEY` → the Replit Stripe connector's live-fetched
credential. `isValidKey()` only accepts `sk_live_`, `sk_test_`, `rk_live_`, `rk_test_`
prefixes and explicitly rejects `mk_`-prefixed values.

**Known issue (as of 16-ago-2026):** the `STRIPE_SECRET_KEY` secret in this project holds
an `mk_`-prefixed value, which the code treats as invalid — so in practice the app was
silently falling through to later candidates. `STRIPE_CONNECTOR_KEY` used to be hardcoded
in `.replit` under `[userenv.development]` as the working dev fallback; a security audit
found and removed it (SAST flags any secret literal in `.replit` as critical) because it
had been committed to git history — do not restore a hardcoded key there even to "fix"
dev breakage. Production is unaffected: it resolves via `STRIPE_SECRET_KEY_LIVE` /
the connector path and was confirmed working via deploy logs ("Stripe: conexión verificada").

**How to apply:** if local dev Stripe calls fail with "No valid Stripe key found", check
whether `STRIPE_SECRET_KEY` actually has a valid `sk_test_`/`sk_live_` prefix before
assuming the client code is broken — it may just be holding a stale/wrong-format value.
Get a fresh test key from the user (Stripe dashboard) and store it via `requestSecrets`,
never as a plaintext `.replit` env value.
