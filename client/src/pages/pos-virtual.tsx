import { useState, useEffect, useRef } from "react";
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
import { SiVisa } from "react-icons/si";
import {
  MonitorSmartphone, CreditCard, Wifi, ShieldCheck, CheckCircle,
  X, Delete, RefreshCw, Activity, Loader2, Receipt,
  Zap, Clock, Lock, AlertTriangle, Settings, FileBarChart,
  Radio, Download, Info, ChevronRight, Printer
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ProcessResult {
  success: boolean;
  authCode: string;
  tokenId: string;
  transaction: { transactionId: string; amount: string; status: string; createdAt: string };
  message: string;
}

interface ReporteData {
  track1: string;
  track2: string;
  authCode: string;
  amount: string;
  cardNumber: string;
  holderName: string;
  expDate: string;
  protocol: string;
  fedCode: string;
  txCode: string;
  depositeCode: string;
  bankOpCode: string;
  releaseCode: string;
  cvv2: string;
  rrn: string;
  timestamp: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
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
  { code: "101.1", label: "101.1 M1 — Transferencia básica nacional" },
  { code: "101.2", label: "101.2 M2 — Transferencia internacional" },
  { code: "101.3", label: "101.3 M3 — Transferencia segura" },
  { code: "201.1", label: "201.1 — Pago nacional" },
  { code: "201.2", label: "201.2 — Pago internacional" },
  { code: "201.3", label: "201.3 — Pago express" },
  { code: "301.1", label: "301.1 — Depósito cuenta" },
  { code: "401.1", label: "401.1 — Retiro ATM" },
  { code: "1643",  label: "1643 — Retiro POS (Protocolo especial)" },
];

const FUNCIONES_MENU = [
  { num: 1, label: "REPORTE PARAMETROS",  icon: FileBarChart },
  { num: 2, label: "MODO COMUNICACION",   icon: Radio },
  { num: 3, label: "CONFIG TERMINAL",     icon: Settings },
  { num: 4, label: "CARGA PARAM",         icon: Download },
  { num: 5, label: "ACERCA DE",           icon: Info },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatAmount(digits: string): string {
  if (!digits) return "0.00";
  const num = parseInt(digits, 10);
  return (num / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function randHex(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join("");
}
function randNum(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10).toString()).join("");
}

function buildReporteData(
  amountDigits: string, cardNumber: string, holderName: string,
  expiryDate: string, protocol: string, authCode: string, txId: string
): ReporteData {
  const amt = (parseInt(amountDigits, 10) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
  const cardLast4 = (cardNumber.replace(/\s/g, "") || "4040310011384895").slice(-4);
  return {
    track1: `SEARCH_FOR_CC_DATA+LO QUANTUM 8.1 ((B|B))[13.19]/<(A_ZA_A/S)(${protocol.replace(".", "")}/${protocol.replace(".", "")})........./EMV/D2/COMPLETE`,
    track2: `OPEN PROCESS_ACCESS SYSTEM _AND READ _VERIFY/MEM+149-MALWARE/TRACK_DATE/VMML/+52${randNum(10)}`,
    authCode: authCode || randNum(6),
    amount: amt,
    cardNumber: (cardNumber.replace(/\s/g, "") || "4040310011384895").replace(/.(?=.{4})/g, "*"),
    holderName: (holderName || "BANXICO LLC").toUpperCase(),
    expDate: expiryDate || "02/27",
    protocol,
    fedCode: `E-${randNum(4)}HSBC.${randNum(4)}.${randNum(4)}.${randNum(4)}.${randNum(4)}.${randNum(4)}.${randNum(3)}`,
    txCode: `${randNum(6)}HSBC${randNum(6)}`,
    depositeCode: `G${randNum(3)}-${randNum(7)}DB-HSBC-${randNum(8)}`,
    bankOpCode: `CREED** ${randNum(8)}-${randNum(1)}`,
    releaseCode: randNum(6),
    cvv2: randNum(3),
    rrn: txId.slice(-8).toUpperCase(),
    timestamp: new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City", hour12: false }),
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function VisaLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center font-extrabold italic tracking-tight text-[#1A1F71] ${className}`}
      style={{ fontFamily: "'Arial Black', Arial, sans-serif", fontSize: "inherit" }}>
      VISA
    </span>
  );
}

function FuncionesModal({ onClose, onSelect }: { onClose: () => void; onSelect: (n: number) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-72 rounded-xl overflow-hidden shadow-2xl border border-gray-600" style={{ background: "#1a2a3a" }}>
        {/* Header */}
        <div className="py-3 px-4 text-center" style={{ background: "#0d1b2a" }}>
          <p className="text-white font-bold tracking-widest text-sm">FUNCIONES</p>
        </div>
        {/* Menu items */}
        <div className="p-4 space-y-2.5">
          {FUNCIONES_MENU.map(item => (
            <button
              key={item.num}
              onClick={() => onSelect(item.num)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white font-semibold text-sm text-left transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #1565C0, #0d47a1)" }}
            >
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {item.num}
              </span>
              <span className="tracking-wide">{item.label}</span>
            </button>
          ))}
        </div>
        {/* Cancel */}
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

function ReporteParametrosModal({ data, onClose }: { data: ReporteData; onClose: () => void }) {
  function row(label: string, value: string) {
    const dots = ".".repeat(Math.max(2, 55 - label.length - value.length));
    return (
      <div key={label} className="flex text-[10px] font-mono leading-5 gap-0.5">
        <span className="text-blue-300 whitespace-nowrap">{label}:</span>
        <span className="text-gray-400 flex-1 overflow-hidden">{dots}</span>
        <span className="text-green-300 text-right whitespace-nowrap ml-1">{value}</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl overflow-hidden shadow-2xl border border-gray-700 my-4"
        style={{ background: "#000d1a", fontFamily: "monospace" }}>
        {/* Close bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-black/60">
          <span className="text-xs text-gray-400 font-mono">REPORTE PARAMETROS — Visa Net 9.0 Quantum</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 overflow-y-auto max-h-[75vh]">
          {/* TRACK lines */}
          <div className="text-[10px] font-mono text-cyan-400 leading-5">
            <p>TRACK1_DATA: {data.track1}</p>
          </div>
          <div className="text-[10px] font-mono text-cyan-400 leading-5">
            <p>TRACK2_DATA: {data.track2}</p>
          </div>
          <div className="text-[10px] font-mono text-cyan-400">
            <p>TRACK3_DATA: VERIFY_EXIT</p>
          </div>

          {/* Visa auth strip */}
          <div className="my-3 rounded-lg border border-blue-500/40 bg-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-extrabold italic text-[#1A1F71]"
                style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>VISA</span>
              <span className="text-gray-500 text-xs font-mono border-l border-gray-300 pl-3">
                <span className="text-2xl font-bold text-gray-700">{data.authCode}</span>
              </span>
            </div>
            <div className="w-12 h-12 border border-gray-300 flex items-center justify-center bg-gray-50 rounded">
              <div className="grid grid-cols-5 gap-px p-1">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 ${Math.random() > 0.5 ? "bg-gray-800" : "bg-white"}`} />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-0.5">
            {row("F20:SENDER'S/REFERENCE/MONARCHCOORPORATE", "VMML/DIGITAL CASH")}
            {row("SECURITY VISAINC_ORDSHR", "OK")}
            {row("NUMBER", `CEMC${randNum(7)}-1`)}
            {row("RF21", `TRANSACTION CODE / ${data.txCode}`)}
            {row("F22:*****", `DEPOSITE CODE /${data.depositeCode}`)}
            {row("FED CODE", data.fedCode)}
            {row("F23B", `BANK OPERATION CODE / ${data.bankOpCode}`)}
            {row("F32A", "DIGITAL CASH/USD/HSBC/ VISAINC_ORDSHR")}
            {row("RECEIVER/AMOUNT", `${data.amount} USD 11#DOLLARS#`)}
            {row("RECEIVER /CARD NUMBER", `<${data.cardNumber}`)}
            {row("RECEIVER/EXPIRATION DATE", data.expDate)}
            {row("RECEIVER /CARD HOLDER NAME", `<${data.holderName}`)}
            {row("RECEIVER/STATUS TRANSACTION", "ONLINE SALE")}
            {row("RECEIVER/REDIRECTING TO VISA NETWORK", "OK")}
            {row("RECEIVER/CONNECTING TO DATA BASE", "CONNECTED")}
            {row("RECEIVER/ACCOUNT VERIFICATION", "OK")}
            {row("RECEIVER/APPROVAL CVV2", data.cvv2)}
            {row("RECEIVER/PIN AUTHORIZATION CODE", data.authCode)}
            {row("RELEASE CODE", data.releaseCode)}
            {row("PROTOCOL", data.protocol)}
            {row("GLOBAL TRANSFER TIME", `< ${data.timestamp} CST`)}
          </div>

          {/* Auth status */}
          <div className="mt-4 rounded-lg border border-green-500/40 bg-green-950/30 p-4 text-center">
            <p className="text-green-300 text-xs font-mono tracking-widest">AUTHORIZATION STATUS:</p>
            <p className="text-green-400 font-bold text-sm font-mono mt-1">SUCCESSFULLY REDEEMED</p>
            <p className="text-green-300 text-2xl font-bold font-mono mt-1">{data.authCode}</p>
          </div>

          {/* Footer */}
          <div className="text-center space-y-1 pt-2 border-t border-gray-700">
            <p className="text-[9px] text-gray-500 font-mono">
              SYSTEM DEPARTMENT/ACCESS/VIS91**{randNum(5)}***/***{randNum(6)} SYSTEM SCREEN FROM:
            </p>
            <p className="text-[9px] text-blue-400 font-mono">www.usa.visa.com/vmml/access</p>
            <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-gray-800">
              <span className="text-[10px] font-extrabold italic text-[#1A1F71] bg-white px-2 py-0.5 rounded"
                style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>VISA</span>
              <span className="text-[10px] text-gray-400 font-mono">Net 9.0 Quantum</span>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <Button onClick={onClose} className="w-full bg-[#1565C0] text-white text-xs">
            Cerrar Reporte
          </Button>
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

// ─── Main Component ───────────────────────────────────────────────────────────
type Step = "amount" | "card" | "processing" | "approved";

export default function POSVirtualPage() {
  const { toast } = useToast();
  const { user } = useAuth();

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

  // Venta Forzada
  const [ventaForzada, setVentaForzada] = useState(false);
  const [trackData, setTrackData] = useState("");
  const [bankRef, setBankRef] = useState("");

  // Modals
  const [showFunciones, setShowFunciones] = useState(false);
  const [showReporte, setShowReporte] = useState(false);
  const [reporteData, setReporteData] = useState<ReporteData | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; content: string } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const processMutation = useMutation({
    mutationFn: async () => {
      const amount = parseInt(amountDigits, 10) / 100;
      if (amount <= 0) throw new Error("Monto inválido");
      const res = await apiRequest("POST", "/api/pos/process-payment", {
        cardType,
        cardNumber: cardNumber.replace(/\s/g, "") || "4111111111111111",
        amount,
        protocol,
        holderName: holderName || "TITULAR",
        expiryDate: expiryDate || "12/27",
        ventaForzada,
      });
      if (!res.ok) throw new Error("Error al procesar");
      return res.json() as Promise<ProcessResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("approved");
      setLote(l => l + 1);
      setOper(o => o + 1);
      // Build reporte for detailed receipt
      const rd = buildReporteData(amountDigits, cardNumber, holderName, expiryDate, protocol, data.authCode, data.transaction.transactionId);
      setReporteData(rd);
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
    if (key === "DEL") { setAmountDigits(prev => prev.slice(0, -1)); return; }
    if (amountDigits.length >= 9) return;
    setAmountDigits(prev => prev + key);
  }

  function handleConfirmAmount() {
    const amount = parseInt(amountDigits, 10) / 100;
    if (!amount || amount <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a $0.00", variant: "destructive" });
      return;
    }
    setStep("card");
  }

  function handleProcessPayment() {
    if (!cardType) return;
    setStep("processing");
    processMutation.mutate();
  }

  function handleNewTransaction() {
    setStep("amount"); setAmountDigits(""); setCardType("Mastercard Internacional");
    setCardNumber(""); setHolderName(""); setExpiryDate(""); setProtocol("201.2");
    setResult(null); setVentaForzada(false); setTrackData(""); setBankRef("");
  }

  function formatCardDisplay(n: string) {
    const clean = n.replace(/\D/g, "").substring(0, 16);
    return clean.replace(/(.{4})/g, "$1 ").trim();
  }

  function handleFuncionSelect(n: number) {
    setShowFunciones(false);
    if (n === 1) {
      // Reporte Parámetros — generate with current transaction data or blank
      const rd = buildReporteData(
        amountDigits || "2016000", cardNumber, holderName, expiryDate,
        protocol, result?.authCode || randNum(6), result?.transaction.transactionId || randNum(8)
      );
      setReporteData(rd);
      setShowReporte(true);
    } else if (n === 2) {
      setInfoModal({ title: "MODO COMUNICACION", content: "Estado: ONLINE\nRed: GPRS/4G\nIP Host: 10.0.0.1\nPuerto: 8583\nProtocolo ISO 8583\nTimeout: 30s\nReintentos: 3" });
    } else if (n === 3) {
      setInfoModal({ title: "CONFIG TERMINAL", content: `Terminal ID: T1005\nComercio: BANXICO PLUS\nVendor: Verifone\nModelo: V240m\nFirmware: 3.37.2\nEMV Kernel: 4.3\nContactless: Habilitado` });
    } else if (n === 4) {
      setInfoModal({ title: "CARGA PARAM", content: "Descargando parámetros...\n\n[OK] AID VISA\n[OK] AID MASTERCARD\n[OK] AID AMEX\n[OK] CAPK Keys\n[OK] Configuración Host\n[OK] Tablas EMV\n\nCarga completa." });
    } else if (n === 5) {
      setInfoModal({ title: "ACERCA DE", content: "Banxico Plus POS\nVersión: 3.37.2\nVisa Net: 9.0 Quantum\nEMV Level 2: Aprobado\nPCI DSS: Cumplimiento activo\nCertificado: 2026-2027\nProveedor: BZPAY/Verifone" });
    }
  }

  const numpadKeys = [["1","2","3"],["4","5","6"],["7","8","9"],["C","0","DEL"]];

  return (
    <div className="p-4 md:p-6 space-y-5 pb-24">
      {/* Modals */}
      {showFunciones && (
        <FuncionesModal onClose={() => setShowFunciones(false)} onSelect={handleFuncionSelect} />
      )}
      {showReporte && reporteData && (
        <ReporteParametrosModal data={reporteData} onClose={() => setShowReporte(false)} />
      )}
      {infoModal && (
        <InfoModal title={infoModal.title} content={infoModal.content} onClose={() => setInfoModal(null)} />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MonitorSmartphone className="w-7 h-7 text-[#c8322b]" /> POS Virtual
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Terminal punto de venta · EMV / PCI DSS · Visa Net 9.0 Quantum
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFunciones(true)}
            data-testid="button-funciones"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border border-blue-400 text-blue-600 bg-blue-50 transition-all"
          >
            <Settings className="w-3.5 h-3.5" /> FUNCIONES
          </button>
          <button
            onClick={() => setVentaForzada(v => !v)}
            data-testid="button-venta-forzada"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              ventaForzada
                ? "bg-amber-500 border-amber-500 text-white shadow-md"
                : "bg-muted border-border text-muted-foreground"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Venta Forzada {ventaForzada ? "ON" : "OFF"}
          </button>
          <div className="flex items-center gap-2 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-md font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> AES-256
          </div>
        </div>
      </div>

      {/* Venta Forzada warning */}
      {ventaForzada && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                <span className="font-bold">Modo Venta Forzada activo.</span> Procesa sin verificación del banco emisor.
                Solo para operaciones autorizadas bajo protocolo EMV offline.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Terminal Device */}
        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-sm">
            <div className="bg-gray-900 rounded-2xl p-5 shadow-2xl border border-gray-700">
              {/* Screen */}
              <div className={`rounded-lg p-4 mb-4 min-h-[180px] flex flex-col justify-between border ${ventaForzada ? "bg-amber-950 border-amber-700" : "bg-black border-gray-700"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${ventaForzada ? "bg-amber-400" : "bg-green-400"}`} />
                    <span className={`text-xs font-mono ${ventaForzada ? "text-amber-400" : "text-green-400"}`}>
                      BANXICO PLUS POS{ventaForzada ? " · FORZADA" : ""}
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
                      ${formatAmount(amountDigits)}
                    </p>
                    <p className="text-gray-600 text-xs mt-1">USD</p>
                    {ventaForzada && <p className="text-amber-400 text-[10px] mt-1 font-semibold tracking-widest">VENTA FORZADA</p>}
                  </div>
                )}

                {step === "card" && (
                  <div className="text-center flex-1 flex flex-col justify-center gap-1">
                    <p className="text-gray-400 text-xs uppercase tracking-widest">Monto</p>
                    <p className="text-2xl font-bold text-white font-mono">${formatAmount(amountDigits)}</p>
                    <p className="text-[#c8322b] text-xs mt-1 animate-pulse">Ingresa datos de tarjeta</p>
                    <div className="flex items-center justify-center gap-3 mt-1 text-[10px] text-gray-500 font-mono">
                      <span>OPER: {oper}</span><span>LOTE: {lote}</span>
                    </div>
                  </div>
                )}

                {step === "processing" && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-2">
                    <Loader2 className={`w-8 h-8 animate-spin ${ventaForzada ? "text-amber-400" : "text-[#c8322b]"}`} />
                    <p className="text-white text-sm font-bold">{ventaForzada ? "Procesando FORZADO..." : "Procesando..."}</p>
                    <p className="text-gray-500 text-xs">{ventaForzada ? "Modo offline EMV" : "Conectando banco emisor"}</p>
                  </div>
                )}

                {step === "approved" && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-1">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                    <p className="text-green-400 text-sm font-bold">APROBADO</p>
                    <p className="text-gray-400 text-xs font-mono">{result?.authCode}</p>
                    {ventaForzada && <p className="text-amber-400 text-[10px] font-semibold">VENTA FORZADA</p>}
                  </div>
                )}
              </div>

              {/* Status strip */}
              <div className="flex items-center justify-between mb-4 text-xs">
                <span className="flex items-center gap-1 text-green-400"><Wifi className="w-3 h-3" /> Online</span>
                <span className="flex items-center gap-1 text-gray-400"><Lock className="w-3 h-3" /> AES-256</span>
                <span className="flex items-center gap-1 text-blue-400"><ShieldCheck className="w-3 h-3" /> EMV</span>
                {ventaForzada && <span className="flex items-center gap-1 text-amber-400"><Zap className="w-3 h-3" /> Forzada</span>}
              </div>

              {/* Numpad */}
              {step === "amount" && (
                <div className="space-y-2">
                  {numpadKeys.map((row, ri) => (
                    <div key={ri} className="grid grid-cols-3 gap-2">
                      {row.map(key => (
                        <button
                          key={key}
                          onClick={() => handleKey(key)}
                          data-testid={`key-${key}`}
                          className={`h-12 rounded-lg font-bold text-lg transition-all active:scale-95 ${
                            key === "C" ? "bg-yellow-600/80 text-white hover:bg-yellow-500"
                            : key === "DEL" ? "bg-red-700/80 text-white hover:bg-red-600 flex items-center justify-center"
                            : "bg-gray-700 text-white hover:bg-gray-600"
                          }`}
                        >
                          {key === "DEL" ? <Delete className="w-4 h-4 mx-auto" /> : key}
                        </button>
                      ))}
                    </div>
                  ))}
                  <Button
                    className={`w-full h-12 text-white rounded-lg text-base font-bold mt-1 ${ventaForzada ? "bg-amber-500" : "bg-[#c8322b]"}`}
                    onClick={handleConfirmAmount}
                    data-testid="button-confirm-amount"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" /> Confirmar
                  </Button>
                </div>
              )}

              {step === "approved" && (
                <Button
                  className="w-full h-12 bg-gray-700 text-white rounded-lg font-bold"
                  onClick={handleNewTransaction}
                  data-testid="button-new-transaction-keypad"
                >
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
            <Card className={ventaForzada ? "border-amber-300" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#c8322b]" /> Datos de Tarjeta
                  {ventaForzada && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 no-default-active-elevate text-xs">
                      <Zap className="w-3 h-3 mr-1" /> Forzada
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Importe: ${formatAmount(amountDigits)} USD · OPER {oper} / LOTE {lote}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Tipo de Tarjeta</Label>
                  <Select value={cardType} onValueChange={setCardType} disabled={step === "processing"}>
                    <SelectTrigger data-testid="select-card-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CARD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Número de Tarjeta</Label>
                  <Input
                    placeholder="•••• •••• •••• ••••"
                    value={cardNumber}
                    onChange={e => setCardNumber(formatCardDisplay(e.target.value))}
                    maxLength={19} disabled={step === "processing"}
                    className="font-mono tracking-widest" data-testid="input-card-number"
                  />
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
                        if (v.length >= 2) v = v.substring(0, 2) + "/" + v.substring(2, 4);
                        setExpiryDate(v);
                      }}
                      maxLength={5} disabled={step === "processing"} data-testid="input-expiry" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Protocolo de operación</Label>
                  <Select value={protocol} onValueChange={setProtocol} disabled={step === "processing"}>
                    <SelectTrigger data-testid="select-protocol"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROTOCOLS.map(p => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Venta Forzada extra fields */}
                {ventaForzada && (
                  <div className="space-y-3 pt-2 border-t border-amber-200">
                    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Parámetros Venta Forzada
                    </p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">TRACK2 / Datos pista (opcional)</Label>
                      <Input
                        placeholder="Datos TRACK2 o referencia manual"
                        value={trackData}
                        onChange={e => setTrackData(e.target.value)}
                        className="font-mono text-xs" disabled={step === "processing"}
                        data-testid="input-track-data"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Referencia bancaria / Bank Op Code (opcional)</Label>
                      <Input
                        placeholder="CREED** 00000000-0"
                        value={bankRef}
                        onChange={e => setBankRef(e.target.value)}
                        className="font-mono text-xs" disabled={step === "processing"}
                        data-testid="input-bank-ref"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-1 flex flex-col gap-2">
                  <Button
                    className={`w-full text-white ${ventaForzada ? "bg-amber-500" : "bg-[#c8322b]"}`}
                    onClick={handleProcessPayment}
                    disabled={step === "processing" || processMutation.isPending}
                    data-testid="button-process-payment"
                  >
                    {processMutation.isPending
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                      : ventaForzada
                        ? <><Zap className="w-4 h-4 mr-2" /> Procesar Venta Forzada ${formatAmount(amountDigits)}</>
                        : <><Zap className="w-4 h-4 mr-2" /> Procesar Pago ${formatAmount(amountDigits)}</>
                    }
                  </Button>
                  <Button variant="outline" onClick={() => setStep("amount")} disabled={step === "processing"} data-testid="button-back-amount">
                    <X className="w-4 h-4 mr-2" /> Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approved receipt */}
          {step === "approved" && result && reporteData && (
            <Card className={ventaForzada ? "border-amber-300" : "border-green-300"}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ventaForzada ? "bg-amber-100" : "bg-green-100"}`}>
                      <CheckCircle className={`w-5 h-5 ${ventaForzada ? "text-amber-600" : "text-green-600"}`} />
                    </div>
                    <div>
                      <CardTitle className={`text-base ${ventaForzada ? "text-amber-700" : "text-green-700"}`}>
                        {ventaForzada ? "Venta Forzada Aprobada" : "Pago Aprobado"}
                      </CardTitle>
                      <CardDescription>{new Date().toLocaleString("es-MX")}</CardDescription>
                    </div>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setShowReporte(true)}
                    className="text-xs border-blue-300 text-blue-600"
                    data-testid="button-ver-reporte"
                  >
                    <FileBarChart className="w-3.5 h-3.5 mr-1" /> Reporte
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Visa-style receipt */}
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  {/* Header strip */}
                  <div className="bg-[#1A1F71] text-white p-3 text-center space-y-0.5">
                    <p className="font-bold text-base tracking-widest font-mono">BANXICO PLUS</p>
                    <p className="text-blue-200 text-xs">VENTA{ventaForzada ? " — FORZADA" : ""}</p>
                    <p className="text-blue-200 text-xs">GRUPO ASGE · VENADO 69 · CANCUN Q.ROO</p>
                  </div>

                  <div className="bg-muted/40 p-4 space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between border-b border-dashed border-border pb-2 mb-2">
                      <span className="text-muted-foreground">{new Date().toLocaleDateString("es-MX")} {now.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>
                      <span className="text-muted-foreground">****{(cardNumber.replace(/\s/g,"") || "7209").slice(-4)}</span>
                    </div>
                    {[
                      { l: "TARJETA",     v: cardType },
                      { l: "TITULAR",     v: holderName || "TITULAR" },
                      { l: "PROTOCOLO",   v: protocol },
                      { l: "OPER / LOTE", v: `${oper-1} / ${lote-1}` },
                      { l: "IMPORTE",     v: `$${formatAmount(amountDigits)} USD` },
                      { l: "APROBACIÓN",  v: result.authCode },
                      { l: "RRN",         v: reporteData.rrn },
                      { l: "RELEASE",     v: reporteData.releaseCode },
                      { l: "CVV2",        v: reporteData.cvv2 },
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

                  {/* Visa Net footer */}
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
                  className={`w-full mt-4 text-white ${ventaForzada ? "bg-amber-500" : "bg-[#c8322b]"}`}
                  onClick={handleNewTransaction}
                  data-testid="button-new-transaction"
                >
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
                    "Ingresa el importe en centavos (ej. 2016000 = $20,160.00)",
                    "Confirma el monto e ingresa datos de tarjeta",
                    "Selecciona protocolo (101.2 M2 para internacional)",
                    "Activa Venta Forzada para modo EMV offline",
                    "Usa FUNCIONES para Reporte Parámetros y configuración",
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
                  <span className="text-xs text-muted-foreground">Tiempo respuesta</span>
                </div>
                <p className="text-xl font-bold text-blue-600">~2.1s</p>
                <p className="text-xs text-muted-foreground">Promedio red</p>
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
          <span>BZPAY · Verifone V240m · 3.37.2</span>
        </div>
      </div>
    </div>
  );
}
