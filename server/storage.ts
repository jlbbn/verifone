import { db } from "./db";
import { eq, and, or, desc, sql } from "drizzle-orm";
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
  cryptoKeys,
  documents,
  supportTickets,
  paymentCharges,
  type User, type InsertUser,
  type Transaction, type InsertTransaction,
  type PaymentMethod, type InsertPaymentMethod,
  type SecurityToken, type InsertSecurityToken,
  type TransactionLog, type InsertTransactionLog,
  type BankingProtocol, type InsertBankingProtocol,
  type Notification, type InsertNotification,
  type PosTerminal, type InsertPosTerminal,
  type CryptoKey,
  type Document,
  type SupportTicket,
  type PaymentCharge,
  type SystemSettings, DEFAULT_SYSTEM_SETTINGS,
} from "@shared/schema";

// In-memory system settings (shared across all sessions, resets on restart)
let _systemSettings: SystemSettings = JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS));

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
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
  suspendUser(id: string, suspended: boolean): Promise<User | undefined>;

  // Crypto Keys
  getCryptoKeys(username: string, isAdmin: boolean): Promise<CryptoKey[]>;
  createCryptoKey(data: Omit<CryptoKey, "id" | "createdAt">): Promise<CryptoKey>;
  updateCryptoKeyStatus(id: string, status: string): Promise<CryptoKey | undefined>;
  deleteCryptoKey(id: string): Promise<void>;
  incrementKeyUsage(id: string): Promise<void>;

  // System Settings
  getSettings(): Promise<SystemSettings>;
  updateSettings(patch: Partial<SystemSettings>): Promise<SystemSettings>;

  // Documents
  createDocument(data: Omit<Document, "id" | "createdAt">): Promise<Document>;
  getDocuments(username: string, isAdmin: boolean): Promise<Omit<Document, "content">[]>;
  getDocument(id: string): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<void>;

  // Support Tickets
  createSupportTicket(data: Omit<SupportTicket, "id" | "ticketId" | "createdAt" | "updatedAt">): Promise<SupportTicket>;
  getSupportTickets(username: string, isAdmin: boolean): Promise<SupportTicket[]>;
  getSupportTicket(id: string): Promise<SupportTicket | undefined>;
  updateSupportTicket(id: string, patch: Partial<Pick<SupportTicket, "status" | "priority" | "adminNote">>): Promise<SupportTicket | undefined>;

  // Payment Charges (motor real)
  createPaymentCharge(data: Omit<PaymentCharge, "id" | "createdAt">): Promise<PaymentCharge>;
  getPaymentCharges(username: string, isAdmin: boolean): Promise<PaymentCharge[]>;
}

export class DatabaseStorage implements IStorage {

