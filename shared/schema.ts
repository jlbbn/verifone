import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean, doublePrecision, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

// Usuario del sistema
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("USER"),
  position: text("position"),
  avatar: text("avatar"),
  subscriptionStart: timestamp("subscription_start"),
  suspended: boolean("suspended").notNull().default(false),
  paymentEngineAccess: boolean("payment_engine_access").notNull().default(false),
  posFullAccess: boolean("pos_full_access").notNull().default(false),
  cajaSaldoUSD: doublePrecision("caja_saldo_usd").notNull().default(0),
});

// Transacciones bancarias
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: text("transaction_id").notNull().unique(),
  protocol: text("protocol").notNull(),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"),
  fromAccount: text("from_account"),
  toAccount: text("to_account"),
  description: text("description"),
  authCode: text("auth_code"),
  tokenId: text("token_id"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Métodos de pago
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: text("transaction_id").notNull(),
  cardType: text("card_type").notNull(),
  cardNumber: text("card_number").notNull(),
  cvv: text("cvv"),
  pin: text("pin"),
  holderName: text("holder_name").notNull(),
  expiryDate: text("expiry_date").notNull(),
  verified: boolean("verified").default(false),
});

// Tokens de seguridad
export const securityTokens = pgTable("security_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: text("token_id").notNull().unique(),
  transactionId: text("transaction_id").notNull(),
  algorithm: text("algorithm").notNull().default("AES-256"),
  hash: text("hash").notNull(),
  emvCompliant: boolean("emv_compliant").default(true),
  pciCompliant: boolean("pci_compliant").default(true),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Logs de transacciones
export const transactionLogs = pgTable("transaction_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: text("transaction_id").notNull(),
  action: text("action").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Protocolos bancarios
export const bankingProtocols = pgTable("banking_protocols", {
  id: varchar("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  requiresSecurity: boolean("requires_security").default(true),
});

// Notificaciones y solicitudes
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipient: text("recipient").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  fromUser: text("from_user"),
  status: text("status").notNull().default("info"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Terminales POS (persistentes en DB)
export const posTerminals = pgTable("pos_terminals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  terminalId: text("terminal_id").notNull().unique(),
  model: text("model").notNull(),
  serial: text("serial").notNull(),
  status: text("status").notNull().default("Reconfigured"),
  transactions: integer("transactions").notNull().default(0),
  amount: doublePrecision("amount").notNull().default(0),
  efficiency: integer("efficiency").notNull().default(100),
  location: text("location").notNull(),
  uptime: text("uptime").notNull().default("100%"),
  lastTx: text("last_tx").notNull().default("Sin transacciones"),
  firmware: text("firmware").notNull().default("v5.0.0-NEW"),
  ip: text("ip").notNull(),
  signalStrength: integer("signal_strength").notNull().default(100),
  emv: boolean("emv").notNull().default(true),
  nfc: boolean("nfc").notNull().default(true),
  pinpad: boolean("pinpad").notNull().default(true),
  configNote: text("config_note"),
  systemMessage: text("system_message"),
  owner: text("owner"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Claves criptográficas (persistentes por usuario)
export const cryptoKeys = pgTable("crypto_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  scope: text("scope").notNull(),
  value: text("value").notNull(),
  status: text("status").notNull().default("Activa"),
  usage: integer("usage").notNull().default(0),
  createdBy: text("created_by").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Saldos de cripto por usuario (interno — sin blockchain real), un renglón por activo
export const userCryptoBalances = pgTable("user_crypto_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  asset: text("asset").notNull(), // btc | eth | xrp | ltc | doge | sol | ada | dot | usdt
  balance: doublePrecision("balance").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userAssetUnique: unique().on(table.userId, table.asset),
}));

// Motor de pagos — cobros reales Stripe / Mercado Pago
export const paymentCharges = pgTable("payment_charges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chargeId: text("charge_id").notNull().unique(),
  processor: text("processor").notNull(), // "stripe" | "mercadopago"
  amount: doublePrecision("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"),
  description: text("description").notNull().default(""),
  email: text("email").notNull().default(""),
  cardLast4: text("card_last4"),
  cardBrand: text("card_brand"),
  receiptUrl: text("receipt_url"),
  errorMessage: text("error_message"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PaymentCharge = typeof paymentCharges.$inferSelect;

// Tickets de soporte — Payment Discrepancies
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: text("ticket_id").notNull().unique(),
  subject: text("subject").notNull(),
  category: text("category").notNull().default("billing"),
  description: text("description").notNull(),
  attachmentName: text("attachment_name"),
  attachmentMimeType: text("attachment_mime_type"),
  attachmentContent: text("attachment_content"),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  submittedBy: text("submitted_by").notNull(),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, ticketId: true, createdAt: true, updatedAt: true });
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

// Movimientos manuales de Caja (ingreso/egreso registrados por el operador)
export const cajaMovements = pgTable("caja_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // "ingreso" | "egreso"
  amountUSD: doublePrecision("amount_usd").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  reference: text("reference"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Documentos seguros
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull().default("other"), // contract | financial | identity | other
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  content: text("content").notNull(), // base64
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({ id: true });
export const insertSecurityTokenSchema = createInsertSchema(securityTokens).omit({ id: true, issuedAt: true });
export const insertTransactionLogSchema = createInsertSchema(transactionLogs).omit({ id: true, timestamp: true });
export const insertBankingProtocolSchema = createInsertSchema(bankingProtocols).omit({ id: true });
export const insertCryptoKeySchema = createInsertSchema(cryptoKeys).omit({ id: true, createdAt: true });
export const insertUserCryptoBalanceSchema = createInsertSchema(userCryptoBalances).omit({ id: true, updatedAt: true });
export const insertCajaMovementSchema = createInsertSchema(cajaMovements).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;

export type SecurityToken = typeof securityTokens.$inferSelect;
export type InsertSecurityToken = z.infer<typeof insertSecurityTokenSchema>;

export type TransactionLog = typeof transactionLogs.$inferSelect;
export type InsertTransactionLog = z.infer<typeof insertTransactionLogSchema>;

export type BankingProtocol = typeof bankingProtocols.$inferSelect;
export type InsertBankingProtocol = z.infer<typeof insertBankingProtocolSchema>;

export type CryptoKey = typeof cryptoKeys.$inferSelect;
export type InsertCryptoKey = z.infer<typeof insertCryptoKeySchema>;

export type UserCryptoBalance = typeof userCryptoBalances.$inferSelect;
export type InsertUserCryptoBalance = z.infer<typeof insertUserCryptoBalanceSchema>;

export type CajaMovement = typeof cajaMovements.$inferSelect;
export type InsertCajaMovement = z.infer<typeof insertCajaMovementSchema>;

// Activos cripto soportados internamente (sin blockchain real)
export const CRYPTO_ASSETS = ["btc", "eth", "xrp", "ltc", "doge", "sol", "ada", "dot", "usdt"] as const;
export type CryptoAsset = typeof CRYPTO_ASSETS[number];

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type PosTerminal = typeof posTerminals.$inferSelect;

// InsertPosTerminal: campos que el admin puede proporcionar al crear una terminal
export interface InsertPosTerminal {
  model: string;
  location: string;
  owner?: string | null;
  emv?: boolean;
  nfc?: boolean;
  pinpad?: boolean;
  serial?: string;
  firmware?: string;
  ip?: string;
  status?: string;
  signalStrength?: number;
  configNote?: string;
  brand?: string;
}

// ─── System Settings ─────────────────────────────────────────────────────────
export interface TickerItem {
  symbol: string;
  value: string;
}

export interface SystemSettings {
  // General
  merchantName: string;
  merchantCity: string;
  afiliacion: string;
  tipoCambio: number; // MXN por 1 USD
  fxRateEUR: number;  // USD por 1 EUR
  fxRateGBP: number;  // USD por 1 GBP
  // Mantenimiento global
  maintenanceMode: boolean;
  // Caja / Balances
  saldoAperturaUSD: number;
  saldoSistemaUSD: number;
  // Feed en Vivo (usuarios)
  feedMerchant1: string;
  feedMerchant2: string;
  feedPosRegularUSD: number;
  feed1643USD: number;
  feedVisaNet101USD: number;
  feedTerminales: string[];
  // Ticker financiero
  tickerItems: TickerItem[];
  // Parámetros terminal (label + value only; UI metadata stays in frontend)
  terminalParams: { label: string; value: string }[];
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  merchantName: "GRUPO ASGE VENADO 69",
  merchantCity: "CANCUN Q.ROO",
  afiliacion: "7705397",
  tipoCambio: 17.50,
  fxRateEUR: 1.085,
  fxRateGBP: 1.27,
  maintenanceMode: true,
  saldoAperturaUSD: 0,
  saldoSistemaUSD: 1250000,
  feedMerchant1: "GRUPO ASGE VENADO 69",
  feedMerchant2: "BANXICO PLUS CANCUN",
  feedPosRegularUSD: 2000000,
  feed1643USD: 30000,
  feedVisaNet101USD: 5000000,
  feedTerminales: ["T1001", "T1002", "T1004", "T1005"],
  tickerItems: [
    { symbol: "ON",      value: "$22.53" },
    { symbol: "CAD/MXN", value: "$13.20" },
    { symbol: "BTC/USD", value: "$54,325.75" },
    { symbol: "ETH/USD", value: "$2,670.30" },
    { symbol: "XRP/USD", value: "$0.52" },
    { symbol: "LTC/USD", value: "$142.87" },
    { symbol: "DOT/USD", value: "$15.32" },
    { symbol: "ADA/USD", value: "$0.82" },
  ],
  terminalParams: [
    { label: "APLICACION",    value: "RETAIL" },
    { label: "VERSION",       value: "PROVEEOPENAT400" },
    { label: "AFILIACION",    value: "7705397" },
    { label: "VERSION FECHA", value: "JUN 25 2026" },
    { label: "PCI REBOOT",    value: "03" },
    { label: "ARRSVEC",       value: "1.10.213" },
    { label: "REGISTRO VHO",  value: "V660p-A" },
    { label: "VERSION EPROM", value: "V660PT6 10.2" },
    { label: "TIPO TERMINAL", value: "V660p-A" },
    { label: "SERIE NUMERO",  value: "T13-768-018" },
    { label: "PTID",          value: "71376801" },
    { label: "NII",           value: "016" },
    { label: "NUM DE FOLIO",  value: "****8" },
    { label: "BANCO",         value: "" },
    { label: "TURNOS",        value: "1" },
    { label: "VENTA FORZADA", value: "SI" },
    { label: "CASH BACK",     value: "SI" },
    { label: "TIEMPO AIRE",   value: "SI" },
    { label: "CRIPTOGRAFIA",  value: "SI" },
    { label: "DCC MODE",      value: "0" },
    { label: "BN#",           value: "0" },
    { label: "IMP TICKET",    value: "3" },
    { label: "DEVOLUCION",    value: "3" },
    { label: "PAGOS DIF",     value: "06" },
    { label: "AMEX OPTBLUE",  value: "SI" },
    { label: "PLAN AMEX",     value: "SI" },
    { label: "MANEJO CTLS",   value: "SI" },
    { label: "MANEJO EMV",    value: "SI" },
    { label: "EMV MODULE",    value: "VOS2 VERTEX" },
    { label: "PP P400",       value: "SI" },
    { label: "USUARIOS",      value: "SI" },
    { label: "TX POR LLAVE T",value: "VENTA" },
    { label: "SERVICOMERCIO", value: "SI" },
    { label: "MOTO CVW2",     value: "SI" },
    { label: "SUPER MANUAL",  value: "SI" },
    { label: "COMM ELECTR",   value: "SI" },
    { label: "OPS",           value: "SI" },
    { label: "LEALTAD MEDA",  value: "SI" },
    { label: "GIFTCARD",      value: "SI" },
    { label: "MODO COMUNI",   value: "SOLO ETHERNET" },
    { label: "ACTIVADO SSL",  value: "SI" },
    { label: "ACTIVADO TLS",  value: "SI" },
  ],
};

// ─── Caja — clasificación y conversión de transacciones ───────────────────────
// Solo estos "type" de transacción representan dinero entrando por POS/terminal.
// Cualquier type no listado (exchange, transfer/dispersión cripto, etc.) queda
// excluido de Caja por default — son movimientos internos, no bancarios.
export const CAJA_INGRESO_TX_TYPES = ["payment", "sr-link"] as const;

export function convertToUSD(
  amount: number,
  currency: string,
  rates: Pick<SystemSettings, "tipoCambio" | "fxRateEUR" | "fxRateGBP">
): number {
  switch ((currency || "USD").toUpperCase()) {
    case "USD": return amount;
    case "MXN": return amount / rates.tipoCambio;
    case "EUR": return amount * rates.fxRateEUR;
    case "GBP": return amount * rates.fxRateGBP;
    default: return amount;
  }
}

// ─── Reglas de Enrutamiento POS ───────────────────────────────────────────────
// conditionField: "amount" | "currency" | "protocol" | "cardType"
// conditionOperator: "gt" | "lt" | "gte" | "lte" | "eq" | "startsWith" | "contains"
// acquirer: "stripe" | "mercadopago" | "local"
export const routingRules = pgTable("routing_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  conditionField: text("condition_field").notNull(),
  conditionOperator: text("condition_operator").notNull(),
  conditionValue: text("condition_value").notNull(),
  acquirer: text("acquirer").notNull(),
  priority: integer("priority").notNull().default(100),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Historial de Decisiones de Enrutamiento ─────────────────────────────────
export const routingDecisions = pgTable("routing_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: text("transaction_id").notNull(),
  ruleId: text("rule_id"),
  ruleName: text("rule_name"),
  acquirer: text("acquirer").notNull(),
  conditionMatched: text("condition_matched"),
  responseTimeMs: integer("response_time_ms"),
  approved: boolean("approved").notNull().default(false),
  amount: text("amount"),
  currency: text("currency"),
  protocol: text("protocol"),
  cardType: text("card_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Comandos Remotos de Terminales ──────────────────────────────────────────
// command: "restart" | "reconfigure" | "force_offline" | "sync"
// status: "pending" | "executing" | "completed" | "failed"
export const terminalCommands = pgTable("terminal_commands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  terminalId: text("terminal_id").notNull(),
  command: text("command").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertRoutingRuleSchema = createInsertSchema(routingRules).omit({ id: true, createdAt: true });
export type RoutingRule = typeof routingRules.$inferSelect;
export type InsertRoutingRule = z.infer<typeof insertRoutingRuleSchema>;

export type RoutingDecision = typeof routingDecisions.$inferSelect;
export type TerminalCommand = typeof terminalCommands.$inferSelect;
