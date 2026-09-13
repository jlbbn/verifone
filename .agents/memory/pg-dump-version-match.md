---
name: pg_dump version must match managed Postgres version
description: Ubuntu's default apt repo ships an old postgresql-client that fails pg_dump against a newer managed Postgres.
---

Ubuntu 24.04's default apt repo only ships `postgresql-client-16`. If the target managed database (e.g. a DigitalOcean managed Postgres cluster) runs a newer major version (e.g. 18), `pg_dump` from the older client fails or produces an incompatible/incomplete dump — client and server major versions must match for `pg_dump`.

**Why:** apt's default repo pins to the Ubuntu release's bundled Postgres client version, which lags behind current managed-database offerings.

**How to apply:** Add the official PGDG apt repository and install the matching `postgresql-client-<major>` package before setting up `pg_dump`-based backups (cron/systemd timer) on a droplet. Verify with `pg_dump --version` against the target server's version before trusting any backup script.
