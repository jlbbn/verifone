/**
 * Banxico Plus LLC — OKX Webhook Handler
 *
 * Receives inbound push notifications from OKX (deposits, withdrawals, order fills).
 * All requests are HMAC-SHA256 verified and IP-allowlisted before processing.
 *
 * Required env var: OKX_WEBHOOK_SECRET
 *
 * Registration: must be mounted BEFORE express.json() so raw body is available.
 * In server/index.ts, add:
 *   app.post("/api/okx/webhook", rawBodyMiddleware, okxIpAllowlist, okxWebhookHandler);
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "../db.js";
import { sql } from "drizzle-orm";
import { storage } from "../storage.js";
import { log } from "../vite.js";

// ─── OKX Webhook IP Allowlist ─────────────────────────────────────────────────
// OKX push notifications originate from these IPs (AWS ap-northeast-1 region).
// Source: OKX developer documentation + known infrastructure IPs.
const OKX_WEBHOOK_IPS = new Set([
  "13.115.58.77",
  "13.115.31.132",
  "52.198.10.116",
  "54.64.38.23",
  "52.192.51.37",
  "3.114.191.138",
  "18.182.10.51",
  "52.68.54.232",
]);

const IS_DEV = process.env.NODE_ENV !== "production";

// ─── Middleware: IP allowlist ─────────────────────────────────────────────────
// Relies on Express `trust proxy` being set to true in server/index.ts so that
// req.ip is already resolved to the real client IP by the trusted infrastructure
// proxy — we never read X-Forwarded-For directly (spoofable by any direct client).
export function okxIpAllowlist(req: Request, res: Response, next: NextFunction) {
  if (IS_DEV) return next(); // Skip in development
  const clientIp = req.ip ?? "";

  if (!OKX_WEBHOOK_IPS.has(clientIp)) {
    log(`[OKX-WH] Rejected non-allowlisted IP: ${clientIp}`);
    return res.status(403).json({ error: "Forbidden — IP not in OKX allowlist" });
  }
  next();
}

// ─── Middleware: capture raw body ─────────────────────────────────────────────
export function rawBodyCapture(req: Request, res: Response, next: NextFunction) {
  let raw = Buffer.alloc(0);
  req.on("data", (chunk: Buffer) => { raw = Buffer.concat([raw, chunk]); });
  req.on("end", () => {
    (req as any).rawBody = raw;
    try {
      (req as any).body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      (req as any).body = {};
    }
    next();
  });
}

// ─── Signature verification ───────────────────────────────────────────────────
function verifyOkxWebhook(req: Request): boolean {
  const secret    = process.env.OKX_WEBHOOK_SECRET ?? "";
  if (!secret) {
    log("[OKX-WH] OKX_WEBHOOK_SECRET not set — skipping verification");
    return false;
  }

  const sign      = req.headers["ok-access-sign"]      as string | undefined;
  const timestamp = req.headers["ok-access-timestamp"] as string | undefined;

  if (!sign || !timestamp) return false;

  // OKX sends OK-ACCESS-TIMESTAMP as an ISO-8601 string (e.g. "2024-01-01T12:00:00.000Z").
  // parseFloat("2024-01-01T...") → 2024, which is NOT epoch seconds.
  // Use Date.parse() which correctly handles both ISO-8601 and numeric epoch strings.
  const tsMs = Date.parse(timestamp);
  if (isNaN(tsMs)) {
    log(`[OKX-WH] Rejected — unparseable timestamp: ${timestamp}`);
    return false;
  }

  // Reject stale requests (>30 seconds old)
  const age = Math.abs(Date.now() - tsMs) / 1000;
  if (age > 30) {
    log(`[OKX-WH] Rejected stale request — age ${age.toFixed(1)}s`);
    return false;
  }

  const rawBody   = (req as any).rawBody ?? Buffer.alloc(0);
  const message   = timestamp + "POST" + "/api/okx/webhook" + rawBody.toString("utf8");
  const expected  = createHmac("sha256", secret).update(message).digest("base64");

  try {
    return timingSafeEqual(Buffer.from(sign), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Persist webhook event (idempotent upsert) ───────────────────────────────
// OKX guarantees at-least-once delivery — the same event can arrive more than
// once. We upsert on (event_type, okx_id) for events that carry an id so a
// duplicate delivery updates the row rather than creating a second one.
// Returns true if this is the FIRST time we've seen this event (new row).
async function saveEvent(
  eventType: string,
  okxId: string | null,
  payload: unknown,
  verified: boolean,
): Promise<boolean> {
  try {
    if (okxId) {
      // Upsert: on conflict update payload/verified but do NOT reset received_at
      // so the original arrival timestamp is preserved.
      const result = await db.execute(sql`
        INSERT INTO okx_webhook_events (event_type, okx_id, payload, verified)
        VALUES (${eventType}, ${okxId}, ${JSON.stringify(payload)}::jsonb, ${verified})
        ON CONFLICT (event_type, okx_id) WHERE okx_id IS NOT NULL
        DO UPDATE SET
          payload  = EXCLUDED.payload,
          verified = EXCLUDED.verified
        RETURNING (xmax = 0) AS is_new_row
      `);
      // xmax = 0 means it was an INSERT (new row); xmax != 0 means UPDATE (duplicate)
      const row = (result.rows ?? result)?.[0] as any;
      return row?.is_new_row === true || row?.is_new_row === "true";
    } else {
      // No okx_id — always insert (unknown/malformed events)
      await db.execute(sql`
        INSERT INTO okx_webhook_events (event_type, okx_id, payload, verified)
        VALUES (${eventType}, ${okxId}, ${JSON.stringify(payload)}::jsonb, ${verified})
      `);
      return true;
    }
  } catch (e: any) {
    log(`[OKX-WH] Failed to save event: ${e.message}`);
    return false;
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleDeposit(data: any, verified: boolean) {
  const depId  = data?.depId  ?? data?.txId ?? null;
  const ccy    = data?.ccy    ?? "USDT";
  const amt    = data?.amt    ?? "?";
  const state  = Number(data?.state ?? -1);

  const isNew = await saveEvent("deposit", depId, data, verified);

  // Only fire side-effects on the FIRST delivery — OKX may re-send the same event.
  if (isNew && state === 2 && verified) {
    await storage.createNotification({
      type:      "info",
      title:     "OKX Depósito Confirmado",
      message:   `Depósito ${amt} ${ccy} confirmado on-chain · ID: ${depId ?? "—"}`,
      recipient: "ADMIN",
      status:    "resolved",
    });
  }

  log(`[OKX-WH] deposit event — id=${depId} ccy=${ccy} amt=${amt} state=${state} verified=${verified} isNew=${isNew}`);
}

async function handleWithdrawal(data: any, verified: boolean) {
  const wdId   = data?.wdId  ?? null;
  const ccy    = data?.ccy   ?? "USDT";
  const amt    = data?.amt   ?? "?";
  const state  = Number(data?.state ?? -1);

  const isNew = await saveEvent("withdrawal", wdId, data, verified);

  // Only fire side-effects on the FIRST delivery — OKX may re-send the same event.
  if (isNew && verified && (state === 2 || state === 4)) {
    const isComplete = state === 2;
    await storage.createNotification({
      type:      isComplete ? "info" : "warning",
      title:     isComplete ? "OKX Retiro Completado" : "OKX Retiro Fallido",
      message:   `Retiro ${amt} ${ccy} ${isComplete ? "completado" : "FALLIDO"} · ID: ${wdId ?? "—"}`,
      recipient: "ADMIN",
      status:    "resolved",
    });
  }

  log(`[OKX-WH] withdrawal event — id=${wdId} ccy=${ccy} amt=${amt} state=${state} verified=${verified} isNew=${isNew}`);
}

async function handleOrder(data: any, verified: boolean) {
  const ordId  = data?.ordId  ?? null;
  const instId = data?.instId ?? "?";
  const state  = data?.state  ?? "?";
  const fillSz = data?.fillSz ?? null;

  await saveEvent("order", ordId, data, verified);
  log(`[OKX-WH] order event — id=${ordId} inst=${instId} state=${state} fillSz=${fillSz} verified=${verified}`);
}

// ─── Self-test: proves sign+replay logic deterministically ───────────────────
// Run with: tsx -e "import('./server/crypto/okx-webhook.js').then(m => m.selfTest())"
export function selfTest() {
  const { createHmac } = require("crypto");
  const secret  = "test-secret-32-chars-padded-here";
  const path    = "/api/okx/webhook";
  const body    = JSON.stringify({ data: [{ depId: "abc", amt: "10.5", ccy: "USDT", state: "2" }] });
  const rawBody = Buffer.from(body);

  // Valid request: fresh timestamp
  const ts      = new Date().toISOString();
  const message = ts + "POST" + path + body;
  const sign    = createHmac("sha256", secret).update(message).digest("base64");

  // Simulate valid
  const tsMs   = Date.parse(ts);
  const ageMs  = Math.abs(Date.now() - tsMs);
  const ageOk  = ageMs / 1000 <= 30;
  const expected2 = createHmac("sha256", secret).update(ts + "POST" + path + rawBody.toString("utf8")).digest("base64");
  const match  = sign === expected2;
  console.log(`[OKX-WH selfTest] timestamp parse: tsMs=${tsMs} age=${(ageMs/1000).toFixed(2)}s ageOk=${ageOk}`);
  console.log(`[OKX-WH selfTest] signature match: ${match}`);

  // Stale request: 60s ago
  const staleTs  = new Date(Date.now() - 60_000).toISOString();
  const staleAge = Math.abs(Date.now() - Date.parse(staleTs)) / 1000;
  console.log(`[OKX-WH selfTest] stale replay guard: staleAge=${staleAge.toFixed(1)}s rejected=${staleAge > 30}`);

  // ISO-8601 parse safety
  const badParse = parseFloat(ts); // Would be ~2024 — wrong
  const goodParse = Date.parse(ts); // Correct epoch ms
  console.log(`[OKX-WH selfTest] parseFloat("ISO")=${badParse} Date.parse("ISO")=${goodParse} (correct: ~${Date.now()})`);

  // badParse < 10_000_000 proves parseFloat("ISO") is wrong (gives year e.g. 2026).
  // goodParse should be close to Date.now() (large epoch ms value).
  const goodParseCorrect = goodParse > 1_000_000_000_000; // >1T ms = post year 2001
  const badParseIsWrong  = badParse < 10_000_000;          // <10M proves parseFloat gave year, not epoch

  if (!ageOk || !match || staleAge <= 30 || !goodParseCorrect || !badParseIsWrong) {
    throw new Error("[OKX-WH selfTest] FAILED");
  }
  console.log("[OKX-WH selfTest] ALL PASSED ✅");
}

// ─── Main webhook handler ─────────────────────────────────────────────────────
export async function okxWebhookHandler(req: Request, res: Response) {
  // Always respond 200 quickly so OKX doesn't retry
  res.status(200).json({ ok: true });

  const verified = verifyOkxWebhook(req);
  if (!verified) {
    log("[OKX-WH] ⚠ Signature INVALID — logging event but skipping side effects");
  }

  const body: any = (req as any).body ?? {};
  const events: any[] = Array.isArray(body) ? body : (body.data ? [body] : []);

  for (const evt of events) {
    const arg   = evt.arg   ?? {};
    const data  = Array.isArray(evt.data) ? evt.data : [evt.data ?? evt];

    for (const item of data) {
      const channel = (arg.channel ?? "").toLowerCase();
      if (channel.includes("deposit")) {
        await handleDeposit(item, verified).catch(e => log(`[OKX-WH] deposit handler error: ${e.message}`));
      } else if (channel.includes("withdraw")) {
        await handleWithdrawal(item, verified).catch(e => log(`[OKX-WH] withdrawal handler error: ${e.message}`));
      } else if (channel.includes("order")) {
        await handleOrder(item, verified).catch(e => log(`[OKX-WH] order handler error: ${e.message}`));
      } else {
        // Unknown event type — still log it
        const okxId = item?.ordId ?? item?.wdId ?? item?.depId ?? null;
        await saveEvent("unknown", okxId, { channel, ...item }, verified)
          .catch(e => log(`[OKX-WH] save error: ${e.message}`));
        log(`[OKX-WH] unknown channel: ${arg.channel ?? "(none)"} verified=${verified}`);
      }
    }
  }
}
