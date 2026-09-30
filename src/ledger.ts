// Capa de persistencia y validación del Swift Ledger · PosLink.
// Espejo robusto de src/config.ts: todo lo que entre o salga del ledger,
// liquidaciones, registry de dispositivos y deviceId pasa por saneamiento.
// Las tres vistas (POS, TMS, Swift Ledger) consumen únicamente estas APIs tipadas.

// ─── Tipos ───────────────────────────────────────────────────────────────────
export type NetworkStatus = "TERMINAL_UNCONFIGURED" | "STORE_AND_FORWARD" | "LINK_DOWN" | "CONNECTED";
export type LedgerSource = "POS_OFFLINE" | "MANUAL" | "VOICE";
export type LedgerStatus = "PENDING" | "SETTLED";

export interface LedgerEntry {
  id: string;
  ref: string;              // referencia de comerciante (máx. 12, regla del adquirente)
  authCode: string | null;
  time: string;
  amountCents: number;      // montos SIEMPRE en centavos enteros (integridad contable)
  currency: string;
  source: LedgerSource;
  status: LedgerStatus;
  detail: string;
}

export interface SettlementReport {
  id: string; fileName: string; time: string;
  records: number; matched: number; rejected: number; totalCents: number;
}

export interface DeviceRecord {
  deviceId: string; label: string; authorized: boolean; linkedAt: string;
}

export interface SettlementRecord { ref: string | null; amountCents: number | null }

// Dispositivo semilla del ambiente de certificación PosLink
export const CERT_DEVICE_ID = "android-acba2a93-d486-48b0-a226-fa6129a14817";
export const MERCHANT_REF_MAX = 12;

const LEDGER_KEY = "swift-ledger-entries";
const SETTLEMENTS_KEY = "swift-ledger-settlements";
const REGISTRY_KEY = "poslink-device-registry";
const DEVICE_KEY = "poslink-device-id";

export function nowMx() {
  return new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", hour12: false });
}

// ─── Reglas de dominio compartidas ───────────────────────────────────────────
// Referencia de comerciante: alfanumérica, mayúsculas, máx. 12 caracteres
export function normalizeMerchantRef(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, MERCHANT_REF_MAX);
}

// Convierte un monto capturado (unidades) a centavos enteros; null si no es un monto válido
export function parseToCents(s: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(s.trim())) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

// ─── Saneadores (mismo patrón que src/config.ts) ─────────────────────────────
function sanitizeLedgerEntry(raw: unknown): LedgerEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown> & { amount?: unknown };
  if (typeof e.id !== "string" || !e.id) return null;
  // Monto: amountCents entero > 0; legado: amount en unidades → se migra a centavos
  let amountCents: number | null = null;
  if (typeof e.amountCents === "number" && Number.isInteger(e.amountCents) && e.amountCents > 0) {
    amountCents = e.amountCents;
  } else if (typeof e.amount === "number" && Number.isFinite(e.amount) && e.amount > 0) {
    amountCents = Math.round(e.amount * 100);
  }
  if (amountCents === null) return null;
  const ref = normalizeMerchantRef(String(e.ref ?? ""));
  return {
    id: e.id,
    ref: ref || "—",
    authCode: typeof e.authCode === "string" && e.authCode ? e.authCode : null,
    time: typeof e.time === "string" && e.time ? e.time : "—",
    amountCents,
    currency: e.currency === "USD" ? "USD" : "MXN",
    source: e.source === "MANUAL" || e.source === "VOICE" ? e.source : "POS_OFFLINE",
    status: e.status === "SETTLED" ? "SETTLED" : "PENDING",
    detail: typeof e.detail === "string" ? e.detail.slice(0, 200) : "",
  };
}

function sanitizeSettlementReport(raw: unknown): SettlementReport | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || !s.id) return null;
  if (typeof s.fileName !== "string" || !s.fileName) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
  return {
    id: s.id,
    fileName: s.fileName.slice(0, 120),
    time: typeof s.time === "string" && s.time ? s.time : "—",
    records: num(s.records),
    matched: num(s.matched),
    rejected: num(s.rejected),
    totalCents: typeof s.totalCents === "number" && Number.isFinite(s.totalCents) && s.totalCents >= 0
      ? Math.round(s.totalCents) : 0,
  };
}

function sanitizeDeviceRecord(deviceId: string, raw: unknown): DeviceRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (d.deviceId !== deviceId) return null;
  return {
    deviceId,
    label: typeof d.label === "string" && d.label.trim() ? d.label.slice(0, 60) : "dispositivo",
    authorized: d.authorized === true,
    linkedAt: typeof d.linkedAt === "string" && d.linkedAt ? d.linkedAt : "—",
  };
}

// ─── Acceso a storage (resiliente: storage caído/lleno nunca revienta el POS) ──
function readKey(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

// ─── Ledger (Offline sale history + balances fiat) ───────────────────────────
export function loadLedger(): LedgerEntry[] {
  const raw = readKey(LEDGER_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];
    const clean = arr.map(sanitizeLedgerEntry).filter((e): e is LedgerEntry => e !== null);
    // Auto-sanación: si lo saneado difiere de lo guardado, se persiste la versión corregida
    if (JSON.stringify(clean) !== raw) saveLedgerEntries(clean);
    return clean;
  } catch { return []; }
}

export function saveLedgerEntries(entries: LedgerEntry[]) {
  const clean = entries.map(sanitizeLedgerEntry).filter((e): e is LedgerEntry => e !== null);
  try { localStorage.setItem(LEDGER_KEY, JSON.stringify(clean)); } catch { /* storage lleno/bloqueado */ }
}

