import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { Transaction } from "@shared/schema";
import {
  FileText, Search, Download, Filter, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, BarChart2, RefreshCw, X, Inbox, Loader2,
  AlertTriangle, Clock, WifiOff, Shield
} from "lucide-react";

// ── Visa Net Quantum 9.0 Error Receipt ─────────────────────────────────────
function MastercardIcon({ size = 28 }: { size?: number }) {
  const overlap = size * 0.3;
  return (
    <div className="relative flex-shrink-0" style={{ width: size + overlap, height: size }}>
      <div
        className="absolute rounded-full bg-[#EB001B]"
        style={{ width: size, height: size, left: 0, top: 0, opacity: 0.95 }}
      />
      <div
        className="absolute rounded-full bg-[#F79E1B]"
        style={{ width: size, height: size, right: 0, top: 0, opacity: 0.95, mixBlendMode: "multiply" }}
      />
    </div>
  );
}

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-xl overflow-hidden shadow-2xl"
        style={{ fontFamily: "'Courier New', monospace", background: "#fff" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header: Visa Net Quantum 9.0 ── */}
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

        {/* ── POS STATUS bar ── */}
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

        {/* ── Receipt body ── */}
        <div className="px-4 py-3 text-[11px] text-gray-900 space-y-3">
          {/* Store header */}
          <div className="text-center pb-2" style={{ borderBottom: "1px dashed #ccc" }}>
            <p className="font-bold text-sm tracking-widest">BANXICO PLUS</p>
            <p className="text-xs tracking-wider">VENTA FORZADA</p>
            <p style={{ color: "#6b7280", fontSize: "9px" }}>GRUPO ASGE · VENADO 69 · CANCUN Q.ROO</p>
          </div>

          {/* Date + card number */}
          <div className="flex justify-between text-[10px]">
            <span style={{ color: "#374151" }}>{dateStr} {timeStr}</span>
            <span className="font-bold">{cardNum}</span>
          </div>

          {/* Fields */}
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

          {/* Error block */}
          <div
            className="rounded p-3 space-y-1.5"
            style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "#dc2626" }}
              >
                <X className="w-2.5 h-2.5 text-white" />
              </div>
              <p className="font-bold tracking-widest text-[10px]" style={{ color: "#7f1d1d" }}>
                TRANSACCIÓN RECHAZADA
              </p>
            </div>
            <p className="text-[9px] font-bold" style={{ color: "#b91c1c" }}>
              ERROR CODE: ERR_PIN_BANK_HOST
            </p>
            <p
              className="text-[10px] leading-relaxed italic"
              style={{ color: "#991b1b" }}
            >
              "Recheck pin or protocol non authorized connection with the bank host origin sender"
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="px-4 py-2 flex items-center justify-between"
          style={{ background: "#f3f4f6", borderTop: "1px solid #e5e7eb" }}
        >
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

const TYPE_LABEL: Record<string, string> = {
  payment:    "Pago",
  transfer:   "Transferencia",
  deposit:    "Depósito",
  withdrawal: "Retiro",
  exchange:   "Exchange",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Completada",
  pending: "Pendiente",
  failed: "Rechazada",
  processing: "Procesando",
};

const STATUS_COLOR: Record<string, string> = {
  Completada: "bg-green-100 text-green-700",
  Pendiente:  "bg-yellow-100 text-yellow-700",
  Rechazada:  "bg-red-100 text-red-700",
  Procesando: "bg-blue-100 text-blue-700",
};

