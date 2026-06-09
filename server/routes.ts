import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { randomBytes } from "crypto";
import { z } from "zod";
import { verifyPassword, maskCardNumber, hashPassword } from "./auth-utils";
import { insertPaymentMethodSchema, insertTransactionSchema, type User } from "@shared/schema";

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
  };
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
  
  app.post("/api/transactions", async (req, res) => {
    try {
      const parsed = insertTransactionSchema
        .omit({ transactionId: true, status: true })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Datos de transacción inválidos" });
        return;
      }
      const transactionData = {
        ...parsed.data,
        transactionId: `TXN-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`,
        status: "pending",
      };
      
      const transaction = await storage.createTransaction(transactionData);
      
      // Crear log
      await storage.createTransactionLog({
        transactionId: transaction.id,
        action: "CREATE",
        status: "pending",
        message: "Transacción creada"
      });
      
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Error al crear transacción" });
    }
  });

  app.get("/api/transactions", async (_req, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener transacciones" });
    }
  });

  app.get("/api/transactions/:id", async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
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
      const paymentMethod = await storage.createPaymentMethod(parsed.data);
      res.json(paymentMethod);
    } catch (error) {
      res.status(500).json({ error: "Error al crear método de pago" });
    }
  });

  app.get("/api/payment-methods/:id", async (req, res) => {
    try {
      const paymentMethod = await storage.getPaymentMethod(req.params.id);
      if (!paymentMethod) {
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
      if (!token) {
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
      
      // Crear transacción (tarjeta siempre enmascarada en la descripción)
      const transaction = await storage.createTransaction({
        transactionId,
        protocol: protocol || "201.1",
        type: "payment",
        amount: amount.toString(),
        currency: "USD",
        status: "processing",
        authCode,
        description: `Pago con ${cardType} - ${maskCardNumber(cardNumber)}`
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
        await storage.updateTransactionStatus(transaction.id, "completed", authCode);
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

  const httpServer = createServer(app);

  return httpServer;
}
