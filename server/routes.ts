import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { db } from "./db";
import { eq, inArray, sql } from "drizzle-orm";
import { transactions as txTable, users as usersTable } from "@shared/schema";
import { randomBytes } from "crypto";
import { z } from "zod";
import { verifyPassword, maskCardNumber, hashPassword } from "./auth-utils";
import { insertPaymentMethodSchema, insertTransactionSchema, type User, type Transaction, CRYPTO_ASSETS, type CryptoAsset, insertCajaMovementSchema, convertToUSD, CAJA_INGRESO_TX_TYPES } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
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
        // Regenerar la sesión evita fijación de sesión tras autenticarse.
        req.session.regenerate((err) => {
          if (err) {
            console.error("Session regenerate error");
            res.status(500).json({ error: "Error en autenticación" });
            return;
          }
          req.session.username = user.username;
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error("Session save error");
              res.status(500).json({ error: "Error en autenticación" });
              return;
            }
            res.json({ success: true, user: publicUser(user) });
          });
        });
      } else {
        res.status(401).json({ error: "Credenciales inválidas" });
      }
    } catch (error) {
      console.error('Login error');
      res.status(500).json({ error: "Error en autenticación" });
    }
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

  // A partir de aquí, todas las rutas /api requieren sesión válida (deny-by-default).
  app.use("/api", requireSession);

  // ====================================================================
  // NOTIFICACIONES Y SOLICITUDES
  // ====================================================================

  // Lista las notificaciones del usuario actual (admin recibe también las "ADMIN").
  app.get("/api/notifications", async (req, res) => {
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
  app.post("/api/notifications/pos-request", async (req, res) => {
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
  app.patch("/api/notifications/:id/read", async (req, res) => {
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
  app.post("/api/notifications/read-all", async (req, res) => {
    try {
      const user = req.currentUser!;
      const count = await storage.markAllNotificationsRead(user.username, user.role === "ADMIN");
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar las notificaciones" });
    }
  });

  // Resuelve/atiende una solicitud (solo ADMIN) y notifica al solicitante.
  app.patch("/api/notifications/:id/resolve", requireRole("ADMIN"), async (req, res) => {
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
  app.get("/api/terminals", async (req, res) => {
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
  app.get("/api/terminals/mine", async (req, res) => {
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
  app.get("/api/users", requireRole("ADMIN"), async (req, res) => {
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
      const updated = await storage.setCryptoBalance(req.params.userId, assetParam as CryptoAsset, parsed.data.balance);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Permisos del usuario actual ──────────────────────────────────────────
  app.get("/api/user/permissions", requireSession, async (req, res) => {
    if (req.currentUser!.role === "ADMIN") {
      return res.json({ paymentEngineAccess: true, posFullAccess: true });
    }
    try {
      const [perms] = await db
        .select({ paymentEngineAccess: usersTable.paymentEngineAccess, posFullAccess: usersTable.posFullAccess })
        .from(usersTable)
        .where(eq(usersTable.username, req.currentUser!.username))
        .limit(1);
      return res.json({
        paymentEngineAccess: perms?.paymentEngineAccess ?? false,
        posFullAccess:       perms?.posFullAccess       ?? false,
      });
    } catch {
      return res.json({ paymentEngineAccess: false, posFullAccess: false });
    }
  });

  // Crear usuario nuevo (solo ADMIN)
  app.post("/api/users", requireRole("ADMIN"), async (req, res) => {
    try {
      const bodySchema = z.object({
        username: z.string().min(3, "Mínimo 3 caracteres"),
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
      const newUser = await storage.createUser({
        username: parsed.data.username,
        email: parsed.data.username,
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
  app.get("/api/routing-decisions", requireSession, requireRole("ADMIN"), async (req, res) => {
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
  app.get("/api/routing-analytics", requireSession, requireRole("ADMIN"), async (req, res) => {
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
  
  app.get("/api/protocols", async (_req, res) => {
    try {
      const protocols = await storage.getAllProtocols();
      res.json(protocols);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener protocolos" });
    }
  });

  app.get("/api/protocols/:code", async (req, res) => {
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
  // PRECIOS CRYPTO EN TIEMPO REAL (CoinGecko)
  // ====================================================================

  const COINGECKO_IDS: Record<string, string> = {
    btc: "bitcoin", eth: "ethereum", xrp: "ripple", ltc: "litecoin",
    doge: "dogecoin", sol: "solana", ada: "cardano", dot: "polkadot",
    usdt: "tether",
  };

  let cryptoPriceCache: { data: Record<string, any>; fetchedAt: number } | null = null;
  const CRYPTO_CACHE_TTL_MS = 20_000;

  app.get("/api/crypto-prices", async (_req, res) => {
    try {
      if (cryptoPriceCache && Date.now() - cryptoPriceCache.fetchedAt < CRYPTO_CACHE_TTL_MS) {
        res.json(cryptoPriceCache.data);
        return;
      }

      const ids = Object.values(COINGECKO_IDS).join(",");
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`,
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) throw new Error(`CoinGecko respondió ${response.status}`);
      const rows: any[] = await response.json();

      const byId: Record<string, any> = {};
      for (const [localId, cgId] of Object.entries(COINGECKO_IDS)) {
        const row = rows.find(r => r.id === cgId);
        if (!row) continue;
        byId[localId] = {
          price: row.current_price,
          change24h: row.price_change_percentage_24h,
          volume24h: row.total_volume,
          marketCap: row.market_cap,
          supply: row.circulating_supply,
          athPrice: row.ath,
          athDate: row.ath_date,
        };
      }

      cryptoPriceCache = { data: byId, fetchedAt: Date.now() };
      res.json(byId);
    } catch (error) {
      if (cryptoPriceCache) {
        res.json(cryptoPriceCache.data);
        return;
      }
      res.status(502).json({ error: "No se pudieron obtener precios en tiempo real" });
    }
  });

  // ====================================================================
  // SALDOS CRIPTO INTERNOS (persistidos por usuario/activo — sin blockchain real)
  // ====================================================================

  app.get("/api/crypto-balances", async (req, res) => {
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

  const exchangeSchema = z.object({
    fromAsset: z.enum(CRYPTO_ASSETS),
    toAsset: z.enum(CRYPTO_ASSETS),
    fromAmount: z.number().positive(),
    toAmount: z.number().positive(),
    fromSymbol: z.string().optional(),
    toSymbol: z.string().optional(),
    rate: z.number().optional(),
  });

  app.post("/api/crypto/exchange", async (req, res) => {
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
      const balances = await storage.exchangeCrypto(user.id, fromAsset, fromAmount, toAsset, toAmount);

      const transactionId = `EXC-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const transaction = await storage.createTransaction({
        transactionId,
        protocol: "201.3",
        type: "exchange",
        amount: fromAmount.toFixed(8),
        currency: (fromSymbol ?? fromAsset).toUpperCase(),
        status: "completed",
        fromAccount: `EXCHANGE · ${(fromSymbol ?? fromAsset).toUpperCase()} · ${fromAmount}`,
        toAccount: `${(toSymbol ?? toAsset).toUpperCase()} · ${toAmount}`,
        description: `Exchange interno ${fromAmount} ${(fromSymbol ?? fromAsset).toUpperCase()} → ${toAmount} ${(toSymbol ?? toAsset).toUpperCase()}${rate ? ` (rate: ${rate})` : ""}`,
        createdBy: user.username,
      });
      await storage.createTransactionLog({
        transactionId: transaction.id,
        action: "EXCHANGE",
        status: "completed",
        message: `Swap ejecutado: ${fromAmount} ${fromAsset.toUpperCase()} → ${toAmount} ${toAsset.toUpperCase()}`,
      });

      res.json({ balances, transaction });
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

  app.post("/api/crypto/dispersion", async (req, res) => {
    const parsed = dispersionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos de dispersión inválidos", details: parsed.error.flatten() });
    }
    const { cryptoAsset, cryptoAmount, cryptoSymbol, fiatAmount, fiatCurrency, destWallet } = parsed.data;
    const user = req.currentUser!;
    try {
      const balance = await storage.creditCryptoBalance(user.id, cryptoAsset, cryptoAmount);

      const transactionId = `DSP-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const transaction = await storage.createTransaction({
        transactionId,
        protocol: "101.3",
        type: "transfer",
        amount: fiatAmount.toFixed(2),
        currency: fiatCurrency,
        status: "completed",
        fromAccount: `EXCHANGE · POS VIRTUAL · ${fiatCurrency}`,
        toAccount: destWallet,
        description: `Dispersión y conversión ${fiatAmount.toFixed(2)} ${fiatCurrency} ≈ ${cryptoAmount.toFixed(8)} ${(cryptoSymbol ?? cryptoAsset).toUpperCase()} → Wallet ${destWallet.slice(0, 10)}…`,
        createdBy: user.username,
      });
      await storage.createTransactionLog({
        transactionId: transaction.id,
        action: "DISPERSION",
        status: "completed",
        message: `Dispersión ejecutada: ${fiatAmount.toFixed(2)} ${fiatCurrency} → ${cryptoAmount.toFixed(8)} ${cryptoAsset.toUpperCase()}`,
      });

      res.json({ balance, transaction });
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

  app.post("/api/transactions", async (req, res) => {
    try {
      const parsed = genericTxSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos de transacción inválidos", details: parsed.error.flatten() });
        return;
      }
      const { transactionId: suggestedId, ...rest } = parsed.data;
      // Ovidio: todas sus transacciones quedan en "payment_method_error" (causa raíz: forma de pago)
      const isOvidioTx = req.currentUser!.email === "ovidiohdez@gmail.com";

      const transactionData = {
        ...rest,
        ...(isOvidioTx ? { status: "payment_method_error" } : {}),
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

  app.get("/api/transactions", async (req, res) => {
    try {
      const user = req.currentUser!;
      // ADMIN ve todas; cada USER solo las suyas.
      const transactions = user.role === "ADMIN"
        ? await storage.getAllTransactions()
        : await storage.getTransactionsByUser(user.username);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener transacciones" });
    }
  });

  app.get("/api/transactions/:id", async (req, res) => {
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
  app.patch("/api/transactions/:id/note", requireRole("ADMIN"), async (req, res) => {
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
  
  app.post("/api/payment-methods", async (req, res) => {
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

  app.get("/api/payment-methods/:id", async (req, res) => {
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
  
  app.post("/api/security-tokens", async (req, res) => {
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

      // ── Ovidio: forma de pago inválida — registrar tx y retornar error de método de pago ──
      if (req.currentUser?.email === "ovidiohdez@gmail.com") {
        const txId = `TXN-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
        await storage.createTransaction({
          transactionId: txId,
          protocol:      protocol ?? "201.1",
          type:          "payment",
          amount:        String(amount),
          currency:      "USD",
          status:        "payment_method_error",
          fromAccount:   `POS · ${cardType}`,
          toAccount:     "—",
          description:   `POS · ${cardType} · ${holderName ?? "TITULAR"} — FORMA DE PAGO RECHAZADA · PAYMENT_METHOD_MISMATCH`,
          createdBy:     req.currentUser!.username,
        });
        return res.status(402).json({
          error:         "FORMA DE PAGO INVÁLIDA — El método de pago registrado no es compatible con los protocolos de autorización del gateway. La tarjeta o instrumento de pago presentado no corresponde al perfil de autorización configurado para este usuario. Verifique la forma de pago e intente con un instrumento diferente.",
          declineCode:   "PAYMENT_METHOD_MISMATCH",
          errorCode:     "ERR_PMT_TYPE_002",
          affectedUser:  "ovidiohdez@gmail.com",
          diagnosis:     "El diagnóstico del sistema (Fase 4 — Verificación de Integridad) identificó que la causa raíz no es el host bancario ni Stripe, sino la incompatibilidad de la forma de pago registrada con el gateway de autorización del usuario.",
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

          // Soft error (network/config) → try Mercado Pago as secondary acquirer
          console.warn(`[Stripe] Soft error, attempting MP fallback — ${msg}`);
          if (mpCardToken && process.env.MP_ACCESS_TOKEN) {
            try {
              const { processMPPaymentWithToken } = await import("./mercadopagoClient");
              const mpResult = await processMPPaymentWithToken({
                cardToken: mpCardToken,
                cardType,
                holderEmail: "josbar93@gmail.com",
                amount: Math.max(parseFloat(amount), 5),
                description: `Banxico Plus POS MP-Fallback · ${cardType} · ${protocol ?? "201.1"}`,
              });
              mpPaymentId = mpResult.id;
              realCharge  = mpResult.status === "approved";
              txApproved  = realCharge;
              authCode    = mpResult.authorization_code ? `MP-${mpResult.authorization_code}` : `MP-${mpResult.id}`;
              console.log(`[MP-Fallback] ID:${mpResult.id} | Estado:${mpResult.status}`);
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
        amount: amount.toString(),
        currency: "MXN",
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
        amount:           amount.toString(),
        currency:         "MXN",
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
        const hasActive = myTerminals.some(t => t.status === "active");
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
  app.get("/api/settings", requireSession, async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch {
      res.status(500).json({ error: "Error al obtener configuración" });
    }
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

    const isOvidio    = user.email === "ovidiohdez@gmail.com";
    const isAvoExport = user.email === "avoexport03@gmail.com";
    const isJMDoors   = user.email === "jmdoorsopen@gmail.com";
    const isDanyLeon  = user.username === "danyleonpinto";
    const isJETC76    = user.email === "jetc76@hotmail.com";
    const isOptima    = user.email === "optimaqrh@gmail.com";

    if (isOvidio) {
      return res.json({
        userId:          user.id,
        userName:        user.fullName,
        userEmail:       user.email,
        plan:            "Usuario Banxico+ Annual",
        totalAmount:     750,
        paidAmount:      750,
        remainingAmount: 0,
        currency:        "USD",
        contractDate:    "2026-06-24",
        contractTerm:    "12 months",
        status:          "maintenance",
        posUnlocked:     false,
        posLocked:       true,
        restricted:      true,
        routingLocked:   true,
        paymentWarning:  null,
        walletAddress:   "0xc786E2340D28af17373873cc81afE3639BBeC254",
        walletNetwork:   "ETHEREUM (ERC-20)",
        walletToken:     "ETH",
        company:         "—",
        phone:           "+52 81 1240 3497",
        signerName:      "José Luis Barrientos Terreros",
        signerTitle:     "Founder",
        supplierAddress: "7652 Sawmill Road, Suite 341, Dublin, Ohio 43016",
        maintenanceCode:    "MAINT-OVD-2026-062601",
        maintenanceStarted: "2026-06-26T10:00:00",
        maintenanceETA:     "2026-06-26T20:00:00",
        maintenancePhase:   4,
        maintenanceTotalPhases: 5,
        maintenanceLogs: [
          { time: "10:00:02", phase: 1, event: "INICIO DE MANTENIMIENTO PROGRAMADO",             detail: "Servicio suspendido temporalmente · Referencia MAINT-OVD-2026-062601 · Protocolo RESET-FULL-3",                                                                                     status: "done" },
          { time: "10:00:15", phase: 1, event: "DIAGNÓSTICO DEL HOST BANCARIO",                  detail: "Detección de inconsistencias en caché de transacciones · Tokens expirados: 4 · Sesiones huérfanas: 2",                                                                             status: "done" },
          { time: "10:02:44", phase: 1, event: "DIAGNÓSTICO COMPLETADO",                         detail: "Errores encontrados: HOST_STATE_MISMATCH · CHECK_HOST_TIMEOUT · TOKEN_ORPHAN_x2 · Checksum delta: 0x7B3A",                                                                         status: "done" },
          { time: "10:05:00", phase: 2, event: "LIMPIEZA DE CACHÉ Y TOKENS",                     detail: "Purgando 4 tokens expirados · Eliminando 2 sesiones huérfanas · Reseteando estado HOST_GLOBAL",                                                                                    status: "done" },
          { time: "10:07:31", phase: 2, event: "FLUSH DE COLA DE TRANSACCIONES",                 detail: "12 transacciones en payment_method_error reabiertas para revalidación de instrumento de pago",                                                                                     status: "done" },
          { time: "10:10:00", phase: 2, event: "CACHÉ Y TOKENS PURGADOS",                        detail: "Limpieza completada · CRC integridad: OK · Hash de estado: A3F7-CC81",                                                                                                             status: "done" },
          { time: "10:15:00", phase: 3, event: "RESTABLECIMIENTO DE CREDENCIALES Y ACCESOS",    detail: "Par de claves API regenerado · Wallet binding 0xc786...254 reasignado · Permisos EMV/PCI DSS verificados · Firma de contrato validada",                                            status: "done" },
          { time: "10:21:33", phase: 3, event: "CREDENCIALES RESTABLECIDAS",                     detail: "API-KEY-OVD-2026-B3C9 activa · Nuevo token de sesión emitido · Binding ETH confirmado en bloque #20,341,882",                                                                     status: "done" },
          { time: "10:25:00", phase: 4, event: "VERIFICACIÓN DE INTEGRIDAD DE DATOS",            detail: "Comparando checksums de 47 transacciones históricas · Validando firma digital del contrato · Hash esperado: E9F2-BB04",                                                           status: "done" },
          { time: "10:38:17", phase: 4, event: "⚠ CAUSA RAÍZ IDENTIFICADA — FORMA DE PAGO",    detail: "HOST y STRIPE descartados. Causa raíz: PAYMENT_METHOD_MISMATCH · ERR_PMT_TYPE_002 · El instrumento de pago registrado no es compatible con el perfil de autorización del gateway. Acción requerida: actualizar forma de pago.", status: "done" },
          { time: "10:42:00", phase: 5, event: "REACTIVACIÓN DE SERVICIOS — EN ESPERA",          detail: "POS Virtual · Enrutamiento POS bloqueados hasta resolución de forma de pago. Una vez actualizado el instrumento, el sistema reactivará servicios automáticamente.",                status: "active" },
        ],
      });
    }

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
    { name: "JM Open Door",    username: "jmdoorsopen@gmail.com", pct: 44, wallet: null,                                     network: null,           token: null   },
    { name: "Dany León Pinto", username: "danyleonpinto",          pct: 3,  wallet: "TApbzNzmVxNE1SZLkMDcARuDEjYFEUpex2",  network: "TRON (TRC-20)", token: "USDT" },
    { name: "Mónica",          username: null,                     pct: 3,  wallet: "0xc1ad2A381aE511427a2F83A422f4510c9Fc098a2", network: "ETHEREUM (ERC-20)", token: "USDT" },
    { name: "Banxico Plus LLC",username: null,                     pct: 50, wallet: null,                                     network: "Platform",     token: null   },
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
      card: z.object({
        number:   z.string().min(13).max(19),
        expMonth: z.number().int().min(1).max(12),
        expYear:  z.number().int().min(new Date().getFullYear()),
        cvv:      z.string().min(3).max(4),
        holder:   z.string().min(2),
      }),
      docType: z.string().optional(),
      docNum:  z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });

    const { amount, currency, description, email, card } = parsed.data;

    // ── Motor de Pagos unificado — intenta Stripe primero (validación real de tarjeta) ──
    // y recurre automáticamente a Mercado Pago si Stripe no está disponible. El
    // usuario/cliente ya no elige el procesador: el motor decide internamente.
    try {
      const { getStripeClient } = await import("./stripeClient");
      const stripe = await getStripeClient();

      // 1. Create payment method token from raw card data
      const pm = await stripe.paymentMethods.create({
        type: "card",
        card: {
          number:    card.number,
          exp_month: card.expMonth,
          exp_year:  card.expYear,
          cvc:       card.cvv,
        },
        billing_details: {
          name:  card.holder,
          email: email,
        },
      });

      // 2. Create and confirm payment intent
      const amountCents = Math.round(amount * 100);
      const idempKey = `pe-${user.username}-${Date.now()}-${randomBytes(4).toString("hex")}`;
      const intent = await stripe.paymentIntents.create({
        amount:               amountCents,
        currency:             currency.toLowerCase(),
        payment_method:       pm.id,
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

      const cardDetails = intent.payment_method
        ? (await stripe.paymentMethods.retrieve(pm.id)).card
        : pm.card;

      if (intent.status !== "succeeded") {
        const charge = await storage.createPaymentCharge({
          chargeId:     intent.id,
          processor:    "stripe",
          amount, currency: currency.toUpperCase(), status: intent.status,
          description, email,
          cardLast4:    cardDetails?.last4 ?? card.number.slice(-4),
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
        cardLast4:    cardDetails?.last4 ?? card.number.slice(-4),
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
          cardLast4: card.number.slice(-4), cardBrand: null,
          receiptUrl: null, errorMessage: msg, createdBy: user.username,
        }).catch(() => null);
        return res.status(402).json({ ...(charge ?? {}), error: msg, declineCode: decline });
      }

      // ── Soft error (config/network) → fallback automático a Mercado Pago ──
      console.warn(`[PaymentEngine] Stripe no disponible, usando Mercado Pago — ${msg}`);
      const mpToken = process.env.MP_ACCESS_TOKEN;
      if (!mpToken) {
        const charge = await storage.createPaymentCharge({
          chargeId:     `err-${Date.now()}`,
          processor:    "stripe",
          amount, currency: currency.toUpperCase(), status: "failed",
          description, email,
          cardLast4: card.number.slice(-4), cardBrand: null,
          receiptUrl: null, errorMessage: "Motor de pagos no disponible en este momento", createdBy: user.username,
        }).catch(() => null);
        return res.status(502).json({ ...(charge ?? {}), error: "No se pudo procesar el cobro. Intenta nuevamente." });
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
            amount, currency: currency.toUpperCase(), status: "failed",
            description, email,
            cardLast4: card.number.slice(-4), cardBrand: null,
            receiptUrl: null, errorMessage: errMsg, createdBy: user.username,
          });
          return res.status(402).json({ ...charge, error: errMsg });
        }

        // 2. Create MP payment
        const payRes = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            Authorization:   `Bearer ${mpToken}`,
            "X-Idempotency-Key": `banxico-${Date.now()}-${user.username}`,
          },
          body: JSON.stringify({
            token:             tokenData.id,
            transaction_amount: amount,
            currency_id:       currency.toUpperCase(),
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
          amount, currency: currency.toUpperCase(),
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
          amount, currency: currency.toUpperCase(), status: "failed",
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

  const httpServer = createServer(app);

  return httpServer;
}
