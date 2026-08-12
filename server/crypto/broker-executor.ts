/**
 * Banxico Plus LLC — Broker Order Executor
 *
 * Ejecuta swaps crypto-to-crypto en el broker real (Binance → OKX → Kraken → interno).
 * Un swap A→B requiere dos market orders:
 *   1. Vender A/USDT  (si fromAsset ≠ usdt)
 *   2. Comprar B/USDT  (si toAsset  ≠ usdt)
 */

import * as Binance  from "./binance-client.js";
import * as OKX      from "./okx-client.js";
import * as Kraken   from "./kraken-client.js";
import * as Bitstamp from "./bitstamp-client.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BrokerName = "binance" | "okx" | "kraken" | "bitstamp" | "internal";

export interface SwapResult {
  broker:      BrokerName;
  fromAsset:   string;
  toAsset:     string;
  fromAmount:  number;
  toAmount:    number;       // actual fill amount
  usdtBridge:  number;       // USDT used as bridge (0 if direct pair or one-leg)
  executedAt:  string;
  orderIds:    string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function binanceSpotPrice(symbol: string): Promise<{ last: number; ask: number; bid: number }> {
  const res = await fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${symbol}`, {
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) throw new Error(`Binance bookTicker ${symbol} → HTTP ${res.status}`);
  const t: any = await res.json();
  const mid = (parseFloat(t.askPrice ?? "0") + parseFloat(t.bidPrice ?? "0")) / 2;
  return {
    last: mid,
    ask:  parseFloat(t.askPrice ?? "0"),
    bid:  parseFloat(t.bidPrice ?? "0"),
  };
}

async function okxSpotPrice(instId: string): Promise<{ last: number; ask: number; bid: number }> {
  const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`, {
    signal: AbortSignal.timeout(6_000),
  });
  const j: any = await res.json();
  if (j.code !== "0" || !j.data?.[0]) throw new Error(`OKX ticker ${instId} unavailable`);
  const t = j.data[0];
  return {
    last: parseFloat(t.last   ?? "0"),
    ask:  parseFloat(t.askPx  ?? "0"),
    bid:  parseFloat(t.bidPx  ?? "0"),
  };
}

// ─── Binance executor ─────────────────────────────────────────────────────────

async function executeViaBinance(
  fromAsset: string,
  toAsset:   string,
  fromAmount: number,
): Promise<SwapResult> {
  const orderIds: string[] = [];
  let usdtBridge = 0;
  let toAmount   = 0;

  // ── Leg 1: vender fromAsset → USDT (omitir si fromAsset ya es usdt) ─────────
  if (fromAsset !== "usdt") {
    const symbol = Binance.BINANCE_PAIR[fromAsset];
    if (!symbol) throw new Error(`Binance: par no soportado para ${fromAsset}`);

    const order = await Binance.newOrder({
      symbol,
      side:     "SELL",
      quantity: fromAmount.toFixed(8),
    });

    if (order.orderId) orderIds.push(String(order.orderId));

    // USDT recibidos ≈ executedQty × fill price (o bid si fills vacío)
    const executed = parseFloat(order.executedQty         ?? "0");
    const quoteQty = parseFloat(order.cummulativeQuoteQty ?? "0");
    usdtBridge = quoteQty > 0 ? quoteQty : executed * (await binanceSpotPrice(symbol)).bid;
  } else {
    usdtBridge = fromAmount;
  }

  // ── Leg 2: comprar toAsset con USDT (omitir si toAsset ya es usdt) ──────────
  if (toAsset !== "usdt") {
    const symbol = Binance.BINANCE_PAIR[toAsset];
    if (!symbol) throw new Error(`Binance: par no soportado para ${toAsset}`);

    const order = await Binance.newOrder({
      symbol,
      side:         "BUY",
      quoteOrderQty: usdtBridge.toFixed(4),  // comprar con USDT
    });

    if (order.orderId) orderIds.push(String(order.orderId));

    const executed = parseFloat(order.executedQty ?? "0");
    toAmount = executed > 0 ? executed
      : usdtBridge / (await binanceSpotPrice(symbol)).ask;
  } else {
    toAmount = usdtBridge;
  }

  return {
    broker:     "binance",
    fromAsset,  toAsset,
    fromAmount, toAmount,
    usdtBridge,
    executedAt: new Date().toISOString(),
    orderIds,
  };
}

// ─── OKX executor ─────────────────────────────────────────────────────────────

