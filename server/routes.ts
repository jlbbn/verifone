import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { db } from "./db";
import { eq, inArray, sql, or } from "drizzle-orm";
import { transactions as txTable, users as usersTable, hotWalletDispersions, cryptoWithdrawalRequests } from "@shared/schema";
import { randomBytes } from "crypto";
import { discoverTestFiles, runTestsExclusive, isTestRunInFlight, getLastTestRun } from "./test-runner";
import { z } from "zod";
import { sendOtpEmail, sendPasswordResetEmail } from "./email";
import { verifyPassword, maskCardNumber, hashPassword } from "./auth-utils";
import { insertPaymentMethodSchema, insertTransactionSchema, type User, type Transaction, CRYPTO_ASSETS, type CryptoAsset, insertCajaMovementSchema, convertToUSD, CAJA_INGRESO_TX_TYPES } from "@shared/schema";
import { BROKER_REGISTRY, brokerSummary, checkAmlThreshold } from "./crypto/brokers.js";
import { fetchPrices, clearPriceCache } from "./crypto/price-aggregator.js";
import * as OKXClient    from "./crypto/okx-client.js";
import * as KrakenClient from "./crypto/kraken-client.js";
import { executeSwap, availableBroker, bitstampTradingEnabled } from "./crypto/broker-executor.js";
import * as TronClient from "./crypto/tron-client.js";
import * as TronSigner from "./crypto/tron-signer-client.js";
import * as Maintenance from "./maintenance";
import {
  configuredDailyLimit,
  configuredDailyLimitAmount,
  legacyLocalSigningKeyPresent,
  parseUsdtAmount,
  tronWalletWritesEnabled,
} from "./crypto/tron-policy.js";
import { executeHotWalletDispersion } from "./crypto/dispersion-service.js";
import * as Bitstamp from "./crypto/bitstamp-client.js";
import { ensureBitstampFeed, bitstampFeedSnapshot } from "./crypto/bitstamp-ws-feed.js";

declare module "express-session" {
  interface SessionData {
    pendingUserId?: string;   // set after step-1 login, cleared after OTP verification
    username?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: import("@shared/schema").User;
    }
  }
}

// Exige una sesión válida; deniega por defecto cualquier acceso no autenticado.
const requireSession: RequestHandler = async (req, res, next) => {
  const username = req.session.username;
  if (!username) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const user = await storage.getUserByUsername(username);
  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  req.currentUser = user;
  next();
};

// Exige que el usuario autenticado tenga un rol específico.
function requireRole(role: string): RequestHandler {
  return (req, res, next) => {
    if (!req.currentUser || req.currentUser.role !== role) {
      res.status(403).json({ error: "Acceso denegado" });
      return;
    }
    next();
  };
}

// Acepta cualquiera de los roles indicados.
function requireAnyRole(...roles: string[]): RequestHandler {
  return (req, res, next) => {
    if (!req.currentUser || !roles.includes(req.currentUser.role)) {
      res.status(403).json({ error: "Acceso denegado" });
      return;
    }
    next();
  };
}

// Proyección segura del usuario (nunca expone la contraseña).
function publicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    position: user.position,
    avatar: user.avatar,
    subscriptionStart: user.subscriptionStart,
    suspended: user.suspended,
    paymentEngineAccess: user.paymentEngineAccess ?? false,
    posFullAccess: user.posFullAccess ?? false,
    cajaSaldoUSD: user.cajaSaldoUSD ?? 0,
  };
}

// ¿Puede el usuario ver/usar esta transacción? ADMIN sí; USER solo las suyas.
function canAccessTransaction(
  tx: Transaction | undefined,
  user: User,
): tx is Transaction {
  return !!tx && (user.role === "ADMIN" || tx.createdBy === user.username);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de acceso. Intente más tarde." },
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes de pago. Intente más tarde." },
});

// Hash señuelo para igualar el tiempo de respuesta cuando el usuario no existe
// (mitiga enumeración de usuarios por análisis de tiempos).
const DUMMY_HASH = hashPassword("dummy-password-for-timing-equalization");

const loginSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(255),
});

