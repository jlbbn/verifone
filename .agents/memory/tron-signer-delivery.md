---
name: TRON signer delivery guarantees
description: Fail-closed rules for hot-wallet transfer delivery and settlement confirmation.
---

Persist the exact signed transaction and deterministic txid durably before any
TRON broadcast. On a timeout or restart, query or rebroadcast those same signed
bytes with the same idempotency key; never rebuild a transaction for a pending
request. Confirm a dispersion only from the official USDT `Transfer` event
after exact source, destination, contract and atomic amount checks, plus an
explicit successful receipt.

Treat the FullNode as untrusted transaction-building input: before signing,
independently decode and match the single contract call, owner, official token,
selector, destination, atomic amount, side values, fee, TAPOS, expiration and
serialized-protobuf/txid consistency. Write-capable paths require an explicitly
approved RFC1918 node origin; never fall back to a public RPC.

**Why:** A failure between broadcast and acknowledgment otherwise leaves an
unknown transaction that a retry can accidentally duplicate. A stale or
peerless RPC node, or incomplete receipt, can also produce unsafe write or
settlement decisions.

**How to apply:** Any future wallet write path must require fresh head age and
minimum active peers from both the app-approved node and the signer's own node,
with matching approved endpoint and wallet identity. Use atomic integer units
for money limits and comparisons, and validate node-built unsigned transactions
before private-key use.