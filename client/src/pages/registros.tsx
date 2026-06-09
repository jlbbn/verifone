import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileText, Search, Download, Filter, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, CheckCircle, XCircle,
  Clock, BarChart2, RefreshCw, X
} from "lucide-react";

interface Registro {
  id: string;
  date: string;
  type: string;
  protocol: string;
  amount: number;
  currency: string;
  status: "Completada" | "Pendiente" | "Rechazada" | "Procesando";
  terminal: string;
  card: string;
  authCode: string;
}

const ALL_RECORDS: Registro[] = [
  { id: "TRX-10245", date: "2026-06-09 11:02", type: "Pago",          protocol: "201.3", amount: 5420,  currency: "USD", status: "Completada",  terminal: "T1001", card: "VISA",       authCode: "AUTH-8821" },
  { id: "TRX-10244", date: "2026-06-09 10:58", type: "Transferencia", protocol: "101.3", amount: 2100,  currency: "USD", status: "Completada",  terminal: "T1004", card: "Mastercard", authCode: "AUTH-4459" },
  { id: "TRX-10243", date: "2026-06-09 10:55", type: "Depósito",      protocol: "301.1", amount: 8900,  currency: "USD", status: "Completada",  terminal: "T1002", card: "Débito",     authCode: "AUTH-7732" },
  { id: "TRX-10242", date: "2026-06-09 10:48", type: "Transferencia", protocol: "101.2", amount: 1250,  currency: "USD", status: "Pendiente",   terminal: "T1005", card: "VISA",       authCode: "—"         },
  { id: "TRX-10241", date: "2026-06-09 10:45", type: "Retiro",        protocol: "401.1", amount: 3400,  currency: "USD", status: "Completada",  terminal: "T1001", card: "VISA",       authCode: "AUTH-3345" },
  { id: "TRX-10240", date: "2026-06-09 10:40", type: "Pago",          protocol: "201.1", amount: 620,   currency: "MXN", status: "Completada",  terminal: "T1004", card: "AMEX",       authCode: "AUTH-9913" },
  { id: "TRX-10239", date: "2026-06-09 10:35", type: "Pago",          protocol: "201.2", amount: 12500, currency: "USD", status: "Rechazada",   terminal: "T1003", card: "Mastercard", authCode: "—"         },
  { id: "TRX-10238", date: "2026-06-09 10:28", type: "Depósito",      protocol: "301.2", amount: 7650,  currency: "USD", status: "Completada",  terminal: "T1002", card: "Débito",     authCode: "AUTH-6678" },
  { id: "TRX-10237", date: "2026-06-09 10:22", type: "Transferencia", protocol: "101.3", amount: 45000, currency: "USD", status: "Completada",  terminal: "T1001", card: "VISA",       authCode: "AUTH-2211" },
  { id: "TRX-10236", date: "2026-06-09 10:15", type: "Pago",          protocol: "201.3", amount: 890,   currency: "MXN", status: "Procesando",  terminal: "T1005", card: "VISA",       authCode: "—"         },
  { id: "TRX-10235", date: "2026-06-09 10:08", type: "Retiro",        protocol: "401.1", amount: 2200,  currency: "USD", status: "Completada",  terminal: "T1004", card: "Mastercard", authCode: "AUTH-5544" },
  { id: "TRX-10234", date: "2026-06-09 10:02", type: "Transferencia", protocol: "101.1", amount: 680,   currency: "USD", status: "Completada",  terminal: "T1001", card: "VISA",       authCode: "AUTH-1122" },
];

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
};

type SortKey = "date" | "amount" | "id";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 8;

export default function RegistrosPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Registro | null>(null);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  }

  const filtered = useMemo(() => {
    let rows = ALL_RECORDS.filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !q || r.id.toLowerCase().includes(q) || r.type.toLowerCase().includes(q) ||
        r.card.toLowerCase().includes(q) || r.terminal.toLowerCase().includes(q) || r.authCode.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || r.status === filterStatus;
      const matchType = filterType === "all" || r.type === filterType;
      return matchSearch && matchStatus && matchType;
    });
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date")   cmp = a.date.localeCompare(b.date);
      if (sortKey === "amount") cmp = a.amount - b.amount;
      if (sortKey === "id")     cmp = a.id.localeCompare(b.id);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [search, filterStatus, filterType, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalVol = filtered.reduce((s, r) => s + r.amount, 0);
  const completed = filtered.filter(r => r.status === "Completada").length;

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-[#c8322b]" /> : <ArrowDown className="w-3 h-3 text-[#c8322b]" />;
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="w-7 h-7 text-[#c8322b]" /> Registros
          </h1>
          <p className="text-sm text-muted-foreground">Historial completo de operaciones del sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)} data-testid="button-toggle-filters">
            <Filter className="w-4 h-4 mr-1" /> {showFilters ? "Ocultar" : "Filtros"}
          </Button>
          <Button size="sm" className="bg-[#c8322b] hover:bg-[#a62822]" data-testid="button-export">
            <Download className="w-4 h-4 mr-1" /> Exportar
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
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card className="hover-elevate border-[#c8322b]/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="ID, tipo, terminal, auth..." className="pl-9" data-testid="input-search" />
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
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por ID, tipo, terminal, auth code..." className="pl-10" data-testid="input-search-inline" />
        </div>
      )}

      {/* Table */}
      <Card className="hover-elevate">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4" /> Historial de Transacciones
              </CardTitle>
              <CardDescription>{filtered.length} registros encontrados</CardDescription>
            </div>
            <Button variant="ghost" size="icon" data-testid="button-refresh"><RefreshCw className="w-4 h-4" /></Button>
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
                  <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground hidden md:table-cell">Terminal</th>
                  <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground hidden lg:table-cell">Auth</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setSelected(selected?.id === r.id ? null : r)} data-testid={`row-${r.id}`}>
                    <td className="py-3 px-4 font-mono text-xs font-bold">{r.id}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{r.date}</td>
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
                    <td className="py-3 px-4 text-xs hidden md:table-cell">{r.terminal} <span className="text-muted-foreground">· {r.card}</span></td>
                    <td className="py-3 px-4 font-mono text-xs hidden lg:table-cell text-muted-foreground">{r.authCode}</td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="icon" className="w-7 h-7" data-testid={`view-${r.id}`}>
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
                  { label: "Fecha", value: selected.date },
                  { label: "Protocolo", value: selected.protocol },
                  { label: "Tarjeta", value: selected.card },
                  { label: "Terminal", value: selected.terminal },
                  { label: "Auth Code", value: selected.authCode },
                  { label: "Moneda", value: selected.currency },
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
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">
              Página {page} de {totalPages} · {filtered.length} registros
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
    </div>
  );
}
