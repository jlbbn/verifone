import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();

// Cabeceras de seguridad. CSP/COEP deshabilitados para no romper Vite/HMR.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ── Mercado Pago IPN — registrado ANTES de cualquier middleware de auth ───────
// MP envía GET ?topic=payment&id=XXX sin sesión (server-to-server).
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

app.post("/api/mp/ipn", (req: Request, res: Response) => {
  log(`[MP-IPN] POST recibido`);
  res.sendStatus(200);
});

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Rutas cuyos cuerpos de respuesta nunca deben registrarse (datos sensibles).
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

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 119) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // ── DB migration: add permission columns before seed ─────────────────────
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_engine_access boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pos_full_access boolean NOT NULL DEFAULT false`);
  } catch (_) { /* ignore */ }

  await storage.initialize();
  await setupAuth(app);
  registerAuthRoutes(app);

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Unhandled error:", message);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    import("./stripeClient").then(({ getStripeClient }) =>
      getStripeClient().then(client =>
        client.balance.retrieve().then(() =>
          log("Stripe: conexión verificada ✅ — listo para procesar pagos")
        ).catch(err => log(`Stripe key inválida: ${err.message}`))
      ).catch(err => log(`Stripe init error: ${err.message}`))
    ).catch(() => {});
  });
})();
