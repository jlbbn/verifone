/**
 * Banxico Plus LLC — Kraken REST Client
 *
 * Public API  (no auth): systemStatus · assetPairs · assets · ticker · ohlc · orderBook · recentTrades
 * Private API (KRAKEN_API_KEY + KRAKEN_API_SECRET): balance · addOrder · cancelOrder
 *                                                    withdraw · withdrawStatus · depositAddresses
 *
 * Authentication : HMAC-SHA512 over (path + SHA256(nonce + body))
 * Rate-limit     : public ~1 req/sec  |  private: Kraken counter tier system
 * Base URL       : process.env.KRAKEN_URL ?? "https://api.kraken.com"
 */

import { createHmac, createHash } from "crypto";

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL  = (process.env.KRAKEN_URL ?? "https://api.kraken.com").replace(/\/$/, "");
const API_KEY   = process.env.KRAKEN_API_KEY    ?? "";
const API_SEC   = process.env.KRAKEN_API_SECRET ?? "";
const TIMEOUT   = 9_000; // ms

// ─── Public type exports ──────────────────────────────────────────────────────

export type KrakenSystemStatus = "online" | "cancel_only" | "post_only" | "limit_only" | "maintenance";

export interface KrakenSystemInfo {
  status:    KrakenSystemStatus;
  timestamp: string;
}

export interface KrakenTickerInfo {
  /** ask  [price, whole-lot-volume, lot-volume] */
  a: [string, string, string];
  /** bid  [price, whole-lot-volume, lot-volume] */
  b: [string, string, string];
  /** last trade [price, lot-volume] */
  c: [string, string];
  /** volume [today, last-24h] */
  v: [string, string];
  /** VWAP [today, last-24h] */
  p: [string, string];
  /** trade count [today, last-24h] */
  t: [number, number];
  /** low [today, last-24h] */
  l: [string, string];
  /** high [today, last-24h] */
  h: [string, string];
  /** today's opening price */
  o: string;
}

/** [time, open, high, low, close, vwap, volume, count] */
export type KrakenOHLCCandle = [number, string, string, string, string, string, string, number];

export interface KrakenOrderBook {
  asks: Array<[string, string, number]>; // [price, volume, timestamp]
  bids: Array<[string, string, number]>;
}

export interface KrakenAssetPair {
  altname:         string;
  wsname?:         string;
  aclass_base:     string;
  base:            string;
  aclass_quote:    string;
  quote:           string;
  lot:             string;
  pair_decimals:   number;
  lot_decimals:    number;
  lot_multiplier:  number;
  leverage_buy:    number[];
  leverage_sell:   number[];
  fees:            Array<[number, number]>;
  fees_maker?:     Array<[number, number]>;
  fee_volume_currency: string;
  margin_call:     number;
  margin_stop:     number;
  ordermin:        string;
}

export interface KrakenAsset {
  aclass:   string;
  altname:  string;
  decimals: number;
  display_decimals: number;
}

export interface KrakenTradeEntry {
  price:     string;
  volume:    string;
  time:      number;
  buySell:   "b" | "s";
  marketLimit: "m" | "l";
  misc:      string;
}

// ─── Private API types ────────────────────────────────────────────────────────

export interface KrakenBalance {
  [asset: string]: string; // asset → balance string
}

export interface KrakenAddOrderResult {
  descr:  { order: string; close?: string };
  txid:   string[];
}

export interface KrakenWithdrawResult {
  refid: string;
}

export interface KrakenWithdrawStatus {
  method:   string;
  network?: string;
  aclass:   string;
  asset:    string;
  refid:    string;
  txid?:    string;
  info?:    string;
  amount:   string;
  fee?:     string;
  time:     number;
  status:   string;
}

export interface KrakenDepositAddress {
  address:    string;
  expiretm:   string;
  new?:       boolean;
}

// ─── Pair normalization ───────────────────────────────────────────────────────

/** Canonical Kraken pair names for our supported assets */
export const KRAKEN_PAIR: Record<string, string> = {
  btc:  "XBTUSD",
  eth:  "ETHUSD",
  xrp:  "XRPUSD",
  ltc:  "LTCUSD",
  doge: "DOGEUSD",
  sol:  "SOLUSD",
  ada:  "ADAUSD",
  dot:  "DOTUSD",
};

/** Reverse map: Kraken pair key → local asset id */
export function resolveLocalId(krakenKey: string): string | undefined {
  const upper = krakenKey.toUpperCase();
  for (const [local, pair] of Object.entries(KRAKEN_PAIR)) {
    const normalized = pair.replace(/USD$/, "");
    if (
      upper === pair ||
      upper === `X${normalized}ZUSD` ||
      upper === `X${normalized}USD` ||
      upper.replace(/^X|Z/g, "").includes(normalized)
    ) {
      return local;
    }
  }
  return undefined;
}

