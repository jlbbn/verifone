import { 
  type User, type InsertUser,
  type Transaction, type InsertTransaction,
  type PaymentMethod, type InsertPaymentMethod,
  type SecurityToken, type InsertSecurityToken,
  type TransactionLog, type InsertTransactionLog,
  type BankingProtocol, type InsertBankingProtocol
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Transactions
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  getAllTransactions(): Promise<Transaction[]>;
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private transactions: Map<string, Transaction>;
  private paymentMethods: Map<string, PaymentMethod>;
  private securityTokens: Map<string, SecurityToken>;
  private transactionLogs: Map<string, TransactionLog[]>;
  private protocols: Map<string, BankingProtocol>;

  constructor() {
    this.users = new Map();
    this.transactions = new Map();
    this.paymentMethods = new Map();
    this.securityTokens = new Map();
    this.transactionLogs = new Map();
    this.protocols = new Map();
    
    this.initializeProtocols();
    this.initializeAdminUser();
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

  private async initializeAdminUser() {
    const id1 = randomUUID();
    const adminUser: User = {
      id: id1,
      username: "Admin",
      password: "Keylog100$",
      fullName: "José Luis Barrientos",
      role: "ADMIN",
      position: "Software Engineer",
      avatar: null
    };
    this.users.set(id1, adminUser);

    const id2 = randomUUID();
    const newUser: User = {
      id: id2,
      username: "angoestradacontacto@gmail.com",
      password: "Keylog200$",
      fullName: "Ángel Estrada",
      role: "USER",
      position: "User",
      avatar: null
    };
    this.users.set(id2, newUser);
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
      password: insertUser.password,
      fullName: insertUser.fullName,
      role: insertUser.role || "USER",
      position: insertUser.position || null,
      avatar: insertUser.avatar || null
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
      cardNumber: insertPayment.cardNumber,
      cvv: insertPayment.cvv || null,
      pin: insertPayment.pin || null,
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
}

export const storage = new MemStorage();
