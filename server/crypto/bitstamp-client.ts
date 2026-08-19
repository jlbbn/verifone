/**
 * Banxico Plus LLC — Bitstamp REST Client (API v2)
 *
 * Público  (sin auth): ticker · orderBook · fetchAllTickers · probe/ping
 * Privado  (BITSTAMP_API_KEY + BITSTAMP_API_SECRET):
 *   account balances · buy/sell market · withdraw crypto · deposit address
 *
 * Autenticación v2 por encabezados (verificada contra bitstamp.net/api el 18-08-2026):
 *   X-Auth           : "BITSTAMP {api_key}"
 *   X-Auth-Signature : HMAC-SHA256 hex minúsculas de
 *                      "BITSTAMP " + api_key + verbo + host + path + query +
 *                      Content-Type + nonce + timestamp + "v2" + cuerpo
 *                      (Content-Type se OMITE del mensaje y de los headers si no hay cuerpo)
 *   X-Auth-Nonce     : aleatorio de 36 chars en minúsculas (UUID v4), un solo uso / 150 s
 *   X-Auth-Timestamp : UTC en milisegundos (ventana ±150 s)
 *   X-Auth-Version   : "v2"
 *   (El esquema anterior firmado con nonce+customer_id+api_key en el cuerpo POST está
 *    obsoleto para llaves nuevas y fue reemplazado por este.)
 *
 * Entorno:
 *   BITSTAMP_URL  — override explícito de la base (gana sobre todo lo demás)
 *   BITSTAMP_ENV  — "sandbox" → https://sandbox.bitstamp.net (servidor oficial de pruebas)
 *                   cualquier otro valor/ausente → producción https://www.bitstamp.net
 *
 * Nota: Bitstamp no ofrece red TRC-20 para USDT (solo ERC-20/Omni) — usarlo solo
 * como respaldo, nunca como ruta principal de dispersión. Cotiza contra USD, no USDT.
 */

import { createHmac, randomUUID } from "crypto";

// ─── Environment / configuration ─────────────────────────────────────────────

export const PRODUCTION_URL = "https://www.bitstamp.net";
export const SANDBOX_URL    = "https://sandbox.bitstamp.net";
const TIMEOUT = 9_000; // ms

export type BitstampEnvironment = "production" | "sandbox";

/** Base URL activa: BITSTAMP_URL explícita > BITSTAMP_ENV=sandbox > producción. */
export function resolveBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = (env.BITSTAMP_URL ?? "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const mode = (env.BITSTAMP_ENV ?? "").trim().toLowerCase();
  return mode === "sandbox" ? SANDBOX_URL : PRODUCTION_URL;
}

/** Entorno activo derivado de la base URL (indicador para el panel admin). */
export function activeEnvironment(env: NodeJS.ProcessEnv = process.env): BitstampEnvironment {
  return resolveBaseUrl(env).includes("sandbox.bitstamp.net") ? "sandbox" : "production";
}

function apiKey():    string { return process.env.BITSTAMP_API_KEY    ?? ""; }
function apiSecret(): string { return process.env.BITSTAMP_API_SECRET ?? ""; }

/** True cuando las credenciales privadas v2 están presentes (key + secret; v2 no usa customer_id). */
export function hasPrivateCredentials(): boolean {
  return Boolean(apiKey() && apiSecret());
}

// ─── Asset pair map (internal id → Bitstamp market symbol) ───────────────────
// Verificado en vivo 18-08-2026: los 8 pares responden en producción y en sandbox.

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
  market:   string;          // p.ej. "BTC/USD"
  datetime: string;
  type:     "0" | "1";       // 0 = buy, 1 = sell
  amount:   string;
  price?:   string;
  status?:  string;
  subtype?: string;          // p.ej. "MARKET"
  client_order_id?: string;
}

export interface BitstampWithdrawResult {
  id: number;
}

export interface BitstampDepositAddress {
  address:    string;
  destination_tag?: string;
}

// ─── Auth v2 (puro y testeable) ───────────────────────────────────────────────

export interface AuthMessageParts {
  apiKey:      string;
  method:      string;  // "POST", "GET"…
  host:        string;  // p.ej. "www.bitstamp.net" (sin esquema)
  path:        string;  // p.ej. "/api/v2/account_balances/"
  query:       string;  // query string sin "?" — "" si no hay
  contentType: string;  // "" cuando no hay cuerpo (se omite del mensaje)
  nonce:       string;
  timestamp:   string;
  version:     string;  // "v2"
  body:        string;  // cuerpo urlencoded — "" si no hay
}

/** Mensaje a firmar, en el orden exacto que exige la documentación oficial. */
export function buildAuthMessage(p: AuthMessageParts): string {
  return (
    "BITSTAMP " + p.apiKey +
    p.method +
    p.host +
    p.path +
    p.query +
    p.contentType +
    p.nonce +
    p.timestamp +
    p.version +
    p.body
  );
}

