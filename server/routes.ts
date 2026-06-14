import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { randomBytes } from "crypto";
import { z } from "zod";
import { verifyPassword, maskCardNumber, hashPassword } from "./auth-utils";
import { insertPaymentMethodSchema, insertTransactionSchema, type User, type Transaction } from "@shared/schema";

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
  cvv: z.string().max(4).optional(),
  pin: z.string().max(8).optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  
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

      const user = await storage.getUserByUsername(username);

      // Siempre se ejecuta una verificación para igualar tiempos de respuesta.
      const isValid = verifyPassword(password, user ? user.password : DUMMY_HASH);

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
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos inválidos", details: parsed.error.issues });
        return;
      }
      const { ownerUsername, model, location, emv, nfc, pinpad } = parsed.data;

      const targetUser = await storage.getUserByUsername(ownerUsername);
      if (!targetUser) {
        res.status(404).json({ error: "Usuario no encontrado" });
        return;
      }

      const terminal = await storage.createTerminal({ model, location, owner: ownerUsername, emv, nfc, pinpad });

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
  
  app.post("/api/pos/process-payment", paymentLimiter, async (req, res) => {
    try {
      const parsed = posPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos de pago inválidos" });
        return;
      }
      const { cardType, cardNumber, amount, protocol, holderName, expiryDate } = parsed.data;
      
      // Simular procesamiento de pago
      const authCode = `AUTH-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const transactionId = `TXN-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      
      const op = req.currentUser!;
      // Crear transacción (tarjeta siempre enmascarada en la descripción)
      const transaction = await storage.createTransaction({
        transactionId,
        protocol: protocol || "201.1",
        type: "payment",
        amount: amount.toString(),
        currency: "USD",
        status: "processing",
        authCode,
        fromAccount: `${(holderName || "TITULAR").toUpperCase()} · ${cardType.toUpperCase()} · ${maskCardNumber(cardNumber)}`,
        toAccount:   `${op.fullName.toUpperCase()} · ${op.username} · TERMINAL POS`,
        description: `Pago con ${cardType} - ${maskCardNumber(cardNumber)}`,
        createdBy: op.username,
      });
      
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
      
      // Simular aprobación
      setTimeout(async () => {
        try {
          await storage.updateTransactionStatus(transaction.id, "completed", authCode);
        } catch (err) {
          console.error("Error al completar transacción POS:", err);
        }
      }, 2000);
      
      res.json({
        success: true,
        transaction,
        authCode,
        tokenId,
        status: "processing",
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

  const httpServer = createServer(app);

  return httpServer;
}
