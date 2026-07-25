/**
 * Banxico Plus LLC — Crypto Price Aggregator  v2
 *
 * Primary  : Kraken (via kraken-client)  — sin restricciones geográficas
 * Fallback  : Binance public ticker      — intento secundario (puede fallar por geo-block)
 *
 * Cache TTL : 20 s  (configurable)
 */

import * as Kraken from "./kraken-client.js";

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
  source:     "kraken" | "binance" | "cache";
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

// ─── Source 1: Kraken (primary) ───────────────────────────────────────────────

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

  // USDT stable
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

// ─── Source 2: Binance (fallback) ─────────────────────────────────────────────

const BINANCE_PAIRS: Record<string, string> = {
  btc:  "BTCUSDT", eth:  "ETHUSDT", xrp:  "XRPUSDT",
  ltc:  "LTCUSDT", doge: "DOGEUSDT", sol:  "SOLUSDT",
  ada:  "ADAUSDT", dot:  "DOTUSDT",
};

async function fetchFromBinance(): Promise<PriceResult> {
  const start   = Date.now();
  const symbols = JSON.stringify(Object.values(BINANCE_PAIRS));
  const url     = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbols)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(7_000),
  });

  if (res.status === 451 || !res.ok) {
    throw new Error(`Binance ${res.status} — geoblocked or unavailable`);
  }

  const rows: any[] = await res.json();
  const data: Record<string, PriceRecord> = {};

  for (const [localId, pair] of Object.entries(BINANCE_PAIRS)) {
    const row = rows.find((r: any) => r.symbol === pair);
    if (!row) continue;
    data[localId] = {
      price:     parseFloat(row.lastPrice          ?? "0"),
      change24h: parseFloat(row.priceChangePercent ?? "0"),
      volume24h: parseFloat(row.quoteVolume        ?? "0"),
      marketCap: 0, supply: 0,
      athPrice:  parseFloat(row.highPrice          ?? "0"),
      athDate:   "",
    };
  }

  data["usdt"] = {
    price: 1.0, change24h: 0, volume24h: 0,
    marketCap: 0, supply: 0, athPrice: 1, athDate: "",
  };

  return {
    data,
    source:     "binance",
    fetchedAt:  Date.now(),
    latencyMs:  Date.now() - start,
    apiKeyUsed: false,
  };
}

// ─── Public aggregator ────────────────────────────────────────────────────────

/**
 * Returns cached data if fresh; otherwise fetches from Kraken (primary)
 * and falls back to Binance if Kraken is unavailable.
 */
export async function fetchPrices(): Promise<PriceResult> {
  const cached = getCachedPrices();
  if (cached) return { ...cached, source: "cache" };

  // 1️⃣  Kraken (primary)
  try {
    const result = await fetchFromKraken();
    priceCache   = result;
    return result;
  } catch (e) {
    console.warn("[price-aggregator] Kraken failed:", (e as Error).message, "→ fallback Binance");
  }

  // 2️⃣  Binance (fallback)
  try {
    const result = await fetchFromBinance();
    priceCache   = result;
    return result;
  } catch (e) {
    console.error("[price-aggregator] Binance fallback failed:", (e as Error).message);
    throw new Error("Todos los price sources fallaron (Kraken + Binance)");
  }
}