// ─── Settlement reports ──────────────────────────────────────────────────────
export function loadSettlements(): SettlementReport[] {
  const raw = readKey(SETTLEMENTS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];
    const clean = arr.map(sanitizeSettlementReport).filter((s): s is SettlementReport => s !== null);
    if (JSON.stringify(clean) !== raw) saveSettlements(clean);
    return clean;
  } catch { return []; }
}

export function saveSettlements(s: SettlementReport[]) {
  const clean = s.map(sanitizeSettlementReport).filter((r): r is SettlementReport => r !== null);
  try { localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(clean)); } catch { /* storage lleno/bloqueado */ }
}

// ─── Registry PosLink: la red de la terminal solo existe si el dispositivo ───
// está aquí y autorizado. El dispositivo de certificación siempre se siembra.
function seedRegistry(): Record<string, DeviceRecord> {
  return {
    [CERT_DEVICE_ID]: {
      deviceId: CERT_DEVICE_ID,
      label: "Terminal certificación PosLink",
      authorized: true,
      linkedAt: "factory",
    },
  };
}

export function sanitizeRegistry(raw: unknown): Record<string, DeviceRecord> {
  const out = seedRegistry();
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const rec = sanitizeDeviceRecord(k, v);
      if (rec) out[k] = rec;
    }
  }
  return out;
}

export function loadRegistry(): Record<string, DeviceRecord> {
  const raw = readKey(REGISTRY_KEY);
  if (!raw) return seedRegistry();
  try {
    const clean = sanitizeRegistry(JSON.parse(raw));
    if (JSON.stringify(clean) !== raw) saveRegistry(clean);
    return clean;
  } catch { return seedRegistry(); }
}

export function saveRegistry(r: Record<string, DeviceRecord>) {
  try { localStorage.setItem(REGISTRY_KEY, JSON.stringify(sanitizeRegistry(r))); } catch { /* storage lleno/bloqueado */ }
}

// ─── DeviceId estable del navegador ──────────────────────────────────────────
function randHex(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

export function loadDeviceId(): string {
  const stored = readKey(DEVICE_KEY);
  if (stored && /^android-[a-z0-9-]{8,}$/.test(stored)) return stored;
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : [8, 4, 4, 4, 12].map((n) => randHex(n).toLowerCase()).join("-");
  const generated = `android-${uuid}`;
  try { localStorage.setItem(DEVICE_KEY, generated); } catch { /* sin storage — id volátil */ }
  return generated;
}

// ─── Estado de red: vínculo formal registry (ledger) ↔ config (offlineMode) ──
export function computeNetworkStatus(opts: {
  deviceAuthorized: boolean;
  offlineMode: boolean;
  echoOk: boolean | null;   // null = ECHO nunca ejecutado
}): NetworkStatus {
  if (!opts.deviceAuthorized) return "TERMINAL_UNCONFIGURED";
  if (opts.offlineMode) return "STORE_AND_FORWARD";
  if (opts.echoOk === false) return "LINK_DOWN";
  return "CONNECTED";
}

// ─── Parser de reportes de liquidación (JSON / CSV) ──────────────────────────
// Registros mal formados se RECHAZAN contando en `rejected`, nunca se concilian a medias.
export function parseSettlement(text: string, fileName: string): { records: SettlementRecord[]; rejected: number } {
  const trimmed = text.trim();
  let rejected = 0;
  const accept = (ref: string | null, amountCents: number | null): SettlementRecord | null => {
    const refOk = ref !== null && ref.length > 0 && ref.length <= MERCHANT_REF_MAX;
    const amtOk = amountCents !== null && Number.isInteger(amountCents) && amountCents > 0;
    if (!refOk && !amtOk) { rejected++; return null; }
    return { ref: refOk ? ref : null, amountCents: amtOk ? amountCents : null };
  };
  // Campo de monto: entero = centavos; con punto decimal = unidades (se convierte)
  const centsField = (v: unknown): number | null => {
    if (typeof v === "number") return Number.isInteger(v) ? v : Math.round(v * 100);
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (s.includes(".")) return parseToCents(s);
    const n = Number(s);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  if (fileName.toLowerCase().endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const data: unknown = JSON.parse(trimmed);
    const node = data as Record<string, unknown>;
    const arr = Array.isArray(data) ? data : (node.settlements ?? node.records ?? node.liquidacion ?? []);
    if (!Array.isArray(arr)) return { records: [], rejected: 0 };
    const records = arr.map((r) => {
      const o = r as Record<string, unknown>;
      const ref = o.ref ?? o.reference ?? o.referencia ?? null;
      const amountCents = centsField(o.amountCents ?? o.amount_cents ?? o.centavos ?? o.amount ?? o.total ?? o.monto);
      return accept(ref === null ? null : normalizeMerchantRef(String(ref)), amountCents);
    }).filter((r): r is SettlementRecord => r !== null);
    return { records, rejected };
  }
  // CSV: ref,amount_cents por línea (segunda columna con punto = unidades)
  const records = trimmed.split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^ref(erencia)?[;,]/i.test(l))
    .map((l) => {
      const [a, b] = l.split(/[;,]/).map((s) => s.trim());
      return accept(a ? normalizeMerchantRef(a) : null, centsField(b ?? ""));
    })
    .filter((r): r is SettlementRecord => r !== null);
  return { records, rejected };
}
