// Parámetros internos del terminal — la "verdad" del POS.
// Todo (pantalla, tickets, menús de sistema, panel web) lee/escribe aquí.

export type TerminalModel = "VX520" | "P400" | "E280S";
export type CommMode = "ETHERNET" | "DIAL" | "GPRS";

export interface TerminalParams {
  // Identidad
  model: TerminalModel;
  merchant: string;
  terminalId: string;
  serial: string;
  osVersion: string;
  appVersion: string;
  // Comunicación
  commMode: CommMode;
  host: string;
  port: number;
  ssl: boolean;
  tmsId: string;
  authToken: string;
  offlineMode: boolean;
  // Venta
  currency: "MXN" | "USD";
  tipPercent: number;
  protocol: string;
  authCode: string;
  forceDecline: boolean;
  // Tarjeta de prueba
  cardNumber: string;
  holderName: string;
  expDate: string;
  // Hardware
  brightness: number;
  paperLevel: number;
  wifi: boolean;
  gprs: boolean;
  contactless: boolean;
  // Banderas de parametros (reporte)
  flags: Record<string, boolean>;
}

export const FEATURE_FLAGS = [
  "VENTA FORZADA",
  "TIEMPO AIRE",
  "PP P400",
  "USUARIOS",
  "SERVICOMERCIO",
  "MOTO CVW2",
  "SUPER MANUAL",
  "COMM ELECTR",
  "OPS",
  "LEALTAD MEDA",
  "GIFTCARD",
  "ACTIVADO SSL",
  "VALIDAR PROTOCOLO",
  "AUTH REQUERIDO",
  "PROTO 101.1",
] as const;

export const PROTOCOLS = ["101.1", "101.2", "201.1", "201.2", "301.1", "401.1", "1643"];

// Reglas de operación por protocolo (espejo de la tabla del POS Virtual Banxico).
export interface ProtocolInfo {
  code: string;
  label: string;          // etiqueta larga para selectores
  name: string;           // nombre corto para pantalla/ticket
  kind: string;           // tipo de operación
  authDigits: number | null; // dígitos requeridos del código de aprobación
  processingCode: string; // ISO 8583 DE3
}

export const PROTOCOL_INFO: Record<string, ProtocolInfo> = {
  "101.1": { code: "101.1", label: "101.1 — Basic Transfer / Transferencia básica",       name: "TRANSFERENCIA BÁSICA",      kind: "TRANSFERENCIA", authDigits: 4,    processingCode: "400000" },
  "101.2": { code: "101.2", label: "101.2 — Validated Transfer / Transferencia validada", name: "TRANSFERENCIA VALIDADA",    kind: "TRANSFERENCIA", authDigits: 6,    processingCode: "400000" },
  "201.1": { code: "201.1", label: "201.1 — Domestic Payment / Pago nacional",            name: "PAGO NACIONAL",             kind: "PAGO",          authDigits: 6,    processingCode: "000000" },
  "201.2": { code: "201.2", label: "201.2 — International Payment / Pago internacional",  name: "PAGO INTERNACIONAL",        kind: "PAGO",          authDigits: 6,    processingCode: "000000" },
  "301.1": { code: "301.1", label: "301.1 — Account Deposit / Depósito cuenta",           name: "DEPÓSITO CUENTA",           kind: "DEPÓSITO",      authDigits: 6,    processingCode: "210000" },
  "401.1": { code: "401.1", label: "401.1 — ATM Withdrawal / Retiro ATM",                 name: "RETIRO ATM",                kind: "RETIRO",        authDigits: 6,    processingCode: "010000" },
  "1643":  { code: "1643",  label: "1643 — Venta manual",                                 name: "VENTA MANUAL",              kind: "VENTA MANUAL", authDigits: 4,    processingCode: "000000" },
};

export function protocolInfo(code: string): ProtocolInfo {
  return PROTOCOL_INFO[code] ?? {
    code, label: code, name: `PROTOCOLO ${code}`, kind: "OPERACIÓN", authDigits: 6, processingCode: "000000",
  };
}

export const SUPERVISOR_PASSWORD = "166831";

export const DEFAULT_PARAMS: TerminalParams = {
  model: "VX520",
  merchant: "BANXICO PLUS DEMO",
  terminalId: "VF-88421056",
  serial: "266-340-812",
  osVersion: "Verix V 4.3.2",
  appVersion: "QT520440-A",
  commMode: "ETHERNET",
  host: "201.151.90.14",
  port: 4443,
  ssl: true,
  tmsId: "TMS-0007",
  authToken: "",
  offlineMode: false,
  currency: "MXN",
  tipPercent: 0,
  protocol: "101.1",
  authCode: "",
  forceDecline: false,
  cardNumber: "4040310011384895",
  holderName: "CLIENTE DEMO",
  expDate: "02/27",
  brightness: 80,
  paperLevel: 65,
  wifi: true,
  gprs: true,
  contactless: true,
  flags: {
    "VENTA FORZADA": true,
    "TIEMPO AIRE": false,
    "PP P400": true,
    "USUARIOS": true,
    "SERVICOMERCIO": false,
    "MOTO CVW2": true,
    "SUPER MANUAL": false,
    "COMM ELECTR": true,
    "OPS": true,
    "LEALTAD MEDA": false,
    "GIFTCARD": false,
    "ACTIVADO SSL": true,
    "VALIDAR PROTOCOLO": true,
    "AUTH REQUERIDO": true,
    "PROTO 101.1": true,
  },
};

const STORAGE_KEY = "verifone-params";
const QUEUE_KEY = "verifone-queue";

// Transacción forzada guardada localmente pendiente de envío al motor.
export interface QueuedTxn {
  id: string;
  body: Record<string, unknown>;
  total: number;
  time: string;
}

export function loadQueue(): QueuedTxn[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveQueue(q: QueuedTxn[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function loadParams(): TerminalParams {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PARAMS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PARAMS, ...parsed, flags: { ...DEFAULT_PARAMS.flags, ...(parsed.flags ?? {}) } };
  } catch {
    return DEFAULT_PARAMS;
  }
}

export function saveParams(p: TerminalParams) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}
