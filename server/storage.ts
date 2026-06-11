import { 
  type User, type InsertUser,
  type Transaction, type InsertTransaction,
  type PaymentMethod, type InsertPaymentMethod,
  type SecurityToken, type InsertSecurityToken,
  type TransactionLog, type InsertTransactionLog,
  type BankingProtocol, type InsertBankingProtocol,
  type Notification, type InsertNotification
} from "@shared/schema";
import { randomUUID } from "crypto";
import { hashPassword, maskCardNumber } from "./auth-utils";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Transactions
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionsByUser(username: string): Promise<Transaction[]>;
  updateTransactionStatus(id: string, status: string, authCode?: string): Promise<Transaction | undefined>;
  
  // Payment Methods
  createPaymentMethod(payment: InsertPaymentMethod): Promise<PaymentMethod>;
  getPaymentMethod(id: string): Promise<PaymentMethod | undefined>;
  
  // Security Tokens
  createSecurityToken(token: InsertSecurityToken): Promise<SecurityToken>;
  getSecurityToken(tokenId: string): Promise<SecurityToken | undefined>;
  
  // Transaction Logs
  createTransactionLog(log: InsertTransactionLog): Promise<TransactionLog>;
  getTransactionLogs(transactionId: string): Promise<TransactionLog[]>;
  
  // Banking Protocols
  getAllProtocols(): Promise<BankingProtocol[]>;
  getProtocol(code: string): Promise<BankingProtocol | undefined>;

  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsForUser(username: string, isAdmin: boolean): Promise<Notification[]>;
  getNotification(id: string): Promise<Notification | undefined>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(username: string, isAdmin: boolean): Promise<number>;
  resolveNotification(id: string): Promise<Notification | undefined>;
  hasPendingPosRequest(fromUser: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private transactions: Map<string, Transaction>;
  private paymentMethods: Map<string, PaymentMethod>;
  private securityTokens: Map<string, SecurityToken>;
  private transactionLogs: Map<string, TransactionLog[]>;
  private protocols: Map<string, BankingProtocol>;
  private notifications: Map<string, Notification>;

  constructor() {
    this.users = new Map();
    this.transactions = new Map();
    this.paymentMethods = new Map();
    this.securityTokens = new Map();
    this.transactionLogs = new Map();
    this.protocols = new Map();
    this.notifications = new Map();
    
    this.initializeProtocols();
    this.initializeAdminUser();
    this.seedTransactions();
    this.seedNotifications();
  }

  private initializeProtocols() {
    const protocols: BankingProtocol[] = [
      { id: "p1", code: "101.1", name: "Transferencia básica", description: "Transferencia entre cuentas sin validación adicional", category: "transfer", requiresSecurity: false },
      { id: "p2", code: "101.2", name: "Transferencia con validación", description: "Transferencia con verificación de datos", category: "transfer", requiresSecurity: true },
      { id: "p3", code: "101.3", name: "Transferencia segura", description: "Transferencia con máxima seguridad", category: "transfer", requiresSecurity: true },
      { id: "p4", code: "201.1", name: "Pago nacional", description: "Procesamiento de pago dentro del país", category: "payment", requiresSecurity: true },
      { id: "p5", code: "201.2", name: "Pago internacional", description: "Procesamiento de pago internacional", category: "payment", requiresSecurity: true },
      { id: "p6", code: "201.3", name: "Pago express", description: "Pago con procesamiento acelerado", category: "payment", requiresSecurity: true },
      { id: "p7", code: "301.1", name: "Depósito cuenta", description: "Depósito directo a cuenta bancaria", category: "deposit", requiresSecurity: false },
      { id: "p8", code: "301.2", name: "Depósito efectivo", description: "Depósito en efectivo", category: "deposit", requiresSecurity: false },
      { id: "p9", code: "401.1", name: "Retiro ATM", description: "Retiro en cajero automático", category: "withdrawal", requiresSecurity: true },
    ];
    protocols.forEach(p => this.protocols.set(p.code, p));
  }

  private initializeAdminUser() {
    const seedUsers: Array<Omit<User, "id" | "password"> & { password: string }> = [
      {
        username: "Admin",
        email: "joseluis.barrientos@banxicoplus.com",
        password: "Keylog100$",
        fullName: "José Luis Barrientos",
        role: "ADMIN",
        position: "Software Engineer",
        avatar: null,
        subscriptionStart: null,
      },
      {
        username: "angoestradacontacto@gmail.com",
        email: "angoestradacontacto@gmail.com",
        password: "Keylog200$",
        fullName: "Ángel Estrada",
        role: "USER",
        position: "Usuario",
        avatar: null,
        subscriptionStart: new Date("2026-03-09T00:00:00Z"),
      },
      {
        username: "socemro2@gmail.com",
        email: "socemro2@gmail.com",
        password: "Keylog100$",
        fullName: "Socemro",
        role: "USER",
        position: "Usuario",
        avatar: null,
        // Suscripción iniciada "ayer" → plan de 12 meses, 364 días restantes
        subscriptionStart: new Date("2026-06-08T00:00:00Z"),
      },
      {
        username: "corp.arevalo.asociados@gmail.com",
        email: "corp.arevalo.asociados@gmail.com",
        password: "Keylog100$",
        fullName: "Corporativo Arévalo y Asociados",
        role: "USER",
        position: "Usuario",
        avatar: null,
        subscriptionStart: new Date("2026-06-11T00:00:00Z"),
      },
    ];

    for (const seed of seedUsers) {
      const id = randomUUID();
      this.users.set(id, { ...seed, id, password: hashPassword(seed.password) });
    }
    console.log(`Storage initialized with ${this.users.size} users`);
  }

  // Siembra transacciones demo por usuario para que el scoping sea visible.
  private seedTransactions() {
    const now = Date.now();
    const seeds: Array<{
      owner: string; type: string; protocol: string; amount: string;
      currency: string; status: string; description: string; minsAgo: number;
    }> = [
      // Admin — José Luis Barrientos
      { owner: "Admin", type: "transfer", protocol: "101.3", amount: "680000.00", currency: "USD", status: "completed", description: "Transferencia segura interbancaria", minsAgo: 4 },
      { owner: "Admin", type: "payment", protocol: "201.2", amount: "1200000.00", currency: "USD", status: "completed", description: "Pago con AMEX - ****3007", minsAgo: 12 },
      { owner: "Admin", type: "withdrawal", protocol: "401.1", amount: "75000.00", currency: "USD", status: "completed", description: "Retiro ATM corporativo", minsAgo: 38 },
      // Ángel Estrada
      { owner: "angoestradacontacto@gmail.com", type: "payment", protocol: "201.1", amount: "5420.00", currency: "USD", status: "completed", description: "Pago con VISA - ****8821", minsAgo: 7 },
      { owner: "angoestradacontacto@gmail.com", type: "transfer", protocol: "101.2", amount: "2100.00", currency: "USD", status: "completed", description: "Transferencia con validación", minsAgo: 21 },
      { owner: "angoestradacontacto@gmail.com", type: "payment", protocol: "201.3", amount: "890.00", currency: "MXN", status: "processing", description: "Pago con Mastercard - ****4459", minsAgo: 33 },
      { owner: "angoestradacontacto@gmail.com", type: "deposit", protocol: "301.1", amount: "12500.00", currency: "USD", status: "pending", description: "Depósito a cuenta", minsAgo: 55 },
      // Socemro — sin terminal POS asignada y sin transacciones registradas
    ];

    seeds.forEach((s, i) => {
      const id = randomUUID();
      const tx: Transaction = {
        id,
        transactionId: `TXN-${10000 + i}`,
        protocol: s.protocol,
        type: s.type,
        amount: s.amount,
        currency: s.currency,
        status: s.status,
        fromAccount: null,
        toAccount: null,
        description: s.description,
        authCode: s.status === "completed" ? `AUTH-${100000 + i}` : null,
        tokenId: null,
        createdBy: s.owner,
        createdAt: new Date(now - s.minsAgo * 60000),
      };
      this.transactions.set(id, tx);
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: insertUser.username,
      email: insertUser.email,
      password: hashPassword(insertUser.password),
      fullName: insertUser.fullName,
      role: insertUser.role || "USER",
      position: insertUser.position || null,
      avatar: insertUser.avatar || null,
      subscriptionStart: insertUser.subscriptionStart ?? null
    };
    this.users.set(id, user);
    return user;
  }

  // Transactions
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      id,
      transactionId: insertTransaction.transactionId,
      protocol: insertTransaction.protocol,
      type: insertTransaction.type,
      amount: insertTransaction.amount,
      currency: insertTransaction.currency || "USD",
      status: insertTransaction.status || "pending",
      fromAccount: insertTransaction.fromAccount || null,
      toAccount: insertTransaction.toAccount || null,
      description: insertTransaction.description || null,
      authCode: insertTransaction.authCode || null,
      tokenId: insertTransaction.tokenId || null,
      createdBy: insertTransaction.createdBy || null,
      createdAt: new Date()
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getTransactionsByUser(username: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter((t) => t.createdBy === username)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateTransactionStatus(id: string, status: string, authCode?: string): Promise<Transaction | undefined> {
    const transaction = this.transactions.get(id);
    if (!transaction) return undefined;
    
    const updated = { ...transaction, status, authCode: authCode || transaction.authCode };
    this.transactions.set(id, updated);
    return updated;
  }

  // Payment Methods
  async createPaymentMethod(insertPayment: InsertPaymentMethod): Promise<PaymentMethod> {
    const id = randomUUID();
    const payment: PaymentMethod = {
      id,
      transactionId: insertPayment.transactionId,
      cardType: insertPayment.cardType,
      cardNumber: maskCardNumber(insertPayment.cardNumber),
      // PCI DSS: CVV y PIN nunca se almacenan en persistencia
      cvv: null,
      pin: null,
      holderName: insertPayment.holderName,
      expiryDate: insertPayment.expiryDate,
      verified: insertPayment.verified || null
    };
    this.paymentMethods.set(id, payment);
    return payment;
  }

  async getPaymentMethod(id: string): Promise<PaymentMethod | undefined> {
    return this.paymentMethods.get(id);
  }

  // Security Tokens
  async createSecurityToken(insertToken: InsertSecurityToken): Promise<SecurityToken> {
    const id = randomUUID();
    const token: SecurityToken = {
      id,
      tokenId: insertToken.tokenId,
      transactionId: insertToken.transactionId,
      algorithm: insertToken.algorithm || "AES-256",
      hash: insertToken.hash,
      emvCompliant: insertToken.emvCompliant !== undefined ? insertToken.emvCompliant : true,
      pciCompliant: insertToken.pciCompliant !== undefined ? insertToken.pciCompliant : true,
      issuedAt: new Date(),
      expiresAt: insertToken.expiresAt
    };
    this.securityTokens.set(insertToken.tokenId, token);
    return token;
  }

  async getSecurityToken(tokenId: string): Promise<SecurityToken | undefined> {
    return this.securityTokens.get(tokenId);
  }

  // Transaction Logs
  async createTransactionLog(insertLog: InsertTransactionLog): Promise<TransactionLog> {
    const id = randomUUID();
    const log: TransactionLog = {
      id,
      transactionId: insertLog.transactionId,
      action: insertLog.action,
      status: insertLog.status,
      message: insertLog.message || null,
      timestamp: new Date()
    };
    
    const logs = this.transactionLogs.get(insertLog.transactionId) || [];
    logs.push(log);
    this.transactionLogs.set(insertLog.transactionId, logs);
    
    return log;
  }

  async getTransactionLogs(transactionId: string): Promise<TransactionLog[]> {
    return this.transactionLogs.get(transactionId) || [];
  }

  // Banking Protocols
  async getAllProtocols(): Promise<BankingProtocol[]> {
    return Array.from(this.protocols.values());
  }

  async getProtocol(code: string): Promise<BankingProtocol | undefined> {
    return this.protocols.get(code);
  }

  // Notifications
  private seedNotifications() {
    const now = Date.now();
    const seeds: Array<Omit<Notification, "id" | "createdAt"> & { minsAgo: number }> = [
      {
        recipient: "ADMIN", type: "system", title: "Panel de administración activo",
        message: "Bienvenido. Aquí verás las solicitudes y notificaciones de todos los usuarios.",
        fromUser: null, status: "info", read: false, minsAgo: 120,
      },
      {
        recipient: "ADMIN", type: "pos_request", title: "Solicitud de configuración de POS",
        message: "Socemro (socemro2@gmail.com) no tiene una terminal activa y solicita la configuración (deploy) de un nuevo POS.",
        fromUser: "socemro2@gmail.com", status: "pending", read: false, minsAgo: 30,
      },
      {
        recipient: "socemro2@gmail.com", type: "info", title: "Suscripción activa",
        message: "Tu suscripción de 12 meses está activa. Contacta al administrador para configurar tu terminal POS.",
        fromUser: null, status: "info", read: false, minsAgo: 60,
      },
      {
        recipient: "angoestradacontacto@gmail.com", type: "info", title: "Terminal en línea",
        message: "Tu terminal T1005 (Ingenico iWL250) está operativa y lista para procesar pagos.",
        fromUser: null, status: "info", read: false, minsAgo: 15,
      },
    ];

    seeds.forEach((s) => {
      const id = randomUUID();
      const { minsAgo, ...rest } = s;
      this.notifications.set(id, { ...rest, id, createdAt: new Date(now - minsAgo * 60000) });
    });
  }

  async createNotification(insert: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = {
      id,
      recipient: insert.recipient,
      type: insert.type,
      title: insert.title,
      message: insert.message,
      fromUser: insert.fromUser ?? null,
      status: insert.status || "info",
      read: insert.read ?? false,
      createdAt: new Date(),
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async getNotificationsForUser(username: string, isAdmin: boolean): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter((n) => n.recipient === username || (isAdmin && n.recipient === "ADMIN"))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const n = this.notifications.get(id);
    if (!n) return undefined;
    const updated = { ...n, read: true };
    this.notifications.set(id, updated);
    return updated;
  }

  async markAllNotificationsRead(username: string, isAdmin: boolean): Promise<number> {
    let count = 0;
    for (const [id, n] of Array.from(this.notifications.entries())) {
      if ((n.recipient === username || (isAdmin && n.recipient === "ADMIN")) && !n.read) {
        this.notifications.set(id, { ...n, read: true });
        count++;
      }
    }
    return count;
  }

  async resolveNotification(id: string): Promise<Notification | undefined> {
    const n = this.notifications.get(id);
    if (!n) return undefined;
    const updated = { ...n, status: "resolved", read: true };
    this.notifications.set(id, updated);
    return updated;
  }

  async hasPendingPosRequest(fromUser: string): Promise<boolean> {
    return Array.from(this.notifications.values()).some(
      (n) => n.type === "pos_request" && n.fromUser === fromUser && n.status === "pending",
    );
  }
}

export const storage = new MemStorage();
