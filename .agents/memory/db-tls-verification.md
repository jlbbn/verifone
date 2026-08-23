---
name: DB TLS verification policy
description: Never disable certificate verification; the TLS boundary is platform-local vs routable host, decided on the canonicalized hostname.
---

# DB TLS verification policy

Never configure the pg Pool with `rejectUnauthorized: false` — it accepts any
certificate (MITM-able) and is NOT equivalent to verify-full, despite older
comments that claimed so.

**Why:** A compliance audit (Fase 1 — Aislamiento de red) flagged exactly
this; connections that cross a network must validate the server certificate.
Publicly reachable managed Postgres (Neon `*.neon.tech`) presents publicly
trusted certificates, so strict verification works with the system CA store.

**The boundary is local-vs-routable, not prod-vs-dev:** Replit now hands both
dev AND production containers a platform-local proxy URL (`sslmode=disable`,
link-local or dotless host) where plaintext never leaves the container's
private network. Honor `sslmode=disable` only for those platform-local hosts;
refuse it for any routable host. A blanket refusal breaks every new publish
with an import-time crash and no logs.

**How to apply:** decide on the canonicalized hostname — percent-decode once
(mirroring pg-connection-string) then IDNA `domainToASCII` — and fail closed
on malformed/unconvertible names; IPv6 counts as local only when exactly
`::1`. If a future Postgres provider uses a private CA, pin its CA cert via an
env-provided PEM rather than disabling verification.
