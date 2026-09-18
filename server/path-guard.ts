import type { NextFunction, Request, Response } from "express";

/**
 * True when a normalized path starts with "api" (any case) as its first
 * path segment's prefix — covers both the real "/api" mount and near-miss
 * scanning patterns like "/apis/..." that were never meant to match any
 * route but should still never fall through to the SPA. No legitimate
 * frontend route in this app starts with "api" (see client/src/App.tsx), so
 * a prefix match here has no false positives against real navigation.
 * Shared by the deny-by-default guard here and by static.ts's SPA catch-all,
 * so both places agree on what counts as "API-shaped".
 */
export function looksLikeApiPath(path: string): boolean {
  return /^\/api/i.test(path);
}

/**
 * Decodes percent-encoding and collapses duplicate slashes in a raw
 * "path?query" request-target. Returns null for malformed percent-encoding
 * (the caller should reject the request rather than guess at intent).
 *
 * Why this exists: Express's own mount-path matching (`app.use("/api", ...)`)
 * compares against the raw, undecoded pathname (via the `parseurl` module).
 * An encoded slash right after "api" (`/api%2F.env`) or an extra path
 * segment (`/apis/.env`) walks past the `/api` auth mount without ever
 * triggering it, because the raw string doesn't have "/" or end-of-string
 * immediately after "api". Canonicalizing once, before any route matching,
 * means every downstream matcher — the auth mount, individual routes, and
 * the deny-by-default guard below — all see the same normalized path.
 */
export function canonicalizeRequestTarget(rawUrl: string): string | null {
  const qIndex = rawUrl.indexOf("?");
  const pathPart = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
  const queryPart = qIndex === -1 ? "" : rawUrl.slice(qIndex);
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    return null;
  }
  const collapsed = decoded.replace(/\/{2,}/g, "/");
  return collapsed + queryPart;
}

/** Registered first, before any route matching. Rewrites req.url to its
 * canonical form so every middleware/route after this one sees the decoded,
 * slash-collapsed path. Malformed percent-encoding is rejected outright. */
export function canonicalizePathMiddleware(req: Request, res: Response, next: NextFunction): void {
  const canonical = canonicalizeRequestTarget(req.url);
  if (canonical === null) {
    res.status(400).json({ error: "Malformed URL" });
    return;
  }
  req.url = canonical;
  next();
}

/** Registered after every real `/api/*` route. By the time a request reaches
 * this, it already failed to match any actual endpoint — if its (now
 * canonical) path is still API-shaped, deny explicitly with 404 JSON instead
 * of letting it fall through to the SPA catch-all, which would otherwise
 * serve index.html for an API-shaped path (the original bug: `/apis/.env`,
 * `/api%2F.env` and similar reached the catch-all and got a 200 HTML page). */
export function apiNotFoundGuard(req: Request, res: Response, next: NextFunction): void {
  if (looksLikeApiPath(req.path)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  next();
}
