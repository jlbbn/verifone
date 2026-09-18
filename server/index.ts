import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import { registerRoutes } from "./routes";
import { log } from "./logger";
import { serveStatic } from "./static";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { storage } from "./storage";
import { db } from "./db";
import { isTlsCertificateError } from "./db-ssl";
import { sql } from "drizzle-orm";
import { createHash, timingSafeEqual } from "crypto";
import { apiNotFoundGuard, canonicalizePathMiddleware } from "./path-guard";
import { createMaintenanceGuard, startMaintenanceAutoEndSweep } from "./maintenance";
import { bootstrapTailscale } from "./net/tailscale-bootstrap";

/**
 * Fail loudly on database TLS/certificate errors. Production requires full
 * certificate verification (see server/db-ssl.ts); if the managed Postgres
 * endpoint or its certificate chain ever changes and verification fails, we
 * must crash with a clear message in the deployment logs — not continue
 * without a working database and let requests hang or silently retry.
 */
function abortIfDbTlsError(err: unknown, phase: string): void {
  if (!isTlsCertificateError(err)) return;
  const e = err as { code?: string; message?: string };
  console.error(
    `FATAL DATABASE TLS/CERTIFICATE ERROR during ${phase}: ` +
      `${e.code ? `[${e.code}] ` : ""}${e.message ?? String(err)}\n` +
      "The database server's TLS certificate could not be verified. " +
      "This usually means the managed Postgres endpoint or its certificate " +
      "chain changed. The app refuses to start rather than run without a " +
      "verified database connection.",
  );
  process.exit(1);
}

// ── Global safety net ─────────────────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

/** Wraps a promise with a timeout so startup never hangs forever */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

const app = express();

// Trust the Replit/Heroku-style reverse proxy so req.ip reflects the real
// client IP (set from X-Forwarded-For by the trusted infrastructure layer).
// This is required for the OKX webhook IP allowlist to work correctly.
app.set("trust proxy", true);

// Canonicalize the request path (decode %XX, collapse duplicate slashes)
// before ANY route matching, including helmet/compression. See path-guard.ts
// for why this must run first.
app.use(canonicalizePathMiddleware);

// Hard maintenance lockdown — blocks every /api/* request (including
// ADMIN's) except a bypassed session. See server/maintenance.ts.
app.use(createMaintenanceGuard(storage));

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// Gzip/Brotli-eligible compression for all responses (HTML, JS, CSS, JSON).
// Without this, the ~1.7MB JS bundle is served uncompressed, which causes long
// blank-screen load times on slow/mobile connections.
app.use(compression());

// ── OKX Webhook — before body parsers (needs raw body for HMAC) ──────────────
import { rawBodyCapture, okxIpAllowlist, okxWebhookHandler } from "./crypto/okx-webhook.js";

if (!process.env.OKX_WEBHOOK_SECRET) {
  console.warn("[OKX-WH] ⚠ OKX_WEBHOOK_SECRET is not set — webhook signatures cannot be verified");
}

app.post("/api/okx/webhook", rawBodyCapture, okxIpAllowlist, (req, res) => {
  okxWebhookHandler(req, res).catch(err => {
    console.error("[OKX-WH] Unhandled error:", err);
  });
});

// ── Mercado Pago IPN — before auth middleware ─────────────────────────────────
app.get("/api/mp/ipn", async (req: Request, res: Response) => {
  const { topic, id } = req.query as { topic?: string; id?: string };
  log(`[MP-IPN] GET topic=${topic} id=${id}`);
  if (topic === "payment" && id && process.env.MP_ACCESS_TOKEN) {
    try {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      });
      const data = await r.json() as { status?: string; status_detail?: string };
      log(`[MP-IPN] Pago ${id} → status=${data.status} detail=${data.status_detail}`);
    } catch (err: any) {
      console.error("[MP-IPN] Error consultando pago:", err.message);
    }
  }
  res.sendStatus(200);
});

app.post("/api/mp/ipn", (_req: Request, res: Response) => {
  log(`[MP-IPN] POST recibido`);
  res.sendStatus(200);
});

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ── Infra log ingest ──────────────────────────────────────────────────────────
// Recibe líneas de journal reenviadas por droplets de infraestructura (firmante
// TRON). Auth: bearer token dedicado (INFRA_LOG_TOKEN). Registrado antes de
// registerRoutes para quedar fuera del middleware de sesión.
function safeTokenEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
app.post("/api/infra/logs", async (req: Request, res: Response) => {
  const expected = process.env.INFRA_LOG_TOKEN;
  if (!expected) return res.status(503).json({ message: "Log ingest disabled" });
  const auth = req.headers.authorization ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!provided || !safeTokenEqual(provided, expected)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const { host, source, lines } = (req.body ?? {}) as { host?: unknown; source?: unknown; lines?: unknown };
  if (typeof host !== "string" || typeof source !== "string" || !Array.isArray(lines)) {
    return res.status(400).json({ message: "Invalid payload" });
  }
  const clean = lines
    .filter((l): l is string => typeof l === "string")
    .slice(0, 2000)
    .map((l) => l.slice(0, 4000));
  try {
    await storage.createInfraLogs(host.slice(0, 100), source.slice(0, 50), clean);
    return res.status(204).end();
  } catch (e: any) {
    console.error("[INFRA-LOGS] insert failed:", e?.message);
    return res.status(500).json({ message: "Insert failed" });
  }
});

