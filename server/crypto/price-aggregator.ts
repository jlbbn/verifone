/**
 * Banxico Plus LLC — Crypto Price Aggregator
 *
 * Sources (priority order):
 *   1. Binance public ticker  — highest liquidity / most accurate
 *   2. Kraken public ticker   — fully accessible from server, no geo-block
 *
 * Each response includes source attribution, latency, and timestamp.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceRecord {
  price:     number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  supply:    number;
  athPrice:  number;
  athDate:   string;
}

export interface PriceResult {
  data:       Record<string, PriceRecord>;
  source:     "binance" | "kraken" | "cache";
  fetchedAt:  number;
  latencyMs:  number;
  apiKeyUsed: boolean;
}

// ─── Asset maps ───────────────────────────────────────────────────────────────

/** Binance spot pairs (quote = USDT) */
const BINANCE_PAIRS: Record<string, string> = {
  btc:  "BTCUSDT",
  eth:  "ETHUSDT",
  xrp:  "XRPUSDT",
  ltc:  "LTCUSDT",
  doge: "DOGEUSDT",
  sol:  "SOLUSDT",
  ada:  "ADAUSDT",
  dot:  "DOTUSDT",
  // USDT is the quote — stable at $1
};

/** Kraken pairs (XBT = BTC in Kraken notation) */
const KRAKEN_PAIRS: Record<string, string> = {
  btc:  "XBTUSD",
  eth:  "ETHUSD",
  xrp:  "XRPUSD",
  ltc:  "LTCUSD",
  doge: "DOGEUSD",
  sol:  "SOLUSD",
  ada:  "ADAUSD",
  dot:  "DOTUSD",
  // USDT stable — hardcoded 1:1
};

// ─── In-memory cache ──────────────────────────────────────────────────────────

let priceCache: PriceResult | null = null;
const CACHE_TTL_MS = 20_000;

export function getCachedPrices(): PriceResult | null {
  if (priceCache && Date.now() - priceCache.fetchedAt < CACHE_TTL_MS) return priceCache;
  return null;
}

export function clearPriceCache() { priceCache = null; }

// ─── Source 1: Binance ────────────────────────────────────────────────────────

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
      price:     parseFloat(row.lastPrice    ?? "0"),
      change24h: parseFloat(row.priceChangePercent ?? "0"),
      volume24h: parseFloat(row.quoteVolume  ?? "0"),
      marketCap: 0,
      supply:    0,
      athPrice:  parseFloat(row.highPrice    ?? "0"),
      athDate:   "",
    };
  }

  // USDT stable
  data["usdt"] = { price: 1.0, change24h: 0, volume24h: parseFloat(rows.find((r:any)=>r.symbol==="USDTUSD")?.quoteVolume ?? "0"), marketCap: 0, supply: 0, athPrice: 1, athDate: "" };

  return { data, source: "binance", fetchedAt: Date.now(), latencyMs: Date.now() - start, apiKeyUsed: false };
}

// ─── Source 2: Kraken ─────────────────────────────────────────────────────────

async function fetchFromKraken(): Promise<PriceResult> {
  const start = Date.now();
  const pair  = Object.values(KRAKEN_PAIRS).join(",");
  const url   = `https://api.kraken.com/0/public/Ticker?pair=${pair}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`Kraken ${res.status}`);

  const body: any = await res.json();
  if (body.error?.length) throw new Error(`Kraken API: ${body.error.join(", ")}`);

  const result = body.result ?? {};
  const data:   Record<string, PriceRecord> = {};

  // Kraken pair names can differ (e.g. XXBTZUSD vs XBTUSD) — match by value
  const krakenLookup: Record<string, string> = {};
  for (const key of Object.keys(result)) {
    for (const [localId, krakenPair] of Object.entries(KRAKEN_PAIRS)) {
      // Kraken may prefix with X/Z — normalize
      if (key.replace(/^X|Z/g, "").toUpperCase().includes(krakenPair.replace("USD","").toUpperCase())) {
        krakenLookup[localId] = key;
        break;
      }
      if (key === krakenPair || key === "X" + krakenPair || key === krakenPair + "T") {
        krakenLookup[localId] = key;
        break;
      }
    }
  }

  for (const [localId, krakenKey] of Object.entries(krakenLookup)) {
    const t = result[krakenKey];
    if (!t) continue;
    // Kraken ticker fields: c=last, P=change%24h, v=volume[1]=24h, h=high, l=low
    data[localId] = {
      price:     parseFloat(t.c?.[0] ?? "0"),
      change24h: parseFloat(t.P?.[1] ?? "0"),
      volume24h: parseFloat(t.v?.[1] ?? "0"),
      marketCap: 0,
      supply:    0,
      athPrice:  parseFloat(t.h?.[1] ?? "0"),
      athDate:   "",
    };
  }

  // USDT stable
  data["usdt"] = { price: 1.0, change24h: 0, volume24h: 0, marketCap: 0, supply: 0, athPrice: 1, athDate: "" };

  return { data, source: "kraken", fetchedAt: Date.now(), latencyMs: Date.now() - start, apiKeyUsed: false };
}

// ─── Public aggregator ────────────────────────────────────────────────────────

/**
 * Fetch prices: tries Binance first, falls back to Kraken.
 * Updates the in-memory cache.
 */
export async function fetchPrices(): Promise<PriceResult> {
  const cached = getCachedPrices();
  if (cached) return { ...cached, source: "cache" };

  // 1️⃣  Binance
  try {
    const result = await fetchFromBinance();
    priceCache = result;
    return result;
  } catch (e) {
    console.warn("[price-aggregator] Binance failed:", (e as Error).message, "→ fallback Kraken");
  }

  // 2️⃣  Kraken
  try {
    const result = await fetchFromKraken();
    priceCache = result;
    return result;
  } catch (e) {
    console.error("[price-aggregator] Kraken failed:", (e as Error).message);
    throw new Error("Todos los price sources fallaron");
  }
}
