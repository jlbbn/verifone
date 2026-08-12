/**
 * Banxico Plus LLC — Bitstamp REST Client
 *
 * Público  (sin auth): ticker · orderBook · transactions · ohlc
 * Privado  (BITSTAMP_API_KEY + BITSTAMP_API_SECRET + BITSTAMP_CUSTOMER_ID):
 *   balance · buy/sell market · withdraw crypto · deposit address
 *
 * Autenticación : HMAC-SHA256 sobre (nonce + customer_id + api_key), clave = api_secret,
 *                 firma en hex MAYÚSCULAS. Se envía como parámetros del cuerpo POST:
 *                 key · signature · nonce (junto con los demás parámetros del endpoint).
 * Nota          : Bitstamp no ofrece red TRC-20 para USDT (solo ERC-20/Omni) — usarlo solo
 *                 como respaldo, nunca como ruta principal de dispersión.
 * Base URL      : process.env.BITSTAMP_URL ?? "https://www.bitstamp.net"
 */

import { createHmac } from "crypto";

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL     = (process.env.BITSTAMP_URL ?? "https://www.bitstamp.net").replace(/\/$/, "");
const API_KEY      = process.env.BITSTAMP_API_KEY      ?? "";
const API_SECRET   = process.env.BITSTAMP_API_SECRET   ?? "";
const CUSTOMER_ID  = process.env.BITSTAMP_CUSTOMER_ID  ?? "";
const TIMEOUT      = 9_000; // ms

// ─── Asset pair map (internal id → Bitstamp market symbol) ───────────────────

export const BITSTAMP_PAIR: Record<string, string> = {
  btc:  "btcusd",
  eth:  "ethusd",
  xrp:  "xrpusd",
  ltc:  "ltcusd",
  doge: "dogeusd",
  sol:  "solusd",
  ada:  "adausd",
  dot:  "dotusd",
};

// ─── Typed responses ──────────────────────────────────────────────────────────

export interface BitstampTicker {
  last:      string;
  ask:       string;
  bid:       string;
  high:      string;
  low:       string;
  open:      string;
  volume:    string;
  vwap:      string;
  timestamp: string;
}

export interface BitstampOrderBook {
  timestamp: string;
  bids: Array<[string, string]>;
  asks: Array<[string, string]>;
}

export interface BitstampBalanceEntry {
  currency:  string;
  total:     string;
  available: string;
  reserved:  string;
}

export interface BitstampMarketOrderResult {
  id:       string;
  market:   string;
  datetime: string;
  type:     "0" | "1"; // 0 = buy, 1 = sell
  amount:   string;
  price?:   string;
  status?:  string;
}

export interface BitstampWithdrawResult {
  id: number;
}

