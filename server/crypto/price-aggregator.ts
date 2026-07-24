/**
 * Banxico Plus LLC — Crypto Price Aggregator
 *
 * Multi-source price fetcher with fallback chain:
 *   1. CoinMarketCap (if CMC_API_KEY set) — highest data quality
 *   2. CoinGecko (free, no key required)  — primary public fallback
 *   3. KuCoin market ticker               — last-resort live fallback
 *
 * Each response includes source attribution and timestamp.
 */

import { getBroker } from "./brokers.js";

// ─── Normalized price record ──────────────────────────────────────────────────

export interface PriceRecord {
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  supply: number;
  athPrice: number;
  athDate: string;
}

export interface PriceResult {
  data:        Record<string, PriceRecord>;
  source:      "coinmarketcap" | "coingecko" | "kucoin" | "cache";
  fetchedAt:   number;
  latencyMs:   number;
  apiKeyUsed:  boolean;
}

// ─── Asset mappings ───────────────────────────────────────────────────────────

/** CoinMarketCap numeric IDs */
const CMC_IDS: Record<string, number> = {
  btc: 1, eth: 1027, xrp: 52, ltc: 2, doge: 74,
  sol: 5426, ada: 2010, dot: 6636, usdt: 825,
};

/** CoinGecko string IDs */
const CG_IDS: Record<string, string> = {
  btc: "bitcoin", eth: "ethereum", xrp: "ripple", ltc: "litecoin",
  doge: "dogecoin", sol: "solana", ada: "cardano", dot: "polkadot", usdt: "tether",
};

/** KuCoin trading pairs for ticker fallback */
const KC_PAIRS: Record<string, string> = {
  btc: "BTC-USDT", eth: "ETH-USDT", xrp: "XRP-USDT",
  ltc: "LTC-USDT", doge: "DOGE-USDT", sol: "SOL-USDT",
  ada: "ADA-USDT", dot: "DOT-USDT",
  // USDT itself fetched as a stable 1:1
};

// ─── In-memory cache ──────────────────────────────────────────────────────────

let priceCache: PriceResult | null = null;
const CACHE_TTL_MS = 20_000; // 20 s

export function getCachedPrices(): PriceResult | null {
  if (priceCache && Date.now() - priceCache.fetchedAt < CACHE_TTL_MS) return priceCache;
  return null;
}

// ─── Source 1: CoinMarketCap ─────────────────────────────────────────────────

async function fetchFromCMC(cmcApiKey: string): Promise<PriceResult> {
  const start  = Date.now();
  const ids    = Object.values(CMC_IDS).join(",");
  const url    = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=${ids}&convert=USD`;

  const res = await fetch(url, {
    headers: { "X-CMC_PRO_API_KEY": cmcApiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    throw new Error(`CMC ${res.status}: ${body?.status?.error_message ?? "unknown"}`);
  }

  const body: any = await res.json();
  const data: Record<string, PriceRecord> = {};

  for (const [localId, cmcId] of Object.entries(CMC_IDS)) {
    const entry = body?.data?.[String(cmcId)];
    if (!entry) continue;
    const q = entry.quote?.USD ?? {};
    data[localId] = {
      price:     q.price        ?? 0,
      change24h: q.percent_change_24h ?? 0,
      volume24h: q.volume_24h   ?? 0,
      marketCap: q.market_cap   ?? 0,
      supply:    entry.circulating_supply ?? 0,
      athPrice:  0,   // CMC basic tier doesn't return ATH
      athDate:   "",
    };
  }

  return {
    data,
    source:     "coinmarketcap",
    fetchedAt:  Date.now(),
    latencyMs:  Date.now() - start,
    apiKeyUsed: true,
  };
}

// ─── Source 2: CoinGecko ──────────────────────────────────────────────────────

async function fetchFromCoinGecko(): Promise<PriceResult> {
  const start = Date.now();
  const ids   = Object.values(CG_IDS).join(",");
  const url   = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);

  const rows: any[] = await res.json();
  const data: Record<string, PriceRecord> = {};

  for (const [localId, cgId] of Object.entries(CG_IDS)) {
    const row = rows.find((r: any) => r.id === cgId);
    if (!row) continue;
    data[localId] = {
      price:     row.current_price                 ?? 0,
      change24h: row.price_change_percentage_24h   ?? 0,
      volume24h: row.total_volume                  ?? 0,
      marketCap: row.market_cap                    ?? 0,
      supply:    row.circulating_supply            ?? 0,
      athPrice:  row.ath                           ?? 0,
      athDate:   row.ath_date                      ?? "",
    };
  }

  return {
    data,
    source:     "coingecko",
    fetchedAt:  Date.now(),
    latencyMs:  Date.now() - start,
    apiKeyUsed: false,
  };
}

// ─── Source 3: KuCoin ticker fallback ────────────────────────────────────────

async function fetchFromKuCoin(): Promise<PriceResult> {
  const start = Date.now();
  const data:  Record<string, PriceRecord> = {};

  const results = await Promise.allSettled(
    Object.entries(KC_PAIRS).map(async ([localId, pair]) => {
      const url = `https://api.kucoin.com/api/v1/market/stats?symbol=${pair}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
      const body: any = await res.json();
      if (body?.code !== "200000" || !body?.data) throw new Error(`KuCoin no data: ${pair}`);
      return { localId, d: body.data };
    })
  );

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { localId, d } = r.value;
    data[localId] = {
      price:     parseFloat(d.last    ?? "0"),
      change24h: parseFloat(d.changeRate ?? "0") * 100,
      volume24h: parseFloat(d.volValue  ?? "0"),
      marketCap: 0,
      supply:    0,
      athPrice:  parseFloat(d.high ?? "0"),
      athDate:   "",
    };
  }

  // USDT is a stable — hardcode 1:1
  data["usdt"] = { price: 1.0, change24h: 0, volume24h: 0, marketCap: 0, supply: 0, athPrice: 1, athDate: "" };

  return {
    data,
    source:     "kucoin",
    fetchedAt:  Date.now(),
    latencyMs:  Date.now() - start,
    apiKeyUsed: false,
  };
}

// ─── Public aggregator ────────────────────────────────────────────────────────

/**
 * Fetch prices from the best available source.
 * Falls through the priority chain and updates the in-memory cache.
 */
export async function fetchPrices(): Promise<PriceResult> {
  const cached = getCachedPrices();
  if (cached) return { ...cached, source: "cache" };

  const cmcKey = process.env.CMC_API_KEY;

  // 1️⃣  CoinMarketCap (if key is present)
  if (cmcKey) {
    try {
      const result = await fetchFromCMC(cmcKey);
      priceCache = result;
      return result;
    } catch (e) {
      console.warn("[price-aggregator] CMC failed:", (e as Error).message, "→ falling back to CoinGecko");
    }
  }

  // 2️⃣  CoinGecko
  try {
    const result = await fetchFromCoinGecko();
    priceCache = result;
    return result;
  } catch (e) {
    console.warn("[price-aggregator] CoinGecko failed:", (e as Error).message, "→ falling back to KuCoin");
  }

  // 3️⃣  KuCoin live ticker
  try {
    const result = await fetchFromKuCoin();
    priceCache = result;
    return result;
  } catch (e) {
    console.error("[price-aggregator] All sources failed:", (e as Error).message);
    throw new Error("No price source available");
  }
}

/** Force-clear cache (for testing / admin actions) */
export function clearPriceCache() {
  priceCache = null;
}
