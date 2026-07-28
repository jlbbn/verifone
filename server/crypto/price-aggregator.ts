/**
 * Banxico Plus LLC — Crypto Price Aggregator  v4
 *
 * Primary  : Binance (via binance-client)  — mayor liquidez, API pública global
 * Fallback1 : OKX (via okx-client)         — tercer exchange por volumen global
 * Fallback2 : Kraken (via kraken-client)   — FinCEN/MiCA compliant
 *
 * Cache TTL : 20 s  (configurable)
 */

import * as Binance from "./binance-client.js";
import * as OKX     from "./okx-client.js";
import * as Kraken  from "./kraken-client.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceRecord {
  price:     number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  supply:    number;
  athPrice:  number;
  athDate:   string;
  ask?:      number;
  bid?:      number;
  spread?:   number;
}

export interface PriceResult {
  data:       Record<string, PriceRecord>;
  source:     "binance" | "okx" | "kraken" | "cache";
  fetchedAt:  number;
  latencyMs:  number;
  apiKeyUsed: boolean;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

let   priceCache:   PriceResult | null = null;
const CACHE_TTL_MS = 20_000;

export function getCachedPrices(): PriceResult | null {
  if (priceCache && Date.now() - priceCache.fetchedAt < CACHE_TTL_MS) return priceCache;
  return null;
}

export function clearPriceCache(): void { priceCache = null; }

// ─── Source 1: Binance (primary) ─────────────────────────────────────────────

async function fetchFromBinancePrimary(): Promise<PriceResult> {
  const start   = Date.now();
  const tickers = await Binance.fetchAllTickers();

  const data: Record<string, PriceRecord> = {};
  for (const [localId, t] of Object.entries(tickers)) {
    const spread = t.ask > 0 && t.bid > 0 ? ((t.ask - t.bid) / t.ask) * 100 : 0;
    data[localId] = {
      price:     t.price,
      change24h: t.change24h,
      volume24h: t.volume24h,
      marketCap: 0,
      supply:    0,
      athPrice:  t.high24h,
      athDate:   "",
      ask:       t.ask,
      bid:       t.bid,
      spread:    parseFloat(spread.toFixed(4)),
    };
  }

  data["usdt"] = {
    price: 1.0, change24h: 0, volume24h: 0,
    marketCap: 0, supply: 0, athPrice: 1, athDate: "",
    ask: 1, bid: 1, spread: 0,
  };

  return {
    data,
    source:     "binance",
    fetchedAt:  Date.now(),
    latencyMs:  Date.now() - start,
    apiKeyUsed: Binance.hasPrivateCredentials(),
  };
}

// ─── Source 2: OKX (fallback 1) ───────────────────────────────────────────────

async function fetchFromOKX(): Promise<PriceResult> {
  const start   = Date.now();
  const tickers = await OKX.fetchAllTickers();

  const data: Record<string, PriceRecord> = {};
  for (const [localId, t] of Object.entries(tickers)) {
    const spread = t.ask > 0 && t.bid > 0 ? ((t.ask - t.bid) / t.ask) * 100 : 0;
    data[localId] = {
      price:     t.price,
      change24h: t.change24h,
      volume24h: t.volume24h,
      marketCap: 0,
      supply:    0,
      athPrice:  t.high24h,
      athDate:   "",
      ask:       t.ask,
      bid:       t.bid,
      spread:    parseFloat(spread.toFixed(4)),
    };
  }

  data["usdt"] = {
    price: 1.0, change24h: 0, volume24h: 0,
    marketCap: 0, supply: 0, athPrice: 1, athDate: "",
    ask: 1, bid: 1, spread: 0,
  };

  return {
    data,
    source:     "okx",
    fetchedAt:  Date.now(),
    latencyMs:  Date.now() - start,
    apiKeyUsed: OKX.hasPrivateCredentials(),
  };
}

// ─── Source 3: Kraken (fallback 2) ────────────────────────────────────────────

async function fetchFromKraken(): Promise<PriceResult> {
  const start   = Date.now();
  const tickers = await Kraken.fetchAllTickers();

  const data: Record<string, PriceRecord> = {};
  for (const [localId, t] of Object.entries(tickers)) {
    const spread = t.ask > 0 && t.bid > 0 ? ((t.ask - t.bid) / t.ask) * 100 : 0;
    data[localId] = {
      price:     t.price,
      change24h: t.change24h,
      volume24h: t.volume24h,
      marketCap: 0,
      supply:    0,
      athPrice:  t.high24h,
      athDate:   "",
      ask:       t.ask,
      bid:       t.bid,
      spread:    parseFloat(spread.toFixed(4)),
    };
  }

  data["usdt"] = {
    price: 1.0, change24h: 0, volume24h: 0,
    marketCap: 0, supply: 0, athPrice: 1, athDate: "",
    ask: 1, bid: 1, spread: 0,
  };

  return {
    data,
    source:     "kraken",
    fetchedAt:  Date.now(),
    latencyMs:  Date.now() - start,
    apiKeyUsed: false,
  };
}


// ─── Public aggregator ────────────────────────────────────────────────────────

/**
 * Returns cached data if fresh; otherwise fetches from Binance (primary),
 * then OKX, then Kraken as last resort.
 */
export async function fetchPrices(): Promise<PriceResult> {
  const cached = getCachedPrices();
  if (cached) return { ...cached, source: "cache" };

  // 1️⃣  Binance (primary)
  try {
    const result = await fetchFromBinancePrimary();
    priceCache   = result;
    return result;
  } catch (e) {
    console.warn("[price-aggregator] Binance failed:", (e as Error).message, "→ fallback OKX");
  }

  // 2️⃣  OKX (fallback 1)
  try {
    const result = await fetchFromOKX();
    priceCache   = result;
    return result;
  } catch (e) {
    console.warn("[price-aggregator] OKX failed:", (e as Error).message, "→ fallback Kraken");
  }

  // 3️⃣  Kraken (fallback 2)
  try {
    const result = await fetchFromKraken();
    priceCache   = result;
    return result;
  } catch (e) {
    console.error("[price-aggregator] Kraken failed:", (e as Error).message);
    throw new Error("Todos los price sources fallaron (Binance + OKX + Kraken)");
  }
}
