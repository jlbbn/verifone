import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Transaction } from "@shared/schema";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Search, Download, Filter, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, RefreshCw, X, Inbox, Loader2,
  WifiOff, Shield, Copy, CheckCheck, Clock, AlertTriangle, TrendingUp, TrendingDown,
} from "lucide-react";

// ── Verifone V660P SVG ───────────────────────────────────────────────────────
function VerifoneV660P({ size = 72 }: { size?: number }) {
  const w = size * 0.62;
  const h = size;
  return (
    <svg width={w} height={h} viewBox="0 0 62 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="2" width="54" height="96" rx="7" fill="#1a1a2e" />
      <rect x="6" y="4" width="50" height="92" rx="6" fill="#16213e" />
      <rect x="9" y="8" width="44" height="36" rx="3" fill="#0f0f23" />
      <rect x="11" y="10" width="40" height="32" rx="2" fill="#0a1628" />
      <rect x="14" y="13" width="34" height="3" rx="1" fill="#1e3a5f" />
      <text x="31" y="28" textAnchor="middle" fontSize="6" fill="#22c55e" fontFamily="monospace" fontWeight="bold">$1,250.00</text>
      <text x="31" y="35" textAnchor="middle" fontSize="4" fill="#6b7280" fontFamily="monospace">USD · APPROVED</text>
      <rect x="15" y="46" width="32" height="4" rx="1" fill="#0d1117" />
      <rect x="15" y="46" width="32" height="2" rx="1" fill="#111827" />
      <circle cx="31" cy="57" r="2" fill="#374151" />
      <path d="M27 54 A5 5 0 0 1 35 54" stroke="#4b5563" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M25 52 A7.5 7.5 0 0 1 37 52" stroke="#374151" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {[0,1,2,3].map(row => (
        [0,1,2].map(col => (
          <rect key={`${row}-${col}`}
            x={13 + col * 13} y={65 + row * 7} width={10} height={5} rx="1.5"
            fill={row === 3 ? (col === 0 ? "#7f1d1d" : col === 2 ? "#14532d" : "#1f2937") : "#1f2937"}
          />
        ))
      ))}
      <text x="31" y="97" textAnchor="middle" fontSize="3.5" fill="#4b5563" fontFamily="Arial" letterSpacing="0.5">VERIFONE</text>
      <rect x="4" y="20" width="2" height="16" rx="1" fill="#374151" />
      <circle cx="50" cy="8" r="1.5" fill="#22c55e" />
    </svg>
  );
}

// ── Mastercard / Visa icons ──────────────────────────────────────────────────
function MastercardIcon({ size = 28 }: { size?: number }) {
  const overlap = size * 0.3;
  return (
    <div className="relative flex-shrink-0" style={{ width: size + overlap, height: size }}>
      <div className="absolute rounded-full bg-[#EB001B]" style={{ width: size, height: size, left: 0, top: 0, opacity: 0.95 }} />
      <div className="absolute rounded-full bg-[#F79E1B]" style={{ width: size, height: size, right: 0, top: 0, opacity: 0.95, mixBlendMode: "multiply" }} />
    </div>
  );
}
function VisaLogoSvg({ height = 20 }: { height?: number }) {
  const w = height * 3.1;
  return (
    <svg width={w} height={height} viewBox="0 0 93 30" fill="none">
      <rect width="93" height="30" rx="4" fill="#1A1F71" />
      <text x="7" y="22" fontFamily="Arial, sans-serif" fontStyle="italic" fontWeight="bold" fontSize="20" fill="white" letterSpacing="1">VISA</text>
    </svg>
  );
}
function ContactlessIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <circle cx="10" cy="18" r="3.5" fill="#222" />
      <path d="M16 10 A11 11 0 0 1 16 26" stroke="#222" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M20 6 A16 16 0 0 1 20 30" stroke="#222" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M24 2 A21 21 0 0 1 24 34" stroke="#222" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ── Mini Sparkline SVG ───────────────────────────────────────────────────────
