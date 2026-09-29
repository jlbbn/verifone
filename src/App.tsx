import { useState, useEffect, useMemo, useRef } from "react";
import {
  Wifi, Signal, Nfc, Battery, Printer, CreditCard, Terminal,
  Delete, RotateCcw, FlaskConical, Receipt, CheckCircle, XCircle,
  Lock, ChevronUp, ChevronDown, Send, Download, Upload,
} from "lucide-react";
import {
  FEATURE_FLAGS, PROTOCOLS,
  SUPERVISOR_PASSWORD, DEFAULT_PARAMS, loadParams, saveParams, protocolInfo,
} from "./params";
import type { TerminalParams, TerminalModel, CommMode } from "./params";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Screen =
  | "IDLE" | "MONTO" | "TARJETA" | "PROCESANDO" | "APROBADO" | "DECLINADO"
  | "PWD" | "SYSMENU" | "SYS_REPORTE" | "SYS_COMMS" | "SYS_CONFIG" | "SYS_CARGA" | "SYS_ACERCA";

type EntryMode = "CHIP" | "CTLS" | "BANDA";

interface TxnReceipt {
  code: string | null; ref: string; time: string; total: number; approved: boolean; mode: EntryMode | null;
}

const MODEL_STYLES: Record<TerminalModel, { body: string; edge: string; screen: string; label: string }> = {
  VX520: { body: "bg-gradient-to-b from-[#3a4250] to-[#23282f]", edge: "border-[#14171c]", screen: "bg-[#b8d94e]", label: "Verifone VX520" },
  P400:  { body: "bg-gradient-to-b from-[#1c1e24] to-[#0c0d10]", edge: "border-[#000000]", screen: "bg-[#0d2237]", label: "Verifone P400" },
  E280S: { body: "bg-gradient-to-b from-[#e6e8ec] to-[#c9ccd4]", edge: "border-[#9aa0ab]", screen: "bg-[#123a2a]", label: "Verifone e280s" },
};

