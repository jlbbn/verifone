/**
 * Banxico Plus LLC — OKX REST Client  v1
 *
 * Public API  (no auth): systemStatus · instruments · ticker · allTickers · ohlc · orderBook · recentTrades
 * Private API (OKX_API_KEY + OKX_API_SECRET + OKX_API_PASSPHRASE):
 *   balance · addOrder · cancelOrder · withdraw · depositAddresses · getWsToken
 *
 * Authentication : HMAC-SHA256 over (timestamp + METHOD + requestPath + body)  → Base64
 * Headers        : OK-ACCESS-KEY · OK-ACCESS-SIGN · OK-ACCESS-TIMESTAMP · OK-ACCESS-PASSPHRASE
 * Rate-limit     : public ~20 req/2s  |  private: 10–60 req/2s per endpoint
 * Base URL       : process.env.OKX_URL ?? "https://www.okx.com"
 */

import { createHmac } from "crypto";

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL    = (process.env.OKX_URL ?? "https://www.okx.com").replace(/\/$/, "");
const API_KEY     = process.env.OKX_API_KEY          ?? "";
const API_SECRET  = process.env.OKX_SECRETKEY        ?? "";
const PASSPHRASE  = process.env.OKX_API_PASSPHRASE   ?? "";
const TIMEOUT     = 9_000;

// ─── Asset pair map  (internal id → OKX instId) ───────────────────────────────

export const OKX_PAIR: Record<string, string> = {
  btc:  "BTC-USDT",
  eth:  "ETH-USDT",
  xrp:  "XRP-USDT",
  ltc:  "LTC-USDT",
  doge: "DOGE-USDT",
  sol:  "SOL-USDT",
  ada:  "ADA-USDT",
  dot:  "DOT-USDT",
};

// ─── Typed responses ──────────────────────────────────────────────────────────

export type OkxSystemState = "online" | "maintenance" | "degraded";

export interface OkxSystemInfo {
  status:    OkxSystemState;
  message:   string;
  timestamp: string;
}

export interface OkxTicker {
  instId:    string;
  last:      string;   // last price
  askPx:     string;   // best ask
  askSz:     string;
  bidPx:     string;   // best bid
  bidSz:     string;
  open24h:   string;
  high24h:   string;
  low24h:    string;
  volCcy24h: string;   // volume in quote currency (USDT)
  vol24h:    string;   // volume in base currency
  ts:        string;   // epoch ms
}

export interface OkxTickerSummary {
  localId:   string;
  instId:    string;
  price:     number;
  ask:       number;
  bid:       number;
  high24h:   number;
  low24h:    number;
  open24h:   number;
  change24h: number;
  volume24h: number;
}

/** asks/bids: [price, size, liquidated-orders, orders-count] */
export interface OkxOrderBook {
  asset:  string;
  instId: string;
  asks:   Array<[string, string, string, string]>;
  bids:   Array<[string, string, string, string]>;
  ts:     string;
}

/** candles: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm] */
export interface OkxOhlc {
  instId:  string;
  candles: string[][];
}

export interface OkxTrade {
  tradeId: string;
  instId:  string;
  px:      string;
  sz:      string;
  side:    "buy" | "sell";
  ts:      string;
}

// ─── Rate limiter (token bucket) ──────────────────────────────────────────────

let _tokens   = 20;
const MAX_TOK = 20;
const REFILL  = 10; // tokens per second

setInterval(() => { _tokens = Math.min(MAX_TOK, _tokens + REFILL); }, 1_000).unref();