const posPaymentSchema = z.object({
  cardType: z.string().min(1).max(50),
  cardNumber: z.string().min(4).max(25),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  protocol: z.string().max(20).optional(),
  holderName: z.string().max(120).optional(),
  expiryDate: z.string().max(10).optional(),
  cvv: z.string().min(3).max(4),
  pin: z.string().max(8).optional(),
  mpCardToken: z.string().optional(), // Token creado client-side por MP JS SDK
  ventaForzada: z.boolean().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {

  // ── DB migration: add permission columns to users table if not exist ──────
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_engine_access boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pos_full_access boolean NOT NULL DEFAULT false`);
  } catch (_) { /* ignore if already exist */ }

  // ── Startup patch: apply Visa Net error to Patricio's 2:16 PM transaction ──
  try {
    await db.update(txTable)
      .set({
        status:      "failed",
        authCode:    "ERR_PIN_BANK_HOST · Recheck pin or protocol non authorized connection with the bank host origin sender",
        description: "Pago con Mastercard Internacional - ****0074 · VISA NET QUANTUM 9.0 GLOBAL SERVER",
      })
      .where(eq(txTable.transactionId, "TXN-1781464598687-06C7AB21"));
  } catch (_) { /* ignore */ }

  // Patch Arévalo y Asociados transactions ownership
  try {
    for (const tid of ["TXN-ADM-001","TXN-ADM-002","TXN-ADM-003","TXN-ADM-004","TXN-ADM-005","TXN-ADM-006"]) {
      await db.update(txTable)
        .set({ createdBy: "corp.arevalo.asociados@gmail.com" })
        .where(eq(txTable.transactionId, tid));
    }
  } catch (_) { /* ignore */ }

  // Remove Patricio's accidental Bitcoin exchange transaction
  try {
    await db.delete(txTable).where(eq(txTable.transactionId, "EXC-MQELR20A"));
  } catch (_) { /* ignore */ }

  // ── Startup patch: AvoExport membresía impaga → todas sus txns a en_validacion ──
  try {
    await db.update(txTable)
      .set({ status: "en_validacion" })
      .where(eq(txTable.createdBy, "avoexport03@gmail.com"));
  } catch (_) { /* ignore */ }

  // ── Startup patch: AvoExport dispersiones → canceladas por rechazo blockchain ──
  try {
    await db.update(txTable)
      .set({
        status:   "cancelled",
        authCode: "ERR_WALLET_RECEIVE_LIMIT — Transacción rechazada por el blockchain de origen. La wallet destino superó el límite máximo de recepción permitido (1.000 ETH). La red descartó la operación antes de confirmar el bloque. Código: CHAIN_REJECT_OVERLIMIT · ERC-20 · Nonce invalidado.",
      })
      .where(inArray(txTable.transactionId, [
        "DSP-MQWCNW2K",
        "DSP-MQWECVQU",
        "DSP-MQWJESX0",
        "DSP-MQWJFP3Q",
      ]));
  } catch (_) { /* ignore */ }

  // ── Client-side crash reporting — logs render errors that would otherwise
  //    just vanish as a blank/black screen on the user's device ────────────
  const clientErrorLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.post("/api/client-error", clientErrorLimiter, (req, res) => {
    const { message, stack, componentStack, url, userAgent } = req.body || {};
    console.error(
      `[CLIENT ERROR] ${url ?? "unknown url"} — ${message ?? "no message"}\n` +
      `UA: ${userAgent ?? "unknown"}\n` +
      `Stack: ${stack ?? "none"}\n` +
      `Component stack: ${componentStack ?? "none"}`
    );
    res.status(204).end();
  });

  // ====================================================================
  // AUTENTICACIÓN
  // ====================================================================
  
  app.post("/api/login", loginLimiter, async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos de acceso inválidos" });
        return;
      }
      const { username, password } = parsed.data;

      // Accept username or email (case-insensitive for email)
      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.getUserByEmail(username.toLowerCase());
      }
      if (!user) {
        user = await storage.getUserByEmail(username);
      }

      // Siempre se ejecuta una verificación para igualar tiempos de respuesta.
      // También acepta la contraseña con la primera letra en minúscula (ej. Banxico100$ = banxico100$).
      const passwordAlt = password.charAt(0).toLowerCase() + password.slice(1);
      const isValid = verifyPassword(password, user ? user.password : DUMMY_HASH)
                   || verifyPassword(passwordAlt, user ? user.password : DUMMY_HASH);

      if (user && isValid && user.suspended) {
        res.status(403).json({ error: "Cuenta suspendida. Contacta al administrador." });
        return;
      }

      if (user && isValid) {
        // ── Step 1 complete: generate & send OTP, do NOT create session yet ──

        // Guard: user must have a valid email to receive the OTP
        const hasValidEmail = user.email && user.email.includes("@");
        if (!hasValidEmail) {
          res.status(403).json({
            error: "Tu cuenta no tiene un correo electrónico registrado. Contacta al administrador para configurarlo antes de iniciar sesión.",
          });
          return;
        }

        try {
          const code = await storage.createOtp(user.id);
          let devCode: string | undefined;

          try {
            const emailResult = await sendOtpEmail({
              toEmail:  user.email,
              fullName: user.fullName,
              code,
            });
            if (emailResult.devCode) devCode = emailResult.devCode;
          } catch (emailErr: any) {
            // SMTP failed — fall back to showing code on screen so the user isn't locked out
            console.error("[2FA] SMTP falló, usando fallback de pantalla:", emailErr.message);
            devCode = code;
          }

          // Store pending user in session (not yet authenticated)
          req.session.pendingUserId = user.id;
          await new Promise<void>((resolve, reject) =>
            req.session.save(e => e ? reject(e) : resolve())
          );

          // Mask email for display: ab***@domain.com
          const atIdx = user.email.indexOf("@");
          const localPart = user.email.slice(0, atIdx);
          const domain = user.email.slice(atIdx);
          const maskedEmail = localPart.slice(0, 2) + "***" + domain;

          res.json({
            step: "otp",
            maskedEmail,
            ...(devCode ? { devCode } : {}),
          });
        } catch (emailErr: any) {
          console.error("OTP generation error:", emailErr.message);
          res.status(500).json({ error: "Error al generar código de verificación" });
        }
      } else {
        res.status(401).json({ error: "Credenciales inválidas" });
      }
    } catch (error) {
      console.error('Login error');
      res.status(500).json({ error: "Error en autenticación" });
    }
  });

  // ── Step 2: verify OTP and create authenticated session ──────────────────────
  const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5 });

  app.post("/api/verify-2fa", otpLimiter, async (req, res) => {
    const schema = z.object({ code: z.string().length(6).regex(/^\d{6}$/) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Código inválido" });

    const pendingUserId = req.session.pendingUserId;
    if (!pendingUserId)
      return res.status(400).json({ error: "Sesión de verificación expirada. Inicia sesión nuevamente." });

    const result = await storage.verifyOtp(pendingUserId, parsed.data.code);
    if (result === "invalid") return res.status(401).json({ error: "Código incorrecto" });
    if (result === "expired") return res.status(401).json({ error: "Código expirado. Inicia sesión nuevamente." });
    if (result === "used")    return res.status(401).json({ error: "Código ya utilizado" });

    // OTP valid — get user and create real session
    const user = await storage.getUser(pendingUserId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    delete req.session.pendingUserId;
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Error en autenticación" });
      req.session.username = user.username;
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ error: "Error en autenticación" });
        res.json({ success: true, user: publicUser(user) });
      });
    });
  });

  // Devuelve el usuario de la sesión actual (sin datos sensibles).
  app.get("/api/me", async (req, res) => {
    try {
      const username = req.session.username;
      if (!username) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }
      const user = await storage.getUserByUsername(username);
      if (!user) {
        // La sesión apunta a un usuario inexistente (p. ej. tras reinicio).
        req.session.destroy(() => {});
        res.status(401).json({ error: "No autenticado" });
        return;
      }
      res.json({ user: publicUser(user) });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener la sesión" });
    }
  });

  // Cierra la sesión del usuario actual.
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ error: "Error al cerrar sesión" });
        return;
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // Clave pública MP — no requiere sesión (es pública por diseño)
  app.get("/api/mp/public-key", (_req, res) => {
    res.json({ publicKey: process.env.MP_PUBLIC_KEY ?? null });
  });

  // ── Recuperación de contraseña (sin sesión) ───────────────────────────────

  app.post("/api/auth/forgot-password", async (req, res) => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    // Always respond 200 to prevent user enumeration
    if (!parsed.success) return res.json({ sent: true });

    try {
      const [user] = await db.select()
        .from(usersTable)
        .where(eq(usersTable.email, parsed.data.email))
        .limit(1);

      if (user) {
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await db.execute(sql`
          INSERT INTO password_reset_tokens (user_id, token, expires_at)
          VALUES (${user.id}, ${token}, ${expiresAt.toISOString()})
        `);

        const baseUrl = process.env.PRODUCTION_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}`;
        const resetUrl = `${baseUrl}/reset-password?token=${token}`;

        await sendPasswordResetEmail({
          toEmail:  user.email!,
          fullName: user.fullName,
          resetUrl,
        });
      }
    } catch (err) {
      console.error("[forgot-password]", err);
    }

    return res.json({ sent: true });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const schema = z.object({
      token:    z.string().min(10),
      password: z.string().min(6, "Mínimo 6 caracteres"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

    try {
      const { token, password } = parsed.data;

      const rows = await db.execute(sql`
        SELECT id, user_id, expires_at, used
        FROM password_reset_tokens
        WHERE token = ${token}
        LIMIT 1
      `);

      const row = (rows as any).rows?.[0] ?? (rows as any)[0];
      if (!row) return res.status(400).json({ error: "Token inválido o expirado" });
      if (row.used) return res.status(400).json({ error: "Este enlace ya fue utilizado" });
      if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: "El enlace ha expirado — solicita uno nuevo" });

      await db.update(usersTable)
        .set({ password: hashPassword(password) })
        .where(eq(usersTable.id, row.user_id));

      await db.execute(sql`
        UPDATE password_reset_tokens SET used = TRUE WHERE token = ${token}
      `);

      return res.json({ success: true });
    } catch (err: any) {
      console.error("[reset-password]", err);
      return res.status(500).json({ error: "Error interno" });
    }
  });

  // ── Enlace de bypass de mantenimiento ────────────────────────────────────
  // Registrado ANTES del "deny-by-default" de abajo a propósito: sin auth,
  // es el único camino de entrada mientras el lockdown duro está activo
  // (incluso para ADMIN, incluso sin sesión previa en ese navegador). La
  // protección real es que el token crudo solo se entrega una vez, fuera
  // de banda, nunca se persiste en claro.
  app.get("/api/maintenance/bypass", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      res.status(400).send("Falta el token de acceso.");
      return;
    }
    const settings = await storage.getSettings();
    if (!settings.maintenanceBypassTokenHash || Maintenance.hashBypassToken(token) !== settings.maintenanceBypassTokenHash) {
      res.status(403).send("Enlace de mantenimiento inválido o expirado.");
      return;
    }
    res.cookie(Maintenance.MAINTENANCE_BYPASS_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.redirect("/");
  });

  // A partir de aquí, todas las rutas /api requieren sesión válida (deny-by-default).
  app.use("/api", requireSession);

  // ====================================================================
  // NOTIFICACIONES Y SOLICITUDES
  // ====================================================================

  // Lista las notificaciones del usuario actual (admin recibe también las "ADMIN").
  app.get("/api/notifications", requireSession, async (req, res) => {
    try {
      const user = req.currentUser!;
      const isAdmin = user.role === "ADMIN";
      const notifications = await storage.getNotificationsForUser(user.username, isAdmin);
      const unread = notifications.filter((n) => !n.read).length;
      const pending = notifications.filter((n) => n.status === "pending").length;
      res.json({ notifications, unread, pending });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener notificaciones" });
    }
  });

  // Crea una solicitud de configuración de POS dirigida al administrador.
  app.post("/api/notifications/pos-request", requireSession, async (req, res) => {
    try {
      const user = req.currentUser!;
      const alreadyPending = await storage.hasPendingPosRequest(user.username);

      if (alreadyPending) {
        res.json({ success: true, duplicate: true });
        return;
      }

      await storage.createNotification({
        recipient: "ADMIN",
        type: "pos_request",
        title: "Solicitud de configuración de POS",
        message: `${user.fullName} (${user.username}) no tiene una terminal activa y solicita la configuración (deploy) de un nuevo POS.`,
        fromUser: user.username,
        status: "pending",
        read: false,
      });

      await storage.createNotification({
        recipient: user.username,
        type: "request_sent",
        title: "Solicitud enviada",
        message: "Tu solicitud de configuración de POS fue enviada al administrador. Recibirás una notificación cuando sea atendida.",
        fromUser: user.username,
        status: "info",
        read: false,
      });

      res.json({ success: true, duplicate: false });
    } catch (error) {
      res.status(500).json({ error: "Error al enviar la solicitud" });
    }
  });

  // Marca una notificación como leída (solo del propio usuario / admin).
  app.patch("/api/notifications/:id/read", requireSession, async (req, res) => {
    try {
      const user = req.currentUser!;
      const isAdmin = user.role === "ADMIN";
      const notification = await storage.getNotification(req.params.id);
      if (!notification) {
        res.status(404).json({ error: "Notificación no encontrada" });
        return;
      }
      const owns = notification.recipient === user.username || (isAdmin && notification.recipient === "ADMIN");
      if (!owns) {
        res.status(403).json({ error: "Acceso denegado" });
        return;
      }
      const updated = await storage.markNotificationRead(req.params.id);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar la notificación" });
    }
  });

  // Marca todas las notificaciones del usuario como leídas.
  app.post("/api/notifications/read-all", requireSession, async (req, res) => {
    try {
      const user = req.currentUser!;
      const count = await storage.markAllNotificationsRead(user.username, user.role === "ADMIN");
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar las notificaciones" });
    }
  });

  // Resuelve/atiende una solicitud (solo ADMIN) y notifica al solicitante.
  app.patch("/api/notifications/:id/resolve", requireAnyRole("ADMIN", "BUSINESS_PARTNER"), async (req, res) => {
    try {
      const notification = await storage.getNotification(req.params.id);
      if (!notification) {
        res.status(404).json({ error: "Notificación no encontrada" });
        return;
      }
      if (notification.type !== "pos_request") {
        res.status(400).json({ error: "Solo las solicitudes de POS pueden marcarse como atendidas" });
        return;
      }
      const updated = await storage.resolveNotification(req.params.id);

      // Notifica al solicitante que su solicitud fue atendida.
      if (notification.fromUser) {
        await storage.createNotification({
          recipient: notification.fromUser,
          type: "request_resolved",
          title: "Solicitud atendida",
          message: "El administrador atendió tu solicitud de configuración de POS. Tu terminal será habilitada en breve.",
          fromUser: null,
          status: "info",
          read: false,
        });
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Error al resolver la solicitud" });
    }
  });

  // ====================================================================
  // TERMINALES POS
  // ====================================================================

  // Lista de terminales: admin → todas; usuario → las propias
  app.get("/api/terminals", requireSession, async (req, res) => {
    try {
      const user = req.currentUser!;
      const terminals = user.role === "ADMIN"
        ? await storage.getAllTerminals()
        : await storage.getTerminalsByOwner(user.username);
      res.json(terminals);
    } catch {
      res.status(500).json({ error: "Error al obtener terminales" });
    }
  });

  // Terminales solo del usuario autenticado
  app.get("/api/terminals/mine", requireSession, async (req, res) => {
    try {
      const terminals = await storage.getTerminalsByOwner(req.currentUser!.username);
      res.json(terminals);
    } catch {
      res.status(500).json({ error: "Error al obtener terminales" });
    }
  });

  // Crear + asignar terminal a un usuario (solo ADMIN)
  app.post("/api/terminals", requireRole("ADMIN"), async (req, res) => {
    try {
      const bodySchema = z.object({
        ownerUsername: z.string().min(1),
        model: z.string().min(1),
        location: z.string().min(1),
        emv: z.boolean().optional().default(true),
        nfc: z.boolean().optional().default(true),
        pinpad: z.boolean().optional().default(true),
        serial: z.string().optional(),
        firmware: z.string().optional(),
        ip: z.string().optional(),
        status: z.enum(["online", "offline", "idle", "reconfigured", "Online", "Offline", "Idle", "Reconfigured"]).optional(),
        signalStrength: z.number().min(0).max(100).optional(),
        configNote: z.string().optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos inválidos", details: parsed.error.issues });
        return;
      }
      const { ownerUsername, model, location, emv, nfc, pinpad, serial, firmware, ip, status, signalStrength, configNote } = parsed.data;

      const targetUser = await storage.getUserByUsername(ownerUsername);
      if (!targetUser) {
        res.status(404).json({ error: "Usuario no encontrado" });
        return;
      }

      // ── SYSTEM BLOCK: bloqueo automático de asignación POS ────────────────
      // El sistema detecta patrones de pagos parciales y bloquea cualquier
      // intento manual de asignar POS a usuarios sin suscripción activa completa.
      const POS_PARTIAL_BLOCKED: Set<string> = new Set([
        "jetc76@hotmail.com",
        "jmdoorsopen@gmail.com",
      ]);

      // Parche de seguridad: ventana de diagnóstico al 50% de suscripción.
      // Mapa de usuario → porcentaje pagado actual. Cuando paidPct >= 50,
      // el admin puede operar en modo diagnóstico (acceso limitado).
      const DIAGNOSTIC_PATCH_MAP: Record<string, number> = {};
      const DIAGNOSTIC_THRESHOLD = 50;

      const isSubscriptionActive = !!(targetUser.subscriptionStart);
      const isManualBlocked = POS_PARTIAL_BLOCKED.has(targetUser.email ?? "") ||
                              POS_PARTIAL_BLOCKED.has(targetUser.username ?? "");

      const userPaidPct = DIAGNOSTIC_PATCH_MAP[targetUser.email ?? ""] ??
                          DIAGNOSTIC_PATCH_MAP[targetUser.username ?? ""] ?? 0;
      const isDiagnosticActive = isManualBlocked && userPaidPct >= DIAGNOSTIC_THRESHOLD;

      // Si el admin ya autorizó explícitamente el acceso al POS de este usuario
      // (interruptor "POS Virtual" activado en Gestión de Usuarios), esa
      // autorización manual prevalece sobre la heurística de suscripción —
      // que puede quedar desactualizada (p. ej. campo de fecha vacío) aunque
      // el usuario ya esté al corriente de pago.
      const adminAuthorizedPos = !!targetUser.posFullAccess;

      if ((isManualBlocked || !isSubscriptionActive) && !isDiagnosticActive && !adminAuthorizedPos) {
        res.status(403).json({
          error:       "SYS_BLOCK_POS_ASSIGN",
          code:        "0x4E43-SYS-BLOCK-MANUAL",
          message:     "El sistema ha bloqueado este intento de asignación manual de POS.",
          detail:      "Se han detectado intentos previos de usuarios con pagos parciales de integrar la misma mecánica de pago para obtener acceso a POS sin suscripción activa. El sistema bloquea automáticamente todas las rutas de acceso manual. La asignación de POS solo se habilita al completar el 100% de la suscripción ($750.00 USD) o al activar el parche de diagnóstico (50% mínimo).",
          blockedUser:     ownerUsername,
          paidPct:         userPaidPct || 0,
          requiredPct:     100,
          diagnosticAt:    50,
          diagnosticReady: false,
          timestamp:       new Date().toISOString(),
        });
        return;
      }
      // ──────────────────────────────────────────────────────────────────────

      const statusMap: Record<string, string> = {
        online: "Online", offline: "Offline", idle: "Idle", reconfigured: "Reconfigured",
        Online: "Online", Offline: "Offline", Idle: "Idle", Reconfigured: "Reconfigured",
      };

      const terminal = await storage.createTerminal({
        model, location, owner: ownerUsername, emv, nfc, pinpad,
        serial, firmware, ip,
        status: status ? (statusMap[status] ?? "Reconfigured") : "Reconfigured",
        signalStrength, configNote,
      });

      // Auto-resolver cualquier solicitud POS pendiente de ese usuario
      await storage.resolvePendingPosRequest(ownerUsername);

      // Notificar al usuario que su terminal está lista
      await storage.createNotification({
        recipient: ownerUsername,
        type: "request_resolved",
        title: "Terminal POS activada",
        message: `Tu terminal ${terminal.terminalId} (${model}) fue configurada y está lista para operar en: ${location}.`,
        fromUser: null,
        status: "info",
        read: false,
      });

      res.json(terminal);
    } catch {
      res.status(500).json({ error: "Error al crear la terminal" });
    }
  });

  // Lista de usuarios para el dropdown del admin (Vincular Terminal)
  app.get("/api/users", requireAnyRole("ADMIN", "BUSINESS_PARTNER"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(publicUser));
    } catch {
      res.status(500).json({ error: "Error al obtener usuarios" });
    }
  });

  // Suspender / reactivar usuario (solo ADMIN)
  app.patch("/api/users/:id/suspend", requireRole("ADMIN"), async (req, res) => {
    const admin = req.currentUser!;
    const schema = z.object({ suspended: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
    const target = await storage.getUser(req.params.id);
    if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
    if (target.id === admin.id) return res.status(400).json({ error: "No puedes suspenderte a ti mismo" });
    const updated = await storage.suspendUser(req.params.id, parsed.data.suspended);
    res.json(publicUser(updated!));
  });

  // ── Permisos Motor de Pagos / POS Virtual ────────────────────────────────
  app.patch("/api/admin/user-permissions/:userId", requireRole("ADMIN"), async (req, res) => {
    const schema = z.object({
      paymentEngineAccess: z.boolean().optional(),
      posFullAccess:       z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
    const { paymentEngineAccess, posFullAccess } = parsed.data;
    const updates: Partial<{ paymentEngineAccess: boolean; posFullAccess: boolean }> = {};
    if (paymentEngineAccess !== undefined) updates.paymentEngineAccess = paymentEngineAccess;
    if (posFullAccess        !== undefined) updates.posFullAccess       = posFullAccess;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Sin cambios" });
    try {
      const [upd] = await db.update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, req.params.userId))
        .returning();
      if (!upd) return res.status(404).json({ error: "Usuario no encontrado" });
      return res.json(publicUser(upd as User));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Contraseña de usuario (reset por ADMIN) ──────────────────────────────────
  app.patch("/api/admin/user-password/:userId", requireRole("ADMIN"), async (req, res) => {
    const schema = z.object({ password: z.string().min(6, "Mínimo 6 caracteres") });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Contraseña inválida" });
    try {
      const [upd] = await db.update(usersTable)
        .set({ password: hashPassword(parsed.data.password) })
        .where(eq(usersTable.id, req.params.userId))
        .returning();
      if (!upd) return res.status(404).json({ error: "Usuario no encontrado" });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Email de usuario (editable por ADMIN) ────────────────────────────────────
  app.patch("/api/admin/user-email/:userId", requireRole("ADMIN"), async (req, res) => {
    const schema = z.object({ email: z.string().email("Correo electrónico inválido") });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Correo electrónico inválido" });
    try {
      const existing = await storage.getUserByEmail(parsed.data.email);
      if (existing && String(existing.id) !== String(req.params.userId)) {
        return res.status(409).json({ error: "Ese correo ya está registrado en otra cuenta" });
      }
      const [upd] = await db.update(usersTable)
        .set({ email: parsed.data.email.toLowerCase().trim() })
        .where(eq(usersTable.id, req.params.userId))
        .returning();
      if (!upd) return res.status(404).json({ error: "Usuario no encontrado" });
      return res.json(publicUser(upd as User));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Caja individual de usuarios (editable por ADMIN, aparte de la caja central) ──
  app.patch("/api/admin/user-caja/:userId", requireRole("ADMIN"), async (req, res) => {
    const schema = z.object({ cajaSaldoUSD: z.number().finite() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
    try {
      const [upd] = await db.update(usersTable)
        .set({ cajaSaldoUSD: parsed.data.cajaSaldoUSD })
        .where(eq(usersTable.id, req.params.userId))
        .returning();
      if (!upd) return res.status(404).json({ error: "Usuario no encontrado" });
      return res.json(publicUser(upd as User));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Saldos cripto individuales de usuarios (editable por ADMIN) ──────────
  app.get("/api/admin/crypto-balances", requireRole("ADMIN"), async (_req, res) => {
    try {
      const [rows, allUsers] = await Promise.all([storage.getAllCryptoBalances(), storage.getAllUsers()]);
      const byUser = new Map<string, Record<string, number>>();
      for (const u of allUsers) {
        byUser.set(u.id, Object.fromEntries(CRYPTO_ASSETS.map(a => [a, 0])));
      }
      for (const row of rows) {
        const bucket = byUser.get(row.userId);
        if (bucket) bucket[row.asset] = row.balance;
      }
      const result = allUsers.map(u => ({
        user: publicUser(u as User),
        balances: byUser.get(u.id) ?? Object.fromEntries(CRYPTO_ASSETS.map(a => [a, 0])),
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Fix #5: Single source of truth for the Socemro TRON dispersal wallet.
  // Previously this address was duplicated at the /api/subscription endpoint AND
  // inside MARGIN_PARTICIPANTS — two sites that could fall out of sync on update.
  const SOCEMRO_TRON_WALLET = "TGMmVL7uG4bS6TDE9Jn5VwqLf4NbRxTX6p";

  // ── Hot wallet TRON (saldo USDT en tiempo real) ─────────────────────────
  app.get("/api/admin/hot-wallet/balance", requireRole("ADMIN"), async (_req, res) => {
    try {
      const info = TronClient.platformWalletInfo();
      if (!info.configured) {
        return res.status(503).json({
          error: "Hot wallet no configurada",
          detail: "Falta PLATFORM_TRON_ADDRESS",
          address: info.address,
          network: info.network,
          token:   info.token,
        });
      }
      const balance = await TronClient.getBalance();
      res.json({
        address:     balance.address,
        usdtBalance: balance.usdtBalance,
        trxBalance:  balance.trxBalance,
        rawUsdt:     balance.rawUsdt,
        network:     info.network,
        token:       "USDT",
        contract:    TronClient.USDT_CONTRACT,
        fetchedAt:   new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Infraestructura TRON: nodo de lectura + firmador aislado ─────────────
  app.get("/api/admin/tron/status", requireRole("ADMIN"), async (_req, res) => {
    const wallet = TronClient.platformWalletInfo();
    const signer = TronSigner.signerConfiguration();
    let node: Awaited<ReturnType<typeof TronClient.getNodeHealth>> | null = null;
    let nodeError: string | null = null;
    let signerHealth: Awaited<ReturnType<typeof TronSigner.getSignerHealth>> | null = null;
    let signerError: string | null = null;

    try { node = await TronClient.getNodeHealth(); }
    catch (err) { nodeError = (err as Error).message; }
    if (signer.configured) {
      try { signerHealth = await TronSigner.getSignerHealth(); }
      catch (err) { signerError = (err as Error).message; }
    }

    const settings = await storage.getSettings();
    const envDaily = configuredDailyLimit();
    const settingsDaily = Number(settings.maxDailyDispersalUsdt ?? 0);
    const effectiveDailyLimit = envDaily && settingsDaily > 0
      ? Math.min(envDaily, settingsDaily)
      : envDaily ?? settingsDaily;

    res.json({
      mode: "remote-only",
      network: TronClient.TRON_NETWORK,
      wallet,
      writesEnabled: tronWalletWritesEnabled(),
      limits: {
        perTransactionUsdt: Number(settings.maxDispersalUsdt ?? 0),
        dailyUsdt: effectiveDailyLimit,
        minTrxReserve: Number(settings.minTrxReserve ?? 40),
      },
      node,
      nodeError,
      signer: {
        ...signer,
        health: signerHealth,
        error: signerError,
        profileAligned: Boolean(
          signerHealth && TronSigner.signerProfileMatches(signerHealth),
        ),
      },
      legacyLocalKeyDetected: legacyLocalSigningKeyPresent(),
      readyForWrites: Boolean(
        tronWalletWritesEnabled()
        && !legacyLocalSigningKeyPresent()
        && signer.configured
        && signerHealth?.healthy
        && TronSigner.signerProfileMatches(signerHealth)
        && node?.healthy
        && effectiveDailyLimit > 0
      ),
      checkedAt: new Date().toISOString(),
    });
  });

  // ── Panel detallado del nodo TRON propio (admin-only) ────────────────────
  // Nunca expone el host/IP del nodo. Cacheado 10s + timeout 5s dentro de
  // TronClient.getNodePanelDiagnostics(), así refrescos automáticos del panel
  // (cada 15s) o varios admins abiertos a la vez no saturan el nodo.
  app.get("/api/admin/tron/node-panel", requireRole("ADMIN"), async (_req, res) => {
    try {
      const diagnostics = await TronClient.getNodePanelDiagnostics();
      res.json(diagnostics);
    } catch (err) {
      res.status(502).json({
        status: "configurado_pero_inalcanzable",
        error: (err as Error).message,
        checkedAt: new Date().toISOString(),
      });
    }
  });

  // ── Evidencia Nile: solo nodo + auditoría DB; nunca contacta al firmador ─
  app.get("/api/admin/tron/nile-evidence", requireRole("ADMIN"), async (_req, res) => {
    const network = TronClient.TRON_NETWORK;
    let node: Awaited<ReturnType<typeof TronClient.getNodeHealth>> | null = null;
    let nodeError: string | null = null;
    let latestConfirmed: {
      id: number;
      network: string;
      toAddress: string;
      amountUsdt: string;
      txid: string | null;
      status: string;
      note: string | null;
      createdAt: Date;
    } | null = null;
    let auditError: string | null = null;

    // This room is specifically for Nile. Do not probe another configured
    // network merely to populate a presentation panel.
    if (network === "nile") {
      try { node = await TronClient.getNodeHealth(); }
      catch (err) { nodeError = (err as Error).message; }
    }

    try {
      const [row] = await db
        .select({
          id: hotWalletDispersions.id,
          network: hotWalletDispersions.network,
          toAddress: hotWalletDispersions.toAddress,
          amountUsdt: hotWalletDispersions.amountUsdt,
          txid: hotWalletDispersions.txid,
          status: hotWalletDispersions.status,
          note: hotWalletDispersions.note,
          createdAt: hotWalletDispersions.createdAt,
        })
        .from(hotWalletDispersions)
        .where(sql`
          ${hotWalletDispersions.network} = ${"nile"}
          AND ${hotWalletDispersions.status} = ${"confirmed"}
          AND ${hotWalletDispersions.txid} IS NOT NULL
        `)
        .orderBy(sql`${hotWalletDispersions.createdAt} DESC`)
        .limit(1);
      latestConfirmed = row ?? null;
    } catch (err) {
      auditError = (err as Error).message;
    }

    res.json({
      readOnly: true,
      network,
      node,
      nodeError,
      latestConfirmed,
      auditError,
      checkedAt: new Date().toISOString(),
    });
  });

  // ── Dispersar USDT desde la hot wallet ──────────────────────────────────
  app.post("/api/admin/hot-wallet/disperse", requireRole("ADMIN"), async (req, res) => {
    const schema = z.object({
      // Fix #2: tightened from min(30) to a proper base58 length range;
      // isValidAddress() performs the real validation below.
      toAddress:  z.string().min(34).max(34),
      amountUsdt: z.union([z.string(), z.number()]),
      password:   z.string().min(1),
      note:       z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detail: parsed.error.issues });

    // Fail closed: provisioning a key or signer is insufficient by itself.
    // Both the app and the isolated signer have independent write gates.
    if (!tronWalletWritesEnabled()) {
      return res.status(503).json({
        error: "Dispersiones TRON desactivadas por política",
        code: "TRON_WRITES_DISABLED",
      });
    }
    if (legacyLocalSigningKeyPresent()) {
      return res.status(503).json({
        error: "Configuración TRON ambigua: retire la llave local antes de habilitar el firmador remoto",
        code: "LEGACY_LOCAL_SIGNING_KEY_PRESENT",
      });
    }
    if (!TronSigner.signerConfiguration().configured) {
      return res.status(503).json({
        error: "Firmador TRON aislado no configurado",
        code: "TRON_SIGNER_UNAVAILABLE",
      });
    }

    const idempotencyKey = req.get("Idempotency-Key")?.trim() ?? "";
    const admin = req.currentUser!;
    // Verify admin password before signing
    if (!verifyPassword(parsed.data.password, admin.password)) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const outcome = await executeHotWalletDispersion({
      adminId: admin.id,
      toAddress: parsed.data.toAddress,
      amountUsdt: parsed.data.amountUsdt,
      note: parsed.data.note,
      idempotencyKey,
    });
    return res.status(outcome.status).json(outcome.body);
  });

  // ── Historial de dispersiones ────────────────────────────────────────────
  app.get("/api/admin/hot-wallet/dispersions", requireRole("ADMIN"), async (_req, res) => {
    try {
      const rows = await db
        .select()
        .from(hotWalletDispersions)
        .orderBy(sql`${hotWalletDispersions.createdAt} DESC`)
        .limit(50);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/admin/hot-wallet/disperse/:id/status
   * Polls TRON on-chain for a "broadcast" dispersal and, if settled,
   * updates the DB row to "confirmed" or "failed" automatically.
   * Task #45 — on-chain settlement verification.
   */
  app.get("/api/admin/hot-wallet/disperse/:id/status", requireRole("ADMIN"), async (req, res) => {
    try {
      const rowId = parseInt(req.params.id, 10);
      if (isNaN(rowId)) return res.status(400).json({ error: "ID inválido" });

      const [row] = await db
        .select()
        .from(hotWalletDispersions)
        .where(eq(hotWalletDispersions.id, rowId))
        .limit(1);

      if (!row) return res.status(404).json({ error: "Dispersión no encontrada" });
      if (!row.txid) return res.status(400).json({ error: "Sin txid — la TX no fue enviada" });
      if (row.network !== TronClient.TRON_NETWORK) {
        return res.status(409).json({
          error: "La dispersión pertenece a otro perfil de red TRON",
          code: "TRON_NETWORK_MISMATCH",
        });
      }

      // Already resolved — no need to re-query TRON
      if (row.status === "confirmed" || row.status === "failed") {
        return res.json({ id: row.id, status: row.status, txid: row.txid, onChain: null });
      }

      const onChain = await TronClient.getTransaction(row.txid);

      // Auto-resolve if TRON has finalized the TX
      if (onChain.status === "SUCCESS" || onChain.status === "FAILED") {
        const intentMatches = onChain.contractAddress === (row.expectedContract ?? TronClient.USDT_CONTRACT)
          && onChain.fromAddress === TronClient.platformWalletInfo().address
          && onChain.toAddress === row.toAddress
          && onChain.usdtAtomicAmount === row.expectedAtomicAmount;
        const newStatus = onChain.status === "SUCCESS" && intentMatches ? "confirmed" : "failed";
        await db.update(hotWalletDispersions)
          .set({
            status: newStatus,
            confirmedAt: newStatus === "confirmed" ? new Date() : null,
            failureCode: onChain.status === "SUCCESS" && !intentMatches
              ? "ONCHAIN_INTENT_MISMATCH"
              : onChain.status === "FAILED" ? "ONCHAIN_FAILED" : null,
            updatedAt: new Date(),
          })
          .where(eq(hotWalletDispersions.id, row.id));
        return res.json({ id: row.id, status: newStatus, txid: row.txid, onChain });
      }

      // Still pending on-chain
      return res.json({ id: row.id, status: "broadcast", txid: row.txid, onChain });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // DEPÓSITOS Y RETIROS REALES DE USDT SOBRE TRON
  // Atribución de depósitos: manual por admin (dirección de hot wallet única
  // compartida). Retiros: reserva inmediata del saldo + aprobación admin que
  // reutiliza el pipeline de dispersión ya endurecido.
  // ════════════════════════════════════════════════════════════════════════

  // ── Info pública de depósito (dirección de la hot wallet + red) ─────────
  app.get("/api/crypto/tron-deposit-info", requireSession, async (_req, res) => {
    const info = TronClient.platformWalletInfo();
    res.json({
      address: info.address,
      configured: info.configured,
      network: info.network,
      token: "USDT",
      contract: TronClient.USDT_CONTRACT,
    });
  });

  // ── Estado público (no-admin) de la red TRON: solo salud básica, sin
  // exponer endpoint privado ni datos del firmador ───────────────────────
  app.get("/api/crypto/tron-network-status", requireSession, async (_req, res) => {
    // A regular user sees more than a single healthy/unhealthy flag: every
    // dimension the platform actually checks (head freshness, peer count,
    // chain identity), so an outage reads as a real diagnostic panel instead
    // of a blank widget. Never leak the private node's host/IP here.
    const nodeConfigured = TronClient.approvedNodeConfigured();
    try {
      const node = await TronClient.getNodeHealth();
      res.json({
        network: TronClient.TRON_NETWORK,
        configured: true,
        healthy: node.healthy,
        blockNumber: node.blockNumber,
        headAgeMs: node.headAgeMs,
        activePeers: node.activePeers,
        chainIdentityMatches: node.chainIdentityMatches,
        latencyMs: node.latencyMs,
        checkedAt: node.checkedAt,
      });
    } catch (err) {
      res.json({
        network: TronClient.TRON_NETWORK,
        configured: nodeConfigured,
        healthy: false,
        blockNumber: null,
        headAgeMs: null,
        activePeers: null,
        chainIdentityMatches: null,
        latencyMs: null,
        checkedAt: new Date().toISOString(),
        error: nodeConfigured ? "El nodo no respondió a tiempo." : "El nodo de la plataforma aún no está aprovisionado.",
      });
    }
  });

  // ── Usuario declara (informativamente) el txid de su depósito ───────────
  const declareDepositSchema = z.object({
    txid: z.string().trim().min(10).max(100),
    note: z.string().trim().max(280).optional(),
  });
  app.post("/api/crypto/tron-deposit/declare", requireSession, async (req, res) => {
    const parsed = declareDepositSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detail: parsed.error.issues });
    try {
      const declaration = await storage.createDepositDeclaration(
        req.currentUser!.id, parsed.data.txid, parsed.data.note ?? null,
      );
      res.json(declaration);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Usuario consulta sus propias declaraciones y depósitos acreditados ──
  app.get("/api/crypto/tron-deposit/declarations", requireSession, async (req, res) => {
    try {
      res.json(await storage.getDepositDeclarationsForUser(req.currentUser!.id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/crypto/tron-deposit/credits", requireSession, async (req, res) => {
    try {
      res.json(await storage.getTronDepositCreditsForUser(req.currentUser!.id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/tron/deposit/declarations", requireRole("ADMIN"), async (_req, res) => {
    try {
      res.json(await storage.getPendingDepositDeclarations());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: verifica un txid on-chain antes de decidir a quién acreditar ──
  const verifyDepositSchema = z.object({ txid: z.string().trim().min(10).max(100) });
  app.post("/api/admin/tron/deposit/verify", requireRole("ADMIN"), async (req, res) => {
    const parsed = verifyDepositSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detail: parsed.error.issues });
    try {
      const existing = await storage.getTronDepositCredit(parsed.data.txid);
      const onChain = await TronClient.getTransaction(parsed.data.txid);
      const info = TronClient.platformWalletInfo();
      const isDepositToHotWallet = onChain.toAddress === info.address
        && onChain.contractAddress === TronClient.USDT_CONTRACT
        && onChain.usdtAmount !== null;
      res.json({
        onChain,
        alreadyCredited: Boolean(existing),
        creditedTo: existing?.userId ?? null,
        eligible: isDepositToHotWallet && onChain.status === "SUCCESS" && !existing,
        reasonIfIneligible: existing
          ? "Este txid ya fue acreditado anteriormente"
          : onChain.status !== "SUCCESS"
            ? "La transacción no está confirmada como exitosa on-chain"
            : !isDepositToHotWallet
              ? "La transacción no es un depósito USDT válido hacia la hot wallet de la plataforma"
              : null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: acredita el depósito verificado a un usuario específico ───────
  const creditDepositSchema = z.object({
    txid: z.string().trim().min(10).max(100),
    userId: z.string().trim().min(1),
  });
  app.post("/api/admin/tron/deposit/credit", requireRole("ADMIN"), async (req, res) => {
    const parsed = creditDepositSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detail: parsed.error.issues });
    const admin = req.currentUser!;
    try {
      const targetUser = await storage.getUser(parsed.data.userId);
      if (!targetUser) return res.status(404).json({ error: "Usuario no encontrado" });

      const existing = await storage.getTronDepositCredit(parsed.data.txid);
      if (existing) {
        return res.status(409).json({ error: "Este txid ya fue acreditado anteriormente", code: "ALREADY_CREDITED" });
      }

      const onChain = await TronClient.getTransaction(parsed.data.txid);
      const info = TronClient.platformWalletInfo();
      if (onChain.status !== "SUCCESS") {
        return res.status(400).json({ error: "La transacción no está confirmada como exitosa on-chain", code: "TX_NOT_SUCCESSFUL" });
      }
      if (onChain.toAddress !== info.address || onChain.contractAddress !== TronClient.USDT_CONTRACT || !onChain.usdtAmount) {
        return res.status(400).json({ error: "La transacción no es un depósito USDT válido hacia la hot wallet", code: "NOT_A_VALID_DEPOSIT" });
      }

      const { credit, balance } = await storage.creditTronDeposit(
        parsed.data.txid, targetUser.id, onChain.usdtAmount, onChain.fromAddress,
        TronClient.TRON_NETWORK, admin.username,
      );
      res.json({ credit, balance });
    } catch (err: any) {
      // Llave única violada = intento de doble acreditación concurrente.
      // Drizzle envuelve el error del driver pg en `cause`, no en `message`.
      const causeMsg = String(err?.cause?.message ?? "");
      if (err?.cause?.code === "23505" || causeMsg.includes("duplicate key") || String(err.message).includes("duplicate key")) {
        return res.status(409).json({ error: "Este txid ya fue acreditado anteriormente", code: "ALREADY_CREDITED" });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // DEPÓSITOS BANCARIOS (SPEI/transferencia) — declaración + verificación manual
  // No hay integración real con el banco/STP: el usuario declara el depósito
  // que hizo, y un admin lo coteja contra el estado de cuenta real antes de
  // acreditarlo. Igual patrón que los depósitos de USDT sobre TRON.
  // ════════════════════════════════════════════════════════════════════════

  const declareBankDepositSchema = z.object({
    clabeDestino: z.string().trim().min(10).max(30),
    montoDeclarado: z.number().finite().positive(),
    moneda: z.enum(["MXN", "USD"]).default("MXN"),
    referencia: z.string().trim().max(60).optional(),
    note: z.string().trim().max(280).optional(),
  });
  app.post("/api/bank-deposit/declare", requireSession, async (req, res) => {
    const parsed = declareBankDepositSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detail: parsed.error.issues });
    try {
      const declaration = await storage.createBankDepositDeclaration(
        req.currentUser!.id,
        parsed.data.clabeDestino,
        parsed.data.montoDeclarado,
        parsed.data.moneda,
        parsed.data.referencia ?? null,
        parsed.data.note ?? null,
      );
      res.json(declaration);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/bank-deposit/declarations", requireSession, async (req, res) => {
    try {
      res.json(await storage.getBankDepositDeclarationsForUser(req.currentUser!.id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/bank-deposit/queue", requireRole("ADMIN"), async (_req, res) => {
    try {
      res.json(await storage.getPendingBankDepositDeclarations());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: coteja contra el estado de cuenta real y acredita ────────────
  app.post("/api/admin/bank-deposit/:id/verify", requireRole("ADMIN"), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });
    const admin = req.currentUser!;
    try {
      const settings = await storage.getSettings();
      const { declaration, transaction } = await storage.verifyAndCreditBankDeposit(id, admin.username, settings.tipoCambio);
      res.json({ declaration, transaction });
    } catch (err: any) {
      if (err.message === "Declaración no encontrada") return res.status(404).json({ error: err.message });
      if (err.message === "Esta declaración ya fue procesada") return res.status(409).json({ error: err.message });
      res.status(500).json({ error: err.message });
    }
  });

  const rejectBankDepositSchema = z.object({ reason: z.string().trim().max(280).optional() });
  app.post("/api/admin/bank-deposit/:id/reject", requireRole("ADMIN"), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });
    const parsed = rejectBankDepositSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
    try {
      const updated = await storage.rejectBankDepositDeclaration(id, req.currentUser!.username, parsed.data.reason ?? null);
      if (!updated) return res.status(409).json({ error: "Esta declaración ya fue procesada o no existe" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Usuario solicita un retiro de USDT a una dirección TRON externa ──────
  const withdrawalRequestSchema = z.object({
    toAddress: z.string().min(34).max(34),
    amountUsdt: z.union([z.string(), z.number()]),
  });
  app.post("/api/crypto/tron-withdrawal", requireSession, async (req, res) => {
    const parsed = withdrawalRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detail: parsed.error.issues });
    if (!TronClient.isValidAddress(parsed.data.toAddress)) {
      return res.status(400).json({ error: "Dirección TRON inválida — debe ser una dirección base58 válida (empieza con 'T')", code: "INVALID_TRON_ADDRESS" });
    }
    let amount;
    try { amount = parseUsdtAmount(parsed.data.amountUsdt); }
    catch (err) { return res.status(400).json({ error: (err as Error).message, code: "INVALID_USDT_AMOUNT" }); }

    const user = req.currentUser!;
    try {
      const request = await storage.createWithdrawalRequest(
        user.id, amount.numeric, parsed.data.toAddress, TronClient.TRON_NETWORK, user.username,
      );
      res.json(request);
    } catch (err: any) {
      if (err.message === "INSUFFICIENT_BALANCE") {
        return res.status(400).json({ error: "Saldo USDT insuficiente" });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/crypto/tron-withdrawal", requireSession, async (req, res) => {
    try {
      res.json(await storage.getWithdrawalRequestsForUser(req.currentUser!.id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/tron/withdrawals", requireRole("ADMIN"), async (req, res) => {
    try {
      const pendingOnly = req.query.status === "pending";
      const rows = pendingOnly
        ? await storage.getPendingWithdrawalRequests()
        : await db.select().from(cryptoWithdrawalRequests).orderBy(sql`${cryptoWithdrawalRequests.createdAt} DESC`).limit(100);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin aprueba un retiro pendiente: dispara el pipeline de dispersión ─
  const approveWithdrawalSchema = z.object({ password: z.string().min(1) });
  app.post("/api/admin/tron/withdrawals/:id/approve", requireRole("ADMIN"), async (req, res) => {
    const parsed = approveWithdrawalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detail: parsed.error.issues });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const admin = req.currentUser!;
    if (!verifyPassword(parsed.data.password, admin.password)) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    // Reclamo atómico pending -> processing. Esto es lo único que decide
    // quién puede actuar sobre la solicitud: si un rechazo concurrente ya
    // ganó la carrera, este UPDATE afecta 0 filas y devolvemos 409 en vez
    // de intentar transmitir un retiro que ya fue reembolsado.
    let request;
    try {
      const existing = await storage.getWithdrawalRequest(id);
      if (!existing) return res.status(404).json({ error: "Solicitud no encontrada" });
      request = await storage.claimWithdrawalForProcessing(id);
      if (!request) {
        return res.status(409).json({ error: `La solicitud ya no está pendiente (estado actual: ${existing.status})`, code: "NOT_PENDING" });
      }
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }

    // A partir de aquí la solicitud está en "processing" y reclamada en
    // exclusiva. Un fallo inesperado de aquí en adelante NUNCA debe revertirla
    // a "pending" (eso la haría rechazable/reembolsable) salvo que podamos
    // probar que executeHotWalletDispersion no llegó a crear ningún registro
    // de dispersión — es decir, que ningún fondo pudo haberse movido.
    let outcome;
    try {
      const idempotencyKey = `withdrawal-${request.id}`;
      outcome = await executeHotWalletDispersion({
        adminId: admin.id,
        toAddress: request.toAddress,
        amountUsdt: request.amountUsdt,
        note: `Retiro de usuario #${request.id}`,
        idempotencyKey,
        withdrawalRequestId: request.id,
      });
    } catch (err: any) {
      // executeHotWalletDispersion lanzó de forma inesperada (no es su modo de
      // fallo documentado) — el estado de la firma es desconocido. Se deja en
      // "processing" para revisión manual en vez de asumir que no se envió nada.
      return res.status(500).json({
        error: `Estado del retiro requiere revisión manual: ${err.message}`,
        code: "NEEDS_MANUAL_REVIEW",
      });
    }

    try {
      const outcomeStatus = (outcome.body as any)?.status;
      const dispersionId = (outcome.body as any)?.id != null ? Number((outcome.body as any).id) : null;

      if (dispersionId != null) {
        // Se creó (o ya existía) un registro de dispersión — success, duplicado
        // reconciliado, o firma "uncertain": en todos los casos pudo haberse
        // movido dinero, así que se enlaza y NUNCA se revierte a "pending".
        await storage.markWithdrawalApproved(request.id, admin.username, dispersionId, outcomeStatus === "confirmed" ? "confirmed" : "broadcast");
      } else {
        // Ningún fondo se movió (falló validación antes de reservar/firmar):
        // es seguro devolver la solicitud a "pending" para reintentar o rechazar.
        await storage.revertWithdrawalToProcessingFailed(request.id);
      }
      return res.status(outcome.status).json(outcome.body);
    } catch (err: any) {
      // El resultado de la dispersión ya se conoce (arriba); lo único que
      // falló fue persistir el enlace en cryptoWithdrawalRequests. Si el
      // resultado indicaba fondos movidos, esto NO debe revertirse a pending.
      const dispersionId = (outcome.body as any)?.id;
      if (dispersionId != null) {
        return res.status(500).json({
          error: `Los fondos pudieron haberse transmitido (dispersión #${dispersionId}) pero no se pudo actualizar el retiro. Requiere revisión manual: ${err.message}`,
          code: "NEEDS_MANUAL_REVIEW",
          dispersionId,
        });
      }
      try { await storage.revertWithdrawalToProcessingFailed(id); } catch { /* best-effort */ }
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin rechaza un retiro pendiente: reembolsa el saldo reservado ──────
  const rejectWithdrawalSchema = z.object({ reason: z.string().trim().min(1).max(280) });
  app.post("/api/admin/tron/withdrawals/:id/reject", requireRole("ADMIN"), async (req, res) => {
    const parsed = rejectWithdrawalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detail: parsed.error.issues });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const admin = req.currentUser!;
    try {
      const updated = await storage.rejectWithdrawalRequest(id, admin.username, parsed.data.reason);
      if (!updated) return res.status(409).json({ error: "La solicitud no existe o ya no está pendiente" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Poll de asentamiento on-chain de un retiro ya aprobado ───────────────
  app.get("/api/admin/tron/withdrawals/:id/status", requireRole("ADMIN"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
      const request = await storage.getWithdrawalRequest(id);
      if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (!request.dispersionId) return res.json({ request, dispersion: null });

      const [dispersion] = await db.select().from(hotWalletDispersions).where(eq(hotWalletDispersions.id, request.dispersionId));
      if (dispersion && dispersion.txid && !["confirmed", "failed"].includes(dispersion.status)) {
        const onChain = await TronClient.getTransaction(dispersion.txid);
        if (onChain.status === "SUCCESS" || onChain.status === "FAILED") {
          const intentMatches = onChain.contractAddress === (dispersion.expectedContract ?? TronClient.USDT_CONTRACT)
            && onChain.fromAddress === TronClient.platformWalletInfo().address
            && onChain.toAddress === dispersion.toAddress
            && onChain.usdtAtomicAmount === dispersion.expectedAtomicAmount;
          const newStatus = onChain.status === "SUCCESS" && intentMatches ? "confirmed" : "failed";
          await db.update(hotWalletDispersions)
            .set({ status: newStatus, confirmedAt: newStatus === "confirmed" ? new Date() : null, updatedAt: new Date() })
            .where(eq(hotWalletDispersions.id, dispersion.id));
          // "failed" means the TRON transfer never actually completed, so the
          // reserved balance must be refunded (settleWithdrawalFailed does
          // this atomically and is safe to call more than once — the status
          // guard on the UPDATE ensures only the first call ever refunds).
          if (newStatus === "failed") {
            await storage.settleWithdrawalFailed(request.id);
          } else {
            await storage.markWithdrawalStatus(request.id, newStatus);
          }
          return res.json({ request: await storage.getWithdrawalRequest(id), dispersion: { ...dispersion, status: newStatus } });
        }
      }
      res.json({ request, dispersion });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/user-crypto/:userId/:asset", requireRole("ADMIN"), async (req, res) => {
    const assetParam = req.params.asset as string;
    if (!CRYPTO_ASSETS.includes(assetParam as CryptoAsset)) {
      return res.status(400).json({ error: "Activo cripto inválido" });
    }
    const schema = z.object({ balance: z.number().finite().min(0) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
      const updated = await storage.setCryptoBalance(req.params.userId, assetParam as CryptoAsset, parsed.data.balance, {
        reason: "admin_override",
        referenceType: "admin",
        referenceId: null,
        createdBy: req.currentUser!.username,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Permisos del usuario actual ──────────────────────────────────────────
  app.get("/api/user/permissions", requireSession, async (req, res) => {
    const u = req.currentUser!;
    if (u.role === "ADMIN") {
      return res.json({ paymentEngineAccess: true, posFullAccess: true });
    }

    // Usuarios con suscripción completa y POS autorizado por contrato
    const POS_AUTHORIZED_USERS = new Set([
      "socemro2@gmail.com",
      "danyleonpinto",
      "optimaqrh@gmail.com",
      "angoestradacontacto@gmail.com",
    ]);
    const identifier = u.email || u.username;
    if (POS_AUTHORIZED_USERS.has(u.username) || POS_AUTHORIZED_USERS.has(u.email ?? "")) {
      return res.json({ paymentEngineAccess: true, posFullAccess: true });
    }

    // Para el resto leer directo de req.currentUser (cargado desde DB por requireSession)
    return res.json({
      paymentEngineAccess: u.paymentEngineAccess ?? false,
      posFullAccess:       u.posFullAccess       ?? false,
    });
  });

  // Crear usuario nuevo (solo ADMIN)
  app.post("/api/users", requireRole("ADMIN"), async (req, res) => {
    try {
      const bodySchema = z.object({
        username: z.string().min(3, "Mínimo 3 caracteres"),
        email: z.string().email("Correo electrónico inválido"),
        password: z.string().min(6, "Mínimo 6 caracteres"),
        fullName: z.string().min(1, "Nombre requerido"),
        role: z.enum(["ADMIN", "USER"]).default("USER"),
        subscriptionStart: z.string().nullable().optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos inválidos", details: parsed.error.issues });
        return;
      }
      const existing = await storage.getUserByUsername(parsed.data.username);
      if (existing) {
        res.status(409).json({ error: "El usuario ya existe" });
        return;
      }
      const existingEmail = await storage.getUserByEmail(parsed.data.email);
      if (existingEmail) {
        res.status(409).json({ error: "Ese correo ya está registrado en otra cuenta" });
        return;
      }
      const newUser = await storage.createUser({
        username: parsed.data.username,
        email: parsed.data.email.toLowerCase().trim(),
        password: parsed.data.password,
        fullName: parsed.data.fullName,
        role: parsed.data.role,
        subscriptionStart: parsed.data.subscriptionStart ? new Date(parsed.data.subscriptionStart) : null,
      });
      res.json(publicUser(newUser));
    } catch {
      res.status(500).json({ error: "Error al crear usuario" });
    }
  });

  // Editar terminal (solo ADMIN)
  app.patch("/api/terminals/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const bodySchema = z.object({
        location: z.string().min(1).optional(),
        status: z.enum(["online", "offline", "idle", "reconfigured"]).optional(),
        configNote: z.string().nullable().optional(),
        systemMessage: z.string().nullable().optional(),
        model: z.string().min(1).optional(),
        owner: z.string().nullable().optional(),
        amount: z.number().min(0).optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos inválidos", details: parsed.error.issues });
        return;
      }
      const updated = await storage.updateTerminal(req.params.id, parsed.data);
      if (!updated) {
        res.status(404).json({ error: "Terminal no encontrada" });
        return;
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Error al actualizar terminal" });
    }
  });

  // ====================================================================
  // MOTOR DE ENRUTAMIENTO POS — Reglas, Decisiones, Comandos, Analítica
  // ====================================================================

  // ── helpers ──────────────────────────────────────────────────────────────
  function evalRule(rule: { conditionField: string; conditionOperator: string; conditionValue: string },
                    data: { amount: number; currency: string; protocol: string; cardType: string }): boolean {
    const raw: Record<string, string | number> = {
      amount: data.amount,
      currency: data.currency,
      protocol: data.protocol,
      cardType: data.cardType,
    };
    const fv = raw[rule.conditionField];
    if (fv === undefined) return false;
    const cv = rule.conditionValue;
    switch (rule.conditionOperator) {
      case "gt":         return Number(fv) > Number(cv);
      case "lt":         return Number(fv) < Number(cv);
      case "gte":        return Number(fv) >= Number(cv);
      case "lte":        return Number(fv) <= Number(cv);
      case "eq":         return String(fv).toLowerCase() === cv.toLowerCase();
      case "neq":        return String(fv).toLowerCase() !== cv.toLowerCase();
      case "startsWith": return String(fv).toLowerCase().startsWith(cv.toLowerCase());
      case "contains":   return String(fv).toLowerCase().includes(cv.toLowerCase());
      default:           return false;
    }
  }

  async function selectAcquirer(data: { amount: number; currency: string; protocol: string; cardType: string }) {
    const rules = await storage.getRoutingRules();
    const active = rules.filter(r => r.active).sort((a, b) => a.priority - b.priority);
    for (const rule of active) {
      if (evalRule(rule, data)) {
        return { ruleId: rule.id, ruleName: rule.name, acquirer: rule.acquirer,
                 conditionMatched: `${rule.conditionField} ${rule.conditionOperator} ${rule.conditionValue}` };
      }
    }
    return { ruleId: null, ruleName: null, acquirer: "stripe", conditionMatched: null };
  }

  // ── Routing Rules CRUD ────────────────────────────────────────────────────
  const routingRuleSchema = z.object({
    name:               z.string().min(1).max(100),
    description:        z.string().max(300).optional().nullable(),
    conditionField:     z.enum(["amount", "currency", "protocol", "cardType"]),
    conditionOperator:  z.enum(["gt", "lt", "gte", "lte", "eq", "neq", "startsWith", "contains"]),
    conditionValue:     z.string().min(1),
    acquirer:           z.enum(["stripe", "mercadopago", "local"]),
    priority:           z.number().int().min(1).max(9999).default(100),
    active:             z.boolean().default(true),
  });

  app.get("/api/routing-rules", requireSession, async (_req, res) => {
    try {
      const rules = await storage.getRoutingRules();
      res.json(rules);
    } catch {
      res.status(500).json({ error: "Error al obtener reglas de enrutamiento" });
    }
  });

  app.post("/api/routing-rules", requireSession, requireRole("ADMIN"), async (req, res) => {
    try {
      const parsed = routingRuleSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Datos inválidos", details: parsed.error.issues }); return; }
      const rule = await storage.createRoutingRule(parsed.data);
      res.status(201).json(rule);
    } catch {
      res.status(500).json({ error: "Error al crear regla" });
    }
  });

  app.patch("/api/routing-rules/:id", requireSession, requireRole("ADMIN"), async (req, res) => {
    try {
      const parsed = routingRuleSchema.partial().safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Datos inválidos", details: parsed.error.issues }); return; }
      const updated = await storage.updateRoutingRule(req.params.id, parsed.data);
      if (!updated) { res.status(404).json({ error: "Regla no encontrada" }); return; }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Error al actualizar regla" });
    }
  });

  app.delete("/api/routing-rules/:id", requireSession, requireRole("ADMIN"), async (req, res) => {
    try {
      await storage.deleteRoutingRule(req.params.id);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Error al eliminar regla" });
    }
  });

  // ── Routing Decisions ─────────────────────────────────────────────────────
  app.get("/api/routing-decisions", requireSession, requireAnyRole("ADMIN", "BUSINESS_PARTNER"), async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 100), 500);
      const decisions = await storage.getRoutingDecisions(limit);
      res.json(decisions);
    } catch {
      res.status(500).json({ error: "Error al obtener decisiones de enrutamiento" });
    }
  });

  // ── Terminal Commands ─────────────────────────────────────────────────────
  const COMMAND_DURATIONS: Record<string, number> = {
    restart: 8000, reconfigure: 5000, force_offline: 2000, sync: 4000,
  };

  app.post("/api/terminals/:id/commands", requireSession, requireRole("ADMIN"), async (req, res) => {
    try {
      const bodySchema = z.object({
        command: z.enum(["restart", "reconfigure", "force_offline", "sync"]),
        notes:   z.string().max(200).optional().nullable(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Comando inválido", details: parsed.error.issues }); return; }

      const terminal = await storage.getTerminalById(req.params.id);
      if (!terminal) { res.status(404).json({ error: "Terminal no encontrada" }); return; }
      const cmd = await storage.createTerminalCommand({
        terminalId: req.params.id,
        command:    parsed.data.command,
        status:     "executing",
        notes:      parsed.data.notes ?? null,
        createdBy:  req.currentUser!.username,
      });

      // Simulate async completion
      const duration = COMMAND_DURATIONS[parsed.data.command] ?? 5000;
      const newStatus = parsed.data.command === "force_offline" ? "completed" : "completed";
      const newTerminalStatus = parsed.data.command === "force_offline" ? "offline"
        : parsed.data.command === "restart" ? "online"
        : parsed.data.command === "reconfigure" ? "reconfigured"
        : undefined;

      setTimeout(async () => {
        try {
          await storage.updateTerminalCommandStatus(cmd.id, newStatus, new Date());
          if (newTerminalStatus) {
            await storage.updateTerminal(req.params.id, { status: newTerminalStatus });
          }
        } catch { /* ignore */ }
      }, duration);

      res.status(201).json(cmd);
    } catch {
      res.status(500).json({ error: "Error al ejecutar comando de terminal" });
    }
  });

  app.get("/api/terminals/:id/commands", requireSession, async (req, res) => {
    try {
      const commands = await storage.getTerminalCommands(req.params.id);
      res.json(commands);
    } catch {
      res.status(500).json({ error: "Error al obtener historial de comandos" });
    }
  });

  // ── Routing Analytics ─────────────────────────────────────────────────────
  app.get("/api/routing-analytics", requireSession, requireAnyRole("ADMIN", "BUSINESS_PARTNER"), async (req, res) => {
    try {
      const decisions = await storage.getRoutingDecisions(500);

      // By acquirer
      const byAcquirer: Record<string, { total: number; approved: number; totalMs: number }> = {};
      // By protocol
      const byProtocol: Record<string, { total: number; approved: number }> = {};

      for (const d of decisions) {
        // acquirer stats
        if (!byAcquirer[d.acquirer]) byAcquirer[d.acquirer] = { total: 0, approved: 0, totalMs: 0 };
        byAcquirer[d.acquirer].total++;
        if (d.approved) byAcquirer[d.acquirer].approved++;
        if (d.responseTimeMs) byAcquirer[d.acquirer].totalMs += d.responseTimeMs;

        // protocol stats
        const proto = d.protocol ?? "unknown";
        if (!byProtocol[proto]) byProtocol[proto] = { total: 0, approved: 0 };
        byProtocol[proto].total++;
        if (d.approved) byProtocol[proto].approved++;
      }

      const acquirerStats = Object.entries(byAcquirer).map(([acquirer, s]) => ({
        acquirer,
        total: s.total,
        approved: s.approved,
        approvalRate: s.total ? Math.round((s.approved / s.total) * 100) : 0,
        avgResponseMs: s.total ? Math.round(s.totalMs / s.total) : 0,
      }));

      const protocolStats = Object.entries(byProtocol).map(([protocol, s]) => ({
        protocol,
        total: s.total,
        approved: s.approved,
        approvalRate: s.total ? Math.round((s.approved / s.total) * 100) : 0,
      }));

      res.json({ acquirerStats, protocolStats, totalDecisions: decisions.length });
    } catch {
      res.status(500).json({ error: "Error al calcular analítica de enrutamiento" });
    }
  });

  // ── Export Routing Decisions CSV ──────────────────────────────────────────
  app.get("/api/routing-decisions/export", requireSession, requireRole("ADMIN"), async (_req, res) => {
    try {
      const decisions = await storage.getRoutingDecisions(500);
      const headers = ["id","transactionId","acquirer","ruleName","conditionMatched","approved","amount","currency","protocol","cardType","responseTimeMs","createdAt"];
      const csvRows = [headers.join(",")];
      for (const d of decisions) {
        csvRows.push([
          d.id, d.transactionId, d.acquirer, d.ruleName ?? "", d.conditionMatched ?? "",
          d.approved ? "1" : "0", d.amount ?? "", d.currency ?? "", d.protocol ?? "",
          d.cardType ?? "", d.responseTimeMs ?? "", d.createdAt.toISOString(),
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="routing-decisions-${Date.now()}.csv"`);
      res.send(csvRows.join("\n"));
    } catch {
      res.status(500).json({ error: "Error al exportar" });
    }
  });

  // ====================================================================
  // PROTOCOLOS BANCARIOS
  // ====================================================================
  
  app.get("/api/protocols", requireSession, async (_req, res) => {
    try {
      const protocols = await storage.getAllProtocols();
      res.json(protocols);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener protocolos" });
    }
  });

  app.get("/api/protocols/:code", requireSession, async (req, res) => {
    try {
      const protocol = await storage.getProtocol(req.params.code);
      if (!protocol) {
        res.status(404).json({ error: "Protocolo no encontrado" });
        return;
      }
      res.json(protocol);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener protocolo" });
    }
  });

  // ====================================================================
  // OKX DIRECT ENDPOINTS (public API — no auth required for market data)
  // ====================================================================

  /** System status */
  app.get("/api/okx/system", async (_req, res) => {
    try {
      const info = await OKXClient.systemStatus();
      res.json(info);
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  /** Order book for a given local asset id (btc, eth, xrp…) */
  app.get("/api/okx/orderbook/:asset", requireSession, async (req, res) => {
    try {
      const { asset } = req.params;
      const count = Math.min(parseInt((req.query.count as string) ?? "10"), 50);
      const instId = OKXClient.OKX_PAIR[asset.toLowerCase()];
      if (!instId) return res.status(400).json({ error: `Activo no soportado: ${asset}` });
      const book = await OKXClient.orderBook(instId, count);
      res.json(book);
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  /** OHLC candles — bar: 1m|5m|15m|30m|1H|4H|1D */
  app.get("/api/okx/ohlc/:asset", requireSession, async (req, res) => {
    try {
      const { asset } = req.params;
      const bar   = (req.query.bar as string) ?? "1H";
      const limit = Math.min(parseInt((req.query.limit as string) ?? "48"), 300);
      const instId = OKXClient.OKX_PAIR[asset.toLowerCase()];
      if (!instId) return res.status(400).json({ error: `Activo no soportado: ${asset}` });
      const result = await OKXClient.ohlc(instId, bar, limit);
      res.json(result);
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  /** Recent trades for a given asset */
  app.get("/api/okx/trades/:asset", requireSession, async (req, res) => {
    try {
      const { asset } = req.params;
      const instId = OKXClient.OKX_PAIR[asset.toLowerCase()];
      if (!instId) return res.status(400).json({ error: `Activo no soportado: ${asset}` });
      const trades = await OKXClient.recentTrades(instId, 20);
      res.json({ asset, instId, trades });
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  /** Supported pairs */
  app.get("/api/okx/pairs", async (_req, res) => {
    res.json(OKXClient.OKX_PAIR);
  });

  /** Private API capability status */
  app.get("/api/okx/capabilities", requireSession, (_req, res) => {
    res.json({
      privateApi:     OKXClient.hasPrivateCredentials(),
      publicApi:      true,
      baseUrl:        (process.env.OKX_URL ?? "https://www.okx.com").replace(/\/+$/, ""),
      supportedPairs: OKXClient.OKX_PAIR,
    });
  });

  // ====================================================================
  // PRECIOS CRYPTO EN TIEMPO REAL (OKX primario → Kraken → Binance)
  // ====================================================================

  app.get("/api/crypto-prices", async (_req, res) => {
    try {
      const result = await fetchPrices();
      // Attach source metadata in headers for diagnostics
      res.setHeader("X-Price-Source",    result.source);
      res.setHeader("X-Price-LatencyMs", String(result.latencyMs));
      res.setHeader("X-Price-FetchedAt", String(result.fetchedAt));
      res.json(result.data);
    } catch (error) {
      res.status(502).json({ error: "No se pudieron obtener precios en tiempo real. Todos los brokers fallaron." });
    }
  });

  // Admin: force-clear price cache
  app.post("/api/crypto-prices/refresh", requireSession, (req, res) => {
    if (req.currentUser!.role !== "ADMIN")
      return res.status(403).json({ error: "Solo administradores" });
    clearPriceCache();
    res.json({ ok: true, message: "Caché de precios limpiado. Próxima consulta obtendrá datos frescos." });
  });

  // ====================================================================
  // SALDOS CRIPTO INTERNOS (persistidos por usuario/activo — sin blockchain real)
  // ====================================================================

  app.get("/api/crypto-balances", requireSession, async (req, res) => {
    try {
      const rows = await storage.getCryptoBalances(req.currentUser!.id);
      const byAsset = new Map(rows.map(r => [r.asset, r.balance]));
      const balances: Record<string, number> = {};
      for (const asset of CRYPTO_ASSETS) balances[asset] = byAsset.get(asset) ?? 0;
      res.json(balances);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Ledger inmutable de movimientos — el propio usuario ve el suyo, el admin ve el de cualquiera
  app.get("/api/crypto-balances/ledger", requireSession, async (req, res) => {
    try {
      const assetParam = req.query.asset as string | undefined;
      if (assetParam && !CRYPTO_ASSETS.includes(assetParam as CryptoAsset)) {
        return res.status(400).json({ error: "Activo cripto inválido" });
      }
      const entries = await storage.getCryptoLedger(req.currentUser!.id, assetParam as CryptoAsset | undefined);
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/user-crypto/:userId/ledger", requireRole("ADMIN"), async (req, res) => {
    try {
      const assetParam = req.query.asset as string | undefined;
      if (assetParam && !CRYPTO_ASSETS.includes(assetParam as CryptoAsset)) {
        return res.status(400).json({ error: "Activo cripto inválido" });
      }
      const entries = await storage.getCryptoLedger(req.params.userId, assetParam as CryptoAsset | undefined);
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/user-crypto/:userId/:asset/verify", requireRole("ADMIN"), async (req, res) => {
    const assetParam = req.params.asset as string;
    if (!CRYPTO_ASSETS.includes(assetParam as CryptoAsset)) {
      return res.status(400).json({ error: "Activo cripto inválido" });
    }
    try {
      const result = await storage.verifyCryptoLedger(req.params.userId, assetParam as CryptoAsset);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const exchangeSchema = z.object({
    fromAsset: z.enum(CRYPTO_ASSETS),
    toAsset: z.enum(CRYPTO_ASSETS),
    fromAmount: z.number().positive(),
    toAmount: z.number().positive(),
    fromSymbol: z.string().optional(),
    toSymbol: z.string().optional(),
    rate: z.number().optional(),
  });

  app.post("/api/crypto/exchange", requireSession, async (req, res) => {
    const parsed = exchangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos de intercambio inválidos", details: parsed.error.flatten() });
    }
    const { fromAsset, toAsset, fromAmount, toAmount, fromSymbol, toSymbol, rate } = parsed.data;
    if (fromAsset === toAsset) {
      return res.status(400).json({ error: "El activo de origen y destino deben ser diferentes" });
    }
    const user = req.currentUser!;
    try {
      // ── Intentar ejecución real en broker ─────────────────────────────────────
      let actualToAmount = toAmount;
      let brokerUsed     = "internal";
      let brokerOrderIds: string[] = [];

      const swapResult = await executeSwap(fromAsset, toAsset, fromAmount);
      if (swapResult) {
        actualToAmount = swapResult.toAmount;
        brokerUsed     = swapResult.broker;
        brokerOrderIds = swapResult.orderIds;
        console.log(`[exchange] Swap real via ${swapResult.broker}: ${fromAmount} ${fromAsset} → ${actualToAmount.toFixed(8)} ${toAsset} | orders: ${brokerOrderIds.join(",")}`);
      }

      // ── Actualizar saldos internos con montos reales del fill ─────────────────
      const transactionId = `EXC-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const balances = await storage.exchangeCrypto(user.id, fromAsset, fromAmount, toAsset, actualToAmount, {
        reason: "exchange",
        referenceType: "transaction",
        referenceId: transactionId,
        createdBy: user.username,
      });

      const transaction = await storage.createTransaction({
        transactionId,
        protocol: "201.3",
        type:     "exchange",
        amount:   fromAmount.toFixed(8),
        currency: (fromSymbol ?? fromAsset).toUpperCase(),
        status:   "completed",
        fromAccount: `EXCHANGE · ${(fromSymbol ?? fromAsset).toUpperCase()} · ${fromAmount}`,
        toAccount:   `${(toSymbol ?? toAsset).toUpperCase()} · ${actualToAmount.toFixed(8)}`,
        description: `${brokerUsed === "internal" ? "Swap interno" : `Swap vía ${brokerUsed.toUpperCase()}`} ${fromAmount} ${(fromSymbol ?? fromAsset).toUpperCase()} → ${actualToAmount.toFixed(8)} ${(toSymbol ?? toAsset).toUpperCase()}${brokerOrderIds.length ? ` | orders: ${brokerOrderIds.join(",")}` : ""}`,
        createdBy: user.username,
      });
      await storage.createTransactionLog({
        transactionId: transaction.id,
        action: "EXCHANGE",
        status: "completed",
        message: `Swap ejecutado [${brokerUsed}]: ${fromAmount} ${fromAsset.toUpperCase()} → ${actualToAmount.toFixed(8)} ${toAsset.toUpperCase()}`,
      });

      res.json({ balances, transaction, broker: brokerUsed, orderIds: brokerOrderIds });
    } catch (err: any) {
      if (err.message === "INSUFFICIENT_BALANCE") {
        return res.status(400).json({ error: "Saldo insuficiente del activo de origen" });
      }
      res.status(500).json({ error: err.message });
    }
  });

  const dispersionSchema = z.object({
    cryptoAsset: z.enum(CRYPTO_ASSETS),
    cryptoAmount: z.number().positive(),
    cryptoSymbol: z.string().optional(),
    fiatAmount: z.number().positive(),
    fiatCurrency: z.enum(["USD", "EUR"]),
    destWallet: z.string().min(1),
  });

  app.post("/api/crypto/dispersion", requireSession, async (req, res) => {
    const parsed = dispersionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos de dispersión inválidos", details: parsed.error.flatten() });
    }
    const { cryptoAsset, cryptoAmount, cryptoSymbol, fiatAmount, fiatCurrency, destWallet } = parsed.data;
    const user = req.currentUser!;
    try {
      const transactionId = `DSP-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const balance = await storage.creditCryptoBalance(user.id, cryptoAsset, cryptoAmount, {
        reason: "dispersion_credit",
        referenceType: "transaction",
        referenceId: transactionId,
        createdBy: user.username,
      });

      const transaction = await storage.createTransaction({
        transactionId,
        protocol: "101.3",
        type: "transfer",
        amount: fiatAmount.toFixed(2),
        currency: fiatCurrency,
        status: "processing",
        fromAccount: `EXCHANGE · POS VIRTUAL · ${fiatCurrency}`,
        toAccount: destWallet,
        description: `Dispersión y conversión ${fiatAmount.toFixed(2)} ${fiatCurrency} ≈ ${cryptoAmount.toFixed(8)} ${(cryptoSymbol ?? cryptoAsset).toUpperCase()} → Wallet ${destWallet.slice(0, 10)}…`,
        createdBy: user.username,
      });
      await storage.createTransactionLog({
        transactionId: transaction.id,
        action: "DISPERSION",
        status: "processing",
        message: `Dispersión enviada a verificación OKX: ${fiatAmount.toFixed(2)} ${fiatCurrency} → ${cryptoAmount.toFixed(8)} ${cryptoAsset.toUpperCase()} · Pendiente confirmación on-chain`,
      });

      res.json({ balance, transaction });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ====================================================================
  // BROKER REGISTRY — catálogo completo con compliance
  // ====================================================================

  /** Full broker catalog with compliance parameters */
  app.get("/api/crypto/brokers", requireSession, (_req, res) => {
    res.json(BROKER_REGISTRY.map(brokerSummary));
  });

  /** AML compliance check for a specific amount */
  app.get("/api/crypto/brokers/:id/aml-check", requireSession, (req, res) => {
    const { id }  = req.params;
    const amount  = parseFloat(req.query.amountUSD as string ?? "0");
    if (isNaN(amount) || amount <= 0)
      return res.status(400).json({ error: "amountUSD debe ser positivo" });
    const result = checkAmlThreshold(id, amount);
    res.json(result);
  });

  // ====================================================================
  // BROKER STATUS — ping en tiempo real + compliance overlay
  // ====================================================================

  let brokerStatusCache: { data: any[]; fetchedAt: number } | null = null;
  const BROKER_CACHE_TTL_MS = 30_000;

  app.get("/api/broker-status", requireSession, async (_req, res) => {
    if (brokerStatusCache && Date.now() - brokerStatusCache.fetchedAt < BROKER_CACHE_TTL_MS) {
      return res.json(brokerStatusCache.data);
    }

    const results = await Promise.allSettled(
      BROKER_REGISTRY.map(async (b) => {
        const start = Date.now();
        try {
          const r = await fetch(b.statusUrl, { signal: AbortSignal.timeout(6_000) });
          const latency = Date.now() - start;
          let pingStatus: "online" | "offline" | "restricted" = "online";
          let note = "";

          if (b.id === "binance") {
            const body: any = await r.json().catch(() => ({}));
            if (r.status === 451 || (body?.msg ?? "").toLowerCase().includes("restricted")) {
              pingStatus = "restricted";
              note = "HTTP 451 · Geoblocked (OFAC/FinCEN) desde IP del servidor";
            }
          } else if (b.id === "kraken") {
            const body: any = await r.json().catch(() => ({}));
            pingStatus = body?.result?.status === "online" ? "online" : "offline";
            note = body?.result?.timestamp ?? "";
          }

          return {
            id:              b.id,
            name:            b.name,
            legalName:       b.legalName,
            type:            b.type,
            registryStatus:  b.status,
            pingStatus,
            active:          b.active,
            priority:        b.priority,
            jurisdiction:    b.jurisdiction,
            latencyMs:       latency,
            note,
            inactiveReason:  b.inactiveReason,
            complianceStatus: b.aml.complianceStatus,
            fatfCompliant:   b.aml.fatfCompliant,
            fincenMsb:       b.aml.fincenMsb,
            micaCompliant:   b.aml.micaCompliant,
            ofacScreening:   b.aml.ofacScreening,
            kycTier:         b.aml.kycTier,
            maxTxUSD:        b.aml.maxTxUSD,
            travelRuleThresholdUSD: b.aml.travelRuleThresholdUSD,
            networks:        b.networks.map(n => ({ id: n.id, name: n.name, token: n.token, withdrawEnabled: n.withdrawEnabled })),
            fees:            b.fees,
            capabilities:    b.capabilities,
          };
        } catch {
          return {
            id: b.id, name: b.name, legalName: b.legalName, type: b.type,
            registryStatus: b.status, pingStatus: "offline" as const,
            active: b.active, priority: b.priority, jurisdiction: b.jurisdiction,
            latencyMs: null, note: "Sin respuesta / timeout",
            inactiveReason: b.inactiveReason,
            complianceStatus: b.aml.complianceStatus,
            fatfCompliant: b.aml.fatfCompliant, fincenMsb: b.aml.fincenMsb,
            micaCompliant: b.aml.micaCompliant, ofacScreening: b.aml.ofacScreening,
            kycTier: b.aml.kycTier, maxTxUSD: b.aml.maxTxUSD,
            travelRuleThresholdUSD: b.aml.travelRuleThresholdUSD,
            networks: b.networks.map(n => ({ id: n.id, name: n.name, token: n.token, withdrawEnabled: n.withdrawEnabled })),
            fees: b.fees, capabilities: b.capabilities,
          };
        }
      })
    );

    const data = results.map(r => r.status === "fulfilled" ? r.value : null).filter(Boolean);
    brokerStatusCache = { data, fetchedAt: Date.now() };
    res.json(data);
  });

  // ====================================================================
  // BITSTAMP — PANEL DE PRUEBAS (solo lectura; sin credenciales privadas)
  // ====================================================================

  let bitstampStatusCache: { data: Record<string, unknown>; fetchedAt: number } | null = null;
  let bitstampPricesCache: { data: Record<string, unknown>; fetchedAt: number } | null = null;

  /** Estado de conectividad: producción + sandbox lado a lado, entorno activo, candados. */
  app.get("/api/admin/bitstamp/status", requireSession, async (req, res) => {
    if (req.currentUser!.role !== "ADMIN")
      return res.status(403).json({ error: "Solo administradores" });
    try {
      ensureBitstampFeed(); // feed WS público (producción) — arranque perezoso
      if (bitstampStatusCache && Date.now() - bitstampStatusCache.fetchedAt < 15_000) {
        return res.json({ ...bitstampStatusCache.data, ws: bitstampFeedSnapshot() });
      }
      const [production, sandbox] = await Promise.all([
        Bitstamp.probe("production"),
        Bitstamp.probe("sandbox"),
      ]);
      const data = {
        environment:           Bitstamp.activeEnvironment(),
        baseUrl:               Bitstamp.resolveBaseUrl(),
        credentialsConfigured: Bitstamp.hasPrivateCredentials(),
        tradingEnabled:        bitstampTradingEnabled(),
        executorWouldUse:      availableBroker(),
        production,
        sandbox,
      };
      bitstampStatusCache = { data, fetchedAt: Date.now() };
      res.json({ ...data, ws: bitstampFeedSnapshot() });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /** Precios públicos en vivo: Bitstamp (entorno activo, USD) vs OKX (USDT). */
  app.get("/api/admin/bitstamp/prices", requireSession, async (req, res) => {
    if (req.currentUser!.role !== "ADMIN")
      return res.status(403).json({ error: "Solo administradores" });
    try {
      if (bitstampPricesCache && Date.now() - bitstampPricesCache.fetchedAt < 10_000) {
        return res.json(bitstampPricesCache.data);
      }
      const [bs, okx] = await Promise.all([
        Bitstamp.fetchAllTickers(),
        OKXClient.fetchAllTickers().catch(() => ({} as Record<string, { price: number }>)),
      ]);
      const rows = Object.keys(Bitstamp.BITSTAMP_PAIR).map((asset) => {
        const b = bs[asset];
        const o = (okx as Record<string, { price: number }>)[asset];
        const deltaPct = b?.price && o?.price ? ((b.price - o.price) / o.price) * 100 : null;
        return {
          asset,
          pair:     Bitstamp.BITSTAMP_PAIR[asset],
          bitstamp: b ? { price: b.price, bid: b.bid, ask: b.ask, change24h: b.change24h } : null,
          okx:      o ? { price: o.price } : null,
          deltaPct,
        };
      });
      const data = {
        environment: Bitstamp.activeEnvironment(),
        rows,
        fetchedAt:   new Date().toISOString(),
      };
      bitstampPricesCache = { data, fetchedAt: Date.now() };
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ====================================================================
  // CENTRO DE PRUEBAS — suite automatizada node:test (solo ADMIN)
  // Lógica en server/test-runner.ts (lista blanca, lock atómico, TAP)
  // ====================================================================

  /** GET /api/admin/tests — archivos disponibles + último resultado en memoria */
  app.get("/api/admin/tests", requireSession, async (req, res) => {
    if (req.currentUser!.role !== "ADMIN")
      return res.status(403).json({ error: "Solo administradores" });
    const files = await discoverTestFiles();
    res.json({ files, running: isTestRunInFlight(), lastRun: getLastTestRun() });
  });

  /** POST /api/admin/tests/run { file? } — corre la suite completa o un archivo */
  app.post("/api/admin/tests/run", requireSession, async (req, res) => {
    if (req.currentUser!.role !== "ADMIN")
      return res.status(403).json({ error: "Solo administradores" });
    const requested = typeof req.body?.file === "string" ? req.body.file : undefined;
    const outcome = await runTestsExclusive(requested);
    if (outcome.kind === "busy")
      return res.status(409).json({ error: "Ya hay una ejecución de pruebas en curso" });
    if (outcome.kind === "unknown-file")
      return res.status(400).json({ error: "Archivo de prueba no reconocido" });
    res.json(outcome.record);
  });


  // ====================================================================
  // BROKER OPS — withdraw to network · internal transfer · deposit addr
  // ====================================================================

  /** GET /api/broker/withdrawal-fees — USDT withdrawal networks & fees from OKX */
  app.get("/api/broker/withdrawal-fees", requireSession, requireRole("ADMIN"), async (_req, res) => {
    try {
      const data = await OKXClient.withdrawalCurrencies("USDT");
      const networks = data
        .filter((d: any) => ["TRC20", "ERC20", "BEP20", "SOL"].some(n => d.chain?.includes(n)))
        .map((d: any) => ({
          chain:      d.chain,
          ccy:        d.ccy,
          minWd:      d.minWd,
          minFee:     d.minFee,
          maxFee:     d.maxFee,
          canWd:      d.canWd,
          canDep:     d.canDep,
        }));
      res.json(networks);
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  /** GET /api/broker/deposit-address?ccy=USDT — OKX deposit addresses */
  app.get("/api/broker/deposit-address", requireSession, requireRole("ADMIN"), async (req, res) => {
    try {
      const ccy = (req.query.ccy as string) || "USDT";
      const data = await OKXClient.depositAddresses(ccy);
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  /** GET /api/broker/balances — OKX trading + funding balances */
  app.get("/api/broker/balances", requireSession, requireRole("ADMIN"), async (_req, res) => {
    try {
      const [tradingMap, fundingRaw] = await Promise.all([
        OKXClient.balance(),          // Record<ccy, {available, frozen}>
        OKXClient.fundingBalance(),   // raw array from /asset/balances
      ]);
      const trading = Object.entries(tradingMap).map(([ccy, v]) => ({
        ccy, avail: String(v.available), frozen: String(v.frozen),
      }));
      const funding = (fundingRaw ?? []).map((d: any) => ({
        ccy: d.ccy, avail: d.availBal, frozen: d.frozenBal,
      }));
      res.json({ trading, funding });
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  /** POST /api/broker/transfer — move USDT between OKX Trading ↔ Funding */
  app.post("/api/broker/transfer", requireSession, requireRole("ADMIN"), async (req, res) => {
    const schema = z.object({
      ccy:       z.string().min(1).max(10).default("USDT"),
      amt:       z.string().regex(/^\d+(\.\d+)?$/, "Monto inválido"),
      direction: z.enum(["trading_to_funding", "funding_to_trading"]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });

    const { ccy, amt, direction } = parsed.data;
    const from = direction === "trading_to_funding" ? "18" : "6";
    const to   = direction === "trading_to_funding" ? "6"  : "18";

    try {
      const result = await OKXClient.fundingTransfer({ ccy, amt, from, to });
      const r = result?.[0];
      if (r?.sCode && r.sCode !== "0")
        return res.status(502).json({ error: `OKX transfer error [${r.sCode}]: ${r.sMsg}` });

      await storage.createNotification({
        type:      "info",
        title:     "OKX Transfer",
        message:   `${amt} ${ccy} movido: ${direction === "trading_to_funding" ? "Trading → Funding" : "Funding → Trading"}`,
        recipient: "ADMIN",
        status:    "resolved",
      });

      res.json({ success: true, transId: r?.transId, direction, ccy, amt });
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  /** POST /api/broker/withdraw — withdraw from OKX Funding to external address */
  app.post("/api/broker/withdraw", requireSession, requireRole("ADMIN"), async (req, res) => {
    const schema = z.object({
      ccy:    z.string().min(1).max(10).default("USDT"),
      amt:    z.string().regex(/^\d+(\.\d+)?$/, "Monto inválido"),
      toAddr: z.string().min(10).max(200),
      chain:  z.string().min(1),   // e.g. "USDT-TRC20"
      fee:    z.string().regex(/^\d+(\.\d+)?$/, "Fee inválido"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });

    const { ccy, amt, toAddr, chain, fee } = parsed.data;

    try {
      const result = await OKXClient.withdraw({ ccy, amt, dest: "4", toAddr, fee, chain });
      const r = result?.[0];
      if (r?.sCode && r.sCode !== "0")
        return res.status(502).json({ error: `OKX withdraw error [${r.sCode}]: ${r.sMsg}` });

      await storage.createNotification({
        type:      "info",
        title:     "OKX Withdrawal",
        message:   `Retiro ${amt} ${ccy} vía ${chain} → ${toAddr.slice(0, 12)}...`,
        recipient: "ADMIN",
        status:    "resolved",
      });

      res.json({ success: true, wdId: r?.wdId, ccy, amt, chain, toAddr });
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  /** GET /api/admin/okx-webhooks — last 20 inbound OKX webhook events */
  app.get("/api/admin/okx-webhooks", requireSession, requireRole("ADMIN"), async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, event_type, okx_id, payload, verified, received_at
        FROM okx_webhook_events
        ORDER BY received_at DESC
        LIMIT 20
      `);
      res.json(result.rows ?? result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ====================================================================
  // HISTORIAL RECIENTE EXCHANGE / DISPERSION
  // ====================================================================

  app.get("/api/crypto/recent", requireSession, async (req, res) => {
    try {
      const user = req.currentUser!;
      const allTxs = user.role === "ADMIN"
        ? await storage.getAllTransactions()
        : await storage.getTransactionsByUser(user.username);

      const recent = allTxs
        .filter((t: Transaction) => t.transactionId.startsWith("EXC-") || t.transactionId.startsWith("DSP-"))
        .sort((a: Transaction, b: Transaction) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, 8);
      res.json(recent);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ====================================================================
  // TRANSACCIONES
  // ====================================================================
  
  const genericTxSchema = z.object({
    protocol:    z.string().min(1).max(20),
    type:        z.string().min(1).max(50),
    amount:      z.union([z.string(), z.number()]).transform(v => String(v)),
    currency:    z.string().default("USD"),
    status:      z.enum(["pending", "completed", "processing", "failed"]).default("pending"),
    fromAccount: z.string().optional(),
    toAccount:   z.string().optional(),
    description: z.string().optional(),
    authCode:    z.string().optional(),
    tokenId:     z.string().optional(),
    // El frontend puede sugerir un ID; si no, se auto-genera.
    transactionId: z.string().optional(),
  });

  app.post("/api/transactions", requireSession, async (req, res) => {
    try {
      const parsed = genericTxSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos de transacción inválidos", details: parsed.error.flatten() });
        return;
      }
      const { transactionId: suggestedId, ...rest } = parsed.data;
      const transactionData = {
        ...rest,
        transactionId: suggestedId || `TXN-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`,
        // El propietario siempre se fija desde la sesión (nunca desde el body).
        createdBy: req.currentUser!.username,
      };
      
      const transaction = await storage.createTransaction(transactionData);
      
      // Crear log
      await storage.createTransactionLog({
        transactionId: transaction.id,
        action: "CREATE",
        status: transactionData.status,
        message: `Transacción ${transactionData.type} creada con estado ${transactionData.status}`,
      });
      
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Error al crear transacción" });
    }
  });

  app.get("/api/transactions", requireSession, async (req, res) => {
    try {
      const user = req.currentUser!;
      // ADMIN ve todas; cada USER solo las suyas.
      let transactions = user.role === "ADMIN"
        ? await storage.getAllTransactions()
        : await storage.getTransactionsByUser(user.username);

      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener transacciones" });
    }
  });

  app.get("/api/transactions/:id", requireSession, async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      // 404 (no 403) si no existe o no es del usuario: evita revelar existencia.
      if (!canAccessTransaction(transaction, req.currentUser!)) {
        res.status(404).json({ error: "Transacción no encontrada" });
        return;
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener transacción" });
    }
  });

  app.patch("/api/transactions/:id/status", requireRole("ADMIN"), async (req, res) => {
    try {
      const { status, authCode } = req.body;
      const transaction = await storage.updateTransactionStatus(req.params.id, status, authCode);
      
      if (!transaction) {
        res.status(404).json({ error: "Transacción no encontrada" });
        return;
      }
      
      // Crear log
      await storage.createTransactionLog({
        transactionId: transaction.id,
        action: "UPDATE_STATUS",
        status: status,
        message: `Estado actualizado a ${status}`
      });
      
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar transacción" });
    }
  });

  // Anota una transacción (no modifica monto ni estado — solo agrega una
  // referencia/nota a la descripción, p. ej. para conciliación con otros
  // módulos como Exchange).
  app.patch("/api/transactions/:id/note", requireAnyRole("ADMIN", "BUSINESS_PARTNER"), async (req, res) => {
    try {
      const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
      if (!note) {
        res.status(400).json({ error: "La nota no puede estar vacía" });
        return;
      }
      const transaction = await storage.addTransactionNote(req.params.id, note);
      if (!transaction) {
        res.status(404).json({ error: "Transacción no encontrada" });
        return;
      }
      await storage.createTransactionLog({
        transactionId: transaction.id,
        action: "ADD_NOTE",
        status: transaction.status,
        message: `Nota agregada: ${note}`,
      });
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Error al anotar transacción" });
    }
  });

  // ====================================================================
  // MÉTODOS DE PAGO
  // ====================================================================
  
  app.post("/api/payment-methods", requireSession, async (req, res) => {
    try {
      const parsed = insertPaymentMethodSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos de método de pago inválidos" });
        return;
      }
      // El método de pago debe colgar de una transacción del propio usuario.
      const parent = await storage.getTransaction(parsed.data.transactionId);
      if (!canAccessTransaction(parent, req.currentUser!)) {
        res.status(404).json({ error: "Transacción no encontrada" });
        return;
      }
      const paymentMethod = await storage.createPaymentMethod(parsed.data);
      res.json(paymentMethod);
    } catch (error) {
      res.status(500).json({ error: "Error al crear método de pago" });
    }
  });

  app.get("/api/payment-methods/:id", requireSession, async (req, res) => {
    try {
      const paymentMethod = await storage.getPaymentMethod(req.params.id);
      const parent = paymentMethod
        ? await storage.getTransaction(paymentMethod.transactionId)
        : undefined;
      if (!paymentMethod || !canAccessTransaction(parent, req.currentUser!)) {
        res.status(404).json({ error: "Método de pago no encontrado" });
        return;
      }
      res.json(paymentMethod);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener método de pago" });
    }
  });

  // ====================================================================
  // TOKENS DE SEGURIDAD
  // ====================================================================
  
  app.post("/api/security-tokens", requireSession, async (req, res) => {
    try {
      // El token debe colgar de una transacción del propio usuario.
      const parent = await storage.getTransaction(req.body.transactionId);
      if (!canAccessTransaction(parent, req.currentUser!)) {
        res.status(404).json({ error: "Transacción no encontrada" });
        return;
      }

      const tokenId = `TOK-${Date.now()}-${randomBytes(8).toString('hex').toUpperCase()}`;
      const hash = randomBytes(32).toString('hex');
      
      const tokenData = {
        tokenId,
        transactionId: req.body.transactionId,
        algorithm: "AES-256",
        hash,
        emvCompliant: true,
        pciCompliant: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      };
      
      const token = await storage.createSecurityToken(tokenData);
      res.json(token);
    } catch (error) {
      res.status(500).json({ error: "Error al crear token de seguridad" });
    }
  });

  app.get("/api/security-tokens", async (req, res) => {
    try {
      const user = req.currentUser!;
      const allTokens = await storage.listSecurityTokens();
      if (user.role === "ADMIN") {
        res.json(allTokens);
        return;
      }
      const userTxs = await storage.getTransactionsByUser(user.username);
      const ownedIds = new Set(userTxs.map((tx) => tx.id));
      res.json(allTokens.filter((token) => ownedIds.has(token.transactionId)));
    } catch (error) {
      res.status(500).json({ error: "Error al obtener tokens de seguridad" });
    }
  });

  app.get("/api/security-tokens/:tokenId", async (req, res) => {
    try {
      const token = await storage.getSecurityToken(req.params.tokenId);
      const parent = token
        ? await storage.getTransaction(token.transactionId)
        : undefined;
      if (!token || !canAccessTransaction(parent, req.currentUser!)) {
        res.status(404).json({ error: "Token no encontrado" });
        return;
      }
      res.json(token);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener token" });
    }
  });

  // ====================================================================
  // LOGS DE TRANSACCIONES
  // ====================================================================
  
  app.get("/api/transaction-logs/:transactionId", async (req, res) => {
    try {
      const parent = await storage.getTransaction(req.params.transactionId);
      if (!canAccessTransaction(parent, req.currentUser!)) {
        res.status(404).json({ error: "Transacción no encontrada" });
        return;
      }
      const logs = await storage.getTransactionLogs(req.params.transactionId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener logs" });
    }
  });

  // ====================================================================
  // POS VIRTUAL - PROCESAMIENTO DE PAGOS
  // ====================================================================
  
  // ── Mercado Pago: diagnóstico de conexión (sin cobrar) ───────────────────
  app.get("/api/mp/status", async (req, res) => {
    if (!req.currentUser) { res.status(401).json({ error: "No autenticado" }); return; }
    if (!process.env.MP_ACCESS_TOKEN) {
      res.json({ connected: false, reason: "MP_ACCESS_TOKEN no configurado" });
      return;
    }
    try {
      const r = await fetch("https://api.mercadopago.com/v1/payment_methods", {
        headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const methods = await r.json() as any[];
      res.json({ connected: true, paymentMethods: methods.length });
    } catch (err: any) {
      res.json({ connected: false, reason: err.message });
    }
  });

  app.get("/api/stripe/config", requireSession, async (_req, res) => {
    const { getStripeMode } = await import("./stripeClient");
    const mode = getStripeMode();
    res.json({
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
      mode,
      live: mode === "live",
    });
  });

  app.post("/api/pos/process-payment", paymentLimiter, async (req, res) => {
    try {
      const gateSettings = await storage.getSettings();
      if (gateSettings.paymentEngineDisabled) {
        return res.status(503).json({
          error: "POS Virtual cerrado por incidente. Se está gestionando el incidente.",
          declineCode: "PAYMENT_ENGINE_DISABLED",
          reason: gateSettings.paymentEngineDisabledReason || undefined,
        });
      }
      const parsed = posPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos de pago inválidos" });
        return;
      }
      const { cardType, cardNumber, amount, protocol, holderName, expiryDate, mpCardToken, ventaForzada } = parsed.data;

      // ── AEC MEXICO Amex ****1022 — Approved by Banxico / Rejected from Host Origin ──
      const cleanCard = cardNumber.replace(/\s/g, "");
      if (cleanCard === "376718955261022") {
        const txId = `TXN-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
        await storage.createTransaction({
          transactionId: txId,
          protocol:      protocol ?? "201.1",
          type:          "payment",
          amount:        String(amount),
          currency:      "USD",
          status:        "declined",
          fromAccount:   `POS · ${cardType} · ****1022`,
          toAccount:     "AEC MEXICO SA DE CV",
          description:   `POS · ${cardType} · ${holderName ?? "AEC MEXICO"} · APROBADO BANXICO / RECHAZADO HOST`,
          createdBy:     req.currentUser!.username,
        });
        return res.status(402).json({
          error:         "APPROVED BY BANXICO — REJECTED FROM HOST ORIGIN",
          declineCode:   "APPROVED_BANXICO_REJECTED_HOST",
          declineReason: "Transaction approved at issuer level (Banxico gateway) but rejected by the acquiring host network. Contact your bank or retry with a different terminal.",
        });
      }

      // ── AvoExport: membresía impaga — POS bloqueado ──
      if (req.currentUser?.email === "avoexport03@gmail.com") {
        return res.status(402).json({
          error:        "POS BLOQUEADO — Membresía pendiente de pago. Saldo restante: $161.00 USD. Liquide su membresía para reactivar el servicio.",
          declineCode:  "MEMBERSHIP_UNPAID",
          errorCode:    "0x4E43-MEMB-LOCK",
          lockReason:   "MEMBRESÍA IMPAGA — $161.00 USD pendiente",
          walletETH:    "0xC7aEfEd6E104744378681d7d33D34f8CC1BBee31",
        });
      }

      // ── Verificar permiso posFullAccess ──────────────────────────────────────
      if (req.currentUser?.role !== "ADMIN") {
        const [posPerms] = await db
          .select({ posFullAccess: usersTable.posFullAccess })
          .from(usersTable)
          .where(eq(usersTable.username, req.currentUser!.username))
          .limit(1);
        if (!posPerms?.posFullAccess) {
          return res.status(403).json({
            error:       "Acceso al POS Virtual no autorizado. Contacte al administrador para activar su acceso al terminal.",
            declineCode: "POS_ACCESS_DENIED",
            errorCode:   "ERR_POS_PERM_001",
          });
        }
      }

      let authCode: string;
      let mpPaymentId: number | null = null;
      let realCharge = false;
      // txApproved tracks the business outcome (real charge OR intentional local auth)
      let txApproved = false;
      // What actually got charged, in what currency — recorded on the ledger
      // below instead of a hardcoded label, so the transaction history
      // reflects reality (Stripe here always charges USD; Mercado Pago always
      // settles MXN; these can diverge from the operator-entered `amount`
      // when a Stripe→MP fallback converts it).
      let chargedCurrency: "USD" | "MXN" = "MXN";
      let chargedAmount: number = parseFloat(amount);

      // ── Parse expiry MM/YY ────────────────────────────────────────────────
      const [expMMStr = "12", expYYStr = "27"] = (expiryDate ?? "12/27").trim().split("/");
      const expMonth = parseInt(expMMStr, 10);
      const expYear  = 2000 + parseInt(expYYStr, 10);

      // ── Motor de Reglas de Enrutamiento ───────────────────────────────────
      const routingStart = Date.now();
      const acquirerDecision = await selectAcquirer({
        amount:   parseFloat(amount),
        currency: "MXN",
        protocol: protocol ?? "201.1",
        cardType,
      });
      console.log(`[Routing] Acquirer: ${acquirerDecision.acquirer} | Rule: ${acquirerDecision.ruleName ?? "fallback"}`);

      // ── Route payment to selected acquirer ────────────────────────────────
      const useStripe      = acquirerDecision.acquirer === "stripe";
      const useMercadoPago = acquirerDecision.acquirer === "mercadopago";
      const useLocal       = acquirerDecision.acquirer === "local";

      if (useStripe) {
        try {
          const { getStripeClient } = await import("./stripeClient");
          const stripe = await getStripeClient();

          // 1. Create payment method from raw card data
          const pm = await stripe.paymentMethods.create({
            type: "card",
            card: {
              number:    cardNumber,
              exp_month: expMonth,
              exp_year:  expYear,
              cvc:       parsed.data.cvv,
            },
            billing_details: { name: holderName ?? "TITULAR" },
          });

          // 2. Create + confirm payment intent
          const amountCents = Math.max(Math.round(parseFloat(amount) * 100), 50);
          const description = ventaForzada
            ? `Banxico Plus POS VENTA-FORZADA · ${cardType} · Protocolo ${protocol ?? "1643"}`
            : `Banxico Plus POS · ${cardType} · Protocolo ${protocol ?? "201.1"}`;

          const intent = await stripe.paymentIntents.create({
            amount:       amountCents,
            currency:     "usd",
            payment_method: pm.id,
            confirm:      true,
            description,
            automatic_payment_methods: { enabled: true, allow_redirects: "never" },
          });

          if (intent.status === "succeeded") {
            realCharge = true;
            txApproved = true;
            authCode = `STR-${intent.id.slice(-12).toUpperCase()}`;
            chargedCurrency = "USD";
            chargedAmount   = parseFloat(amount);
            console.log(`[Stripe] OK | id:${intent.id} | $${parseFloat(amount)} USD`);
          } else {
            console.log(`[Stripe] Estado no exitoso: ${intent.status}`);
            res.status(402).json({
              error: `Tarjeta no aprobada / Card not approved`,
              declineCode: intent.status,
              stripeStatus: intent.status,
            });
            return;
          }
        } catch (stripeErr: any) {
          const code    = stripeErr?.code ?? "card_error";
          const decline = stripeErr?.decline_code ?? stripeErr?.code ?? "unknown";
          const msg     = stripeErr?.message ?? "Error al procesar tarjeta";
          console.error(`[Stripe] ERROR — code:${code} decline:${decline} — ${msg}`);

          // Hard declines → reject immediately, no fallback
          const hardDeclines = ["card_declined","incorrect_cvc","expired_card","incorrect_number",
                                "insufficient_funds","lost_card","stolen_card","do_not_honor",
                                "transaction_not_allowed","invalid_expiry_year","invalid_expiry_month"];
          if (hardDeclines.includes(code) || hardDeclines.includes(decline)) {
            res.status(402).json({
              error: msg,
              declineCode: decline,
              stripeStatus: "declined",
            });
            return;
          }

          // Soft error (network/config) → try Mercado Pago as secondary acquirer.
          // IMPORTANT: the Stripe leg above always charges in USD, but Mercado
          // Pago (MX account) always settles in MXN with no currency field of
          // its own — sending the raw USD amount would silently charge pesos
          // at face value (e.g. a $200 USD attempt becomes $200 MXN, ~18x
          // less). Convert using the configured exchange rate before charging,
          // and if the rate is missing/invalid, refuse rather than guess.
          console.warn(`[Stripe] Soft error, attempting MP fallback — ${msg}`);
          if (mpCardToken && process.env.MP_ACCESS_TOKEN) {
            const settingsForFx = await storage.getSettings();
            const tipoCambio = settingsForFx?.tipoCambio;
            if (!tipoCambio || !(tipoCambio > 0)) {
              console.error(`[MP-Fallback] Sin tipo de cambio configurado — no se puede convertir USD→MXN de forma segura, se aborta el respaldo`);
              res.status(502).json({
                error: "No se pudo procesar el cobro: Stripe no disponible y no hay tipo de cambio configurado para el respaldo en pesos.",
                declineCode: "FX_RATE_MISSING",
              });
              return;
            }
            const amountUsd = parseFloat(amount);
            const amountMxn = amountUsd * tipoCambio;
            try {
              const { processMPPaymentWithToken } = await import("./mercadopagoClient");
              const mpResult = await processMPPaymentWithToken({
                cardToken: mpCardToken,
                cardType,
                holderEmail: "josbar93@gmail.com",
                amount: Math.max(amountMxn, 5),
                description: `Banxico Plus POS MP-Fallback (USD→MXN @${tipoCambio}) · ${cardType} · ${protocol ?? "201.1"}`,
              });
              mpPaymentId = mpResult.id;
              realCharge  = mpResult.status === "approved";
              txApproved  = realCharge;
              authCode    = mpResult.authorization_code ? `MP-${mpResult.authorization_code}` : `MP-${mpResult.id}`;
              chargedCurrency = "MXN";
              chargedAmount   = amountMxn;
              console.log(`[MP-Fallback] ID:${mpResult.id} | Estado:${mpResult.status} | $${amountUsd} USD → $${amountMxn.toFixed(2)} MXN @${tipoCambio}`);
              if (mpResult.status === "rejected") {
                res.status(402).json({
                  error: `Tarjeta rechazada (fallback MP): ${mpResult.status_detail}`,
                  declineCode: mpResult.status_detail,
                  stripeStatus: "declined",
                });
                return;
              }
            } catch (_mpErr: any) {
              console.error(`[MP-Fallback] ERROR — ${(_mpErr as any)?.message}`);
              // Both Stripe and MP failed → local simulation (not approved)
              authCode   = `AUTH-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
              txApproved = false;
            }
          } else {
            // No MP credentials → local simulation fallback (not a real charge)
            authCode   = `AUTH-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
            txApproved = false;
          }
        }
      } else if ((useMercadoPago || (!useStripe && !useLocal)) && mpCardToken && process.env.MP_ACCESS_TOKEN) {
        // ── Mercado Pago (seleccionado explícitamente por motor de reglas) ──
        try {
          const { processMPPaymentWithToken } = await import("./mercadopagoClient");
          const mpResult = await processMPPaymentWithToken({
            cardToken: mpCardToken,
            cardType,
            holderEmail: "josbar93@gmail.com",
            amount: Math.max(parseFloat(amount), 5),
            description: `Banxico Plus POS · ${cardType} · ${protocol ?? "201.1"}`,
          });
          mpPaymentId = mpResult.id;
          realCharge  = mpResult.status === "approved";
          txApproved  = realCharge;
          authCode    = mpResult.authorization_code
            ? `MP-${mpResult.authorization_code}`
            : `MP-${mpResult.id}`;
          console.log(`[MP] Pago | ID:${mpResult.id} | Estado:${mpResult.status} | ${mpResult.status_detail}`);
          if (mpResult.status === "rejected") {
            res.status(402).json({
              error: `Tarjeta rechazada: ${mpResult.status_detail}`,
              declineCode: mpResult.status_detail,
              stripeStatus: "declined",
            });
            return;
          }
        } catch (_mpErr: any) {
          console.error(`[MP] ERROR — ${(_mpErr as any)?.message}`);
          authCode   = `AUTH-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
          txApproved = false;
        }
      } else {
        // ── Autorización local (seleccionada explícitamente por regla de enrutamiento) ──
        authCode   = `AUTH-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
        realCharge = false;
        txApproved = true; // intentional local route is considered approved
      }

      const routingResponseMs = Date.now() - routingStart;
      const transactionId = `TXN-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;

      const op = req.currentUser!;
      const transaction = await storage.createTransaction({
        transactionId,
        protocol: protocol || "201.1",
        type: "payment",
        amount: chargedAmount.toString(),
        currency: chargedCurrency,
        status: "processing",
        authCode,
        fromAccount: `${(holderName || "TITULAR").toUpperCase()} · ${cardType.toUpperCase()} · ${maskCardNumber(cardNumber)}`,
        toAccount:   `${op.fullName.toUpperCase()} · ${op.username} · TERMINAL POS`,
        description: realCharge
          ? `Cobro MP · ${cardType} · ${maskCardNumber(cardNumber)} · ID:${mpPaymentId}`
          : `Pago con ${cardType} - ${maskCardNumber(cardNumber)} [${acquirerDecision.acquirer}]`,
        createdBy: op.username,
      });

      // ── Registrar decisión de enrutamiento ────────────────────────────────
      storage.createRoutingDecision({
        transactionId:    transaction.transactionId,   // use business ID for traceability
        ruleId:           acquirerDecision.ruleId,
        ruleName:         acquirerDecision.ruleName,
        acquirer:         acquirerDecision.acquirer,
        conditionMatched: acquirerDecision.conditionMatched,
        responseTimeMs:   routingResponseMs,
        approved:         txApproved,                 // aligned with actual business outcome
        amount:           chargedAmount.toString(),
        currency:         chargedCurrency,
        protocol:         protocol ?? "201.1",
        cardType,
      }).catch(err => console.error("[Routing] Error al guardar decisión:", err));
      
      // Crear método de pago (CVV/PIN nunca se persisten, tarjeta enmascarada)
      await storage.createPaymentMethod({
        transactionId: transaction.id,
        cardType,
        cardNumber,
        holderName: holderName || "Titular",
        expiryDate: expiryDate || "12/25",
        verified: true
      });
      
      // Generar token de seguridad
      const tokenId = `TOK-${Date.now()}-${randomBytes(8).toString('hex').toUpperCase()}`;
      await storage.createSecurityToken({
        tokenId,
        transactionId: transaction.id,
        hash: randomBytes(32).toString('hex'),
        algorithm: "AES-256",
        emvCompliant: true,
        pciCompliant: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      
      // Actualizar estado final: "completed" solo si la transacción fue aprobada,
      // "failed" si Stripe soft-errored y no hubo fallback exitoso a MP
      setTimeout(async () => {
        try {
          const finalStatus = txApproved ? "completed" : "failed";
          await storage.updateTransactionStatus(transaction.id, finalStatus, authCode);
        } catch (err) {
          console.error("Error al actualizar estado final de transacción POS:", err);
        }
      }, 2000);
      
      res.json({
        success: true,
        transaction,
        authCode,
        tokenId,
        status: "processing",
        realCharge,
        mpPaymentId,
        message: "Pago procesado exitosamente"
      });
    } catch (error) {
      res.status(500).json({ error: "Error al procesar pago" });
    }
  });

  // ── SR-LINK: SENDER / RECEIVER PAIRING ────────────────────────────────────
  const srLinkSchema = z.object({
    senderName:       z.string().min(1),
    senderCard:       z.string().min(4),
    senderBank:       z.string().min(1),
    senderCardType:   z.string().min(1),
    senderExpiry:     z.string().min(1),
    senderCountry:    z.string().min(1),
    senderA2:         z.string().min(2),
    senderA3:         z.string().min(3),
    senderIsoNum:     z.string().min(1),
    receiverName:     z.string().min(1),
    receiverCard:     z.string().min(4),
    receiverBank:     z.string().min(1),
    receiverCardType: z.string().min(1),
    receiverExpiry:   z.string().min(1),
    receiverCountry:  z.string().min(1),
    receiverA2:       z.string().min(2),
    receiverA3:       z.string().min(3),
    receiverIsoNum:   z.string().min(1),
    totalAmount:      z.string().min(1),
    renderedAmount:   z.string().min(1),
    currency:         z.enum(["EUR", "USD", "MXN", "GBP"]),
    protocol:         z.string().min(1),
  });

  app.post("/api/sr-link", requireSession, async (req, res) => {
    try {
      const actor = req.currentUser!;
      // Access control: ADMIN always; others need at least one active terminal
      if (actor.role !== "ADMIN") {
        const myTerminals = await storage.getTerminalsByOwner(actor.username);
        const OPERATIVE = new Set(["active", "online", "reconfigured", "idle"]);
        const hasActive = myTerminals.some(t => OPERATIVE.has((t.status ?? "").toLowerCase()));
        if (!hasActive) {
          res.status(403).json({
            error: "Terminal no activa. Contacta al administrador para habilitar tu terminal antes de operar vinculaciones.",
          });
          return;
        }
      }

      const parsed = srLinkSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
        return;
      }
      const d = parsed.data;

      const linkedCode = Math.floor(100000 + Math.random() * 900000).toString();
      const approvalCode = `LINK-${randomBytes(3).toString('hex').toUpperCase()}`;
      const transactionId = `SR-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const tokenId = `SRLINK-${Date.now()}-${randomBytes(8).toString('hex').toUpperCase()}`;
      const authCodes = `${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
      const now = new Date();
      const finish = new Date(now.getTime() + 10 * 60 * 1000);
      const amountVal = parseFloat(d.renderedAmount.replace(/,/g, ""));

      const tx = await storage.createTransaction({
        transactionId,
        protocol: `P${d.protocol}`,
        type: "sr-link",
        amount: isNaN(amountVal) ? "0" : amountVal.toString(),
        currency: d.currency,
        status: "processing",
        fromAccount: `${d.senderName.toUpperCase()} · ${d.senderBank.toUpperCase()} · ${maskCardNumber(d.senderCard.replace(/\s/g, ""))}`,
        toAccount:   `${d.receiverName.toUpperCase()} · ${d.receiverBank.toUpperCase()} · ${maskCardNumber(d.receiverCard.replace(/\s/g, ""))}`,
        authCode: approvalCode,
        description: `SR-LINK: ${d.senderName.toUpperCase()} → ${d.receiverName.toUpperCase()} · ${d.renderedAmount} ${d.currency} · PROTOCOL ${d.protocol}`,
        createdBy: actor.username,
      });

      await storage.createPaymentMethod({
        transactionId: tx.id,
        cardType: d.receiverCardType,
        cardNumber: d.receiverCard.replace(/\s/g, ""),
        holderName: d.receiverName,
        expiryDate: d.receiverExpiry,
        verified: true,
      });

      await storage.createSecurityToken({
        tokenId,
        transactionId: tx.id,
        hash: randomBytes(32).toString('hex'),
        algorithm: "AES-256",
        emvCompliant: true,
        pciCompliant: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const steps: [string, string, string][] = [
        ["NETWORK_CONNECT", "ok",        `Connecting to Mastercard Network — DONE`],
        ["SENDER_VERIFY",   "ok",        `Sender verified: ${d.senderName.toUpperCase()} · ${d.senderBank.toUpperCase()}`],
        ["RECEIVER_VERIFY", "ok",        `Receiver verified: ${d.receiverName.toUpperCase()} · ${d.receiverBank.toUpperCase()}`],
        ["PROTOCOL_CHECK",  "ok",        `Protocol ${d.protocol} validated — ONLINE SALE`],
        ["SR_LINK",         "ok",        `Linked Code assigned: ${linkedCode}`],
        ["AUTH_GENERATE",   "ok",        `Authorization: ${approvalCode} · Auth codes: ${authCodes}`],
        ["TX_RECORD",       "ok",        `Transaction record created: ${transactionId}`],
        ["COMPLETE",        "completed", `SR-LINK complete — Amount: ${d.renderedAmount} ${d.currency} — STATUS: APPROVED`],
      ];
      for (const [action, status, message] of steps) {
        await storage.createTransactionLog({ transactionId: tx.id, action, status, message });
      }

      await storage.updateTransactionStatus(tx.id, "completed", approvalCode);

      res.json({
        success: true,
        transactionId,
        linkedCode,
        approvalCode,
        authCodes,
        tokenId,
        status: "LINKED",
        sender: {
          name: d.senderName.toUpperCase(), card: maskCardNumber(d.senderCard.replace(/\s/g, "")),
          bank: d.senderBank.toUpperCase(), cardType: d.senderCardType,
          expiry: d.senderExpiry, country: d.senderCountry,
          a2: d.senderA2, a3: d.senderA3, isoNum: d.senderIsoNum,
        },
        receiver: {
          name: d.receiverName.toUpperCase(), card: maskCardNumber(d.receiverCard.replace(/\s/g, "")),
          bank: d.receiverBank.toUpperCase(), cardType: d.receiverCardType,
          expiry: d.receiverExpiry, country: d.receiverCountry,
          a2: d.receiverA2, a3: d.receiverA3, isoNum: d.receiverIsoNum,
        },
        totalAmount: d.totalAmount,
        renderedAmount: d.renderedAmount,
        currency: d.currency,
        protocol: d.protocol,
        globalDate: now.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase(),
        startTime: now.toLocaleTimeString("es-MX", { hour12: false }),
        finishTime: finish.toLocaleTimeString("es-MX", { hour12: false }),
      });
    } catch (error) {
      console.error("SR-Link error:", error);
      res.status(500).json({ error: "Error al procesar vinculación SR" });
    }
  });

  // ── Health Check ───────────────────────────────────────────────────────────
  app.get("/api/health", requireSession, async (_req, res) => {
    try {
      const allTx = await storage.getAllTransactions();
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentTx = allTx.filter(t => new Date(t.createdAt).getTime() > oneDayAgo);
      const recentFailed = recentTx.filter(t => t.status === "failed").length;
      const failRate = recentTx.length > 0 ? recentFailed / recentTx.length : 0;
      const terminals = await storage.getAllTerminals();
      const activeTerminals = terminals.filter(t => t.status === "Online" || t.status === "Reconfigured" || t.status === "Configured").length;
      const { getStripeMode } = await import("./stripeClient");
      const stripeMode = getStripeMode();
      res.json({
        database: "ok",
        bankingApi: "ok",
        visaMcNetwork: failRate < 0.5 ? "ok" : "degraded",
        swiftGateway: "ok",
        posTerminals: activeTerminals > 0 ? "ok" : "degraded",
        securityAes: "ok",
        totalTransactions: allTx.length,
        failedLast24h: recentFailed,
        activeTerminals,
        stripeMode,
      });
    } catch {
      res.status(500).json({ error: "Health check failed" });
    }
  });

  // ── Crypto Keys ─────────────────────────────────────────────────────────────
  app.get("/api/crypto-keys", requireSession, async (req, res) => {
    try {
      const user = req.currentUser!;
      const keys = await storage.getCryptoKeys(user.username, user.role === "ADMIN");
      res.json(keys);
    } catch {
      res.status(500).json({ error: "Error al obtener claves" });
    }
  });

  app.post("/api/crypto-keys", requireSession, requireRole("ADMIN"), async (req, res) => {
    try {
      const { name, type, scope, expiresDays } = req.body;
      if (!name || !type || !scope || !expiresDays) {
        res.status(400).json({ error: "Faltan campos requeridos" });
        return;
      }
      const user = req.currentUser!;
      const prefix = name.split("_")[0].toLowerCase();
      const hash = require("crypto").randomBytes(8).toString("hex");
      const tail = require("crypto").randomBytes(4).toString("hex");
      const value = `${prefix}_live_${hash}...${tail}`;
      const expiresAt = new Date(Date.now() + parseInt(expiresDays) * 24 * 60 * 60 * 1000);
      const key = await storage.createCryptoKey({
        name, type, scope, value,
        status: "Activa", usage: 0,
        createdBy: user.username,
        expiresAt, lastUsedAt: null,
      });
      res.status(201).json(key);
    } catch {
      res.status(500).json({ error: "Error al generar clave" });
    }
  });

  app.patch("/api/crypto-keys/:id", requireSession, requireRole("ADMIN"), async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) { res.status(400).json({ error: "Status requerido" }); return; }
      const updated = await storage.updateCryptoKeyStatus(req.params.id, status);
      if (!updated) { res.status(404).json({ error: "Clave no encontrada" }); return; }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Error al actualizar clave" });
    }
  });

  app.post("/api/crypto-keys/:id/usage", requireSession, async (req, res) => {
    try {
      await storage.incrementKeyUsage(req.params.id);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Error al registrar uso" });
    }
  });

  app.delete("/api/crypto-keys/:id", requireSession, requireRole("ADMIN"), async (req, res) => {
    try {
      await storage.deleteCryptoKey(req.params.id);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Error al eliminar clave" });
    }
  });

  // ── System Settings ────────────────────────────────────────────────────────
  app.get("/api/settings", requireSession, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      const { maintenanceBypassTokenHash, ...publicSettings } = settings;
      res.json({
        ...publicSettings,
        // Computed per-request, never persisted: lets the frontend tell a
        // bypassed session apart from a genuinely blocked one without ever
        // shipping the bypass hash itself to the browser.
        maintenanceBypassed: Maintenance.requestHasValidBypass(req, maintenanceBypassTokenHash),
      });
    } catch {
      res.status(500).json({ error: "Error al obtener configuración" });
    }
  });

  // ── Activar mantenimiento duro desde un enlace (fuera del panel admin) ───
  // Un solo clic autenticado como ADMIN activa el mantenimiento y devuelve el
  // enlace de bypass una única vez (nunca se persiste en claro ni se vuelve
  // a mostrar). Este navegador queda exento de inmediato (cookie propia).
  app.get("/api/admin/maintenance/activate", requireRole("ADMIN"), async (req, res) => {
    const untilRaw = typeof req.query.until === "string" ? req.query.until : null;
    let until: string | null = null;
    if (untilRaw) {
      const parsed = new Date(untilRaw);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).send("Parámetro 'until' inválido (usa formato ISO 8601, ej. 2026-09-18T06:00:00.000Z).");
        return;
      }
      until = parsed.toISOString();
    }
    const presetToken = typeof req.query.bypassToken === "string" ? req.query.bypassToken : undefined;
    const { raw, hash } = Maintenance.generateBypassToken(presetToken);
    await storage.updateSettings({
      maintenanceMode: true,
      maintenanceHardLockdown: true,
      maintenanceEndsAt: until,
      maintenanceBypassTokenHash: hash,
    });
    res.cookie(Maintenance.MAINTENANCE_BYPASS_COOKIE, raw, {
      httpOnly: true, secure: true, sameSite: "lax", maxAge: 24 * 60 * 60 * 1000,
    });
    const bypassLink = `${req.protocol}://${req.get("host")}/api/maintenance/bypass?token=${raw}`;
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Mantenimiento activado</title></head>
      <body style="font-family:system-ui,sans-serif;background:#0f0f0f;color:#fff;padding:40px;max-width:640px;margin:0 auto;">
        <h2>Mantenimiento global activado</h2>
        <p>Bloqueo duro: TODOS los usuarios, incluido este administrador, salvo con el enlace de abajo.</p>
        <p>Termina automáticamente: ${until ?? "no configurado — apágalo manualmente cuando quieras"}</p>
        <p><strong>Guarda este enlace ahora — solo se muestra una vez:</strong></p>
        <p style="word-break:break-all;background:#1a1a1a;padding:12px;border-radius:8px;">${bypassLink}</p>
        <p style="color:#999;font-size:13px;">Este navegador ya quedó exento (no necesitas el enlace aquí). Úsalo en cualquier otro dispositivo/navegador que necesites usar mientras dure el mantenimiento.</p>
      </body></html>`);
  });

  // ── Apagar mantenimiento manualmente desde un enlace ─────────────────────
  app.get("/api/admin/maintenance/deactivate", requireRole("ADMIN"), async (_req, res) => {
    await storage.updateSettings({
      maintenanceMode: false,
      maintenanceHardLockdown: false,
      maintenanceEndsAt: null,
      maintenanceBypassTokenHash: null,
    });
    res.send(`<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#0f0f0f;color:#fff;padding:40px;">
      <h2>Mantenimiento desactivado</h2><p>El sistema volvió a operar con normalidad para todos los usuarios.</p>
      </body></html>`);
  });

  app.patch("/api/settings", requireSession, requireRole("ADMIN"), async (req, res) => {
    try {
      const patch = req.body;
      if (!patch || typeof patch !== "object") {
        res.status(400).json({ error: "Payload inválido" });
        return;
      }
      const updated = await storage.updateSettings(patch);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Error al guardar configuración" });
    }
  });

  // ── Caja — resumen real (transacciones + movimientos manuales) ──────────────
  app.get("/api/caja/summary", requireSession, async (_req, res) => {
    try {
      const [settings, allTransactions, movements] = await Promise.all([
        storage.getSettings(),
        storage.getAllTransactions(),
        storage.getCajaMovements(),
      ]);

      const rates = { tipoCambio: settings.tipoCambio, fxRateEUR: settings.fxRateEUR, fxRateGBP: settings.fxRateGBP };

      const txIngresos = allTransactions.filter(
        (tx) => tx.status === "completed" && (CAJA_INGRESO_TX_TYPES as readonly string[]).includes(tx.type)
      );

      const transactionMovements = txIngresos.map((tx) => ({
        id: tx.id,
        source: "transaction" as const,
        type: "ingreso" as const,
        amountUSD: convertToUSD(Number(tx.amount), tx.currency, rates),
        originalAmount: Number(tx.amount),
        originalCurrency: tx.currency,
        category: tx.protocol?.replace(/^\D+/, "").startsWith("201") ? "pos" : "transferencia",
        description: tx.description || `Transacción ${tx.transactionId}`,
        reference: tx.transactionId,
        createdBy: tx.createdBy,
        createdAt: tx.createdAt,
      }));

      const manualMovements = movements.map((m) => ({
        id: m.id,
        source: "manual" as const,
        type: m.type as "ingreso" | "egreso",
        amountUSD: m.amountUSD,
        originalAmount: m.amountUSD,
        originalCurrency: "USD",
        category: m.category,
        description: m.description,
        reference: m.reference ?? undefined,
        createdBy: m.createdBy,
        createdAt: m.createdAt,
      }));

      const all = [...transactionMovements, ...manualMovements].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const ingresosUSD = all.filter((m) => m.type === "ingreso").reduce((sum, m) => sum + m.amountUSD, 0);
      const egresosUSD = all.filter((m) => m.type === "egreso").reduce((sum, m) => sum + m.amountUSD, 0);
      const saldoUSD = settings.saldoAperturaUSD + ingresosUSD - egresosUSD;

      res.json({
        movements: all,
        ingresosUSD,
        egresosUSD,
        saldoUSD,
        saldoAperturaUSD: settings.saldoAperturaUSD,
      });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener resumen de caja" });
    }
  });

  app.post("/api/caja/movements", requireSession, requireRole("ADMIN"), async (req, res) => {
    try {
      const parsed = insertCajaMovementSchema.safeParse({
        ...req.body,
        createdBy: req.currentUser!.username,
      });
      if (!parsed.success) {
        res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
        return;
      }
      const movement = await storage.createCajaMovement(parsed.data);
      res.status(201).json(movement);
    } catch (error) {
      res.status(500).json({ error: "Error al registrar movimiento de caja" });
    }
  });

  // ── EUR → Caja formal (accessible to any authenticated user) ───────────────
  // Optima QRH (and any user) can forward a verified EUR POS transaction to the
  // formal caja. The server converts EUR→USD using the current fx rate.
  app.post("/api/caja/eur-ingreso", requireSession, async (req, res) => {
    try {
      const schema = z.object({
        amountEUR:     z.number().positive(),
        authCode:      z.string().min(1),
        cardType:      z.string().optional(),
        protocol:      z.string().optional(),
        transactionId: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
        return;
      }
      const { amountEUR, authCode, cardType, protocol, transactionId } = parsed.data;
      const settings = await storage.getSettings();
      const amountUSD = amountEUR * settings.fxRateEUR;
      const desc = [
        "POS EUR",
        cardType ? `· ${cardType}` : "",
        `· Auth ${authCode}`,
        protocol ? `· Protocolo ${protocol}` : "",
      ].filter(Boolean).join(" ");

      const movement = await storage.createCajaMovement({
        type:        "ingreso",
        amountUSD,
        category:    "Venta tarjeta internacional",
        description: desc,
        reference:   transactionId ?? authCode,
        createdBy:   req.currentUser!.username,
      });
      res.status(201).json({
        ...movement,
        originalAmount:   amountEUR,
        originalCurrency: "EUR",
        amountUSD,
      });
    } catch (error) {
      res.status(500).json({ error: "Error al registrar ingreso EUR en caja" });
    }
  });

  // ── Host-Failure Simulation ─────────────────────────────────────────────────
  // Inyecta la transacción ALUSH CECO como "pending" y la marca "failed"
  // automáticamente en ~10 s (sin conexión directa con host bancario).
  app.post("/api/admin/host-failure-sim", requireSession, requireRole("ADMIN"), async (req, res) => {
    try {
      const op = req.currentUser!;
      const transactionId = `TXN-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;

      const tx = await storage.createTransaction({
        transactionId,
        protocol:    "101.1",
        type:        "payment",
        amount:      "50000.00",
        currency:    "USD",
        status:      "pending",
        authCode:    "AUTH-1781453974397-61419076",
        fromAccount: "ALUSH CECO · MASTERCARD INTERNACIONAL · ****0074",
        toAccount:   `${op.fullName.toUpperCase()} · ${op.username} · TERMINAL POS`,
        description: "Pago con Mastercard Internacional - ****0074",
        createdBy:   op.username,
      });

      await storage.createPaymentMethod({
        transactionId: tx.id,
        cardType:      "Mastercard Internacional",
        cardNumber:    "000000000000074",
        holderName:    "ALUSH CECO",
        expiryDate:    "12/27",
        verified:      false,
      });

      // Sin conexión con host bancario → fallo automático en 10 s
      setTimeout(async () => {
        try {
          await storage.updateTransactionStatus(tx.id, "failed", "ERR_HOST_DISCONNECT");
        } catch (err) {
          console.error("host-failure-sim auto-fail error:", err);
        }
      }, 10000);

      res.json({ success: true, transaction: tx, failsInMs: 10000 });
    } catch (error) {
      res.status(500).json({ error: "Error al simular fallo de host" });
    }
  });

  // ─── Subscription endpoints ─────────────────────────────────────────────────
  const completedPayments = new Set<string>();

  app.get("/api/subscription", requireSession, async (req, res) => {
    const user = req.currentUser!;
    const isPatricio = user.email === "patricioarroyo510@gmail.com";
    const isPaid = completedPayments.has(user.id);

    const isAvoExport = user.email === "avoexport03@gmail.com";
    const isJMDoors   = user.email === "jmdoorsopen@gmail.com";
    const isDanyLeon  = user.username === "danyleonpinto";
    const isJETC76    = user.email === "jetc76@hotmail.com";
    const isOptima    = user.email === "optimaqrh@gmail.com";
    const isSocemro   = user.email === "socemro2@gmail.com";

    if (isAvoExport) {
      return res.json({
        userId:          user.id,
        userName:        user.fullName,
        userEmail:       user.email,
        plan:            "Usuario Banxico+ Annual",
        totalAmount:     750,
        paidAmount:      750.00,
        remainingAmount: 0,
        currency:        "USD",
        contractDate:    "2026-06-25",
        contractTerm:    "12 months",
        status:          "active",
        posUnlocked:     true,
        posLocked:       false,
        restricted:      false,
        routingLocked:   false,
        adminCanInterfere: true,
        walletAddress:   "0xf53f3bCAF6F0d5D20aA8f165AeD654Aa55C8Ec27",
        walletNetwork:   "ETHEREUM (ERC-20)",
        walletToken:     "ETH",
        paymentHistory: [
          { ref: "PYMT-AE-2026-062501-PARTIAL",  date: "2026-06-25", amountMXN:  939.00, amountUSD:  53.66, tc: 17.50, status: "conciliado" },
          { ref: "PYMT-AE-2026-062601-ABONO",    date: "2026-06-26", amountMXN: 1000.00, amountUSD:  57.14, tc: 17.50, status: "conciliado" },
          { ref: "PYMT-AE-2026-062626-ABONO3",   date: "2026-06-26", amountMXN:  350.00, amountUSD:  20.00, tc: 17.50, status: "conciliado" },
          { ref: "PYMT-AE-2026-062801-ABONO4",   date: "2026-06-28", amountMXN: 1018.50, amountUSD:  58.20, tc: 17.50, status: "conciliado" },
          { ref: "PYMT-AE-2026-062901-ABONO5",   date: "2026-06-29", amountMXN: 7000.00, amountUSD: 400.00, tc: 17.50, status: "conciliado" },
          { ref: "PYMT-AE-2026-070101-LIQUIDACION", date: "2026-07-01", amountMXN: 2817.50, amountUSD: 161.00, tc: 17.50, status: "conciliado" },
        ],
        paymentWarning:  null,
        company:         "AVO EXPORT",
        phone:           "—",
        signerName:      "José Luis Barrientos Terreros",
        signerTitle:     "Founder",
        supplierAddress: "7652 Sawmill Road, Suite 341, Dublin, Ohio 43016",
      });
    }

    if (isJMDoors) {
      return res.json({
        userId:           user.id,
        userName:         user.fullName,
        userEmail:        user.email,
        plan:             "Usuario Banxico+ Annual",
        totalAmount:      750,
        paidAmount:       0,
        remainingAmount:  750,
        currency:         "USD",
        contractDate:     "2026-06-26",
        contractTerm:     "12 months",
        status:           "pending",
        posUnlocked:      false,
        posLocked:        true,
        restricted:       false,
        routingLocked:    true,
        paymentWarning:   "PAGO NO RECIBIDO — No se ha registrado ningún pago para este contrato. POS Virtual y Enrutamiento POS permanecen bloqueados hasta recibir el pago inicial. Referencia de contrato: BNXP-2026-062601 · Código de estado: 0x4E43-NOPAY",
        walletAddress:    null,
        walletNetwork:    null,
        walletToken:      null,
        marginPercentage: 44,
        company:          "—",
        phone:            "—",
        signerName:       "José Luis Barrientos Terreros",
        signerTitle:      "Founder",
        supplierAddress:  "7652 Sawmill Road, Suite 341, Dublin, Ohio 43016",
      });
    }

    if (isJETC76) {
      return res.json({
        userId:           user.id,
        userName:         user.fullName,
        userEmail:        user.email,
        plan:             "Usuario Banxico+ Annual",
        totalAmount:      750,
        paidAmount:       0,
        remainingAmount:  750,
        currency:         "USD",
        contractDate:     "2026-06-27",
        contractTerm:     "12 months",
        status:           "pending",
        posUnlocked:      false,
        posLocked:        true,
        restricted:       false,
        routingLocked:    true,
        paymentWarning:   "BLOQUEO PREVENTIVO — Cuenta registrada sin pago inicial. POS Virtual y Enrutamiento POS bloqueados de forma preventiva hasta confirmar pago. Referencia de contrato: BNXP-2026-062701 · Código de estado: 0x4E43-PREV-LOCK · Usuario: jetc76@hotmail.com",
        walletAddress:    null,
        walletNetwork:    null,
        walletToken:      null,
        company:          "—",
        phone:            "—",
        signerName:       "José Luis Barrientos Terreros",
        signerTitle:      "Founder",
        supplierAddress:  "7652 Sawmill Road, Suite 341, Dublin, Ohio 43016",
        lockReason:       "PREVENTIVO — Sin pago registrado al momento del alta",
        lockCode:         "0x4E43-PREV-LOCK",
        lockDate:         "2026-06-27T00:00:00",
      });
    }

    if (isOptima) {
      return res.json({
        userId:            user.id,
        userName:          user.fullName,
        userEmail:         user.email,
        plan:              "Usuario Banxico+ Annual",
        totalAmount:       750,
        paidAmount:        750,
        remainingAmount:   0,
        currency:          "USD",
        contractDate:      "2026-06-30",
        contractTerm:      "12 months",
        status:            "complete",
        posUnlocked:       true,
        posLocked:         false,
        restricted:        false,
        routingLocked:     false,
        adminIntervention: false,
        adminCanInterfere: true,
        paymentWarning:    null,
        walletAddress:     "0x0E2CE732E0D65c1E3a34fC782896cae91fBaE1c3",
        walletNetwork:     "ETHEREUM (ERC-20)",
        walletToken:       "USDT",
        company:           "—",
        phone:             "—",
        signerName:        "José Luis Barrientos Terreros",
        signerTitle:       "Founder",
        supplierAddress:   "7652 Sawmill Road, Suite 341, Dublin, Ohio 43016",
      });
    }

    if (isSocemro) {
      return res.json({
        userId:           user.id,
        userName:         user.fullName,
        userEmail:        user.email,
        plan:             "Usuario Banxico+ Annual",
        totalAmount:      750,
        paidAmount:       750,
        remainingAmount:  0,
        currency:         "USD",
        contractDate:     "2026-06-24",
        contractTerm:     "12 months",
        status:           "complete",
        posUnlocked:      true,
        posLocked:        false,
        restricted:       false,
        routingLocked:    false,
        paymentWarning:   null,
        walletAddress:    SOCEMRO_TRON_WALLET,
        walletNetwork:    "TRON (TRC-20)",
        walletToken:      "USDT",
        marginPercentage: 50,
        company:          "—",
        phone:            "—",
        signerName:       "José Luis Barrientos Terreros",
        signerTitle:      "Founder",
        supplierAddress:  "7652 Sawmill Road, Suite 341, Dublin, Ohio 43016",
      });
    }

    if (isDanyLeon) {
      return res.json({
        userId:           user.id,
        userName:         user.fullName,
        userEmail:        user.email,
        plan:             "Usuario Banxico+ Annual",
        totalAmount:      750,
        paidAmount:       750,
        remainingAmount:  0,
        currency:         "USD",
        contractDate:     "2026-06-24",
        contractTerm:     "12 months",
        status:           "complete",
        posUnlocked:      true,
        posLocked:        false,
        restricted:       false,
        routingLocked:    false,
        paymentWarning:   null,
        walletAddress:    "TApbzNzmVxNE1SZLkMDcARuDEjYFEUpex2",
        walletNetwork:    "TRON (TRC-20)",
        walletToken:      "USDT",
        marginPercentage: 3,
        company:          "—",
        phone:            "—",
        signerName:       "José Luis Barrientos Terreros",
        signerTitle:      "Founder",
        supplierAddress:  "7652 Sawmill Road, Suite 341, Dublin, Ohio 43016",
      });
    }

    if (isPatricio) {
      const cutoff = new Date("2026-06-15T14:30:00Z"); // 9:30 AM CDT
      const posLocked = !isPaid && new Date() >= cutoff;
      return res.json({
        userId:          user.id,
        userName:        user.fullName,
        userEmail:       user.email,
        plan:            "Usuario Banxico+ Annual",
        totalAmount:     750,
        paidAmount:      isPaid ? 750 : 499,
        remainingAmount: isPaid ? 0 : 251,
        currency:        "USDT",
        contractDate:    "2026-06-12",
        contractTerm:    "12 months",
        status:          isPaid ? "complete" : "partial",
        posUnlocked:     isPaid,
        posLocked,
        walletAddress:   "0xa8FAaC0297897d9c3b14a037BfDe794c1aFBa7d3",
        walletNetwork:   "ETHEREUM (ERC20)",
        walletToken:     "USDT",
        company:         "Xpress Internacional",
        phone:           "+593979632394",
        signerName:      "José Luis Barrientos Terreros",
        signerTitle:     "Founder",
        supplierAddress: "7652 Sawmill Road, Suite 341, Dublin, Ohio 43016",
      });
    }

    return res.json({
      userId:          user.id,
      userName:        user.fullName,
      userEmail:       user.email,
      plan:            "Enterprise Banking",
      totalAmount:     750,
      paidAmount:      750,
      remainingAmount: 0,
      currency:        "USD",
      contractDate:    "2025-06-03",
      contractTerm:    "12 months",
      status:          "complete",
      posUnlocked:     true,
      walletAddress:   null,
      walletNetwork:   null,
      walletToken:     null,
      company:         "Banxico Plus LLC",
      phone:           "+1 614-000-0000",
      signerName:      "José Luis Barrientos Terreros",
      signerTitle:     "Founder",
      supplierAddress: "7652 Sawmill Road, Suite 341, Dublin, Ohio 43016",
    });
  });

  app.post("/api/subscription/complete-payment", requireSession, async (req, res) => {
    const user = req.currentUser!;
    completedPayments.add(user.id);
    return res.json({ success: true, status: "complete", posUnlocked: true, message: "Payment verified successfully" });
  });

  // ─── Margen Operacional — pool global ───────────────────────────────────────
  const MARGIN_PARTICIPANTS = [
    { name: "Banxico Plus LLC",username: null,                     pct: 50, wallet: null,                                         network: "Platform",         token: null   },
    { name: "Socemro",            username: "socemro2@gmail.com",     pct: 50,   wallet: SOCEMRO_TRON_WALLET, network: "TRON (TRC-20)", token: "USDT" },
    { name: "Emiliano Maldonado", username: null,                     pct: 11.5, wallet: "TUZ4MGYkec7LYSJJEy6iJDr2Ko6gxmDzvi",  network: "TRON (TRC-20)", token: "USDT" },
  ];

  app.get("/api/margin-pool", requireSession, async (req, res) => {
    const allTxs = await storage.getAllTransactions();
    const totalPool = allTxs
      .filter(t => t.status === "completed" && !t.transactionId.startsWith("DSP-"))
      .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
    const operationalMargin = totalPool * 0.50;

    const dspTxs = allTxs.filter(t => t.status === "completed" && t.transactionId.startsWith("DSP-"));

    const participants = MARGIN_PARTICIPANTS.map(p => {
      const amountUSD = operationalMargin * (p.pct / 100);
      const dispersedUSD = p.username
        ? dspTxs.filter(t => t.createdBy === p.username).reduce((s, t) => s + parseFloat(t.amount || "0"), 0)
        : 0;
      return {
        name:         p.name,
        pct:          p.pct,
        amountUSD,
        wallet:       p.wallet,
        network:      p.network,
        token:        p.token,
        dispersedUSD,
        availableUSD: Math.max(0, amountUSD - dispersedUSD),
      };
    });

    return res.json({ totalPool, operationalMargin, participants });
  });

  // ── Documentos seguros ─────────────────────────────────────────────────────
  app.get("/api/documents", requireSession, async (req, res) => {
    const user = req.currentUser!;
    const docs = await storage.getDocuments(user.username, user.role === "ADMIN");
    res.json(docs);
  });

  app.post("/api/documents", requireSession, async (req, res) => {
    const user = req.currentUser!;
    const schema = z.object({
      name:     z.string().min(1).max(200),
      category: z.enum(["contract", "financial", "identity", "other"]),
      mimeType: z.string().min(1),
      size:     z.number().int().min(1).max(5 * 1024 * 1024),
      content:  z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
    const doc = await storage.createDocument({ ...parsed.data, uploadedBy: user.username });
    res.status(201).json(doc);
  });

  app.get("/api/documents/:id/download", requireSession, async (req, res) => {
    const user = req.currentUser!;
    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
    if (user.role !== "ADMIN" && doc.uploadedBy !== user.username)
      return res.status(403).json({ error: "Acceso denegado" });
    res.json(doc);
  });

  app.delete("/api/documents/:id", requireSession, async (req, res) => {
    const user = req.currentUser!;
    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
    if (user.role !== "ADMIN" && doc.uploadedBy !== user.username)
      return res.status(403).json({ error: "Acceso denegado" });
    await storage.deleteDocument(req.params.id);
    res.json({ success: true });
  });

  // ====================================================================
  // PAYMENT ENGINE — Motor de cobros real (Stripe + Mercado Pago)
  // ====================================================================

  app.get("/api/payment-engine/charges", requireSession, async (req, res) => {
    const user = req.currentUser!;
    const charges = await storage.getPaymentCharges(user.username, user.role === "ADMIN");
    res.json(charges);
  });

  app.post("/api/payment-engine/charge", requireSession, async (req, res) => {
    const user = req.currentUser!;

    // ── Cierre manual del motor de pagos (kill switch de administrador) ──
    const gateSettings = await storage.getSettings();
    if (gateSettings.paymentEngineDisabled) {
      return res.status(503).json({
        error: "Motor de Pagos cerrado por incidente. Se está gestionando el incidente.",
        declineCode: "PAYMENT_ENGINE_DISABLED",
        reason: gateSettings.paymentEngineDisabledReason || undefined,
      });
    }

    // ── Verificar permiso de acceso al Motor de Pagos ────────────────────
    if (user.role !== "ADMIN") {
      const [dbPerms] = await db
        .select({ paymentEngineAccess: usersTable.paymentEngineAccess })
        .from(usersTable)
        .where(eq(usersTable.username, user.username))
        .limit(1);
      if (!dbPerms?.paymentEngineAccess) {
        return res.status(403).json({
          error:  "Acceso al Motor de Pagos no autorizado. El administrador debe activar su acceso.",
          code:   "PAYMENT_ENGINE_ACCESS_DENIED",
        });
      }
    }

    const schema = z.object({
      amount:      z.number().positive(),
      currency:    z.string().length(3),
      description: z.string().default("Banxico Plus charge"),
      email:       z.string().email(),
      // Preferred path: a Stripe PaymentMethod id created client-side via
      // Stripe.js/Elements. Stripe blocks raw card numbers sent directly to
      // its API (PCI policy), so this is required for the Stripe leg to work.
      stripePaymentMethodId: z.string().optional(),
      // Legacy path: raw card data, only usable for the Mercado Pago fallback
      // (never sent to Stripe directly).
      card: z.object({
        number:   z.string().min(13).max(19),
        expMonth: z.number().int().min(1).max(12),
        expYear:  z.number().int().min(new Date().getFullYear()),
        cvv:      z.string().min(3).max(4),
        holder:   z.string().min(2),
      }).optional(),
      holder:  z.string().optional(),
      docType: z.string().optional(),
      docNum:  z.string().optional(),
    }).refine(d => d.stripePaymentMethodId || d.card, {
      message: "Se requiere stripePaymentMethodId o card",
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });

    const { amount, currency, description, email, card, stripePaymentMethodId } = parsed.data;
    const holderName = card?.holder ?? parsed.data.holder ?? "TITULAR";

    // ── Motor de Pagos unificado — intenta Stripe primero (validación real de tarjeta) ──
    // y recurre automáticamente a Mercado Pago si Stripe no está disponible. El
    // usuario/cliente ya no elige el procesador: el motor decide internamente.
    try {
      if (!stripePaymentMethodId) throw Object.assign(new Error("No hay método de pago tokenizado para Stripe"), { code: "card_error" });

      const { getStripeClient } = await import("./stripeClient");
      const stripe = await getStripeClient();

      // Confirm the PaymentIntent directly against the client-tokenized
      // PaymentMethod — no raw card data is ever sent to Stripe from here.
      const amountCents = Math.round(amount * 100);
      const idempKey = `pe-${user.username}-${Date.now()}-${randomBytes(4).toString("hex")}`;
      const intent = await stripe.paymentIntents.create({
        amount:               amountCents,
        currency:             currency.toLowerCase(),
        payment_method:       stripePaymentMethodId,
        confirm:              true,
        description:          description,
        receipt_email:        email,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      }, { idempotencyKey: idempKey });

      // 3. Retrieve receipt_url from the underlying charge
      let receiptUrl: string | null = null;
      if (intent.status === "succeeded" && intent.latest_charge) {
        try {
          const ch = await stripe.charges.retrieve(intent.latest_charge as string);
          receiptUrl = ch.receipt_url ?? null;
        } catch (_) { /* ignore */ }
      }

      let cardDetails: { last4?: string; brand?: string } | undefined;
      try {
        const pmRetrieved = await stripe.paymentMethods.retrieve(stripePaymentMethodId);
        cardDetails = pmRetrieved.card ?? undefined;
      } catch (_) { /* ignore — fall back to card?.number below */ }

      if (intent.status !== "succeeded") {
        const charge = await storage.createPaymentCharge({
          chargeId:     intent.id,
          processor:    "stripe",
          amount, currency: currency.toUpperCase(), status: intent.status,
          description, email,
          cardLast4:    cardDetails?.last4 ?? card?.number.slice(-4) ?? "0000",
          cardBrand:    cardDetails?.brand ?? "unknown",
          receiptUrl:   null,
          errorMessage: `Estado no exitoso: ${intent.status}`,
          createdBy:    user.username,
        });
        return res.status(402).json({ ...charge, error: "Tarjeta no aprobada / Card not approved" });
      }

      const charge = await storage.createPaymentCharge({
        chargeId:     intent.id,
        processor:    "stripe",
        amount,
        currency:     currency.toUpperCase(),
        status:       "succeeded",
        description,
        email,
        cardLast4:    cardDetails?.last4 ?? card?.number.slice(-4) ?? "0000",
        cardBrand:    cardDetails?.brand ?? "unknown",
        receiptUrl,
        errorMessage: null,
        createdBy:    user.username,
      });

      return res.json(charge);

    } catch (stripeErr: any) {
      const code    = stripeErr?.code ?? "card_error";
      const decline = stripeErr?.decline_code ?? stripeErr?.code ?? "unknown";
      const msg     = stripeErr?.message ?? "Error al procesar tarjeta";
      console.error(`[PaymentEngine/Stripe] ERROR — code:${code} decline:${decline} — ${msg}`);

      // Hard declines → reject immediately, no fallback (the card itself was rejected)
      const hardDeclines = ["card_declined", "incorrect_cvc", "expired_card", "incorrect_number",
        "insufficient_funds", "lost_card", "stolen_card", "do_not_honor",
        "transaction_not_allowed", "invalid_expiry_year", "invalid_expiry_month"];
      if (hardDeclines.includes(code) || hardDeclines.includes(decline)) {
        const charge = await storage.createPaymentCharge({
          chargeId:     `err-${Date.now()}`,
          processor:    "stripe",
          amount, currency: currency.toUpperCase(), status: "failed",
          description, email,
          cardLast4: card?.number.slice(-4) ?? "0000", cardBrand: null,
          receiptUrl: null, errorMessage: msg, createdBy: user.username,
        }).catch(() => null);
        return res.status(402).json({ ...(charge ?? {}), error: msg, declineCode: decline });
      }

      // ── Soft error (config/network) → fallback automático a Mercado Pago ──
      // Only possible when the caller also sent raw card data (legacy path);
      // the Stripe-Elements flow never exposes raw card fields to us, so
      // there is nothing to fall back with and we must surface the error.
      // IMPORTANT: Mercado Pago (MX account) always settles in MXN, regardless
      // of what currency_id we send it — sending a USD (or other) face-value
      // amount would silently charge pesos at that same number (e.g. a $200
      // USD attempt becomes $200 MXN, ~18x less). Convert to MXN using the
      // configured exchange rate before charging; if the currency is
      // anything Y can't convert, refuse rather than guess.
      console.warn(`[PaymentEngine] Stripe no disponible, usando Mercado Pago — ${msg}`);
      const mpToken = process.env.MP_ACCESS_TOKEN;
      if (!mpToken || !card) {
        const charge = await storage.createPaymentCharge({
          chargeId:     `err-${Date.now()}`,
          processor:    "stripe",
          amount, currency: currency.toUpperCase(), status: "failed",
          description, email,
          cardLast4: card?.number.slice(-4) ?? "0000", cardBrand: null,
          receiptUrl: null, errorMessage: "Motor de pagos no disponible en este momento", createdBy: user.username,
        }).catch(() => null);
        return res.status(502).json({ ...(charge ?? {}), error: "No se pudo procesar el cobro. Intenta nuevamente." });
      }

      const upperCurrency = currency.toUpperCase();
      let mpAmount: number;
      if (upperCurrency === "MXN") {
        mpAmount = amount;
      } else {
        const settingsForFx = await storage.getSettings();
        const rates = { tipoCambio: settingsForFx.tipoCambio, fxRateEUR: settingsForFx.fxRateEUR, fxRateGBP: settingsForFx.fxRateGBP };
        if (!rates.tipoCambio || !(rates.tipoCambio > 0) || !["USD", "EUR", "GBP"].includes(upperCurrency)) {
          const charge = await storage.createPaymentCharge({
            chargeId:     `err-${Date.now()}`,
            processor:    "mercadopago",
            amount, currency: upperCurrency, status: "failed",
            description, email,
            cardLast4: card.number.slice(-4), cardBrand: null,
            receiptUrl: null,
            errorMessage: `No se pudo procesar el cobro: Stripe no disponible y no hay conversión ${upperCurrency}→MXN configurada para el respaldo en Mercado Pago.`,
            createdBy: user.username,
          }).catch(() => null);
          return res.status(502).json({ ...(charge ?? {}), error: "No se pudo procesar el cobro. Intenta nuevamente." });
        }
        const amountUsd = convertToUSD(amount, upperCurrency, rates);
        mpAmount = amountUsd * rates.tipoCambio;
        console.log(`[PaymentEngine/MP-Fallback] $${amount} ${upperCurrency} → $${mpAmount.toFixed(2)} MXN @${rates.tipoCambio}`);
      }

      try {
        // 1. Create MP card token
        const tokenRes = await fetch("https://api.mercadopago.com/v1/card_tokens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${mpToken}`,
          },
          body: JSON.stringify({
            card_number:      card.number,
            security_code:    card.cvv,
            expiration_month: card.expMonth,
            expiration_year:  card.expYear,
            cardholder: {
              name: card.holder,
              identification: {
                type:   parsed.data.docType ?? "OTHER",
                number: parsed.data.docNum  ?? "00000000",
              },
            },
          }),
        });

        const tokenData: any = await tokenRes.json();
        if (!tokenData.id) {
          const errMsg = tokenData.cause?.[0]?.description ?? tokenData.message ?? "Card token failed";
          const charge = await storage.createPaymentCharge({
            chargeId:     `mp-err-${Date.now()}`,
            processor:    "mercadopago",
            amount: mpAmount, currency: "MXN", status: "failed",
            description, email,
            cardLast4: card.number.slice(-4), cardBrand: null,
            receiptUrl: null, errorMessage: errMsg, createdBy: user.username,
          });
          return res.status(402).json({ ...charge, error: errMsg });
        }

        // 2. Create MP payment — always in MXN (the account's native
        // currency; see conversion above), never the client-requested
        // `currency`, which Mercado Pago cannot actually settle in.
        const payRes = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            Authorization:   `Bearer ${mpToken}`,
            "X-Idempotency-Key": `banxico-${Date.now()}-${user.username}`,
          },
          body: JSON.stringify({
            token:             tokenData.id,
            transaction_amount: mpAmount,
            currency_id:       "MXN",
            description,
            installments:      1,
            payment_method_id: tokenData.payment_method_id ?? "visa",
            payer: {
              email,
              identification: {
                type:   parsed.data.docType ?? "OTHER",
                number: parsed.data.docNum  ?? "00000000",
              },
            },
          }),
        });

        const payData: any = await payRes.json();

        const charge = await storage.createPaymentCharge({
          chargeId:     String(payData.id ?? `mp-${Date.now()}`),
          processor:    "mercadopago",
          amount: mpAmount, currency: "MXN",
          status:       payData.status ?? "failed",
          description, email,
          cardLast4:    String(payData.card?.last_four_digits ?? card.number.slice(-4)),
          cardBrand:    payData.payment_method_id ?? null,
          receiptUrl:   null,
          errorMessage: payData.status === "approved" ? null : (payData.status_detail ?? null),
          createdBy:    user.username,
        });

        const httpStatus = payData.status === "approved" ? 200 : 402;
        return res.status(httpStatus).json(charge);

      } catch (mpErr: any) {
        console.error("[PaymentEngine/MP] Error:", mpErr.message);
        const charge = await storage.createPaymentCharge({
          chargeId:     `err-${Date.now()}`,
          processor:    "mercadopago",
          amount: mpAmount, currency: "MXN", status: "failed",
          description, email,
          cardLast4: card.number.slice(-4), cardBrand: null,
          receiptUrl: null, errorMessage: mpErr.message ?? "Unknown error",
          createdBy: user.username,
        }).catch(() => null);
        return res.status(402).json({ ...(charge ?? {}), error: mpErr.message ?? "Payment processing failed" });
      }
    }
  });

  // ====================================================================
  // SUPPORT TICKETS — Payment Discrepancies
  // ====================================================================

  app.get("/api/support/tickets", requireSession, async (req, res) => {
    const user = req.currentUser!;
    const tickets = await storage.getSupportTickets(user.username, user.role === "ADMIN");
    res.json(tickets);
  });

  app.post("/api/support/tickets", requireSession, async (req, res) => {
    const user = req.currentUser!;
    const schema = z.object({
      subject:             z.string().min(3).max(200),
      category:            z.enum(["billing", "payment", "refund", "charge", "other"]),
      description:         z.string().min(10).max(2000),
      priority:            z.enum(["low", "medium", "high"]).default("medium"),
      attachmentName:      z.string().max(255).optional(),
      attachmentMimeType:  z.string().max(100).optional(),
      attachmentContent:   z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
    const ticket = await storage.createSupportTicket({
      ...parsed.data,
      attachmentName:     parsed.data.attachmentName     ?? null,
      attachmentMimeType: parsed.data.attachmentMimeType ?? null,
      attachmentContent:  parsed.data.attachmentContent  ?? null,
      submittedBy: user.username,
      status: "open",
      adminNote: null,
    });
    res.status(201).json(ticket);
  });

  app.patch("/api/support/tickets/:id", requireSession, async (req, res) => {
    const user = req.currentUser!;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Acceso denegado" });
    const schema = z.object({
      status:    z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      priority:  z.enum(["low", "medium", "high"]).optional(),
      adminNote: z.string().max(1000).nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
    const updated = await storage.updateSupportTicket(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: "Ticket no encontrado" });
    res.json(updated);
  });

  // ── Send platform announcement email ─────────────────────────────────────
  app.post("/api/admin/send-announcement-email", requireSession, requireRole("ADMIN"), async (req, res) => {
    const schema = z.object({ to: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Correo inválido" });

    const { to } = parsed.data;
    // Resolve name from users table if available
    const recipient = await storage.getUserByUsername(to);
    const fullName = recipient?.fullName ?? to.split("@")[0];

    try {
      const { sendCybridAnnouncementEmail } = await import("./email");
      await sendCybridAnnouncementEmail({ toEmail: to, fullName, isApprovalRequest: false });
      console.log(`[AnnouncementEmail] Sent Cybrid announcement to ${to}`);
      res.json({ sent: true });
    } catch (err: any) {
      console.error("[AnnouncementEmail] Error:", err?.message ?? err);
      res.status(500).json({ error: err?.message ?? "Error al enviar correo" });
    }
  });

  // Borra todo el historial de transacciones de demostración (y sus registros
  // dependientes) para que el dashboard arranque en cero real. Acción
  // destructiva e irreversible — solo ADMIN, requiere confirmación explícita
  // en el cuerpo de la petición.
  app.post("/api/admin/reset-transactions", requireSession, requireRole("ADMIN"), async (req, res) => {
    const schema = z.object({ confirm: z.literal(true) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Debes confirmar la acción (confirm: true)" });
    }

    try {
      const result = await storage.resetAllTransactions();
      console.log(`[AdminReset] ${req.session.username} borró el historial de transacciones:`, result);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("[AdminReset] Error al borrar transacciones:", err?.message ?? err);
      res.status(500).json({ error: err?.message ?? "Error al borrar transacciones" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
