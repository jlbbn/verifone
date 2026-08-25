---
name: TRON lite fullnode API limits vs TronWeb defaults
description: Two distinct pitfalls when a TronWeb-based signer talks to a self-hosted single "lite fullnode" TRON node (no separate solidity-node role) — read before touching signer.mjs's node calls or any node-facing rehearsal/ops script.
---

## 1. TronWeb methods that route through the "solidity node" role 405 on a single-node deployment
`tron.trx.getBalance()` / `tron.trx.getAccount()` internally call `solidityNode.request('walletsolidity/getaccount', ...)`. When TronWeb is constructed with only `fullHost` (no separate `solidityNode`), it reuses the same host — but a lite/single full node does not serve `walletsolidity/*` and returns HTTP 405, surfaced as a bare `{status: 405, code: "ERR_BAD_REQUEST"}` with no domain-specific error code.

**Why:** the TRON signer's TRX-reserve check (`tron-signer/signer.mjs`) used `trx.getBalance()` and would 405 on every real transfer attempt against this kind of node — a silent, guaranteed failure that only surfaced via the Nile rehearsal, not via code review.

**How to apply:** any TronWeb call must be checked for which "node role" it calls. Use `tron.trx.getUnconfirmedAccount(address)` (routes through `fullNode.request('wallet/getaccount', ..., 'post')`) instead, and read `.balance` from the result. Treat this as needing an audit anywhere else in the codebase that calls `trx.getBalance`/`trx.getAccount` against a single-node TRON deployment (including mainnet, which uses the same signer code).

## 2. Lite fullnodes permanently close transaction-lookup APIs
`wallet/gettransactioninfobyid` and `wallet/gettransactionbyid` respond `"this API is closed because this node is a lite fullnode"` unconditionally — not a timing/indexing delay, no amount of retrying or waiting fixes it.

**Why:** the Nile rehearsal script polled the local node for the receipt after a successful broadcast and looped forever (`ENSAYO_INCOMPLETO`, lock reopening every timer tick) even though the transfer had already succeeded on-chain (verified independently against public TronGrid).

**How to apply:** any read-only confirmation/receipt check against a lite-node deployment must go to a different node/public API instead (e.g. `https://nile.trongrid.io` for testnet, or a full-role node for mainnet) — never assume "just retry longer" will work for these two calls on a lite node.
