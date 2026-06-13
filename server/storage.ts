import { db } from "./db";
import { eq, and, or, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { hashPassword, maskCardNumber } from "./auth-utils";
import {
  users,
  transactions as txTable,
  paymentMethods,
  securityTokens,
  transactionLogs,
  bankingProtocols,
  notifications,
  posTerminals,
  type User, type InsertUser,
  type Transaction, type InsertTransaction,
  type PaymentMethod, type InsertPaymentMethod,
  type SecurityToken, type InsertSecurityToken,
  type TransactionLog, type InsertTransactionLog,
  type BankingProtocol, type InsertBankingProtocol,
  type Notification, type InsertNotification,
  type PosTerminal, type InsertPosTerminal,
  type SystemSettings, DEFAULT_SYSTEM_SETTINGS,
} from "@shared/schema";

// In-memory system settings (shared across all sessions, resets on restart)
let _systemSettings: SystemSettings = JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS));

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
  resolvePendingPosRequest(fromUser: string): Promise<Notification | undefined>;

  // POS Terminals
  getAllTerminals(): Promise<PosTerminal[]>;
  getTerminalsByOwner(username: string): Promise<PosTerminal[]>;
  createTerminal(data: InsertPosTerminal): Promise<PosTerminal>;
  updateTerminal(id: string, data: Partial<{ location: string; status: string; configNote: string | null; systemMessage: string | null; model: string; owner: string | null; amount: number }>): Promise<PosTerminal | undefined>;

  // Users (admin)
  getAllUsers(): Promise<User[]>;

  // System Settings
  getSettings(): Promise<SystemSettings>;
  updateSettings(patch: Partial<SystemSettings>): Promise<SystemSettings>;
}

export class DatabaseStorage implements IStorage {

