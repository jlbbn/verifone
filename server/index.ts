import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";

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

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

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

const SENSITIVE_PATHS = ["/api/login", "/api/pos/process-payment", "/api/payment-methods"];

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
  // ── DB migrations ──────────────────────────────────────────────────────────
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_engine_access boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pos_full_access boolean NOT NULL DEFAULT false`);
  } catch (_) { /* columns likely already exist */ }

  // ── Storage init ───────────────────────────────────────────────────────────
  try {
    await withTimeout(storage.initialize(), 20_000, "storage.initialize");
  } catch (e: any) {
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