// ─── Rate limiter (simple token bucket) ──────────────────────────────────────

const BUCKET_MAX      = 15;   // Kraken Starter counter max
const BUCKET_REFILL   = 0.5;  // tokens / second (conservative)
let   _tokens         = BUCKET_MAX;
let   _lastRefill     = Date.now();

function consumeToken(cost = 1): void {
  const now  = Date.now();
  const secs = (now - _lastRefill) / 1_000;
  _tokens    = Math.min(BUCKET_MAX, _tokens + secs * BUCKET_REFILL);
  _lastRefill = now;
  if (_tokens < cost) throw new Error("KRAKEN_RATE_LIMIT");
  _tokens -= cost;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function publicGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (!res.ok) throw new Error(`Kraken HTTP ${res.status} — ${path}`);
  const body: { error: string[]; result: T } = await res.json();
  if (body.error?.length) throw new Error(`Kraken API error: ${body.error.join(", ")}`);
  return body.result;
}

function buildSignature(path: string, nonce: number, postData: string): string {
  if (!API_SEC) throw new Error("KRAKEN_API_SECRET no configurado");
  const hash    = createHash("sha256").update(String(nonce) + postData).digest();
  const message = Buffer.concat([Buffer.from(path), hash]);
  return createHmac("sha512", Buffer.from(API_SEC, "base64")).update(message).digest("base64");
}

async function privatePost<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_KEY) throw new Error("KRAKEN_API_KEY no configurado — solo API pública disponible");
  consumeToken();

  const nonce    = Date.now() * 1_000;
  const postData = new URLSearchParams({ nonce: String(nonce), ...params }).toString();
  const sign     = buildSignature(path, nonce, postData);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "API-Key":  API_KEY,
      "API-Sign": sign,
    },
    body: postData,
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (!res.ok) throw new Error(`Kraken HTTP ${res.status} — ${path}`);
  const body: { error: string[]; result: T } = await res.json();
  if (body.error?.length) throw new Error(`Kraken API error: ${body.error.join(", ")}`);
  return body.result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Current system status and timestamp */
export async function systemStatus(): Promise<KrakenSystemInfo> {
  return publicGet<KrakenSystemInfo>("/0/public/SystemStatus");
}

/** Asset info for one or more assets */
export async function assets(assetList?: string): Promise<Record<string, KrakenAsset>> {
  const params = assetList ? { asset: assetList } : undefined;
  return publicGet<Record<string, KrakenAsset>>("/0/public/Assets", params);
}

/** Available trading pairs */
export async function assetPairs(pairs?: string): Promise<Record<string, KrakenAssetPair>> {
  const params = pairs ? { pair: pairs } : undefined;
  return publicGet<Record<string, KrakenAssetPair>>("/0/public/AssetPairs", params);
}

/**
 * Ticker for one or more pairs (comma-separated).
 * Returns keyed by the Kraken internal pair name.
 */
export async function ticker(pairs: string): Promise<Record<string, KrakenTickerInfo>> {
  return publicGet<Record<string, KrakenTickerInfo>>("/0/public/Ticker", { pair: pairs });
}

/**
 * OHLC data.
 * @param pair   e.g. "XBTUSD"
 * @param interval  1|5|15|30|60|240|1440|10080|21600 (minutes)
 * @param since  Unix timestamp — return data since this time
 */
export async function ohlc(
  pair:     string,
  interval: number = 60,
  since?:   number,
): Promise<{ candles: KrakenOHLCCandle[]; last: number }> {
  const params: Record<string, string> = { pair, interval: String(interval) };
  if (since) params.since = String(since);
  const raw = await publicGet<Record<string, unknown>>("/0/public/OHLC", params);
  // Result is { [pairKey]: candles[], last: number }
  const last    = raw["last"] as number;
  const entries = Object.entries(raw).find(([k]) => k !== "last");
  const candles = (entries?.[1] ?? []) as KrakenOHLCCandle[];
  return { candles, last };
}

/**
 * Order book depth.
 * @param pair  e.g. "XBTUSD"
 * @param count number of price levels (max 500)
 */
export async function orderBook(pair: string, count: number = 10): Promise<KrakenOrderBook> {
  const raw = await publicGet<Record<string, KrakenOrderBook>>("/0/public/Depth", {
    pair,
    count: String(count),
  });
  // Result keyed by (possibly renamed) pair
  const book = Object.values(raw)[0];
  if (!book) throw new Error(`No order book data for ${pair}`);
  return book;
}

/**
 * Recent trades.
 * @param pair e.g. "XBTUSD"
 * @param count max number of trades to return
 */
