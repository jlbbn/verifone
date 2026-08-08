---
name: Google Translate causes React removeChild crash → blank/black screen
description: Diagnosing a black-screen React crash that only happens with Chrome's page-translate feature active, and how to fix it.
---

Symptom: users on mobile Chrome report the app going solid black after a successful
action (e.g. login), with no server errors and no visible cause. Reproducible only
on their device, not in our own testing.

Root cause: Chrome's built-in "Translate this page" (or any other DOM-mutating
extension) rewrites text nodes directly in the live DOM. When React later
re-renders that same subtree (e.g. a live ticker or polling table), it expects
the DOM to still match its virtual tree and throws
`NotFoundError: Failed to execute 'removeChild' on 'Node': the node to be
removed is not a child of this node.` With no error boundary, this uncaught
render error unmounts the whole React tree, leaving a blank page in the app's
background color (black in dark-themed apps) — easy to mistake for a server
crash or missing asset.

**How to confirm:** if the user can send a screen recording, check every crash
frame for a translate banner ("Se tradujo la página" / "Translated to ...").
If present in all of them, this is almost certainly the cause. Also check
server/deployment logs for a client-side error report containing
`removeChild` — a top-level React ErrorBoundary that POSTs
`error.message/stack/componentStack` to a small logging endpoint is what makes
this diagnosable at all; without one, this class of bug is invisible from the
server side.

**Fix:**
1. Set `<html lang="{actual content language}">` correctly — a mismatched
   `lang` attribute (e.g. `lang="en"` on a Spanish-language app) is what
   triggers Chrome to offer/auto-apply translation in the first place.
2. Add `<meta name="google" content="notranslate">` and `translate="no"` on
   `<html>` to hard-disable the translate prompt for the whole app.
3. Keep a top-level ErrorBoundary as a safety net regardless — it turns any
   future uncaught render crash into a visible "reload" UI instead of a
   silent blank screen, and is what surfaces the real stack trace next time.