function Sparkline({ values, color = "#22c55e" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 52, h = 20;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Visa Net Error Receipt Modal ─────────────────────────────────────────────
function VisaNetReceiptModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const isMC = (tx.description ?? tx.fromAccount ?? "").toLowerCase().includes("mastercard");
  const cardNum = (tx.fromAccount ?? "").match(/\*+\d+/)?.[0] ?? "****0074";
  const holder = (tx.fromAccount ?? "").match(/^([^·]+)/)?.[1]?.trim() ?? "ALUSH CECO";
  const amount = parseFloat(tx.amount ?? "0");
  const d = new Date(tx.createdAt);
  const dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
  const timeStr = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.80)" }} onClick={onClose}>
      <div className="w-full max-w-xs rounded-xl overflow-hidden shadow-2xl" style={{ fontFamily: "'Courier New', monospace", background: "#fff" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "#0d2e6e" }} className="px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MastercardIcon size={26} />
              <div><p className="text-[11px] font-bold tracking-widest">VISA NET QUANTUM 9.0</p><p style={{ color: "#93c5fd", fontSize: "9px" }} className="tracking-widest">GLOBAL SERVER</p></div>
            </div>
            <button onClick={onClose} style={{ color: "#93c5fd" }}><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div style={{ background: "#111827", color: "#4ade80" }} className="px-4 py-2 text-[10px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><span style={{ color: "#d1d5db" }}>POS: </span><span className="font-bold text-white">Banxico+</span></div>
            <div style={{ color: "#6b7280", fontSize: "9px" }} className="text-right"><p className="text-white font-bold">T1011 · Verifone V660p</p><p>Protocol 101.1 M1</p></div>
          </div>
        </div>
        <div className="px-4 py-3 text-[11px] text-gray-900 space-y-3">
          <div className="text-center pb-2" style={{ borderBottom: "1px dashed #ccc" }}>
            <p className="font-bold text-sm tracking-widest">BANXICO PLUS</p>
            <p style={{ color: "#6b7280", fontSize: "9px" }}>GRUPO ASGE · VENADO 69 · CANCUN Q.ROO</p>
          </div>
          <div className="flex justify-between text-[10px]"><span>{dateStr} {timeStr}</span><span className="font-bold">{cardNum}</span></div>
          {[["TARJETA", isMC ? "Mastercard Int'l" : "VISA Internacional"], ["TITULAR", holder], ["PROTOCOLO", tx.protocol], ["IMPORTE", `$${amount.toLocaleString("en-US",{minimumFractionDigits:2})} USD`]].map(([k,v])=>(
            <div key={k} className="flex justify-between text-[10px]"><span style={{color:"#6b7280"}} className="w-24 flex-shrink-0">{k}</span><span className="font-bold">{v}</span></div>
          ))}
          <div className="rounded p-3 space-y-1" style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#dc2626" }}><X className="w-2.5 h-2.5 text-white" /></div><p className="font-bold tracking-widest text-[10px]" style={{ color: "#7f1d1d" }}>TRANSACCIÓN RECHAZADA</p></div>
            <p className="text-[9px] font-bold" style={{ color: "#b91c1c" }}>ERROR CODE: ERR_PIN_BANK_HOST</p>
          </div>
        </div>
        <div className="px-4 py-2 flex items-center justify-between" style={{ background: "#f3f4f6", borderTop: "1px solid #e5e7eb" }}>
          <div className="flex items-center gap-1.5"><MastercardIcon size={16} /><span className="text-[8px] font-bold text-gray-600">MASTERCARD</span></div>
          <div className="flex items-center gap-1 text-[8px] text-gray-500"><span className="font-bold" style={{ color: "#0d2e6e" }}>VISA Net 9.0</span><span className="border border-gray-400 px-1 rounded">EMV</span><Shield className="w-3 h-3 text-gray-400" /></div>
        </div>
      </div>
    </div>
  );
}

