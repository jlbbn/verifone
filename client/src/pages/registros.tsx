import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Transaction } from "@shared/schema";
import {
  Search, Download, Filter, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, RefreshCw, X, Inbox, Loader2,
  WifiOff, Shield, Copy, CheckCheck, Clock, AlertTriangle,
} from "lucide-react";

// ── Verifone V660P SVG Terminal ──────────────────────────────────────────────
function VerifoneV660P({ size = 72 }: { size?: number }) {
  const w = size * 0.62;
  const h = size;
  return (
    <svg width={w} height={h} viewBox="0 0 62 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <rect x="4" y="2" width="54" height="96" rx="7" fill="#1a1a2e" />
      <rect x="6" y="4" width="50" height="92" rx="6" fill="#16213e" />
      {/* Screen bezel */}
      <rect x="9" y="8" width="44" height="36" rx="3" fill="#0f0f23" />
      {/* Screen */}
      <rect x="11" y="10" width="40" height="32" rx="2" fill="#0a1628" />
      {/* Screen content */}
      <rect x="14" y="13" width="34" height="3" rx="1" fill="#1e3a5f" />
      <text x="31" y="28" textAnchor="middle" fontSize="6" fill="#22c55e" fontFamily="monospace" fontWeight="bold">$1,250.00</text>
      <text x="31" y="35" textAnchor="middle" fontSize="4" fill="#6b7280" fontFamily="monospace">USD · APPROVED</text>
      {/* Card slot */}
      <rect x="15" y="46" width="32" height="4" rx="1" fill="#0d1117" />
      <rect x="15" y="46" width="32" height="2" rx="1" fill="#111827" />
      {/* Contactless symbol */}
      <circle cx="31" cy="57" r="2" fill="#374151" />
      <path d="M27 54 A5 5 0 0 1 35 54" stroke="#4b5563" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M25 52 A7.5 7.5 0 0 1 37 52" stroke="#374151" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* Keypad rows */}
      {[0,1,2,3].map(row => (
        [0,1,2].map(col => (
          <rect
            key={`${row}-${col}`}
            x={13 + col * 13}
            y={65 + row * 7}
            width={10} height={5} rx="1.5"
            fill={row === 3 ? (col === 0 ? "#7f1d1d" : col === 2 ? "#14532d" : "#1f2937") : "#1f2937"}
          />
        ))
      ))}
      {/* Verifone logo text */}
      <text x="31" y="97" textAnchor="middle" fontSize="3.5" fill="#4b5563" fontFamily="Arial" letterSpacing="0.5">VERIFONE</text>
      {/* Side highlight */}
      <rect x="4" y="20" width="2" height="16" rx="1" fill="#374151" />
      {/* Status LED */}
      <circle cx="50" cy="8" r="1.5" fill="#22c55e" />
    </svg>
  );
}

// ── Mastercard Icon ──────────────────────────────────────────────────────────
function MastercardIcon({ size = 28 }: { size?: number }) {
  const overlap = size * 0.3;
  return (
    <div className="relative flex-shrink-0" style={{ width: size + overlap, height: size }}>
      <div className="absolute rounded-full bg-[#EB001B]"
        style={{ width: size, height: size, left: 0, top: 0, opacity: 0.95 }} />
      <div className="absolute rounded-full bg-[#F79E1B]"
        style={{ width: size, height: size, right: 0, top: 0, opacity: 0.95, mixBlendMode: "multiply" }} />
    </div>
  );
}

// ── Visa Logo ────────────────────────────────────────────────────────────────
function VisaLogoSvg({ height = 20 }: { height?: number }) {
  const w = height * 3.1;
  return (
    <svg width={w} height={height} viewBox="0 0 93 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="93" height="30" rx="4" fill="#1A1F71" />
      <text x="7" y="22" fontFamily="Arial, sans-serif" fontStyle="italic" fontWeight="bold"
        fontSize="20" fill="white" letterSpacing="1">VISA</text>
    </svg>
  );
}

// ── Contactless Icon ─────────────────────────────────────────────────────────
function ContactlessIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="18" r="3.5" fill="#222" />
      <path d="M16 10 A11 11 0 0 1 16 26" stroke="#222" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M20 6 A16 16 0 0 1 20 30" stroke="#222" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M24 2 A21 21 0 0 1 24 34" stroke="#222" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ── Visa Net Quantum 9.0 Error Receipt ──────────────────────────────────────
function VisaNetReceiptModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const isMastercard = (tx.description ?? tx.fromAccount ?? "").toLowerCase().includes("mastercard");
  const cardNumMatch = (tx.fromAccount ?? "").match(/\*+\d+/);
  const cardNum = cardNumMatch ? cardNumMatch[0] : "****0074";
  const holderMatch = (tx.fromAccount ?? "").match(/^([^·]+)/);
  const holder = holderMatch ? holderMatch[1].trim() : "ALUSH CECO";
  const amount = parseFloat(tx.amount ?? "0");
  const equivMXN = (amount * 17.5).toLocaleString("es-MX", { minimumFractionDigits: 2 });
  const d = new Date(tx.createdAt);
  const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  const timeStr = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div className="w-full max-w-xs rounded-xl overflow-hidden shadow-2xl"
        style={{ fontFamily: "'Courier New', monospace", background: "#fff" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ background: "#0d2e6e" }} className="px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MastercardIcon size={26} />
              <div>
                <p className="text-[11px] font-bold tracking-widest">VISA NET QUANTUM 9.0</p>
                <p style={{ color: "#93c5fd", fontSize: "9px" }} className="tracking-widest">GLOBAL SERVER</p>
              </div>
            </div>
            <button onClick={onClose} style={{ color: "#93c5fd" }} className="hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div style={{ background: "#111827", color: "#4ade80" }} className="px-4 py-2 text-[10px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span style={{ color: "#d1d5db" }}>POS STATUS: </span>
              <span className="font-bold text-white">Banxico+</span>
            </div>
            <div className="text-right" style={{ color: "#6b7280", fontSize: "9px" }}>
              <p className="text-white font-bold">T1011 · Verifone V660p</p>
              <p>Connected · Protocol 101.1 M1 · Global Server</p>
            </div>
          </div>
          <div className="mt-1 flex gap-3" style={{ color: "#6b7280", fontSize: "9px" }}>
            <span>S/N: VER-T1011-9607</span>
            <span>IP: 192.168.1.111</span>
            <span>Señal: 83%</span>
            <span>FW v338.7.3</span>
          </div>
        </div>
        <div className="px-4 py-3 text-[11px] text-gray-900 space-y-3">
          <div className="text-center pb-2" style={{ borderBottom: "1px dashed #ccc" }}>
            <p className="font-bold text-sm tracking-widest">BANXICO PLUS</p>
            <p className="text-xs tracking-wider">VENTA FORZADA</p>
            <p style={{ color: "#6b7280", fontSize: "9px" }}>GRUPO ASGE · VENADO 69 · CANCUN Q.ROO</p>
          </div>
          <div className="flex justify-between text-[10px]">
            <span style={{ color: "#374151" }}>{dateStr} {timeStr}</span>
            <span className="font-bold">{cardNum}</span>
          </div>
          <div className="space-y-1 pb-2" style={{ borderBottom: "1px dashed #ccc" }}>
            {[
              ["TARJETA",     isMastercard ? "Mastercard Internacional" : "VISA Internacional"],
              ["TITULAR",     holder],
              ["PROTOCOLO",   tx.protocol],
              ["OPER / LOTE", "29 / 3"],
              ["IMPORTE USD", `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`],
              ["EQUIV MXN",   `$${equivMXN}`],
              ["TC",          "17.5 MXN/USD"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-[10px]">
                <span style={{ color: "#6b7280" }} className="w-24 flex-shrink-0">{k}</span>
                <span className="font-bold text-right">{v}</span>
              </div>
            ))}
          </div>
          <div className="rounded p-3 space-y-1.5"
            style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "#dc2626" }}>
                <X className="w-2.5 h-2.5 text-white" />
              </div>
              <p className="font-bold tracking-widest text-[10px]" style={{ color: "#7f1d1d" }}>
                TRANSACCIÓN RECHAZADA
              </p>
            </div>
            <p className="text-[9px] font-bold" style={{ color: "#b91c1c" }}>
              ERROR CODE: ERR_PIN_BANK_HOST
            </p>
            <p className="text-[10px] leading-relaxed italic" style={{ color: "#991b1b" }}>
              "Recheck pin or protocol non authorized connection with the bank host origin sender"
            </p>
          </div>
        </div>
        <div className="px-4 py-2 flex items-center justify-between"
          style={{ background: "#f3f4f6", borderTop: "1px solid #e5e7eb" }}>
          <div className="flex items-center gap-1.5">
            <MastercardIcon size={16} />
            <span className="text-[8px] font-bold text-gray-600">MASTERCARD</span>
          </div>
          <div className="flex items-center gap-1.5 text-[8px] text-gray-500">
            <span className="font-bold" style={{ color: "#0d2e6e" }}>VISA Net 9.0 Quantum</span>
            <span className="border border-gray-400 px-1 rounded">EMV</span>
            <span className="border border-gray-400 px-1 rounded">PCI</span>
            <Shield className="w-3 h-3 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── POS Receipt Modal ────────────────────────────────────────────────────────
function POSReceiptModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const isMC = (tx.fromAccount ?? "").toLowerCase().includes("mastercard");
  const cardMatch = (tx.fromAccount ?? "").match(/\*+\s*(\d{4})\s*$/);
  const cardLast4 = cardMatch ? cardMatch[1] : "0000";
  const cardDisplay = `XXXX-XXXX-XXXX-${cardLast4}`;
  const holderMatch = (tx.fromAccount ?? "").match(/^([^·]+)/);
  const holder = holderMatch ? holderMatch[1].trim().toUpperCase() : "TITULAR";
  const terminalMatch = (tx.toAccount ?? "").match(/TERMINAL\s+(\w+)/);
  const terminal = terminalMatch ? terminalMatch[1] : "T2001";
  const modelMatch = (tx.toAccount ?? "").match(/·\s+([^·]+)$/);
  const terminalModel = modelMatch ? modelMatch[1].trim() : "INGENICO ICT250";
  const amount = parseFloat(tx.amount ?? "0");
  const d = new Date(tx.createdAt);
  const dateStr = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(-2)}`;
  const timeStr = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
  const auth = tx.authCode ?? "";
  const stanMatch = auth.match(/STAN\s+(\d+)/);
  const stan = stanMatch ? stanMatch[1] : "000000";
  const codeMatch = auth.match(/AUTH CODE\s+(\w+)/);
  const authCode = codeMatch ? codeMatch[1] : "XXXXXXX";
  const rrnMatch = auth.match(/RRN\s+(\d+)/);
  const rrn = rrnMatch ? rrnMatch[1] : "0000000000";
  const tdMatch = auth.match(/TD\s+([\w]+)/);
  const td = tdMatch ? tdMatch[1] : "A0000000041010";
  const isDebit = (tx.fromAccount ?? "").toLowerCase().includes("debit") || (tx.fromAccount ?? "").toLowerCase().includes("débito");
  const cardType = isMC ? (isDebit ? "DEBIT MASTERCARD" : "MASTERCARD INTERNACIONAL") : (isDebit ? "VISA DEBITO" : "VISA INTERNACIONAL");
  const mid = `BXMX${terminal.replace(/\D/g,"").padStart(9,"0")}`;
  const sep = "=".repeat(33);
  const dash = "-".repeat(33);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.82)" }} onClick={onClose}>
      <div className="w-full max-w-xs rounded-lg shadow-2xl overflow-hidden"
        style={{ fontFamily: "'Courier New', Courier, monospace", background: "#f0ede8", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-end px-3 pt-2 pb-0">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pb-6 text-[11px] text-gray-900 leading-relaxed space-y-0.5">
          <div className="flex justify-center py-3"><ContactlessIcon size={40} /></div>
          <p className="text-center text-[10px]">{sep}</p>
          <p className="text-center font-bold text-[13px] tracking-widest py-0.5">BANXICO PLUS</p>
          <p className="text-center text-[10px]">{sep}</p>
          <p className="text-center text-[10px] mt-1">VENADO 69, CANCUN Q.ROO MX</p>
          <p className="text-center text-[10px]">TID:{terminal}{"  "}MID:{mid}</p>
          <p className="text-center text-[10px]">DATE: {dateStr}{"  "}TIME: {timeStr}</p>
          <p className="text-center text-[10px] pt-1">{dash}</p>
          <div className="flex flex-col items-center gap-1.5 py-2">
            {isMC ? <MastercardIcon size={26} /> : <VisaLogoSvg height={22} />}
            <p className="font-bold tracking-wider text-[10px]">{cardType}</p>
          </div>
          <p className="text-[10px]">CARD N: {cardDisplay}</p>
          <p className="text-[10px]">CARD READ</p>
          <p className="text-[10px]">TITULAR: {holder}</p>
          <p className="text-[10px] pt-1">{dash}</p>
          <p className="text-center font-bold tracking-widest py-0.5">PAYMENT</p>
          <div className="flex justify-between font-bold text-[12px] py-1">
            <span>AMOUNT</span>
            <span>${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</span>
          </div>
          <p className="text-[10px] pt-0.5">{dash}</p>
          <p className="text-[10px] py-0.5">NO SIGNATURE REQUIRED</p>
          <div className="flex justify-between text-[10px]">
            <span>OPERATOR CODE:</span><span className="font-bold">ADMIN</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>REF N:</span><span className="font-bold">{tx.protocol}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>TERMINAL:</span><span className="font-bold">{terminalModel}</span>
          </div>
          <p className="text-[10px] pt-0.5">{dash}</p>
          <p className="font-bold text-[10px] py-0.5">APPROVED/STAN {stan}/AUTH.</p>
          <p className="text-[10px]">CODE {authCode}/RRN {rrn}</p>
          <p className="text-[10px]">TD {td}</p>
          <p className="text-[10px] pt-0.5">{dash}</p>
          <p className="text-center text-[10px] py-0.5">I ACCEPT THE TRANSACTION</p>
          <p className="text-center text-[10px]">RETAIN RECEIPT</p>
          <p className="text-[10px]">{dash}</p>
          <div className="flex items-center justify-center gap-3 pt-2 pb-1">
            {isMC ? <MastercardIcon size={20} /> : <VisaLogoSvg height={18} />}
          </div>
          <p className="text-center font-bold tracking-widest text-[11px]">MERCHANT COPY</p>
        </div>
      </div>
    </div>
  );
}

// ── TX Detail Panel ──────────────────────────────────────────────────────────
function TxDetailPanel({ row, tx, onClose }: { row: Row; tx: Transaction | undefined; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const isVerifone = (tx?.toAccount ?? "").toLowerCase().includes("v660") ||
                     (tx?.toAccount ?? "").toLowerCase().includes("verifone") ||
                     (tx?.description ?? "").toLowerCase().includes("verifone") ||
                     (tx?.createdBy ?? "").toLowerCase().includes("socemro");

  function copyId() {
    navigator.clipboard.writeText(row.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="border-t" style={{ background: "#0a0c10" }}>
      <div className="flex items-start justify-between px-4 pt-3 pb-1">
        <span style={{ fontSize: 10, letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase" }}>
          Detalle · Transaction
        </span>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-4 pb-4 flex flex-col md:flex-row gap-5">
        {/* Left: data fields */}
        <div className="flex-1 space-y-3">
          {/* TX ID */}
          <div>
            <p style={{ fontSize: 9, color: "#4b5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>TX ID</p>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#e5e7eb", letterSpacing: "0.04em" }}>
                {row.id}
              </span>
              <button onClick={copyId}
                className="text-gray-600 hover:text-[#c8322b] transition-colors"
                title="Copiar TX ID">
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {[
              { label: "Fecha", value: row.dateLabel },
              { label: "Protocolo", value: row.protocol },
              { label: "Tarjeta", value: row.card },
              { label: "Auth Code", value: row.authCode },
              { label: "Moneda", value: row.currency },
              { label: "Tipo", value: row.type },
              ...(row.owner !== "—" ? [{ label: "Usuario", value: row.owner }] : []),
            ].map((item, i) => (
              <div key={i}>
                <p style={{ fontSize: 9, color: "#4b5563", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
                  {item.label}
                </p>
                <p style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {row.status === "Checking with Banking Host..." && (
            <div className="flex items-start gap-2 rounded border border-red-900 px-3 py-2"
              style={{ background: "#1a0505" }}>
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", fontFamily: "monospace" }}>
                  FAILED SERVER — Bank Host Maintenance
                </p>
                <p style={{ fontSize: 9, color: "#f87171", fontFamily: "monospace", marginTop: 2 }}>
                  GLOBAL SERVER VISA ON MAINTENANCE · Transaction queued
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: device visual (Verifone V660P) */}
        {isVerifone && (
          <div className="flex flex-col items-center justify-start gap-2 md:border-l md:pl-5"
            style={{ borderColor: "#1f2937" }}>
            <p style={{ fontSize: 9, color: "#4b5563", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Terminal
            </p>
            <VerifoneV660P size={88} />
            <div className="text-center">
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em" }}>VERIFONE V660P</p>
              <p style={{ fontSize: 9, color: "#4b5563" }}>S/N: VER-T1011-9607</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span style={{ fontSize: 9, color: "#22c55e" }}>ONLINE</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Data types & helpers ─────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  payment:    "Pago",
  transfer:   "Transferencia",
  deposit:    "Depósito",
  withdrawal: "Retiro",
  exchange:   "Exchange",
};

const STATUS_LABEL: Record<string, string> = {
  completed:            "Completada",
  pending:              "Pendiente",
  failed:               "Rechazada",
  processing:           "Procesando",
  checking_host:        "Checking with Banking Host...",
  declined:             "Declinada",
  subscription_payment:  "Abono Suscripción",
  payment_method_error:  "Error Forma de Pago",
  en_validacion:         "En Validación",
  cancelled:             "Cancelada",
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  Completada:                      { label: "Completada",  dot: "#22c55e", bg: "#052e16", text: "#4ade80" },
  Pendiente:                       { label: "Pendiente",   dot: "#eab308", bg: "#1c1700", text: "#facc15" },
  Rechazada:                       { label: "Rechazada",   dot: "#ef4444", bg: "#1a0505", text: "#f87171" },
  Declinada:                       { label: "Declinada",   dot: "#ef4444", bg: "#1a0505", text: "#f87171" },
  Procesando:                      { label: "Procesando",  dot: "#3b82f6", bg: "#0d1931", text: "#60a5fa" },
  "Checking with Banking Host...": { label: "En Host...",  dot: "#f97316", bg: "#1c0e00", text: "#fb923c" },
  "Abono Suscripción":             { label: "Abono Sub",   dot: "#6b7280", bg: "#111827", text: "#9ca3af" },
  "Error Forma de Pago":           { label: "Error Pago",  dot: "#f43f5e", bg: "#1a0509", text: "#fb7185" },
  "En Validación":                 { label: "Validación",  dot: "#f59e0b", bg: "#1c1400", text: "#fbbf24" },
  Cancelada:                       { label: "Cancelada",   dot: "#6b7280", bg: "#111827", text: "#9ca3af" },
};

const TYPE_CONFIG: Record<string, { bg: string; text: string }> = {
  Pago:          { bg: "#1e0a2e", text: "#c084fc" },
  Transferencia: { bg: "#0d1931", text: "#60a5fa" },
  Depósito:      { bg: "#052e16", text: "#4ade80" },
  Retiro:        { bg: "#1c0e00", text: "#fb923c" },
  Exchange:      { bg: "#0d1f2e", text: "#22d3ee" },
};

interface Row {
  id: string;
  date: Date;
  dateLabel: string;
  type: string;
  protocol: string;
  amount: number;
  currency: string;
  status: string;
  card: string;
  authCode: string;
  owner: string;
}

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function cardFromDescription(desc: string | null): string {
  if (!desc) return "—";
  const m = desc.match(/Pago con (.+?) -/);
  return m ? m[1].trim() : "—";
}

function toRow(t: Transaction): Row {
  const d = new Date(t.createdAt);
  return {
    id: t.transactionId,
    date: d,
    dateLabel: fmtDate(d),
    type: TYPE_LABEL[t.type] ?? t.type,
    protocol: t.protocol,
    amount: parseFloat(t.amount ?? "0"),
    currency: t.currency,
    status: STATUS_LABEL[t.status] ?? t.status,
    card: cardFromDescription(t.description),
    authCode: t.authCode ?? "—",
    owner: t.createdBy ?? "—",
  };
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return <span style={{ fontSize: 11, color: "#6b7280" }}>{status}</span>;
  const isLive = status === "Checking with Banking Host..." || status === "En Validación" || status === "Procesando";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: cfg.bg, borderRadius: 4, padding: "2px 8px" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, display: "inline-block", flexShrink: 0 }}
        className={isLive ? "animate-pulse" : ""} />
      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.text, letterSpacing: "0.04em" }}>{cfg.label}</span>
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? { bg: "#111827", text: "#9ca3af" };
  return (
    <span style={{ background: cfg.bg, color: cfg.text, fontSize: 10, fontWeight: 700,
      borderRadius: 4, padding: "2px 7px", letterSpacing: "0.05em" }}>
      {type}
    </span>
  );
}

type SortKey = "date" | "amount" | "id";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 10;

export default function RegistrosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "ADMIN";
  const [simRunning, setSimRunning] = useState(false);
  const [receiptTx, setReceiptTx]   = useState<Transaction | null>(null);
  const [posReceiptTx, setPosReceiptTx] = useState<Transaction | null>(null);

  const { data: transactions = [], isLoading, isFetching, refetch } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    refetchInterval: (query) => {
      const txs = query.state.data as Transaction[] | undefined;
      return txs?.some(t => t.status === "pending" || t.status === "processing" || t.status === "checking_host") ? 3000 : false;
    },
  });

  async function triggerHostFailureSim() {
    setSimRunning(true);
    try {
      const res = await apiRequest("POST", "/api/admin/host-failure-sim", {});
      if (!res.ok) throw new Error("Error al inyectar transacción");
      toast({
        title: "Transacción inyectada",
        description: "ALUSH CECO · $50,000 USD · Pendiente — fallará en 10 s por sin conexión con host bancario.",
      });
      refetch();
    } catch {
      toast({ title: "Error", description: "No se pudo inyectar la transacción.", variant: "destructive" });
    } finally {
      setSimRunning(false);
    }
  }

  const [search, setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType]     = useState("all");
  const [sortKey, setSortKey]     = useState<SortKey>("date");
  const [sortDir, setSortDir]     = useState<SortDir>("desc");
  const [page, setPage]           = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId]   = useState<string | null>(null);

  const rows   = useMemo(() => transactions.map(toRow), [transactions]);
  const txMap  = useMemo(() => new Map(transactions.map(t => [t.transactionId, t])), [transactions]);

  function isVisaNetError(authCode: string) { return authCode.includes("ERR_PIN_BANK_HOST"); }

  function openTx(r: Row) {
    if (isVisaNetError(r.authCode)) {
      const full = txMap.get(r.id);
      if (full) { setReceiptTx(full); return; }
    }
    if (r.authCode.startsWith("APPROVED/STAN")) {
      const full = txMap.get(r.id);
      if (full) { setPosReceiptTx(full); return; }
    }
    setSelectedId(prev => prev === r.id ? null : r.id);
  }

  const pendingRows = useMemo(() => rows.filter(r => r.status === "Pendiente" || r.status === "Procesando"), [rows]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  }

  const filtered = useMemo(() => {
    let result = rows.filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !q || r.id.toLowerCase().includes(q) || r.type.toLowerCase().includes(q) ||
        r.card.toLowerCase().includes(q) || r.protocol.toLowerCase().includes(q) ||
        r.authCode.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || r.status === filterStatus;
      const matchType   = filterType   === "all" || r.type   === filterType;
      return matchSearch && matchStatus && matchType;
    });
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date")   cmp = a.date.getTime() - b.date.getTime();
      if (sortKey === "amount") cmp = a.amount - b.amount;
      if (sortKey === "id")     cmp = a.id.localeCompare(b.id);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [rows, search, filterStatus, filterType, sortKey, sortDir]);

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalVol    = filtered.reduce((s, r) => s + r.amount, 0);
  const completed   = filtered.filter(r => r.status === "Completada").length;
  const rejected    = filtered.filter(r => r.status === "Rechazada" || r.status === "Declinada").length;

  function exportCSV() {
    const headers = ["ID", "Fecha", "Tipo", "Protocolo", "Monto", "Moneda", "Estado", "Tarjeta", "AuthCode"];
    if (isAdmin) headers.push("Usuario");
    const lines = filtered.map(r => {
      const cells = [r.id, r.dateLabel, r.type, r.protocol, r.amount.toFixed(2), r.currency, r.status, r.card, r.authCode];
      if (isAdmin) cells.push(r.owner);
      return cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3" style={{ color: "#c8322b" }} />
      : <ArrowDown className="w-3 h-3" style={{ color: "#c8322b" }} />;
  }

  const selectedRow = selectedId ? rows.find(r => r.id === selectedId) ?? null : null;

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ color: "#f3f4f6" }}>
            <span style={{ display: "inline-block", width: 28, height: 28, position: "relative" }}>
              <span style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                {[0,1,2,3].map(i => <span key={i} style={{ background: "#c8322b", borderRadius: 2 }} />)}
              </span>
            </span>
            Transactions
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
            {isAdmin ? "Historial completo de operaciones del sistema" : "Tu historial de operaciones"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)} data-testid="button-toggle-filters"
            className="border-gray-700 text-gray-300 hover:bg-gray-800">
            <Filter className="w-4 h-4 mr-1" /> {showFilters ? "Ocultar" : "Filtros"}
          </Button>
          <Button size="sm" className="bg-[#c8322b] hover:bg-[#a62822]" onClick={exportCSV}
            disabled={filtered.length === 0} data-testid="button-export">
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* ── KPI Bar ── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { label: "Total", value: filtered.length, sub: "registros", color: "#e5e7eb" },
          { label: "Completadas", value: completed, sub: `${filtered.length ? Math.round(completed / filtered.length * 100) : 0}% tasa`, color: "#4ade80" },
          { label: "Rechazadas", value: rejected, sub: "fallidas / declinadas", color: "#f87171" },
          { label: "Volumen", value: `$${totalVol.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, sub: "USD filtrado", color: "#60a5fa" },
        ].map((s, i) => (
          <div key={i} className="rounded-lg p-4" style={{ background: "#0d0f14", border: "1px solid #1f2937" }}>
            <p style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }} data-testid={`stat-${i}`}>{s.value}</p>
            <p style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Pending alert ── */}
      {pendingRows.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg px-4 py-3"
          style={{ background: "#1c1400", border: "1px solid #92400e" }}
          data-testid="banner-pending">
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            <WifiOff className="w-4 h-4 text-amber-500" />
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 13, fontWeight: 600, color: "#fcd34d" }}>
              {pendingRows.length === 1 ? "1 transacción en espera" : `${pendingRows.length} transacciones en espera`}
            </p>
            <ul className="mt-1 space-y-0.5">
              {pendingRows.map(r => (
                <li key={r.id} className="flex items-center gap-2" style={{ fontSize: 11 }}>
                  <Clock className="w-3 h-3 flex-shrink-0 text-amber-500" />
                  <span style={{ fontFamily: "monospace", color: "#fde68a" }}>{r.id}</span>
                  <span style={{ color: "#d97706" }}>${r.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} {r.currency}</span>
                  <StatusPill status={r.status} />
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 10, color: "#92400e", marginTop: 4 }}>
              Actualizando automáticamente — verificando conexión con host bancario...
            </p>
          </div>
        </div>
      )}

      {/* Admin: hidden sim button */}
      {isAdmin && (
        <div className="flex justify-end">
          <button onClick={triggerHostFailureSim} disabled={simRunning} title=""
            data-testid="button-host-failure-sim"
            className="opacity-10 hover:opacity-40 transition-opacity duration-300 p-1 rounded">
            {simRunning
              ? <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
              : <WifiOff className="w-3 h-3 text-muted-foreground" />}
          </button>
        </div>
      )}

      {/* ── Filters ── */}
      {showFilters && (
        <div className="rounded-lg p-4" style={{ background: "#0d0f14", border: "1px solid #1f2937" }}>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#4b5563" }} />
                <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="TX ID, tipo, protocolo, auth..." className="pl-9 bg-black border-gray-700 text-gray-200"
                  data-testid="input-search" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Estado
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {["all", "Completada", "Pendiente", "Rechazada", "Procesando"].map(s => (
                  <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                    style={{
                      padding: "4px 10px", fontSize: 11, borderRadius: 5, fontWeight: 600, border: "none",
                      background: filterStatus === s ? "#c8322b" : "#111827",
                      color: filterStatus === s ? "#fff" : "#6b7280",
                      cursor: "pointer",
                    }}
                    data-testid={`filter-status-${s}`}>
                    {s === "all" ? "Todos" : s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Tipo
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {["all", "Pago", "Transferencia", "Depósito", "Retiro"].map(t => (
                  <button key={t} onClick={() => { setFilterType(t); setPage(1); }}
                    style={{
                      padding: "4px 10px", fontSize: 11, borderRadius: 5, fontWeight: 600, border: "none",
                      background: filterType === t ? "#c8322b" : "#111827",
                      color: filterType === t ? "#fff" : "#6b7280",
                      cursor: "pointer",
                    }}
                    data-testid={`filter-type-${t}`}>
                    {t === "all" ? "Todos" : t}
                  </button>
                ))}
              </div>
            </div>
            {(search || filterStatus !== "all" || filterType !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterStatus("all"); setFilterType("all"); setPage(1); }}
                data-testid="button-clear-filters" className="text-gray-400">
                <X className="w-3.5 h-3.5 mr-1" /> Limpiar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Search bar (collapsed) ── */}
      {!showFilters && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#4b5563" }} />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por TX ID, tipo, protocolo, auth code..."
            className="pl-10 bg-black border-gray-800 text-gray-200 placeholder:text-gray-600"
            data-testid="input-search-inline" />
        </div>
      )}

      {/* ── Main table card ── */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1f2937", background: "#0a0c10" }}>
        {/* Table header bar */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: "#0d0f14", borderBottom: "1px solid #1f2937" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb" }}>Transaction Ledger</p>
            <p style={{ fontSize: 11, color: "#4b5563" }}>{filtered.length} registros encontrados</p>
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300"
            data-testid="button-refresh">
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-[#c8322b]" : ""}`} />
          </button>
        </div>

        {isLoading ? (
          <div className="py-20 text-center" style={{ color: "#4b5563" }}>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-[#c8322b]" />
            <p style={{ fontSize: 13 }}>Cargando transacciones...</p>
          </div>
        ) : paginated.length === 0 ? (
          <div className="py-20 text-center" data-testid="empty-state">
            <Inbox className="w-8 h-8 mx-auto mb-2" style={{ color: "#374151" }} />
            <p style={{ fontSize: 13, color: "#4b5563" }}>
              {rows.length === 0 ? "Aún no tienes transacciones registradas." : "No hay registros que coincidan con los filtros."}
            </p>
          </div>
        ) : isMobile ? (
          /* ── Mobile card list ── */
          <div>
            {paginated.map((r) => (
              <div key={r.id}
                className="px-4 py-3 cursor-pointer transition-colors"
                style={{ borderBottom: "1px solid #111827" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#0d0f14")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                onClick={() => openTx(r)}
                data-testid={`row-${r.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#e5e7eb" }}
                      className="truncate">{r.id}</p>
                    <p style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>{r.dateLabel}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p style={{ fontWeight: 700, fontSize: 15, color: "#e5e7eb" }}>
                      ${r.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 3 }}>{r.currency}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <TypePill type={r.type} />
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#4b5563" }}>{r.protocol}</span>
                    {isAdmin && <span style={{ fontSize: 10, color: "#4b5563" }}>{r.owner}</span>}
                  </div>
                  <StatusPill status={r.status} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Desktop table ── */
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1f2937" }}>
                  {[
                    { label: "TX ID", key: "id" as SortKey, mono: true },
                    { label: "Fecha", key: "date" as SortKey },
                    { label: "Tipo", key: null },
                    { label: "Protocolo", key: null },
                    { label: "Monto", key: "amount" as SortKey },
                    { label: "Estado", key: null },
                    ...(isAdmin ? [{ label: "Usuario", key: null }] : []),
                    { label: "Auth", key: null },
                    { label: "", key: null },
                  ].map((col, i) => (
                    <th key={i} style={{ padding: "10px 14px", textAlign: "left",
                      fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: "0.1em",
                      textTransform: "uppercase", background: "#0d0f14" }}>
                      {col.key ? (
                        <button onClick={() => toggleSort(col.key!)}
                          className="flex items-center gap-1 hover:text-gray-300 transition-colors"
                          data-testid={`sort-${col.key}`}>
                          {col.label} <SortIcon col={col.key} />
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => {
                  const isSelected = selectedId === r.id;
                  return (
                    <tr key={r.id}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: "1px solid #111827",
                        background: isSelected ? "#0d1117" : "transparent",
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#0d0f14"; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                      onClick={() => openTx(r)}
                      data-testid={`row-${r.id}`}
                    >
                      {/* TX ID */}
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#c8322b", letterSpacing: "0.03em" }}>
                          {r.id}
                        </span>
                      </td>
                      {/* Date */}
                      <td style={{ padding: "11px 14px", fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
                        {r.dateLabel}
                      </td>
                      {/* Type */}
                      <td style={{ padding: "11px 14px" }}>
                        <TypePill type={r.type} />
                      </td>
                      {/* Protocol */}
                      <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>
                        {r.protocol}
                      </td>
                      {/* Amount */}
                      <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#e5e7eb" }}>
                          ${r.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                        <span style={{ fontSize: 10, color: "#4b5563", marginLeft: 4 }}>{r.currency}</span>
                      </td>
                      {/* Status */}
                      <td style={{ padding: "11px 14px" }}>
                        <StatusPill status={r.status} />
                        {r.status === "Checking with Banking Host..." && (
                          <p style={{ fontSize: 9, fontFamily: "monospace", color: "#ef4444", marginTop: 2 }}>
                            ⚠ BANK HOST MAINTENANCE
                          </p>
                        )}
                      </td>
                      {/* User (admin) */}
                      {isAdmin && (
                        <td style={{ padding: "11px 14px", fontSize: 11, color: "#4b5563", maxWidth: 140 }}>
                          <span className="truncate block">{r.owner}</span>
                        </td>
                      )}
                      {/* Auth */}
                      <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 10, color: "#374151", maxWidth: 160 }}>
                        <span className="truncate block">{r.authCode}</span>
                      </td>
                      {/* Action */}
                      <td style={{ padding: "11px 14px" }}>
                        <button
                          className="p-1.5 rounded transition-colors hover:bg-gray-800"
                          style={{ color: isSelected ? "#c8322b" : "#4b5563" }}
                          data-testid={`view-${r.id}`}
                          onClick={(e) => { e.stopPropagation(); openTx(r); }}>
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Detail panel ── */}
        {selectedRow && (
          <TxDetailPanel
            row={selectedRow}
            tx={txMap.get(selectedRow.id)}
            onClose={() => setSelectedId(null)}
          />
        )}

        {/* ── Pagination ── */}
        <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2"
          style={{ borderTop: "1px solid #1f2937" }}>
          <span style={{ fontSize: 11, color: "#4b5563" }}>
            Pág. {totalPages === 0 ? 0 : page} / {totalPages} · {filtered.length} registros
          </span>
          <div className="flex items-center gap-1">
            <button
              style={{
                width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                background: page === 1 ? "#0d0f14" : "#111827", color: page === 1 ? "#374151" : "#9ca3af",
                border: "1px solid #1f2937", cursor: page === 1 ? "default" : "pointer",
              }}
              disabled={page === 1} onClick={() => setPage(p => p - 1)}
              data-testid="page-prev">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                style={{
                  width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: page === p ? "#c8322b" : "#111827",
                  color: page === p ? "#fff" : "#6b7280",
                  border: "1px solid " + (page === p ? "#c8322b" : "#1f2937"),
                  cursor: "pointer",
                }}
                data-testid={`page-${p}`}>{p}
              </button>
            ))}
            <button
              style={{
                width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                background: (page === totalPages || totalPages === 0) ? "#0d0f14" : "#111827",
                color: (page === totalPages || totalPages === 0) ? "#374151" : "#9ca3af",
                border: "1px solid #1f2937",
                cursor: (page === totalPages || totalPages === 0) ? "default" : "pointer",
              }}
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage(p => p + 1)}
              data-testid="page-next">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Visa Net Receipt Modal ── */}
      {receiptTx && <VisaNetReceiptModal tx={receiptTx} onClose={() => setReceiptTx(null)} />}

      {/* ── POS Receipt Modal ── */}
      {posReceiptTx && <POSReceiptModal tx={posReceiptTx} onClose={() => setPosReceiptTx(null)} />}
    </div>
  );
}