  async initialize() {
    // --- Seed users (idempotente: ignora conflictos por username) ---
    const seedUsers = [
      {
        username: "Admin",
        email: "joseluis.barrientos@banxicoplus.com",
        password: hashPassword("Keylog100$"),
        fullName: "José Luis Barrientos",
        role: "ADMIN",
        position: "Software Engineer",
        avatar: null,
        subscriptionStart: null,
      },
      {
        username: "angoestradacontacto@gmail.com",
        email: "angoestradacontacto@gmail.com",
        password: hashPassword("Keylog200$"),
        fullName: "Ángel Estrada",
        role: "USER",
        position: "Usuario",
        avatar: null,
        subscriptionStart: new Date("2026-03-09T00:00:00Z"),
      },
      {
        username: "socemro2@gmail.com",
        email: "socemro2@gmail.com",
        password: hashPassword("Keylog100$"),
        fullName: "Socemro",
        role: "USER",
        position: "Usuario",
        avatar: null,
        subscriptionStart: new Date("2026-06-08T00:00:00Z"),
      },
      {
        username: "corp.arevalo.asociados@gmail.com",
        email: "corp.arevalo.asociados@gmail.com",
        password: hashPassword("Keylog100$"),
        fullName: "Corporativo Arévalo y Asociados",
        role: "USER",
        position: "Usuario",
        avatar: null,
        subscriptionStart: new Date("2026-06-11T00:00:00Z"),
      },
      {
        username: "patricioarroyo510@gmail.com",
        email: "patricioarroyo510@gmail.com",
        password: hashPassword("Keylog100$"),
        fullName: "Patricio Arroyo",
        role: "USER",
        position: "Usuario",
        avatar: null,
        subscriptionStart: new Date("2026-06-13T00:00:00Z"),
      },
    ];

    for (const u of seedUsers) {
      await db.insert(users).values(u).onConflictDoNothing({ target: users.username });
    }

    // --- Seed protocolos bancarios (idempotente por code) ---
    const seedProtocols: BankingProtocol[] = [
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

    for (const p of seedProtocols) {
      await db.insert(bankingProtocols).values(p).onConflictDoNothing({ target: bankingProtocols.code });
    }

    // --- Seed terminales POS base (idempotente por terminalId) ---
    const seedTerminals = [
      { terminalId: "T1001", model: "Verifone VX 690", serial: "VFN-VX690-A4821", status: "Online", transactions: 542, amount: 2304567.89, efficiency: 98, location: "Sucursal Centro", uptime: "99.8%", lastTx: "Hace 12 seg", firmware: "v3.4.1", ip: "192.168.1.101", signalStrength: 95, emv: true, nfc: true, pinpad: true, owner: null, configNote: null },
      { terminalId: "T1002", model: "Ingenico iCT220", serial: "ING-ICT220-B3341", status: "Online", transactions: 321, amount: 1850234.50, efficiency: 95, location: "Sucursal Norte", uptime: "99.5%", lastTx: "Hace 28 seg", firmware: "v2.8.3", ip: "192.168.1.102", signalStrength: 88, emv: true, nfc: false, pinpad: true, owner: null, configNote: null },
      { terminalId: "T1003", model: "PAX S920", serial: "PAX-S920-C1198", status: "Offline", transactions: 198, amount: 674305.00, efficiency: 82, location: "Sucursal Sur", uptime: "87.2%", lastTx: "Hace 2 hrs", firmware: "v1.9.7", ip: "192.168.1.103", signalStrength: 0, emv: true, nfc: false, pinpad: true, owner: null, configNote: null },
      { terminalId: "T1004", model: "Verifone VX 520", serial: "VFN-VX520-D2276", status: "Online", transactions: 456, amount: 3186003.20, efficiency: 96, location: "Sucursal Oeste", uptime: "99.6%", lastTx: "Hace 5 seg", firmware: "v4.1.0", ip: "192.168.1.104", signalStrength: 99, emv: true, nfc: true, pinpad: true, owner: null, configNote: null },
      { terminalId: "T1005", model: "Ingenico iWL250", serial: "ING-IWL250-E5503", status: "Online", transactions: 330, amount: 1953806.75, efficiency: 94, location: "Sucursal Este", uptime: "99.3%", lastTx: "Hace 45 seg", firmware: "v3.0.2", ip: "192.168.1.105", signalStrength: 72, emv: true, nfc: true, pinpad: true, owner: "angoestradacontacto@gmail.com", configNote: null },
      { terminalId: "T1006", model: "Verifone V660p", serial: "VFN-V660P-2024-001", status: "Reconfigured", transactions: 0, amount: 0, efficiency: 100, location: "Nueva Terminal", uptime: "100%", lastTx: "Sin transacciones", firmware: "v5.0.1-LATEST", ip: "192.168.1.106", signalStrength: 100, emv: true, nfc: true, pinpad: true, owner: null, configNote: "Re-configurada — Lista para Operar" },
    ];

    for (const t of seedTerminals) {
      await db.insert(posTerminals).values(t).onConflictDoNothing({ target: posTerminals.terminalId });
    }

    // --- Seed notificaciones (sólo si la tabla está vacía) ---
    const existingNotifs = await db.select({ id: notifications.id }).from(notifications).limit(1);
    if (existingNotifs.length === 0) {
      const now = Date.now();
      const seedNotifs = [
        {
          recipient: "ADMIN", type: "system", title: "Panel de administración activo",
          message: "Bienvenido. Aquí verás las solicitudes y notificaciones de todos los usuarios.",
          fromUser: null, status: "info", read: false,
          createdAt: new Date(now - 120 * 60000),
        },
        {
          recipient: "ADMIN", type: "pos_request", title: "Solicitud de configuración de POS",
          message: "Socemro (socemro2@gmail.com) no tiene una terminal activa y solicita la configuración (deploy) de un nuevo POS.",
          fromUser: "socemro2@gmail.com", status: "pending", read: false,
          createdAt: new Date(now - 30 * 60000),
        },
        {
          recipient: "socemro2@gmail.com", type: "info", title: "Suscripción activa",
          message: "Tu suscripción de 12 meses está activa. Contacta al administrador para configurar tu terminal POS.",
          fromUser: null, status: "info", read: false,
          createdAt: new Date(now - 60 * 60000),
        },
        {
          recipient: "angoestradacontacto@gmail.com", type: "info", title: "Terminal en línea",
          message: "Tu terminal T1005 (Ingenico iWL250) está operativa y lista para procesar pagos.",
          fromUser: null, status: "info", read: false,
          createdAt: new Date(now - 15 * 60000),
        },
      ];
      await db.insert(notifications).values(seedNotifs);
    }

    // --- Seed transacciones demo (sólo si la tabla está vacía) ---
    const existingTx = await db.select({ id: txTable.id }).from(txTable).limit(1);
    if (existingTx.length === 0) {
      const now = Date.now();
      const seeds = [
        { owner: "Admin", type: "transfer", protocol: "101.3", amount: "680000.00", currency: "USD", status: "completed", description: "Transferencia segura interbancaria", minsAgo: 4 },
        { owner: "Admin", type: "payment", protocol: "201.2", amount: "1200000.00", currency: "USD", status: "completed", description: "Pago con AMEX - ****3007", minsAgo: 12 },
        { owner: "Admin", type: "withdrawal", protocol: "401.1", amount: "75000.00", currency: "USD", status: "completed", description: "Retiro ATM corporativo", minsAgo: 38 },
        { owner: "angoestradacontacto@gmail.com", type: "payment", protocol: "201.1", amount: "5420.00", currency: "USD", status: "completed", description: "Pago con VISA - ****8821", minsAgo: 7 },
        { owner: "angoestradacontacto@gmail.com", type: "transfer", protocol: "101.2", amount: "2100.00", currency: "USD", status: "completed", description: "Transferencia con validación", minsAgo: 21 },
        { owner: "angoestradacontacto@gmail.com", type: "payment", protocol: "201.3", amount: "890.00", currency: "MXN", status: "processing", description: "Pago con Mastercard - ****4459", minsAgo: 33 },
        { owner: "angoestradacontacto@gmail.com", type: "deposit", protocol: "301.1", amount: "12500.00", currency: "USD", status: "pending", description: "Depósito a cuenta", minsAgo: 55 },
      ];
      const txValues = seeds.map((s, i) => ({
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
      }));
      await db.insert(txTable).values(txValues);
    }

    const allUsers = await db.select({ id: users.id }).from(users);
    console.log(`Storage initialized with ${allUsers.length} users`);
  }

  // --- Users ---
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      password: hashPassword(insertUser.password),
    }).returning();
    return user;
  }

  // --- Transactions ---
  async createTransaction(insert: InsertTransaction): Promise<Transaction> {
    const [tx] = await db.insert(txTable).values(insert).returning();
    return tx;
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(txTable).where(eq(txTable.id, id));
    return tx;
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return db.select().from(txTable).orderBy(desc(txTable.createdAt));
  }

  async getTransactionsByUser(username: string): Promise<Transaction[]> {
    return db.select().from(txTable)
      .where(eq(txTable.createdBy, username))
      .orderBy(desc(txTable.createdAt));
  }

  async updateTransactionStatus(id: string, status: string, authCode?: string): Promise<Transaction | undefined> {
    const [updated] = await db.update(txTable)
      .set({ status, ...(authCode ? { authCode } : {}) })
      .where(eq(txTable.id, id))
      .returning();
    return updated;
  }

  // --- Payment Methods ---
  async createPaymentMethod(insert: InsertPaymentMethod): Promise<PaymentMethod> {
    const [pm] = await db.insert(paymentMethods).values({
      ...insert,
      cardNumber: maskCardNumber(insert.cardNumber),
      cvv: null,
      pin: null,
    }).returning();
    return pm;
  }

  async getPaymentMethod(id: string): Promise<PaymentMethod | undefined> {
    const [pm] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
    return pm;
  }

  // --- Security Tokens ---
  async createSecurityToken(insert: InsertSecurityToken): Promise<SecurityToken> {
    const [token] = await db.insert(securityTokens).values(insert).returning();
    return token;
  }

  async getSecurityToken(tokenId: string): Promise<SecurityToken | undefined> {
    const [token] = await db.select().from(securityTokens).where(eq(securityTokens.tokenId, tokenId));
    return token;
  }

  // --- Transaction Logs ---
  async createTransactionLog(insert: InsertTransactionLog): Promise<TransactionLog> {
    const [log] = await db.insert(transactionLogs).values(insert).returning();
    return log;
  }

  async getTransactionLogs(transactionId: string): Promise<TransactionLog[]> {
    return db.select().from(transactionLogs)
      .where(eq(transactionLogs.transactionId, transactionId))
      .orderBy(transactionLogs.timestamp);
  }

  // --- Banking Protocols ---
  async getAllProtocols(): Promise<BankingProtocol[]> {
    return db.select().from(bankingProtocols);
  }

  async getProtocol(code: string): Promise<BankingProtocol | undefined> {
    const [p] = await db.select().from(bankingProtocols).where(eq(bankingProtocols.code, code));
    return p;
  }

  // --- Notifications ---
  async createNotification(insert: InsertNotification): Promise<Notification> {
    const [notif] = await db.insert(notifications).values(insert).returning();
    return notif;
  }

  async getNotificationsForUser(username: string, isAdmin: boolean): Promise<Notification[]> {
    const condition = isAdmin
      ? or(eq(notifications.recipient, username), eq(notifications.recipient, "ADMIN"))
      : eq(notifications.recipient, username);
    return db.select().from(notifications)
      .where(condition)
      .orderBy(desc(notifications.createdAt));
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    const [n] = await db.select().from(notifications).where(eq(notifications.id, id));
    return n;
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(username: string, isAdmin: boolean): Promise<number> {
    const condition = isAdmin
      ? or(eq(notifications.recipient, username), eq(notifications.recipient, "ADMIN"))
      : eq(notifications.recipient, username);
    const updated = await db.update(notifications)
      .set({ read: true })
      .where(and(condition, eq(notifications.read, false)))
      .returning({ id: notifications.id });
    return updated.length;
  }

  async resolveNotification(id: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ status: "resolved", read: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async hasPendingPosRequest(fromUser: string): Promise<boolean> {
    const [found] = await db.select({ id: notifications.id }).from(notifications)
      .where(and(
        eq(notifications.type, "pos_request"),
        eq(notifications.fromUser, fromUser),
        eq(notifications.status, "pending"),
      ))
      .limit(1);
    return !!found;
  }

  async resolvePendingPosRequest(fromUser: string): Promise<Notification | undefined> {
    const [pending] = await db.select().from(notifications)
      .where(and(
        eq(notifications.type, "pos_request"),
        eq(notifications.fromUser, fromUser),
        eq(notifications.status, "pending"),
      ))
      .limit(1);
    if (!pending) return undefined;
    return this.resolveNotification(pending.id);
  }

  // --- POS Terminals ---
  async getAllTerminals(): Promise<PosTerminal[]> {
    return db.select().from(posTerminals).orderBy(posTerminals.terminalId);
  }

  async getTerminalsByOwner(username: string): Promise<PosTerminal[]> {
    return db.select().from(posTerminals).where(eq(posTerminals.owner, username));
  }

  async createTerminal(data: InsertPosTerminal): Promise<PosTerminal> {
    const nextId = await this.getNextTerminalId();
    const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    const countResult = await db.select({ id: posTerminals.id }).from(posTerminals);

    const [terminal] = await db.insert(posTerminals).values({
      terminalId: nextId,
      model: data.model,
      serial: `POS-${suffix}-${nextId}`,
      status: "Reconfigured",
      transactions: 0,
      amount: 0,
      efficiency: 100,
      location: data.location,
      uptime: "100%",
      lastTx: "Sin transacciones",
      firmware: "v5.0.0-NEW",
      ip: `192.168.1.${100 + countResult.length + 1}`,
      signalStrength: 100,
      emv: data.emv ?? true,
      nfc: data.nfc ?? true,
      pinpad: data.pinpad ?? true,
      configNote: "Terminal nueva — configurada y lista para operar",
      owner: data.owner ?? null,
    }).returning();
    return terminal;
  }

  async updateTerminal(id: string, data: Partial<{ location: string; status: string; configNote: string | null; systemMessage: string | null; model: string; owner: string | null; amount: number }>): Promise<PosTerminal | undefined> {
    const [updated] = await db.update(posTerminals)
      .set(data)
      .where(eq(posTerminals.id, id))
      .returning();
    return updated;
  }

  private async getNextTerminalId(): Promise<string> {
    const all = await db.select({ terminalId: posTerminals.terminalId }).from(posTerminals);
    let max = 1006;
    for (const t of all) {
      const num = parseInt(t.terminalId.replace("T", ""), 10);
      if (!isNaN(num) && num > max) max = num;
    }
    return `T${max + 1}`;
  }

  // --- Users (admin) ---
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  // --- System Settings ---
  async getSettings(): Promise<SystemSettings> {
    return JSON.parse(JSON.stringify(_systemSettings));
  }

  async updateSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
    _systemSettings = { ..._systemSettings, ...patch };
    return JSON.parse(JSON.stringify(_systemSettings));
  }
}

export const storage = new DatabaseStorage();
