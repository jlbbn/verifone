import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Usuario del sistema
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("USER"),
  position: text("position"),
  avatar: text("avatar"),
});

// Transacciones bancarias
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: text("transaction_id").notNull().unique(),
  protocol: text("protocol").notNull(), // 101.1, 101.2, etc.
  type: text("type").notNull(), // transfer, payment, deposit, withdrawal
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  fromAccount: text("from_account"),
  toAccount: text("to_account"),
  description: text("description"),
  authCode: text("auth_code"),
  tokenId: text("token_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Métodos de pago
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: text("transaction_id").notNull(),
  cardType: text("card_type").notNull(), // VISA, Mastercard, AMEX, etc.
  cardNumber: text("card_number").notNull(), // últimos 4 dígitos
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
  category: text("category").notNull(), // transfer, payment, deposit, withdrawal
  requiresSecurity: boolean("requires_security").default(true),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({ id: true });
export const insertSecurityTokenSchema = createInsertSchema(securityTokens).omit({ id: true, issuedAt: true });
export const insertTransactionLogSchema = createInsertSchema(transactionLogs).omit({ id: true, timestamp: true });
export const insertBankingProtocolSchema = createInsertSchema(bankingProtocols).omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

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
