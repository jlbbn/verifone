import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomBytes } from "crypto";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ====================================================================
  // AUTENTICACIÓN
  // ====================================================================
  
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (username === "Admin" && password === "Keylog100$") {
        const user = await storage.getUserByUsername(username);
        if (user) {
          res.json({ success: true, user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role } });
        } else {
          res.status(401).json({ error: "Credenciales inválidas" });
        }
      } else {
        res.status(401).json({ error: "Credenciales inválidas" });
      }
    } catch (error) {
      res.status(500).json({ error: "Error en autenticación" });
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
  
  app.post("/api/transactions", async (req, res) => {
    try {
      const transactionData = {
        ...req.body,
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

  app.patch("/api/transactions/:id/status", async (req, res) => {
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
      const paymentMethod = await storage.createPaymentMethod(req.body);
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
  
  app.post("/api/pos/process-payment", async (req, res) => {
    try {
      const { cardType, cardNumber, amount, protocol } = req.body;
      
      // Simular procesamiento de pago
      const authCode = `AUTH-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const transactionId = `TXN-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      
      // Crear transacción
      const transaction = await storage.createTransaction({
        transactionId,
        protocol: protocol || "201.1",
        type: "payment",
        amount: amount.toString(),
        currency: "USD",
        status: "processing",
        authCode,
        description: `Pago con ${cardType} - ${cardNumber}`
      });
      
      // Crear método de pago
      await storage.createPaymentMethod({
        transactionId: transaction.id,
        cardType,
        cardNumber,
        holderName: req.body.holderName || "Titular",
        expiryDate: req.body.expiryDate || "12/25",
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
