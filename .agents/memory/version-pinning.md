---
name: Version pinning constraints
description: Packages that must stay pinned in this repl and why; shadcn components broken by over-upgrades
---

# Pinned dependency constraints

These versions must NOT be bumped without fixing the listed breakage first:

- **express@4** — express@5 breaks the `"*"` wildcard route in `server/vite.ts` (a forbidden-to-edit file).
- **react@18, vite@5, tailwindcss@3, @vitejs/plugin-react@4** — toolchain pinned for compatibility.

**Why:** An earlier blanket "update everything to latest" upgraded react-day-picker (v8→v9), recharts (→v3),
and react-resizable-panels, which broke the corresponding shadcn UI wrapper components
(`calendar.tsx`, `chart.tsx`, `resizable.tsx`) with type errors. The app still *ran* because
tsx/esbuild skip type-checking, so the breakage was invisible until `tsc --noEmit`.

**How to apply:**
- Pages use **recharts directly**, NOT the shadcn `chart.tsx` wrapper. Removing the wrapper is safe; removing recharts is not.
- Pages only import these shadcn components: badge, button, card, form, input, select, sidebar, textarea, toaster, tooltip.
  Other shadcn components are unused — if an upgrade breaks an unused one, deleting the unused file (and its now-orphaned deps) is the clean fix.
- After any dependency change, run `npx tsc --noEmit` — the dev workflow alone will NOT surface type regressions.
- tsconfig.json needs `"ignoreDeprecations": "6.0"` because TS 6.0 turned the baseUrl deprecation into an error.