  async initialize() {
    // --- Migrate: add suspended column to users if missing ---
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // --- Ensure payment_charges table exists ---
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payment_charges (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        charge_id TEXT NOT NULL UNIQUE,
        processor TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'pending',
        description TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        card_last4 TEXT,
        card_brand TEXT,
        receipt_url TEXT,
        error_message TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // --- Ensure support_tickets table exists ---
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id TEXT NOT NULL UNIQUE,
        subject TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'billing',
        description TEXT NOT NULL,
        attachment_name TEXT,
        attachment_mime_type TEXT,
        attachment_content TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'medium',
        submitted_by TEXT NOT NULL,
        admin_note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP
      )
    `);

    // --- Ensure documents table exists ---
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        content TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // --- Ensure crypto_keys table exists ---
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS crypto_keys (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        scope TEXT NOT NULL,
        value TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Activa',
        usage INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

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
        password: hashPassword("Password1*"),
        fullName: "Patricio Arroyo",
        role: "USER",
        position: "Usuario",
        avatar: null,
        subscriptionStart: new Date("2026-06-13T00:00:00Z"),
      },
      {
        username: "arq_rrocheu@hotmail.com",
        email: "arq_rrocheu@hotmail.com",
        password: hashPassword("Keylog100%"),
        fullName: "Arq. Rrocheu",
        role: "USER",
        position: "Usuario",
        avatar: null,
        subscriptionStart: new Date("2026-06-13T00:00:00Z"),
      },
      {
        username: "danyleonpinto",
        email: "guiaenrutalp@gmail.com",
        password: hashPassword("Keylog100$"),
        fullName: "Dany Leon Pinto",
        role: "USER",
        position: "Suscriptor",
        avatar: null,
        subscriptionStart: new Date("2026-06-24T00:00:00Z"),
      },
      {
        username: "ovidiohdez@gmail.com",
        email: "ovidiohdez@gmail.com",
        password: hashPassword("Keylog100$"),
        fullName: "Ovidio Hdez",
        role: "USER",
        position: "Suscriptor",
        avatar: null,
        subscriptionStart: new Date("2026-06-24T00:00:00Z"),
      },
      {
        username: "avoexport03@gmail.com",
        email: "avoexport03@gmail.com",
        password: hashPassword("Keylog100$"),
        fullName: "Avo Export",
        role: "USER",
        position: "Suscriptor",
        avatar: null,
        subscriptionStart: new Date("2026-06-25T00:00:00Z"),
      },
      {
        username: "jmdoorsopen@gmail.com",
        email: "jmdoorsopen@gmail.com",
        password: hashPassword("Keylog5000$"),
        fullName: "JM Doors Open",
        role: "USER",
        position: "Usuario",
        avatar: null,
        subscriptionStart: null,
      },
      {
        username: "alcocero",
        email: "edgar.alcocer@alcoceroindustrial.com",
        password: hashPassword("Keylog100$"),
        fullName: "Edgar Alcocer",
        role: "USER",
        position: "Director General",
        avatar: null,
        subscriptionStart: new Date("2024-01-01T00:00:00Z"),
      },
      {
        username: "jetc76@hotmail.com",
        email: "jetc76@hotmail.com",
        password: hashPassword("Keylog100$"),
        fullName: "JETC76",
        role: "USER",
        position: "Suscriptor",
        avatar: null,
        subscriptionStart: null,
      },
      {
        username: "optimaqrh@gmail.com",
        email: "optimaqrh@gmail.com",
        password: hashPassword("Keylog100$"),
        fullName: "Optima QRH",
        role: "USER",
        position: "Usuario",
        avatar: null,
        subscriptionStart: null,
      },
    ];

    for (const u of seedUsers) {
      await db.insert(users).values(u).onConflictDoUpdate({
        target: users.username,
        set: { password: u.password },
      });
    }

    // --- Seed protocolos bancarios (upsert por code) ---
    const seedProtocols: BankingProtocol[] = [
      // ── Transferencias (101.x) ────────────────────────────────────────────
      { id: "p1", code: "101.1", name: "Transferencia básica",
        description: "Transferencia estándar entre cuentas. Sin requisitos adicionales de validación. Procesamiento en línea.",
        category: "transfer", requiresSecurity: false },
      { id: "p2", code: "101.2", name: "Transferencia con validación",
        description: "Transferencia con validación de seguridad en dos etapas. Requiere confirmación del banco emisor antes de liquidar.",
        category: "transfer", requiresSecurity: true },
      { id: "p3", code: "101.3", name: "Transferencia segura (recomendado)",
        description: "Transferencia con cifrado AES-256 y validación EMV completa. Protocolo recomendado para operaciones de alto valor.",
        category: "transfer", requiresSecurity: true },
      // ── Pagos (201.x) ─────────────────────────────────────────────────────
      { id: "p4", code: "201.1", name: "Pago nacional",
        description: "Pago procesado por red bancaria local (SPEI/CoDi). Compensación en 24 horas hábiles.",
        category: "payment", requiresSecurity: false },
      { id: "p5", code: "201.2", name: "Pago internacional",
        description: "Pago internacional con conversión de divisa. Procesado vía SWIFT / Visa Network. Aplica T/C vigente.",
        category: "payment", requiresSecurity: true },
      { id: "p6", code: "201.3", name: "Pago express",
        description: "Liquidación inmediata con prioridad en la red. Comisión adicional aplicable. Disponible 24/7.",
        category: "payment", requiresSecurity: true },
      // ── Depósitos (301.x) ─────────────────────────────────────────────────
      { id: "p7", code: "301.1", name: "Depósito cuenta",
        description: "Depósito directo a cuenta bancaria registrada. Sin límite de monto con validación previa.",
        category: "deposit", requiresSecurity: false },
      { id: "p8", code: "301.2", name: "Depósito efectivo",
        description: "Depósito en efectivo en ventanilla o terminal autorizada. Acreditación inmediata.",
        category: "deposit", requiresSecurity: false },
      // ── Retiros (401.x) ───────────────────────────────────────────────────
      { id: "p9", code: "401.1", name: "Retiro ATM",
        description: "Retiro en cajero automático. Límite diario según perfil de cuenta. Requiere PIN válido.",
        category: "withdrawal", requiresSecurity: true },
      // ── Especial: Venta Forzada (1643) ────────────────────────────────────
      { id: "p12", code: "1643", name: "Venta forzada terminal manual",
        description: "Venta forzada en modo offline para terminales sin conexión. Sincronización diferida al recuperar red. Alto valor.",
        category: "payment", requiresSecurity: true },
    ];

    for (const p of seedProtocols) {
      await db.insert(bankingProtocols).values(p).onConflictDoUpdate({
        target: bankingProtocols.code,
        set: { name: p.name, description: p.description, category: p.category, requiresSecurity: p.requiresSecurity },
      });
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

    // --- Fix: marcar todas las transacciones de Patricio Arroyo como fallidas ---
    // Razón: No authorized connection with the bank host (ERR_NO_AUTH_BANK_HOST)
    await db.execute(sql`
      UPDATE transactions
      SET status    = 'failed',
          auth_code = 'ERR_NO_AUTH_BANK_HOST'
      WHERE created_by = 'patricioarroyo510@gmail.com'
        AND status != 'failed'
        AND transaction_id != 'TXN-1781464598687-06C7AB21'
    `);

    // --- Fix: TXN-1781464598687-06C7AB21 → authentication ongoing (Bank Host checking) ---
    await db.execute(sql`
      UPDATE transactions
      SET status    = 'processing',
          auth_code = 'AUTH_ONGOING · Bank Host checking transaction'
      WHERE transaction_id = 'TXN-1781464598687-06C7AB21'
        AND status != 'processing'
    `);

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
        {
          owner: "Admin", type: "transfer", protocol: "101.3", amount: "680000.00", currency: "USD",
          status: "failed", minsAgo: 4,
          from: "JOSÉ LUIS BARRIENTOS · BANAMEX · **** **** **** 7741",
          to:   "CUENTA DESTINO · HSBC MÉXICO · **** **** **** 2209",
          description: "Error de bloque de protocolo 101.3: la secuencia de autorización no se completó exitosamente. Transacción revertida por fallo en el handshake con el host bancario.",
          auth: null,
        },
        {
          owner: "Admin", type: "payment", protocol: "201.2", amount: "1200000.00", currency: "USD",
          status: "failed", minsAgo: 12,
          from: "JOSÉ LUIS BARRIENTOS · AMEX · **** **** **** 3007",
          to:   "VISAINC ORDSHR / BANXICO LLC · TERMINAL T1004",
          description: "Rechazo de red Mastercard/AMEX: tarjeta ****3007 no habilitada para operaciones internacionales. Código: 57-TX-NOT-PERMITTED.",
          auth: null,
        },
        {
          owner: "Admin", type: "withdrawal", protocol: "401.1", amount: "75000.00", currency: "USD",
          status: "failed", minsAgo: 38,
          from: "JOSÉ LUIS BARRIENTOS · BBVA · **** **** **** 5512",
          to:   "ATM CORPORATIVO · TERMINAL T1001 · SUCURSAL CENTRO",
          description: "Timeout en host bancario ATM (protocolo 401.1). Conexión interrumpida durante autorización — operación revertida automáticamente.",
          auth: null,
        },
        {
          owner: "angoestradacontacto@gmail.com", type: "payment", protocol: "201.1", amount: "5420.00", currency: "USD",
          status: "failed", minsAgo: 7,
          from: "ÁNGEL ESTRADA · SANTANDER · **** **** **** 8821",
          to:   "TERMINAL T1005 · SUCURSAL ESTE · INGENICO iWL250",
          description: "PIN incorrecto — 3 intentos fallidos consecutivos. Tarjeta VISA ****8821 bloqueada temporalmente. Código: 55-WRONG-PIN.",
          auth: null,
        },
        {
          owner: "angoestradacontacto@gmail.com", type: "transfer", protocol: "101.2", amount: "2100.00", currency: "USD",
          status: "failed", minsAgo: 21,
          from: "ÁNGEL ESTRADA · HSBC · **** **** **** 4102",
          to:   "CUENTA SPEI DESTINO · BANORTE · CLABE 0121****8834",
          description: "Error de vinculación 101.2: cuenta destino no localizada en directorio SPEI/BANXICO. Transferencia cancelada por validación fallida.",
          auth: null,
        },
        {
          owner: "angoestradacontacto@gmail.com", type: "payment", protocol: "201.3", amount: "890.00", currency: "MXN",
          status: "failed", minsAgo: 33,
          from: "ÁNGEL ESTRADA · BANAMEX · **** **** **** 4459",
          to:   "TERMINAL T1005 · MODO OFFLINE · LOTE PENDIENTE",
          description: "Protocolo 201.3 offline: tiempo de espera para sincronización batch excedido (>90 seg). Transacción expirada sin confirmación de red.",
          auth: null,
        },
        {
          owner: "angoestradacontacto@gmail.com", type: "deposit", protocol: "301.1", amount: "12500.00", currency: "USD",
          status: "failed", minsAgo: 55,
          from: "CUENTA ORIGEN · MONEXUSA · **** **** **** 9938",
          to:   "ÁNGEL ESTRADA · HSBC · CUENTA CORRIENTE",
          description: "Bloque regulatorio PLD/AML-003: cuenta origen con restricción activa por revisión de cumplimiento. Depósito rechazado por protocolo anti-lavado.",
          auth: null,
        },
      ];
      const txValues = seeds.map((s, i) => ({
        transactionId: `TXN-${10000 + i}`,
        protocol: s.protocol,
        type: s.type,
        amount: s.amount,
        currency: s.currency,
        status: s.status,
        fromAccount: s.from,
        toAccount: s.to,
        description: s.description,
        authCode: s.auth,
        tokenId: null,
        createdBy: s.owner,
        createdAt: new Date(now - s.minsAgo * 60000),
      }));
      await db.insert(txTable).values(txValues);
    }

    // --- Seed transacciones completadas (idempotente: solo si no existen "completed") ---
    const existingCompleted = await db.select({ id: txTable.id }).from(txTable)
      .where(eq(txTable.status, "completed")).limit(1);
    if (existingCompleted.length === 0) {
      const now = Date.now();
      const completedSeeds = [
        {
          owner: "Admin", type: "payment", protocol: "201.1", amount: "48500.00", currency: "USD",
          status: "completed", minsAgo: 2,
          from: "JOSÉ LUIS BARRIENTOS · VISA · **** **** **** 4491",
          to:   "TERMINAL T1001 · SUCURSAL CENTRO · VERIFONE VX 690",
          auth: `AUTH-${Date.now()-100}-A1B2C3D4`,
          description: "Pago con VISA - **** 4491",
        },
        {
          owner: "Admin", type: "transfer", protocol: "101.3", amount: "125000.00", currency: "USD",
          status: "completed", minsAgo: 18,
          from: "JOSÉ LUIS BARRIENTOS · BANAMEX · **** **** **** 7741",
          to:   "TRANSFERENCIA SPEI · BANORTE · CLABE 0214****5521",
          auth: `AUTH-${Date.now()-200}-E5F6A7B8`,
          description: "Transferencia SPEI protocolo 101.3 — autorización exitosa.",
        },
        {
          owner: "Admin", type: "deposit", protocol: "301.2", amount: "350000.00", currency: "USD",
          status: "completed", minsAgo: 45,
          from: "WIRE TRANSFER · CITI BANK · SWIFT CITIUSX",
          to:   "JOSÉ LUIS BARRIENTOS · BANAMEX · CUENTA PRINCIPAL",
          auth: `AUTH-${Date.now()-300}-C9D0E1F2`,
          description: "Depósito en efectivo protocolo 301.2 — procesado en sucursal.",
        },
        {
          owner: "Admin", type: "payment", protocol: "201.3", amount: "9800.00", currency: "USD",
          status: "completed", minsAgo: 95,
          from: "JOSÉ LUIS BARRIENTOS · MASTERCARD · **** **** **** 6612",
          to:   "TERMINAL T1004 · SUCURSAL OESTE · VERIFONE VX 520",
          auth: `AUTH-${Date.now()-400}-G3H4I5J6`,
          description: "Pago con Mastercard - **** 6612",
        },
        {
          owner: "Admin", type: "withdrawal", protocol: "401.1", amount: "15000.00", currency: "USD",
          status: "completed", minsAgo: 130,
          from: "JOSÉ LUIS BARRIENTOS · BBVA · **** **** **** 5512",
          to:   "ATM CORPORATIVO · TERMINAL T1001 · SUCURSAL CENTRO",
          auth: `AUTH-${Date.now()-500}-K7L8M9N0`,
          description: "Retiro ATM protocolo 401.1 — aprobado.",
        },
        {
          owner: "angoestradacontacto@gmail.com", type: "payment", protocol: "201.1", amount: "3200.00", currency: "USD",
          status: "completed", minsAgo: 60,
          from: "ÁNGEL ESTRADA · VISA · **** **** **** 1134",
          to:   "TERMINAL T1005 · SUCURSAL ESTE · INGENICO iWL250",
          auth: `AUTH-${Date.now()-600}-P1Q2R3S4`,
          description: "Pago con Débito VISA - **** 1134",
        },
        {
          owner: "angoestradacontacto@gmail.com", type: "transfer", protocol: "101.3", amount: "7500.00", currency: "MXN",
          status: "completed", minsAgo: 110,
          from: "ÁNGEL ESTRADA · HSBC · **** **** **** 4102",
          to:   "CUENTA SPEI DESTINO · BANCOMER · CLABE 0121****9901",
          auth: `AUTH-${Date.now()-700}-T5U6V7W8`,
          description: "Transferencia SPEI protocolo 101.3 — exitosa.",
        },
      ];
      const completedValues = completedSeeds.map((s, i) => ({
        transactionId: `TXN-${20000 + i}`,
        protocol: s.protocol,
        type: s.type,
        amount: s.amount,
        currency: s.currency,
        status: s.status,
        fromAccount: s.from,
        toAccount: s.to,
        description: s.description,
        authCode: s.auth,
        tokenId: null,
        createdBy: s.owner,
        createdAt: new Date(now - s.minsAgo * 60000),
      }));
      await db.insert(txTable).values(completedValues);
    }

    // --- Seed transacciones POS admin — 14/06/2026 16:20 (upsert por transactionId) ---
    const existingAdminPos = await db.select({ id: txTable.id }).from(txTable)
      .where(eq(txTable.transactionId, "TXN-ADM-001")).limit(1);
    if (existingAdminPos.length === 0) {
      const base = new Date("2026-06-14T16:20:00").getTime();
      const adminPosTx = [
        {
          transactionId: "TXN-ADM-001",
          type: "payment", protocol: "101.1", amount: "17000.00", currency: "USD", status: "completed",
          fromAccount: "CARLOS MENDOZA · Mastercard · **** **** **** 3841",
          toAccount:   "TERMINAL T2001 · SUCURSAL NORTE · INGENICO ICT250",
          description: "Pago con Mastercard Internacional - **** 3841 · BANXICO PLUS · VENADO 69 CANCUN",
          authCode: "APPROVED/STAN 000074/AUTH CODE MX4K9PL/RRN 43201638991/TD A0000000041010",
          tokenId: null, createdBy: "corp.arevalo.asociados@gmail.com", createdAt: new Date(base),
        },
        {
          transactionId: "TXN-ADM-002",
          type: "payment", protocol: "201.1", amount: "23450.00", currency: "USD", status: "completed",
          fromAccount: "ROBERTO GUTIERREZ · VISA · **** **** **** 7712",
          toAccount:   "TERMINAL T2002 · SUCURSAL SUR · VERIFONE VX520",
          description: "Pago con VISA Internacional - **** 7712 · BANXICO PLUS · VENADO 69 CANCUN",
          authCode: "APPROVED/STAN 000081/AUTH CODE VX7R2BN/RRN 43201639004/TD A0000000031010",
          tokenId: null, createdBy: "corp.arevalo.asociados@gmail.com", createdAt: new Date(base + 3 * 60000),
        },
        {
          transactionId: "TXN-ADM-003",
          type: "payment", protocol: "101.1", amount: "8500.00", currency: "USD", status: "completed",
          fromAccount: "SOFIA RAMIREZ · Mastercard · **** **** **** 5529",
          toAccount:   "TERMINAL T2003 · SUCURSAL ESTE · PAX S80",
          description: "Pago con Mastercard Debito - **** 5529 · BANXICO PLUS · VENADO 69 CANCUN",
          authCode: "APPROVED/STAN 000049/AUTH CODE KP3W8QZ/RRN 43201639017/TD A0000000041010",
          tokenId: null, createdBy: "corp.arevalo.asociados@gmail.com", createdAt: new Date(base - 4 * 60000),
        },
        {
          transactionId: "TXN-ADM-004",
          type: "payment", protocol: "201.2", amount: "31200.00", currency: "USD", status: "completed",
          fromAccount: "DAVID TORRES · VISA · **** **** **** 0094",
          toAccount:   "TERMINAL T2004 · SUCURSAL OESTE · INGENICO iWL250",
          description: "Pago con VISA Credito - **** 0094 · BANXICO PLUS · VENADO 69 CANCUN",
          authCode: "APPROVED/STAN 000092/AUTH CODE LN5T1YA/RRN 43201639030/TD A0000000031010",
          tokenId: null, createdBy: "corp.arevalo.asociados@gmail.com", createdAt: new Date(base + 7 * 60000),
        },
        {
          transactionId: "TXN-ADM-005",
          type: "payment", protocol: "101.1", amount: "5750.00", currency: "USD", status: "completed",
          fromAccount: "MARIA LOPEZ · Mastercard · **** **** **** 6603",
          toAccount:   "TERMINAL T2005 · SUCURSAL CENTRO · VERIFONE V200c",
          description: "Pago con Mastercard Debit - **** 6603 · BANXICO PLUS · VENADO 69 CANCUN",
          authCode: "APPROVED/STAN 000037/AUTH CODE RP8C4SM/RRN 43201639043/TD A0000000041010",
          tokenId: null, createdBy: "corp.arevalo.asociados@gmail.com", createdAt: new Date(base - 8 * 60000),
        },
        {
          transactionId: "TXN-ADM-006",
          type: "payment", protocol: "201.3", amount: "12900.00", currency: "USD", status: "completed",
          fromAccount: "FERNANDO CASTILLO · VISA · **** **** **** 8847",
          toAccount:   "TERMINAL T2006 · SUCURSAL NORTE · PAX A80",
          description: "Pago con VISA Debit - **** 8847 · BANXICO PLUS · VENADO 69 CANCUN",
          authCode: "APPROVED/STAN 000065/AUTH CODE JB2N6RV/RRN 43201639056/TD A0000000031010",
          tokenId: null, createdBy: "corp.arevalo.asociados@gmail.com", createdAt: new Date(base + 11 * 60000),
        },
      ];
      await db.insert(txTable).values(adminPosTx);
    }

    // --- Seed avoexport03 · Abono suscripción $1,000 MXN · 26/Jun/2026 (idempotente) ---
    const existingAvo1k = await db.select({ id: txTable.id }).from(txTable)
      .where(eq(txTable.transactionId, "TXN-AVO-1KMXN-001")).limit(1);
    if (existingAvo1k.length === 0) {
      await db.insert(txTable).values([{
        transactionId: "TXN-AVO-1KMXN-001",
        type: "payment", protocol: "301.1", amount: "57.14", currency: "USD", status: "subscription_payment",
        fromAccount: "avoexport03@gmail.com · Abono Suscripción",
        toAccount:   "BANXICO PLUS LLC · BNXP-2026-062601",
        description: "ABONO SUSCRIPCIÓN — $1,000.00 MXN / $57.14 USD · TC 17.50 MXN/USD · REF PYMT-AE-2026-062601-ABONO · Contrato BNXP-2026-062501 · Conciliación parcial acumulada $110.80 USD",
        authCode:    "CONCIL-AE-2026-062601 / MOD-CLEARING-AUTO / 0x4E43-HOLD-PARTIAL-2",
        tokenId: null, createdBy: "avoexport03@gmail.com", createdAt: new Date("2026-06-26T14:00:00"),
      }]);
    }

    // --- Seed avoexport03 · 3er Abono $350 MXN / $20 USD · 26/Jun/2026 (idempotente) ---
    const existingAvo3 = await db.select({ id: txTable.id }).from(txTable)
      .where(eq(txTable.transactionId, "TXN-AVO-350MXN-003")).limit(1);
    if (existingAvo3.length === 0) {
      await db.insert(txTable).values([{
        transactionId: "TXN-AVO-350MXN-003",
        type: "payment", protocol: "301.1", amount: "20.00", currency: "USD", status: "subscription_payment",
        fromAccount: "avoexport03@gmail.com · 3er Abono Suscripción",
        toAccount:   "BANXICO PLUS LLC · BNXP-2026-062626",
        description: "3ER ABONO SUSCRIPCIÓN — $350.00 MXN / $20.00 USD · TC 17.50 MXN/USD · REF PYMT-AE-2026-062626-ABONO3 · Contrato BNXP-2026-062501 · Conciliación parcial acumulada $130.80 USD · Balance insuficiente para habilitar funciones",
        authCode:    "CONCIL-AE-2026-062626 / MOD-CLEARING-AUTO / 0x4E43-HOLD-PARTIAL-3",
        tokenId: null, createdBy: "avoexport03@gmail.com", createdAt: new Date("2026-06-26T16:30:00"),
      }]);
    }

    // --- Seed AEC MEXICO · Venta Forzada $15,000 · 24/Jun/2026 (idempotente) ---
    const existingAec = await db.select({ id: txTable.id }).from(txTable)
      .where(eq(txTable.transactionId, "TXN-AEC-15K-001")).limit(1);
    if (existingAec.length === 0) {
      await db.insert(txTable).values([{
        transactionId: "TXN-AEC-15K-001",
        type: "payment", protocol: "1643", amount: "15000.00", currency: "USD", status: "declined",
        fromAccount: "AEC MEXICO · Mastercard Internacional · ****1022",
        toAccount:   "GRUPO ASGE · VENADO 69 · CANCUN Q.ROO",
        description: "VENTA FORZADA — TERMINAL MANUAL · OPER 28 / LOTE 2 · EQUIV $262,500.00 MXN · TC 17.5 MXN/USD · AEC MEXICO SA DE CV - GSTAR CONS CHARGE · APROBADO BANXICO / RECHAZADO HOST ORIGIN",
        authCode:    "AUTH 37762300F016 37756480 / STAN 028 / LOTE 02 / EMV A0000000041010 / VERIFONE V660P",
        tokenId: null, createdBy: "Admin", createdAt: new Date("2026-06-24T13:07:33"),
      }]);
    }

    // --- Seed Edgar Alcocer · Alcocero Industrial · 2024 · 16+4+3 txns · $45,000 USD ---
    const existingAlc = await db.select({ id: txTable.id }).from(txTable)
      .where(eq(txTable.transactionId, "TXN-ALC-2024-001")).limit(1);
    if (existingAlc.length === 0) {
      const alcTxns = [
        // ── 16 CARGAS A TARJETA ──────────────────────────────────────────────
        { transactionId:"TXN-ALC-2024-001", type:"payment", protocol:"301.1", amount:"2500.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-001 · SANTA CATARINA NL · EQUIV $43,750.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-001-2024 / APROBADO VISA / STA 001 / LOTE 01 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-01-08T10:23:00Z") },
        { transactionId:"TXN-ALC-2024-002", type:"payment", protocol:"301.1", amount:"2200.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-002 · SANTA CATARINA NL · EQUIV $38,500.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-002-2024 / APROBADO VISA / STA 002 / LOTE 01 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-01-22T14:15:00Z") },
        { transactionId:"TXN-ALC-2024-003", type:"payment", protocol:"301.1", amount:"2500.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-003 · SANTA CATARINA NL · EQUIV $43,750.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-003-2024 / APROBADO VISA / STA 003 / LOTE 01 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-02-05T09:40:00Z") },
        { transactionId:"TXN-ALC-2024-004", type:"payment", protocol:"301.1", amount:"2000.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-004 · SANTA CATARINA NL · EQUIV $35,000.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-004-2024 / APROBADO VISA / STA 004 / LOTE 01 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-02-19T16:30:00Z") },
        { transactionId:"TXN-ALC-2024-005", type:"payment", protocol:"301.1", amount:"2700.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-005 · SANTA CATARINA NL · EQUIV $47,250.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-005-2024 / APROBADO VISA / STA 005 / LOTE 02 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-03-04T11:10:00Z") },
        { transactionId:"TXN-ALC-2024-006", type:"payment", protocol:"301.1", amount:"2100.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-006 · SANTA CATARINA NL · EQUIV $36,750.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-006-2024 / APROBADO VISA / STA 006 / LOTE 02 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-03-18T13:45:00Z") },
        { transactionId:"TXN-ALC-2024-007", type:"payment", protocol:"301.1", amount:"2400.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-007 · SANTA CATARINA NL · EQUIV $42,000.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-007-2024 / APROBADO VISA / STA 007 / LOTE 02 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-04-01T10:00:00Z") },
        { transactionId:"TXN-ALC-2024-008", type:"payment", protocol:"301.1", amount:"2600.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-008 · SANTA CATARINA NL · EQUIV $45,500.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-008-2024 / APROBADO VISA / STA 008 / LOTE 02 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-04-15T15:20:00Z") },
        { transactionId:"TXN-ALC-2024-009", type:"payment", protocol:"301.1", amount:"2200.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-009 · SANTA CATARINA NL · EQUIV $38,500.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-009-2024 / APROBADO VISA / STA 009 / LOTE 03 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-04-29T08:55:00Z") },
        { transactionId:"TXN-ALC-2024-010", type:"payment", protocol:"301.1", amount:"2500.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-010 · SANTA CATARINA NL · EQUIV $43,750.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-010-2024 / APROBADO VISA / STA 010 / LOTE 03 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-05-13T12:30:00Z") },
        { transactionId:"TXN-ALC-2024-011", type:"payment", protocol:"301.1", amount:"2200.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-011 · SANTA CATARINA NL · EQUIV $38,500.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-011-2024 / APROBADO VISA / STA 011 / LOTE 03 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-05-27T14:00:00Z") },
        { transactionId:"TXN-ALC-2024-012", type:"payment", protocol:"301.1", amount:"2800.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-012 · SANTA CATARINA NL · EQUIV $49,000.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-012-2024 / APROBADO VISA / STA 012 / LOTE 04 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-06-10T09:15:00Z") },
        { transactionId:"TXN-ALC-2024-013", type:"payment", protocol:"301.1", amount:"2100.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-013 · SANTA CATARINA NL · EQUIV $36,750.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-013-2024 / APROBADO VISA / STA 013 / LOTE 04 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-06-24T11:45:00Z") },
        { transactionId:"TXN-ALC-2024-014", type:"payment", protocol:"301.1", amount:"2400.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-014 · SANTA CATARINA NL · EQUIV $42,000.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-014-2024 / APROBADO VISA / STA 014 / LOTE 04 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-07-08T13:20:00Z") },
        { transactionId:"TXN-ALC-2024-015", type:"payment", protocol:"301.1", amount:"2700.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-015 · SANTA CATARINA NL · EQUIV $47,250.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-015-2024 / APROBADO VISA / STA 015 / LOTE 05 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-07-22T10:35:00Z") },
        { transactionId:"TXN-ALC-2024-016", type:"payment", protocol:"301.1", amount:"2600.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · VISA PLATINUM · ****4831 · SANTA CATARINA MTY",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CTA 0042-0691-8300091294",
          description:"CARGA A TARJETA — DEPÓSITO DIRECTO · FOLIO CAR-ALC-016 · SANTA CATARINA NL · EQUIV $45,500.00 MXN · TC 17.50",
          authCode:"AUTH-ALCR-016-2024 / APROBADO VISA / STA 016 / LOTE 05 / EMV A0000000031010",
          createdBy:"alcocero", createdAt: new Date("2024-08-05T15:00:00Z") },

        // ── 4 DISPERSIONES A ALCOCERO INDUSTRIAL S.A DE C.V ─────────────────
        { transactionId:"TXN-ALC-DSP-2024-001", type:"transfer", protocol:"101.3", amount:"1250.00", currency:"USD", status:"completed",
          fromAccount:"BANXICO PLUS · MOTOR DISPERSIÓN · POOL-ALC-2024-Q1",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · RFC AICE840312AB3 · BBVA 0121-8001-43291847",
          description:"DISPERSIÓN EMPRESARIAL Q1 · RAZÓN SOCIAL: ALCOCERO INDUSTRIAL S.A DE C.V · SANTA CATARINA NL · RFC AICE840312AB3 · FOLIO DSP-ALC-2024-001 · CONCILIADO",
          authCode:"DSP-AIS-001-2024 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2024030100001",
          createdBy:"alcocero", createdAt: new Date("2024-03-01T09:00:00Z") },
        { transactionId:"TXN-ALC-DSP-2024-002", type:"transfer", protocol:"101.3", amount:"1250.00", currency:"USD", status:"completed",
          fromAccount:"BANXICO PLUS · MOTOR DISPERSIÓN · POOL-ALC-2024-Q2",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · RFC AICE840312AB3 · BBVA 0121-8001-43291847",
          description:"DISPERSIÓN EMPRESARIAL Q2 · RAZÓN SOCIAL: ALCOCERO INDUSTRIAL S.A DE C.V · SANTA CATARINA NL · RFC AICE840312AB3 · FOLIO DSP-ALC-2024-002 · CONCILIADO",
          authCode:"DSP-AIS-002-2024 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2024060100002",
          createdBy:"alcocero", createdAt: new Date("2024-06-01T09:00:00Z") },
        { transactionId:"TXN-ALC-DSP-2024-003", type:"transfer", protocol:"101.3", amount:"1250.00", currency:"USD", status:"completed",
          fromAccount:"BANXICO PLUS · MOTOR DISPERSIÓN · POOL-ALC-2024-Q3",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · RFC AICE840312AB3 · BBVA 0121-8001-43291847",
          description:"DISPERSIÓN EMPRESARIAL Q3 · RAZÓN SOCIAL: ALCOCERO INDUSTRIAL S.A DE C.V · SANTA CATARINA NL · RFC AICE840312AB3 · FOLIO DSP-ALC-2024-003 · CONCILIADO",
          authCode:"DSP-AIS-003-2024 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2024090100003",
          createdBy:"alcocero", createdAt: new Date("2024-09-01T09:00:00Z") },
        { transactionId:"TXN-ALC-DSP-2024-004", type:"transfer", protocol:"101.3", amount:"1250.00", currency:"USD", status:"completed",
          fromAccount:"BANXICO PLUS · MOTOR DISPERSIÓN · POOL-ALC-2024-Q4",
          toAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · RFC AICE840312AB3 · BBVA 0121-8001-43291847",
          description:"DISPERSIÓN EMPRESARIAL Q4 · RAZÓN SOCIAL: ALCOCERO INDUSTRIAL S.A DE C.V · SANTA CATARINA NL · RFC AICE840312AB3 · FOLIO DSP-ALC-2024-004 · CONCILIADO",
          authCode:"DSP-AIS-004-2024 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2024120100004",
          createdBy:"alcocero", createdAt: new Date("2024-12-01T09:00:00Z") },

        // ── 3 CONCILIACIONES / CIERRE CONTABLE ──────────────────────────────
        { transactionId:"TXN-ALC-CONCIL-2024-001", type:"deposit", protocol:"301.1", amount:"500.00", currency:"USD", status:"completed",
          fromAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CIERRE CONTABLE SEMESTRAL",
          toAccount:"BANXICO PLUS · CUENTA OPERATIVA · CONCILIACIÓN ALC-2024-S1",
          description:"CONCILIACIÓN SEMESTRAL S1 · CIERRE CONTABLE ENE-JUN 2024 · ALCOCERO INDUSTRIAL S.A DE C.V · SANTA CATARINA NL · FOLIO CONCIL-ALC-2024-S1 · SALDO CONCILIADO",
          authCode:"CONCIL-ALC-S1-2024 / CLEARING APROBADO / CRC OK / HASH E9F2-BB04-S1",
          createdBy:"alcocero", createdAt: new Date("2024-06-28T17:00:00Z") },
        { transactionId:"TXN-ALC-CONCIL-2024-002", type:"deposit", protocol:"301.1", amount:"500.00", currency:"USD", status:"completed",
          fromAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CIERRE CONTABLE TRIMESTRAL",
          toAccount:"BANXICO PLUS · CUENTA OPERATIVA · CONCILIACIÓN ALC-2024-T3",
          description:"CONCILIACIÓN TRIMESTRAL T3 · CIERRE CONTABLE JUL-SEP 2024 · ALCOCERO INDUSTRIAL S.A DE C.V · SANTA CATARINA NL · FOLIO CONCIL-ALC-2024-T3 · SALDO CONCILIADO",
          authCode:"CONCIL-ALC-T3-2024 / CLEARING APROBADO / CRC OK / HASH E9F2-BB04-T3",
          createdBy:"alcocero", createdAt: new Date("2024-09-30T17:00:00Z") },
        { transactionId:"TXN-ALC-CONCIL-2024-003", type:"deposit", protocol:"301.1", amount:"500.00", currency:"USD", status:"completed",
          fromAccount:"ALCOCERO INDUSTRIAL S.A DE C.V · CIERRE CONTABLE ANUAL",
          toAccount:"BANXICO PLUS · CUENTA OPERATIVA · CONCILIACIÓN ALC-2024-ANUAL",
          description:"CONCILIACIÓN ANUAL 2024 · CIERRE EJERCICIO FISCAL 2024 · ALCOCERO INDUSTRIAL S.A DE C.V · SANTA CATARINA NL · FOLIO CONCIL-ALC-2024-ANUAL · EJERCICIO CERRADO · RFC AICE840312AB3",
          authCode:"CONCIL-ALC-ANUAL-2024 / CLEARING APROBADO / CRC OK / HASH E9F2-BB04-ANUAL / EJERCICIO 2024 CERRADO",
          createdBy:"alcocero", createdAt: new Date("2024-12-31T23:59:00Z") },
      ];
      for (const t of alcTxns) {
        await db.insert(txTable).values({ ...t, tokenId: null });
      }
    }

    // --- Seed crypto keys (idempotente: solo si tabla vacía) ---
    const existingKeys = await db.select({ id: cryptoKeys.id }).from(cryptoKeys).limit(1);
    if (existingKeys.length === 0) {
      const now2 = new Date();
      const seedKeys = [
        { name: "VISA_API_KEY",            type: "AES-256-GCM",       scope: "API / Pagos",     value: "vsk_live_a8f3c2d1e4b7...9f2c1a3b", status: "Activa",   usage: 1482, createdBy: "Admin", expiresAt: new Date("2026-12-01"), lastUsedAt: new Date(now2.getTime() - 2*60000) },
        { name: "SWIFT_ACCESS_TOKEN",      type: "RSA-4096",          scope: "Interbancario",   value: "swt_a1b2c3d4e5f6...7a8b9c0d",   status: "Activa",   usage: 384,  createdBy: "Admin", expiresAt: new Date("2026-10-28"), lastUsedAt: new Date(now2.getTime() - 15*60000) },
        { name: "DATABASE_ENCRYPTION_KEY", type: "AES-256-CBC",       scope: "Base de Datos",   value: "dek_1a2b3c4d5e6f...0a9b8c7d",   status: "Activa",   usage: 9821, createdBy: "Admin", expiresAt: new Date("2026-07-25"), lastUsedAt: new Date(now2.getTime() - 5*60000) },
        { name: "JWT_SECRET",              type: "ChaCha20-Poly1305", scope: "Autenticación",   value: "jwt_9z8y7x6w5v4...3u2t1s0r",    status: "Activa",   usage: 2341, createdBy: "Admin", expiresAt: new Date("2026-09-20"), lastUsedAt: new Date(now2.getTime() - 1*60000) },
        { name: "OAUTH_CLIENT_SECRET",     type: "AES-256-GCM",       scope: "OAuth 2.0",       value: "ocs_r0t4t3d...k3y",              status: "Rotada",   usage: 892,  createdBy: "Admin", expiresAt: new Date("2026-06-15"), lastUsedAt: new Date(now2.getTime() - 3*24*60*60000) },
        { name: "POS_TERMINAL_KEY",        type: "3DES-EDE",          scope: "Terminales POS",  value: "ptk_3des_a1b2c3...d4e5f6",      status: "Activa",   usage: 4512, createdBy: "Admin", expiresAt: new Date("2026-11-10"), lastUsedAt: new Date(now2.getTime() - 30000) },
        { name: "EMV_MASTER_KEY",          type: "AES-256-GCM",       scope: "EMV / Tarjetas",  value: "emv_mk_live_1234...5678",        status: "Activa",   usage: 7231, createdBy: "Admin", expiresAt: new Date("2026-09-01"), lastUsedAt: new Date(now2.getTime() - 8*60000) },
        { name: "LEGACY_HMAC_KEY",         type: "HMAC-SHA256",       scope: "Legacy",           value: "hmac_exp_k3y...9999",            status: "Expirada", usage: 3401, createdBy: "Admin", expiresAt: new Date("2026-03-01"), lastUsedAt: new Date(now2.getTime() - 90*24*60*60000) },
      ];
      for (const k of seedKeys) {
        await db.insert(cryptoKeys).values(k);
      }
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(sql`lower(${users.email}) = lower(${email})`);
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
      serial: data.serial?.trim() || `POS-${suffix}-${nextId}`,
      status: data.status ?? "Reconfigured",
      transactions: 0,
      amount: 0,
      efficiency: 100,
      location: data.location,
      uptime: "100%",
      lastTx: "Sin transacciones",
      firmware: data.firmware?.trim() || "v5.0.0-NEW",
      ip: data.ip?.trim() || `192.168.1.${100 + countResult.length + 1}`,
      signalStrength: data.signalStrength ?? 100,
      emv: data.emv ?? true,
      nfc: data.nfc ?? true,
      pinpad: data.pinpad ?? true,
      configNote: data.configNote?.trim() || "Terminal nueva — configurada y lista para operar",
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

  // --- Crypto Keys ---
  async getCryptoKeys(username: string, isAdmin: boolean): Promise<CryptoKey[]> {
    if (isAdmin) return db.select().from(cryptoKeys).orderBy(desc(cryptoKeys.createdAt));
    return db.select().from(cryptoKeys).where(eq(cryptoKeys.createdBy, username)).orderBy(desc(cryptoKeys.createdAt));
  }

  async createCryptoKey(data: Omit<CryptoKey, "id" | "createdAt">): Promise<CryptoKey> {
    const [key] = await db.insert(cryptoKeys).values(data).returning();
    return key;
  }

  async updateCryptoKeyStatus(id: string, status: string): Promise<CryptoKey | undefined> {
    const [updated] = await db.update(cryptoKeys).set({ status }).where(eq(cryptoKeys.id, id)).returning();
    return updated;
  }

  async deleteCryptoKey(id: string): Promise<void> {
    await db.delete(cryptoKeys).where(eq(cryptoKeys.id, id));
  }

  async incrementKeyUsage(id: string): Promise<void> {
    await db.update(cryptoKeys)
      .set({ usage: sql`${cryptoKeys.usage} + 1`, lastUsedAt: new Date() })
      .where(eq(cryptoKeys.id, id));
  }

  // --- Users (admin) ---
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async suspendUser(id: string, suspended: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ suspended }).where(eq(users.id, id)).returning();
    return updated;
  }

  // --- System Settings ---
  async getSettings(): Promise<SystemSettings> {
    return JSON.parse(JSON.stringify(_systemSettings));
  }

  async updateSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
    _systemSettings = { ..._systemSettings, ...patch };
    return JSON.parse(JSON.stringify(_systemSettings));
  }

  // --- Documents ---
  async createDocument(data: Omit<Document, "id" | "createdAt">): Promise<Document> {
    const [doc] = await db.insert(documents).values(data).returning();
    return doc;
  }

  async getDocuments(username: string, isAdmin: boolean): Promise<Omit<Document, "content">[]> {
    const rows = await db
      .select({
        id: documents.id,
        name: documents.name,
        category: documents.category,
        mimeType: documents.mimeType,
        size: documents.size,
        uploadedBy: documents.uploadedBy,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .orderBy(desc(documents.createdAt));
    if (isAdmin) return rows;
    return rows.filter(r => r.uploadedBy === username);
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // --- Support Tickets ---
  async createSupportTicket(data: Omit<SupportTicket, "id" | "ticketId" | "createdAt" | "updatedAt">): Promise<SupportTicket> {
    const ticketId = `TKT-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const [ticket] = await db.insert(supportTickets).values({ ...data, ticketId }).returning();
    return ticket;
  }

  async getSupportTickets(username: string, isAdmin: boolean): Promise<SupportTicket[]> {
    const rows = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
    if (isAdmin) return rows;
    return rows.filter(r => r.submittedBy === username);
  }

  async getSupportTicket(id: string): Promise<SupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return ticket;
  }

  async updateSupportTicket(id: string, patch: Partial<Pick<SupportTicket, "status" | "priority" | "adminNote">>): Promise<SupportTicket | undefined> {
    const [updated] = await db
      .update(supportTickets)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }

  // --- Payment Charges ---
  async createPaymentCharge(data: Omit<PaymentCharge, "id" | "createdAt">): Promise<PaymentCharge> {
    const [charge] = await db.insert(paymentCharges).values(data).returning();
    return charge;
  }

  async getPaymentCharges(username: string, isAdmin: boolean): Promise<PaymentCharge[]> {
    const rows = await db.select().from(paymentCharges).orderBy(desc(paymentCharges.createdAt));
    if (isAdmin) return rows;
    return rows.filter(r => r.createdBy === username);
  }
}

export const storage = new DatabaseStorage();
