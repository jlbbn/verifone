// Parámetros internos del terminal — la "verdad" del POS.
// Todo (pantalla, tickets, menús de sistema, panel web) lee/escribe aquí.

export type TerminalModel = "VX520" | "P400" | "E280S" | "SUNMI_V3" | "SUNMI_V3_PLUS" | "SUNMI_V3_MIX";
export type CommMode = "ETHERNET" | "DIAL" | "GPRS";

// Ficha técnica por modelo — alimenta ACERCA DE y los defaults de OS/APP al cambiar de modelo
export interface ModelProfile {
  label: string;
  os: string;           // OS por defecto al seleccionar el modelo
  app: string;          // paquete de aplicación por defecto
  hwCode: string;       // código de hardware de fábrica (p. ej. T5F1A en SUNMI V3)
  screen: string;
  printer: string;
  scanner: string;
  payments: string;
  connectivity: string;
  memory: string;
}

export const MODEL_PROFILES: Record<TerminalModel, ModelProfile> = {
  VX520: {
    label: "Verifone VX520", os: "Verix V 4.3.2", app: "QT520440-A", hwCode: "—",
    screen: '2.8" QVGA monocromo', printer: "Térmica 58 mm",
    scanner: "—", payments: "CHIP / BANDA / CTLS",
    connectivity: "ETHERNET / DIAL", memory: "—",
  },
  P400: {
    label: "Verifone P400", os: "VOS 2.8.0", app: "PP400-A3", hwCode: "—",
    screen: '2.8" QVGA color', printer: "Térmica 58 mm",
    scanner: "—", payments: "CHIP / BANDA / CTLS",
    connectivity: "ETHERNET / Wi-Fi", memory: "—",
  },
  E280S: {
    label: "Verifone e280s", os: "VOS 3.1.2", app: "E280-STD", hwCode: "—",
    screen: '2.4" color', printer: "—",
    scanner: "—", payments: "CTLS / BANDA",
    connectivity: "Wi-Fi / BT", memory: "—",
  },
  SUNMI_V3: {
    label: "SUNMI V3", os: "SUNMI OS 4.5.8 (Android 13)", app: "SUNMI-PSP-3.0", hwCode: "T5F1A",
    screen: '6.75" HD+ 720x1600 · 420 nits', printer: "Térmica 58 mm (etiquetas)",
    scanner: "Láser 2D (opcional)", payments: "NFC SoftPOS · CTLS",
    connectivity: "Wi-Fi 6E dual band / 4G LTE", memory: "3/32 GB · 4/64 GB",
  },
  SUNMI_V3_PLUS: {
    label: "SUNMI V3 PLUS", os: "SUNMI OS 4.0 (Android 13)", app: "SUNMI-PSP-3.0+", hwCode: "—",
    screen: '6.75" HD+ 720x1600 · 420 nits', printer: "Térmica 58/80 mm · 100 mm/s",
    scanner: "Láser 2D (opcional)", payments: "NFC SoftPOS · CTLS",
    connectivity: "Wi-Fi 6E dual band / 4G LTE", memory: "4/64 GB",
  },
  SUNMI_V3_MIX: {
    label: "SUNMI V3 MIX", os: "SUNMI OS 4.0 (Android 13)", app: "SUNMI-PSP-3.0 MIX", hwCode: "—",
    screen: '10.1" Full HD táctil', printer: "Térmica 80 mm",
    scanner: "—", payments: "NFC SoftPOS · CTLS",
    connectivity: "Wi-Fi 6E / 4G LTE", memory: "4/64 GB",
  },
};

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
  // Riesgo offline (floor limits)
  offlineMaxAmount: number;
  offlineMaxQueue: number;
  // Recibo
  merchantAddress: string;
  receiptFooter: string;
  legalText: string;
  // Seguridad criptográfica
  cryptoScheme: "DUKPT" | "MKS";
  ksn: string;
  bdk: string;
  // Perfiles EMV (AIDs habilitados)
  emvAids: Record<string, boolean>;
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
  "MAGSTRIPE FALLBACK",
] as const;

// Perfiles EMV (AIDs) soportados por la terminal
export const EMV_AIDS = ["VISA", "MASTERCARD", "AMEX", "CARNET"] as const;

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
  merchant: "BANXICO PLUS",
  terminalId: "VF-88421056",
  serial: "VA24261Q40112",
  osVersion: "Verix V 4.3.2",
  appVersion: "QT520440-A",
  commMode: "ETHERNET",
  host: "201.151.90.14",
  port: 4443,
  ssl: true,
  tmsId: "TMS-0007",
  authToken: "",
  offlineMode: false,
  offlineMaxAmount: 5000,
  offlineMaxQueue: 50,
  merchantAddress: "AV. INSURGENTES SUR 1234, CDMX",
  receiptFooter: "GRACIAS POR SU COMPRA",
  legalText: "PAGARE NEGOCIABLE — AUTORIZO EL CARGO A ESTA TARJETA POR EL MONTO INDICADO",
  cryptoScheme: "DUKPT",
  ksn: "FFFF9876543210E00008",
  bdk: "0123456789ABCDEFFEDCBA9876543210",
  emvAids: {
    "VISA": true,
    "MASTERCARD": true,
    "AMEX": true,
    "CARNET": false,
  },
  currency: "MXN",
  tipPercent: 0,
  protocol: "101.1",
  authCode: "",
  forceDecline: false,
  cardNumber: "4040310011384895",
  holderName: "CLIENTE GENERICO",
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
    "MAGSTRIPE FALLBACK": true,
  },
};

const QUEUE_KEY = "verifone-queue";

// Transacción forzada guardada localmente pendiente de envío al motor.
export interface QueuedTxn {
  id: string;
  body: Record<string, unknown>;
  total: number;
  time: string;
  ref?: string;            // BankReference (máx. 12) — sellada al encolar
  authCode?: string | null; // AuthCode local — sellado al encolar
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
