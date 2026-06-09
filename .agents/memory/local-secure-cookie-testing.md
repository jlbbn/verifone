---
name: Testing secure-cookie sessions on localhost with curl
description: Why curl login flows fail to keep a session on localhost and the header that fixes it
---

# Curl-testing session auth on localhost

The session cookie is marked `Secure`, so over plain `http://localhost:5000` the
browser/curl will not store or send it and every request looks logged-out.

**Why:** Secure cookies are only sent over HTTPS; the app trusts a proxy and decides
cookie security from the forwarded protocol.

**How to apply:** Send `-H "X-Forwarded-Proto: https"` on the login request (and
subsequent requests) and use a curl cookie jar (`-c jar` / `-b jar`). Pattern that
works for verifying per-user scoping:
1. POST /api/login per user into separate jars.
2. GET /api/transactions per jar; assert counts and distinct `createdBy` owners.
3. Cross-user GET /api/transactions/:id and /api/transaction-logs/:id must be 404;
   owner/admin must be 200.
