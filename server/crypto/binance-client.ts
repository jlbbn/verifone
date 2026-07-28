/**
 * Banxico Plus LLC — Binance REST Client  v1
 *
 * Public API  (no auth): systemStatus · ticker · allTickers · ohlc · orderBook · recentTrades
 * Private API (BINANCE_API_KEY + BINANCE_SECRET_KEY):
 *   balance · newOrder · cancelOrder
 *
 * Authentication : HMAC-SHA256 over query string / body, appended as `signature`
 * Headers        : X-MBX-APIKEY
 * Rate-limit     : public 1200 req/min weight  |  private 600 req/min weight
 * Base URL       : process.env.BINANCE_URL ?? "https://api.binance.com"
 *
 * Nota geográfica: Binance puede retornar HTTP 451 desde IPs de EE.UU. en endpoints privados.
 * Los endpoints públicos (/api/v3/ticker, /api/v3/depth) generalmente están disponibles.
 */

import { createHmac } from "crypto";

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL   = (process.env.BINANCE_URL ?? "https://api.binance.com").replace(/\/$/, "");
const API_KEY    = process.env.BINANCE_API_KEY    ?? "";
const API_SECRET = process.env.BINANCE_SECRET_KEY ?? "";
const TIMEOUT    = 9_000;

// ─── Asset pair map (internal id → Binance symbol) ───────────────────────────

export const BINANCE_PAIR: Record<string, string> = {
  btc:  "BTCUSDT",
  eth:  "ETHUSDT",
  xrp:  "XRPUSDT",
  ltc:  "LTCUSDT",
  doge: "DOGEUSDT",
  sol:  "SOLUSDT",
  ada:  "ADAUSDT",
  dot:  "DOTUSDT",
};

// ─── Typed responses ──────────────────────────────────────────────────────────

export interface BinanceTicker24hr {
  symbol:             string;
  priceChange:        string;
  priceChangePercent: string;
  weightedAvgPrice:   string;
  prevClosePrice:     string;
  lastPrice:          string;
  lastQty:            string;
  bidPrice:           string;
  bidQty:             string;
  askPrice:           string;
  askQty:             string;
  openPrice:          string;
  highPrice:          string;
  lowPrice:           string;
  volume:             string;
  quoteVolume:        string;
  openTime:           number;
  closeTime:          number;
  count:              number;
}

export interface BinanceTickerSummary {
  localId:   string;
  symbol:    string;
  price:     number;
  ask:       number;
  bid:       number;
  high24h:   number;
  low24h:    number;
  change24h: number;
  volume24h: number;
}

export interface BinanceOrderBook {
  asset:        string;
  symbol:       string;
  lastUpdateId: number;
  asks:         Array<[string, string]>;  // [price, qty]
  bids:         Array<[string, string]>;
}

/** [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, ...] */
export type BinanceKline = [
  number, string, string, string, string, string,
  number, string, number, string, string, string
];

export interface BinanceOrderResult {
  symbol:        string;
  orderId:       number;
  clientOrderId: string;
  transactTime:  number;
  price:         string;
  origQty:       string;
  executedQty:   string;
  cummulativeQuoteQty: string;
  status:        string;
  type:          string;
  side:          string;
  fills?:        Array<{ price: string; qty: string; commission: string; commissionAsset: string }>;
}

export interface BinanceBalance {
  asset:  string;
  free:   string;
  locked: string;
}

// ─── Rate limiter (token bucket) ─────────────────────────────────────────────

let _tokens   = 20;
const MAX_TOK = 20;
const REFILL  = 20;

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
  if (!res.ok) throw new Error(`Binance GET ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── HMAC-SHA256 sign ─────────────────────────────────────────────────────────

function sign(queryString: string): string {
  return createHmac("sha256", API_SECRET).update(queryString).digest("hex");
}

async function privateGet<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T> {
  await rateGuard();
  const timestamp = Date.now().toString();
  const allParams = { ...params, timestamp };
  const qs        = new URLSearchParams(allParams).toString();
  const signature = sign(qs);
  const url       = `${BASE_URL}${path}?${qs}&signature=${signature}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-MBX-APIKEY": API_KEY },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Binance private GET ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function privatePost<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T> {
  await rateGuard();
  const timestamp = Date.now().toString();
  const allParams = { ...params, timestamp };
  const qs        = new URLSearchParams(allParams).toString();
  const signature = sign(qs);

  const res = await fetch(`${BASE_URL}${path}`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept:         "application/json",
      "X-MBX-APIKEY": API_KEY,
    },
    body:   `${qs}&signature=${signature}`,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Binance private POST ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * System status — GET /api/v3/ping  (returns {} on success)
 * Returns true if exchange is reachable.
 */
export async function systemStatus(): Promise<{ reachable: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await get("/api/v3/ping");
    return { reachable: true, latencyMs: Date.now() - start };
  } catch {
    return { reachable: false, latencyMs: Date.now() - start };
  }
}

