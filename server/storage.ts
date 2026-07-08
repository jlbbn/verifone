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
  userCryptoBalances,
  cajaMovements,
  routingRules,
  routingDecisions,
  terminalCommands,
  type CajaMovement, type InsertCajaMovement,
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
  type UserCryptoBalance, type CryptoAsset,
  type SystemSettings, DEFAULT_SYSTEM_SETTINGS,
  type RoutingRule, type InsertRoutingRule,
  type RoutingDecision,
  type TerminalCommand,
} from "@shared/schema";

// In-memory system settings (shared across all sessions, resets on restart)
let _systemSettings: SystemSettings = JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS));

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Caja — movimientos manuales
  getCajaMovements(): Promise<CajaMovement[]>;
  createCajaMovement(data: InsertCajaMovement): Promise<CajaMovement>;

  // Transactions
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionsByUser(username: string): Promise<Transaction[]>;
  updateTransactionStatus(id: string, status: string, authCode?: string): Promise<Transaction | undefined>;
  addTransactionNote(id: string, note: string): Promise<Transaction | undefined>;

  // Payment Methods
  createPaymentMethod(payment: InsertPaymentMethod): Promise<PaymentMethod>;
  getPaymentMethod(id: string): Promise<PaymentMethod | undefined>;

  // Security Tokens
  createSecurityToken(token: InsertSecurityToken): Promise<SecurityToken>;
  getSecurityToken(tokenId: string): Promise<SecurityToken | undefined>;
  listSecurityTokens(): Promise<SecurityToken[]>;

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
  getTerminalById(id: string): Promise<PosTerminal | undefined>;
  getTerminalsByOwner(username: string): Promise<PosTerminal[]>;
  createTerminal(data: InsertPosTerminal): Promise<PosTerminal>;
  updateTerminal(id: string, data: Partial<{ location: string; status: string; configNote: string | null; systemMessage: string | null; model: string; owner: string | null; amount: number }>): Promise<PosTerminal | undefined>;

  // Users (admin)
  getAllUsers(): Promise<User[]>;
  suspendUser(id: string, suspended: boolean): Promise<User | undefined>;

  // Crypto Balances (saldos internos por usuario/activo — sin blockchain real)
  getCryptoBalances(userId: string): Promise<UserCryptoBalance[]>;
  getAllCryptoBalances(): Promise<UserCryptoBalance[]>;
  setCryptoBalance(userId: string, asset: CryptoAsset, balance: number): Promise<UserCryptoBalance>;
  creditCryptoBalance(userId: string, asset: CryptoAsset, amount: number): Promise<UserCryptoBalance>;
  exchangeCrypto(
    userId: string,
    fromAsset: CryptoAsset, fromAmount: number,
    toAsset: CryptoAsset, toAmount: number,
  ): Promise<{ from: UserCryptoBalance; to: UserCryptoBalance }>;

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

  // Routing Rules
  getRoutingRules(): Promise<RoutingRule[]>;
  getRoutingRule(id: string): Promise<RoutingRule | undefined>;
  createRoutingRule(data: InsertRoutingRule): Promise<RoutingRule>;
  updateRoutingRule(id: string, patch: Partial<InsertRoutingRule>): Promise<RoutingRule | undefined>;
  deleteRoutingRule(id: string): Promise<void>;

  // Routing Decisions
  createRoutingDecision(data: Omit<RoutingDecision, "id" | "createdAt">): Promise<RoutingDecision>;
  getRoutingDecisions(limit?: number): Promise<RoutingDecision[]>;
  getRoutingDecisionByTx(transactionId: string): Promise<RoutingDecision | undefined>;

  // Terminal Commands
  createTerminalCommand(data: Omit<TerminalCommand, "id" | "createdAt" | "completedAt">): Promise<TerminalCommand>;
  getTerminalCommands(terminalId: string): Promise<TerminalCommand[]>;
  updateTerminalCommandStatus(id: string, status: string, completedAt?: Date): Promise<TerminalCommand | undefined>;
}

export class DatabaseStorage implements IStorage {