const SENSITIVE_PATHS = ["/api/login", "/api/pos/process-payment", "/api/payment-methods"];

// ── API response guarantee ────────────────────────────────────────────────
// If any downstream call (external broker/API, email provider, DB) stalls
// without its own timeout, this ensures the client always gets a definitive
// response instead of hanging indefinitely — which otherwise looks like a
// frozen/crashed app on the frontend.
const API_TIMEOUT_MS = 25_000;
app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`[TIMEOUT] ${req.method} ${req.path} exceeded ${API_TIMEOUT_MS}ms — responding 503`);
      res.status(503).json({ message: "La solicitud tardó demasiado en responder. Intenta de nuevo." });
    }
  }, API_TIMEOUT_MS);
  res.on("finish", () => clearTimeout(timer));
  res.on("close", () => clearTimeout(timer));
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      const isSensitive = SENSITIVE_PATHS.some((p) => path.startsWith(p));
      if (capturedJsonResponse && !isSensitive) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 120) logLine = logLine.slice(0, 119) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  // ── Tailscale (userspace, no root/TUN) ──────────────────────────────────────
  // Must be up before the server starts, so the local SOCKS5/HTTP proxy is
  // ready by the time anything tries to reach the mainnet TRON node/signer
  // over the tailnet. Bounded + never throws — a Tailscale failure must not
  // stop the rest of the app (auth, payments, etc.) from starting.
  await bootstrapTailscale();

  // ── DB migrations ──────────────────────────────────────────────────────────
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_engine_access boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pos_full_access boolean NOT NULL DEFAULT false`);
  } catch (e: any) {
    abortIfDbTlsError(e, "DB migrations");
    /* otherwise: columns likely already exist */
  }

  // ── Storage init ───────────────────────────────────────────────────────────
  try {
    await withTimeout(storage.initialize(), 20_000, "storage.initialize");
  } catch (e: any) {
    abortIfDbTlsError(e, "storage.initialize");
    log(`Storage init warning: ${e.message} — continuing startup`);
  }

  // ── Replit Auth (OIDC discovery can hang in some production envs) ──────────
  try {
    await withTimeout(setupAuth(app), 10_000, "setupAuth");
    registerAuthRoutes(app);
  } catch (e: any) {
    log(`Auth setup warning: ${e.message} — Replit OAuth disabled, admin login still works`);
  }

  const server = await registerRoutes(app);

  // ── Deny-by-default for unmatched API-shaped paths ──────────────────────────
  // Registered after every real /api/* route: anything shaped like an API path
  // that reaches here failed to match a real endpoint. See path-guard.ts.
  app.use(apiNotFoundGuard);

  // ── Global Express error handler ───────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Unhandled error:", message);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // ── Static files / Vite dev ────────────────────────────────────────────────
  if (app.get("env") === "development") {
    // Dynamic import with a variable specifier: keeps vite (a dev-only
    // dependency) out of the production bundle's import graph — esbuild
    // cannot statically analyze or inline it, so `node dist/index.js`
    // works with node_modules installed via --omit=dev. Never executed in
    // production; in dev, tsx resolves it against server/vite.ts.
    const devViteModule = "./vite";
    const { setupVite } = (await import(
      devViteModule
    )) as typeof import("./vite");
    await setupVite(app, server);
  } else {
    try {
      serveStatic(app);
    } catch (e: any) {
      log(`Static files warning: ${e.message}`);
      app.use("*", (_req: Request, res: Response) => {
        res.status(503).send("Frontend build not found — run npm run build");
      });
    }
  }

  // ── Start listening ────────────────────────────────────────────────────────
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
    startMaintenanceAutoEndSweep(storage);
    import("./stripeClient").then(({ getStripeClient }) =>
      getStripeClient().then(client =>
        client.balance.retrieve().then(() =>
          log("Stripe: conexión verificada ✅")
        ).catch(err => log(`Stripe key inválida: ${err.message}`))
      ).catch(err => log(`Stripe init error: ${err.message}`))
    ).catch(() => {});
  });

})().catch(err => {
  console.error("FATAL STARTUP ERROR — server could not start:", err);
  process.exit(1);
});
