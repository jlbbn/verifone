import { useState, useEffect, useMemo, useRef } from "react";
import {
  Wifi, Signal, Nfc, Battery, Printer, CreditCard, Terminal,
  Delete, RotateCcw, FlaskConical, Receipt, CheckCircle, XCircle,
  Lock, ChevronUp, ChevronDown, Send, Download, Upload,
  Landmark, Database, Plus, ArrowRightLeft, FileText, Smartphone,
} from "lucide-react";
import {
  FEATURE_FLAGS, PROTOCOLS, EMV_AIDS,
  SUPERVISOR_PASSWORD, protocolInfo, loadQueue, saveQueue, MODEL_PROFILES,
} from "./params";
import { loadConfig, saveConfig, resetConfig, parseConfigFile } from "./config";
import {
  MERCHANT_REF_MAX, nowMx, normalizeMerchantRef, parseToCents,
  loadLedger, saveLedgerEntries, loadSettlements, saveSettlements,
  loadRegistry, saveRegistry, loadDeviceId, parseSettlement, computeNetworkStatus,
} from "./ledger";
import type { TerminalParams, TerminalModel, CommMode, QueuedTxn } from "./params";
import type { NetworkStatus, LedgerEntry, LedgerStatus, LedgerSource, SettlementReport, DeviceRecord } from "./ledger";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Screen =
  | "IDLE" | "MONTO" | "TARJETA" | "PROCESANDO" | "APROBADO" | "DECLINADO" | "ERROR_RED"
  | "PWD" | "SYSMENU" | "SYS_REPORTE" | "SYS_COMMS" | "SYS_CONFIG" | "SYS_CARGA" | "SYS_ACERCA"
  | "SYS_LOTE" | "SYS_ECHO";

type EntryMode = "CHIP" | "CTLS" | "BANDA";

interface TxnReceipt {
  code: string | null; ref: string; time: string; total: number; approved: boolean; mode: EntryMode | null;
  queued?: boolean;
}

interface LogEntry {
  id: number; time: string; kind: "tx" | "rx" | "err" | "info"; text: string;
}

const MODEL_STYLES: Record<TerminalModel, { body: string; edge: string; screen: string; label: string }> = {
  VX520:       { body: "bg-gradient-to-b from-[#3a4250] to-[#23282f]", edge: "border-[#14171c]", screen: "bg-[#b8d94e]", label: "Verifone VX520" },
  P400:        { body: "bg-gradient-to-b from-[#1c1e24] to-[#0c0d10]", edge: "border-[#000000]", screen: "bg-[#0d2237]", label: "Verifone P400" },
  E280S:       { body: "bg-gradient-to-b from-[#e6e8ec] to-[#c9ccd4]", edge: "border-[#9aa0ab]", screen: "bg-[#123a2a]", label: "Verifone e280s" },
  SUNMI_V3:      { body: "bg-gradient-to-b from-[#1d2733] to-[#0b1018]", edge: "border-[#05080c]", screen: "bg-[#0e1a26]", label: "SUNMI V3" },
  SUNMI_V3_PLUS: { body: "bg-gradient-to-b from-[#22303f] to-[#0d141d]", edge: "border-[#060a0f]", screen: "bg-[#10202f]", label: "SUNMI V3 PLUS" },
  SUNMI_V3_MIX:  { body: "bg-gradient-to-b from-[#2b3540] to-[#141b23]", edge: "border-[#0a0e13]", screen: "bg-[#122334]", label: "SUNMI V3 MIX" },
};

const FUNCIONES = [
  "REPORTE PARAMETROS",
  "MODO COMUNICACION",
  "CONFIG TERMINAL",
  "CARGA PARAM",
  "ACERCA DE",
  "CIERRE DE LOTE",
  "PRUEBA DE CONEXIÓN",
] as const;