  async initialize() {
    // --- Migrate: add suspended column to users if missing ---
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // --- Migrate: add caja_saldo_usd column to users if missing ---
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS caja_saldo_usd DOUBLE PRECISION NOT NULL DEFAULT 0
    `);

    // --- Ensure user_crypto_balances table exists (saldos internos por usuario/activo) ---
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_crypto_balances (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        asset TEXT NOT NULL,
        balance DOUBLE PRECISION NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT user_crypto_balances_user_id_asset_unique UNIQUE (user_id, asset)
      )
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

    // --- Ensure routing_rules table exists ---
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS routing_rules (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        condition_field TEXT NOT NULL,
        condition_operator TEXT NOT NULL,
        condition_value TEXT NOT NULL,
        acquirer TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 100,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // --- Ensure routing_decisions table exists ---
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS routing_decisions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id TEXT NOT NULL,
        rule_id TEXT,
        rule_name TEXT,
        acquirer TEXT NOT NULL,
        condition_matched TEXT,
        response_time_ms INTEGER,
        approved BOOLEAN NOT NULL DEFAULT FALSE,
        amount TEXT,
        currency TEXT,
        protocol TEXT,
        card_type TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // --- Ensure terminal_commands table exists ---
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS terminal_commands (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        terminal_id TEXT NOT NULL,
        command TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    // --- Seed default routing rules (idempotente: solo si tabla vacía) ---
    const existingRules = await db.execute(sql`SELECT COUNT(*) as cnt FROM routing_rules`);
    const ruleCount = Number((existingRules.rows[0] as any)?.cnt ?? 0);
    if (ruleCount === 0) {
      await db.execute(sql`
        INSERT INTO routing_rules (name, description, condition_field, condition_operator, condition_value, acquirer, priority, active)
        VALUES
          ('Montos altos → Stripe', 'Transacciones mayores a $1000 USD se enrutan a Stripe por mayor confiabilidad', 'amount', 'gt', '1000', 'stripe', 10, TRUE),
          ('Pago Internacional → Stripe', 'Protocolos internacionales (201.2) se procesan en Stripe', 'protocol', 'eq', '201.2', 'stripe', 20, TRUE),
          ('Pago Express → Mercado Pago', 'Protocolos express (201.3) se enrutan a Mercado Pago', 'protocol', 'eq', '201.3', 'mercadopago', 30, TRUE),
          ('MXN → Mercado Pago', 'Pagos en pesos mexicanos se procesan localmente via Mercado Pago', 'currency', 'eq', 'MXN', 'mercadopago', 40, TRUE),
          ('Montos bajos → Local', 'Transacciones menores a $5 USD se autorizan localmente', 'amount', 'lt', '5', 'local', 50, TRUE)
      `);
    }

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
        email: "edgar.alcocer@alcocerodelnorte.com",
        password: hashPassword("Keylog100$"),
        fullName: "Edgar Alcocer",
        role: "USER",
        position: "Director General · Alcocero del Norte LLC · Monterrey, N.L.",
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
        subscriptionStart: new Date("2026-06-30T00:00:00Z"),
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
      { terminalId: "T1005", model: "Ingenico iWL250", serial: "ING-IWL250-E5503", status: "Online", transactions: 0, amount: 0, efficiency: 94, location: "Sucursal Este", uptime: "99.3%", lastTx: "Sin transacciones", firmware: "v3.0.2", ip: "192.168.1.105", signalStrength: 72, emv: true, nfc: true, pinpad: true, owner: "angoestradacontacto@gmail.com", configNote: null },
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

    // --- Seed Edgar Alcocer · Alcocero del Norte LLC · Ene-Jun 2026 · dispersiones $720,000 USD ---
    // Único usuario con actividad: todas las demás cuentas no presentan transacciones.
    const existingAlc = await db.select({ id: txTable.id }).from(txTable)
      .where(eq(txTable.transactionId, "TXN-ALC-2026-001")).limit(1);
    if (existingAlc.length === 0) {
      const alcTxns = [
        { transactionId:"TXN-ALC-2026-001", type:"transfer", protocol:"101.3", amount:"65000.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · CUENTA OPERATIVA BANXICO PLUS · MONTERREY N.L.",
          toAccount:"ALCOCERO DEL NORTE LLC · CTA 0042-0691-8300091294",
          description:"DISPERSIÓN A EMPRESA · RAZÓN SOCIAL: ALCOCERO DEL NORTE LLC · MONTERREY N.L. · FOLIO DSP-ALC-2026-001 · CONCILIADO",
          authCode:"DSP-ADN-001-2026 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2026011200001",
          createdBy:"alcocero", createdAt: new Date("2026-01-12T10:15:00Z") },
        { transactionId:"TXN-ALC-2026-002", type:"transfer", protocol:"101.3", amount:"58500.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · CUENTA OPERATIVA BANXICO PLUS · MONTERREY N.L.",
          toAccount:"ALCOCERO DEL NORTE LLC · CTA 0042-0691-8300091294",
          description:"DISPERSIÓN A EMPRESA · RAZÓN SOCIAL: ALCOCERO DEL NORTE LLC · MONTERREY N.L. · FOLIO DSP-ALC-2026-002 · CONCILIADO",
          authCode:"DSP-ADN-002-2026 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2026012800002",
          createdBy:"alcocero", createdAt: new Date("2026-01-28T11:40:00Z") },
        { transactionId:"TXN-ALC-2026-003", type:"transfer", protocol:"101.3", amount:"72300.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · CUENTA OPERATIVA BANXICO PLUS · MONTERREY N.L.",
          toAccount:"ALCOCERO DEL NORTE LLC · CTA 0042-0691-8300091294",
          description:"DISPERSIÓN A EMPRESA · RAZÓN SOCIAL: ALCOCERO DEL NORTE LLC · MONTERREY N.L. · FOLIO DSP-ALC-2026-003 · CONCILIADO",
          authCode:"DSP-ADN-003-2026 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2026021000003",
          createdBy:"alcocero", createdAt: new Date("2026-02-10T09:20:00Z") },
        { transactionId:"TXN-ALC-2026-004", type:"transfer", protocol:"101.3", amount:"61800.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · CUENTA OPERATIVA BANXICO PLUS · MONTERREY N.L.",
          toAccount:"ALCOCERO DEL NORTE LLC · CTA 0042-0691-8300091294",
          description:"DISPERSIÓN A EMPRESA · RAZÓN SOCIAL: ALCOCERO DEL NORTE LLC · MONTERREY N.L. · FOLIO DSP-ALC-2026-004 · CONCILIADO",
          authCode:"DSP-ADN-004-2026 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2026022500004",
          createdBy:"alcocero", createdAt: new Date("2026-02-25T14:05:00Z") },
        { transactionId:"TXN-ALC-2026-005", type:"transfer", protocol:"101.3", amount:"69200.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · CUENTA OPERATIVA BANXICO PLUS · MONTERREY N.L.",
          toAccount:"ALCOCERO DEL NORTE LLC · CTA 0042-0691-8300091294",
          description:"DISPERSIÓN A EMPRESA · RAZÓN SOCIAL: ALCOCERO DEL NORTE LLC · MONTERREY N.L. · FOLIO DSP-ALC-2026-005 · CONCILIADO",
          authCode:"DSP-ADN-005-2026 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2026031100005",
          createdBy:"alcocero", createdAt: new Date("2026-03-11T10:50:00Z") },
        { transactionId:"TXN-ALC-2026-006", type:"transfer", protocol:"101.3", amount:"55400.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · CUENTA OPERATIVA BANXICO PLUS · MONTERREY N.L.",
          toAccount:"ALCOCERO DEL NORTE LLC · CTA 0042-0691-8300091294",
          description:"DISPERSIÓN A EMPRESA · RAZÓN SOCIAL: ALCOCERO DEL NORTE LLC · MONTERREY N.L. · FOLIO DSP-ALC-2026-006 · CONCILIADO",
          authCode:"DSP-ADN-006-2026 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2026032700006",
          createdBy:"alcocero", createdAt: new Date("2026-03-27T13:30:00Z") },
        { transactionId:"TXN-ALC-2026-007", type:"transfer", protocol:"101.3", amount:"78900.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · CUENTA OPERATIVA BANXICO PLUS · MONTERREY N.L.",
          toAccount:"ALCOCERO DEL NORTE LLC · CTA 0042-0691-8300091294",
          description:"DISPERSIÓN A EMPRESA · RAZÓN SOCIAL: ALCOCERO DEL NORTE LLC · MONTERREY N.L. · FOLIO DSP-ALC-2026-007 · CONCILIADO",
          authCode:"DSP-ADN-007-2026 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2026041400007",
          createdBy:"alcocero", createdAt: new Date("2026-04-14T09:10:00Z") },
        { transactionId:"TXN-ALC-2026-008", type:"transfer", protocol:"101.3", amount:"62100.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · CUENTA OPERATIVA BANXICO PLUS · MONTERREY N.L.",
          toAccount:"ALCOCERO DEL NORTE LLC · CTA 0042-0691-8300091294",
          description:"DISPERSIÓN A EMPRESA · RAZÓN SOCIAL: ALCOCERO DEL NORTE LLC · MONTERREY N.L. · FOLIO DSP-ALC-2026-008 · CONCILIADO",
          authCode:"DSP-ADN-008-2026 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2026042900008",
          createdBy:"alcocero", createdAt: new Date("2026-04-29T15:45:00Z") },
        { transactionId:"TXN-ALC-2026-009", type:"transfer", protocol:"101.3", amount:"71600.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · CUENTA OPERATIVA BANXICO PLUS · MONTERREY N.L.",
          toAccount:"ALCOCERO DEL NORTE LLC · CTA 0042-0691-8300091294",
          description:"DISPERSIÓN A EMPRESA · RAZÓN SOCIAL: ALCOCERO DEL NORTE LLC · MONTERREY N.L. · FOLIO DSP-ALC-2026-009 · CONCILIADO",
          authCode:"DSP-ADN-009-2026 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2026051500009",
          createdBy:"alcocero", createdAt: new Date("2026-05-15T11:25:00Z") },
        { transactionId:"TXN-ALC-2026-010", type:"transfer", protocol:"101.3", amount:"58700.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · CUENTA OPERATIVA BANXICO PLUS · MONTERREY N.L.",
          toAccount:"ALCOCERO DEL NORTE LLC · CTA 0042-0691-8300091294",
          description:"DISPERSIÓN A EMPRESA · RAZÓN SOCIAL: ALCOCERO DEL NORTE LLC · MONTERREY N.L. · FOLIO DSP-ALC-2026-010 · CONCILIADO",
          authCode:"DSP-ADN-010-2026 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2026053000010",
          createdBy:"alcocero", createdAt: new Date("2026-05-30T14:00:00Z") },
        { transactionId:"TXN-ALC-2026-011", type:"transfer", protocol:"101.3", amount:"66500.00", currency:"USD", status:"completed",
          fromAccount:"EDGAR ALCOCER · CUENTA OPERATIVA BANXICO PLUS · MONTERREY N.L.",
          toAccount:"ALCOCERO DEL NORTE LLC · CTA 0042-0691-8300091294",
          description:"DISPERSIÓN A EMPRESA · RAZÓN SOCIAL: ALCOCERO DEL NORTE LLC · MONTERREY N.L. · FOLIO DSP-ALC-2026-011 · CONCILIADO",
          authCode:"DSP-ADN-011-2026 / TRANSFERENCIA SEGURA / PROTOCOLO 101.3 / SPEI APROBADO / CLAVE RASTREO 2026061200011",
          createdBy:"alcocero", createdAt: new Date("2026-06-12T10:05:00Z") },
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

  // --- Caja — movimientos manuales ---
  async getCajaMovements(): Promise<CajaMovement[]> {
    return db.select().from(cajaMovements).orderBy(desc(cajaMovements.createdAt));
  }

  async createCajaMovement(data: InsertCajaMovement): Promise<CajaMovement> {
    const [mov] = await db.insert(cajaMovements).values(data).returning();
    return mov;
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

  async addTransactionNote(id: string, note: string): Promise<Transaction | undefined> {
    const existing = await this.getTransaction(id);
    if (!existing) return undefined;
    const newDescription = existing.description
      ? `${existing.description} · ${note}`
      : note;
    const [updated] = await db.update(txTable)
      .set({ description: newDescription })
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

  async listSecurityTokens(): Promise<SecurityToken[]> {
    return db.select().from(securityTokens).orderBy(desc(securityTokens.issuedAt));
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

  async getTerminalById(id: string): Promise<PosTerminal | undefined> {
    const [t] = await db.select().from(posTerminals).where(eq(posTerminals.id, id)).limit(1);
    return t ?? undefined;
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

  // --- Crypto Balances ---
  async getCryptoBalances(userId: string): Promise<UserCryptoBalance[]> {
    return db.select().from(userCryptoBalances).where(eq(userCryptoBalances.userId, userId));
  }

  async getAllCryptoBalances(): Promise<UserCryptoBalance[]> {
    return db.select().from(userCryptoBalances);
  }

  async setCryptoBalance(userId: string, asset: CryptoAsset, balance: number): Promise<UserCryptoBalance> {
    const [row] = await db.insert(userCryptoBalances)
      .values({ userId, asset, balance })
      .onConflictDoUpdate({
        target: [userCryptoBalances.userId, userCryptoBalances.asset],
        set: { balance, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async creditCryptoBalance(userId: string, asset: CryptoAsset, amount: number): Promise<UserCryptoBalance> {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(userCryptoBalances)
        .where(and(eq(userCryptoBalances.userId, userId), eq(userCryptoBalances.asset, asset)));
      const nextBalance = (existing?.balance ?? 0) + amount;
      const [row] = await tx.insert(userCryptoBalances)
        .values({ userId, asset, balance: nextBalance })
        .onConflictDoUpdate({
          target: [userCryptoBalances.userId, userCryptoBalances.asset],
          set: { balance: nextBalance, updatedAt: new Date() },
        })
        .returning();
      return row;
    });
  }

  async exchangeCrypto(
    userId: string,
    fromAsset: CryptoAsset, fromAmount: number,
    toAsset: CryptoAsset, toAmount: number,
  ): Promise<{ from: UserCryptoBalance; to: UserCryptoBalance }> {
    return db.transaction(async (tx) => {
      const [fromRow] = await tx.select().from(userCryptoBalances)
        .where(and(eq(userCryptoBalances.userId, userId), eq(userCryptoBalances.asset, fromAsset)));
      const currentFromBalance = fromRow?.balance ?? 0;
      if (currentFromBalance < fromAmount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }
      const [updatedFrom] = await tx.insert(userCryptoBalances)
        .values({ userId, asset: fromAsset, balance: currentFromBalance - fromAmount })
        .onConflictDoUpdate({
          target: [userCryptoBalances.userId, userCryptoBalances.asset],
          set: { balance: currentFromBalance - fromAmount, updatedAt: new Date() },
        })
        .returning();

      const [toRow] = await tx.select().from(userCryptoBalances)
        .where(and(eq(userCryptoBalances.userId, userId), eq(userCryptoBalances.asset, toAsset)));
      const currentToBalance = toRow?.balance ?? 0;
      const [updatedTo] = await tx.insert(userCryptoBalances)
        .values({ userId, asset: toAsset, balance: currentToBalance + toAmount })
        .onConflictDoUpdate({
          target: [userCryptoBalances.userId, userCryptoBalances.asset],
          set: { balance: currentToBalance + toAmount, updatedAt: new Date() },
        })
        .returning();

      return { from: updatedFrom, to: updatedTo };
    });
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

  // --- Routing Rules ---
  async getRoutingRules(): Promise<RoutingRule[]> {
    return db.select().from(routingRules).orderBy(routingRules.priority);
  }

  async getRoutingRule(id: string): Promise<RoutingRule | undefined> {
    const [rule] = await db.select().from(routingRules).where(eq(routingRules.id, id));
    return rule;
  }

  async createRoutingRule(data: InsertRoutingRule): Promise<RoutingRule> {
    const [rule] = await db.insert(routingRules).values(data).returning();
    return rule;
  }

  async updateRoutingRule(id: string, patch: Partial<InsertRoutingRule>): Promise<RoutingRule | undefined> {
    const [updated] = await db.update(routingRules).set(patch).where(eq(routingRules.id, id)).returning();
    return updated;
  }

  async deleteRoutingRule(id: string): Promise<void> {
    await db.delete(routingRules).where(eq(routingRules.id, id));
  }

  // --- Routing Decisions ---
  async createRoutingDecision(data: Omit<RoutingDecision, "id" | "createdAt">): Promise<RoutingDecision> {
    const [decision] = await db.insert(routingDecisions).values(data).returning();
    return decision;
  }

  async getRoutingDecisions(limit = 100): Promise<RoutingDecision[]> {
    return db.select().from(routingDecisions).orderBy(desc(routingDecisions.createdAt)).limit(limit);
  }

  async getRoutingDecisionByTx(transactionId: string): Promise<RoutingDecision | undefined> {
    const [decision] = await db.select().from(routingDecisions).where(eq(routingDecisions.transactionId, transactionId));
    return decision;
  }

  // --- Terminal Commands ---
  async createTerminalCommand(data: Omit<TerminalCommand, "id" | "createdAt" | "completedAt">): Promise<TerminalCommand> {
    const [cmd] = await db.insert(terminalCommands).values(data).returning();
    return cmd;
  }

  async getTerminalCommands(terminalId: string): Promise<TerminalCommand[]> {
    return db.select().from(terminalCommands)
      .where(eq(terminalCommands.terminalId, terminalId))
      .orderBy(desc(terminalCommands.createdAt))
      .limit(50);
  }

  async updateTerminalCommandStatus(id: string, status: string, completedAt?: Date): Promise<TerminalCommand | undefined> {
    const [updated] = await db.update(terminalCommands)
      .set({ status, ...(completedAt ? { completedAt } : {}) })
      .where(eq(terminalCommands.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
