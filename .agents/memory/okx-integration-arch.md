---
name: OKX broker integration architecture
description: OKX as primary broker — client, env vars, pair map, auth, fallback chain, server IP
---

# OKX Broker Integration Architecture

## Rule
OKX is the active primary broker (priority 1). Kraken is the inactive fallback (priority 2). Binance is last-resort tertiary (geo-blocked, inactive).

**Why:** User switched from Kraken to OKX. API keys were being registered; IP whitelist required.

## Server outbound IP
`34.148.67.57` — must be whitelisted in OKX API key settings.

## Environment variables
- `OKX_API_KEY` — API key (required for private API)
- `OKX_API_SECRET` — secret (required for private API)
- `OKX_API_PASSPHRASE` — passphrase set at key creation (required for private API)
- `OKX_URL` — optional base URL override (default: https://www.okx.com)

## How to apply
- Public market data (prices, order book, OHLC, trades) works with NO credentials — server fetches directly
- Private API (orders, balance, withdrawals) activates once all 3 secrets are added; `hasPrivateCredentials()` check gates these routes
- Auth: `HMAC-SHA256(timestamp + METHOD + path + body, OKX_API_SECRET)` → Base64 in `OK-ACCESS-SIGN` header

## Pair map (OKX_PAIR)
btc→BTC-USDT, eth→ETH-USDT, xrp→XRP-USDT, ltc→LTC-USDT, doge→DOGE-USDT, sol→SOL-USDT, ada→ADA-USDT, dot→DOT-USDT

## Fallback chain
OKX → Kraken → Binance (in price-aggregator.ts fetchPrices())

## Key files
- `server/crypto/okx-client.ts` — full client (public + private API stubs)
- `server/crypto/price-aggregator.ts` — OKX primary fetch, Kraken fallback, Binance last resort
- `server/crypto/brokers.ts` — OKX priority:1 active:true; Kraken priority:2 active:false
- `server/routes.ts` — /api/okx/* routes (system, orderbook, ohlc, trades, pairs, capabilities)
- `client/src/pages/exchange.tsx` — order book widget queries /api/okx/orderbook/:asset; EXCHANGE_MAINTENANCE=true until keys loaded