export async function recentTrades(
  pair:  string,
  count: number = 20,
): Promise<KrakenTradeEntry[]> {
  const raw   = await publicGet<Record<string, unknown>>("/0/public/Trades", { pair, count: String(count) });
  const entry = Object.entries(raw).find(([k]) => k !== "last");
  const rows  = (entry?.[1] ?? []) as Array<[string,string,number,string,string,string]>;
  return rows.map(([price, volume, time, buySell, marketLimit, misc]) => ({
    price, volume, time, buySell: buySell as "b"|"s",
    marketLimit: marketLimit as "m"|"l", misc,
  }));
}

// ─── Convenience aggregator for the price aggregator ─────────────────────────

/**
 * Fetch full ticker snapshot for all supported assets in one call.
 * Returns a normalized Record<localId, { price, change24h, volume24h, high24h }>
 */
export async function fetchAllTickers(): Promise<
  Record<string, { price: number; change24h: number; volume24h: number; high24h: number; low24h: number; ask: number; bid: number }>
> {
  const pairsStr = Object.values(KRAKEN_PAIR).join(",");
  const raw      = await ticker(pairsStr);

  const out: Record<string, { price: number; change24h: number; volume24h: number; high24h: number; low24h: number; ask: number; bid: number }> = {};

  for (const [krakenKey, t] of Object.entries(raw)) {
    const localId = resolveLocalId(krakenKey);
    if (!localId) continue;
    out[localId] = {
      price:     parseFloat(t.c[0]),
      change24h: parseFloat(t.p[1]) !== 0
        ? ((parseFloat(t.c[0]) - parseFloat(t.o)) / parseFloat(t.o)) * 100
        : 0,
      volume24h: parseFloat(t.v[1]),
      high24h:   parseFloat(t.h[1]),
      low24h:    parseFloat(t.l[1]),
      ask:       parseFloat(t.a[0]),
      bid:       parseFloat(t.b[0]),
    };
  }

  return out;
}

// ─── Private API (needs KRAKEN_API_KEY + KRAKEN_API_SECRET) ──────────────────

/** Account balances (all assets) */
export async function balance(): Promise<KrakenBalance> {
  return privatePost<KrakenBalance>("/0/private/Balance");
}

/**
 * Place a spot order.
 * @example addOrder({ pair:"XBTUSD", type:"buy", ordertype:"market", volume:"0.01" })
 */
export async function addOrder(params: {
  pair:      string;
  type:      "buy" | "sell";
  ordertype: "market" | "limit" | "stop-loss" | "take-profit";
  volume:    string;
  price?:    string;   // required for limit
  validate?: boolean;  // dry-run
}): Promise<KrakenAddOrderResult> {
  const p: Record<string, string> = {
    pair:      params.pair,
    type:      params.type,
    ordertype: params.ordertype,
    volume:    params.volume,
  };
  if (params.price)    p.price    = params.price;
  if (params.validate) p.validate = "true";
  return privatePost<KrakenAddOrderResult>("/0/private/AddOrder", p);
}

/** Cancel an open order */
export async function cancelOrder(txid: string): Promise<{ count: number }> {
  return privatePost<{ count: number }>("/0/private/CancelOrder", { txid });
}

/** Initiate a withdrawal */
export async function withdraw(params: {
  asset:  string;
  key:    string;  // pre-configured withdrawal address key in Kraken
  amount: string;
}): Promise<KrakenWithdrawResult> {
  return privatePost<KrakenWithdrawResult>("/0/private/Withdraw", {
    asset:  params.asset,
    key:    params.key,
    amount: params.amount,
  });
}

/** Withdrawal status */
export async function withdrawStatus(asset: string): Promise<KrakenWithdrawStatus[]> {
  return privatePost<KrakenWithdrawStatus[]>("/0/private/WithdrawStatus", { asset });
}

/** Deposit addresses for an asset/method */
export async function depositAddresses(
  asset:  string,
  method: string,
  newAddress = false,
): Promise<KrakenDepositAddress[]> {
  return privatePost<KrakenDepositAddress[]>("/0/private/DepositAddresses", {
    asset,
    method,
    new: newAddress ? "true" : "false",
  });
}

/** Get WebSocket authentication token (for private WS streams) */
export async function getWsToken(): Promise<{ token: string; expires: number }> {
  return privatePost<{ token: string; expires: number }>("/0/private/GetWebSocketsToken");
}

// ─── Health / connectivity check ─────────────────────────────────────────────

/** Quick liveness probe: returns system status or throws */
export async function ping(): Promise<{ ok: boolean; status: KrakenSystemStatus; latencyMs: number }> {
  const start = Date.now();
  const info  = await systemStatus();
  return { ok: info.status === "online", status: info.status, latencyMs: Date.now() - start };
}

/** True when private API credentials are present in the environment */
export function hasPrivateCredentials(): boolean {
  return Boolean(API_KEY && API_SEC);
}
