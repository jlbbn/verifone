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
] as const;

export const PROTOCOLS = ["101.1", "101.2", "201.1", "201.2", "301.1", "401.1", "1643"];

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
  },
};

const STORAGE_KEY = "verifone-params";

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