// ── POS Receipt Modal ────────────────────────────────────────────────────────
function POSReceiptModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const isMC = (tx.fromAccount ?? "").toLowerCase().includes("mastercard");
  const cardLast4 = (tx.fromAccount ?? "").match(/\*+\s*(\d{4})\s*$/)?.[1] ?? "0000";
  const holder = (tx.fromAccount ?? "").match(/^([^·]+)/)?.[1]?.trim().toUpperCase() ?? "TITULAR";
  const terminal = (tx.toAccount ?? "").match(/TERMINAL\s+(\w+)/)?.[1] ?? "T2001";
  const terminalModel = (tx.toAccount ?? "").match(/·\s+([^·]+)$/)?.[1]?.trim() ?? "INGENICO ICT250";
  const amount = parseFloat(tx.amount ?? "0");
  const d = new Date(tx.createdAt);
  const ds = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(-2)}`;
  const ts = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
  const auth = tx.authCode ?? "";
  const stan = auth.match(/STAN\s+(\d+)/)?.[1] ?? "000000";
  const authCode = auth.match(/AUTH CODE\s+(\w+)/)?.[1] ?? "XXXXXXX";
  const rrn = auth.match(/RRN\s+(\d+)/)?.[1] ?? "0000000000";
  const mid = `BXMX${terminal.replace(/\D/g,"").padStart(9,"0")}`;
  const sep = "=".repeat(33); const dash = "-".repeat(33);
  const isDebit = (tx.fromAccount ?? "").toLowerCase().includes("debit");
  const cardType = isMC ? (isDebit ? "DEBIT MASTERCARD" : "MASTERCARD INTERNACIONAL") : (isDebit ? "VISA DEBITO" : "VISA INTERNACIONAL");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.82)" }} onClick={onClose}>
      <div className="w-full max-w-xs rounded-lg shadow-2xl overflow-hidden" style={{ fontFamily: "'Courier New',Courier,monospace", background: "#f0ede8", maxHeight: "90vh", overflowY: "auto" }} onClick={e=>e.stopPropagation()}>
        <div className="flex justify-end px-3 pt-2"><button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button></div>
        <div className="px-5 pb-6 text-[11px] text-gray-900 leading-relaxed space-y-0.5">
          <div className="flex justify-center py-3"><ContactlessIcon size={40} /></div>
          <p className="text-center text-[10px]">{sep}</p>
          <p className="text-center font-bold text-[13px] tracking-widest py-0.5">BANXICO PLUS</p>
          <p className="text-center text-[10px]">{sep}</p>
          <p className="text-center text-[10px] mt-1">VENADO 69, CANCUN Q.ROO MX</p>
          <p className="text-center text-[10px]">TID:{terminal}{"  "}MID:{mid}</p>
          <p className="text-center text-[10px]">DATE: {ds}{"  "}TIME: {ts}</p>
          <p className="text-center text-[10px] pt-1">{dash}</p>
          <div className="flex flex-col items-center gap-1.5 py-2">
            {isMC ? <MastercardIcon size={26} /> : <VisaLogoSvg height={22} />}
            <p className="font-bold tracking-wider text-[10px]">{cardType}</p>
          </div>
          <p className="text-[10px]">CARD N: XXXX-XXXX-XXXX-{cardLast4}</p>
          <p className="text-[10px]">TITULAR: {holder}</p>
          <p className="text-[10px] pt-1">{dash}</p>
          <div className="flex justify-between font-bold text-[12px] py-1"><span>AMOUNT</span><span>${amount.toLocaleString("en-US",{minimumFractionDigits:2})} USD</span></div>
          <p className="text-[10px]">{dash}</p>
          <div className="flex justify-between text-[10px]"><span>TERMINAL:</span><span className="font-bold">{terminalModel}</span></div>
          <p className="text-[10px] pt-0.5">{dash}</p>
          <p className="font-bold text-[10px]">APPROVED/STAN {stan}/AUTH CODE {authCode}</p>
          <p className="text-[10px]">RRN {rrn}</p>
          <p className="text-[10px]">{dash}</p>
          <p className="text-center font-bold tracking-widest text-[11px]">MERCHANT COPY</p>
        </div>
      </div>
    </div>
  );
}

// ── Data helpers ─────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string,string> = { payment:"Pago", transfer:"Transferencia", deposit:"Depósito", withdrawal:"Retiro", exchange:"Exchange" };
const STATUS_LABEL: Record<string,string> = { completed:"Completada", pending:"Pendiente", failed:"Rechazada", processing:"Procesando", checking_host:"Checking with Banking Host...", declined:"Declinada", subscription_payment:"Abono Suscripción", payment_method_error:"Error Forma de Pago", en_validacion:"En Validación", cancelled:"Cancelada" };
const STATUS_CFG: Record<string,{dot:string;bg:string;text:string}> = {
  "Completada":                      {dot:"#22c55e",bg:"#052e16",text:"#4ade80"},
  "Pendiente":                       {dot:"#eab308",bg:"#1c1700",text:"#facc15"},
  "Rechazada":                       {dot:"#ef4444",bg:"#1a0505",text:"#f87171"},
  "Declinada":                       {dot:"#ef4444",bg:"#1a0505",text:"#f87171"},
  "Procesando":                      {dot:"#3b82f6",bg:"#0d1931",text:"#60a5fa"},
  "Checking with Banking Host...":   {dot:"#f97316",bg:"#1c0e00",text:"#fb923c"},
  "Abono Suscripción":               {dot:"#6b7280",bg:"#111827",text:"#9ca3af"},
  "Error Forma de Pago":             {dot:"#f43f5e",bg:"#1a0509",text:"#fb7185"},
  "En Validación":                   {dot:"#f59e0b",bg:"#1c1400",text:"#fbbf24"},
  "Cancelada":                       {dot:"#6b7280",bg:"#111827",text:"#9ca3af"},
};
const TYPE_CFG: Record<string,{bg:string;text:string}> = {
  "Pago":          {bg:"#1e0a2e",text:"#c084fc"},
  "Transferencia": {bg:"#0d1931",text:"#60a5fa"},
  "Depósito":      {bg:"#052e16",text:"#4ade80"},
  "Retiro":        {bg:"#1c0e00",text:"#fb923c"},
  "Exchange":      {bg:"#0d1f2e",text:"#22d3ee"},
};

interface Row { id:string; date:Date; dateLabel:string; type:string; protocol:string; amount:number; currency:string; status:string; card:string; authCode:string; owner:string; }

const fmtDate = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
const cardFrom = (desc:string|null) => { if(!desc) return "—"; const m=desc.match(/Pago con (.+?) -/); return m?m[1].trim():"—"; };
const toRow = (t:Transaction): Row => {
  const d = new Date(t.createdAt);
  return { id:t.transactionId, date:d, dateLabel:fmtDate(d), type:TYPE_LABEL[t.type]??t.type, protocol:t.protocol, amount:parseFloat(t.amount??"0"), currency:t.currency, status:STATUS_LABEL[t.status]??t.status, card:cardFrom(t.description), authCode:t.authCode??"—", owner:t.createdBy??"—" };
};

function StatusPill({ status }: { status:string }) {
  const c = STATUS_CFG[status];
  if (!c) return <span style={{fontSize:11,color:"#6b7280"}}>{status}</span>;
  const live = ["Procesando","Checking with Banking Host...","En Validación"].includes(status);
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,background:c.bg,borderRadius:4,padding:"2px 8px",whiteSpace:"nowrap"}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:c.dot,display:"inline-block",flexShrink:0}} className={live?"animate-pulse":""} />
      <span style={{fontSize:11,fontWeight:600,color:c.text,letterSpacing:"0.03em"}}>{status==="Checking with Banking Host..."?"En Host...":status}</span>
    </span>
  );
}
function TypePill({ type }: { type:string }) {
  const c = TYPE_CFG[type]??{bg:"#111827",text:"#9ca3af"};
  return <span style={{background:c.bg,color:c.text,fontSize:10,fontWeight:700,borderRadius:4,padding:"2px 7px",letterSpacing:"0.05em"}}>{type}</span>;
}

type SortKey = "date"|"amount"|"id"; type SortDir = "asc"|"desc";
const PAGE_SIZE = 10;

// ── Custom recharts tooltip ──────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#0d0f14", border:"1px solid #1f2937", borderRadius:8, padding:"8px 12px" }}>
      <p style={{ fontSize:11, color:"#6b7280", marginBottom:4 }}>{label}</p>
      <p style={{ fontSize:13, fontWeight:700, color:"#60a5fa" }}>${Number(payload[0]?.value??0).toLocaleString("en-US",{minimumFractionDigits:2})}</p>
      <p style={{ fontSize:10, color:"#4b5563" }}>{payload[1]?.value??0} tx</p>
    </div>
  );
}

export default function RegistrosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "ADMIN";
  const [simRunning, setSimRunning] = useState(false);
  const [receiptTx, setReceiptTx]   = useState<Transaction|null>(null);
  const [posReceiptTx, setPosReceiptTx] = useState<Transaction|null>(null);

  const { data: transactions = [], isLoading, isFetching, refetch } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    refetchInterval: q => {
      const txs = q.state.data as Transaction[]|undefined;
      return txs?.some(t=>t.status==="pending"||t.status==="processing"||t.status==="checking_host") ? 3000 : false;
    },
  });

  async function triggerHostFailureSim() {
    setSimRunning(true);
    try {
      const res = await apiRequest("POST","/api/admin/host-failure-sim",{});
      if (!res.ok) throw new Error();
      toast({ title:"Transacción inyectada", description:"ALUSH CECO · $50,000 USD · fallará en 10s." });
      refetch();
    } catch { toast({ title:"Error", variant:"destructive" }); }
    finally { setSimRunning(false); }
  }

  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType]     = useState("all");
  const [sortKey, setSortKey]           = useState<SortKey>("date");
  const [sortDir, setSortDir]           = useState<SortDir>("desc");
  const [page, setPage]                 = useState(1);
  const [showFilters, setShowFilters]   = useState(false);
  const [selectedId, setSelectedId]     = useState<string|null>(null);

  const rows  = useMemo(()=>transactions.map(toRow),[transactions]);
  const txMap = useMemo(()=>new Map(transactions.map(t=>[t.transactionId,t])),[transactions]);

  function openTx(r:Row) {
    if (r.authCode.includes("ERR_PIN_BANK_HOST")) { const f=txMap.get(r.id); if(f){setReceiptTx(f);return;} }
    if (r.authCode.startsWith("APPROVED/STAN"))    { const f=txMap.get(r.id); if(f){setPosReceiptTx(f);return;} }
    setSelectedId(p=>p===r.id?null:r.id);
  }

  const pendingRows = useMemo(()=>rows.filter(r=>r.status==="Pendiente"||r.status==="Procesando"),[rows]);

  function toggleSort(k:SortKey) { if(sortKey===k)setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortKey(k);setSortDir("desc");} setPage(1); }

  const filtered = useMemo(()=>{
    let r = rows.filter(r=>{
      const q=search.toLowerCase();
      const ms=!q||r.id.toLowerCase().includes(q)||r.type.toLowerCase().includes(q)||r.card.toLowerCase().includes(q)||r.protocol.toLowerCase().includes(q)||r.authCode.toLowerCase().includes(q)||r.owner.toLowerCase().includes(q);
      return ms&&(filterStatus==="all"||r.status===filterStatus)&&(filterType==="all"||r.type===filterType);
    });
    return [...r].sort((a,b)=>{
      const cmp = sortKey==="date"?a.date.getTime()-b.date.getTime():sortKey==="amount"?a.amount-b.amount:a.id.localeCompare(b.id);
      return sortDir==="asc"?cmp:-cmp;
    });
  },[rows,search,filterStatus,filterType,sortKey,sortDir]);

  const totalPages = Math.ceil(filtered.length/PAGE_SIZE);
  const paginated  = filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const totalVol   = filtered.reduce((s,r)=>s+r.amount,0);
  const completed  = filtered.filter(r=>r.status==="Completada").length;
  const rejected   = filtered.filter(r=>r.status==="Rechazada"||r.status==="Declinada").length;
  const avgAmount  = filtered.length ? totalVol/filtered.length : 0;
  const successPct = filtered.length ? Math.round(completed/filtered.length*100) : 0;

  // ── Volume trend chart data (last 12 hours by hour) ──────────────────────
  const chartData = useMemo(()=>{
    const now = new Date();
    return Array.from({length:12},(_,i)=>{
      const h = (now.getHours()-11+i+24)%24;
      const label = `${h===0?12:h>12?h-12:h}${h>=12?"pm":"am"}`;
      const txs = transactions.filter(t=>new Date(t.createdAt).getHours()===h);
      const vol = txs.reduce((s,t)=>s+parseFloat(t.amount??"0"),0);
      return { label, vol, count: txs.length };
    });
  },[transactions]);

  // ── Per-user sparkline data (last 6 transactions for that user) ──────────
  const userAmountHistory = useMemo(()=>{
    const map = new Map<string,number[]>();
    [...rows].reverse().forEach(r=>{
      const arr = map.get(r.owner)??[];
      arr.push(r.amount);
      map.set(r.owner,arr.slice(-6));
    });
    return map;
  },[rows]);

  function exportCSV() {
    const hdrs = ["ID","Fecha","Tipo","Protocolo","Monto","Moneda","Estado","Tarjeta","AuthCode",...(isAdmin?["Usuario"]:[])];
    const lines = filtered.map(r=>[r.id,r.dateLabel,r.type,r.protocol,r.amount.toFixed(2),r.currency,r.status,r.card,r.authCode,...(isAdmin?[r.owner]:[])].map(c=>`"${String(c).replace(/"/g,'""')}"`).join(","));
    const blob = new Blob([[hdrs.join(","),...lines].join("\n")],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`transactions-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  function SortIcon({col}:{col:SortKey}) {
    if(sortKey!==col) return <ArrowUpDown className="w-3 h-3 opacity-30"/>;
    return sortDir==="asc"?<ArrowUp className="w-3 h-3 text-[#c8322b]"/>:<ArrowDown className="w-3 h-3 text-[#c8322b]"/>;
  }

  const selectedRow = selectedId?rows.find(r=>r.id===selectedId)??null:null;

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-full" style={{ background:"#080a0e" }}>

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:3, width:20, height:20 }}>
              {[0,1,2,3].map(i=><div key={i} style={{ background:"#c8322b", borderRadius:2 }}/>)}
            </div>
            <h1 style={{ fontSize:26, fontWeight:800, color:"#f3f4f6", letterSpacing:"-0.02em" }}>Transactions</h1>
          </div>
          <p style={{ fontSize:12, color:"#6b7280" }}>
            {isAdmin?"Ledger completo del sistema · todos los usuarios":"Tu historial de operaciones"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={()=>setShowFilters(v=>!v)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:8, border:"1px solid #1f2937", background: showFilters?"#1f2937":"transparent", color:"#9ca3af", fontSize:12, cursor:"pointer" }}
            data-testid="button-toggle-filters"
          >
            <Filter className="w-3.5 h-3.5"/> {showFilters?"Ocultar":"Filtros"}
          </button>
          <button
            onClick={exportCSV}
            disabled={filtered.length===0}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:8, border:"none", background:"#c8322b", color:"#fff", fontSize:12, cursor:"pointer", opacity: filtered.length===0?0.5:1 }}
            data-testid="button-export"
          >
            <Download className="w-3.5 h-3.5"/> Export CSV
          </button>
        </div>
      </div>

      {/* ── KPI grid — 3+3 like reference ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label:"Total Transactions", value: filtered.length.toLocaleString(), sub:"registros filtrados", color:"#e5e7eb", trend: null },
          { label:"Volume (USD)",       value: `$${totalVol>=1e6?(totalVol/1e6).toFixed(2)+"M":totalVol>=1e3?(totalVol/1e3).toFixed(1)+"K":totalVol.toFixed(0)}`, sub:"USD acumulado", color:"#60a5fa", trend: null },
          { label:"Success Rate",       value: `${successPct}%`, sub:`${completed} completadas`, color: successPct>=80?"#4ade80":successPct>=50?"#facc15":"#f87171", trend: successPct>=80?"up":"down" },
          { label:"Avg. Transaction",   value: `$${avgAmount>=1e3?(avgAmount/1e3).toFixed(1)+"K":avgAmount.toFixed(0)}`, sub:"USD promedio", color:"#c084fc", trend: null },
          { label:"Pending",            value: pendingRows.length.toLocaleString(), sub:"requieren atención", color: pendingRows.length>0?"#facc15":"#4ade80", trend: pendingRows.length>0?"down":null },
          { label:"Rejected",           value: rejected.toLocaleString(), sub:"fallidas · declinadas", color: rejected>0?"#f87171":"#4ade80", trend: rejected>0?"down":null },
        ].map((k,i)=>(
          <div key={i} style={{ background:"#0d0f14", border:"1px solid #1f2937", borderRadius:12, padding:"18px 20px", position:"relative", overflow:"hidden" }} data-testid={`stat-${i}`}>
            <div style={{ position:"absolute", top:12, right:14 }}>
              {k.trend==="up"&&<TrendingUp className="w-4 h-4" style={{color:"#4ade80"}}/>}
              {k.trend==="down"&&<TrendingDown className="w-4 h-4" style={{color:"#f87171"}}/>}
            </div>
            <p style={{ fontSize:10, color:"#4b5563", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>{k.label}</p>
            <p style={{ fontSize:28, fontWeight:800, color:k.color, lineHeight:1, letterSpacing:"-0.02em" }}>{k.value}</p>
            <p style={{ fontSize:11, color:"#374151", marginTop:6 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Pending alert ── */}
      {pendingRows.length>0&&(
        <div style={{ background:"#1c1400", border:"1px solid #92400e", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"flex-start", gap:12 }} data-testid="banner-pending">
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginTop:2}}>
            <WifiOff className="w-4 h-4 text-amber-500"/>
            <Loader2 className="w-4 h-4 animate-spin text-amber-500"/>
          </div>
          <div style={{flex:1}}>
            <p style={{fontSize:13,fontWeight:600,color:"#fcd34d"}}>{pendingRows.length} transacción{pendingRows.length>1?"es":""} en espera</p>
            {pendingRows.slice(0,3).map(r=>(
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:11,marginTop:4}}>
                <Clock className="w-3 h-3 text-amber-500 flex-shrink-0"/>
                <span style={{fontFamily:"monospace",color:"#fde68a"}}>{r.id}</span>
                <span style={{color:"#d97706"}}>${r.amount.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                <StatusPill status={r.status}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Area chart + quick stats — two-column ── */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Chart: 2/3 width */}
        <div style={{ background:"#0d0f14", border:"1px solid #1f2937", borderRadius:12, padding:"20px", gridColumn:"span 2" }} className="md:col-span-2">
          <div style={{ marginBottom:16 }}>
            <p style={{ fontSize:13, fontWeight:700, color:"#e5e7eb" }}>Volume Trend</p>
            <p style={{ fontSize:11, color:"#4b5563" }}>Últimas 12 horas · USD acumulado</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
              <XAxis dataKey="label" tick={{fontSize:10,fill:"#4b5563"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:"#4b5563"}} axisLine={false} tickLine={false} width={40}
                tickFormatter={v=>v>=1000?`$${(v/1000).toFixed(0)}k`:`$${v}`}/>
              <RechartsTooltip content={<ChartTooltip/>} cursor={{stroke:"#374151",strokeWidth:1}}/>
              <Area type="monotone" dataKey="vol" stroke="#3b82f6" strokeWidth={2} fill="url(#volGrad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Right: breakdown by type */}
        <div style={{ background:"#0d0f14", border:"1px solid #1f2937", borderRadius:12, padding:"20px" }}>
          <p style={{ fontSize:13, fontWeight:700, color:"#e5e7eb", marginBottom:4 }}>By Type</p>
          <p style={{ fontSize:11, color:"#4b5563", marginBottom:16 }}>Distribución de operaciones</p>
          {(["Pago","Transferencia","Depósito","Retiro","Exchange"] as const).map(type=>{
            const count = rows.filter(r=>r.type===type).length;
            const pct = rows.length ? Math.round(count/rows.length*100) : 0;
            const cfg = TYPE_CFG[type]??{bg:"#111827",text:"#9ca3af"};
            return (
              <div key={type} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,color:cfg.text,fontWeight:600}}>{type}</span>
                  <span style={{fontSize:11,color:"#4b5563"}}>{count} · {pct}%</span>
                </div>
                <div style={{height:4,background:"#1f2937",borderRadius:2}}>
                  <div style={{height:"100%",width:`${pct}%`,background:cfg.text,borderRadius:2,transition:"width 0.6s ease"}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Filters ── */}
      {showFilters&&(
        <div style={{ background:"#0d0f14", border:"1px solid #1f2937", borderRadius:12, padding:16 }}>
          <div className="flex flex-wrap gap-4 items-end">
            <div style={{flex:1,minWidth:200}}>
              <p style={{fontSize:10,color:"#6b7280",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Buscar</p>
              <div style={{position:"relative"}}>
                <Search style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",width:14,height:14,color:"#4b5563"}}/>
                <Input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="TX ID, tipo, protocolo, auth..." className="pl-9 bg-black border-gray-700 text-gray-200" data-testid="input-search"/>
              </div>
            </div>
            <div>
              <p style={{fontSize:10,color:"#6b7280",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Estado</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["all","Completada","Pendiente","Rechazada","Procesando"].map(s=>(
                  <button key={s} onClick={()=>{setFilterStatus(s);setPage(1);}}
                    style={{padding:"4px 10px",fontSize:11,borderRadius:6,fontWeight:600,border:"none",background:filterStatus===s?"#c8322b":"#111827",color:filterStatus===s?"#fff":"#6b7280",cursor:"pointer"}}
                    data-testid={`filter-status-${s}`}>{s==="all"?"Todos":s}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={{fontSize:10,color:"#6b7280",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Tipo</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["all","Pago","Transferencia","Depósito","Retiro"].map(t=>(
                  <button key={t} onClick={()=>{setFilterType(t);setPage(1);}}
                    style={{padding:"4px 10px",fontSize:11,borderRadius:6,fontWeight:600,border:"none",background:filterType===t?"#c8322b":"#111827",color:filterType===t?"#fff":"#6b7280",cursor:"pointer"}}
                    data-testid={`filter-type-${t}`}>{t==="all"?"Todos":t}</button>
                ))}
              </div>
            </div>
            {(search||filterStatus!=="all"||filterType!=="all")&&(
              <button onClick={()=>{setSearch("");setFilterStatus("all");setFilterType("all");setPage(1);}} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"#6b7280",background:"none",border:"none",cursor:"pointer"}} data-testid="button-clear-filters">
                <X className="w-3.5 h-3.5"/> Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Inline search (collapsed) ── */}
      {!showFilters&&(
        <div style={{position:"relative"}}>
          <Search style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",width:14,height:14,color:"#374151"}}/>
          <Input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search TX ID, type, protocol, auth code..."
            className="pl-10 bg-black border-gray-800 text-gray-200 placeholder:text-gray-600" data-testid="input-search-inline"/>
        </div>
      )}

      {/* ── Transaction table ── */}
      <div style={{ border:"1px solid #1f2937", borderRadius:12, overflow:"hidden", background:"#0a0c10" }}>
        {/* Table header bar */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:"#0d0f14", borderBottom:"1px solid #1f2937" }}>
          <div>
            <p style={{fontSize:13,fontWeight:700,color:"#e5e7eb"}}>Transaction Ledger</p>
            <p style={{fontSize:11,color:"#374151"}}>{filtered.length} registros</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {isAdmin&&(
              <button onClick={triggerHostFailureSim} disabled={simRunning} title="" data-testid="button-host-failure-sim"
                style={{opacity:0.1,padding:4,borderRadius:6,background:"none",border:"none",cursor:"pointer",color:"#6b7280"}}>
                {simRunning?<Loader2 className="w-3 h-3 animate-spin"/>:<WifiOff className="w-3 h-3"/>}
              </button>
            )}
            <button onClick={()=>refetch()} disabled={isFetching}
              style={{padding:6,borderRadius:8,background:"transparent",border:"1px solid #1f2937",cursor:"pointer",color: isFetching?"#c8322b":"#6b7280"}}
              data-testid="button-refresh">
              <RefreshCw className={`w-4 h-4 ${isFetching?"animate-spin":""}`}/>
            </button>
          </div>
        </div>

        {isLoading?(
          <div style={{padding:"64px 0",textAlign:"center",color:"#4b5563"}}>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-[#c8322b]"/>
            <p style={{fontSize:13}}>Cargando transacciones...</p>
          </div>
        ):paginated.length===0?(
          <div style={{padding:"64px 0",textAlign:"center"}} data-testid="empty-state">
            <Inbox style={{width:32,height:32,margin:"0 auto 8px",color:"#1f2937"}}/>
            <p style={{fontSize:13,color:"#374151"}}>{rows.length===0?"Aún no tienes transacciones registradas.":"No hay registros que coincidan."}</p>
          </div>
        ):isMobile?(
          /* Mobile cards */
          <div>
            {paginated.map(r=>(
              <div key={r.id} style={{padding:"12px 16px",borderBottom:"1px solid #111827",cursor:"pointer"}}
                onClick={()=>openTx(r)} data-testid={`row-${r.id}`}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#c8322b"}}>{r.id}</span>
                  <span style={{fontSize:14,fontWeight:700,color:"#e5e7eb"}}>${r.amount.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <TypePill type={r.type}/>
                    <span style={{fontFamily:"monospace",fontSize:10,color:"#4b5563"}}>{r.protocol}</span>
                  </div>
                  <StatusPill status={r.status}/>
                </div>
              </div>
            ))}
          </div>
        ):(
          /* Desktop table */
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{borderBottom:"1px solid #1f2937"}}>
                  {[{l:"TX ID",k:"id"as SortKey},{l:"Timestamp",k:"date"as SortKey},{l:"Type",k:null},{l:"Protocol",k:null},{l:"Amount",k:"amount"as SortKey},{l:"Status",k:null},...(isAdmin?[{l:"User",k:null}]:[]),(isAdmin?{l:"Trend",k:null}:{l:"Trend",k:null}),{l:"",k:null}].map((col,i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:10,color:"#374151",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",background:"#0d0f14",whiteSpace:"nowrap"}}>
                      {col.k?(
                        <button onClick={()=>toggleSort(col.k!)} style={{display:"flex",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer",color:"#374151",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}
                          data-testid={`sort-${col.k}`}>
                          {col.l} {<SortIcon col={col.k}/>}
                        </button>
                      ):col.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(r=>{
                  const sel = selectedId===r.id;
                  const sparkData = userAmountHistory.get(r.owner)??[];
                  const sparkColor = r.status==="Completada"?"#22c55e":r.status==="Rechazada"||r.status==="Declinada"?"#ef4444":"#6b7280";
                  return (
                    <tr key={r.id}
                      style={{borderBottom:"1px solid #111827",background:sel?"#0d1117":"transparent",cursor:"pointer",transition:"background 0.15s"}}
                      onMouseEnter={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background="#0d0f14";}}
                      onMouseLeave={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background="transparent";}}
                      onClick={()=>openTx(r)} data-testid={`row-${r.id}`}>
                      {/* TX ID */}
                      <td style={{padding:"11px 14px"}}>
                        <span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#c8322b",letterSpacing:"0.02em"}}>{r.id}</span>
                      </td>
                      {/* Date */}
                      <td style={{padding:"11px 14px",fontSize:11,color:"#6b7280",whiteSpace:"nowrap"}}>{r.dateLabel}</td>
                      {/* Type */}
                      <td style={{padding:"11px 14px"}}><TypePill type={r.type}/></td>
                      {/* Protocol */}
                      <td style={{padding:"11px 14px",fontFamily:"monospace",fontSize:11,color:"#4b5563"}}>{r.protocol}</td>
                      {/* Amount */}
                      <td style={{padding:"11px 14px",whiteSpace:"nowrap"}}>
                        <span style={{fontWeight:700,fontSize:13,color:"#e5e7eb"}}>${r.amount.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                        <span style={{fontSize:10,color:"#374151",marginLeft:4}}>{r.currency}</span>
                      </td>
                      {/* Status */}
                      <td style={{padding:"11px 14px"}}><StatusPill status={r.status}/></td>
                      {/* User (admin) */}
                      {isAdmin&&<td style={{padding:"11px 14px",fontSize:11,color:"#4b5563",maxWidth:120}}><span style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.owner}</span></td>}
                      {/* Sparkline */}
                      <td style={{padding:"11px 14px"}}>
                        {sparkData.length>=2?<Sparkline values={sparkData} color={sparkColor}/>:<span style={{fontSize:10,color:"#1f2937"}}>—</span>}
                      </td>
                      {/* Action */}
                      <td style={{padding:"11px 14px"}}>
                        <button style={{padding:6,borderRadius:6,background:"none",border:"none",cursor:"pointer",color:sel?"#c8322b":"#374151"}}
                          data-testid={`view-${r.id}`} onClick={e=>{e.stopPropagation();openTx(r);}}>
                          <Eye className="w-3.5 h-3.5"/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Inline detail panel ── */}
        {selectedRow&&(()=>{
          const tx = txMap.get(selectedRow.id);
          const isVerifone = (tx?.toAccount??"").toLowerCase().includes("v660")||(tx?.toAccount??"").toLowerCase().includes("verifone")||(tx?.createdBy??"").toLowerCase().includes("socemro");
          const [copied,setCopied] = [false, (_:boolean)=>{}]; // handled below
          return (
            <DetailPanel key={selectedRow.id} row={selectedRow} tx={tx} isVerifone={isVerifone} onClose={()=>setSelectedId(null)}/>
          );
        })()}

        {/* Pagination */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderTop:"1px solid #1f2937",flexWrap:"wrap",gap:8}}>
          <span style={{fontSize:11,color:"#374151"}}>Pág. {totalPages===0?0:page} / {totalPages} · {filtered.length} registros</span>
          <div style={{display:"flex",gap:4}}>
            {[
              <button key="prev" disabled={page===1} onClick={()=>setPage(p=>p-1)} data-testid="page-prev"
                style={{width:28,height:28,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",background:"#111827",color:page===1?"#1f2937":"#9ca3af",border:"1px solid #1f2937",cursor:page===1?"default":"pointer"}}>
                <ChevronLeft className="w-3.5 h-3.5"/>
              </button>,
              ...Array.from({length:Math.min(totalPages,5)},(_,i)=>i+1).map(p=>(
                <button key={p} onClick={()=>setPage(p)} data-testid={`page-${p}`}
                  style={{width:28,height:28,borderRadius:6,fontSize:11,fontWeight:600,background:page===p?"#c8322b":"#111827",color:page===p?"#fff":"#6b7280",border:`1px solid ${page===p?"#c8322b":"#1f2937"}`,cursor:"pointer"}}>
                  {p}
                </button>
              )),
              <button key="next" disabled={page===totalPages||totalPages===0} onClick={()=>setPage(p=>p+1)} data-testid="page-next"
                style={{width:28,height:28,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",background:"#111827",color:(page===totalPages||totalPages===0)?"#1f2937":"#9ca3af",border:"1px solid #1f2937",cursor:(page===totalPages||totalPages===0)?"default":"pointer"}}>
                <ChevronRight className="w-3.5 h-3.5"/>
              </button>
            ]}
          </div>
        </div>
      </div>

      {receiptTx&&<VisaNetReceiptModal tx={receiptTx} onClose={()=>setReceiptTx(null)}/>}
      {posReceiptTx&&<POSReceiptModal tx={posReceiptTx} onClose={()=>setPosReceiptTx(null)}/>}
    </div>
  );
}

// ── Detail panel as separate component (needs its own useState for copy) ────
function DetailPanel({ row, tx, isVerifone, onClose }: { row:Row; tx:Transaction|undefined; isVerifone:boolean; onClose:()=>void }) {
  const [copied, setCopied] = useState(false);
  function copyId() { navigator.clipboard.writeText(row.id).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),1500); }); }
  return (
    <div style={{ borderTop:"1px solid #1f2937", background:"#080a0e" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 18px 4px" }}>
        <span style={{ fontSize:10, color:"#374151", letterSpacing:"0.1em", textTransform:"uppercase" }}>Transaction Detail</span>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#4b5563" }}><X className="w-3.5 h-3.5"/></button>
      </div>
      <div style={{ padding:"8px 18px 18px", display:"flex", flexWrap:"wrap", gap:24 }}>
        {/* Left: fields */}
        <div style={{ flex:1, minWidth:240 }}>
          {/* TX ID with copy */}
          <div style={{ marginBottom:14 }}>
            <p style={{ fontSize:9, color:"#374151", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>TX ID</p>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:"#e5e7eb" }}>{row.id}</span>
              <button onClick={copyId} style={{ background:"none", border:"none", cursor:"pointer", color: copied?"#22c55e":"#4b5563", transition:"color 0.2s" }}>
                {copied?<CheckCheck className="w-3.5 h-3.5"/>:<Copy className="w-3.5 h-3.5"/>}
              </button>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px 24px" }}>
            {[
              ["Fecha",     row.dateLabel],
              ["Protocolo", row.protocol],
              ["Tarjeta",   row.card],
              ["Auth Code", row.authCode],
              ["Moneda",    row.currency],
              ["Tipo",      row.type],
              ...(row.owner!=="—"?[["Usuario",row.owner]]:[]),
            ].map(([l,v],i)=>(
              <div key={i}>
                <p style={{ fontSize:9, color:"#374151", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:2 }}>{l}</p>
                <p style={{ fontFamily:"monospace", fontSize:11, color:"#9ca3af", fontWeight:600 }}>{v}</p>
              </div>
            ))}
          </div>
          {row.status==="Checking with Banking Host..."&&(
            <div style={{ marginTop:12, background:"#1a0505", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", display:"flex", gap:8 }}>
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p style={{ fontSize:10, fontWeight:700, color:"#ef4444", fontFamily:"monospace" }}>FAILED — Bank Host Maintenance</p>
                <p style={{ fontSize:9, color:"#f87171", fontFamily:"monospace", marginTop:2 }}>GLOBAL SERVER ON MAINTENANCE · Transaction queued</p>
              </div>
            </div>
          )}
        </div>
        {/* Right: terminal visual */}
        {isVerifone&&(
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, borderLeft:"1px solid #1f2937", paddingLeft:24 }}>
            <p style={{ fontSize:9, color:"#374151", letterSpacing:"0.1em", textTransform:"uppercase" }}>Terminal</p>
            <VerifoneV660P size={90}/>
            <div style={{ textAlign:"center" }}>
              <p style={{ fontSize:10, fontWeight:700, color:"#9ca3af", letterSpacing:"0.06em" }}>VERIFONE V660P</p>
              <p style={{ fontSize:9, color:"#374151" }}>S/N: VER-T1011-9607</p>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4, marginTop:4 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e" }} className="animate-pulse"/>
                <span style={{ fontSize:9, color:"#22c55e" }}>ONLINE</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
