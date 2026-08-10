---
name: DB TLS verification policy
description: Why the Postgres pool must never disable certificate verification, and how to verify a provider supports it
---

# DB TLS verification policy

Never configure the pg Pool with `rejectUnauthorized: false` — it accepts any certificate (MITM-able) and is NOT equivalent to verify-full, despite older comments that claimed so.

**Why:** A compliance audit (Fase 1 — Aislamiento de red) flagged exactly this; production must validate the server certificate. Replit's managed production Postgres is Neon-backed with publicly trusted (Let's Encrypt) certificates, so strict verification works with the system CA store — confirmed Aug 2026 with `openssl s_client -starttls postgres` against a `*.neon.tech` endpoint (verify return code 0).

**How to apply:** If a future Postgres provider uses a private CA, pin its CA cert via an env-provided PEM rather than disabling verification. Caveat when investigating prod TLS: the read-replica path used by agent SQL queries reports `ssl off` on a link-local address — that is NOT the app's connection path; don't use it to infer how the deployed app connects.
