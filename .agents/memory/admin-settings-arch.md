---
name: Admin system settings architecture
description: Key decisions for SystemSettings, TC reactivity, and hook ordering in caja/pos-virtual pages.
---

## Rule
Settings are stored **in-memory** on the server (`_systemSettings` variable in `storage.ts`) — they reset on server restart. No DB migration needed.

## TC / fmtMXN must be component-local
`const TC = 17.50` and `function fmtMXN` were originally at module level. They must live **inside the React component** so they re-derive on each render from `useSystemSettings()` data. Move any formatter that depends on TC inside the component as a regular arrow function (closure over TC).

## Hook ordering rule
`useState` declarations must always come **before** any `useEffect` that calls their setter. Placing a `useEffect(() => setLiveTxs(...), [...])` before `const [liveTxs, setLiveTxs] = useState(...)` causes a "Cannot access before initialization" runtime error because `const` is not hoisted.

## LIVE_SEED → buildLiveSeed
Convert static seed arrays to `buildLiveSeed(s: SystemSettings): LiveTx[]` module-level functions. Use `useState(() => buildLiveSeed(DEFAULT_SYSTEM_SETTINGS))` for initialization. Add a `useEffect` that calls `setLiveTxs(buildLiveSeed(settings))` when specific settings fields change. Use a `settingsRef` (updated via its own useEffect) inside interval timers to always read the latest settings without adding them as timer dependencies.

## Terminal params flow
- `DEFAULT_TERMINAL_PARAMS` in `use-terminal-params.ts` holds UI metadata (type/group/options/highlight).
- `settings.terminalParams` on the server holds `{label, value}[]` (values only, no metadata).
- `admin-settings.tsx` merges both: iterates `DEFAULT_TERMINAL_PARAMS` for type/group/options and reads values from `draft.terminalParams` via `getParamValue(label)`.
- `ReporteParametrosModal` in `pos-virtual.tsx` accepts a `params` prop so the rendered receipt reflects stored values, not hardcoded ones.

**Why:** The admin needs a single source of truth for all system-wide display values. Subscribers (non-admin users) see these values in real time without page reload because TanStack Query's `staleTime: 15000` causes automatic background refetch.
