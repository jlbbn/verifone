import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean, doublePrecision } from "drizzle-orm/pg-core";
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({ id: true });
export const insertSecurityTokenSchema = createInsertSchema(securityTokens).omit({ id: true, issuedAt: true });
export const insertTransactionLogSchema = createInsertSchema(transactionLogs).omit({ id: true, timestamp: true });
export const insertBankingProtocolSchema = createInsertSchema(bankingProtocols).omit({ id: true });

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

export type PosTerminal = typeof posTerminals.$inferSelect;

// InsertPosTerminal: sólo los campos que el admin proporciona al crear una terminal
export interface InsertPosTerminal {
  model: string;
  location: string;
  owner?: string | null;
  emv?: boolean;
  nfc?: boolean;
  pinpad?: boolean;
}
