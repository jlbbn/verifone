---
name: Express.User type collision with passport
description: Why a custom req property typed with a local "User" type fails inside declare global namespace Express
---

# Augmenting Express.Request with an app User type

When adding a custom property to `Express.Request` (e.g. `req.currentUser`) via
`declare global { namespace Express { interface Request { ... } } }`, a bare
type reference named `User` does NOT resolve to your imported app `User` — it
resolves to passport's empty `Express.User` interface (pulled in by
`@types/passport` through the Replit auth integration). Result: a misleading
`Property 'X' does not exist on type 'User'` error.

**Why:** Inside `namespace Express`, name lookup prefers the sibling `Express.User`
declaration over a module-scoped import.

**How to apply:** Use an inline import type to force resolution:
`currentUser?: import("@shared/schema").User;`  (or alias the import to a unique
name). Do not rely on the bare imported `User` name inside the Express namespace.