const FUNCIONES = [
  "REPORTE PARAMETROS",
  "MODO COMUNICACION",
  "CONFIG TERMINAL",
  "CARGA PARAM",
  "ACERCA DE",
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
  const [config, setConfig] = useState<TerminalParams>(loadParams);
  const [screen, setScreen] = useState<Screen>("IDLE");
  const [amountDigits, setAmountDigits] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [txn, setTxn] = useState<TxnReceipt | null>(null);
  const [report, setReport] = useState<string[] | null>(null);
  const [receiptKind, setReceiptKind] = useState<"venta" | "reporte">("venta");
  const [clock, setClock] = useState(new Date());
  const [toast, setToast] = useState<string | null>(null);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { saveParams(config); }, [config]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

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
  const isLight = config.model === "E280S";
  const screenDark = config.model !== "VX520";
  const dim = config.brightness / 100;

  // ── Consola TMS: Push / Export / Import ─────────────────────────────────────
  function pushToTerminal() {
    setScreen("SYS_CARGA");
    setCargaProgress(0);
    const t0 = Date.now();
    const iv = setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - t0) / 2200) * 100));
      setCargaProgress(pct);
      if (pct >= 100) {
        clearInterval(iv);
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
        const obj = JSON.parse(String(reader.result));
        if (typeof obj !== "object" || obj === null) throw new Error("formato inválido");
        setConfig({
          ...DEFAULT_PARAMS,
          ...obj,
          flags: { ...DEFAULT_PARAMS.flags, ...(obj.flags ?? {}) },
        });
        setToast(`Perfil importado desde ${file.name}`);
      } catch {
        setToast("Error: el archivo no es un perfil válido");
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
            setConfig(DEFAULT_PARAMS);
            setToast("Parámetros descargados desde TMS");
            setTimeout(() => setScreen("SYSMENU"), 600);
          }
        }, 60);
        break;
      }
      case "ACERCA DE": setScreen("SYS_ACERCA"); break;
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
      case "SYS_CONFIG": case "SYS_ACERCA": setScreen("SYSMENU"); break;
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
      case "TARJETA": if (entryMode) runAuthorization(); break;
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
      case "SYS_ACERCA": setScreen("SYSMENU"); break;
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

  function runAuthorization() {
    setScreen("PROCESANDO");
    setTimeout(() => {
      // Banderas operativas:
      // - AUTH REQUERIDO = NO  → la operación se aprueba sin código
      // - VALIDAR PROTOCOLO = NO → se acepta el código manual sin validar longitud
      let code: string | null;
      if (!authRequired) {
        code = null;
      } else {
        const manual = config.authCode.trim();
        const manualOk = validateProto ? manual.length === authLen : manual.length > 0;
        code = manualOk ? manual : randNum(authLen);
      }
      const approved = !config.forceDecline;
      setTxn({
        code,
        ref: `VF${randNum(10)}`,
        time: new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", hour12: false }),
        total,
        approved,
        mode: entryMode,
      });
      setReceiptKind("venta");
      setScreen(approved ? "APROBADO" : "DECLINADO");
      if (approved) setToast(`${proto.name} aprobada · Auth ${code ?? "NO REQUERIDO"} · ${config.currency} $${fmt(total)}`);
    }, 1600);
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
              <button onClick={() => setEntryMode("CHIP")} className={`px-2 py-0.5 rounded text-[8px] font-bold border ${entryMode === "CHIP" ? "bg-white/25" : ""} ${p}`}>CHIP</button>
              {config.contactless && (
                <button onClick={() => setEntryMode("CTLS")} className={`px-2 py-0.5 rounded text-[8px] font-bold border ${entryMode === "CTLS" ? "bg-white/25" : ""} ${p}`}>CTLS</button>
              )}
              <button onClick={() => setEntryMode("BANDA")} className={`px-2 py-0.5 rounded text-[8px] font-bold border ${entryMode === "BANDA" ? "bg-white/25" : ""} ${p}`}>BANDA</button>
            </div>
            {entryMode && <p className={`text-[8px] mt-1 ${s}`}>{maskCard(config.cardNumber)} · ENTER PARA AUTORIZAR</p>}
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
            <p className={`text-[9px] font-mono ${s}`}>RESP: 05 · NO AUTORIZADA</p>
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
      case "SYS_ACERCA":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <p className={`text-[10px] font-bold ${p}`}>{style.label.toUpperCase()}</p>
            <p className={`text-[9px] font-mono ${s}`}>SN: {config.serial}</p>
            <p className={`text-[9px] font-mono ${s}`}>OS: {config.osVersion}</p>
            <p className={`text-[9px] font-mono ${s}`}>APP: {config.appVersion}</p>
            <p className={`text-[9px] font-mono ${s}`}>TID: {config.terminalId}</p>
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
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 border border-amber-300 bg-amber-50 rounded-full px-3 py-1">
            <FlaskConical className="w-3 h-3" /> Entorno de desarrollo
          </span>
        </div>

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
                {keyBtn(<RotateCcw className="w-4 h-4 mx-auto" />, () => { setConfig(DEFAULT_PARAMS); setScreen("IDLE"); setAmountDigits(""); setEntryMode(null); setTxn(null); setReport(null); })}
              </div>
            </div>

            {/* Ticket / comprobante */}
            <div className="w-[320px] bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-4 pt-3 pb-2 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#c8322b]" />
                  {receiptKind === "reporte" && report ? "Reporte de parámetros" : "Último comprobante"}
                </h3>
                <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <Printer className="w-3 h-3" /> Papel: {config.paperLevel}%
                  {printing && <span className="text-amber-600 font-medium">· imprimiendo...</span>}
                </p>
              </div>
              <div className="p-4">
                {receiptKind === "reporte" && report ? (
                  <div className="bg-[#fdfaf3] border border-gray-200 rounded p-3 font-mono text-[10px] leading-relaxed text-gray-800 whitespace-pre-wrap">
                    {report.join("\n")}
                  </div>
                ) : txn ? (
                  <div className="bg-[#fdfaf3] border border-gray-200 rounded p-3 font-mono text-[10px] leading-relaxed text-gray-800">
                    <p className="text-center font-bold">{config.merchant}</p>
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
                    <p>REF: {txn.ref}</p>
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
                  <select className={inputCls} value={config.model} onChange={(e) => set("model", e.target.value as TerminalModel)}>
                    <option value="VX520">Verifone VX520</option>
                    <option value="P400">Verifone P400</option>
                    <option value="E280S">Verifone e280s</option>
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
                <Toggle checked={config.ssl} onChange={(v) => set("ssl", v)} label="SSL activado" />
              </Panel>
            </div>

            <Panel title="Banderas de Operación (Feature Flags)" desc="Las mismas del menú CONFIG TERMINAL del POS — sincronizadas en ambas direcciones. PROTO 101.1, VALIDAR PROTOCOLO y AUTH REQUERIDO impactan directo el flujo de venta.">
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

            <button
              className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => { setConfig(DEFAULT_PARAMS); setScreen("IDLE"); setAmountDigits(""); setEntryMode(null); setTxn(null); setReport(null); }}
            >
              <RotateCcw className="w-4 h-4" /> Restablecer valores de fábrica
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-sm rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}