const COMM_MODES: CommMode[] = ["ETHERNET", "DIAL", "GPRS"];

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function digitsToAmount(digits: string) {
  return digits ? parseInt(digits, 10) / 100 : 0;
}
function randNum(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10).toString()).join("");
}
function randHex(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join("");
}
function detectBrand(cardNumber: string): string {
  const c = cardNumber.replace(/\D/g, "");
  if (c.startsWith("4")) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(c)) return "MASTERCARD";
  if (/^3[47]/.test(c)) return "AMEX";
  return "CARNET";
}
function maskCard(s: string) {
  const c = s.replace(/\D/g, "");
  if (!c) return "**** **** **** ****";
  return c.replace(/.(?=.{4})/g, "*").replace(/(.{4})/g, "$1 ").trim();
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function Panel({ title, desc, children, className = "" }: { title: string; desc?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {desc && <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8322b]/30 focus:border-[#c8322b]";

function Toggle({ checked, onChange, label, compact }: { checked: boolean; onChange: (v: boolean) => void; label: string; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${compact ? "gap-2" : ""}`}>
      <label className={`${compact ? "text-[10px]" : "text-xs"} font-medium text-gray-600`}>{label}</label>
      <button
        onClick={() => onChange(!checked)}
        className={`${compact ? "w-7 h-4" : "w-9 h-5"} rounded-full transition-colors relative flex-shrink-0 ${checked ? "bg-[#c8322b]" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 ${compact ? "w-3 h-3" : "w-4 h-4"} rounded-full bg-white shadow transition-all ${checked ? (compact ? "left-[14px]" : "left-[18px]") : "left-0.5"}`} />
      </button>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState<TerminalParams>(loadConfig);
  const [screen, setScreen] = useState<Screen>("IDLE");
  const [amountDigits, setAmountDigits] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [txn, setTxn] = useState<TxnReceipt | null>(null);
  const [report, setReport] = useState<string[] | null>(null);
  const [receiptKind, setReceiptKind] = useState<"venta" | "reporte" | "lote">("venta");
  const [queue, setQueue] = useState<QueuedTxn[]>(loadQueue);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [echoResult, setEchoResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [aidError, setAidError] = useState<string | null>(null);
  const [idleNotice, setIdleNotice] = useState<string | null>(null);
  const [clock, setClock] = useState(new Date());
  const [toast, setToast] = useState<string | null>(null);
  // Swift Ledger · PosLink (estado global compartido POS ↔ Ledger)
  const [view, setView] = useState<"POS" | "LEDGER">("POS");
  const [posMirror, setPosMirror] = useState(true);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(loadLedger);
  const [settlements, setSettlements] = useState<SettlementReport[]>(loadSettlements);
  const [registry, setRegistry] = useState<Record<string, DeviceRecord>>(loadRegistry);
  const [deviceId] = useState(loadDeviceId);
  // Modo sistema
  const [pwdDigits, setPwdDigits] = useState("");
  const [pwdError, setPwdError] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [commIndex, setCommIndex] = useState(0);
  const [portEdit, setPortEdit] = useState<string | null>(null);
  const [hostEdit, setHostEdit] = useState<string | null>(null);
  const [flagIndex, setFlagIndex] = useState(0);
  const [cargaProgress, setCargaProgress] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [declineReason, setDeclineReason] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logId = useRef(0);
  const consoleRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { saveConfig(config); }, [config]);
  useEffect(() => { saveQueue(queue); }, [queue]);
  useEffect(() => { saveLedgerEntries(ledgerEntries); }, [ledgerEntries]);
  useEffect(() => { saveSettlements(settlements); }, [settlements]);
  useEffect(() => { saveRegistry(registry); }, [registry]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Autoscroll del monitor de red
  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight });
  }, [logs]);

  function log(kind: LogEntry["kind"], text: string) {
    const time = new Date().toLocaleTimeString("es-MX", { hour12: false, timeZone: "America/Mexico_City" });
    setLogs((prev) => [...prev.slice(-199), { id: ++logId.current, time, kind, text }]);
  }

  const set = <K extends keyof TerminalParams>(key: K, value: TerminalParams[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const amount = digitsToAmount(amountDigits);
  const tip = amount * (config.tipPercent / 100);
  const total = amount + tip;
  const proto = protocolInfo(config.protocol);
  const authLen = proto.authDigits ?? 6;
  const authRequired = config.flags["AUTH REQUERIDO"];
  const validateProto = config.flags["VALIDAR PROTOCOLO"];
  const proto101Enabled = config.flags["PROTO 101.1"];
  const style = MODEL_STYLES[config.model];
  const modelProfile = MODEL_PROFILES[config.model];
  const isLight = config.model === "E280S";
  const screenDark = config.model !== "VX520";
  const dim = config.brightness / 100;

  // ── PosLink: vinculación dispositivo ↔ registry (obligatoria para despachar) ──
  // computeNetworkStatus une el registry (capa ledger) con offlineMode (capa config)
  const deviceAuthorized = registry[deviceId]?.authorized === true;
  const networkStatus: NetworkStatus = computeNetworkStatus({
    deviceAuthorized,
    offlineMode: config.offlineMode,
    echoOk: echoResult ? echoResult.ok : null,
  });

  // Balances fiat derivados del ledger (centavos) — jamás se editan a mano
  const fiatBalances = useMemo(() => {
    const acc: Record<string, { pendingCents: number; settledCents: number }> = {};
    for (const e of ledgerEntries) {
      const b = (acc[e.currency] ??= { pendingCents: 0, settledCents: 0 });
      if (e.status === "PENDING") b.pendingCents += e.amountCents;
      else b.settledCents += e.amountCents;
    }
    return acc;
  }, [ledgerEntries]);
  const ledgerPending = ledgerEntries.reduce((n, e) => n + (e.status === "PENDING" ? 1 : 0), 0);

  // ── Ledger: altas y conciliación ────────────────────────────────────────────
  // Cap de 300 entradas: se recortan primero las SETTLED más viejas; una PENDING
  // jamás se tumba aquí — espeja la cola offline y los balances fiat.
  function addLedgerEntry(entry: LedgerEntry) {
    setLedgerEntries((prev) => {
      const next = [...prev, entry];
      if (next.length <= 300) return next;
      const oldestSettled = next.findIndex((e) => e.status === "SETTLED");
      if (oldestSettled >= 0) next.splice(oldestSettled, 1);
      return next;
    });
    log("info", `SWIFT LEDGER ← ${entry.source} · ${entry.ref} · ${entry.currency} ${entry.amountCents}¢ [${entry.status}]`);
  }

  // Captura manual / por voz (Offline FiatLedger) — valida ref ≤ 12 y monto en centavos
  function addManualEntry(input: { amount: string; ref: string; source: "MANUAL" | "VOICE"; note: string }): string | null {
    const normalizedRef = normalizeMerchantRef(input.ref);
    if (input.ref.trim() && !normalizedRef) return "Referencia inválida — alfanumérica, máx. 12 caracteres";
    const amountCents = parseToCents(input.amount);
    if (amountCents === null) return "Monto inválido — usa formato 0.00 (se almacena en centavos)";
    const ref = normalizedRef || `MAN${randNum(9)}`;
    // Auth telefónica: solo dígitos, máx. 6 — el resto de la nota es detalle
    const authDigits = input.note.replace(/\D/g, "").slice(0, 6);
    addLedgerEntry({
      id: `M${Date.now()}${randNum(3)}`,
      ref,
      authCode: authDigits || null,
      time: nowMx(),
      amountCents,
      currency: config.currency,
      source: input.source,
      status: "PENDING",
      detail: input.note.trim() || (input.source === "VOICE" ? "Venta por voz · auth telefónica" : "Venta manual · proto 1643"),
    });
    setToast(`Ledger: ${input.source === "VOICE" ? "venta por voz" : "venta manual"} ${ref} · ${config.currency} $${fmt(amountCents / 100)}`);
    return null;
  }

  // Conciliación: cruza el reporte contra los PENDING por referencia (o monto exacto en centavos)
  function importSettlement(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { records, rejected } = parseSettlement(String(reader.result), file.name);
        if (records.length === 0 && rejected === 0) throw new Error("sin registros");
        const next = [...ledgerEntries];
        let matched = 0;
        let mismatched = 0;
        let totalCents = 0;
        for (const r of records) {
          const idx = next.findIndex((e) =>
            e.status === "PENDING" && (r.ref ? e.ref === r.ref : r.amountCents !== null && e.amountCents === r.amountCents)
          );
          // Integridad contable: si el reporte trae ref Y monto, ambos deben coincidir —
          // una liquidación por referencia con monto distinto se rechaza, nunca se concilia a medias
          if (idx >= 0 && r.ref && r.amountCents !== null && next[idx].amountCents !== r.amountCents) {
            log("err", `SWIFT LEDGER: ${file.name} ref ${r.ref} — ${r.amountCents}¢ del reporte no coincide con ${next[idx].amountCents}¢ pendiente · RECHAZADA`);
            mismatched++;
            continue;
          }
          if (idx >= 0) {
            next[idx] = { ...next[idx], status: "SETTLED", detail: `${next[idx].detail} · conciliada (${file.name})` };
            matched++;
            totalCents += next[idx].amountCents;
          }
        }
        setLedgerEntries(next);
        setSettlements((prev) => [...prev.slice(-49), {
          id: `ST${Date.now()}`, fileName: file.name, time: nowMx(),
          records: records.length + rejected, matched, rejected: rejected + mismatched, totalCents,
        }]);
        log("info", `SWIFT LEDGER: liquidación ${file.name} — ${matched} conciliadas · ${rejected + mismatched} rechazadas${mismatched ? ` (${mismatched} por mismatch de monto)` : ""} · $${fmt(totalCents / 100)}`);
        setToast(`Liquidación ${file.name}: ${matched} conciliadas${rejected + mismatched ? ` · ${rejected + mismatched} rechazadas` : ""}`);
      } catch {
        log("err", `SWIFT LEDGER: ${file.name} no es un reporte JSON/CSV válido`);
        setToast("Error: reporte de liquidación inválido");
      }
    };
    reader.readAsText(file);
  }

  // Vincular / desvincular el dispositivo actual contra el registry PosLink
  function setDeviceLink(authorized: boolean) {
    setRegistry((prev) => ({
      ...prev,
      [deviceId]: {
        deviceId,
        label: `${MODEL_STYLES[config.model].label} · ${config.terminalId}`,
        authorized,
        linkedAt: nowMx(),
      },
    }));
    log(authorized ? "info" : "err", `POSLINK REGISTRY: ${deviceId} ${authorized ? "VINCULADO/AUTORIZADO" : "DESVINCULADO — terminal pasa a TERMINAL_UNCONFIGURED"}`);
    setToast(authorized ? "Dispositivo vinculado al registry PosLink" : "Dispositivo desvinculado — TERMINAL_UNCONFIGURED");
  }

  // ── Consola TMS: Push / Export / Import ─────────────────────────────────────
  function pushToTerminal() {
    log("info", `TMS PUSH → inyectando ${Object.keys(config.flags).length} parámetros al terminal ${config.terminalId}`);
    setScreen("SYS_CARGA");
    setCargaProgress(0);
    const t0 = Date.now();
    const iv = setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - t0) / 2200) * 100));
      setCargaProgress(pct);
      if (pct >= 100) {
        clearInterval(iv);
        // El aprovisionamiento TMS vincula el dispositivo PosLink (sale de TERMINAL_UNCONFIGURED)
        if (!deviceAuthorized) setDeviceLink(true);
        setToast("Configuración inyectada al terminal");
        setTimeout(() => setScreen("IDLE"), 600);
      }
    }, 60);
  }

  function exportProfile() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verifone-${config.terminalId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast(`Perfil exportado: verifone-${config.terminalId}.json`);
  }

  function importProfile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = parseConfigFile(String(reader.result));
        setConfig(obj);
        setToast(`Perfil importado desde ${file.name}`);
        log("info", `Perfil JSON importado: ${file.name} (validado por la capa de config)`);
      } catch {
        setToast("Error: el archivo no es un perfil válido");
        log("err", `Error al importar ${file.name}: no es un perfil JSON válido`);
      }
    };
    reader.readAsText(file);
  }

  // ── Acciones de sistema ─────────────────────────────────────────────────────
  function openFunction(i: number) {
    switch (FUNCIONES[i]) {
      case "REPORTE PARAMETROS":
        setScreen("SYS_REPORTE");
        setPrinting(true);
        setTimeout(() => {
          setReport(buildReport());
          setReceiptKind("reporte");
          setPrinting(false);
          setScreen("SYSMENU");
        }, 1400);
        break;
      case "MODO COMUNICACION": setCommIndex(0); setPortEdit(null); setHostEdit(null); setScreen("SYS_COMMS"); break;
      case "CONFIG TERMINAL": setFlagIndex(0); setScreen("SYS_CONFIG"); break;
      case "CARGA PARAM": {
        setScreen("SYS_CARGA");
        setCargaProgress(0);
        const t0 = Date.now();
        const iv = setInterval(() => {
          const pct = Math.min(100, Math.round(((Date.now() - t0) / 3000) * 100));
          setCargaProgress(pct);
          if (pct >= 100) {
            clearInterval(iv);
            setConfig(resetConfig());
            setToast("Parámetros descargados desde TMS");
            setTimeout(() => setScreen("SYSMENU"), 600);
          }
        }, 60);
        break;
      }
      case "ACERCA DE": setScreen("SYS_ACERCA"); break;
      case "CIERRE DE LOTE": settleBatch(); break;
      case "PRUEBA DE CONEXIÓN": echoTest(); break;
    }
  }

  function buildReport(): string[] {
    return [
      "*** REPORTE DE PARAMETROS ***",
      `TERMINAL: ${config.terminalId}`,
      `SERIE: ${config.serial}`,
      `COMERCIO: ${config.merchant}`,
      `APP: ${config.appVersion}`,
      `OS: ${config.osVersion}`,
      "──────────────────────────",
      `MODO COMM: ${config.commMode}`,
      `HOST: ${config.host}`,
      `PUERTO: ${config.port}`,
      `SSL: ${config.ssl ? "SI" : "NO"}`,
      `TMS: ${config.tmsId}`,
      `TOKEN: ${config.authToken ? `****${config.authToken.slice(-4)}` : "NO CONFIGURADO"}`,
      `MODO: ${config.offlineMode ? "SIMULACION" : "RED REAL"}`,
      "──────────────────────────",
      ...FEATURE_FLAGS.map((f) => `${f.padEnd(18, ".")} ${config.flags[f] ? "SI" : "NO"}`),
      "──────────────────────────",
      `MONEDA: ${config.currency}`,
      `PROTOCOLO: ${config.protocol} ${proto.name}`,
      `AUTH REQUERIDO: ${authRequired ? `${authLen} DÍGITOS` : "NO"}`,
      new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", hour12: false }),
    ];
  }

  // ── Teclado ─────────────────────────────────────────────────────────────────
  function pressDigit(d: string) {
    if (screen === "IDLE" || screen === "MONTO") {
      if (screen === "IDLE") setScreen("MONTO");
      setAmountDigits((prev) => (prev.length >= 9 ? prev : prev + d));
      return;
    }
    if (screen === "PWD") {
      setPwdDigits((prev) => (prev.length >= 6 ? prev : prev + d));
      return;
    }
    if (screen === "SYSMENU") {
      const n = parseInt(d, 10);
      if (n >= 1 && n <= FUNCIONES.length) { setMenuIndex(n - 1); openFunction(n - 1); return; }
    }
    if (screen === "SYS_COMMS" && hostEdit !== null) {
      setHostEdit((prev) => (prev !== null && prev.length < 15 ? prev + d : prev));
      return;
    }
    if (screen === "SYS_COMMS" && portEdit !== null) {
      setPortEdit((prev) => (prev !== null && prev.length < 5 ? prev + d : prev));
      return;
    }
    // 2 = arriba, 8 = abajo en los menús
    if (screen === "SYSMENU" || screen === "SYS_COMMS" || screen === "SYS_CONFIG") {
      if (d === "2") moveSelection(-1);
      else if (d === "8") moveSelection(1);
    }
  }

  function pressDotOrDoubleZero() {
    // Editando el HOST, la tecla 00 funciona como punto decimal de la IP
    if (screen === "SYS_COMMS" && hostEdit !== null) {
      setHostEdit((prev) => (prev !== null && prev.length < 15 ? prev + "." : prev));
      return;
    }
    pressDigit("0");
    pressDigit("0");
  }

  function moveSelection(dir: number) {
    if (screen === "SYSMENU") setMenuIndex((i) => (i + dir + FUNCIONES.length) % FUNCIONES.length);
    else if (screen === "SYS_COMMS") setCommIndex((i) => (i + dir + 5) % 5);
    else if (screen === "SYS_CONFIG") setFlagIndex((i) => (i + dir + FEATURE_FLAGS.length) % FEATURE_FLAGS.length);
  }

  function pressClear() {
    if (screen === "MONTO" || screen === "IDLE") setAmountDigits((prev) => prev.slice(0, -1));
    else if (screen === "PWD") setPwdDigits((prev) => prev.slice(0, -1));
    else if (screen === "SYS_COMMS" && hostEdit !== null) setHostEdit((prev) => prev !== null ? prev.slice(0, -1) : null);
    else if (screen === "SYS_COMMS" && portEdit !== null) setPortEdit((prev) => prev !== null ? prev.slice(0, -1) : null);
  }

  function pressCancel() {
    switch (screen) {
      case "MONTO": case "TARJETA":
        setScreen("IDLE"); setAmountDigits(""); setEntryMode(null); break;
      case "PWD": setScreen("IDLE"); setPwdDigits(""); setPwdError(false); break;
      case "SYSMENU": setScreen("IDLE"); break;
      case "SYS_COMMS":
        if (hostEdit !== null) setHostEdit(null);
        else if (portEdit !== null) setPortEdit(null);
        else setScreen("SYSMENU");
        break;
      case "SYS_CONFIG": case "SYS_ACERCA": case "SYS_ECHO": setScreen("SYSMENU"); break;
      default: break;
    }
  }

  function pressF() {
    if (screen === "IDLE" || screen === "MONTO") {
      setScreen("PWD");
      setPwdDigits("");
      setPwdError(false);
    }
  }

  function pressEnter() {
    switch (screen) {
      case "MONTO":
        if (amount <= 0) break;
        if (config.protocol === "101.1" && !proto101Enabled) {
          setToast("Protocolo 101.1 deshabilitado — actívalo en CONFIG TERMINAL o en la consola");
          break;
        }
        setScreen("TARJETA");
        break;
      case "TARJETA": if (entryMode && !aidError) runAuthorization(); break;
      case "APROBADO": case "DECLINADO":
        setScreen("IDLE"); setAmountDigits(""); setEntryMode(null); break;
      case "PWD":
        if (pwdDigits === SUPERVISOR_PASSWORD) {
          setScreen("SYSMENU"); setMenuIndex(0); setPwdDigits("");
        } else {
          setPwdError(true);
          setPwdDigits("");
          setTimeout(() => setPwdError(false), 1200);
        }
        break;
      case "SYSMENU": openFunction(menuIndex); break;
      case "SYS_COMMS": commEnter(); break;
      case "SYS_CONFIG": toggleFlag(FEATURE_FLAGS[flagIndex]); break;
      case "SYS_ACERCA": case "SYS_ECHO": setScreen("SYSMENU"); break;
      default: break;
    }
  }

  function commEnter() {
    switch (commIndex) {
      case 0: { // MODO
        const next = COMM_MODES[(COMM_MODES.indexOf(config.commMode) + 1) % COMM_MODES.length];
        set("commMode", next);
        break;
      }
      case 1: // HOST
        if (hostEdit === null) setHostEdit("");
        else if (hostEdit.trim()) { set("host", hostEdit); setHostEdit(null); }
        break;
      case 2: // PUERTO
        if (portEdit === null) setPortEdit("");
        else { set("port", parseInt(portEdit || "0", 10)); setPortEdit(null); }
        break;
      case 3: set("ssl", !config.ssl); break;
      default: break; // TMS ID solo lectura (se edita desde la consola)
    }
  }

  function toggleFlag(flag: string) {
    setConfig((c) => ({ ...c, flags: { ...c.flags, [flag]: !c.flags[flag] } }));
  }

  // Selección de modo de lectura con validaciones EMV / fallback
  function selectEntryMode(mode: EntryMode) {
    if (mode === "BANDA") {
      if (!config.flags["MAGSTRIPE FALLBACK"]) {
        log("err", "OPERACIÓN RESTRINGIDA: banda magnética deshabilitada (MAGSTRIPE FALLBACK = NO)");
        setScreen("IDLE");
        setAmountDigits("");
        setEntryMode(null);
        setIdleNotice("OPERACIÓN RESTRINGIDA — USE CHIP");
        setTimeout(() => setIdleNotice(null), 2500);
        return;
      }
      setAidError(null);
      setEntryMode(mode);
      return;
    }
    // CHIP / CTLS: validar AID de la marca contra los perfiles EMV habilitados
    const brand = detectBrand(config.cardNumber);
    if (!config.emvAids[brand]) {
      setEntryMode(mode);
      setAidError(`AID NO HABILITADO: ${brand} — USE OTRA TARJETA`);
      log("err", `EMV: AID ${brand} no habilitado en esta terminal`);
      return;
    }
    setAidError(null);
    setEntryMode(mode);
  }

  // ── Network layer: autorización contra el motor central ─────────────────────
  function buildSaleBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      mti: "0200",
      processingCode: proto.processingCode,
      protocol: config.protocol,
      operation: proto.name,
      amount: total,
      tip,
      currency: config.currency,
      terminalId: config.terminalId,
      merchant: config.merchant,
      serial: config.serial,
      cardNumber: maskCard(config.cardNumber),
      cardholder: config.holderName.toUpperCase(),
      cardBrand: detectBrand(config.cardNumber),
      entryMode,
      timestamp: new Date().toISOString(),
    };
    // Si hay llaves inyectadas, el mensaje viaja "encriptado" (pinBlock + MAC)
    if (config.ksn.trim()) {
      body.crypto = { scheme: config.cryptoScheme, ksn: config.ksn };
      body.pinBlock = randHex(16);
      body.mac = randHex(8);
    }
    return body;
  }

  function localAuthCode(): string | null {
    if (!authRequired) return null;
    const manual = config.authCode.trim();
    const manualOk = validateProto ? manual.length === authLen : manual.length > 0;
    return manualOk ? manual : randNum(authLen);
  }

  function declineOffline(reason: string, baseTxn: { ref: string; time: string; total: number; mode: EntryMode | null }) {
    setDeclineReason(reason);
    log("err", `VENTA OFFLINE RECHAZADA: ${reason} ($${fmt(total)})`);
    setTxn({ ...baseTxn, code: null, approved: false });
    setReceiptKind("venta");
    setScreen("DECLINADO");
  }

  // Venta forzada con controles de riesgo offline (floor limits)
  function attemptForcedSale(body: Record<string, unknown>, baseTxn: { ref: string; time: string; total: number; mode: EntryMode | null }) {
    if (total > config.offlineMaxAmount) {
      declineOffline(`EXCEDE LÍMITE OFFLINE (TOPE $${fmt(config.offlineMaxAmount)})`, baseTxn);
      return;
    }
    if (queue.length >= config.offlineMaxQueue) {
      declineOffline("MEMORIA LLENA — HAGA CIERRE DE LOTE", baseTxn);
      return;
    }
    // Metadatos Store & Forward: AuthCode + BankReference + Timestamp quedan sellados en el registro local
    const authCode = localAuthCode();
    const ref = normalizeMerchantRef(baseTxn.ref);
    const item: QueuedTxn = {
      id: `Q${Date.now()}${randNum(3)}`,
      body,
      total,
      time: baseTxn.time,
      ref,
      authCode,
    };
    setQueue((q) => {
      const next = [...q, item];
      log("info", `VENTA FORZADA guardada en cola offline (${next.length}/${config.offlineMaxQueue}) — se enviará en CIERRE DE LOTE`);
      return next;
    });
    // Store & Forward → el Ledger refleja la venta como PENDING desde este instante
    addLedgerEntry({
      id: item.id,
      ref,
      authCode,
      time: baseTxn.time,
      amountCents: Math.round(total * 100),
      currency: config.currency,
      source: "POS_OFFLINE",
      status: "PENDING",
      detail: `${proto.name} forzada offline · ${baseTxn.mode ?? "—"} · ${maskCard(config.cardNumber)}`,
    });
    setTxn({ ...baseTxn, code: authCode, approved: true, queued: true });
    setReceiptKind("venta");
    setScreen("APROBADO");
    setToast(`${proto.name} forzada offline · ${config.currency} $${fmt(total)} · pendiente de envío`);
  }

  async function runAuthorization() {
    setScreen("PROCESANDO");
    setDeclineReason(null);

    const baseTxn = {
      ref: `VF${randNum(10)}`,
      time: new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", hour12: false }),
      total,
      mode: entryMode,
    };
    const body = buildSaleBody();

    // PosLink: sin vínculo autorizado en el registry NO hay despacho remoto — solo store & forward
    if (!deviceAuthorized) {
      log("err", `TERMINAL_UNCONFIGURED — ${deviceId} no está enlazado/autorizado en el PosLink registry; despacho remoto bloqueado`);
      setTimeout(() => attemptForcedSale(body, baseTxn), 1200);
      return;
    }

    // Modo offline: el POS no se bloquea — aprueba como venta forzada y encola
    if (config.offlineMode) {
      log("info", `MODO OFFLINE — venta forzada local (${proto.name} $${fmt(total)})`);
      setTimeout(() => attemptForcedSale(body, baseTxn), 1200);
      return;
    }

    // Petición real: URL y esquema se construyen con los parámetros de red
    const url = `${config.ssl ? "https" : "http"}://${config.host}:${config.port}/api/engine/sales/forced`;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    log("tx", `→ POST ${url}`);
    log("info", `  Headers: Content-Type: application/json · Authorization: Bearer ${config.authToken ? `****${config.authToken.slice(-4)}` : "(VACÍO)"}`);
    log("tx", `  Body: ${JSON.stringify(body)}`);
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.authToken}`,
        },
        body: JSON.stringify(body),
      });
      clearTimeout(timeout);
      log("rx", `← HTTP ${res.status} ${res.statusText}`);
      const rawText = await res.text();
      if (rawText) log("rx", `  ${rawText}`);
      else log("rx", "  (respuesta sin cuerpo)");
      if (res.status === 200 || res.status === 201) {
        let serverCode: string | null = null;
        try {
          const data = JSON.parse(rawText);
          serverCode = data.authCode ?? data.auth_code ?? data.authorization ?? null;
        } catch { /* respuesta sin cuerpo JSON */ }
        const code = serverCode ?? localAuthCode();
        setTxn({ ...baseTxn, code, approved: true });
        setReceiptKind("venta");
        setScreen("APROBADO");
        setToast(`${proto.name} aprobada · Auth ${code ?? "NO REQUERIDO"} · ${config.currency} $${fmt(total)}`);
      } else if (res.status === 401) {
        setDeclineReason("TOKEN INVÁLIDO · RECHAZO DE RED (401)");
        setTxn({ ...baseTxn, code: null, approved: false });
        setReceiptKind("venta");
        setScreen("DECLINADO");
      } else {
        setDeclineReason(`RECHAZO DE RED · HTTP ${res.status}`);
        setTxn({ ...baseTxn, code: null, approved: false });
        setReceiptKind("venta");
        setScreen("DECLINADO");
      }
    } catch (e) {
      clearTimeout(timeout);
      // Sin red (CORS / host caído / timeout): comportamiento de POS real —
      // aprueba como venta forzada y guarda en la cola para el cierre de lote
      const isTimeout = e instanceof DOMException && e.name === "AbortError";
      log("err", `[NETWORK FATAL ERROR] ${isTimeout ? "Timeout de 8s excedido" : String(e)} — posible CORS, host inalcanzable o puerto cerrado (${url})`);
      attemptForcedSale(body, baseTxn);
    }
  }

  // ── Prueba de conexión (Logon / Echo · MTI 0800) ────────────────────────────
  async function echoTest() {
    setScreen("SYS_ECHO");
    setEchoResult(null);
    const url = `${config.ssl ? "https" : "http"}://${config.host}:${config.port}/api/engine/echo`;
    if (config.offlineMode) {
      log("info", "ECHO (MTI 0800): modo offline activo — no se prueba la red");
      setEchoResult({ ok: false, detail: "MODO OFFLINE ACTIVO" });
      return;
    }
    const body = {
      mti: "0800",
      networkMgmt: "LOGON",
      terminalId: config.terminalId,
      serial: config.serial,
      crypto: config.ksn.trim() ? { scheme: config.cryptoScheme, ksn: config.ksn } : null,
      timestamp: new Date().toISOString(),
    };
    log("tx", `→ POST ${url} (ECHO · MTI 0800)`);
    log("tx", `  Body: ${JSON.stringify(body)}`);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.authToken}`,
        },
        body: JSON.stringify(body),
      });
      clearTimeout(timeout);
      log("rx", `← HTTP ${res.status} ${res.statusText} (ECHO)`);
      const rawText = await res.text();
      if (rawText) log("rx", `  ${rawText}`);
      if (res.status === 200 || res.status === 201) {
        setEchoResult({ ok: true, detail: `HTTP ${res.status} · LLAVES Y TOKEN OK` });
      } else if (res.status === 401) {
        setEchoResult({ ok: false, detail: "HTTP 401 · TOKEN INVÁLIDO" });
      } else {
        setEchoResult({ ok: false, detail: `HTTP ${res.status} · RECHAZO DE RED` });
      }
    } catch (e) {
      clearTimeout(timeout);
      log("err", `[NETWORK FATAL ERROR] ${String(e)} (ECHO) — host inalcanzable o CORS (${url})`);
      setEchoResult({ ok: false, detail: "SIN RESPUESTA DEL HOST" });
    }
  }

  // ── Cierre de lote: vacía la cola offline contra el motor ───────────────────
  async function settleBatch() {
    if (queue.length === 0) {
      log("info", "CIERRE DE LOTE: cola vacía, nada que enviar");
      setToast("Lote vacío — no hay ventas forzadas pendientes");
      setScreen("SYSMENU");
      return;
    }
    // PosLink: un lote ES despacho remoto — prohibido sin vínculo autorizado. La cola se conserva intacta.
    if (!deviceAuthorized) {
      log("err", `CIERRE DE LOTE BLOQUEADO — TERMINAL_UNCONFIGURED (${deviceId} no autorizado en PosLink registry)`);
      setToast("TERMINAL_UNCONFIGURED — vincula el dispositivo (TMS Push o Device registry)");
      setScreen("SYSMENU");
      return;
    }
    const items = [...queue];
    // Payload estructurado idéntico al que espera el Ledger del servidor (montos en centavos)
    const batchPayload = {
      batchId: `B${Date.now()}`,
      deviceId,
      terminalId: config.terminalId,
      merchant: config.merchant,
      currency: config.currency,
      count: items.length,
      totalCents: items.reduce((a, q) => a + Math.round(q.total * 100), 0),
      items: items.map((q) => ({
        queueId: q.id,
        ref: q.ref ?? normalizeMerchantRef(String(q.body.ref ?? q.id)),
        authCode: q.authCode ?? null,
        amountCents: Math.round(q.total * 100),
        timestamp: q.body.timestamp ?? q.time,
        entryMode: q.body.entryMode ?? null,
        card: q.body.cardNumber ?? null,
      })),
    };
    const url = `${config.ssl ? "https" : "http"}://${config.host}:${config.port}/api/engine/sales/forced`;
    setScreen("SYS_LOTE");
    setBatchProgress({ current: 0, total: items.length });
    log("info", `CIERRE DE LOTE ${batchPayload.batchId}: enviando ${items.length} transacción(es) · ${batchPayload.totalCents}¢ a ${url}`);
    log("tx", `  Settlement payload: ${JSON.stringify(batchPayload)}`);

    let sent = 0;
    const failed: QueuedTxn[] = [];
    for (let i = 0; i < items.length; i++) {
      const q = items[i];
      setBatchProgress({ current: i + 1, total: items.length });
      if (config.offlineMode) {
        // Simulación: el host acepta localmente el mismo payload estructurado
        log("tx", `→ [SIMULACIÓN] ${batchPayload.batchId} item ${i + 1}/${items.length} · ${q.ref ?? q.id} · ${Math.round(q.total * 100)}¢`);
        log("rx", `← 200 OK (host simulado) [LOTE ${i + 1}/${items.length}]`);
        sent++;
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      // El wire lleva el body original enriquecido con los metadatos Store & Forward,
      // idénticos a los del item del Settlement payload que loguea arriba
      const wire = { ...q.body, ref: q.ref ?? null, authCode: q.authCode ?? null, amountCents: Math.round(q.total * 100) };
      log("tx", `→ POST ${url} [LOTE ${i + 1}/${items.length}]`);
      log("tx", `  Body: ${JSON.stringify(wire)}`);
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(url, {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.authToken}`,
          },
          body: JSON.stringify(wire),
        });
        clearTimeout(timeout);
        log("rx", `← HTTP ${res.status} ${res.statusText} [LOTE ${i + 1}/${items.length}]`);
        if (res.status === 200 || res.status === 201) {
          sent++;
        } else {
          failed.push(q);
        }
      } catch (e) {
        clearTimeout(timeout);
        log("err", `[NETWORK FATAL ERROR] ${String(e)} [LOTE ${i + 1}/${items.length}]`);
        failed.push(q);
      }
      // Ritmo visible para la telemetría
      await new Promise((r) => setTimeout(r, 200));
    }

    const sentIds = new Set(items.filter((q) => !failed.includes(q)).map((q) => q.id));
    setQueue(failed);
    // Traspaso de estado garantizado: cada item enviado del payload actualiza el Ledger (PENDING → SETTLED).
    // Ninguna transacción encolada se pierde: las fallidas permanecen PENDING y en cola.
    setLedgerEntries((prev) =>
      prev.map((e) => sentIds.has(e.id) && e.status === "PENDING"
        ? { ...e, status: "SETTLED" as LedgerStatus, detail: `${e.detail} · liquidada en ${batchPayload.batchId}` }
        : e)
    );
    const sentTotal = items.filter((q) => sentIds.has(q.id)).reduce((a, q) => a + q.total, 0);
    setSettlements((prev) => [...prev.slice(-49), {
      id: batchPayload.batchId,
      fileName: `CIERRE DE LOTE POS · ${batchPayload.batchId}`,
      time: nowMx(),
      records: items.length,
      matched: sent,
      rejected: 0,
      totalCents: Math.round(sentTotal * 100),
    }]);
    const failedTotal = failed.reduce((acc, q) => acc + q.total, 0);
    setReport([
      "*** TICKET DE CIERRE DE LOTE ***",
      `TERMINAL: ${config.terminalId}`,
      `DISPOSITIVO: ${deviceId}`,
      `LOTE: ${batchPayload.batchId}`,
      "──────────────────────────",
      `RECIBIDAS: ${items.length}`,
      `ENVIADAS:  ${sent}  $ ${fmt(sentTotal)}`,
      `FALLIDAS:  ${failed.length}  $ ${fmt(failedTotal)}`,
      `PENDIENTES EN COLA: ${failed.length}`,
      "──────────────────────────",
      new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", hour12: false }),
    ]);
    setReceiptKind("lote");
    setBatchProgress(null);
    setScreen("SYSMENU");
    log("info", `CIERRE DE LOTE terminado: ${sent}/${items.length} enviadas · $${fmt(sentTotal)} ${config.currency}${failed.length ? ` · ${failed.length} quedan en cola` : " · cola vacía"} · Ledger actualizado`);
    setToast(`Cierre de lote: ${sent}/${items.length} enviadas`);
  }

  const screenText = useMemo(() => ({
    primary: screenDark ? "text-emerald-300" : "text-[#1a3d0a]",
    secondary: screenDark ? "text-emerald-500/70" : "text-[#1a3d0a]/70",
    highlight: screenDark ? "bg-emerald-300/20" : "bg-black/15",
  }), [screenDark]);

  // ── Pantallas ───────────────────────────────────────────────────────────────
  function renderScreen() {
    const p = screenText.primary;
    const s = screenText.secondary;
    switch (screen) {
      case "IDLE":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <p className={`text-[10px] font-bold tracking-widest ${p}`}>{config.merchant}</p>
            <p className={`text-[9px] ${s}`}>TERMINAL {config.terminalId}</p>
            <p className={`text-xs font-bold mt-2 ${p}`}>BIENVENIDO</p>
            <p className={`text-[9px] ${s}`}>INGRESE MONTO PARA INICIAR</p>
            {queue.length > 0 && (
              <p className={`text-[9px] font-bold mt-1 ${p} animate-pulse`}>[⬆ {queue.length} PENDIENTE{queue.length > 1 ? "S" : ""}]</p>
            )}
            {idleNotice && <p className={`text-[9px] font-bold ${p}`}>{idleNotice}</p>}
            <p className={`text-[8px] mt-1 ${s}`}>F = MENU SISTEMA</p>
          </div>
        );
      case "MONTO":
        return (
          <div className="flex flex-col h-full justify-between">
            <div>
              <p className={`text-[9px] font-bold ${s}`}>{proto.kind} · PROTOCOLO {config.protocol}</p>
              <p className={`text-[8px] ${s}`}>
                {proto.name} · {authRequired ? `REQUIERE AUTH ${authLen} DÍGITOS` : "AUTH NO REQUERIDO"}
              </p>
              {config.protocol === "101.1" && !proto101Enabled && (
                <p className={`text-[8px] font-bold ${p}`}>** PROTOCOLO DESHABILITADO **</p>
              )}
            </div>
            <div className="text-right">
              <p className={`text-[9px] ${s}`}>MONTO {config.currency}</p>
              <p className={`text-2xl font-bold font-mono ${p}`}>$ {fmt(amount)}</p>
              {config.tipPercent > 0 && (
                <p className={`text-[9px] ${s}`}>PROPINA {config.tipPercent}% · TOTAL $ {fmt(total)}</p>
              )}
            </div>
            <p className={`text-[8px] ${s}`}>ENTER = CONTINUAR · X = CANCELAR</p>
          </div>
        );
      case "TARJETA":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <p className={`text-[10px] font-bold ${p}`}>INSERTE / ACERQUE TARJETA</p>
            <p className={`text-[8px] ${s}`}>{proto.name} · {config.protocol}</p>
            <p className={`text-xl font-mono font-bold ${p}`}>$ {fmt(total)}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => selectEntryMode("CHIP")} className={`px-2 py-0.5 rounded text-[8px] font-bold border ${entryMode === "CHIP" ? "bg-white/25" : ""} ${p}`}>CHIP</button>
              {config.contactless && (
                <button onClick={() => selectEntryMode("CTLS")} className={`px-2 py-0.5 rounded text-[8px] font-bold border ${entryMode === "CTLS" ? "bg-white/25" : ""} ${p}`}>CTLS</button>
              )}
              <button onClick={() => selectEntryMode("BANDA")} className={`px-2 py-0.5 rounded text-[8px] font-bold border ${entryMode === "BANDA" ? "bg-white/25" : ""} ${p}`}>BANDA</button>
            </div>
            {aidError && <p className={`text-[8px] font-bold mt-1 ${p}`}>{aidError}</p>}
            {entryMode && !aidError && <p className={`text-[8px] mt-1 ${s}`}>{maskCard(config.cardNumber)} · ENTER PARA AUTORIZAR</p>}
          </div>
        );
      case "PROCESANDO":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className={`text-[10px] font-bold ${p} animate-pulse`}>PROCESANDO...</p>
            <p className={`text-[8px] ${s}`}>CONECTANDO CON AUTORIZADOR</p>
            <p className={`text-[8px] font-mono ${s}`}>{config.commMode} · {config.host}:{config.port} {config.ssl ? "SSL" : ""}</p>
            <p className={`text-[8px] font-mono ${s}`}>ISO 8583 · MTI 0200 · DE3 {proto.processingCode} · {config.protocol}</p>
            {!validateProto && <p className={`text-[8px] font-bold ${p}`}>SIN VALIDACION DE PROTOCOLO</p>}
          </div>
        );
      case "APROBADO":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <CheckCircle className={`w-6 h-6 ${p}`} />
            <p className={`text-sm font-bold ${p}`}>APROBADA</p>
            <p className={`text-[8px] font-bold ${s}`}>{proto.name}</p>
            {txn?.queued && <p className={`text-[8px] font-bold ${p}`}>** VENTA FORZADA · PENDIENTE ENVÍO **</p>}
            <p className={`text-[9px] font-mono ${s}`}>AUTH: {txn?.code ?? "NO REQUERIDO"}</p>
            <p className={`text-[9px] font-mono ${s}`}>REF: {txn?.ref}</p>
            <p className={`text-[8px] mt-1 ${s}`}>ENTER PARA NUEVA OPERACIÓN</p>
          </div>
        );
      case "DECLINADO":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <XCircle className={`w-6 h-6 ${p}`} />
            <p className={`text-sm font-bold ${p}`}>DECLINADA</p>
            <p className={`text-[9px] font-mono ${s}`}>{declineReason ?? "RESP: 05 · NO AUTORIZADA"}</p>
            <p className={`text-[8px] mt-1 ${s}`}>ENTER PARA REINTENTAR</p>
          </div>
        );
      case "PWD":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Lock className={`w-4 h-4 ${p}`} />
            <p className={`text-[10px] font-bold ${p}`}>MODO SISTEMA</p>
            <p className={`text-[9px] ${s}`}>CLAVE DE SUPERVISOR</p>
            <p className={`text-lg font-mono tracking-[0.4em] ${p}`}>{"*".repeat(pwdDigits.length) || "·"}</p>
            {pwdError && <p className={`text-[9px] font-bold ${p}`}>CLAVE INCORRECTA</p>}
            <p className={`text-[8px] ${s}`}>ENTER = ACEPTAR · X = SALIR</p>
          </div>
        );
      case "SYSMENU":
        return (
          <div className="flex flex-col h-full">
            <p className={`text-[9px] font-bold mb-1 ${s}`}>MENU DE FUNCIONES</p>
            <div className="flex-1 space-y-px overflow-hidden">
              {FUNCIONES.map((item, i) => (
                <p key={item} className={`text-[9px] px-1 rounded ${i === menuIndex ? `${screenText.highlight} font-bold ${p}` : s}`}>
                  {i === menuIndex ? "▶" : "\u00A0"} {i + 1}. {item}
                </p>
              ))}
            </div>
            <p className={`text-[8px] ${s}`}>2/8 = NAVEGAR · ENTER = ABRIR · X = SALIR</p>
          </div>
        );
      case "SYS_REPORTE":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Printer className={`w-5 h-5 ${p} animate-pulse`} />
            <p className={`text-[10px] font-bold ${p}`}>IMPRIMIENDO REPORTE...</p>
          </div>
        );
      case "SYS_COMMS": {
        const rows = [
          { label: "MODO", value: config.commMode, ro: false },
          { label: "HOST", value: hostEdit !== null ? `${hostEdit}_` : config.host, ro: false },
          { label: "PUERTO", value: portEdit !== null ? `${portEdit}_` : String(config.port), ro: false },
          { label: "SSL", value: config.ssl ? "SI" : "NO", ro: false },
          { label: "TMS ID", value: config.tmsId, ro: true },
        ];
        return (
          <div className="flex flex-col h-full">
            <p className={`text-[9px] font-bold mb-1 ${s}`}>MODO COMUNICACION</p>
            <div className="flex-1 space-y-px">
              {rows.map((r, i) => (
                <p key={r.label} className={`text-[9px] px-1 rounded ${i === commIndex ? `${screenText.highlight} font-bold ${p}` : s}`}>
                  {i === commIndex ? "▶" : "\u00A0"} {r.label}: {r.value}{r.ro ? " (RO)" : ""}
                </p>
              ))}
            </div>
            <p className={`text-[8px] ${s}`}>ENTER = CAMBIAR · 00 = PUNTO · X = VOLVER</p>
          </div>
        );
      }
      case "SYS_CONFIG": {
        const win = 6;
        const start = Math.min(Math.max(0, flagIndex - win + 1), FEATURE_FLAGS.length - win);
        const visible = FEATURE_FLAGS.slice(start, start + win);
        return (
          <div className="flex flex-col h-full">
            <p className={`text-[9px] font-bold mb-1 ${s}`}>CONFIG TERMINAL · PARAMETROS</p>
            {start > 0 && <p className={`text-[8px] ${s}`}><ChevronUp className="w-2.5 h-2.5 inline" /></p>}
            <div className="flex-1 space-y-px">
              {visible.map((f, i) => {
                const idx = start + i;
                return (
                  <p key={f} className={`text-[9px] px-1 rounded ${idx === flagIndex ? `${screenText.highlight} font-bold ${p}` : s}`}>
                    {idx === flagIndex ? "▶" : "\u00A0"} {f.padEnd(16, ".")} {config.flags[f] ? "SI" : "NO"}
                  </p>
                );
              })}
            </div>
            {start + win < FEATURE_FLAGS.length && <p className={`text-[8px] ${s}`}><ChevronDown className="w-2.5 h-2.5 inline" /></p>}
            <p className={`text-[8px] ${s}`}>ENTER = SI/NO · X = VOLVER</p>
          </div>
        );
      }
      case "SYS_CARGA":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className={`text-[10px] font-bold ${p}`}>CARGA DE PARAMETROS</p>
            <p className={`text-[8px] ${s}`}>TMS {config.tmsId} · {config.host}:{config.port}</p>
            <div className="w-3/4 h-2 rounded bg-black/20 overflow-hidden">
              <div className="h-full bg-current transition-all" style={{ width: `${cargaProgress}%` }} />
            </div>
            <p className={`text-[9px] font-mono ${p}`}>{cargaProgress}%</p>
          </div>
        );
      case "SYS_ECHO":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            {echoResult === null ? (
              <>
                <Signal className={`w-5 h-5 ${p} animate-pulse`} />
                <p className={`text-[10px] font-bold ${p}`}>PROBANDO CONEXIÓN...</p>
                <p className={`text-[8px] font-mono ${s}`}>MTI 0800 · {config.host}:{config.port}</p>
              </>
            ) : echoResult.ok ? (
              <>
                <CheckCircle className={`w-6 h-6 ${p}`} />
                <p className={`text-sm font-bold ${p}`}>CONEXIÓN EXITOSA</p>
                <p className={`text-[8px] font-mono ${s}`}>{echoResult.detail}</p>
                <p className={`text-[8px] mt-1 ${s}`}>ENTER/X = VOLVER</p>
              </>
            ) : (
              <>
                <XCircle className={`w-6 h-6 ${p}`} />
                <p className={`text-sm font-bold ${p}`}>FALLA DE RED</p>
                <p className={`text-[8px] font-mono ${s}`}>{echoResult.detail}</p>
                <p className={`text-[8px] mt-1 ${s}`}>ENTER/X = VOLVER</p>
              </>
            )}
          </div>
        );
      case "SYS_LOTE":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className={`text-[10px] font-bold ${p}`}>CIERRE DE LOTE</p>
            <p className={`text-[8px] ${s}`}>ENVIANDO VENTAS FORZADAS</p>
            <div className="w-3/4 h-2 rounded bg-black/20 overflow-hidden">
              <div
                className="h-full bg-current transition-all"
                style={{ width: batchProgress ? `${(batchProgress.current / batchProgress.total) * 100}%` : "0%" }}
              />
            </div>
            <p className={`text-[9px] font-mono ${p}`}>
              {batchProgress ? `${batchProgress.current}/${batchProgress.total}` : "..."}
            </p>
          </div>
        );
      case "SYS_ACERCA":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <p className={`text-[10px] font-bold ${p}`}>{style.label.toUpperCase()}</p>
            <p className={`text-[9px] font-mono ${s}`}>SN: {config.serial}</p>
            <p className={`text-[9px] font-mono ${s}`}>OS: {config.osVersion}</p>
            <p className={`text-[9px] font-mono ${s}`}>APP: {config.appVersion}</p>
            <p className={`text-[9px] font-mono ${s}`}>TID: {config.terminalId}</p>
            <p className={`text-[8px] mt-1 ${s}`}>HW: {modelProfile.hwCode}</p>
            <p className={`text-[8px] ${s}`}>PANTALLA: {modelProfile.screen}</p>
            <p className={`text-[8px] ${s}`}>IMPRESORA: {modelProfile.printer}</p>
            <p className={`text-[8px] ${s}`}>PAGOS: {modelProfile.payments}</p>
            <p className={`text-[8px] ${s}`}>RED: {modelProfile.connectivity}</p>
            <p className={`text-[8px] mt-2 ${s}`}>ENTER/X = VOLVER</p>
          </div>
        );
    }
  }

  // ── Teclas físicas ──────────────────────────────────────────────────────────
  const keyBtn = (label: React.ReactNode, onClick: () => void, extra = "") => (
    <button
      onClick={onClick}
      className={`h-9 rounded-md font-bold text-sm shadow-[0_2px_0_rgba(0,0,0,0.45)] active:translate-y-[1px] active:shadow-none transition-all ${isLight ? "bg-white text-gray-800 hover:bg-gray-50" : "bg-[#4a5260] text-white hover:bg-[#555e6d]"} ${extra}`}
    >
      {label}
    </button>
  );

  const commLabel = config.commMode === "ETHERNET" ? "ETH" : config.commMode;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-[1500px] mx-auto space-y-6">
        {/* Encabezado */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#c8322b]/10 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-[#c8322b]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Verifone Dev Studio</h1>
              <p className="text-xs text-gray-500">Consola TMS + terminal configurable desde adentro</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-300 bg-white p-0.5 shadow-sm">
              {([["POS", "TMS / POS"], ["LEDGER", "Swift Ledger · PosLink"]] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex items-center px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === v ? "bg-[#c8322b] text-white" : "text-gray-500 hover:text-gray-800"}`}
                >
                  {label}
                  {v === "LEDGER" && ledgerPending > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-[9px] font-bold ${view === "LEDGER" ? "bg-white text-[#c8322b]" : "bg-amber-500 text-black"}`}>
                      {ledgerPending}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPosMirror((m) => !m)}
              title="Espejo en vivo del POS físico (adb)"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${posMirror ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-300 bg-white text-gray-500 hover:text-gray-800"}`}
            >
              <Smartphone className="w-3 h-3" /> POS físico
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 border border-amber-300 bg-amber-50 rounded-full px-3 py-1">
              <FlaskConical className="w-3 h-3" /> Entorno de desarrollo
            </span>
          </div>
        </div>

        {view === "POS" ? (
        <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6 items-start">
          {/* ── Terminal visual (al lado, como confirmación) ── */}
          <div className="flex flex-col items-center gap-6 xl:sticky xl:top-6">
            <div className={`w-[320px] rounded-[28px] border-4 ${style.edge} ${style.body} p-4 shadow-2xl`}>
              {/* Marca */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className={`text-[10px] font-black italic tracking-wider ${isLight ? "text-[#1b5e3a]" : "text-white/80"}`}>Verifone</span>
                <span className={`text-[8px] font-mono ${isLight ? "text-gray-500" : "text-white/40"}`}>{style.label}</span>
              </div>

              {/* Barra de estado */}
              <div className={`rounded-t-lg ${style.screen} px-2 pt-1.5`} style={{ filter: `brightness(${0.55 + dim * 0.55})` }}>
                <div className={`flex items-center justify-between ${screenText.secondary}`}>
                  <div className="flex items-center gap-1.5">
                    {config.wifi && <Wifi className="w-2.5 h-2.5" />}
                    {config.gprs && <Signal className="w-2.5 h-2.5" />}
                    {config.contactless && <Nfc className="w-2.5 h-2.5" />}
                    <span className="text-[7px] font-mono">{commLabel}{config.ssl ? "/SSL" : ""}</span>
                  </div>
                  <span className="text-[8px] font-mono">
                    {clock.toLocaleTimeString("es-MX", { hour12: false, timeZone: "America/Mexico_City" })}
                  </span>
                  <Battery className="w-2.5 h-2.5" />
                </div>
              </div>

              {/* LCD */}
              <div className={`${style.screen} rounded-b-lg h-[180px] p-3 font-mono mb-3 border-t-0 border border-black/40`} style={{ filter: `brightness(${0.55 + dim * 0.55})` }}>
                {renderScreen()}
              </div>

              {/* Slot de tarjeta */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="flex-1 h-1.5 rounded-full bg-black/60" />
                <CreditCard className={`w-3.5 h-3.5 ${isLight ? "text-gray-500" : "text-white/40"}`} />
              </div>

              {/* Teclado */}
              <div className="grid grid-cols-4 gap-1.5">
                {["1","2","3"].map(d => keyBtn(d, () => pressDigit(d)))}
                {keyBtn("✕", pressCancel, "!bg-[#c8322b] hover:!bg-[#a82520] !text-white")}
                {["4","5","6"].map(d => keyBtn(d, () => pressDigit(d)))}
                {keyBtn(<Delete className="w-4 h-4 mx-auto" />, pressClear, "!bg-[#e0a800] hover:!bg-[#c29100] !text-white")}
                {["7","8","9"].map(d => keyBtn(d, () => pressDigit(d)))}
                {keyBtn("✓", pressEnter, "!bg-[#2e7d32] hover:!bg-[#256629] !text-white")}
                {keyBtn("F", pressF, "!bg-[#274472] hover:!bg-[#1d3559] !text-white")}
                {keyBtn("0", () => pressDigit("0"))}
                {keyBtn("00", pressDotOrDoubleZero)}
                {keyBtn(<RotateCcw className="w-4 h-4 mx-auto" />, () => { setConfig(resetConfig()); setScreen("IDLE"); setAmountDigits(""); setEntryMode(null); setTxn(null); setReport(null); })}
              </div>
            </div>

            {/* Ticket / comprobante */}
            <div className="w-[320px] bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-4 pt-3 pb-2 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#c8322b]" />
                  {receiptKind === "lote" && report ? "Ticket de cierre de lote"
                    : receiptKind === "reporte" && report ? "Reporte de parámetros"
                    : "Último comprobante"}
                </h3>
                <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <Printer className="w-3 h-3" /> Papel: {config.paperLevel}%
                  {printing && <span className="text-amber-600 font-medium">· imprimiendo...</span>}
                </p>
              </div>
              <div className="p-4">
                {(receiptKind === "reporte" || receiptKind === "lote") && report ? (
                  <div className="bg-[#fdfaf3] border border-gray-200 rounded p-3 font-mono text-[10px] leading-relaxed text-gray-800 whitespace-pre-wrap">
                    {report.join("\n")}
                  </div>
                ) : txn ? (
                  <div className="bg-[#fdfaf3] border border-gray-200 rounded p-3 font-mono text-[10px] leading-relaxed text-gray-800">
                    <p className="text-center font-bold">{config.merchant}</p>
                    <p className="text-center">{config.merchantAddress}</p>
                    <p className="text-center">TERMINAL: {config.terminalId}</p>
                    <p className="text-center">{style.label.toUpperCase()} · {config.protocol}</p>
                    <p className="text-center font-bold">** {proto.name} **</p>
                    <div className="border-t border-dashed border-gray-300 my-2" />
                    <p>TARJETA: {maskCard(config.cardNumber)}</p>
                    <p>TITULAR: {config.holderName.toUpperCase()}</p>
                    <p>EXP: {config.expDate} · MODO: {txn.mode ?? "—"}</p>
                    <div className="border-t border-dashed border-gray-300 my-2" />
                    <p>IMPORTE:  $ {fmt(amount)}</p>
                    {config.tipPercent > 0 && <p>PROPINA:  $ {fmt(tip)}</p>}
                    <p className="font-bold">TOTAL {config.currency}: $ {fmt(txn.total)}</p>
                    <div className="border-t border-dashed border-gray-300 my-2" />
                    <p className="font-bold">{txn.approved ? "APROBADA" : "DECLINADA"} · AUTH: {txn.code ?? "NO REQUERIDO"}</p>
                    {txn.queued && <p className="font-bold">** VENTA FORZADA **</p>}
                    {txn.queued && <p>PENDIENTE DE ENVÍO AL MOTOR</p>}
                    <p>REF: {txn.ref}</p>
                    <div className="border-t border-dashed border-gray-300 my-2" />
                    <p>{config.legalText}</p>
                    <p className="text-center mt-2">{config.receiptFooter}</p>
                    <p>{txn.time}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-6">
                    Sin impresiones. Haz una operación o genera el reporte desde el menú de sistema (tecla F, clave {SUPERVISOR_PASSWORD}).
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Consola TMS (protagonista) ── */}
          <div className="space-y-4">
            <Panel title="Consola de Configuración (TMS)" desc="Edita los parámetros e inyéctalos al terminal. Los cambios también pueden hacerse desde adentro del POS (tecla F).">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={pushToTerminal}
                  className="flex items-center gap-2 rounded-md bg-[#c8322b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a82520] transition-colors"
                >
                  <Send className="w-4 h-4" /> Push to Terminal
                </button>
                <button
                  onClick={exportProfile}
                  className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" /> Exportar JSON
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-4 h-4" /> Importar JSON
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importProfile(f);
                    e.target.value = "";
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-400">
                Push simula la inyección remota: el POS muestra la barra de CARGA PARAM y aplica los parámetros al instante. Exportar/Importar replica la clonación de perfiles entre terminales.
              </p>
            </Panel>

            <div className="grid md:grid-cols-2 gap-4">
              <Panel title="Identidad">
                <Field label="Modelo">
                  <select
                    className={inputCls}
                    value={config.model}
                    onChange={(e) => {
                      const m = e.target.value as TerminalModel;
                      // Al cambiar de familia, el OS/APP por defecto siguen la ficha del modelo
                      setConfig((c) => ({ ...c, model: m, osVersion: MODEL_PROFILES[m].os, appVersion: MODEL_PROFILES[m].app }));
                    }}
                  >
                    <option value="VX520">Verifone VX520</option>
                    <option value="P400">Verifone P400</option>
                    <option value="E280S">Verifone e280s</option>
                    <option value="SUNMI_V3">SUNMI V3</option>
                    <option value="SUNMI_V3_PLUS">SUNMI V3 PLUS</option>
                    <option value="SUNMI_V3_MIX">SUNMI V3 MIX</option>
                  </select>
                </Field>
                <Field label="Nombre del comercio">
                  <input className={inputCls} value={config.merchant} onChange={(e) => set("merchant", e.target.value.toUpperCase().slice(0, 22))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ID Terminal">
                    <input className={inputCls} value={config.terminalId} onChange={(e) => set("terminalId", e.target.value)} />
                  </Field>
                  <Field label="Serie">
                    <input className={inputCls} value={config.serial} onChange={(e) => set("serial", e.target.value)} />
                  </Field>
                </div>
                <Field label="Moneda">
                  <select className={inputCls} value={config.currency} onChange={(e) => set("currency", e.target.value as "MXN" | "USD")}>
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
              </Panel>

              <Panel title="Red y Host">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Modo">
                    <select className={inputCls} value={config.commMode} onChange={(e) => set("commMode", e.target.value as CommMode)}>
                      {COMM_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Puerto">
                    <input className={inputCls} type="number" value={config.port} onChange={(e) => set("port", Number(e.target.value) || 0)} />
                  </Field>
                </div>
                <Field label="Host / IP">
                  <input className={inputCls} value={config.host} onChange={(e) => set("host", e.target.value)} />
                </Field>
                <Field label="TMS ID">
                  <input className={inputCls} value={config.tmsId} onChange={(e) => set("tmsId", e.target.value)} />
                </Field>
                <Field label="Token de Aprovisionamiento">
                  <input
                    className={inputCls}
                    type="password"
                    value={config.authToken}
                    onChange={(e) => set("authToken", e.target.value)}
                    placeholder="Bearer token del motor"
                  />
                </Field>
                <Toggle checked={config.ssl} onChange={(v) => set("ssl", v)} label="SSL activado (https)" />
                <Toggle checked={config.offlineMode} onChange={(v) => set("offlineMode", v)} label="Modo simulación (sin red)" />
                <p className="text-[10px] text-gray-400">
                  El POS envía <span className="font-mono">POST {config.ssl ? "https" : "http"}://{config.host}:{config.port}/api/engine/sales/forced</span> con header <span className="font-mono">Authorization: Bearer ***</span>.
                </p>
              </Panel>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Panel title="Límites de Riesgo Offline" desc="Floor limits: reglas anti-fraude para ventas forzadas sin red.">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tope por venta offline">
                    <input className={inputCls} type="number" min={0} value={config.offlineMaxAmount} onChange={(e) => set("offlineMaxAmount", Math.max(0, Number(e.target.value) || 0))} />
                  </Field>
                  <Field label="Máx. transacciones en cola">
                    <input className={inputCls} type="number" min={1} value={config.offlineMaxQueue} onChange={(e) => set("offlineMaxQueue", Math.max(1, Number(e.target.value) || 1))} />
                  </Field>
                </div>
                <p className="text-[10px] text-gray-400">
                  Una venta forzada que exceda ${fmt(config.offlineMaxAmount)} se declina con EXCEDE LÍMITE OFFLINE; al llenar la cola ({config.offlineMaxQueue}) se exige CIERRE DE LOTE.
                </p>
              </Panel>

              <Panel title="Recibo (ticket)" desc="Personalización legal del comprobante impreso.">
                <Field label="Dirección del comercio">
                  <input className={inputCls} value={config.merchantAddress} onChange={(e) => set("merchantAddress", e.target.value.toUpperCase())} />
                </Field>
                <Field label="Texto legal (pagaré)">
                  <input className={inputCls} value={config.legalText} onChange={(e) => set("legalText", e.target.value.toUpperCase())} />
                </Field>
                <Field label="Mensaje footer">
                  <input className={inputCls} value={config.receiptFooter} onChange={(e) => set("receiptFooter", e.target.value.toUpperCase())} />
                </Field>
              </Panel>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Panel title="Seguridad Criptográfica" desc="Inyección de llaves — sin esto la terminal no puede operar en frío.">
                <Field label="Esquema de encriptación">
                  <select className={inputCls} value={config.cryptoScheme} onChange={(e) => set("cryptoScheme", e.target.value as "DUKPT" | "MKS")}>
                    <option value="DUKPT">DUKPT (Derived Unique Key Per Transaction)</option>
                    <option value="MKS">Master/Session Key</option>
                  </select>
                </Field>
                <Field label="KSN Inicial (Key Serial Number)">
                  <input className={`${inputCls} font-mono`} value={config.ksn} onChange={(e) => set("ksn", e.target.value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 20))} placeholder="FFFF9876543210E00008" />
                </Field>
                <Field label="BDK / TMK (Clave Maestra)">
                  <input className={`${inputCls} font-mono`} type="password" value={config.bdk} onChange={(e) => set("bdk", e.target.value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 32))} />
                </Field>
                <p className="text-[10px] text-gray-400">
                  Con KSN inyectado, los mensajes MTI 0200 viajan con pinBlock y MAC ({config.cryptoScheme}).
                </p>
              </Panel>

              <Panel title="Perfiles EMV (AIDs)" desc="Marcas habilitadas para lectura CHIP / contactless.">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {EMV_AIDS.map((aid) => (
                    <Toggle
                      key={aid}
                      compact
                      checked={config.emvAids[aid]}
                      onChange={() => setConfig((c) => ({ ...c, emvAids: { ...c.emvAids, [aid]: !c.emvAids[aid] } }))}
                      label={aid}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-gray-400">
                  La marca se detecta por BIN de la tarjeta de prueba. Si el AID está apagado, CHIP/CTLS se bloquean con AID NO HABILITADO.
                </p>
              </Panel>
            </div>

            <Panel title="Banderas de Operación (Feature Flags)" desc="Las mismas del menú CONFIG TERMINAL del POS — sincronizadas en ambas direcciones. PROTO 101.1, VALIDAR PROTOCOLO, AUTH REQUERIDO y MAGSTRIPE FALLBACK impactan directo el flujo de venta.">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                {FEATURE_FLAGS.map((f) => (
                  <Toggle key={f} compact checked={config.flags[f]} onChange={() => toggleFlag(f)} label={f} />
                ))}
              </div>
            </Panel>

            <div className="grid md:grid-cols-2 gap-4">
              <Panel title={`Operación · ${proto.name}`} desc={proto.label}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Protocolo">
                    <select
                      className={inputCls}
                      value={config.protocol}
                      onChange={(e) => {
                        const code = e.target.value;
                        const len = protocolInfo(code).authDigits ?? 6;
                        setConfig((c) => ({ ...c, protocol: code, authCode: c.authCode.slice(0, len) }));
                      }}
                    >
                      {PROTOCOLS.map(pc => <option key={pc} value={pc}>{protocolInfo(pc).label}</option>)}
                    </select>
                  </Field>
                  <Field label={`Cód. autorización (${authLen} díg.)`}>
                    <input className={inputCls} value={config.authCode} onChange={(e) => set("authCode", e.target.value.replace(/\D/g, "").slice(0, authLen))} placeholder="Auto" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monto (directo)">
                    <input
                      className={inputCls} type="number" min={0} step="0.01" value={amount || ""}
                      onChange={(e) => setAmountDigits(e.target.value ? String(Math.round(parseFloat(e.target.value) * 100)) : "")}
                    />
                  </Field>
                  <Field label="Propina %">
                    <input className={inputCls} type="number" min={0} max={30} value={config.tipPercent} onChange={(e) => set("tipPercent", Math.max(0, Math.min(30, Number(e.target.value) || 0)))} />
                  </Field>
                </div>
                <Toggle checked={config.forceDecline} onChange={(v) => set("forceDecline", v)} label="Forzar declinación" />
              </Panel>

              <Panel title="Tarjeta de prueba">
                <Field label="Número">
                  <input className={inputCls} value={config.cardNumber} onChange={(e) => set("cardNumber", e.target.value.replace(/\D/g, "").slice(0, 16))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Titular">
                    <input className={inputCls} value={config.holderName} onChange={(e) => set("holderName", e.target.value)} />
                  </Field>
                  <Field label="Expira">
                    <input className={inputCls} value={config.expDate} onChange={(e) => set("expDate", e.target.value)} placeholder="MM/AA" />
                  </Field>
                </div>
              </Panel>
            </div>

            <Panel title="Hardware">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-medium text-gray-600">Brillo de pantalla</label>
                    <span className="text-xs font-mono text-gray-400">{config.brightness}%</span>
                  </div>
                  <input type="range" className="w-full accent-[#c8322b]" value={config.brightness} onChange={(e) => set("brightness", Number(e.target.value))} min={10} max={100} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-medium text-gray-600">Nivel de papel</label>
                    <span className="text-xs font-mono text-gray-400">{config.paperLevel}%</span>
                  </div>
                  <input type="range" className="w-full accent-[#c8322b]" value={config.paperLevel} onChange={(e) => set("paperLevel", Number(e.target.value))} min={0} max={100} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 max-w-sm">
                {([
                  ["wifi", "WiFi", Wifi],
                  ["gprs", "GPRS", Signal],
                  ["contactless", "NFC", Nfc],
                ] as const).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    onClick={() => set(key, !config[key])}
                    className={`flex flex-col items-center gap-1 rounded-md border p-2 text-[10px] font-semibold transition-colors ${config[key] ? "border-[#c8322b]/40 bg-[#c8322b]/5 text-[#c8322b]" : "border-gray-200 text-gray-400"}`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Monitor de Red (Telemetría)" desc="Diálogo crudo entre el POS y el motor: peticiones, headers, respuestas y errores fatales.">
              <div
                ref={consoleRef}
                className="bg-black rounded-md h-64 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed border border-gray-800"
              >
                {logs.length === 0 ? (
                  <p className="text-gray-600">$ esperando actividad de red — configura Host/Token, dale Push y cobra en el POS...</p>
                ) : (
                  logs.map((l) => (
                    <p key={l.id} className="whitespace-pre-wrap break-all">
                      <span className="text-gray-600">[{l.time}]</span>{" "}
                      <span className={
                        l.kind === "tx" ? "text-emerald-400"
                        : l.kind === "rx" ? "text-gray-100"
                        : l.kind === "err" ? "text-red-400 font-bold"
                        : "text-amber-300"
                      }>
                        {l.text}
                      </span>
                    </p>
                  ))
                )}
              </div>
              <div className="flex justify-between items-center">
                <p className="text-[10px] text-gray-400">
                  <span className="text-emerald-500 font-mono">verde</span> = request · <span className="font-mono text-gray-600">blanco</span> = response · <span className="text-red-500 font-mono">rojo</span> = error fatal
                </p>
                <button
                  onClick={() => setLogs([])}
                  className="text-[10px] font-medium text-gray-500 hover:text-[#c8322b] transition-colors"
                >
                  Limpiar consola
                </button>
              </div>
            </Panel>

            <button
              className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => { setConfig(resetConfig()); setScreen("IDLE"); setAmountDigits(""); setEntryMode(null); setTxn(null); setReport(null); setQueue([]); }}
            >
              <RotateCcw className="w-4 h-4" /> Restablecer valores de fábrica
            </button>
          </div>
        </div>
        ) : (
          <LedgerView
            entries={ledgerEntries}
            settlements={settlements}
            balances={fiatBalances}
            registry={registry}
            deviceId={deviceId}
            deviceAuthorized={deviceAuthorized}
            networkStatus={networkStatus}
            config={config}
            onAddManual={addManualEntry}
            onImportSettlement={importSettlement}
            onSetDeviceLink={setDeviceLink}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-sm rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}

      {/* Espejo en vivo del POS físico */}
      {posMirror && <PosLivePanel serial={config.serial} />}
    </div>
  );
}

// ─── Swift Ledger · PosLink (vista NOC oscura y densa) ───────────────────────
const LEDGER_STATUS_STYLE: Record<LedgerStatus, string> = {
  PENDING: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  SETTLED: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
};

const LEDGER_SOURCE_STYLE: Record<LedgerSource, string> = {
  POS_OFFLINE: "text-sky-300",
  MANUAL: "text-violet-300",
  VOICE: "text-pink-300",
};

const NETWORK_STATUS_STYLE: Record<NetworkStatus, { dot: string; text: string; label: string }> = {
  TERMINAL_UNCONFIGURED: { dot: "bg-red-500", text: "text-red-400", label: "TERMINAL_UNCONFIGURED" },
  STORE_AND_FORWARD: { dot: "bg-amber-400", text: "text-amber-300", label: "STORE & FORWARD" },
  LINK_DOWN: { dot: "bg-red-500", text: "text-red-400", label: "LINK DOWN" },
  CONNECTED: { dot: "bg-emerald-400", text: "text-emerald-300", label: "CONNECTED" },
};

const ledgerInputCls = "w-full rounded border border-[#2a3242] bg-[#0a0c10] px-2 py-1.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-emerald-500/60";

function LedgerPanel({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-[#1e2530] bg-[#10131a] ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e2530]">
        <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">{title}</h3>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

interface LedgerViewProps {
  entries: LedgerEntry[];
  settlements: SettlementReport[];
  balances: Record<string, { pendingCents: number; settledCents: number }>;
  registry: Record<string, DeviceRecord>;
  deviceId: string;
  deviceAuthorized: boolean;
  networkStatus: NetworkStatus;
  config: TerminalParams;
  onAddManual: (input: { amount: string; ref: string; source: "MANUAL" | "VOICE"; note: string }) => string | null;
  onImportSettlement: (file: File) => void;
  onSetDeviceLink: (authorized: boolean) => void;
}

function LedgerView({
  entries, settlements, balances, registry, deviceId, networkStatus, config,
  onAddManual, onImportSettlement, onSetDeviceLink,
}: LedgerViewProps) {
  const [mAmount, setMAmount] = useState("");
  const [mRef, setMRef] = useState("");
  const [mSource, setMSource] = useState<"MANUAL" | "VOICE">("MANUAL");
  const [mNote, setMNote] = useState("");
  const [mError, setMError] = useState<string | null>(null);
  const settleInputRef = useRef<HTMLInputElement>(null);
  const net = NETWORK_STATUS_STYLE[networkStatus];
  const pendingCount = entries.reduce((n, e) => n + (e.status === "PENDING" ? 1 : 0), 0);
  const currencies = Object.keys(balances);
  const devices = Object.values(registry);

  function submitManual() {
    const err = onAddManual({ amount: mAmount, ref: mRef, source: mSource, note: mNote });
    setMError(err);
    if (!err) { setMAmount(""); setMRef(""); setMNote(""); }
  }

  return (
    <div className="rounded-xl border border-[#1e2530] bg-[#0a0c10] p-4 font-mono text-[11px] text-gray-300 space-y-4 shadow-2xl">
      {/* Cabecera NOC */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#1e2530] pb-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-emerald-400" />
          <div>
            <p className="text-xs font-bold tracking-widest text-gray-100">SWIFT LEDGER · POSLINK</p>
            <p className="text-[9px] text-gray-500">conciliación fiat · store &amp; forward · TMS {config.tmsId} · {config.host}:{config.port}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-gray-500 hidden md:inline">{deviceId}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border border-[#2a3242] px-2.5 py-1 text-[9px] font-bold ${net.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${net.dot} animate-pulse`} /> {net.label}
          </span>
        </div>
      </div>

      {networkStatus === "TERMINAL_UNCONFIGURED" && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[10px] text-red-300">
          TERMINAL_UNCONFIGURED — el dispositivo {deviceId} no está enlazado/autorizado en el registry.
          El POS bloquea el despacho remoto de transacciones y el cierre de lote (store &amp; forward local sigue activo).
        </div>
      )}

      {/* Fiat balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(currencies.length ? currencies : [config.currency]).map((cur) => {
          const b = balances[cur] ?? { pendingCents: 0, settledCents: 0 };
          return (
            <div key={cur} className="rounded-md border border-[#1e2530] bg-[#10131a] p-3">
              <p className="text-[9px] tracking-widest text-gray-500 uppercase">Fiat balance · {cur}</p>
              <p className="text-xl font-bold text-gray-100 mt-1">$ {fmt((b.pendingCents + b.settledCents) / 100)}</p>
              <div className="flex justify-between mt-2 text-[10px]">
                <span className="text-amber-300">PENDING $ {fmt(b.pendingCents / 100)}</span>
                <span className="text-emerald-300">AVAILABLE $ {fmt(b.settledCents / 100)}</span>
              </div>
            </div>
          );
        })}
        <div className="rounded-md border border-[#1e2530] bg-[#10131a] p-3">
          <p className="text-[9px] tracking-widest text-gray-500 uppercase">Store &amp; Forward</p>
          <p className="text-xl font-bold text-gray-100 mt-1">{pendingCount} <span className="text-[10px] text-gray-500 font-normal">pendientes</span></p>
          <div className="flex justify-between mt-2 text-[10px]">
            <span className="text-gray-400">{entries.length} movimientos</span>
            <span className="text-gray-400">{settlements.length} liquidaciones</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Device registry */}
        <LedgerPanel title="Device registry · PosLink" right={<Database className="w-3.5 h-3.5 text-gray-600" />}>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-left text-gray-600 border-b border-[#1e2530]">
                <th className="py-1 pr-2 font-medium">DISPOSITIVO</th>
                <th className="py-1 pr-2 font-medium">ALIAS</th>
                <th className="py-1 pr-2 font-medium">ESTADO</th>
                <th className="py-1 font-medium text-right">ACCIÓN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141a24]">
              {devices.map((d) => (
                <tr key={d.deviceId} className={d.deviceId === deviceId ? "bg-emerald-500/5" : ""}>
                  <td className="py-1.5 pr-2 text-gray-300 break-all max-w-[180px]">
                    {d.deviceId}
                    {d.deviceId === deviceId && <span className="ml-1 text-[8px] text-emerald-400 font-bold">← ESTA TERMINAL</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-gray-500">{d.label}</td>
                  <td className="py-1.5 pr-2">
                    <span className={`inline-block rounded border px-1.5 py-px text-[8px] font-bold ${d.authorized ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" : "text-red-300 border-red-500/40 bg-red-500/10"}`}>
                      {d.authorized ? "AUTHORIZED" : "UNLINKED"}
                    </span>
                  </td>
                  <td className="py-1.5 text-right">
                    {d.deviceId === deviceId && (
                      <button
                        onClick={() => onSetDeviceLink(!d.authorized)}
                        className={`rounded border px-2 py-0.5 text-[9px] font-bold transition-colors ${d.authorized ? "border-red-500/40 text-red-300 hover:bg-red-500/10" : "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"}`}
                      >
                        {d.authorized ? "DESVINCULAR" : "VINCULAR"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!devices.some((d) => d.deviceId === deviceId) && (
                <tr className="bg-red-500/5">
                  <td className="py-1.5 pr-2 text-red-300 break-all max-w-[180px]">
                    {deviceId} <span className="ml-1 text-[8px] font-bold">← ESTA TERMINAL</span>
                  </td>
                  <td className="py-1.5 pr-2 text-gray-500">sin registro</td>
                  <td className="py-1.5 pr-2">
                    <span className="inline-block rounded border px-1.5 py-px text-[8px] font-bold text-red-300 border-red-500/40 bg-red-500/10">UNLINKED</span>
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => onSetDeviceLink(true)}
                      className="rounded border border-emerald-500/40 text-emerald-300 px-2 py-0.5 text-[9px] font-bold hover:bg-emerald-500/10 transition-colors"
                    >
                      VINCULAR
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="mt-2 text-[9px] text-gray-600">
            La red de la terminal solo existe contra el registry: sin AUTHORIZED el POS opera en TERMINAL_UNCONFIGURED
            (store &amp; forward local, sin despacho remoto ni cierres de lote). El TMS Push también vincula el dispositivo.
          </p>
        </LedgerPanel>

        {/* Offline FiatLedger · captura manual */}
        <LedgerPanel title="Offline FiatLedger · captura manual / voz" right={<Plus className="w-3.5 h-3.5 text-gray-600" />}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-gray-500">MONTO ({config.currency}) · se guarda en centavos</label>
              <input className={ledgerInputCls} inputMode="decimal" value={mAmount} onChange={(e) => setMAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" />
            </div>
            <div>
              <label className="text-[9px] text-gray-500">REF. COMERCIANTE (máx. {MERCHANT_REF_MAX})</label>
              <input className={ledgerInputCls} value={mRef} onChange={(e) => setMRef(e.target.value.slice(0, MERCHANT_REF_MAX))} placeholder="AUTO" />
            </div>
            <div>
              <label className="text-[9px] text-gray-500">ORIGEN</label>
              <select className={ledgerInputCls} value={mSource} onChange={(e) => setMSource(e.target.value as "MANUAL" | "VOICE")}>
                <option value="MANUAL">VENTA MANUAL (1643)</option>
                <option value="VOICE">VENTA POR VOZ</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-500">NOTA / AUTH TELEFÓNICA</label>
              <input className={ledgerInputCls} value={mNote} onChange={(e) => setMNote(e.target.value)} placeholder="—" />
            </div>
          </div>
          {mError && <p className="mt-2 text-[10px] text-red-300">{mError}</p>}
          <button
            onClick={submitManual}
            disabled={!mAmount.trim()}
            className="mt-2 w-full rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
          >
            REGISTRAR EN LEDGER (PENDING)
          </button>
        </LedgerPanel>
      </div>

      {/* Offline sale history */}
      <LedgerPanel
        title={`Offline sale history · ${entries.length}`}
        right={pendingCount > 0 ? <span className="text-[9px] font-bold text-amber-300">{pendingCount} PENDING</span> : undefined}
      >
        <div className="max-h-60 overflow-y-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-left text-gray-600 border-b border-[#1e2530]">
                <th className="py-1 pr-2 font-medium">HORA</th>
                <th className="py-1 pr-2 font-medium">REF</th>
                <th className="py-1 pr-2 font-medium">AUTH</th>
                <th className="py-1 pr-2 font-medium">ORIGEN</th>
                <th className="py-1 pr-2 font-medium text-right">MONTO</th>
                <th className="py-1 pr-2 font-medium">ESTADO</th>
                <th className="py-1 font-medium">DETALLE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141a24]">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-600">
                    sin movimientos — cobra en el POS (offline o sin vínculo PosLink) o captura una venta manual
                  </td>
                </tr>
              ) : [...entries].reverse().map((e) => (
                <tr key={e.id}>
                  <td className="py-1 pr-2 text-gray-500 whitespace-nowrap">{e.time}</td>
                  <td className="py-1 pr-2 text-gray-200">{e.ref}</td>
                  <td className="py-1 pr-2 text-gray-400">{e.authCode ?? "—"}</td>
                  <td className={`py-1 pr-2 font-bold ${LEDGER_SOURCE_STYLE[e.source]}`}>{e.source}</td>
                  <td className="py-1 pr-2 text-right text-gray-100 whitespace-nowrap">{e.currency} $ {fmt(e.amountCents / 100)}</td>
                  <td className="py-1 pr-2">
                    <span className={`inline-block rounded border px-1.5 py-px text-[8px] font-bold ${LEDGER_STATUS_STYLE[e.status]}`}>{e.status}</span>
                  </td>
                  <td className="py-1 text-gray-500 truncate max-w-[220px]">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LedgerPanel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Conciliación: subir reporte */}
        <LedgerPanel title="Conciliación · reporte de liquidación" right={<ArrowRightLeft className="w-3.5 h-3.5 text-gray-600" />}>
          <button
            onClick={() => settleInputRef.current?.click()}
            className="w-full rounded border border-dashed border-[#2a3242] px-3 py-4 text-center text-[10px] text-gray-400 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
          >
            <Upload className="w-4 h-4 mx-auto mb-1" />
            SUBIR REPORTE JSON / CSV — concilia contra los PENDING; si el registro trae referencia y monto, ambos deben coincidir
          </button>
          <input
            ref={settleInputRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportSettlement(f);
              e.target.value = "";
            }}
          />
          <p className="mt-2 text-[9px] text-gray-600">
            JSON: [&#123;"ref":"VF123","amountCents":12345&#125;] · CSV: ref,amount_cents por línea. Ref alfanumérica máx. {MERCHANT_REF_MAX} —
            los registros mal formados se rechazan y quedan contados en el reporte.
          </p>
        </LedgerPanel>

        {/* Settlement reports */}
        <LedgerPanel title={`Settlement reports · ${settlements.length}`} right={<FileText className="w-3.5 h-3.5 text-gray-600" />}>
          <div className="max-h-44 overflow-y-auto space-y-1">
            {settlements.length === 0 ? (
              <p className="py-4 text-center text-gray-600">
                sin liquidaciones — un CIERRE DE LOTE en el POS se registra aquí automáticamente
              </p>
            ) : [...settlements].reverse().map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded border border-[#1e2530] bg-[#0a0c10] px-2 py-1.5">
                <div>
                  <p className="text-[10px] text-gray-200">{s.fileName}</p>
                  <p className="text-[9px] text-gray-600">{s.time} · {s.records} registros</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-emerald-300">{s.matched} conciliadas · $ {fmt(s.totalCents / 100)}</p>
                  <p className={`text-[9px] ${s.rejected > 0 ? "text-red-400" : "text-gray-600"}`}>
                    {s.records - s.matched - s.rejected} sin match · {s.rejected} rechazadas
                  </p>
                </div>
              </div>
            ))}
          </div>
        </LedgerPanel>
      </div>
    </div>
  );
}

// ─── Espejo en vivo del POS físico ───────────────────────────────────────────
// La imagen la sirve /api/pos/screen.png (plugin posMirrorPlugin en vite.config.ts),
// que ejecuta `adb exec-out screencap -p` en cada request.
function PosLivePanel({ serial }: { serial: string }) {
  const [tick, setTick] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[300px] rounded-xl border border-gray-300 bg-white shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-200 bg-gray-50">
        <p className="text-[10px] font-bold tracking-wider text-gray-600">POS FÍSICO · {serial}</p>
        <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
      </div>
      {online ? (
        <img
          src={`/api/pos/screen.png?t=${tick}`}
          alt="Pantalla del POS físico"
          className="w-full max-h-[560px] object-contain bg-black"
          onLoad={() => setOnline(true)}
          onError={() => setOnline(false)}
        />
      ) : (
        <div className="px-3 py-5 text-center">
          <p className="text-[10px] font-semibold text-gray-600">POS no detectado</p>
          <p className="text-[9px] text-gray-400 mt-0.5">conecta el USB-C y acepta el aviso RSA</p>
          <button
            onClick={() => { setOnline(true); setTick((t) => t + 1); }}
            className="mt-2 rounded border border-gray-300 px-2 py-0.5 text-[9px] font-semibold text-gray-500 hover:bg-gray-100"
          >
            REINTENTAR
          </button>
        </div>
      )}
      <p className="px-2.5 py-1 text-[8px] text-gray-400">espejo adb · actualiza cada 1.5 s</p>
    </div>
  );
}