/**
 * 24hr ticker for a single symbol.
 */
export async function ticker24hr(symbol: string): Promise<BinanceTicker24hr> {
  return get<BinanceTicker24hr>("/api/v3/ticker/24hr", { symbol: symbol.toUpperCase() });
}

/**
 * 24hr tickers for all tracked pairs, mapped to BinanceTickerSummary.
 */
export async function fetchAllTickers(): Promise<Record<string, BinanceTickerSummary>> {
  const symbols = JSON.stringify(Object.values(BINANCE_PAIR));
  const rows    = await get<BinanceTicker24hr[]>("/api/v3/ticker/24hr", {
    symbols: symbols,
  });

  const result: Record<string, BinanceTickerSummary> = {};
  for (const [localId, sym] of Object.entries(BINANCE_PAIR)) {
    const row = rows.find(r => r.symbol === sym);
    if (!row) continue;
    result[localId] = {
      localId,
      symbol:    row.symbol,
      price:     parseFloat(row.lastPrice          ?? "0"),
      ask:       parseFloat(row.askPrice           ?? "0"),
      bid:       parseFloat(row.bidPrice           ?? "0"),
      high24h:   parseFloat(row.highPrice          ?? "0"),
      low24h:    parseFloat(row.lowPrice           ?? "0"),
      change24h: parseFloat(row.priceChangePercent ?? "0"),
      volume24h: parseFloat(row.quoteVolume        ?? "0"),
    };
  }
  return result;
}

/**
 * Order book depth for a single asset (default 20 levels).
 */
export async function orderBook(asset: string, limit = 20): Promise<BinanceOrderBook> {
  const symbol = BINANCE_PAIR[asset.toLowerCase()];
  if (!symbol) throw new Error(`Binance: par no soportado para ${asset}`);

  const raw = await get<{ lastUpdateId: number; asks: string[][]; bids: string[][] }>(
    "/api/v3/depth",
    { symbol, limit: String(limit) },
  );

  return {
    asset,
    symbol,
    lastUpdateId: raw.lastUpdateId,
    asks: raw.asks as Array<[string, string]>,
    bids: raw.bids as Array<[string, string]>,
  };
}

/**
 * Kline/OHLC data.
 * interval: "1m"|"5m"|"15m"|"1h"|"4h"|"1d"
 */
export async function klines(asset: string, interval = "1h", limit = 100): Promise<BinanceKline[]> {
  const symbol = BINANCE_PAIR[asset.toLowerCase()];
  if (!symbol) throw new Error(`Binance: par no soportado para ${asset}`);

  return get<BinanceKline[]>("/api/v3/klines", { symbol, interval, limit: String(limit) });
}

/**
 * Recent trades for a symbol.
 */
export async function recentTrades(
  asset: string,
  limit = 50,
): Promise<Array<{ id: number; price: string; qty: string; time: number; isBuyerMaker: boolean }>> {
  const symbol = BINANCE_PAIR[asset.toLowerCase()];
  if (!symbol) throw new Error(`Binance: par no soportado para ${asset}`);

  return get("/api/v3/trades", { symbol, limit: String(limit) });
}

// ─── PRIVATE API ──────────────────────────────────────────────────────────────

export function hasPrivateCredentials(): boolean {
  return Boolean(API_KEY && API_SECRET);
}

/**
 * Account balances — GET /api/v3/account
 */
export async function accountBalances(): Promise<BinanceBalance[]> {
  const data = await privateGet<{ balances: BinanceBalance[] }>("/api/v3/account");
  return data.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
}

/**
 * Place a market order.
 * side: "BUY" | "SELL"
 * For SELL → quantity is in base asset (e.g. BTC).
 * For BUY  → use quoteOrderQty to specify USDT amount.
 */
export async function newOrder(params: {
  symbol:         string;
  side:           "BUY" | "SELL";
  type?:          string;
  quantity?:      string;  // base asset qty (for SELL)
  quoteOrderQty?: string;  // quote asset qty in USDT (for BUY)
}): Promise<BinanceOrderResult> {
  const p: Record<string, string> = {
    symbol:   params.symbol,
    side:     params.side,
    type:     params.type ?? "MARKET",
  };
  if (params.quantity)      p.quantity      = params.quantity;
  if (params.quoteOrderQty) p.quoteOrderQty = params.quoteOrderQty;

  return privatePost<BinanceOrderResult>("/api/v3/order", p);
}
