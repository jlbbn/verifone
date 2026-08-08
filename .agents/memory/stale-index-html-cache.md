---
name: Stale index.html after redeploy causes blank/black screen
description: Vite build output served via express.static without cache headers lets clients keep a cached index.html that references deleted hashed chunk files after a new deploy.
---

Symptom: after republishing (new Vite build with new content-hashed JS/CSS filenames), some users hit a blank/black page — especially on mobile browsers that hold onto a cached `index.html` from the previous build. The cached HTML's `<script src="/assets/index-<oldhash>.js">` 404s because that file no longer exists in the new `dist/public`, and the app never mounts.

**Why:** `express.static(distPath)` with no explicit headers relies on browser heuristic caching for `index.html` (no `Cache-Control` set), so browsers can serve a stale copy instead of revalidating — especially right after a fresh deploy when the old and new builds briefly coexist across CDN/edge/browser cache layers.

**How to apply:** When serving a Vite/CRA-style SPA build from Express, always set `Cache-Control: no-store` on `index.html` (and the SPA fallback route) while giving hashed asset files (`/assets/*`) a long `immutable` cache — the hash in the filename already busts the cache correctly. Apply this once in the static-serving setup, not per-route. If a user reports a blank page right after a deploy, suspect this before anything else; the fix is a server-side header change, not a client-side "hard refresh" instruction (though a hard refresh works around it for that one user).
