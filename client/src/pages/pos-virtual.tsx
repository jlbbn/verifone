import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { DEFAULT_SYSTEM_SETTINGS } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  MonitorSmartphone, CreditCard, Wifi, ShieldCheck, CheckCircle,
  X, Delete, RefreshCw, Activity, Loader2, Receipt,
  Zap, Clock, Lock, AlertTriangle, Settings, FileBarChart,
  Radio, Download, Info, ChevronRight, Printer, ArrowDownLeft, Sliders
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CARD_TYPES = [
  "VISA Nacional",
  "VISA Internacional",
  "Mastercard Nacional",
  "Mastercard Internacional",
  "AMEX",
  "Débito Nacional",
  "Maestro",
];

const PROTOCOLS = [
  { code: "101.1",  label: "101.1 — Transferencia red Visa Network (USD)" },
  { code: "101.2",  label: "101.2 M2 — Transferencia internacional" },
  { code: "101.3",  label: "101.3 M3 — Transferencia segura" },
  { code: "201.1",  label: "201.1 — Pago nacional" },
  { code: "201.2",  label: "201.2 — Pago internacional" },
  { code: "201.3",  label: "201.3 — Pago express" },
  { code: "301.1",  label: "301.1 — Depósito cuenta" },
  { code: "401.1",  label: "401.1 — Retiro ATM" },
  { code: "1643",   label: "1643 — Venta forzada terminal manual" },
];

const FUNCIONES_MENU = [
  { num: 1, label: "REPORTE PARAMETROS",  icon: FileBarChart },
  { num: 2, label: "MODO COMUNICACION",   icon: Radio },
  { num: 3, label: "CONFIG TERMINAL",     icon: Settings },
  { num: 4, label: "CARGA PARAM",         icon: Download },
  { num: 5, label: "ACERCA DE",           icon: Info },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function formatAmountDigits(digits: string) {
  if (!digits) return "0.00";
  return fmt(parseInt(digits, 10) / 100);
}
function toMXN(usd: number, tc: number) { return fmt(usd * tc); }

function randHex(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join("");
}
function randNum(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10).toString()).join("");
}
function formatCard(s: string) {
  const c = s.replace(/\D/g, "").substring(0, 16);
  return c.replace(/(.{4})/g, "$1 ").trim();
}

interface VisaNetData {
  track1: string; track2: string;
  authCode: string; amount: number;
  cardNumber: string; holderName: string; expDate: string;
  protocol: string; txCode: string; depositeCode: string;
  bankOpCode: string; fedCode: string; timestamp: string;
}

function buildVisaNetData(amountDigits: string, cardNumber: string, holderName: string,
  expiryDate: string, protocol: string, authCode: string, txId: string): VisaNetData {
  const usd = parseInt(amountDigits, 10) / 100;
  return {
    track1: `SEARCH_FOR_CC_DATA+LO QUANTUM 8.1 ((B|B))[13.19]/<(A_ZA_A/S)(${protocol.replace(".", "")}/${protocol.replace(".", "")})........./EMV/D2/COMPLETE`,
    track2: `OPEN PROCESS_ACCESS SYSTEM _AND READ _VERIFY/MEM+149-MALWARE/TRACK_DATE/VMML/+52${randNum(10)}`,
    authCode: authCode || randNum(6),
    amount: usd,
    cardNumber: (cardNumber.replace(/\s/g, "") || "4040310011384895").replace(/.(?=.{4})/g, "*"),
    holderName: (holderName || "BANXICO LLC").toUpperCase(),
    expDate: expiryDate || "02/27",
    protocol,
    txCode: `${randNum(6)}HSBC${randNum(6)}`,
    depositeCode: `G${randNum(3)}-${randNum(7)}DB-HSBC-${randNum(8)}`,
    bankOpCode: `CREED** ${randNum(8)}-${randNum(1)}`,
    fedCode: `E-${randNum(4)}HSBC.${randNum(4)}.${randNum(4)}.${randNum(4)}.${randNum(4)}.${randNum(4)}.${randNum(3)}`,
    timestamp: new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City", hour12: false }),
  };
}

const HIGHLIGHT_PARAM_LABELS = new Set([
  "VENTA FORZADA","TIEMPO AIRE","PP P400","USUARIOS","SERVICOMERCIO",
  "MOTO CVW2","SUPER MANUAL","COMM ELECTR","OPS","LEALTAD MEDA","GIFTCARD","ACTIVADO SSL",
]);

// ─── Modals ───────────────────────────────────────────────────────────────────

