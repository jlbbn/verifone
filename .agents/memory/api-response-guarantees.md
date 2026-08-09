---
name: API response guarantees (timeouts + retry)
description: Preventing hung requests when an outbound call (email/broker/DB) has no timeout of its own.
---

Found via a real prod log line: `POST /api/login 401 in 24458ms`. The login
route awaits `sendOtpEmail` (a `fetch` to the Resend API) before responding,
and that fetch had no timeout — if the email provider stalled, the whole
login request stalled with it. From the user's side this looks identical to
a frozen/crashed app, with no server error to point at.

**Fix pattern applied (generalize to any future outbound call):**
1. Every outbound `fetch` to a third-party API should carry its own
   `AbortController` timeout (a few seconds) so one slow dependency can't
   stall the request indefinitely. Applied to Resend email sends
   (`server/email.ts`, 8s). OKX/Kraken/Binance clients already had this.
2. Server-side safety net: an Express middleware wraps every `/api/*`
   request with a hard ceiling (25s) that force-responds 503 if nothing else
   has responded yet — a last-resort guarantee that no request hangs forever
   even if a future call is added without its own timeout.
3. Client-side: `fetch` calls in `queryClient.ts` carry a 20s
   `AbortController` timeout, and queries retry (max 2, backoff) on
   network/5xx failures but never on 4xx — so a flaky connection recovers
   automatically instead of surfacing an error on the first blip.

**Why layer all three:** the outbound timeout fixes the specific known cause;
the server middleware catches causes not yet discovered; the client retry
smooths over transient network drops that are outside the server's control.