async function rateGuard(): Promise<void> {
  if (_tokens > 0) { _tokens--; return; }
  await new Promise<void>(r => setTimeout(r, 300));
  _tokens = Math.max(0, _tokens - 1);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function get<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
  await rateGuard();
  const qs  = params ? "?" + new URLSearchParams(params).toString() : "";
  const url = `${BASE_URL}${path}${qs}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`OKX GET ${path} → HTTP ${res.status}`);
  const json: any = await res.json();
  if (json.code !== "0") throw new Error(`OKX error [${json.code}]: ${json.msg}`);
  return json.data as T;
}

// ─── HMAC-SHA256 sign for private API ────────────────────────────────────────

function sign(timestamp: string, method: string, path: string, body = ""): string {
  const msg = timestamp + method.toUpperCase() + path + body;
  return createHmac("sha256", API_SECRET).update(msg).digest("base64");
}

async function privateGet<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
  await rateGuard();
  const qs   = params ? "?" + new URLSearchParams(params).toString() : "";
  const ts   = new Date().toISOString();
  const sig  = sign(ts, "GET", path + qs);
  const url  = `${BASE_URL}${path}${qs}`;

  const res  = await fetch(url, {
    headers: {
      Accept:                 "application/json",
      "OK-ACCESS-KEY":        API_KEY,
      "OK-ACCESS-SIGN":       sig,
      "OK-ACCESS-TIMESTAMP":  ts,
      "OK-ACCESS-PASSPHRASE": PASSPHRASE,
    },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`OKX private GET ${path} → HTTP ${res.status}`);
  const json: any = await res.json();
  if (json.code !== "0") throw new Error(`OKX private error [${json.code}]: ${json.msg}`);
  return json.data as T;
}

async function privatePost<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
  await rateGuard();
  const ts      = new Date().toISOString();
  const bodyStr = JSON.stringify(body);
  const sig     = sign(ts, "POST", path, bodyStr);
  const url     = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type":         "application/json",
      Accept:                 "application/json",
      "OK-ACCESS-KEY":        API_KEY,
      "OK-ACCESS-SIGN":       sig,
      "OK-ACCESS-TIMESTAMP":  ts,
      "OK-ACCESS-PASSPHRASE": PASSPHRASE,
    },
    body:   bodyStr,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`OKX private POST ${path} → HTTP ${res.status}`);
  const json: any = await res.json();
  if (json.code !== "0") throw new Error(`OKX private error [${json.code}]: ${json.msg}`);
  return json.data as T;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * System status — returns "online" when no active maintenance.
 * OKX /api/v5/system/status returns scheduled maintenance items;
 * empty array means all systems operational.
 */
export async function systemStatus(): Promise<OkxSystemInfo> {
  try {
    const data: any[] = await get("/api/v5/system/status", { state: "ongoing" });
    if (!data || data.length === 0) {
      return { status: "online", message: "All systems operational", timestamp: new Date().toISOString() };
    }
    const item = data[0];
    const state: OkxSystemState =
      item.state === "ongoing"  ? "maintenance" :
      item.state === "pre_open" ? "degraded"    : "online";
    return { status: state, message: item.title ?? "Maintenance in progress", timestamp: new Date().toISOString() };
  } catch {
    return { status: "online", message: "Status check unavailable", timestamp: new Date().toISOString() };
  }
}

/** Single ticker for one instId */
export async function ticker(instId: string): Promise<OkxTicker> {
  const data: any[] = await get("/api/v5/market/ticker", { instId });
  if (!data?.[0]) throw new Error(`No ticker data for ${instId}`);
  return data[0] as OkxTicker;
}

/** All SPOT tickers at once — most efficient for aggregator */
export async function allSpotTickers(): Promise<OkxTicker[]> {
  const data: any[] = await get("/api/v5/market/tickers", { instType: "SPOT" });
  return data as OkxTicker[];
}

/**
 * Fetch and normalise all tracked pairs in one API call.
 * Returns a map keyed by our internal asset id (btc, eth, …).
 */
export async function fetchAllTickers(): Promise<Record<string, OkxTickerSummary>> {
  const all     = await allSpotTickers();
  const indexed = new Map(all.map(t => [t.instId, t]));
  const result: Record<string, OkxTickerSummary> = {};

  for (const [localId, instId] of Object.entries(OKX_PAIR)) {
    const t = indexed.get(instId);
    if (!t) continue;

    const last   = parseFloat(t.last    ?? "0");
    const open   = parseFloat(t.open24h ?? "0");
    const ch24h  = open > 0 ? ((last - open) / open) * 100 : 0;

    result[localId] = {
      localId,
      instId,
      price:     last,
      ask:       parseFloat(t.askPx    ?? "0"),
      bid:       parseFloat(t.bidPx    ?? "0"),
      high24h:   parseFloat(t.high24h  ?? "0"),
      low24h:    parseFloat(t.low24h   ?? "0"),
      open24h:   open,
      change24h: parseFloat(ch24h.toFixed(4)),
      volume24h: parseFloat(t.volCcy24h ?? "0"),
    };
  }

  return result;
}

/** Order book */
export async function orderBook(instId: string, sz = 10): Promise<OkxOrderBook> {
  const data: any[] = await get("/api/v5/market/books", {
    instId,
    sz: String(Math.min(sz, 400)),
  });
  if (!data?.[0]) throw new Error(`No order book for ${instId}`);
  const raw  = data[0];
  const asset = Object.entries(OKX_PAIR).find(([, v]) => v === instId)?.[0] ?? instId;
  return {
    asset,
    instId,
    asks: raw.asks ?? [],
    bids: raw.bids ?? [],
    ts:   raw.ts   ?? "",
  };
}

/**
 * OHLC candles
 * bar: "1m"|"3m"|"5m"|"15m"|"30m"|"1H"|"2H"|"4H"|"6H"|"12H"|"1D"
 */
export async function ohlc(instId: string, bar = "1H", limit = 48): Promise<OkxOhlc> {
  const data: any[] = await get("/api/v5/market/candles", {
    instId,
    bar,
    limit: String(limit),
  });
  return { instId, candles: data ?? [] };
}

/** Recent trades */
export async function recentTrades(instId: string, limit = 20): Promise<OkxTrade[]> {
  const data: any[] = await get("/api/v5/market/trades", {
    instId,
    limit: String(limit),
  });
  return (data ?? []).map((t: any): OkxTrade => ({
    tradeId: t.tradeId,
    instId:  t.instId,
    px:      t.px,
    sz:      t.sz,
    side:    t.side,
    ts:      t.ts,
  }));
}

/** Available SPOT instruments */
export async function instruments(): Promise<any[]> {
  return get("/api/v5/public/instruments", { instType: "SPOT" });
}

/** Simple connectivity check */
export async function ping(): Promise<boolean> {
  try {
    await get("/api/v5/public/time");
    return true;
  } catch { return false; }
}

/** Whether private API credentials are configured */
export function hasPrivateCredentials(): boolean {
  return !!(API_KEY && API_SECRET && PASSPHRASE);
}

// ─── PRIVATE API (active once secrets are added) ──────────────────────────────

/** Account balances across all currencies */
export async function balance(): Promise<Record<string, { available: number; frozen: number }>> {
  const data: any[] = await privateGet("/api/v5/account/balance");
  const result: Record<string, { available: number; frozen: number }> = {};
  const details: any[] = data?.[0]?.details ?? [];
  for (const d of details) {
    result[d.ccy] = {
      available: parseFloat(d.availBal ?? "0"),
      frozen:    parseFloat(d.frozenBal ?? "0"),
    };
  }
  return result;
}

/**
 * Place a spot order.
 * side: "buy" | "sell"
 * ordType: "market" | "limit" | "post_only" | "fok" | "ioc"
 */
export async function addOrder(params: {
  instId:  string;
  side:    "buy" | "sell";
  ordType: "market" | "limit" | "post_only" | "fok" | "ioc";
  sz:      string;          // base currency amount
  px?:     string;          // required for limit orders
  tdMode?: "cash" | "cross" | "isolated";
  clOrdId?: string;
}): Promise<{ ordId: string; clOrdId: string; tag: string; sCode: string; sMsg: string }[]> {
  return privatePost("/api/v5/trade/order", {
    instId:  params.instId,
    tdMode:  params.tdMode ?? "cash",
    side:    params.side,
    ordType: params.ordType,
    sz:      params.sz,
    ...(params.px      ? { px:      params.px }      : {}),
    ...(params.clOrdId ? { clOrdId: params.clOrdId } : {}),
  });
}

/** Cancel an open order */
export async function cancelOrder(instId: string, ordId: string): Promise<any[]> {
  return privatePost("/api/v5/trade/cancel-order", { instId, ordId });
}

/** Initiate a crypto withdrawal */
export async function withdraw(params: {
  ccy:    string;   // e.g. "USDT"
  amt:    string;   // amount
  dest:   "4";      // "4" = on-chain
  toAddr: string;
  fee:    string;   // withdrawal fee
  chain:  string;   // e.g. "USDT-TRC20"
}): Promise<any[]> {
  return privatePost("/api/v5/asset/withdrawal", params);
}

/** Deposit addresses for a currency */
export async function depositAddresses(ccy: string, chain?: string): Promise<any[]> {
  return privateGet("/api/v5/asset/deposit-address", {
    ccy,
    ...(chain ? { chain } : {}),
  });
}

/** WebSocket login token (for WS private channels) */
export async function getWsToken(): Promise<string> {
  const data: any[] = await privatePost("/api/v5/users/generate-one-time-token", {});
  return data?.[0]?.token ?? "";
}
