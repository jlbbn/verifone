---
name: DB SSL config differs by environment
description: Postgres TLS policy — plaintext only to platform-local proxy hosts; routable hosts get verify-full; pg Pool ssl option overrides URL sslmode.
---

# Database SSL: platform-local vs routable hosts

The Postgres connection TLS policy is decided by WHERE the host is, not by
environment alone.

- **Dev:** the DB is reached through a local sidecar proxy (dotless internal
  hostname, `sslmode=disable`). SSL intentionally OFF on that local hop —
  forcing TLS breaks the connection; the platform tunnel secures the upstream
  leg.
- **Prod (Replit-managed):** deploy containers ALSO receive a platform-local
  proxy URL — observed as link-local `169.254.254.254` with `sslmode=disable`
  and `pg_stat_ssl` reporting ssl=off. Plaintext confined to that in-container
  hop is acceptable; TLS terminates upstream in the proxy.
- **Any routable host** (public FQDN or routable IP, e.g. Neon direct or the
  planned DigitalOcean DB): always full verification
  (`rejectUnauthorized: true`); a production URL requesting `sslmode=disable`
  for a routable host must refuse to start.

**Why:** A blanket "refuse sslmode=disable in production" guard crash-looped
every new publish at import time (zero logs, promote failure) once the
platform switched injected prod URLs to the local-proxy form, while the old
pinned revision kept serving. The distinction local-vs-routable keeps both the
platform topology and the fail-closed posture for external databases.

**Gotchas:**
- The explicit `ssl` option on the `pg` Pool **overrides** whatever `sslmode`
  the URL carries — validation must be set in the Pool option.
- Classify the host only after canonicalizing it: percent-decode once (as
  pg-connection-string does) and run IDNA `domainToASCII`, else encoded or
  Unicode dots (`%2e`, U+3002/U+FF0E/U+FF61) can make a public FQDN look like
  a dotless "local" name. Fail closed on empty/invalid conversions; IPv6 is
  local only as `::1`.

**How to apply:** policy lives in pure helpers with unit tests (encoded-host
and Unicode-dot cases are mandatory coverage). Cert-validation changes can
only be truly confirmed at deploy time — dev never exercises the prod path.