function FuncionesModal({ onClose, onSelect }: { onClose: () => void; onSelect: (n: number) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-72 rounded-xl overflow-hidden shadow-2xl border border-gray-600" style={{ background: "#1a2a3a" }}>
        <div className="py-3 px-4 text-center" style={{ background: "#0d1b2a" }}>
          <p className="text-white font-bold tracking-widest text-sm">FUNCIONES</p>
        </div>
        <div className="p-4 space-y-2.5">
          {FUNCIONES_MENU.map(item => (
            <button key={item.num} onClick={() => onSelect(item.num)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white font-semibold text-sm text-left transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #1565C0, #0d47a1)" }}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">{item.num}</span>
              <span className="tracking-wide">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-gray-600 py-3 flex items-center justify-center gap-2">
          <button onClick={onClose} className="text-sm text-white/80 font-semibold flex items-center gap-1">
            Cancel <X className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
        <div className="text-center pb-2">
          <span className="text-[10px] text-gray-500 tracking-widest">verifone</span>
        </div>
      </div>
    </div>
  );
}

function ReporteParametrosModal({
  params, onClose,
}: {
  params: { label: string; value: string; highlight?: boolean }[];
  onClose: () => void;
}) {
  const afiliacion = params.find(p => p.label === "AFILIACION")?.value ?? "7705397";
  const version = params.find(p => p.label === "VERSION")?.value ?? "PROVEEOPENAT400";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 overflow-y-auto">
      <div className="w-full max-w-xs my-4">
        <div className="rounded-lg overflow-hidden shadow-2xl border border-gray-200">
          <div className="bg-white px-5 py-4 text-center border-b border-dashed border-gray-300">
            <p className="font-bold text-sm tracking-wide" style={{ fontFamily: "monospace" }}>LISTA DE PARAMETROS</p>
            <div className="flex justify-between mt-2 text-xs font-mono text-gray-600">
              <span>FECHA {new Date().toLocaleDateString("es-MX")}</span>
              <span>HORA {new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </div>
          </div>
          <div className="bg-white px-5 py-3 text-center border-b border-dashed border-gray-300">
            <p className="font-bold text-2xl tracking-widest font-mono">{afiliacion}</p>
            <p className="text-xs text-gray-500 font-mono">CAJA: 1</p>
          </div>
          <div className="bg-white px-4 py-3 divide-y divide-gray-100">
            {params.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-[11px] font-mono text-gray-700">{p.label}</span>
                <span className={`text-[11px] font-mono font-bold ${
                  p.highlight ? "text-green-700" : p.value === "" ? "text-gray-300" : "text-gray-900"
                }`}>{p.value || "—"}</span>
              </div>
            ))}
          </div>
          <div className="bg-white px-5 py-4 text-center border-t border-dashed border-gray-300">
            <p className="text-[10px] font-mono text-gray-500 tracking-widest">{version}</p>
          </div>
        </div>
        <Button onClick={onClose} className="w-full mt-3 bg-[#1565C0] text-white text-xs">
          Cerrar
        </Button>
      </div>
    </div>
  );
}

function Barcode() {
  const pattern = [3,1,2,1,4,1,1,2,3,1,2,1,1,3,2,1,4,1,1,2,3,1,1,2,4,1,2,1,3,1,1,2,1,3,2,1,4,1,1,2];
  return (
    <div className="flex items-end justify-center h-10 gap-px my-2 px-2">
      {pattern.map((w, i) => (
        <div key={i} className={`${i % 2 === 0 ? "bg-white" : "bg-transparent"}`}
          style={{ width: w * 2, height: i % 5 === 0 ? "100%" : "80%" }} />
      ))}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1 my-2">
      <div className="flex-1 border-t border-dotted border-gray-600" />
      <span className="text-[10px] font-mono text-gray-400 px-1 whitespace-nowrap">...{label}...</span>
      <div className="flex-1 border-t border-dotted border-gray-600" />
    </div>
  );
}

function VisaNetworkReceiptModal({ data, onClose }: { data: VisaNetData; onClose: () => void }) {
  function row(label: string, value: string) {
    const maxDots = 48;
    const used = label.length + value.length;
    const dots = ".".repeat(Math.max(2, maxDots - used));
    return (
      <div className="flex text-[10px] font-mono leading-[18px]">
        <span className="text-gray-300 whitespace-nowrap">{label}:</span>
        <span className="text-gray-600 flex-1 overflow-hidden tracking-tighter">{dots}</span>
        <span className="text-white text-right whitespace-nowrap ml-1 font-bold">{value}</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 overflow-y-auto">
      <div className="w-full max-w-md rounded-xl overflow-hidden shadow-2xl border border-gray-700 my-4"
        style={{ background: "#050f1a", fontFamily: "monospace" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-black/60">
          <span className="text-xs text-gray-400 font-mono tracking-wide">REPORTE PARAMETROS — Visa Net 9.0 Quantum</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-1 overflow-y-auto max-h-[78vh]">

          {/* TRACK lines */}
          <p className="text-[10px] font-mono text-cyan-400 leading-5 break-all">
            TRACK1_DATA: SEARCH_FOR_CC_DATA+LO QUANTUM 8.9 [B|B][13.19]/&lt;(A_ZA_A/S)(201/101)......../EMV/D2/COMPLETE
          </p>
          <p className="text-[10px] font-mono text-cyan-400 leading-5 break-all">
            TRACK2_DATA: OPEN PROCESS_ACCESS SYSTEM _AND READ _VERIFY/MEM=149-MALWARE/TRACK_DATE/DA/+0000000000000
          </p>
          <p className="text-[10px] font-mono text-cyan-400 leading-5">
            TRACK3_DATA: VERIFY_EXIT
          </p>

          {/* ── CARD INFORMATION ── */}
          <SectionHeader label="CARD INFORMATION" />
          <p className="text-center text-[10px] font-mono text-gray-400 tracking-widest">DATA VERIFIED BY</p>

          {/* White VISA card */}
          <div className="rounded-lg bg-white px-4 py-3 my-2 space-y-1.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-extrabold italic text-[#1A1F71]"
                style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>VISA</span>
            </div>
            {[
              { label: "Receiver/Card Holder Name:", value: data.holderName },
              { label: "Receiver/Issuing Bank:",     value: "PNC BANK" },
              { label: "Receiver/Card Number:",      value: "" },
              { label: "Receiver/Expiration Date:",  value: data.expDate },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[10px] text-gray-500">{label}</p>
                {value
                  ? <p className="text-xs font-bold text-[#1A1F71] bg-blue-100 px-2 py-0.5 rounded inline-block">{value}</p>
                  : <div className="h-4 border-b-2 border-dotted border-blue-300 mx-8" />
                }
              </div>
            ))}
          </div>

          <Barcode />
          <div className="flex items-center gap-1 my-1">
            <div className="flex-1 border-t border-gray-700" />
            <div className="flex-1 border-t border-blue-700" />
          </div>

          {/* ── ACTIVATING TRANSACTION ── */}
          <SectionHeader label="ACTIVATING TRANSACTION" />
          <div className="space-y-0">
            {row("Redirecting to Visa Network", "OK")}
            {row("Connecting to Database", "CONNECTED")}
            {row("Account Verification", "OK")}
            {row("Approval Code", "LINKED CVV2")}
            {row("Account Type", "ONLINE SALE")}
            {row("Transaction Status", "ACTIVE")}
            {row("Authorization Codes", data.authCode)}
            {row("Protocol", data.protocol)}
          </div>

          <Barcode />
          <div className="flex items-center gap-1 my-1">
            <div className="flex-1 border-t border-gray-700" />
            <div className="flex-1 border-t border-blue-700" />
          </div>

          {/* ── TRANSACTION INDEX ── */}
          <SectionHeader label="TRANSACTION INDEX" />
          <p className="text-center text-[10px] font-mono text-gray-400 tracking-widest">DATA VERIFIED BY VISA</p>
          <div className="space-y-0 mt-1">
            {row("Linked Code Number", "LINKED")}
            {row("Card Number", "CONNECTED")}
            {row("RRN", "AUTOMATIC")}
          </div>

          <Barcode />

          {/* Footer */}
          <p className="text-center text-[9px] font-mono text-gray-500 pt-1">
            system department/access/VisBT**14122**/****5831
          </p>
          <p className="text-center text-[9px] font-mono text-gray-600 break-all">
            system screen from: barrientosjo798.replit.app/pos-virtual
          </p>

          {/* Authorization status */}
          <div className="mt-3 rounded-lg border border-green-500/40 bg-green-950/30 p-3 text-center">
            <p className="text-green-400 text-[10px] font-mono tracking-widest">AUTHORIZATION STATUS:</p>
            <p className="text-green-400 font-bold text-sm font-mono mt-0.5">SUCCESSFULLY REDEEMED</p>
            <p className="text-green-300 text-2xl font-bold font-mono mt-1">{data.authCode}</p>
          </div>

        </div>

        <div className="px-4 pb-4 pt-2">
          <Button onClick={onClose} className="w-full bg-[#1565C0] text-white text-xs">Cerrar Reporte</Button>
        </div>
      </div>
    </div>
  );
}

function InfoModal({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-xl overflow-hidden shadow-2xl" style={{ background: "#1a2a3a" }}>
        <div className="py-3 px-4 text-center border-b border-gray-600" style={{ background: "#0d1b2a" }}>
          <p className="text-white font-bold tracking-widest text-sm">{title}</p>
        </div>
        <div className="p-5 text-sm text-gray-300 font-mono whitespace-pre-line">{content}</div>
        <div className="border-t border-gray-600 p-3">
          <button onClick={onClose} className="w-full text-sm text-white/80 font-semibold flex items-center justify-center gap-1">
            Cancel <X className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
type Step = "amount" | "card" | "processing" | "approved";

interface ProcessResult {
  success: boolean; authCode: string; tokenId: string;
  transaction: { transactionId: string; amount: string; status: string; createdAt: string };
  message: string;
}

export default function POSVirtualPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: settings } = useSystemSettings();
  const TC_MXN = settings?.tipoCambio ?? DEFAULT_SYSTEM_SETTINGS.tipoCambio;
  const terminalParamsForReport = useMemo(() => {
    const stored = settings?.terminalParams ?? DEFAULT_SYSTEM_SETTINGS.terminalParams;
    return stored.map(p => ({ ...p, highlight: HIGHLIGHT_PARAM_LABELS.has(p.label) && p.value === "SI" }));
  }, [settings?.terminalParams]);

  const [step, setStep] = useState<Step>("amount");
  const [amountDigits, setAmountDigits] = useState("");
  const [cardType, setCardType] = useState("Mastercard Internacional");
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [protocol, setProtocol] = useState("201.2");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [now, setNow] = useState(new Date());
  const [lote, setLote] = useState(2);
  const [oper, setOper] = useState(28);

  const [ventaForzada, setVentaForzada] = useState(false);
  const [trackData, setTrackData] = useState("");
  const [bankRef, setBankRef] = useState("");

  const [showFunciones, setShowFunciones] = useState(false);
  const [showReporteParams, setShowReporteParams] = useState(false);
  const [showVisaNet, setShowVisaNet] = useState(false);
  const [visaNetData, setVisaNetData] = useState<VisaNetData | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; content: string } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const processMutation = useMutation({
    mutationFn: async () => {
      const amount = parseInt(amountDigits, 10) / 100;
      if (amount <= 0) throw new Error("Monto inválido");
      const res = await apiRequest("POST", "/api/pos/process-payment", {
        cardType, cardNumber: cardNumber.replace(/\s/g, "") || "4111111111111111",
        amount, protocol, holderName: holderName || "TITULAR",
        expiryDate: expiryDate || "12/27", ventaForzada,
      });
      if (!res.ok) throw new Error("Error al procesar");
      return res.json() as Promise<ProcessResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("approved");
      setLote(l => l + 1);
      setOper(o => o + 1);
      if (protocol === "101.1") {
        const vd = buildVisaNetData(amountDigits, cardNumber, holderName, expiryDate,
          protocol, data.authCode, data.transaction.transactionId);
        setVisaNetData(vd);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error de procesamiento", description: err.message, variant: "destructive" });
      setStep("amount");
    },
  });

  function handleKey(key: string) {
    if (step !== "amount") return;
    if (key === "C") { setAmountDigits(""); return; }
    if (key === "DEL") { setAmountDigits(p => p.slice(0, -1)); return; }
    if (amountDigits.length >= 9) return;
    setAmountDigits(p => p + key);
  }

  function handleConfirmAmount() {
    if (!parseInt(amountDigits, 10)) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a $0.00", variant: "destructive" });
      return;
    }
    setStep("card");
  }

  function handleProcessPayment() {
    setStep("processing");
    processMutation.mutate();
  }

  function handleNewTransaction() {
    setStep("amount"); setAmountDigits(""); setCardType("Mastercard Internacional");
    setCardNumber(""); setHolderName(""); setExpiryDate(""); setProtocol("201.2");
    setResult(null); setVisaNetData(null); setVentaForzada(false); setTrackData(""); setBankRef("");
  }

  function handleFuncionSelect(n: number) {
    setShowFunciones(false);
    if (n === 1) { setShowReporteParams(true); }
    else if (n === 2) setInfoModal({ title: "MODO COMUNICACION", content: "Estado: ONLINE\nRed: ETHERNET\nProtocolo: ISO 8583\nTimeout: 30s\nReintentos: 3" });
    else if (n === 3) setInfoModal({ title: "CONFIG TERMINAL", content: "Terminal ID: T1005\nComercio: BANXICO PLUS\nVendor: Verifone\nModelo: V660p-A\nFirmware: PROVEEOPENAT400" });
    else if (n === 4) setInfoModal({ title: "CARGA PARAM", content: "Descargando parámetros...\n\n[OK] AID VISA\n[OK] AID MASTERCARD\n[OK] AID AMEX\n[OK] CAPK Keys\n[OK] Tablas EMV\n\nCarga completa." });
    else if (n === 5) setInfoModal({ title: "ACERCA DE", content: "Banxico Plus POS\nVersión: PROVEEOPENAT400\nVisa Net: 9.0 Quantum\nEMV Level 2: Aprobado\nPCI DSS: Activo" });
  }

  const amountUSD = parseInt(amountDigits, 10) / 100;
  const amountMXNDisplay = toMXN(amountUSD, TC_MXN);
  const is101 = protocol === "101.1";
  const is1643 = protocol === "1643";
  const isVF = ventaForzada || is1643;

  const numpadKeys = [["1","2","3"],["4","5","6"],["7","8","9"],["C","0","DEL"]];

  return (
    <div className="p-4 md:p-6 space-y-5 pb-24">
      {/* Modals */}
      {showFunciones && <FuncionesModal onClose={() => setShowFunciones(false)} onSelect={handleFuncionSelect} />}
      {showReporteParams && <ReporteParametrosModal params={terminalParamsForReport} onClose={() => setShowReporteParams(false)} />}
      {showVisaNet && visaNetData && <VisaNetworkReceiptModal data={visaNetData} onClose={() => setShowVisaNet(false)} />}
      {infoModal && <InfoModal title={infoModal.title} content={infoModal.content} onClose={() => setInfoModal(null)} />}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MonitorSmartphone className="w-7 h-7 text-[#c8322b]" /> POS Virtual
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Terminal · EMV / PCI DSS · Visa Net 9.0 Quantum</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowFunciones(true)} data-testid="button-funciones"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border border-blue-400 text-blue-600 bg-blue-50 transition-all">
            <Settings className="w-3.5 h-3.5" /> FUNCIONES
          </button>
          <button onClick={() => setVentaForzada(v => !v)} data-testid="button-venta-forzada"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              isVF ? "bg-amber-500 border-amber-500 text-white shadow-md" : "bg-muted border-border text-muted-foreground"
            }`}>
            <Zap className="w-3.5 h-3.5" /> Venta Forzada {isVF ? "ON" : "OFF"}
          </button>
          {user?.role === "ADMIN" && (
            <Link href="/admin/settings">
              <button data-testid="button-admin-settings"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border border-[#c8322b] text-[#c8322b] bg-red-50 transition-all">
                <Sliders className="w-3.5 h-3.5" /> Administrar
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Protocol info badge */}
      {is101 && (
        <Card className="border-blue-300 bg-blue-50/60">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-extrabold italic text-[#1A1F71]"
                  style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>V</span>
              </div>
              <div>
                <p className="font-semibold text-blue-900 text-sm">Protocolo 101.1 — Visa Network Transfer</p>
                <p className="text-xs text-blue-700 mt-0.5">Operación de red en bloques USD. Genera reporte Visa Net al aprobar.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {is1643 && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">Protocolo 1643 — Venta forzada terminal manual</p>
                <p className="text-xs text-amber-700 mt-0.5">Operación de tarjeta sin conexión EMV online. Solo para montos operativos.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Terminal device */}
        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-sm">
            <div className="bg-gray-900 rounded-2xl p-5 shadow-2xl border border-gray-700">
              {/* Screen */}
              <div className={`rounded-lg p-4 mb-4 min-h-[190px] flex flex-col justify-between border ${
                is101 ? "bg-blue-950 border-blue-800"
                : isVF ? "bg-amber-950 border-amber-700"
                : "bg-black border-gray-700"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${is101 ? "bg-blue-400" : isVF ? "bg-amber-400" : "bg-green-400"}`} />
                    <span className={`text-xs font-mono ${is101 ? "text-blue-300" : isVF ? "text-amber-400" : "text-green-400"}`}>
                      {is101 ? "VISA NET 101.1" : is1643 ? "TERMINAL MANUAL 1643" : "BANXICO PLUS POS"}
                    </span>
                  </div>
                  <span className="text-gray-500 text-xs font-mono">
                    {now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>

                {step === "amount" && (
                  <div className="text-center flex-1 flex flex-col justify-center">
                    <p className="text-gray-500 text-xs mb-1 uppercase tracking-widest">Monto a cobrar</p>
                    <p className="text-4xl font-bold text-white font-mono" data-testid="display-amount">
                      ${formatAmountDigits(amountDigits)}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">USD</p>
                    {amountUSD > 0 && (
                      <p className="text-gray-400 text-xs mt-0.5 font-mono">≈ ${amountMXNDisplay} MXN</p>
                    )}
                    {isVF && <p className={`text-xs mt-1 font-semibold tracking-widest ${is1643 ? "text-amber-400" : "text-amber-400"}`}>VENTA FORZADA</p>}
                  </div>
                )}

                {step === "card" && (
                  <div className="text-center flex-1 flex flex-col justify-center gap-1">
                    <p className="text-gray-400 text-xs uppercase tracking-widest">Monto</p>
                    <p className="text-2xl font-bold text-white font-mono">${formatAmountDigits(amountDigits)} USD</p>
                    <p className="text-gray-400 text-xs font-mono">≈ ${amountMXNDisplay} MXN</p>
                    <p className={`text-xs mt-1 animate-pulse ${isVF ? "text-amber-400" : "text-[#c8322b]"}`}>Ingresa datos de tarjeta</p>
                    <div className="flex items-center justify-center gap-3 mt-1 text-[10px] text-gray-500 font-mono">
                      <span>OPER: {oper}</span><span>LOTE: {lote}</span>
                    </div>
                  </div>
                )}

                {step === "processing" && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-2">
                    <Loader2 className={`w-8 h-8 animate-spin ${isVF ? "text-amber-400" : is101 ? "text-blue-400" : "text-[#c8322b]"}`} />
                    <p className="text-white text-sm font-bold">{is1643 ? "Procesando terminal manual..." : is101 ? "Conectando Visa Network..." : "Procesando..."}</p>
                    <p className="text-gray-500 text-xs">{is1643 ? "EMV offline" : is101 ? "Red USD — HSBC" : "Banco emisor"}</p>
                  </div>
                )}

                {step === "approved" && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-1">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                    <p className="text-green-400 text-sm font-bold">APROBADO</p>
                    <p className="text-gray-400 text-xs font-mono">{result?.authCode}</p>
                    {isVF && <p className="text-amber-400 text-[10px] font-semibold">VENTA FORZADA</p>}
                    {is101 && <p className="text-blue-300 text-[10px] font-semibold">VISA NETWORK</p>}
                  </div>
                )}
              </div>

              {/* Status strip */}
              <div className="flex items-center justify-between mb-4 text-xs">
                <span className="flex items-center gap-1 text-green-400"><Wifi className="w-3 h-3" /> Online</span>
                <span className="flex items-center gap-1 text-gray-400"><Lock className="w-3 h-3" /> AES-256</span>
                <span className="flex items-center gap-1 text-blue-400"><ShieldCheck className="w-3 h-3" /> EMV</span>
                {isVF && <span className="flex items-center gap-1 text-amber-400"><Zap className="w-3 h-3" /> Forzada</span>}
              </div>

              {/* Numpad */}
              {step === "amount" && (
                <div className="space-y-2">
                  {numpadKeys.map((row, ri) => (
                    <div key={ri} className="grid grid-cols-3 gap-2">
                      {row.map(key => (
                        <button key={key} onClick={() => handleKey(key)} data-testid={`key-${key}`}
                          className={`h-12 rounded-lg font-bold text-lg transition-all active:scale-95 ${
                            key === "C" ? "bg-yellow-600/80 text-white"
                            : key === "DEL" ? "bg-red-700/80 text-white flex items-center justify-center"
                            : "bg-gray-700 text-white hover:bg-gray-600"
                          }`}>
                          {key === "DEL" ? <Delete className="w-4 h-4 mx-auto" /> : key}
                        </button>
                      ))}
                    </div>
                  ))}
                  <Button
                    className={`w-full h-12 text-white rounded-lg text-base font-bold mt-1 ${isVF ? "bg-amber-500" : is101 ? "bg-[#1565C0]" : "bg-[#c8322b]"}`}
                    onClick={handleConfirmAmount} data-testid="button-confirm-amount">
                    <CheckCircle className="w-5 h-5 mr-2" /> Confirmar
                  </Button>
                </div>
              )}

              {step === "approved" && (
                <Button className="w-full h-12 bg-gray-700 text-white rounded-lg font-bold"
                  onClick={handleNewTransaction} data-testid="button-new-transaction-keypad">
                  <RefreshCw className="w-4 h-4 mr-2" /> Nueva Transacción
                </Button>
              )}

              <div className="mt-4 border-t border-gray-700 pt-3 flex items-center justify-center gap-4 text-gray-600">
                <div className="flex items-center gap-1 text-xs"><CreditCard className="w-4 h-4" /> Chip</div>
                <div className="flex items-center gap-1 text-xs"><Wifi className="w-4 h-4" /> NFC</div>
                <div className="flex items-center gap-1 text-xs"><Lock className="w-4 h-4" /> PIN</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Card form */}
          {(step === "card" || step === "processing") && (
            <Card className={is101 ? "border-blue-300" : isVF ? "border-amber-300" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#c8322b]" /> Datos de Tarjeta
                  {is101 && <Badge className="bg-blue-100 text-blue-700 border-blue-200 no-default-active-elevate text-xs">Visa Net</Badge>}
                  {is1643 && <Badge className="bg-amber-100 text-amber-700 border-amber-200 no-default-active-elevate text-xs"><Zap className="w-3 h-3 mr-1" /> Manual</Badge>}
                </CardTitle>
                <CardDescription>
                  ${formatAmountDigits(amountDigits)} USD · ≈ ${amountMXNDisplay} MXN · OPER {oper} / LOTE {lote}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Tipo de Tarjeta</Label>
                  <Select value={cardType} onValueChange={setCardType} disabled={step === "processing"}>
                    <SelectTrigger data-testid="select-card-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{CARD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Número de Tarjeta</Label>
                  <Input placeholder="•••• •••• •••• ••••" value={cardNumber}
                    onChange={e => setCardNumber(formatCard(e.target.value))} maxLength={19}
                    disabled={step === "processing"} className="font-mono tracking-widest" data-testid="input-card-number" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Titular</Label>
                    <Input placeholder="NOMBRE APELLIDO" value={holderName}
                      onChange={e => setHolderName(e.target.value.toUpperCase())}
                      disabled={step === "processing"} data-testid="input-holder-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vencimiento</Label>
                    <Input placeholder="MM/YY" value={expiryDate}
                      onChange={e => {
                        let v = e.target.value.replace(/\D/g, "");
                        if (v.length >= 2) v = v.slice(0, 2) + "/" + v.slice(2, 4);
                        setExpiryDate(v);
                      }}
                      maxLength={5} disabled={step === "processing"} data-testid="input-expiry" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Protocolo de operación</Label>
                  <Select value={protocol} onValueChange={setProtocol} disabled={step === "processing"}>
                    <SelectTrigger data-testid="select-protocol"><SelectValue /></SelectTrigger>
                    <SelectContent>{PROTOCOLS.map(p => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {/* Venta Forzada / 1643 extra fields */}
                {isVF && (
                  <div className="space-y-3 pt-2 border-t border-amber-200">
                    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> {is1643 ? "Parámetros Terminal Manual 1643" : "Parámetros Venta Forzada"}
                    </p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">TRACK2 / Datos pista (opcional)</Label>
                      <Input placeholder="Datos TRACK2 o referencia manual" value={trackData}
                        onChange={e => setTrackData(e.target.value)} className="font-mono text-xs"
                        disabled={step === "processing"} data-testid="input-track-data" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Referencia bancaria / Bank Op Code (opcional)</Label>
                      <Input placeholder="CREED** 00000000-0" value={bankRef}
                        onChange={e => setBankRef(e.target.value)} className="font-mono text-xs"
                        disabled={step === "processing"} data-testid="input-bank-ref" />
                    </div>
                  </div>
                )}

                <div className="pt-1 flex flex-col gap-2">
                  <Button
                    className={`w-full text-white ${is101 ? "bg-[#1565C0]" : isVF ? "bg-amber-500" : "bg-[#c8322b]"}`}
                    onClick={handleProcessPayment}
                    disabled={step === "processing" || processMutation.isPending}
                    data-testid="button-process-payment">
                    {processMutation.isPending
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                      : <><Zap className="w-4 h-4 mr-2" /> Procesar ${formatAmountDigits(amountDigits)} USD</>}
                  </Button>
                  <Button variant="outline" onClick={() => setStep("amount")} disabled={step === "processing"}>
                    <X className="w-4 h-4 mr-2" /> Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approved receipt */}
          {step === "approved" && result && (
            <Card className={is101 ? "border-blue-300" : isVF ? "border-amber-300" : "border-green-300"}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${is101 ? "bg-blue-100" : isVF ? "bg-amber-100" : "bg-green-100"}`}>
                      <CheckCircle className={`w-5 h-5 ${is101 ? "text-blue-600" : isVF ? "text-amber-600" : "text-green-600"}`} />
                    </div>
                    <div>
                      <CardTitle className={`text-base ${is101 ? "text-blue-700" : isVF ? "text-amber-700" : "text-green-700"}`}>
                        {is101 ? "Visa Network Aprobado" : is1643 ? "Venta Forzada Manual Aprobada" : isVF ? "Venta Forzada Aprobada" : "Pago Aprobado"}
                      </CardTitle>
                      <CardDescription>{new Date().toLocaleString("es-MX")}</CardDescription>
                    </div>
                  </div>
                  {is101 && visaNetData && (
                    <Button size="sm" variant="outline"
                      onClick={() => setShowVisaNet(true)}
                      className="text-xs border-blue-300 text-blue-600"
                      data-testid="button-ver-visa-net">
                      <FileBarChart className="w-3.5 h-3.5 mr-1" /> Visa Net
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  {/* Header strip */}
                  <div className={`text-white p-3 text-center space-y-0.5 ${is101 ? "bg-[#1A1F71]" : "bg-[#1A1F71]"}`}>
                    <p className="font-bold text-base tracking-widest font-mono">BANXICO PLUS</p>
                    <p className="text-blue-200 text-xs">
                      {is1643 ? "VENTA FORZADA — TERMINAL MANUAL" : isVF ? "VENTA FORZADA" : "VENTA"}
                    </p>
                    <p className="text-blue-200 text-xs">GRUPO ASGE · VENADO 69 · CANCUN Q.ROO</p>
                  </div>

                  <div className="bg-muted/40 p-4 space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between border-b border-dashed border-border pb-2 mb-2">
                      <span className="text-muted-foreground">
                        {new Date().toLocaleDateString("es-MX")} {now.toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
                      </span>
                      <span className="text-muted-foreground">****{(cardNumber.replace(/\s/g,"") || "7209").slice(-4)}</span>
                    </div>
                    {[
                      { l: "TARJETA",      v: cardType },
                      { l: "TITULAR",      v: holderName || "TITULAR" },
                      { l: "PROTOCOLO",    v: protocol },
                      { l: "OPER / LOTE",  v: `${oper-1} / ${lote-1}` },
                      { l: "IMPORTE USD",  v: `$${formatAmountDigits(amountDigits)}` },
                      { l: `EQUIV MXN`,    v: `$${amountMXNDisplay}` },
                      { l: "TC",           v: `${TC_MXN} MXN/USD` },
                      { l: "APROBACIÓN",   v: result.authCode },
                    ].map((r,i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-muted-foreground">{r.l}</span>
                        <span className="font-bold text-right">{r.v}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-dashed border-border text-center space-y-1">
                      <p className="text-green-600 font-bold tracking-widest">AUTHORIZATION STATUS:</p>
                      <p className="text-green-700 font-bold text-sm">SUCCESSFULLY REDEEMED</p>
                    </div>
                  </div>

                  <div className="bg-[#1A1F71] px-3 py-2 flex items-center justify-between">
                    <span className="text-xl font-extrabold italic text-white"
                      style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>VISA</span>
                    <span className="text-blue-200 text-[10px] font-mono">Net 9.0 Quantum</span>
                    <div className="flex items-center gap-2 text-[10px] text-blue-200 font-mono">
                      <ShieldCheck className="w-3 h-3" /> EMV
                      <Lock className="w-3 h-3" /> PCI DSS
                    </div>
                  </div>
                </div>

                <Button
                  className={`w-full mt-4 text-white ${is101 ? "bg-[#1565C0]" : isVF ? "bg-amber-500" : "bg-[#c8322b]"}`}
                  onClick={handleNewTransaction} data-testid="button-new-transaction">
                  <RefreshCw className="w-4 h-4 mr-2" /> Nueva Transacción
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          {step === "amount" && (
            <Card className="hover-elevate">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#c8322b]" /> Instrucciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {[
                    "Ingresa el importe en centavos (ej. 200000000 = $2,000,000.00 USD)",
                    "Protocolo 201.2 / 101.2 para operaciones internacionales",
                    "Protocolo 101.1 = Transferencia Visa Network (bloques USD)",
                    "Protocolo 1643 = Venta forzada terminal manual (~$30K USD)",
                    "FUNCIONES → Reporte Parámetros para ver config del terminal",
                  ].map((txt, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#c8322b]/10 text-[#c8322b] flex items-center justify-center text-xs font-bold">{i+1}</span>
                      <span className="text-muted-foreground">{txt}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="hover-elevate">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">T/C vigente</span>
                </div>
                <p className="text-xl font-bold text-blue-600 font-mono">{TC_MXN}</p>
                <p className="text-xs text-muted-foreground">MXN por USD</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Operador</span>
                </div>
                <p className="text-sm font-bold truncate">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground">{user?.role}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer Visa Net */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold italic text-[#1A1F71]"
            style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>VISA</span>
          <span className="text-xs text-gray-500 font-mono">Net 9.0 Quantum</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono">
          <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-green-600" /> PCI DSS</span>
          <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-blue-600" /> EMV L2</span>
          <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-purple-600" /> AES-256</span>
          <span className="text-gray-300">|</span>
          <span>TC: {TC_MXN} MXN/USD · BZPAY · V660p-A</span>
        </div>
      </div>
    </div>
  );
}