async function executeViaOKX(
  fromAsset: string,
  toAsset:   string,
  fromAmount: number,
): Promise<SwapResult> {
  const orderIds: string[] = [];
  let usdtBridge = 0;
  let toAmount   = 0;

  // ── Leg 1: vender fromAsset → USDT (omitir si fromAsset ya es usdt) ─────────
  if (fromAsset !== "usdt") {
    const fromPair = OKX.OKX_PAIR[fromAsset];
    if (!fromPair) throw new Error(`OKX: par no soportado para ${fromAsset}`);

    const orders = await OKX.addOrder({
      instId:  fromPair,
      side:    "sell",
      ordType: "market",
      sz:      fromAmount.toFixed(8),       // base currency (e.g. BTC)
    });

    const o = orders[0];
    if (!o || o.sCode !== "0") throw new Error(`OKX sell fallida [${o?.sCode}]: ${o?.sMsg}`);
    if (o.ordId) orderIds.push(o.ordId);

    // Obtener USDT recibidos ≈ fromAmount × mid price (fill real llega en websocket)
    const px = await okxSpotPrice(fromPair);
    usdtBridge = fromAmount * px.bid;           // bid = precio al que compraron nuestra venta
  } else {
    usdtBridge = fromAmount;
  }

  // ── Leg 2: comprar toAsset con USDT (omitir si toAsset ya es usdt) ──────────
  if (toAsset !== "usdt") {
    const toPair = OKX.OKX_PAIR[toAsset];
    if (!toPair) throw new Error(`OKX: par no soportado para ${toAsset}`);

    const orders = await OKX.addOrder({
      instId:  toPair,
      side:    "buy",
      ordType: "market",
      sz:      usdtBridge.toFixed(4),       // USDT amount
      tgtCcy:  "quote_ccy",                 // sz is in quote currency (USDT)
      tdMode:  "cash",
    });

    const o = orders[0];
    if (!o || o.sCode !== "0") throw new Error(`OKX buy fallida [${o?.sCode}]: ${o?.sMsg}`);
    if (o.ordId) orderIds.push(o.ordId);

    // Calcular toAmount ≈ USDT / ask price
    const px   = await okxSpotPrice(toPair);
    toAmount   = usdtBridge / px.ask;
  } else {
    toAmount = usdtBridge;
  }

  return {
    broker:     "okx",
    fromAsset,  toAsset,
    fromAmount, toAmount,
    usdtBridge,
    executedAt: new Date().toISOString(),
    orderIds,
  };
}

// ─── Kraken executor ──────────────────────────────────────────────────────────

async function executeViaKraken(
  fromAsset: string,
  toAsset:   string,
  fromAmount: number,
): Promise<SwapResult> {
  const orderIds: string[] = [];
  let usdtBridge = 0;
  let toAmount   = 0;

  // ── Leg 1: vender fromAsset → USD ───────────────────────────────────────────
  if (fromAsset !== "usdt") {
    const fromPair = Kraken.KRAKEN_PAIR[fromAsset];
    if (!fromPair) throw new Error(`Kraken: par no soportado para ${fromAsset}`);

    const result = await Kraken.addOrder({
      pair:      fromPair,
      type:      "sell",
      ordertype: "market",
      volume:    fromAmount.toFixed(8),
    });

    const txid = result?.txid?.[0];
    if (txid) orderIds.push(txid);

    // Precio aproximado desde ticker
    const ticker = await Kraken.ticker(fromPair);
    const bid    = parseFloat(ticker[fromPair]?.b?.[0] ?? "0");
    usdtBridge   = fromAmount * bid;
  } else {
    usdtBridge = fromAmount;
  }

  // ── Leg 2: comprar toAsset con USD ───────────────────────────────────────────
  if (toAsset !== "usdt") {
    const toPair = Kraken.KRAKEN_PAIR[toAsset];
    if (!toPair) throw new Error(`Kraken: par no soportado para ${toAsset}`);

    const ticker   = await Kraken.ticker(toPair);
    const ask      = parseFloat(ticker[toPair]?.a?.[0] ?? "0");
    const volume   = (usdtBridge / ask).toFixed(8);

    const result = await Kraken.addOrder({
      pair:      toPair,
      type:      "buy",
      ordertype: "market",
      volume,
    });

    const txid = result?.txid?.[0];
    if (txid) orderIds.push(txid);
    toAmount = parseFloat(volume);
  } else {
    toAmount = usdtBridge;
  }

  return {
    broker:     "kraken",
    fromAsset,  toAsset,
    fromAmount, toAmount,
    usdtBridge,
    executedAt: new Date().toISOString(),
    orderIds,
  };
}

