---
name: Mobile black-screen from uncompressed JS bundle
description: Diagnosing a "black screen after login" report that turned out to be a slow uncompressed asset download, not a render crash or auth bug.
---

A user reported a solid black screen right after a successful login (OTP confirmed, toast showed "Acceso concedido") on mobile, reproducing in two different browsers (Chrome and Edge) on the same phone with a weak signal. Desktop curl/screenshot tests of the same production URL worked fine.

**Root cause:** `express.static()` was serving the SPA's JS bundle (1.78MB) with no gzip/brotli compression — no `compression` middleware was installed. Since the app renders nothing until the JS finishes downloading and executing, a slow/weak mobile connection meant a long, indefinite black screen (the dark theme's background color, with no content mounted yet).

**Why this diagnosis over the alternatives:** Deployment logs showed all backend calls (`/api/verify-2fa`, `/api/health`, `/api/transactions`, etc.) returning 200 with no errors at the exact timestamp of the user's login — ruling out a server crash or a React render-time exception. The bug reproducing identically across two different browser engines on one device (not reproducing on a fast desktop connection) pointed at something network-bound and browser-agnostic, not a browser-specific rendering or JS bug.

**How to apply:** When a report of "blank/black screen after doing X" surfaces and the backend logs are clean, check whether large static assets (JS/CSS bundles) are served compressed (`curl -D - -H "Accept-Encoding: gzip, br" <url> | grep -i content-encoding`) before assuming a frontend logic bug. Add `compression` middleware in `server/index.ts` early in the middleware chain if missing.
