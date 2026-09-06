---
name: DigitalOcean managed Postgres requires its cluster CA
description: Node's pg driver rejects DO managed Postgres with SELF_SIGNED_CERT_IN_CHAIN unless the cluster's own CA cert is trusted via NODE_EXTRA_CA_CERTS.
---

DigitalOcean managed PostgreSQL clusters present a **self-signed, per-cluster CA** (`CN = <cluster-uuid> Project CA`), not a publicly-trusted CA. A `pg`/drizzle pool using `ssl: { rejectUnauthorized: true }` with no CA configured fails every query with `SELF_SIGNED_CERT_IN_CHAIN`.

**Symptom is misleading:** the app's own error logging (`storage.initialize()` catch block) only prints `err.message`, which for a `drizzle-orm` wrapped query is just `"Failed query: <sql text>"` — the real cause (`SELF_SIGNED_CERT_IN_CHAIN`) is on `err.cause`/thrown separately and never surfaced in that log line. A raw `psql "$DATABASE_URL"` connection succeeds fine (psql trusts the system CA store differently / or the failure is Node-specific), which makes it look like the query itself is broken rather than TLS.

**Fix:** fetch the cluster CA via `GET /v2/databases/{id}/ca` (base64 `certificate` field), write it to a file on the app host, and set `NODE_EXTRA_CA_CERTS=/path/to/ca.pem` in the process environment (systemd `EnvironmentFile`). No application code change needed — this is a process-wide Node TLS trust addition.

**Why:** Cost a long debugging loop during a DO droplet+DB rebuild — corrects an earlier (wrong) assumption in `do-migration-arch.md` that DO managed Postgres presents publicly-trusted certs needing no custom CA. That assumption only happened to hold for the migration *scripts*, which already set `NODE_EXTRA_CA_CERTS` explicitly; the main app's `server/db.ts` did not, and nothing caught it until the account was terminated and rebuilt from scratch.

**How to apply:** Any time you provision a new DigitalOcean managed database for this project (or any project using `rejectUnauthorized: true` verify-full TLS), pull the cluster CA and set `NODE_EXTRA_CA_CERTS` before assuming a silent/opaque DB query failure is an application bug.
