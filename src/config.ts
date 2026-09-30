// Capa de configuración del terminal — única puerta de entrada/salida de la config.
// Todo lo que venga de localStorage o de un perfil JSON pasa por aquí:
// se valida campo a campo, se clamp a rangos seguros y se migra antes de tocar el POS.
// El resto de la app jamás lee/escribe la clave de storage directamente.

import {
  DEFAULT_PARAMS, FEATURE_FLAGS, EMV_AIDS, PROTOCOLS,
} from "./params";
import type { TerminalParams } from "./params";

export const CONFIG_KEY = "verifone-params";

// ─── Especificación de validación por campo ──────────────────────────────────
type FieldSpec =
  | { kind: "string"; max: number }
  | { kind: "digits"; max: number }
  | { kind: "pattern"; re: RegExp }
  | { kind: "number"; min: number; max: number }
  | { kind: "boolean" }
  | { kind: "enum"; values: readonly string[] };

const FIELDS = {
  model:            { kind: "enum", values: ["VX520", "P400", "E280S", "SUNMI_V3", "SUNMI_V3_PLUS", "SUNMI_V3_MIX"] },
  commMode:         { kind: "enum", values: ["ETHERNET", "DIAL", "GPRS"] },
  currency:         { kind: "enum", values: ["MXN", "USD"] },
  cryptoScheme:     { kind: "enum", values: ["DUKPT", "MKS"] },
  protocol:         { kind: "enum", values: PROTOCOLS },
  merchant:         { kind: "string", max: 40 },
  terminalId:       { kind: "string", max: 20 },
  serial:           { kind: "string", max: 24 },
  osVersion:        { kind: "string", max: 32 },
  appVersion:       { kind: "string", max: 24 },
  host:             { kind: "string", max: 120 },
  tmsId:            { kind: "string", max: 20 },
  authToken:        { kind: "string", max: 200 },
  merchantAddress:  { kind: "string", max: 80 },
  receiptFooter:    { kind: "string", max: 60 },
  legalText:        { kind: "string", max: 200 },
  authCode:         { kind: "string", max: 12 },
  holderName:       { kind: "string", max: 26 },
  expDate:          { kind: "pattern", re: /^\d{2}\/\d{2}$/ },
  cardNumber:       { kind: "digits", max: 19 },
  ksn:              { kind: "string", max: 24 },
  bdk:              { kind: "string", max: 32 },
  port:             { kind: "number", min: 1, max: 65535 },
  offlineMaxAmount: { kind: "number", min: 0, max: 10000000 },
  offlineMaxQueue:  { kind: "number", min: 1, max: 500 },
  tipPercent:       { kind: "number", min: 0, max: 100 },
  brightness:       { kind: "number", min: 0, max: 100 },
  paperLevel:       { kind: "number", min: 0, max: 100 },
  ssl:              { kind: "boolean" },
  offlineMode:      { kind: "boolean" },
  forceDecline:     { kind: "boolean" },
  wifi:             { kind: "boolean" },
  gprs:             { kind: "boolean" },
  contactless:      { kind: "boolean" },
} as const satisfies Record<string, FieldSpec>;

function sanitizeField(v: unknown, spec: FieldSpec, fallback: unknown): unknown {
  switch (spec.kind) {
    case "boolean":
      return typeof v === "boolean" ? v : fallback;
    case "number": {
      const n = typeof v === "number" ? v : Number(v);
      return typeof n === "number" && Number.isFinite(n)
        ? Math.min(spec.max, Math.max(spec.min, Math.round(n)))
        : fallback;
    }
    case "enum":
      return typeof v === "string" && spec.values.includes(v) ? v : fallback;
    case "string": {
      if (typeof v !== "string") return fallback;
      const t = v.trim().slice(0, spec.max);
      return t === "" ? fallback : t;
    }
    case "digits": {
      if (typeof v !== "string") return fallback;
      const d = v.replace(/\D/g, "").slice(0, spec.max);
      return d === "" ? fallback : d;
    }
    case "pattern":
      return typeof v === "string" && spec.re.test(v) ? v : fallback;
  }
}

// Banderas/AIDs: solo llaves conocidas; cualquier otra cosa se descarta
function pickBooleans(raw: unknown, defaults: Record<string, boolean>, keys: readonly string[]): Record<string, boolean> {
  const out = { ...defaults };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const k of keys) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "boolean") out[k] = v;
    }
  }
  return out;
}

// Valida un valor arbitrario (storage, perfil importado, UI) y devuelve config completa y sana
export function sanitizeParams(raw: unknown): TerminalParams {
  const src = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...DEFAULT_PARAMS };
  for (const [key, spec] of Object.entries(FIELDS)) {
    out[key] = sanitizeField(src[key], spec, (DEFAULT_PARAMS as unknown as Record<string, unknown>)[key]);
  }
  out.flags = pickBooleans(src.flags, DEFAULT_PARAMS.flags, FEATURE_FLAGS);
  out.emvAids = pickBooleans(src.emvAids, DEFAULT_PARAMS.emvAids, EMV_AIDS);
  return out as unknown as TerminalParams;
}

// ─── Migraciones de esquema (idempotentes, se aplican sobre config ya saneada) ──
const MIGRATIONS: ((p: TerminalParams) => TerminalParams)[] = [
  // v0→v1: nombres de demostración → producción
  (p) => (p.merchant === "BANXICO PLUS DEMO" ? { ...p, merchant: "BANXICO PLUS" } : p),
  (p) => (p.holderName === "CLIENTE DEMO" ? { ...p, holderName: "CLIENTE GENERICO" } : p),
];

export function migrateConfig(p: TerminalParams): TerminalParams {
  return MIGRATIONS.reduce((acc, m) => m(acc), p);
}

// ─── API de la capa ──────────────────────────────────────────────────────────
export function loadConfig(): TerminalParams {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CONFIG_KEY);
  } catch {
    return migrateConfig(sanitizeParams(null));
  }
  if (!raw) return migrateConfig(sanitizeParams(null));
  try {
    const fixed = migrateConfig(sanitizeParams(JSON.parse(raw)));
    // Auto-sanación: si lo saneado difiere de lo guardado, se persiste la versión corregida
    if (JSON.stringify(fixed) !== raw) saveConfig(fixed);
    return fixed;
  } catch {
    return migrateConfig(sanitizeParams(null));
  }
}

export function saveConfig(p: TerminalParams) {
  const clean = sanitizeParams(p);
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(clean));
  } catch { /* storage lleno o bloqueado — el POS sigue con la config en memoria */ }
}

// Carga de fábrica / descarga desde TMS: limpia storage y devuelve defaults saneados
export function resetConfig(): TerminalParams {
  try {
    localStorage.removeItem(CONFIG_KEY);
  } catch { /* sin storage */ }
  return migrateConfig(sanitizeParams(null));
}

// Perfil JSON importado desde la Consola TMS — lanza error si no es un objeto válido
export function parseConfigFile(text: string): TerminalParams {
  const obj: unknown = JSON.parse(text);
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) throw new Error("perfil inválido");
  return migrateConfig(sanitizeParams(obj));
}
