/**
 * Banxico Plus LLC — Feed WebSocket de Bitstamp para el panel admin
 *
 * Singleton perezoso sobre BitstampWsClient: se conecta la primera vez que el
 * panel admin lo consulta y mantiene en memoria la última operación (trade)
 * por par. El frontend lo lee por polling — no hay puente WS hacia el browser.
 *
 * Importante: Bitstamp solo publica WebSocket para producción
 * (wss://ws.bitstamp.net); su sandbox no tiene feed WS documentado. Por eso
 * este feed SIEMPRE refleja el mercado público de producción, aunque el REST
 * esté apuntando al sandbox — el panel lo etiqueta como tal.
 */

import { BitstampWsClient } from "./bitstamp-websocket.js";

export interface FeedTrade {
  pair:   string;
  price:  number;
  amount: number;
  side:   "buy" | "sell";
  atMs:   number;
}

export interface FeedSnapshot {
  source:        "production";           // ver nota de cabecera
  status:        "idle" | "connecting" | "open" | "closed" | "error";
  startedAt:     number | null;
  lastMessageAt: number | null;
  trades:        FeedTrade[];
}

const WATCH_PAIRS = ["btcusd", "ethusd"] as const;

let client: BitstampWsClient | null = null;
let status: FeedSnapshot["status"] = "idle";
let startedAt: number | null = null;
let lastMessageAt: number | null = null;
const lastTrades = new Map<string, FeedTrade>();

/** Arranca el feed si no está corriendo. Idempotente. */
export function ensureBitstampFeed(): void {
  if (client) return;

  client = new BitstampWsClient({
    channels: WATCH_PAIRS.map((p) => `live_trades_${p}` as const),
    onStatusChange: (s) => { status = s; },
    onMessage: (msg) => {
      lastMessageAt = Date.now();
      if (msg.event !== "trade" || !msg.channel?.startsWith("live_trades_")) return;
      const pair = msg.channel.slice("live_trades_".length);
      const d = msg.data as { price?: number; amount?: number; type?: number } | undefined;
      if (!d || typeof d.price !== "number") return;
      lastTrades.set(pair, {
        pair,
        price:  d.price,
        amount: typeof d.amount === "number" ? d.amount : 0,
        side:   d.type === 1 ? "sell" : "buy",
        atMs:   Date.now(),
      });
    },
  });

  startedAt = Date.now();
  status = "connecting";
  client.connect();
}

/** Estado actual del feed para el panel (sin efectos secundarios). */
export function bitstampFeedSnapshot(): FeedSnapshot {
  return {
    source: "production",
    status,
    startedAt,
    lastMessageAt,
    trades: [...lastTrades.values()].sort((a, b) => a.pair.localeCompare(b.pair)),
  };
}
