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

Network names are not chain identity. Both the app and isolated signer must
compare the private RPC's genesis block ID with the selected network before
reporting healthy or permitting a write. LITE fullnodes close the genesis API
("this API is closed because this node is a lite fullnode"), so identity must
fall back to the profile's p2pVersion (mainnet "11111", nile "201910292"; the
HTTP API returns it as a STRING — compare as strings). A genesis MISMATCH wins
over a p2p match: it means wrong chain. No evidence at all means no match.
Scope signer state, idempotency, and daily limits by network; Nile uses its
own wallet and state path.

A presentation or demo labeled read-only must not reuse a broad infrastructure
health call if that call probes the isolated signer. Give it a purpose-built
read model that reads only approved node evidence and persisted audit data.

**Why:** A failure between broadcast and acknowledgment otherwise leaves an
unknown transaction that a retry can accidentally duplicate. A stale or
peerless RPC node, or incomplete receipt, can also produce unsafe write or
settlement decisions. A correctly labeled Nile profile can still point at a
mainnet RPC, and shared state can make one network interfere with the other.
Even a GET can violate demo isolation when it reaches operational signer
infrastructure.

**How to apply:** Any future wallet write path must require fresh head age and
minimum active peers from both the app-approved node and the signer's own node,
with matching approved endpoint, genesis identity, network contract, and wallet
identity. Lite-mode operation (TRON_NODE_LITE=true) passed security review as a
misconfiguration defense, not a trust root: the VPC-private pinned node is the
declared trust boundary. Production must alert unless signer health shows
exactly healthy + liteMode + closed_lite_node + expected p2pVersion, and
settlement only follows receipt SUCCESS + exact Transfer event — never the
signer's broadcast state. Use atomic integer units for money limits and comparisons, and
validate node-built unsigned transactions before private-key use.
For explanatory surfaces, keep scenario changes browser-local and expose a
separate admin-only evidence projection with no signer dependency.
## tronweb v6 API (lección Ago 2026)
- v6 eliminó el estático `TronWeb.utils` (era la ruta v5). Generación de cuentas: `import { utils } from "tronweb"` → `utils.accounts.generateAccount()`.
- Los estáticos `TronWeb.isAddress` y `TronWeb.address.*` SÍ existen en v6 — el código del firmante los usa y es compatible.

## Ensayos dependientes de fondeo humano
- No esperar en sesión: dejar un systemd timer (5 min) que detecta fondos on-chain, corre el ensayo una vez, escribe flag ENSAYO_COMPLETO y se auto-desactiva. El agente solo verifica el flag/log en la siguiente sesión.
