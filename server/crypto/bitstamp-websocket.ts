/**
 * Banxico Plus LLC — Bitstamp WebSocket API v2 client
 *
 * Envoltorio de reconexión/backoff para el WebSocket público de Bitstamp
 * (wss://ws.bitstamp.net). Pensado para datos de mercado en tiempo real
 * (ticker/order book) — no reemplaza las llamadas REST puntuales que ya usa
 * `bitstamp-client.ts` para ejecutar órdenes.
 *
 * Límites conocidos de Bitstamp (verificado 13-08-2026, bitstamp.net/api +
 * agregador apis.io — confirmar contra la doc oficial si el volumen es alto):
 *   - 400 solicitudes/segundo compartidas entre REST y WebSocket
 *   - ráfaga máxima de 10,000 solicitudes por ventana de 10 minutos
 *
 * Estrategia de reconexión: backoff exponencial con techo, y un mínimo entre
 * intentos para no disparar el rate limit si el servidor cierra la conexión
 * en bucle (p. ej. por credenciales o suscripción inválida).
 */

import WebSocket from "ws";

const WS_URL              = "wss://ws.bitstamp.net";
const MIN_RECONNECT_MS    = 1_000;   // primer reintento
const MAX_RECONNECT_MS    = 30_000;  // techo de backoff
const BACKOFF_FACTOR      = 2;
const HEARTBEAT_TIMEOUT_MS = 20_000; // si no llega nada en este lapso, se asume conexión muerta

export type BitstampWsChannel =
  | `live_trades_${string}`
  | `order_book_${string}`
  | `diff_order_book_${string}`
  | `live_orders_${string}`;

interface BitstampWsMessage {
  event: string;
  channel?: string;
  data?: unknown;
}

export interface BitstampWsClientOptions {
  channels: BitstampWsChannel[];
  onMessage: (msg: BitstampWsMessage) => void;
  onStatusChange?: (status: "connecting" | "open" | "closed" | "error") => void;
}

export class BitstampWsClient {
  private ws: WebSocket | null = null;
  private reconnectDelay = MIN_RECONNECT_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private closedByUser = false;

  constructor(private readonly opts: BitstampWsClientOptions) {}

  connect(): void {
    this.closedByUser = false;
    this.opts.onStatusChange?.("connecting");

    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.on("open", () => {
      this.reconnectDelay = MIN_RECONNECT_MS; // éxito → resetear backoff
      this.opts.onStatusChange?.("open");
      for (const channel of this.opts.channels) {
        ws.send(JSON.stringify({ event: "bts:subscribe", data: { channel } }));
      }
      this.armHeartbeat();
    });

    ws.on("message", (raw) => {
      this.armHeartbeat();
      try {
        const msg = JSON.parse(raw.toString()) as BitstampWsMessage;
        this.opts.onMessage(msg);
      } catch {
        // mensaje no-JSON inesperado — se ignora, no se cae la conexión por esto
      }
    });

    ws.on("close", () => {
      this.opts.onStatusChange?.("closed");
      this.clearHeartbeat();
      if (!this.closedByUser) this.scheduleReconnect();
    });

    ws.on("error", () => {
      this.opts.onStatusChange?.("error");
      // "close" se dispara después de "error"; el reconnect se agenda ahí
    });
  }

  /** Cierra la conexión y detiene los reintentos automáticos. */
  disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.clearHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * BACKOFF_FACTOR, MAX_RECONNECT_MS);
  }

  /** Si no llega ningún mensaje (ni siquiera heartbeat) en el timeout, se fuerza el reconnect. */
  private armHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setTimeout(() => {
      this.ws?.terminate(); // dispara "close" → reconnect
    }, HEARTBEAT_TIMEOUT_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}
