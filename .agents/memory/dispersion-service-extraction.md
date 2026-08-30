---
name: Shared hot-wallet dispersion service
description: Why the hardened admin dispersion logic was extracted into server/crypto/dispersion-service.ts and how callers must use it.
---

The admin hot-wallet dispersion route originally contained the entire hardened
send pipeline inline (write-enabled flag, legacy-key check, signer/node health
checks, per-tx and daily limits with `pg_advisory_xact_lock`-based idempotency,
TRX reserve check, actual signer call). When a second caller needed the exact
same pipeline (user-initiated withdrawal approval, separate from direct admin
dispersion), the logic was extracted into `executeHotWalletDispersion` in
`server/crypto/dispersion-service.ts` rather than duplicated.

**Why:** duplicating a hardened funds-movement pipeline is how one caller
silently drifts from the other's safety checks over time (e.g. one path gets
a new limit and the other doesn't). A single function with two thin callers
keeps both bank-grade paths identical.

**How to apply:** any new flow that ultimately needs to send real USDT from
the platform hot wallet must call `executeHotWalletDispersion`, not
reimplement dispersion logic. The function does **not** verify the caller's
password — the caller (route handler) must authenticate first. Pass an
`idempotencyKey` derived deterministically from the business object being
acted on (e.g. `withdrawal-${requestId}`) so retries of the same approval
can never double-send.

A caller wrapping this in its own state machine (e.g. a withdrawal-request
status) must treat "a dispersion record was created" as a one-way door: once
the dispersion call returns an id (success, reconciled-duplicate, or an
"uncertain" signer result), the wrapping record can never be silently
reverted to a refundable/retryable state again, even if a *later* step (like
persisting the link) throws. Only revert when the response proves no
dispersion record was created at all. Getting this wrong lets an admin
retry-refund a withdrawal whose USDT already left the wallet.
