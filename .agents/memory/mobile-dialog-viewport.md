---
name: Mobile dialog/modal viewport handling
description: Base Dialog component needed a viewport-safe max-height and side margins to fix mobile overflow app-wide
---

The shadcn base `DialogContent` (`client/src/components/ui/dialog.tsx`) had no `max-height`/`overflow-y` and no side margin on mobile (`w-full`, centered, no inset). Any dialog with more than a screenful of content (e.g. forms with several fields, expandable "advanced parameters" sections) would overflow the viewport with unreachable content on small screens, and touch the screen edges.

**Why:** Fixing this per-dialog (adding `max-h-*` to every caller) doesn't scale and is easy to miss for new dialogs. Fixing it once in the base component covers every current and future `<Dialog>` usage in the app.

**How to apply:** When auditing/improving mobile responsiveness in a shadcn-based app, check the base `dialog.tsx` (and similarly `sheet.tsx`, `drawer.tsx` if present) first for `max-h-[90dvh] overflow-y-auto` and mobile-safe width (e.g. `w-[calc(100%-2rem)] max-w-lg`) before patching individual dialog call sites. Same pattern applies to any other fixed-width floating panel/modal built without the shared Dialog primitive (e.g. custom `fixed inset-0 flex items-center justify-center` modals) — give them `w-[calc(100%-2rem)] max-w-*` instead of a bare fixed width like `w-72`.
