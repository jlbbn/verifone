---
name: DB SSL config differs by environment
description: Why server/db.ts turns SSL off in dev but must verify certs in prod, and the pg gotcha behind it.
---

# Database SSL: dev vs prod

The Postgres connection SSL policy is environment-split on purpose, and forcing
one setting everywhere breaks things.

- **Dev:** the DB is reached over Replit's internal network via a host whose
  endpoint does not offer TLS, and the `DATABASE_URL` carries
  `sslmode=disable`. SSL is intentionally OFF (`ssl: false`) in dev — forcing
  TLS here breaks the local connection.
- **Prod:** Replit-managed Postgres presents a publicly-trusted certificate, so
  full verification (`rejectUnauthorized: true`) works and is the correct
  secure default.

**Why this matters / gotcha:** the explicit `ssl` option on the `pg` Pool
**overrides** whatever `sslmode` is in the connection string. So a URL that
says `sslmode=require`/`verify-full` still gets no certificate validation if the
code passes `ssl: { rejectUnauthorized: false }`. Validation must be turned on
in the Pool option, not assumed from the URL.

**How to apply:** keep dev SSL off; keep prod verifying. If prod ever points at
a provider with a private/self-signed cert, use the documented escape hatch
`DATABASE_SSL_REJECT_UNAUTHORIZED=false` rather than hard-coding the downgrade.
Cert-validation changes can only be truly confirmed at deploy time — dev won't
exercise the prod TLS path.