/** HMAC-SHA256 del mensaje con el api_secret, hex en minúsculas. */
export function signAuthMessage(message: string, secret: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

export interface BuildAuthHeadersArgs {
  apiKey:    string;
  apiSecret: string;
  method:    string;
  host:      string;
  path:      string;
  query?:    string;
  body?:     string;
  /** Solo para tests — en producción se generan solos. */
  nonce?:     string;
  timestamp?: string;
}

/**
 * Headers de autenticación v2. Si `body` está vacío, Content-Type se omite
 * tanto del mensaje firmado como de los headers (requisito de Bitstamp).
 */
export function buildAuthHeaders(args: BuildAuthHeadersArgs): Record<string, string> {
  const body        = args.body ?? "";
  const query       = args.query ?? "";
  const nonce       = args.nonce ?? randomUUID();
  const timestamp   = args.timestamp ?? String(Date.now());
  const contentType = body.length > 0 ? "application/x-www-form-urlencoded" : "";

  const message = buildAuthMessage({
    apiKey: args.apiKey,
    method: args.method.toUpperCase(),
    host:   args.host,
    path:   args.path,
    query,
    contentType,
    nonce,
    timestamp,
    version: "v2",
    body,
  });

  const headers: Record<string, string> = {
    "X-Auth":           `BITSTAMP ${args.apiKey}`,
    "X-Auth-Signature": signAuthMessage(message, args.apiSecret),
    "X-Auth-Nonce":     nonce,
    "X-Auth-Timestamp": timestamp,
    "X-Auth-Version":   "v2",
  };
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function publicGet<T>(path: string, base: string = resolveBaseUrl()): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Bitstamp HTTP ${res.status} — ${path}`);
  return res.json() as Promise<T>;
}

async function privatePost<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!hasPrivateCredentials()) {
    throw new Error("Bitstamp: credenciales no configuradas (BITSTAMP_API_KEY + BITSTAMP_API_SECRET) — solo API pública disponible");
  }

  const base = resolveBaseUrl();
  const host = new URL(base).host;
  const body = new URLSearchParams(params).toString(); // "" si no hay parámetros

  const headers = buildAuthHeaders({
    apiKey:    apiKey(),
    apiSecret: apiSecret(),
    method:    "POST",
    host,
    path,
    query: "",
    body,
  });
  headers.Accept = "application/json";

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers,
    body: body.length > 0 ? body : undefined,
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* respuesta no-JSON */ }

  if (!res.ok) {
    const detail = json && typeof json === "object"
      ? JSON.stringify((json as any).reason ?? (json as any).errors ?? json)
      : text.slice(0, 200);
    throw new Error(`Bitstamp HTTP ${res.status} — ${path} — ${detail}`);
  }
  if (json && typeof json === "object" && (json as any).status === "error") {
    const j = json as any;
    throw new Error(`Bitstamp API error${j.code ? ` [${j.code}]` : ""}: ${JSON.stringify(j.reason ?? j)}`);
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
 * Snapshot de tickers para todos los activos soportados (entorno activo).
 * Bitstamp no tiene endpoint único "todos los tickers" con volumen normalizado,
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

// ─── Private API (BITSTAMP_API_KEY + BITSTAMP_API_SECRET) ────────────────────
// Los formatos de respuesta privados se validan en vivo contra el sandbox
// oficial cuando existan credenciales (tarea dependiente) — sin llaves no hay
// forma de ejercitarlos.

/** Saldos de todas las monedas de la cuenta (endpoint v2 account_balances — devuelve lista). */
export async function balance(): Promise<BitstampBalanceEntry[]> {
  return privatePost<BitstampBalanceEntry[]>("/api/v2/account_balances/");
}

/** Saldo de una sola moneda, p.ej. "usd" */
export async function balanceFor(currency: string): Promise<BitstampBalanceEntry> {
  return privatePost<BitstampBalanceEntry>(`/api/v2/account_balances/${currency}/`);
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

// ─── Health / connectivity ────────────────────────────────────────────────────

export interface BitstampProbeResult {
  ok:        boolean;
  latencyMs: number;
  btcUsd?:   number;
  error?:    string;
}

/**
 * Probe de conectividad pública contra un entorno FIJO (independiente del activo).
 * Permite al panel admin mostrar producción y sandbox lado a lado.
 */
export async function probe(environment: BitstampEnvironment): Promise<BitstampProbeResult> {
  const base  = environment === "sandbox" ? SANDBOX_URL : PRODUCTION_URL;
  const start = Date.now();
  try {
    const t = await publicGet<BitstampTicker>("/api/v2/ticker/btcusd/", base);
    return { ok: true, latencyMs: Date.now() - start, btcUsd: parseFloat(t.last) };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: (e as Error).message };
  }
}

/** Probe de conectividad del entorno activo (compatibilidad con el registro de brokers). */
export async function ping(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  await ticker("btcusd");
  return { ok: true, latencyMs: Date.now() - start };
}