export interface BitstampDepositAddress {
  address:    string;
  destination_tag?: string;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Bitstamp HTTP ${res.status} — ${path}`);
  return res.json() as Promise<T>;
}

/** Construye la firma HMAC-SHA256 requerida por el API privado v2 de Bitstamp */
function buildSignature(nonce: string): string {
  if (!API_SECRET) throw new Error("BITSTAMP_API_SECRET no configurado");
  if (!CUSTOMER_ID) throw new Error("BITSTAMP_CUSTOMER_ID no configurado");
  const message = nonce + CUSTOMER_ID + API_KEY;
  return createHmac("sha256", API_SECRET).update(message).digest("hex").toUpperCase();
}

async function privatePost<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_KEY) throw new Error("BITSTAMP_API_KEY no configurado — solo API pública disponible");

  const nonce     = String(Date.now());
  const signature = buildSignature(nonce);
  const body = new URLSearchParams({
    key:       API_KEY,
    signature,
    nonce,
    ...params,
  }).toString();

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (!res.ok) throw new Error(`Bitstamp HTTP ${res.status} — ${path}`);
  const json = await res.json();
  if (json && typeof json === "object" && (json as any).status === "error") {
    throw new Error(`Bitstamp API error: ${JSON.stringify((json as any).reason ?? json)}`);
  }
  return json as T;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Ticker de un mercado, p.ej. "btcusd" */
export async function ticker(pair: string): Promise<BitstampTicker> {
  return publicGet<BitstampTicker>(`/api/v2/ticker/${pair}/`);
}

/** Libro de órdenes de un mercado */
export async function orderBook(pair: string): Promise<BitstampOrderBook> {
  return publicGet<BitstampOrderBook>(`/api/v2/order_book/${pair}/`);
}

/**
 * Snapshot de tickers para todos los activos soportados.
 * Bitstamp no tiene endpoint "todos los tickers" único con volumen normalizado,
 * así que se consulta cada mercado soportado en paralelo.
 */
export async function fetchAllTickers(): Promise<
  Record<string, { price: number; change24h: number; volume24h: number; high24h: number; low24h: number; ask: number; bid: number }>
> {
  const entries = await Promise.all(
    Object.entries(BITSTAMP_PAIR).map(async ([localId, pair]) => {
      try {
        const t = await ticker(pair);
        const open = parseFloat(t.open);
        const last = parseFloat(t.last);
        return [localId, {
          price:     last,
          change24h: open !== 0 ? ((last - open) / open) * 100 : 0,
          volume24h: parseFloat(t.volume),
          high24h:   parseFloat(t.high),
          low24h:    parseFloat(t.low),
          ask:       parseFloat(t.ask),
          bid:       parseFloat(t.bid),
        }] as const;
      } catch {
        return null;
      }
    }),
  );

  const out: Record<string, { price: number; change24h: number; volume24h: number; high24h: number; low24h: number; ask: number; bid: number }> = {};
  for (const e of entries) if (e) out[e[0]] = e[1];
  return out;
}

// ─── Private API (needs BITSTAMP_API_KEY + BITSTAMP_API_SECRET + BITSTAMP_CUSTOMER_ID) ──

/** Saldos de todas las monedas de la cuenta */
export async function balance(): Promise<BitstampBalanceEntry[]> {
  return privatePost<BitstampBalanceEntry[]>("/api/v2/balance/");
}

/** Saldo de una sola moneda, p.ej. "usd" */
export async function balanceFor(currency: string): Promise<BitstampBalanceEntry> {
  return privatePost<BitstampBalanceEntry>(`/api/v2/balance/${currency}/`);
}

/** Orden de mercado — compra */
export async function buyMarket(pair: string, amount: string): Promise<BitstampMarketOrderResult> {
  return privatePost<BitstampMarketOrderResult>(`/api/v2/buy/market/${pair}/`, { amount });
}

/** Orden de mercado — venta */
export async function sellMarket(pair: string, amount: string): Promise<BitstampMarketOrderResult> {
  return privatePost<BitstampMarketOrderResult>(`/api/v2/sell/market/${pair}/`, { amount });
}

/** Retiro de criptomoneda a una dirección externa. `currency` en minúsculas, p.ej. "usdt" */
export async function withdrawCrypto(params: {
  currency: string;
  address:  string;
  amount:   string;
  network?: string; // p.ej. "ethereum" — Bitstamp no soporta TRC-20 para USDT
}): Promise<BitstampWithdrawResult> {
  const p: Record<string, string> = { amount: params.amount, address: params.address };
  if (params.network) p.network = params.network;
  return privatePost<BitstampWithdrawResult>(`/api/v2/${params.currency}_withdrawal/`, p);
}

/** Dirección de depósito para una criptomoneda */
export async function depositAddress(currency: string): Promise<BitstampDepositAddress> {
  return privatePost<BitstampDepositAddress>(`/api/v2/${currency}_address/`);
}

// ─── Health / connectivity check ─────────────────────────────────────────────

/** Probe de conectividad pública: consulta el ticker de BTC/USD */
export async function ping(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  await ticker("btcusd");
  return { ok: true, latencyMs: Date.now() - start };
}

/** True cuando las credenciales privadas están presentes en el entorno */
export function hasPrivateCredentials(): boolean {
  return Boolean(API_KEY && API_SECRET && CUSTOMER_ID);
}
