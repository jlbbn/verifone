import { useState, useEffect, useMemo, useRef } from "react";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PaymentEnginePanel } from "@/components/payment-engine-panel";
import {
  MonitorSmartphone, CreditCard, Wifi, ShieldCheck, CheckCircle,
  X, XCircle, Delete, RefreshCw, Activity, Loader2, Receipt,
  Zap, Clock, Lock, AlertTriangle, Settings, FileBarChart,
  Radio, Download, Info, ChevronRight, Printer, ArrowDownLeft, Sliders, Link2,
  TriangleAlert, Router
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

const PROTOCOLS: { code: string; label: string; authDigits: number | null; desc: string }[] = [
  // Transfers / Transferencias (101.x)
  { code: "101.1", label: "101.1 — Basic Transfer / Transferencia básica",           authDigits: 4,    desc: "✔️ 101.1 - Requiere código de aprobación de 4 dígitos" },
  { code: "101.2", label: "101.2 — Validated Transfer / Transferencia con validación", authDigits: 6,  desc: "✔️ 101.2 – Requiere código de aprobación de 6 dígitos" },
  { code: "101.3", label: "101.3 — Secure Transfer / Transferencia segura",           authDigits: 6,    desc: "✔️ 101.3 – Requiere código de aprobación de 6 dígitos" },
  { code: "101.4", label: "101.4 — Priority Transfer / Transferencia prioritaria",    authDigits: 6,    desc: "✔️ 101.4 – Requiere código de aprobación de 6 dígitos" },
  { code: "101.6", label: "101.6 — Pre-Authorization / Pre-Autorización",             authDigits: null, desc: "✔️ 101.6 – Pre-Autorización" },
  { code: "101.7", label: "101.7 — Fast Transfer / Transferencia rápida",             authDigits: 4,    desc: "✔️ 101.7 – Requiere código de aprobación de 4 dígitos" },
  { code: "101.8", label: "101.8 — PIN-less Transaction / Transacción sin PIN",       authDigits: 6,    desc: "✔️ 101.8 – Transacción sin PIN" },
  // Payments / Pagos (201.x)
  { code: "201.1", label: "201.1 — Domestic Payment / Pago nacional",                 authDigits: 6,    desc: "✔️ 201.1 - Requiere código de aprobación de 6 dígitos" },
  { code: "201.2", label: "201.2 — International Payment / Pago internacional",       authDigits: 6,    desc: "✔️ 201.2 – Requiere código de aprobación de 6 dígitos" },
  { code: "201.3", label: "201.3 — Express Payment / Pago express",                   authDigits: 6,    desc: "✔️ 201.3 – Requiere código de aprobación de 6 dígitos" },
  // Deposits / Depósitos (301.x)
  { code: "301.1", label: "301.1 — Account Deposit / Depósito cuenta",                authDigits: 6,    desc: "6-digit approval code / Código de aprobación 6 dígitos" },
  { code: "301.2", label: "301.2 — Cash Deposit / Depósito efectivo",                 authDigits: 6,    desc: "6-digit approval code / Código de aprobación 6 dígitos" },
  // Withdrawals / Retiros (401.x)
  { code: "401.1", label: "401.1 — ATM Withdrawal / Retiro ATM",                      authDigits: 6,    desc: "6-digit approval code / Código de aprobación 6 dígitos" },
  // Special / Especial
  { code: "1643",  label: "1643 — Venta manual",                                     authDigits: 4,    desc: "Manual terminal offline / Terminal manual sin conexión EMV" },
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
      <div className="w-[calc(100%-2rem)] max-w-72 rounded-xl overflow-hidden shadow-2xl border border-gray-600" style={{ background: "#1a2a3a" }}>
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

// ─── SR-Link: Sender / Receiver Pairing ───────────────────────────────────────

const SR_CARD_TYPES = [
  "MASTERCARD DEBIT","MASTERCARD CREDIT","MASTERCARD WORLD",
  "VISA DEBIT","VISA CREDIT","VISA CLASSIC","AMEX","MAESTRO","REVOLUT",
];
const SR_CURRENCIES = ["EUR","USD","MXN","GBP"];
const ISO_COUNTRIES = [
  { a1:"MEXICO",         a2:"MX", a3:"MEX", num:"484" },
  { a1:"UNITED STATES",  a2:"US", a3:"USA", num:"840" },
  { a1:"UNITED KINGDOM", a2:"GB", a3:"GBR", num:"826" },
  { a1:"CANADA",         a2:"CA", a3:"CAN", num:"124" },
  { a1:"SPAIN",          a2:"ES", a3:"ESP", num:"724" },
  { a1:"FRANCE",         a2:"FR", a3:"FRA", num:"250" },
  { a1:"GERMANY",        a2:"DE", a3:"DEU", num:"276" },
  { a1:"ITALY",          a2:"IT", a3:"ITA", num:"380" },
  { a1:"CHINA",          a2:"CN", a3:"CHN", num:"156" },
  { a1:"JAPAN",          a2:"JP", a3:"JPN", num:"392" },
];
const SR_STEPS = [
  { label: "Connecting to Mastercard Network",  result: "OK",       col: "text-green-400" },
  { label: "Verifying Sender Card",             result: "VERIFIED", col: "text-green-400" },
  { label: "Verifying Receiver Card",           result: "VERIFIED", col: "text-green-400" },
  { label: "Checking Protocol",                 result: "OK",       col: "text-green-400" },
  { label: "Linking Sender → Receiver",         result: "LINKED",   col: "text-amber-300" },
  { label: "Generating Authorization Code",     result: "",         col: "text-amber-300" },
  { label: "Creating Transaction Record",       result: "DONE",     col: "text-green-400" },
  { label: "SR-LINK Complete",                  result: "APPROVED", col: "text-green-400" },
];

interface SRForm {
  senderName: string; senderCard: string; senderBank: string;
  senderCardType: string; senderExpiry: string; senderCountryIdx: number;
  receiverName: string; receiverCard: string; receiverBank: string;
  receiverCardType: string; receiverExpiry: string; receiverCountryIdx: number;
  totalAmount: string; renderedAmount: string; currency: string; protocol: string;
}
type SRStep = "form" | "processing" | "linked";

function MCLogo() {
  return (
    <div className="flex flex-col items-center gap-1 my-2">
      <div className="relative w-14 h-9">
        <div className="absolute left-0 top-0 w-9 h-9 rounded-full bg-[#EB001B] opacity-90" />
        <div className="absolute right-0 top-0 w-9 h-9 rounded-full bg-[#F79E1B] opacity-80" />
      </div>
      <span className="text-white text-[10px] tracking-widest font-semibold" style={{ fontFamily: "'Arial Black',Arial,sans-serif" }}>mastercard</span>
    </div>
  );
}

function SRBarcode() {
  const p = [2,1,3,1,2,1,4,1,1,2,3,1,2,1,1,3,2,1,4,1,1,2,3,1,1,2,4,1,2,1,3,1];
  return (
    <div className="flex items-end h-6 gap-px my-2 justify-center">
      {p.map((w, i) => (
        <div key={i} className={i % 2 === 0 ? "bg-white" : "bg-transparent"}
          style={{ width: w * 2, height: i % 4 === 0 ? "100%" : "75%" }} />
      ))}
    </div>
  );
}

function fmtAmt(v: string) {
  const n = parseFloat(v.replace(/,/g, ""));
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function DotRow({ label, value, col }: { label: string; value: string; col: string }) {
  const dots = ".".repeat(Math.max(2, 44 - label.length - value.length));
  return (
    <div className="flex text-[9px] leading-[17px]">
      <span className="text-gray-400 whitespace-nowrap">{label}:</span>
      <span className="text-gray-700 flex-1 overflow-hidden tracking-tighter">{dots}</span>
      <span className={`${col} font-bold whitespace-nowrap ml-1`}>{value}</span>
    </div>
  );
}

function SRLinkModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [srStep, setSrStep] = useState<SRStep>("form");
  const [visibleStep, setVisibleStep] = useState(0);
  const [apiResult, setApiResult] = useState<any>(null);

  const [form, setForm] = useState<SRForm>({
    senderName: "PATRICIO", senderCard: "", senderBank: "", senderCardType: "MASTERCARD DEBIT",
    senderExpiry: "", senderCountryIdx: 0,
    receiverName: "", receiverCard: "", receiverBank: "", receiverCardType: "MASTERCARD DEBIT",
    receiverExpiry: "", receiverCountryIdx: 0,
    totalAmount: "", renderedAmount: "", currency: "EUR", protocol: "101",
  });

  function upd<K extends keyof SRForm>(k: K, v: SRForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const linkMutation = useMutation({
    mutationFn: async () => {
      const recv = ISO_COUNTRIES[form.receiverCountryIdx];
      const send = ISO_COUNTRIES[form.senderCountryIdx];
      const res = await apiRequest("POST", "/api/sr-link", {
        senderName: form.senderName, senderCard: form.senderCard, senderBank: form.senderBank,
        senderCardType: form.senderCardType, senderExpiry: form.senderExpiry,
        senderCountry: send.a1, senderA2: send.a2, senderA3: send.a3, senderIsoNum: send.num,
        receiverName: form.receiverName, receiverCard: form.receiverCard, receiverBank: form.receiverBank,
        receiverCardType: form.receiverCardType, receiverExpiry: form.receiverExpiry,
        receiverCountry: recv.a1, receiverA2: recv.a2, receiverA3: recv.a3, receiverIsoNum: recv.num,
        totalAmount: form.totalAmount, renderedAmount: form.renderedAmount,
        currency: form.currency, protocol: form.protocol,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al vincular");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setApiResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error de vinculación", description: e.message, variant: "destructive" });
      setSrStep("form");
    },
  });

  function handleVincular() {
    if (!form.receiverName.trim() || !form.receiverCard.trim() || !form.senderCard.trim()) return;
    setSrStep("processing");
    setVisibleStep(0);
    linkMutation.mutate();
  }

  useEffect(() => {
    if (srStep !== "processing") return;
    if (visibleStep >= SR_STEPS.length) return;
    const t = setTimeout(() => setVisibleStep(v => v + 1), 720);
    return () => clearTimeout(t);
  }, [srStep, visibleStep]);

  useEffect(() => {
    if (srStep === "processing" && visibleStep >= SR_STEPS.length && apiResult) {
      const t = setTimeout(() => setSrStep("linked"), 900);
      return () => clearTimeout(t);
    }
  }, [srStep, visibleStep, apiResult]);

  const rLast4 = form.receiverCard.replace(/\s/g, "").slice(-4) || "????";

  if (srStep === "form") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 overflow-y-auto">
        <div className="w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl border border-blue-900/50 my-4"
          style={{ background: "#050f1a", fontFamily: "monospace" }}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-blue-900/50 bg-black/60">
            <div className="flex items-center gap-2.5">
              <div className="flex">
                <div className="w-5 h-5 rounded-full bg-[#EB001B] opacity-90" />
                <div className="w-5 h-5 rounded-full bg-[#F79E1B] opacity-80 -ml-2" />
              </div>
              <span className="text-blue-300 text-xs font-bold tracking-widest">MASTERCARD NETWORK — SENDER / RECEIVER LINK</span>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          <div className="p-4 grid md:grid-cols-2 gap-4">
            {/* SENDER */}
            <div className="rounded-lg border border-amber-700/50 bg-amber-950/10 p-4 space-y-3">
              <p className="text-amber-400 text-[11px] font-bold tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" /> SENDER — PATRICIO
              </p>
              {([
                { label: "Card Holder Name", k: "senderName" as const, ph: "PATRICIO" },
                { label: "Card Number",      k: "senderCard" as const, ph: "•••• •••• •••• ••••" },
                { label: "Issuing Bank",     k: "senderBank" as const, ph: "BANAMEX / HSBC" },
                { label: "Expiration Date",  k: "senderExpiry" as const, ph: "MM/YY" },
              ] as const).map(({ label, k, ph }) => (
                <div key={k}>
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                  <input value={form[k] as string} onChange={e => upd(k, e.target.value)} placeholder={ph}
                    className="w-full bg-amber-950/30 border border-amber-800/50 rounded px-2 py-1.5 text-xs text-amber-200 font-mono placeholder-amber-900/50 outline-none focus:border-amber-400" />
                </div>
              ))}
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Card Type</p>
                <select value={form.senderCardType} onChange={e => upd("senderCardType", e.target.value)}
                  className="w-full bg-amber-950/30 border border-amber-800/50 rounded px-2 py-1.5 text-xs text-amber-200 font-mono outline-none focus:border-amber-400">
                  {SR_CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Country (ISO)</p>
                <select value={form.senderCountryIdx} onChange={e => upd("senderCountryIdx", +e.target.value)}
                  className="w-full bg-amber-950/30 border border-amber-800/50 rounded px-2 py-1.5 text-xs text-amber-200 font-mono outline-none focus:border-amber-400">
                  {ISO_COUNTRIES.map((c, i) => <option key={i} value={i}>{c.a1} · {c.a2} / {c.num}</option>)}
                </select>
              </div>
            </div>

            {/* RECEIVER */}
            <div className="rounded-lg border border-blue-700/50 bg-blue-950/10 p-4 space-y-3">
              <p className="text-blue-300 text-[11px] font-bold tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" /> RECEIVER — USTED
              </p>
              {([
                { label: "Card Holder Name", k: "receiverName" as const, ph: "NOMBRE COMPLETO" },
                { label: "Card Number",      k: "receiverCard" as const, ph: "•••• •••• •••• ••••" },
                { label: "Issuing Bank",     k: "receiverBank" as const, ph: "REVOLUT / HSBC" },
                { label: "Expiration Date",  k: "receiverExpiry" as const, ph: "MM/YY" },
              ] as const).map(({ label, k, ph }) => (
                <div key={k}>
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                  <input value={form[k] as string} onChange={e => upd(k, e.target.value)} placeholder={ph}
                    className="w-full bg-blue-950/30 border border-blue-800/50 rounded px-2 py-1.5 text-xs text-blue-200 font-mono placeholder-blue-900/50 outline-none focus:border-blue-400" />
                </div>
              ))}
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Card Type</p>
                <select value={form.receiverCardType} onChange={e => upd("receiverCardType", e.target.value)}
                  className="w-full bg-blue-950/30 border border-blue-800/50 rounded px-2 py-1.5 text-xs text-blue-200 font-mono outline-none focus:border-blue-400">
                  {SR_CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Country (ISO)</p>
                <select value={form.receiverCountryIdx} onChange={e => upd("receiverCountryIdx", +e.target.value)}
                  className="w-full bg-blue-950/30 border border-blue-800/50 rounded px-2 py-1.5 text-xs text-blue-200 font-mono outline-none focus:border-blue-400">
                  {ISO_COUNTRIES.map((c, i) => <option key={i} value={i}>{c.a1} · {c.a2} / {c.num}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { label: "Total Amount",     k: "totalAmount" as const,    ph: "100,000,000.00" },
              { label: "Amount Rendered",  k: "renderedAmount" as const, ph: "10,000.00" },
            ] as const).map(({ label, k, ph }) => (
              <div key={k}>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <input value={form[k] as string} onChange={e => upd(k, e.target.value)} placeholder={ph}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 font-mono outline-none focus:border-blue-500" />
              </div>
            ))}
            <div>
              <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Currency</p>
              <select value={form.currency} onChange={e => upd("currency", e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 font-mono outline-none focus:border-blue-500">
                {SR_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Protocol</p>
              <select value={form.protocol} onChange={e => upd("protocol", e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 font-mono outline-none focus:border-blue-500">
                {["101","201","301","401"].map(p => <option key={p} value={p}>PROTOCOL {p}</option>)}
              </select>
            </div>
          </div>

          <div className="px-4 pb-5 space-y-2">
            <button onClick={handleVincular}
              disabled={!form.receiverName.trim() || !form.receiverCard.trim() || !form.senderCard.trim()}
              className="w-full py-3 rounded-lg font-mono font-bold text-sm tracking-widest bg-[#0038A8] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all">
              INICIAR VINCULACION — MASTERCARD NETWORK
            </button>
            <p className="text-center text-[9px] text-gray-700 font-mono tracking-widest">
              CONNECTING TO SYSTEM · VERIFICATION ACCESS INFO · CONFIRMATION IDENTITY
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (srStep === "processing") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black p-6 overflow-y-auto">
        <div className="w-full max-w-xl" style={{ fontFamily: "monospace" }}>
          <p className="text-green-400 text-[10px] mb-5 leading-relaxed">
            GENERATED BY BANXICO PLUS SERVER ACCOUNT-GIT MASTERCARD @ {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC
          </p>
          <div className="flex justify-center mb-3">
            <div className="relative w-12 h-8">
              <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-[#EB001B] opacity-90" />
              <div className="absolute right-0 top-0 w-8 h-8 rounded-full bg-[#F79E1B] opacity-80" />
            </div>
          </div>
          <p className="text-blue-400 text-[10px] text-center tracking-widest mb-4">
            ........CARD INFORMATION VERIFIED BY MASTERCARD........
          </p>
          <div className="space-y-0.5 text-[10px] mb-4">
            <div className="flex gap-2">
              <span className="text-gray-500">SENDER/CARD HOLDER NAME:</span>
              <span className="text-amber-300 font-bold">{form.senderName.toUpperCase()}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">RECEIVER/CARD HOLDER NAME:</span>
              <span className="text-blue-300 font-bold">{form.receiverName.toUpperCase()}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">RECEIVER/CARD NUMBER:</span>
              <span className="text-blue-300 font-bold">{form.receiverCard}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">RECEIVER/TOTAL AMOUNT:</span>
              <span className="text-blue-300 font-bold">{fmtAmt(form.totalAmount)} #{form.currency}#</span>
            </div>
          </div>
          <div className="border-t border-gray-800 my-3" />
          <p className="text-gray-500 text-[10px] text-center tracking-widest mb-3">
            ----------ACTIVATING TRANSACTION----------
          </p>
          <div className="space-y-1">
            {SR_STEPS.slice(0, visibleStep).map((s, i) => {
              const val = s.result === "" ? (apiResult?.approvalCode ?? "...") : s.result;
              const dots = ".".repeat(Math.max(2, 52 - s.label.length - val.length));
              return (
                <div key={i} className="flex text-[10px]">
                  <span className="text-gray-400 whitespace-nowrap">{s.label}</span>
                  <span className="text-gray-700 flex-1 overflow-hidden tracking-tighter">{dots}</span>
                  <span className={`${s.col} font-bold ml-1 whitespace-nowrap`}>{val}</span>
                </div>
              );
            })}
            {visibleStep < SR_STEPS.length && (
              <span className="text-green-400 animate-pulse text-xs">_</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const r = apiResult;
  if (!r) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 overflow-y-auto">
      <div className="w-full max-w-sm my-4 rounded-xl overflow-hidden shadow-2xl border border-gray-700" style={{ background: "#000" }}>
        <div className="text-center pt-5 pb-1">
          <p className="text-blue-400 text-[11px] font-bold tracking-[0.3em] font-mono">DATA VERIFIED</p>
          <MCLogo />
        </div>

        <div className="px-4 pb-4 space-y-2.5" style={{ fontFamily: "monospace" }}>
          {/* Sender + Receiver summary */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-gray-600 text-[9px] uppercase tracking-wide text-center mb-1">Sender</p>
              <div className="bg-amber-950/50 border border-amber-800/40 rounded px-2 py-1.5 text-center">
                <p className="text-amber-300 text-[10px] font-bold truncate">{r.sender.name}</p>
                <p className="text-amber-500 text-[9px]">{r.sender.card}</p>
                <p className="text-amber-600 text-[9px]">{r.sender.bank}</p>
              </div>
            </div>
            <div>
              <p className="text-gray-600 text-[9px] uppercase tracking-wide text-center mb-1">Receiver</p>
              <div className="bg-[#0038A8] rounded px-2 py-1.5 text-center">
                <p className="text-white text-[10px] font-bold truncate">{r.receiver.name}</p>
                <p className="text-blue-200 text-[9px]">{r.receiver.card}</p>
                <p className="text-blue-300 text-[9px]">{r.receiver.bank}</p>
              </div>
            </div>
          </div>

          {/* Receiver fields in blue boxes */}
          {[
            { label: "Receiver/Card Number:",     value: r.receiver.card },
            { label: "Receiver/Expiration Date:", value: form.receiverExpiry || "—" },
            { label: "Receiver/Amount:",          value: `${fmtAmt(r.totalAmount)}.00 ${r.currency}` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-white text-[10px] mb-1">{label}</p>
              <div className="bg-[#0038A8] rounded px-3 py-1.5">
                <p className="text-white text-[10px] font-bold tracking-wider">{value}</p>
              </div>
            </div>
          ))}

          <SRBarcode />
          <div className="border-t border-dashed border-gray-800" />

          <p className="text-center text-[9px] text-gray-600 tracking-widest">----------ACTIVATING TRANSACTION----------</p>
          <div className="space-y-0.5">
            {[
              { label: "Redirecting  to  Network",  value: "OK",                             col: "text-green-400" },
              { label: "Connecting to Database",     value: "CONNECTED",                      col: "text-green-400" },
              { label: "Account Verification",       value: "OK",                             col: "text-green-400" },
              { label: "Approval Code",              value: "LINKED",                         col: "text-green-400" },
              { label: "Account Type",               value: "ONLINE SALE",                    col: "text-white" },
              { label: "Transaction Status",         value: "ACTIVE",                         col: "text-green-400" },
              { label: "Authorization Codes",        value: r.authCodes,                      col: "text-amber-300" },
              { label: "Amount Rendered",            value: `${r.currency} ${fmtAmt(r.renderedAmount)}`, col: "text-white" },
              { label: "Source Code",                value: `PROTOCOL ${r.protocol}`,         col: "text-white" },
            ].map(({ label, value, col }, i) => (
              <DotRow key={i} label={label} value={value} col={col} />
            ))}
          </div>

          <div className="border-t border-dashed border-gray-800" />
          <p className="text-center text-[9px] text-gray-600 tracking-widest">----------TRANSACTION INDEX----------</p>
          <p className="text-center text-[9px] text-blue-400 tracking-widest">DATA VERIFIED  BY  MASTERCARD</p>
          <div className="space-y-0.5">
            <DotRow label="Linked Code Number"               value={r.linkedCode}      col="text-amber-300" />
            <DotRow label={`Card Number Xxxxxxxxxxxx${rLast4}`} value="LINKED"          col="text-green-400" />
            <DotRow label="Approved Amount"                  value="CONNECTED"          col="text-green-400" />
          </div>
          <SRBarcode />

          <div className="rounded-lg border border-green-500/40 bg-green-950/30 py-3 text-center">
            <p className="text-green-400 text-[9px] tracking-widest font-mono">AUTHORIZATION STATUS:</p>
            <p className="text-green-300 font-bold text-xs font-mono mt-0.5">SUCCESSFULLY REDEEMED</p>
            <p className="text-amber-300 text-3xl font-bold font-mono mt-1 tracking-widest">{r.linkedCode}</p>
            <p className="text-gray-600 text-[9px] mt-1 font-mono">{r.transactionId}</p>
          </div>
        </div>

        <div className="px-4 pb-5">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-[#0038A8] text-white font-mono font-bold text-xs tracking-widest">
            Cerrar Reporte
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
type Step = "amount" | "card" | "processing" | "approved" | "declined" | "checking_host";

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

  const [viewMode, setViewMode] = useState<"terminal" | "engine">("terminal");
  const [step, setStep] = useState<Step>("amount");
  const [amountDigits, setAmountDigits] = useState("");
  const [cardType, setCardType] = useState("Mastercard Internacional");
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [protocol, setProtocol] = useState("201.2");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [now, setNow] = useState(new Date());
  const [lote, setLote] = useState(2);
  const [oper, setOper] = useState(28);

  const [declineReason, setDeclineReason] = useState("");
  const [declineCode, setDeclineCode] = useState("");
  const [ventaForzada, setVentaForzada] = useState(false);
  const [trackData, setTrackData] = useState("");
  const [bankRef, setBankRef] = useState("");

  const [showFunciones, setShowFunciones] = useState(false);
  const [showReporteParams, setShowReporteParams] = useState(false);
  const [showVisaNet, setShowVisaNet] = useState(false);
  const [visaNetData, setVisaNetData] = useState<VisaNetData | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; content: string } | null>(null);
  const [showSRLink, setShowSRLink] = useState(false);

  const { data: myTerminals } = useQuery<{ status: string }[]>({
    queryKey: ["/api/terminals/mine"],
    enabled: !!user && user.role !== "ADMIN",
  });
  const canSRLink = user?.role === "ADMIN" || (myTerminals ?? []).some(t => t.status === "active");

  const { data: subData } = useQuery<{ posLocked: boolean; restricted?: boolean; paymentWarning?: string }>({
    queryKey: ["/api/subscription"],
    enabled: !!user && user.role !== "ADMIN",
  });
  const posLocked = !!(subData?.posLocked);
  const paymentWarning = subData?.paymentWarning;
  const [showSubAlert, setShowSubAlert] = useState(true);

  const { data: userPerms } = useQuery<{ paymentEngineAccess: boolean; posFullAccess: boolean }>({
    queryKey: ["/api/user/permissions"],
    enabled: !!user,
  });
  const posFullAccess = user?.role === "ADMIN" ? true : !!(userPerms?.posFullAccess);
  // Reset alert every time the page mounts so Patricio sees it on every visit
  useEffect(() => { setShowSubAlert(true); }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Obtener clave pública de Mercado Pago ─────────────────────────────────
  const mpPubKey = useRef<string | null>(null);
  useEffect(() => {
    fetch("/api/mp/public-key")
      .then(r => r.json())
      .then(({ publicKey }: { publicKey: string | null }) => {
        mpPubKey.current = publicKey;
      })
      .catch(() => {});
  }, []);

  // ── Modo Stripe (live / test) ──────────────────────────────────────────────
  const { data: stripeConfig } = useQuery<{ mode: "live" | "test" | "unknown"; live: boolean }>({
    queryKey: ["/api/stripe/config"],
  });
  const stripeIsLive = stripeConfig?.mode === "live";

  const processMutation = useMutation({
    mutationFn: async () => {
      const amount = parseInt(amountDigits, 10) / 100;
      if (amount <= 0) throw new Error("Monto inválido");

      // ── Tokenizar tarjeta client-side vía fetch directo a MP (PCI compliant) ─
      let mpCardToken: string | undefined;
      const pubKey = mpPubKey.current;
      if (pubKey) {
        try {
          const [expMM = "12", expYY = "27"] = expiryDate.trim().split("/");
          const tokenRes = await fetch(
            `https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(pubKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                card_number: cardNumber.replace(/\s/g, ""),
                expiration_year: 2000 + parseInt(expYY, 10),
                expiration_month: parseInt(expMM, 10),
                security_code: cvv.trim(),
                cardholder: {
                  name: holderName.trim(),
                  identification: { type: "RFC", number: "XAXX010101000" },
                },
              }),
            }
          );
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            if (tokenData?.id) mpCardToken = tokenData.id as string;
          }
        } catch (_tokenErr) {
          // Si falla la tokenización, continúa sin token (flujo alternativo)
        }
      }

      const res = await apiRequest("POST", "/api/pos/process-payment", {
        cardType, cardNumber: cardNumber.replace(/\s/g, ""),
        amount, protocol, holderName: holderName.trim(),
        expiryDate: expiryDate.trim(), cvv: cvv.trim(),
        ventaForzada, ...(mpCardToken ? { mpCardToken } : {}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Attach declineCode as a property on the Error so onError can read it
        const err = new Error(body.error || "Error al procesar") as Error & { declineCode?: string };
        err.declineCode = body.declineCode ?? body.stripeStatus ?? "";
        throw err;
      }
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
    onError: (err: Error & { declineCode?: string }) => {
      if (err.declineCode === "HOST_MAINTENANCE") {
        setStep("checking_host");
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        return;
      }
      setDeclineReason(err.message);
      setDeclineCode(err.declineCode ?? "");
      setStep("declined");
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
    const rawCard = cardNumber.replace(/\s/g, "");
    if (rawCard.length < 13) {
      toast({ title: "Número de tarjeta requerido", description: "Ingresa un número de tarjeta válido.", variant: "destructive" });
      return;
    }
    if (!holderName.trim()) {
      toast({ title: "Nombre del titular requerido", description: "Ingresa el nombre del titular de la tarjeta.", variant: "destructive" });
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiryDate.trim())) {
      toast({ title: "Fecha de vencimiento requerida", description: "Ingresa la fecha en formato MM/AA.", variant: "destructive" });
      return;
    }
    if (cvv.length < 3) {
      toast({ title: "CVV requerido", description: "Ingresa el código de seguridad de 3 o 4 dígitos.", variant: "destructive" });
      return;
    }
    setStep("processing");
    processMutation.mutate();
  }

  function handleNewTransaction() {
    setStep("amount"); setAmountDigits(""); setCardType("Mastercard Internacional");
    setCardNumber(""); setHolderName(""); setExpiryDate(""); setCvv(""); setProtocol("201.2");
    setResult(null); setVisaNetData(null); setVentaForzada(false); setTrackData(""); setBankRef("");
    setDeclineReason("");
    setDeclineCode("");
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
  const currentProtocol = PROTOCOLS.find(p => p.code === protocol);

  const numpadKeys = [["1","2","3"],["4","5","6"],["7","8","9"],["C","0","DEL"]];

  return (
    <div className="p-4 md:p-6 space-y-5 pb-24">
      {/* Modals */}
      {showFunciones && <FuncionesModal onClose={() => setShowFunciones(false)} onSelect={handleFuncionSelect} />}
      {showReporteParams && <ReporteParametrosModal params={terminalParamsForReport} onClose={() => setShowReporteParams(false)} />}
      {showVisaNet && visaNetData && <VisaNetworkReceiptModal data={visaNetData} onClose={() => setShowVisaNet(false)} />}
      {infoModal && <InfoModal title={infoModal.title} content={infoModal.content} onClose={() => setInfoModal(null)} />}
      {showSRLink && <SRLinkModal onClose={() => setShowSRLink(false)} />}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MonitorSmartphone className="w-7 h-7 text-[#c8322b]" /> POS Virtual
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Terminal · EMV / PCI DSS · Visa Net 9.0 Quantum</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button onClick={() => setViewMode("terminal")} data-testid="button-mode-terminal"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "terminal" ? "bg-[#c8322b] text-white" : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}>
              <MonitorSmartphone className="w-3.5 h-3.5" /> Terminal
            </button>
            <button onClick={() => setViewMode("engine")} data-testid="button-mode-engine"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "engine" ? "bg-[#c8322b] text-white" : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}>
              <Zap className="w-3.5 h-3.5" /> Motor de Pagos
            </button>
          </div>
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
          {canSRLink && (
            <button onClick={() => setShowSRLink(true)} data-testid="button-sr-link"
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border border-blue-700 text-blue-700 bg-blue-50 transition-all">
              <Link2 className="w-3.5 h-3.5" /> VINCULAR S/R
            </button>
          )}
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

      {viewMode === "engine" ? (
        <PaymentEnginePanel />
      ) : (
      <>
      {/* ── Acceso no autorizado al POS Virtual ── */}
      {!posLocked && !posFullAccess && userPerms !== undefined && user?.role !== "ADMIN" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-6 py-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-amber-900 text-lg">Acceso no autorizado</h3>
            <p className="text-sm text-amber-700 mt-1 max-w-sm mx-auto">
              Tu cuenta no tiene acceso al POS Virtual. Contacta al administrador del sistema para que active tu acceso al terminal.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 bg-amber-100 border border-amber-200 rounded-md px-4 py-2 text-xs font-mono text-amber-800">
            <ShieldCheck className="w-3.5 h-3.5" />
            ERR_POS_PERM_001 — Permiso no otorgado
          </div>
        </div>
      )}

      {/* ── Aviso de suscripción pendiente (solo cuando posLocked) ── */}
      {posLocked && showSubAlert && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-md bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <TriangleAlert className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-red-800 text-sm">
                  {user?.fullName} — Membresía con saldo pendiente
                </p>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                  Tu membresía tiene un saldo pendiente de liquidación. El POS Virtual está disponible para captura de datos, pero el procesamiento real de transacciones permanece <strong>suspendido</strong> hasta regularizar el contrato.
                </p>
                {paymentWarning && (
                  <p className="text-[10px] text-red-800 font-mono mt-2 bg-red-100 rounded px-2 py-1.5 border border-red-200 leading-relaxed">
                    {paymentWarning}
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => setShowSubAlert(false)} className="text-red-400 hover:text-red-700 transition-colors flex-shrink-0">
              <XCircle className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-red-600">
              Regulariza tu membresía para reactivar el procesamiento completo de pagos.
            </p>
            <Button size="sm" variant="outline"
              className="text-xs border-red-400 text-red-700 flex-shrink-0 ml-3"
              onClick={() => window.location.href = "/subscription"}>
              Ver membresía
            </Button>
          </div>
        </div>
      )}

      {/* Protocol info badge — shown for all protocols */}
      {currentProtocol && (
        <Card className={
          is101    ? "border-blue-300 bg-blue-50/60"
          : is1643 ? "border-amber-300 bg-amber-50/60"
          : protocol === "101.6" ? "border-purple-300 bg-purple-50/60"
          : "border-[#c8322b]/20 bg-red-50/40"
        }>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                is101    ? "bg-blue-100"
                : is1643 ? "bg-amber-100"
                : protocol === "101.6" ? "bg-purple-100"
                : "bg-[#c8322b]/10"
              }`}>
                {is101 ? (
                  <span className="text-lg font-extrabold italic text-[#1A1F71]"
                    style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>V</span>
                ) : is1643 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                ) : protocol === "101.6" ? (
                  <Clock className="w-4 h-4 text-purple-600" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-[#c8322b]" />
                )}
              </div>
              <div>
                <p className={`font-semibold text-sm ${
                  is101    ? "text-blue-900"
                  : is1643 ? "text-amber-900"
                  : protocol === "101.6" ? "text-purple-900"
                  : "text-gray-800"
                }`}>
                  Protocol {currentProtocol.code} — {currentProtocol.label.split("—")[1]?.trim()}
                </p>
                <p className={`text-xs mt-0.5 ${
                  is101    ? "text-blue-700"
                  : is1643 ? "text-amber-700"
                  : protocol === "101.6" ? "text-purple-700"
                  : "text-muted-foreground"
                }`}>
                  {currentProtocol.desc}
                  {is101 && " · Generates Visa Net report / Genera reporte Visa Net"}
                  {is1643 && " · EMV offline only / Solo EMV sin conexión"}
                </p>
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
                  <div className="flex items-center gap-1.5">
                    {stripeConfig && (
                      <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded tracking-widest border ${
                        stripeIsLive
                          ? "text-green-300 border-green-700 bg-green-900/50"
                          : "text-yellow-300 border-yellow-700 bg-yellow-900/40"
                      }`} data-testid="badge-stripe-mode">
                        {stripeIsLive ? "● LIVE" : "● TEST"}
                      </span>
                    )}
                    <span className="text-gray-500 text-xs font-mono">
                      {now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                </div>

                {step === "amount" && (
                  <div className="text-center flex-1 flex flex-col justify-center">
                    <p className="text-gray-500 text-xs mb-1 uppercase tracking-widest">Amount / Monto a cobrar</p>
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
                    <p className={`text-xs mt-1 animate-pulse ${isVF ? "text-amber-400" : "text-[#c8322b]"}`}>Enter card data / Ingresa datos de tarjeta</p>
                    <div className="flex items-center justify-center gap-3 mt-1 text-[10px] text-gray-500 font-mono">
                      <span>OPER: {oper}</span><span>LOTE: {lote}</span>
                    </div>
                  </div>
                )}

                {step === "processing" && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-2">
                    <Loader2 className={`w-8 h-8 animate-spin ${isVF ? "text-amber-400" : is101 ? "text-blue-400" : "text-[#c8322b]"}`} />
                    <p className="text-white text-sm font-bold">{is1643 ? "Processing manual terminal... / Procesando terminal manual..." : is101 ? "Connecting Visa Network... / Conectando Visa Network..." : "Processing... / Procesando..."}</p>
                    <p className="text-gray-500 text-xs">{is1643 ? "EMV offline" : is101 ? "USD Network — HSBC / Red USD — HSBC" : "Issuer Bank / Banco emisor"}</p>
                  </div>
                )}

                {step === "declined" && declineCode === "APPROVED_BANXICO_REJECTED_HOST" && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-1.5 px-2">
                    <div className="w-9 h-9 rounded-full bg-indigo-900/60 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    </div>
                    <p className="text-indigo-300 text-[10px] font-bold tracking-widest">APPROVED BY BANXICO</p>
                    <p className="text-red-400 text-[10px] font-bold tracking-widest">REJECTED FROM HOST ORIGIN</p>
                    <p className="text-[9px] font-mono px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300 uppercase tracking-wide">
                      APPROVED_BANXICO_REJECTED_HOST
                    </p>
                    <p className="text-gray-600 text-[9px] mt-1 font-mono">
                      ****{(cardNumber.replace(/\s/g,"") || "0000").slice(-4)} · {cardType}
                    </p>
                  </div>
                )}

                {step === "declined" && declineCode !== "APPROVED_BANXICO_REJECTED_HOST" && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-1.5 px-2">
                    <XCircle className="w-9 h-9 text-red-500" />
                    <p className="text-red-400 text-sm font-bold tracking-widest">DECLINED / DECLINADA</p>
                    {declineCode && (
                      <p className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-red-900/60 text-red-300 uppercase">
                        {declineCode.replace(/_/g, " ")}
                      </p>
                    )}
                    <p className="text-gray-300 text-[10px] font-mono text-center leading-relaxed mt-0.5 break-words px-1">
                      {declineReason || "Card not authorized / Tarjeta no autorizada"}
                    </p>
                    <p className="text-gray-600 text-[9px] mt-1 font-mono">
                      ****{(cardNumber.replace(/\s/g,"") || "0000").slice(-4)} · {cardType}
                    </p>
                  </div>
                )}

                {step === "approved" && !posLocked && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-1">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                    <p className="text-green-400 text-sm font-bold">APPROVED / APROBADO</p>
                    <p className="text-gray-400 text-xs font-mono">{result?.authCode}</p>

                    {isVF && <p className="text-amber-400 text-[10px] font-semibold">VENTA FORZADA</p>}
                    {is101 && <p className="text-blue-300 text-[10px] font-semibold">VISA NETWORK</p>}
                  </div>
                )}
                {step === "approved" && posLocked && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-1 px-2">
                    <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <Router className="w-5 h-5 text-amber-400" />
                    </div>
                    <p className="text-amber-400 text-xs font-bold tracking-widest mt-0.5">DIGITALIZADO</p>
                    <p className="text-gray-400 text-[10px] font-mono">{result?.authCode}</p>
                    <p className="text-amber-600 text-[9px] font-semibold tracking-wide mt-0.5">SIN ENRUTAMIENTO ACTIVO</p>
                    <p className="text-gray-500 text-[9px] leading-tight mt-1">Registro capturado.<br/>Procesamiento suspendido.</p>
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
                    <CheckCircle className="w-5 h-5 mr-2" /> Confirm / Confirmar
                  </Button>
                </div>
              )}

              {step === "approved" && (
                <Button className="w-full h-12 bg-gray-700 text-white rounded-lg font-bold"
                  onClick={handleNewTransaction} data-testid="button-new-transaction-keypad">
                  <RefreshCw className="w-4 h-4 mr-2" /> New Transaction / Nueva Transacción
                </Button>
              )}

              {step === "declined" && (
                <div className="flex flex-col gap-2">
                  <Button className="w-full h-12 bg-red-800 text-white rounded-lg font-bold"
                    onClick={() => setStep("card")} data-testid="button-retry-card">
                    <CreditCard className="w-4 h-4 mr-2" /> Retry / Reintentar
                  </Button>
                  <Button className="w-full h-10 bg-gray-700 text-white rounded-lg font-bold"
                    onClick={handleNewTransaction} data-testid="button-new-transaction-declined">
                    <RefreshCw className="w-4 h-4 mr-2" /> New Transaction / Nueva Transacción
                  </Button>
                </div>
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
                  <CreditCard className="w-4 h-4 text-[#c8322b]" /> Card Data / Datos de Tarjeta
                  {is101 && <Badge className="bg-blue-100 text-blue-700 border-blue-200 no-default-active-elevate text-xs">Visa Net</Badge>}
                  {is1643 && <Badge className="bg-amber-100 text-amber-700 border-amber-200 no-default-active-elevate text-xs"><Zap className="w-3 h-3 mr-1" /> Manual</Badge>}
                </CardTitle>
                <CardDescription>
                  ${formatAmountDigits(amountDigits)} USD · ≈ ${amountMXNDisplay} MXN · OPER {oper} / LOTE {lote}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Card Type / Tipo de Tarjeta</Label>
                  <Select value={cardType} onValueChange={setCardType} disabled={step === "processing"}>
                    <SelectTrigger data-testid="select-card-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{CARD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Card Number / Número de Tarjeta <span className="text-red-500">*</span></Label>
                  <Input placeholder="•••• •••• •••• ••••" value={cardNumber}
                    onChange={e => setCardNumber(formatCard(e.target.value))} maxLength={19}
                    disabled={step === "processing"} className="font-mono tracking-widest" data-testid="input-card-number" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Cardholder / Titular <span className="text-red-500">*</span></Label>
                    <Input placeholder="NOMBRE APELLIDO" value={holderName}
                      onChange={e => setHolderName(e.target.value.toUpperCase())}
                      disabled={step === "processing"} data-testid="input-holder-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Expiry / Vencimiento <span className="text-red-500">*</span></Label>
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
                  <Label>CVV / CVC <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="•••"
                    value={cvv}
                    onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    type="password"
                    disabled={step === "processing"}
                    className="font-mono tracking-widest"
                    data-testid="input-cvv"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Operation Protocol / Protocolo de operación</Label>
                  <Select value={protocol} onValueChange={setProtocol} disabled={step === "processing"}>
                    <SelectTrigger data-testid="select-protocol"><SelectValue /></SelectTrigger>
                    <SelectContent>{PROTOCOLS.map(p => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {currentProtocol && (
                    <p className="text-[10px] text-muted-foreground pl-0.5">{currentProtocol.desc}</p>
                  )}
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
                    disabled={
                      step === "processing" ||
                      processMutation.isPending ||
                      cardNumber.replace(/\s/g, "").length < 13 ||
                      !holderName.trim() ||
                      !/^\d{2}\/\d{2}$/.test(expiryDate.trim()) ||
                      cvv.length < 3
                    }
                    data-testid="button-process-payment">
                    {processMutation.isPending
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing... / Procesando...</>
                      : <><Zap className="w-4 h-4 mr-2" /> Process / Procesar ${formatAmountDigits(amountDigits)} USD</>}
                  </Button>
                  <Button variant="outline" onClick={() => setStep("amount")} disabled={step === "processing"}>
                    <X className="w-4 h-4 mr-2" /> Cancel / Cancelar
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
                        {is101 ? "Visa Network Approved / Aprobado" : is1643 ? "Forced Sale Approved / Venta Forzada Aprobada" : isVF ? "Forced Sale Approved / Venta Forzada Aprobada" : "Payment Approved / Pago Aprobado"}
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
                    <p className="text-blue-200 text-xs">Laredo, Texas · Evolution Suite 1401</p>
                  </div>

                  <div className="bg-muted/40 p-4 space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between border-b border-dashed border-border pb-2 mb-2">
                      <span className="text-muted-foreground">
                        {new Date().toLocaleDateString("es-MX")} {now.toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
                      </span>
                      <span className="text-muted-foreground">****{(cardNumber.replace(/\s/g,"") || "7209").slice(-4)}</span>
                    </div>
                    {[
                      { l: "CARD / TARJETA",         v: cardType },
                      { l: "HOLDER / TITULAR",        v: holderName || "TITULAR" },
                      { l: "PROTOCOL / PROTOCOLO",    v: protocol },
                      { l: "OPER / LOTE",             v: `${oper-1} / ${lote-1}` },
                      { l: "AMOUNT USD / IMPORTE USD",v: `$${formatAmountDigits(amountDigits)}` },
                      { l: "EQUIV MXN",               v: `$${amountMXNDisplay}` },
                      { l: "RATE / TC",               v: `${TC_MXN} MXN/USD` },
                      { l: "APPROVAL / APROBACIÓN",   v: result.authCode },
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
                    <span className="text-blue-200 text-[10px] font-mono">Verifone V660P</span>
                    <div className="flex items-center gap-2 text-[10px] text-blue-200 font-mono">
                      <ShieldCheck className="w-3 h-3" /> EMV
                      <Lock className="w-3 h-3" /> PCI DSS
                    </div>
                  </div>
                </div>

                <Button
                  className={`w-full mt-4 text-white ${is101 ? "bg-[#1565C0]" : isVF ? "bg-amber-500" : "bg-[#c8322b]"}`}
                  onClick={handleNewTransaction} data-testid="button-new-transaction">
                  <RefreshCw className="w-4 h-4 mr-2" /> New Transaction / Nueva Transacción
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Bank Host Maintenance panel */}
          {step === "checking_host" && (
            <Card className="border-orange-300">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-orange-700 animate-pulse">Checking with Banking Host...</CardTitle>
                    <CardDescription>{new Date().toLocaleString("es-MX")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg overflow-hidden border border-orange-200">
                  <div className="bg-orange-900 text-white p-3 text-center space-y-0.5">
                    <p className="font-bold text-base tracking-widest font-mono">BANXICO PLUS</p>
                    <p className="text-orange-200 text-xs">VENTA FORZADA — TERMINAL MANUAL</p>
                    <p className="text-orange-200 text-xs">Laredo, Texas · Evolution Suite 1401</p>
                  </div>

                  <div className="bg-muted/40 p-4 space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between border-b border-dashed border-border pb-2 mb-2">
                      <span className="text-muted-foreground">
                        {new Date().toLocaleDateString("es-MX")} {now.toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
                      </span>
                      <span className="text-muted-foreground">****{(cardNumber.replace(/\s/g,"") || "0000").slice(-4)}</span>
                    </div>
                    {[
                      { l: "CARD / TARJETA",          v: cardType },
                      { l: "HOLDER / TITULAR",         v: "Banxico LLC" },
                      { l: "PROTOCOL / PROTOCOLO",     v: protocol },
                      { l: "OPER / LOTE",              v: `${oper} / ${lote}` },
                      { l: "AMOUNT USD / IMPORTE USD", v: `$${formatAmountDigits(amountDigits)}` },
                      { l: "EQUIV MXN",                v: `$${amountMXNDisplay}` },
                      { l: "RATE / TC",                v: `${TC_MXN} MXN/USD` },
                      { l: "TERMINAL",                 v: "Verifone V660P" },
                    ].map((r, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-muted-foreground">{r.l}</span>
                        <span className="font-bold text-right">{r.v}</span>
                      </div>
                    ))}

                    <div className="pt-2 mt-1 border-t border-dashed border-border space-y-1.5">
                      <div className="text-center font-bold text-[10px] text-muted-foreground tracking-widest pb-1">
                        COPIA DEL COMERCIO
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">APROBACIÓN</span>
                        <span className="font-bold text-orange-600 animate-pulse text-right tracking-widest">CHECKING HOST...</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">STATUS</span>
                        <span className="font-bold text-orange-500 text-right text-[10px]">PENDING RECONNECT</span>
                      </div>
                      <div className="mt-2 p-2 rounded bg-orange-50 border border-orange-200">
                        <p className="text-orange-800 text-[10px] leading-relaxed font-sans font-bold tracking-wide">
                          BANK HOST MAINTENANCE · GLOBAL SERVER VISA ON MAINTENANCE
                        </p>
                        <p className="text-orange-700 text-[10px] leading-relaxed font-sans mt-1">
                          Transaction queued — pending host reconnection.
                        </p>
                      </div>
                      <div className="text-center pt-1">
                        <p className="text-muted-foreground text-[9px]">FIRMA / SIGNATURE</p>
                        <div className="border-b border-dashed border-border mt-3 mb-1 mx-4" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-900 px-3 py-2 flex items-center justify-between">
                    <span className="text-orange-200 text-[10px] font-mono">Verifone V660P</span>
                    <div className="flex items-center gap-2 text-[10px] text-orange-200 font-mono">
                      <ShieldCheck className="w-3 h-3" /> EMV
                      <Lock className="w-3 h-3" /> PCI DSS
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full mt-4 bg-orange-600 text-white"
                  onClick={handleNewTransaction} data-testid="button-new-transaction-host">
                  <RefreshCw className="w-4 h-4 mr-2" /> New Transaction / Nueva Transacción
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Declined detail panel */}
          {step === "declined" && declineCode === "APPROVED_BANXICO_REJECTED_HOST" && (
            <Card className="border-indigo-300">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-indigo-700">Approved by Banxico · Rejected from Host Origin</CardTitle>
                    <CardDescription>{new Date().toLocaleString("es-MX")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg overflow-hidden border border-indigo-200">

                  {/* Ticket header — split color */}
                  <div className="bg-indigo-900 text-white p-3 text-center space-y-0.5">
                    <p className="font-bold text-base tracking-widest font-mono">BANXICO PLUS</p>
                    <p className="text-indigo-200 text-xs tracking-widest font-mono">APROBADO BANXICO / RECHAZADO HOST</p>
                    <p className="text-indigo-300 text-xs">Laredo, Texas · Evolution Suite 1401</p>
                  </div>

                  {/* Body */}
                  <div className="bg-muted/40 p-4 space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between border-b border-dashed border-border pb-2 mb-2">
                      <span className="text-muted-foreground">{new Date().toLocaleString("es-MX")}</span>
                      <span className="text-muted-foreground">****{(cardNumber.replace(/\s/g,"") || "1022").slice(-4)}</span>
                    </div>

                    {[
                      { l: "CARD / TARJETA",          v: cardType },
                      { l: "BANK / BANCO",             v: "AEC MEXICO SA DE CV" },
                      { l: "HOLDER / TITULAR",         v: holderName || "AEC MEXICO" },
                      { l: "PROTOCOL / PROTOCOLO",     v: protocol },
                      { l: "AMOUNT USD / IMPORTE USD", v: `$${formatAmountDigits(amountDigits)}` },
                    ].map((r, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-muted-foreground">{r.l}</span>
                        <span className="font-bold text-right">{r.v}</span>
                      </div>
                    ))}

                    {/* Split status block */}
                    <div className="pt-2 mt-1 border-t border-dashed border-border space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">BANXICO STATUS</span>
                        <span className="font-bold text-green-600 text-right">APPROVED</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">HOST ORIGIN</span>
                        <span className="font-bold text-red-600 text-right">REJECTED</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">CODE</span>
                        <span className="font-bold text-indigo-600 text-right text-[10px]">APPROVED_BANXICO_REJECTED_HOST</span>
                      </div>

                      {/* Dual-tone info box */}
                      <div className="mt-2 rounded overflow-hidden border border-indigo-200">
                        <div className="flex">
                          <div className="flex-1 bg-green-50 px-2 py-1.5 text-center border-r border-indigo-200">
                            <p className="text-green-700 text-[9px] font-bold uppercase tracking-wider">Banxico</p>
                            <p className="text-green-800 text-[9px] font-mono font-semibold">APROBADO</p>
                          </div>
                          <div className="flex-1 bg-red-50 px-2 py-1.5 text-center">
                            <p className="text-red-700 text-[9px] font-bold uppercase tracking-wider">Host Origin</p>
                            <p className="text-red-800 text-[9px] font-mono font-semibold">RECHAZADO</p>
                          </div>
                        </div>
                        <div className="bg-indigo-50 px-3 py-1.5 border-t border-indigo-200">
                          <p className="text-indigo-700 text-[9px] leading-relaxed font-sans">
                            {declineReason || "Transaction approved at issuer level (Banxico gateway) but rejected by the acquiring host network."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="bg-indigo-900 px-3 py-2 flex items-center justify-between">
                    <span className="text-indigo-200 text-[10px] font-mono">Verifone V660P</span>
                    <div className="flex items-center gap-2 text-[10px] text-indigo-200 font-mono">
                      <ShieldCheck className="w-3 h-3" /> EMV
                      <Lock className="w-3 h-3" /> PCI DSS
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-4">
                  <Button className="w-full" variant="outline"
                    onClick={handleNewTransaction} data-testid="button-new-transaction-declined-panel">
                    <RefreshCw className="w-4 h-4 mr-2" /> New Transaction / Nueva Transacción
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "declined" && declineCode !== "APPROVED_BANXICO_REJECTED_HOST" && (
            <Card className="border-red-300">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-red-700">Transaction Declined / Transacción Declinada</CardTitle>
                    <CardDescription>{new Date().toLocaleString("es-MX")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg overflow-hidden border border-red-200">
                  <div className="bg-red-900 text-white p-3 text-center space-y-0.5">
                    <p className="font-bold text-base tracking-widest font-mono">BANXICO PLUS</p>
                    <p className="text-red-200 text-xs">TRANSACCIÓN DECLINADA / TRANSACTION DECLINED</p>
                    <p className="text-red-200 text-xs">Laredo, Texas · Evolution Suite 1401</p>
                  </div>

                  <div className="bg-muted/40 p-4 space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between border-b border-dashed border-border pb-2 mb-2">
                      <span className="text-muted-foreground">{new Date().toLocaleString("es-MX")}</span>
                      <span className="text-muted-foreground">****{(cardNumber.replace(/\s/g,"") || "0000").slice(-4)}</span>
                    </div>
                    {[
                      { l: "CARD / TARJETA",          v: cardType },
                      { l: "HOLDER / TITULAR",         v: holderName || "TITULAR" },
                      { l: "PROTOCOL / PROTOCOLO",     v: protocol },
                      { l: "AMOUNT USD / IMPORTE USD", v: `$${formatAmountDigits(amountDigits)}` },
                    ].map((r, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-muted-foreground">{r.l}</span>
                        <span className="font-bold text-right">{r.v}</span>
                      </div>
                    ))}

                    <div className="pt-2 mt-1 border-t border-dashed border-border space-y-1.5">
                      <div className="flex justify-between items-start">
                        <span className="text-muted-foreground">STATUS</span>
                        <span className="font-bold text-red-600 text-right">DECLINED</span>
                      </div>
                      {declineCode && (
                        <div className="flex justify-between items-start">
                          <span className="text-muted-foreground">CODE</span>
                          <span className="font-bold text-red-500 text-right uppercase">
                            {declineCode.replace(/_/g, " ")}
                          </span>
                        </div>
                      )}
                      <div className="mt-2 p-2 rounded bg-red-50 border border-red-200">
                        <p className="text-red-700 text-[10px] leading-relaxed font-sans font-medium">
                          {declineReason || "Card not authorized by issuing bank."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-900 px-3 py-2 flex items-center justify-between">
                    <span className="text-red-200 text-[10px] font-mono">Verifone V660P</span>
                    <div className="flex items-center gap-2 text-[10px] text-red-200 font-mono">
                      <ShieldCheck className="w-3 h-3" /> EMV
                      <Lock className="w-3 h-3" /> PCI DSS
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-4">
                  <Button className="w-full bg-red-700 text-white"
                    onClick={() => setStep("card")} data-testid="button-retry-panel">
                    <CreditCard className="w-4 h-4 mr-2" /> Retry / Reintentar
                  </Button>
                  <Button className="w-full" variant="outline"
                    onClick={handleNewTransaction} data-testid="button-new-transaction-declined-panel">
                    <RefreshCw className="w-4 h-4 mr-2" /> New Transaction / Nueva Transacción
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          {step === "amount" && (
            <Card className="hover-elevate">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#c8322b]" /> Instructions / Instrucciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {[
                    "Enter amount in cents / Ingresa el importe en centavos (e.g. 200000000 = $2,000,000.00 USD)",
                    "Protocol 201.2 / 101.2 for international operations / Protocolo 201.2 / 101.2 para operaciones internacionales",
                    "Protocol 101.1 = Visa Network Transfer (USD blocks) / Transferencia Visa Network (bloques USD)",
                    "Protocol 101.6 = Pre-Authorization hold / Pre-Autorización sin cargo definitivo",
                    "Protocol 1643 = Forced Sale / Venta forzada terminal manual (~$30K USD)",
                    "FUNCTIONS / FUNCIONES → Parameter Report / Reporte Parámetros — terminal config",
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
      </>
      )}

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