const TYPE_COLOR: Record<string, string> = {
  Pago:          "bg-purple-100 text-purple-700",
  Transferencia: "bg-blue-100 text-blue-700",
  Depósito:      "bg-green-100 text-green-700",
  Retiro:        "bg-orange-100 text-orange-700",
  Exchange:      "bg-cyan-100 text-cyan-700",
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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

type SortKey = "date" | "amount" | "id";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 8;

export default function RegistrosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "ADMIN";
  const [simRunning, setSimRunning] = useState(false);
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);

  const { data: transactions = [], isLoading, isFetching, refetch } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    refetchInterval: (query) => {
      const txs = query.state.data as Transaction[] | undefined;
      return txs?.some(t => t.status === "pending" || t.status === "processing") ? 2000 : false;
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

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);

  const rows = useMemo(() => transactions.map(toRow), [transactions]);
  const txMap = useMemo(() => new Map(transactions.map(t => [t.transactionId, t])), [transactions]);

  function isVisaNetError(authCode: string) {
    return authCode.includes("ERR_PIN_BANK_HOST");
  }

  function openTx(r: typeof rows[0]) {
    if (isVisaNetError(r.authCode)) {
      const full = txMap.get(r.id);
      if (full) { setReceiptTx(full); return; }
    }
    setSelected(selected?.id === r.id ? null : r);
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
        r.card.toLowerCase().includes(q) || r.protocol.toLowerCase().includes(q) || r.authCode.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || r.status === filterStatus;
      const matchType = filterType === "all" || r.type === filterType;
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalVol = filtered.reduce((s, r) => s + r.amount, 0);
  const completed = filtered.filter(r => r.status === "Completada").length;

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
    a.download = `registros-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-[#c8322b]" /> : <ArrowDown className="w-3 h-3 text-[#c8322b]" />;
  }

  const colCount = isAdmin ? 9 : 8;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="w-7 h-7 text-[#c8322b]" /> Registros
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Historial completo de operaciones del sistema" : "Tu historial de operaciones"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)} data-testid="button-toggle-filters">
            <Filter className="w-4 h-4 mr-1" /> {showFilters ? "Ocultar" : "Filtros"}
          </Button>
          <Button size="sm" className="bg-[#c8322b] hover:bg-[#a62822]" onClick={exportCSV} disabled={filtered.length === 0} data-testid="button-export">
            <Download className="w-4 h-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total registros", value: filtered.length.toString(), color: "text-foreground" },
          { label: "Completadas", value: completed.toString(), color: "text-green-600" },
          { label: "Rechazadas", value: filtered.filter(r => r.status === "Rechazada").length.toString(), color: "text-red-600" },
          { label: "Volumen filtrado", value: `$${totalVol.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-blue-600" },
        ].map((s, i) => (
          <Card key={i} className="hover-elevate">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`} data-testid={`stat-${i}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending / host-disconnect alert banner */}
      {pendingRows.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-amber-900" data-testid="banner-pending">
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            <WifiOff className="w-4 h-4 text-amber-600" />
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {pendingRows.length === 1 ? "1 transacción en espera" : `${pendingRows.length} transacciones en espera`}
            </p>
            <ul className="mt-1 space-y-0.5">
              {pendingRows.map(r => (
                <li key={r.id} className="text-xs flex items-center gap-2">
                  <Clock className="w-3 h-3 flex-shrink-0 text-amber-500" />
                  <span className="font-mono">{r.id}</span>
                  <span className="text-amber-700">${r.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} {r.currency}</span>
                  <Badge className="text-[10px] px-1.5 bg-amber-200 text-amber-800 no-default-active-elevate">{r.status}</Badge>
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-700 mt-1">Actualizando automáticamente — verificando conexión con host bancario...</p>
          </div>
        </div>
      )}

      {/* Admin: inject host-failure simulation */}
      {isAdmin && (
        <div className="flex items-center justify-between rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Simulación de fallo de host bancario — ALUSH CECO · Mastercard ****0074 · $50,000 USD</span>
          </div>
          <Button size="sm" variant="outline" onClick={triggerHostFailureSim} disabled={simRunning} data-testid="button-host-failure-sim">
            {simRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <WifiOff className="w-3.5 h-3.5 mr-1" />}
            {simRunning ? "Inyectando..." : "Simular fallo"}
          </Button>
        </div>
      )}

      {/* Filters panel */}
      {showFilters && (
        <Card className="hover-elevate border-[#c8322b]/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="ID, tipo, protocolo, auth..." className="pl-9" data-testid="input-search" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Estado</label>
                <div className="flex gap-1 flex-wrap">
                  {["all", "Completada", "Pendiente", "Rechazada", "Procesando"].map(s => (
                    <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${filterStatus === s ? "bg-[#c8322b] text-white" : "bg-muted text-muted-foreground"}`}
                      data-testid={`filter-status-${s}`}>
                      {s === "all" ? "Todos" : s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo</label>
                <div className="flex gap-1 flex-wrap">
                  {["all", "Pago", "Transferencia", "Depósito", "Retiro"].map(t => (
                    <button key={t} onClick={() => { setFilterType(t); setPage(1); }}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${filterType === t ? "bg-[#c8322b] text-white" : "bg-muted text-muted-foreground"}`}
                      data-testid={`filter-type-${t}`}>
                      {t === "all" ? "Todos" : t}
                    </button>
                  ))}
                </div>
              </div>
              {(search || filterStatus !== "all" || filterType !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterStatus("all"); setFilterType("all"); setPage(1); }} data-testid="button-clear-filters">
                  <X className="w-3.5 h-3.5 mr-1" /> Limpiar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search (always visible when filters hidden) */}
      {!showFilters && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por ID, tipo, protocolo, auth code..." className="pl-10" data-testid="input-search-inline" />
        </div>
      )}

      {/* Table */}
      <Card className="hover-elevate">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4" /> Historial de Transacciones
              </CardTitle>
              <CardDescription>{filtered.length} registros encontrados</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh">
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground">
                    <button onClick={() => toggleSort("id")} className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid="sort-id">
                      ID <SortIcon col="id" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground">
                    <button onClick={() => toggleSort("date")} className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid="sort-date">
                      Fecha <SortIcon col="date" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground">Tipo</th>
                  <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground">Protocolo</th>
                  <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground">
                    <button onClick={() => toggleSort("amount")} className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid="sort-amount">
                      Monto <SortIcon col="amount" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground">Estado</th>
                  {isAdmin && <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground hidden md:table-cell">Usuario</th>}
                  <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground hidden lg:table-cell">Auth</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={colCount} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#c8322b]" />
                    Cargando transacciones...
                  </td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={colCount} className="py-16 text-center text-muted-foreground" data-testid="empty-state">
                    <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    {rows.length === 0 ? "Aún no tienes transacciones registradas." : "No hay registros que coincidan con los filtros."}
                  </td></tr>
                ) : paginated.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => openTx(r)} data-testid={`row-${r.id}`}>
                    <td className="py-3 px-4 font-mono text-xs font-bold">{r.id}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{r.dateLabel}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${TYPE_COLOR[r.type] || "bg-gray-100 text-gray-700"}`}>{r.type}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">{r.protocol}</td>
                    <td className="py-3 px-4 font-bold whitespace-nowrap">
                      ${r.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">{r.currency}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={`text-xs no-default-active-elevate ${STATUS_COLOR[r.status]}`}>{r.status}</Badge>
                    </td>
                    {isAdmin && <td className="py-3 px-4 text-xs hidden md:table-cell truncate max-w-[160px]">{r.owner}</td>}
                    <td className="py-3 px-4 font-mono text-xs hidden lg:table-cell text-muted-foreground">{r.authCode}</td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="icon" className="w-7 h-7" data-testid={`view-${r.id}`}
                        onClick={(e) => { e.stopPropagation(); openTx(r); }}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail row */}
          {selected && (
            <div className="border-t bg-muted/20 px-4 py-3">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                {[
                  { label: "ID Transacción", value: selected.id },
                  { label: "Fecha", value: selected.dateLabel },
                  { label: "Protocolo", value: selected.protocol },
                  { label: "Tarjeta", value: selected.card },
                  { label: "Auth Code", value: selected.authCode },
                  { label: "Moneda", value: selected.currency },
                  ...(isAdmin ? [{ label: "Usuario", value: selected.owner }] : []),
                ].map((item, i) => (
                  <div key={i}>
                    <span className="text-muted-foreground">{item.label}: </span>
                    <span className="font-mono font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">
              Página {totalPages === 0 ? 0 : page} de {totalPages} · {filtered.length} registros
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="w-7 h-7" disabled={page === 1} onClick={() => setPage(p => p - 1)} data-testid="page-prev">
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 text-xs rounded-md font-medium transition-colors ${page === p ? "bg-[#c8322b] text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  data-testid={`page-${p}`}>
                  {p}
                </button>
              ))}
              <Button variant="outline" size="icon" className="w-7 h-7" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)} data-testid="page-next">
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Visa Net Quantum 9.0 Receipt Modal ── */}
      {receiptTx && (
        <VisaNetReceiptModal tx={receiptTx} onClose={() => setReceiptTx(null)} />
      )}
    </div>
  );
}