// ─── Bitstamp executor ────────────────────────────────────────────────────────
// Nota: Bitstamp no ofrece red TRC-20 para USDT (solo ERC-20/Omni) — usarlo
// solo como último respaldo, nunca como ruta principal de dispersión.

async function executeViaBitstamp(
  fromAsset: string,
  toAsset:   string,
  fromAmount: number,
): Promise<SwapResult> {
  const orderIds: string[] = [];
  let usdtBridge = 0; // aquí usado como "puente en USD", Bitstamp cotiza en USD no USDT
  let toAmount   = 0;

  // ── Leg 1: vender fromAsset → USD ───────────────────────────────────────────
  if (fromAsset !== "usdt") {
    const fromPair = Bitstamp.BITSTAMP_PAIR[fromAsset];
    if (!fromPair) throw new Error(`Bitstamp: par no soportado para ${fromAsset}`);

    const order = await Bitstamp.sellMarket(fromPair, fromAmount.toFixed(8));
    if (order.id) orderIds.push(order.id);

    const t   = await Bitstamp.ticker(fromPair);
    usdtBridge = fromAmount * parseFloat(t.bid);
  } else {
    usdtBridge = fromAmount;
  }

  // ── Leg 2: comprar toAsset con USD ──────────────────────────────────────────
  if (toAsset !== "usdt") {
    const toPair = Bitstamp.BITSTAMP_PAIR[toAsset];
    if (!toPair) throw new Error(`Bitstamp: par no soportado para ${toAsset}`);

    const t      = await Bitstamp.ticker(toPair);
    const ask    = parseFloat(t.ask);
    const amount = (usdtBridge / ask).toFixed(8);

    const order = await Bitstamp.buyMarket(toPair, amount);
    if (order.id) orderIds.push(order.id);
    toAmount = parseFloat(amount);
  } else {
    toAmount = usdtBridge;
  }

  return {
    broker:     "bitstamp",
    fromAsset,  toAsset,
    fromAmount, toAmount,
    usdtBridge,
    executedAt: new Date().toISOString(),
    orderIds,
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Ejecuta un swap en el mejor broker disponible.
 * Cadena: Binance → OKX → Kraken → null (swap interno).
 */
export async function executeSwap(
  fromAsset:  string,
  toAsset:    string,
  fromAmount: number,
): Promise<SwapResult | null> {

  // 1️⃣  Binance (principal)
  if (Binance.hasPrivateCredentials()) {
    try {
      return await executeViaBinance(fromAsset, toAsset, fromAmount);
    } catch (e) {
      console.warn("[broker-executor] Binance swap falló:", (e as Error).message, "→ intentando OKX");
    }
  }

  // 2️⃣  OKX (respaldo)
  if (OKX.hasPrivateCredentials()) {
    try {
      return await executeViaOKX(fromAsset, toAsset, fromAmount);
    } catch (e) {
      console.warn("[broker-executor] OKX swap falló:", (e as Error).message, "→ intentando Kraken");
    }
  }

  // 3️⃣  Kraken (respaldo 2)
  if (Kraken.hasPrivateCredentials()) {
    try {
      return await executeViaKraken(fromAsset, toAsset, fromAmount);
    } catch (e) {
      console.warn("[broker-executor] Kraken swap falló:", (e as Error).message, "→ intentando Bitstamp");
    }
  }

  // 4️⃣  Bitstamp (respaldo 3 — sin red TRC-20, solo último recurso)
  if (Bitstamp.hasPrivateCredentials()) {
    try {
      return await executeViaBitstamp(fromAsset, toAsset, fromAmount);
    } catch (e) {
      console.warn("[broker-executor] Bitstamp swap falló:", (e as Error).message);
    }
  }

  // Sin credenciales privadas → swap interno
  return null;
}

/** Qué broker ejecutaría si se llamara ahora */
export function availableBroker(): BrokerName {
  if (Binance.hasPrivateCredentials())  return "binance";
  if (OKX.hasPrivateCredentials())      return "okx";
  if (Kraken.hasPrivateCredentials())   return "kraken";
  if (Bitstamp.hasPrivateCredentials()) return "bitstamp";
  return "internal";
}
