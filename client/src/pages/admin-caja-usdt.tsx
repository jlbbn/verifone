import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Wallet,
  Copy,
  Check,
  CheckCircle,
  Clock,
  Users,
  TrendingUp,
  DollarSign,
  Shield,
  RefreshCw,
  CalendarDays,
  Info,
  Zap,
  AlertCircle,
  Send,
  ExternalLink,
  Lock,
  XCircle,
  Loader2,
  ArrowDownUp,
  Network,
  Building2,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const WALLET_ADDRESS = "0x5293790F2C49A1B11B3d3b2AcB8583946B20f735";
const WALLET_NETWORK = "ETHEREUM (ERC20)";
const WALLET_TOKEN   = "USDT";
const WALLET_BALANCE = 24221.00;
const SUBSCRIPTION_PRICE = 750;

/* ── Lista de 14 usuarios (emails censurados) ─────────────────────────── */
const userList = [
  { id: 2,  email: "ang***@gmail.com",        date: "15 Ene 2025", status: "complete", paid: 750, remaining: 0,   renewals: 3 },
  { id: 3,  email: "soc***@gmail.com",        date: "01 Feb 2025", status: "complete", paid: 750, remaining: 0,   renewals: 3 },
  { id: 4,  email: "cor***@gmail.com",        date: "14 Feb 2025", status: "complete", paid: 750, remaining: 0,   renewals: 3 },
  { id: 5,  email: "car***@outlook.com",      date: "01 Mar 2025", status: "complete", paid: 750, remaining: 0,   renewals: 3 },
  { id: 6,  email: "lui***@gmail.com",        date: "12 Mar 2025", status: "complete", paid: 750, remaining: 0,   renewals: 3 },
  { id: 7,  email: "mar***@yahoo.com",        date: "05 Abr 2025", status: "complete", paid: 750, remaining: 0,   renewals: 3 },
  { id: 8,  email: "fer***@gmail.com",        date: "20 Abr 2025", status: "complete", paid: 750, remaining: 0,   renewals: 3 },
  { id: 9,  email: "and***@hotmail.com",      date: "02 May 2025", status: "complete", paid: 750, remaining: 0,   renewals: 3 },
  { id: 10, email: "pat***@gmail.com",        date: "14 May 2025", status: "partial",  paid: 499, remaining: 251, renewals: 1 },
  { id: 11, email: "arq***@hotmail.com",      date: "20 May 2025", status: "complete", paid: 750, remaining: 0,   renewals: 3 },
  { id: 12, email: "ale***@gmail.com",        date: "08 Jun 2025", status: "complete", paid: 750, remaining: 0,   renewals: 1 },
  { id: 13, email: "jor***@outlook.com",      date: "19 Jul 2025", status: "complete", paid: 750, remaining: 0,   renewals: 1 },
  { id: 14, email: "san***@gmail.com",        date: "03 Sep 2025", status: "complete", paid: 750, remaining: 0,   renewals: 1 },
  { id: 15, email: "ric***@gmail.com",        date: "17 Nov 2025", status: "complete", paid: 750, remaining: 0,   renewals: 1 },
];

/* ── Los 9 con 3 renovaciones consecutivas ────────────────────────────── */
const topRenewers = userList.filter(u => u.renewals === 3);

/* ── Historial de renovaciones por año ───────────────────────────────── */
const renewalHistory: Record<number, { year: number; amount: number; date: string }[]> = {
  2:  [{ year: 2023, amount: 750, date: "18 Ene 2023" }, { year: 2024, amount: 750, date: "17 Ene 2024" }, { year: 2025, amount: 750, date: "15 Ene 2025" }],
  3:  [{ year: 2023, amount: 750, date: "03 Feb 2023" }, { year: 2024, amount: 750, date: "02 Feb 2024" }, { year: 2025, amount: 750, date: "01 Feb 2025" }],
  4:  [{ year: 2023, amount: 750, date: "16 Feb 2023" }, { year: 2024, amount: 750, date: "15 Feb 2024" }, { year: 2025, amount: 750, date: "14 Feb 2025" }],
  5:  [{ year: 2023, amount: 750, date: "03 Mar 2023" }, { year: 2024, amount: 750, date: "02 Mar 2024" }, { year: 2025, amount: 750, date: "01 Mar 2025" }],
  6:  [{ year: 2023, amount: 750, date: "14 Mar 2023" }, { year: 2024, amount: 750, date: "13 Mar 2024" }, { year: 2025, amount: 750, date: "12 Mar 2025" }],
  7:  [{ year: 2023, amount: 750, date: "07 Abr 2023" }, { year: 2024, amount: 750, date: "06 Abr 2024" }, { year: 2025, amount: 750, date: "05 Abr 2025" }],
  8:  [{ year: 2023, amount: 750, date: "22 Abr 2023" }, { year: 2024, amount: 750, date: "21 Abr 2024" }, { year: 2025, amount: 750, date: "20 Abr 2025" }],
  9:  [{ year: 2023, amount: 750, date: "05 May 2023" }, { year: 2024, amount: 750, date: "04 May 2024" }, { year: 2025, amount: 750, date: "02 May 2025" }],
  11: [{ year: 2023, amount: 750, date: "22 May 2023" }, { year: 2024, amount: 750, date: "21 May 2024" }, { year: 2025, amount: 750, date: "20 May 2025" }],
};

/* ── Datos para la gráfica de pastel ─────────────────────────────────── */
const pieData = [
  { name: "3 Renovaciones (9)",       value: 9 * 750 * 3, users: 9,  color: "#c8322b" },
  { name: "Año activo · 1 ciclo (4)", value: 4 * 750,     users: 4,  color: "#2563eb" },
  { name: "Pago parcial (1)",         value: 499,         users: 1,  color: "#f59e0b" },
];

/* ── Utilidades ───────────────────────────────────────────────────────── */
const totalRecaudado    = userList.reduce((s, u) => s + u.paid, 0);
const totalPendiente    = userList.reduce((s, u) => s + u.remaining, 0);
const usuariosCompletos = userList.filter(u => u.status === "complete").length;
const usuariosParciales = userList.filter(u => u.status === "partial").length;

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function RenewalDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0 ${
        active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
      }`}
    >
      {active ? "✓" : "–"}
    </span>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-md shadow-sm px-3 py-2 text-xs">
      <p className="font-semibold mb-0.5">{d.name}</p>
      <p className="text-muted-foreground">Usuarios: <strong className="text-foreground">{d.users}</strong></p>
      <p className="text-muted-foreground">Monto: <strong className="text-foreground">${fmt(d.value)} USDT</strong></p>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Dispersion {
  id:         number;
  toAddress:  string;
  amountUsdt: string;
  txid:       string | null;
  status:     string;
  note:       string | null;
  createdAt:  string;
}

// ── Dispersal Widget ──────────────────────────────────────────────────────────

function DisperseWidget() {
  const [toAddress,  setToAddress]  = useState("");
  const [amount,     setAmount]     = useState("");
  const [note,       setNote]       = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [password,   setPassword]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [lastTxid,   setLastTxid]   = useState<string | null>(null);
  const [history,    setHistory]    = useState<Dispersion[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [maxUsdt,    setMaxUsdt]    = useState<number>(5000);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/admin/hot-wallet/dispersions");
      if (res.ok) setHistory(await res.json());
    } finally {
      setHistLoading(false);
    }
  };

  const fetchLimit = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const s = await res.json();
        if (s.maxDispersalUsdt) setMaxUsdt(Number(s.maxDispersalUsdt));
      }
    } catch { /* use default */ }
  };

  useEffect(() => { fetchHistory(); fetchLimit(); }, []);

  function openConfirm() {
    setError(null);
    const amt = parseFloat(amount);
    if (!toAddress.match(/^T[a-zA-Z0-9]{33}$/)) {
      setError("Dirección TRON inválida (debe empezar con T y tener 34 caracteres)");
      return;
    }
    if (!amt || amt <= 0) { setError("Monto inválido"); return; }
    if (amt > maxUsdt) {
      setError(`El monto excede el límite máximo por operación: $${fmt(maxUsdt)} USDT`);
      return;
    }
    setPassword("");
    setShowDialog(true);
  }

  async function executeDisperse() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/hot-wallet/disperse", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAddress,
          amountUsdt: parseFloat(amount),
          password,
          note: note || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error en dispersión");
      setLastTxid(json.txid);
      setShowDialog(false);
      setToAddress(""); setAmount(""); setNote("");
      fetchHistory();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function statusBadge(status: string) {
    if (status === "confirmed") return (
      <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 no-default-active-elevate gap-1">
        <CheckCircle className="w-2.5 h-2.5" />Confirmado
      </Badge>
    );
    if (status === "failed") return (
      <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200 no-default-active-elevate gap-1">
        <XCircle className="w-2.5 h-2.5" />Fallido
      </Badge>
    );
    return (
      <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200 no-default-active-elevate gap-1">
        <Clock className="w-2.5 h-2.5" />Pendiente
      </Badge>
    );
  }

  return (
    <>
      {/* Confirm dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#c8322b]" />
              Confirmar dispersión
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 space-y-1">
              <p className="text-xs text-amber-800 font-semibold">Resumen de la operación</p>
              <p className="text-xs text-amber-700">
                <span className="font-mono break-all">{toAddress}</span>
              </p>
              <p className="text-lg font-bold text-amber-900">${parseFloat(amount || "0").toFixed(2)} USDT</p>
              {note && <p className="text-[11px] text-amber-600 italic">{note}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contraseña de administrador</Label>
              <Input
                type="password"
                placeholder="Tu contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !loading && executeDisperse()}
                autoFocus
              />
            </div>
            {error && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />{error}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDialog(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-[#c8322b] hover:bg-[#a82820] text-white"
              onClick={executeDisperse}
              disabled={loading || !password}
            >
              {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Enviando…</> : <><Send className="w-3.5 h-3.5 mr-1.5" />Firmar y enviar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-[#c8322b]/20 bg-red-50/20">
        <CardContent className="px-5 py-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-[#c8322b]" />
            <span className="text-sm font-semibold">Dispersar USDT</span>
            <Badge variant="outline" className="text-[10px] ml-auto no-default-active-elevate">TRC-20 · On-chain</Badge>
          </div>

          {/* Success banner */}
          {lastTxid && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-green-50 border border-green-200">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-green-700">¡Dispersión enviada exitosamente!</p>
                <p className="text-[11px] text-green-600 font-mono break-all mt-0.5">{lastTxid}</p>
                <a
                  href={`https://tronscan.org/#/transaction/${lastTxid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-green-700 underline mt-1"
                >
                  Ver en TronScan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dirección TRON destino</Label>
              <Input
                placeholder="T… (dirección TRC-20)"
                value={toAddress}
                onChange={e => setToAddress(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Monto (USDT)</Label>
                  <span className="text-[10px] text-muted-foreground">
                    Máx: <span className="font-semibold text-foreground">${fmt(maxUsdt)}</span>
                  </span>
                </div>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={maxUsdt}
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className={parseFloat(amount) > maxUsdt ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {parseFloat(amount) > maxUsdt && (
                  <p className="text-[10px] text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />Supera el límite configurado
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nota (opcional)</Label>
                <Input
                  placeholder="Concepto…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
            </div>
            {error && !showDialog && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />{error}
              </p>
            )}
            <Button
              onClick={openConfirm}
              className="bg-[#c8322b] hover:bg-[#a82820] text-white w-full sm:w-auto self-end"
              size="sm"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Revisar y enviar
            </Button>
          </div>

          {/* History */}
          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Historial de dispersiones</p>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={fetchHistory}>
                <RefreshCw className="w-3 h-3 mr-1" />Actualizar
              </Button>
            </div>

            {histLoading ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-12 bg-muted/40 rounded animate-pulse" />)}
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Sin dispersiones registradas</p>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
                {history.map(d => (
                  <div key={d.id} className="px-3 py-2.5 bg-background hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#c8322b]">
                            ${parseFloat(d.amountUsdt).toFixed(2)} USDT
                          </span>
                          {statusBadge(d.status)}
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">{d.toAddress}</p>
                        {d.txid && (
                          <a
                            href={`https://tronscan.org/#/transaction/${d.txid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-0.5"
                          >
                            <span className="font-mono truncate max-w-[180px]">{d.txid.slice(0, 16)}…</span>
                            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                          </a>
                        )}
                        {d.note && <p className="text-[11px] text-muted-foreground italic mt-0.5">{d.note}</p>}
                      </div>
                      <p className="text-[10px] text-muted-foreground flex-shrink-0">
                        {new Date(d.createdAt).toLocaleString("es-MX")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

interface HotWalletData {
  address:     string;
  usdtBalance: number;
  trxBalance:  number;
  network:     string;
  token:       string;
  fetchedAt:   string;
}

function HotWalletWidget() {
  const [data, setData]       = useState<HotWalletData | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedHW, setCopiedHW] = useState(false);

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/hot-wallet/balance");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al obtener saldo");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    const timer = setInterval(fetchBalance, 60_000);
    return () => clearInterval(timer);
  }, [fetchBalance]);

  function copyHWAddress() {
    if (data?.address) {
      navigator.clipboard.writeText(data.address);
      setCopiedHW(true);
      setTimeout(() => setCopiedHW(false), 2000);
    }
  }

  return (
    <Card className="border-green-200 bg-green-50/40">
      <CardContent className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold">Hot Wallet de Dispersión</span>
            <Badge variant="outline" className="text-[10px] border-green-400 text-green-700 bg-green-50">
              TRON TRC-20
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={fetchBalance}
            disabled={loading}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Consultando…" : "Actualizar"}
          </Button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700">Error al consultar blockchain</p>
              <p className="text-[11px] text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Balance principal */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Saldo USDT</p>
                {loading ? (
                  <div className="h-8 w-32 bg-muted/50 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold text-green-700">
                    ${data ? fmt(data.usdtBalance) : "—"}
                    <span className="text-sm font-normal text-muted-foreground ml-1">USDT</span>
                  </p>
                )}
              </div>
              <div className="flex-1 min-w-[120px]">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">TRX (gas)</p>
                {loading ? (
                  <div className="h-5 w-20 bg-muted/50 rounded animate-pulse" />
                ) : (
                  <p className="text-sm font-semibold text-foreground">
                    {data ? data.trxBalance.toFixed(4) : "—"} TRX
                  </p>
                )}
              </div>
            </div>

            {/* Dirección */}
            {data && (
              <div className="bg-muted/30 rounded-md px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Dirección de la hot wallet</p>
                    <p className="text-xs font-mono break-all text-foreground">{data.address}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={copyHWAddress}
                  >
                    {copiedHW ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Meta */}
            {data && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>Red: {data.network} · Token: {data.token}</span>
                <span className="ml-auto">
                  Actualizado: {new Date(data.fetchedAt).toLocaleTimeString("es-MX")}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Broker Ops Panel ──────────────────────────────────────────────────────────

const OKX_NETWORKS = [
  { chain: "USDT-TRC20",   label: "TRON (TRC-20)",   fee: "2.2",  minWd: "2"  },
  { chain: "USDT-ERC20",   label: "Ethereum (ERC-20)",fee: "0.081",minWd: "2"  },
  { chain: "USDT-BSC",     label: "BNB Chain (BEP-20)",fee:"0.8", minWd: "5"  },
  { chain: "USDT-Solana",  label: "Solana (SPL)",     fee: "1",    minWd: "2"  },
  { chain: "USDT-Polygon", label: "Polygon (PoS)",    fee: "1",    minWd: "2"  },
];

function BrokerOpsPanel() {
  const { toast } = useToast();

  // Balances
  const { data: balances, refetch: refetchBal, isFetching: loadingBal } = useQuery<{
    trading: { ccy: string; avail: string; frozen: string }[];
    funding: { ccy: string; avail: string; frozen: string }[];
  }>({
    queryKey: ["/api/broker/balances"],
    refetchInterval: 30_000,
  });

  // Broker status
  const { data: brokers, isFetching: loadingBrokers } = useQuery<any[]>({
    queryKey: ["/api/broker-status"],
    refetchInterval: 60_000,
  });

  // ── Send to network (withdraw) ────────────────────────────────────────────
  const [wdAddr, setWdAddr]     = useState("");
  const [wdAmt, setWdAmt]       = useState("");
  const [wdChain, setWdChain]   = useState(OKX_NETWORKS[0].chain);
  const [wdConfirm, setWdConfirm] = useState(false);

  const selectedNet = OKX_NETWORKS.find(n => n.chain === wdChain) ?? OKX_NETWORKS[0];

  const withdrawMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/broker/withdraw", {
      ccy: "USDT", amt: wdAmt, toAddr: wdAddr, chain: wdChain, fee: selectedNet.fee,
    }),
    onSuccess: (data: any) => {
      toast({ title: "✅ Retiro enviado", description: `ID: ${data.wdId ?? "—"} · ${wdAmt} USDT vía ${selectedNet.label}` });
      setWdAddr(""); setWdAmt(""); setWdConfirm(false);
      refetchBal();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error retiro", description: e.message }),
  });

  // ── Internal transfer (Trading ↔ Funding) ────────────────────────────────
  const [trAmt, setTrAmt]         = useState("");
  const [trDir, setTrDir]         = useState<"trading_to_funding" | "funding_to_trading">("trading_to_funding");

  const transferMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/broker/transfer", {
      ccy: "USDT", amt: trAmt, direction: trDir,
    }),
    onSuccess: (data: any) => {
      toast({ title: "✅ Transferencia completada", description: `${trAmt} USDT · ID: ${data.transId ?? "—"}` });
      setTrAmt(""); refetchBal();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error transferencia", description: e.message }),
  });

  const okxBroker = brokers?.find((b: any) => b.id === "okx");
  const tradingUsdt = balances?.trading?.find(b => b.ccy === "USDT");
  const fundingUsdt = balances?.funding?.find(b => b.ccy === "USDT");

  return (
    <Card>
      <CardContent className="px-5 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#c8322b]" />
            <span className="text-sm font-semibold">OKX Broker Operations</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => refetchBal()} disabled={loadingBal}
            className="h-7 gap-1 text-xs">
            <RefreshCw className={`w-3 h-3 ${loadingBal ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {/* Broker status + balances */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* OKX ping status */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Estado OKX</p>
            {loadingBrokers ? (
              <div className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /><span className="text-xs">Verificando…</span></div>
            ) : okxBroker ? (
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${okxBroker.pingStatus === "online" ? "bg-green-500" : okxBroker.pingStatus === "restricted" ? "bg-yellow-500" : "bg-red-500"}`} />
                <span className="text-xs font-medium capitalize">{okxBroker.pingStatus}</span>
                {okxBroker.latencyMs && <span className="text-[10px] text-muted-foreground ml-auto">{okxBroker.latencyMs}ms</span>}
              </div>
            ) : <span className="text-xs text-muted-foreground">—</span>}
            <p className="text-[10px] text-muted-foreground">Prioridad {okxBroker?.priority ?? "—"} · Activo</p>
          </div>

          {/* Trading balance */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Trading Account</p>
            <p className="text-base font-bold font-mono">
              {loadingBal ? "—" : `${parseFloat(tradingUsdt?.avail ?? "0").toFixed(4)}`}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">USDT</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Para órdenes / swaps</p>
          </div>

          {/* Funding balance */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Funding Wallet</p>
            <p className="text-base font-bold font-mono">
              {loadingBal ? "—" : `${parseFloat(fundingUsdt?.avail ?? "0").toFixed(4)}`}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">USDT</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Para retiros / depósitos</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="withdraw">
          <TabsList className="w-full h-8">
            <TabsTrigger value="withdraw" className="flex-1 text-xs gap-1.5">
              <Network className="w-3 h-3" />Enviar a red
            </TabsTrigger>
            <TabsTrigger value="transfer" className="flex-1 text-xs gap-1.5">
              <ArrowDownUp className="w-3 h-3" />Transferencia interna
            </TabsTrigger>
          </TabsList>

          {/* ── Send to network ── */}
          <TabsContent value="withdraw" className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Red de destino</Label>
              <Select value={wdChain} onValueChange={setWdChain}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OKX_NETWORKS.map(n => (
                    <SelectItem key={n.chain} value={n.chain} className="text-xs">
                      {n.label} — fee {n.fee} USDT · mín {n.minWd} USDT
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Dirección destino</Label>
              <Input
                placeholder="Pega la dirección del wallet receptor"
                value={wdAddr}
                onChange={e => setWdAddr(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Monto USDT</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder={`Mín ${selectedNet.minWd} USDT`}
                  value={wdAmt}
                  onChange={e => setWdAmt(e.target.value)}
                  className="h-8 text-xs pr-12"
                />
                <span className="absolute right-3 top-1.5 text-[10px] text-muted-foreground">USDT</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Comisión de red: {selectedNet.fee} USDT · Recibirá: {wdAmt && parseFloat(wdAmt) > 0 ? Math.max(0, parseFloat(wdAmt) - parseFloat(selectedNet.fee)).toFixed(4) : "—"} USDT
              </p>
            </div>

            {!wdConfirm ? (
              <Button
                size="sm" className="w-full h-8 text-xs gap-1.5"
                disabled={!wdAddr.trim() || !wdAmt || parseFloat(wdAmt) < parseFloat(selectedNet.minWd)}
                onClick={() => setWdConfirm(true)}
              >
                <Send className="w-3.5 h-3.5" />
                Continuar retiro
              </Button>
            ) : (
              <div className="space-y-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs font-semibold text-yellow-800 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  ¿Confirmar retiro irreversible?
                </p>
                <p className="text-[11px] text-yellow-700">
                  <strong>{wdAmt} USDT</strong> vía <strong>{selectedNet.label}</strong><br />
                  → <span className="font-mono break-all">{wdAddr}</span>
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setWdConfirm(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" className="flex-1 h-7 text-xs bg-[#c8322b] hover:bg-[#b02a24] gap-1"
                    disabled={withdrawMut.isPending}
                    onClick={() => withdrawMut.mutate()}>
                    {withdrawMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Enviar
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Internal transfer ── */}
          <TabsContent value="transfer" className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Dirección</Label>
              <Select value={trDir} onValueChange={v => setTrDir(v as typeof trDir)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trading_to_funding" className="text-xs">
                    Trading Account → Funding Wallet
                  </SelectItem>
                  <SelectItem value="funding_to_trading" className="text-xs">
                    Funding Wallet → Trading Account
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {trDir === "trading_to_funding"
                  ? "Mueve fondos del cuenta trading (swaps) a funding (retiros)"
                  : "Mueve fondos de funding (depósitos) a trading (swaps)"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Monto USDT</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={trAmt}
                  onChange={e => setTrAmt(e.target.value)}
                  className="h-8 text-xs pr-12"
                />
                <span className="absolute right-3 top-1.5 text-[10px] text-muted-foreground">USDT</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span>Disponible en {trDir === "trading_to_funding" ? "Trading" : "Funding"}:</span>
                <span className="font-mono font-medium">
                  {trDir === "trading_to_funding"
                    ? parseFloat(tradingUsdt?.avail ?? "0").toFixed(4)
                    : parseFloat(fundingUsdt?.avail ?? "0").toFixed(4)} USDT
                </span>
              </div>
            </div>

            {/* Visual flow */}
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md text-[10px] text-muted-foreground">
              <span className={`font-medium ${trDir === "trading_to_funding" ? "text-foreground" : ""}`}>
                Trading
              </span>
              <ArrowRight className="w-3 h-3 flex-shrink-0" />
              <span className={`font-medium ${trDir === "funding_to_trading" ? "text-foreground" : ""}`}>
                Funding
              </span>
              <span className="ml-auto text-[10px]">Sin comisión · instantáneo</span>
            </div>

            <Button
              size="sm" className="w-full h-8 text-xs gap-1.5"
              disabled={!trAmt || parseFloat(trAmt) <= 0 || transferMut.isPending}
              onClick={() => transferMut.mutate()}
            >
              {transferMut.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <ArrowDownUp className="w-3.5 h-3.5" />}
              Transferir {trAmt ? `${trAmt} USDT` : ""}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function AdminCajaUSDT() {
  const [copied, setCopied] = useState(false);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  function copyAddress() {
    navigator.clipboard.writeText(WALLET_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleUser(id: number) {
    setExpandedUser(prev => prev === id ? null : id);
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-20 space-y-5">

      {/* ── Encabezado ── */}
      <div>
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[#c8322b]" />
          <h1 className="text-xl font-bold">Caja USDT — Acumulado Global</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Recaudación de suscripciones Banxico Plus · Enero 2023 – Junio 2026 · Pago anual único
        </p>
      </div>

      {/* ── Hot Wallet de dispersión USDT ── */}
      <HotWalletWidget />

      {/* ── Dispersar USDT ── */}
      <DisperseWidget />

      {/* ── Broker OKX — envío a red + transferencia interna ── */}
      <BrokerOpsPanel />

      {/* ── Nota pago anual ── */}
      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="flex items-start gap-3 py-3 px-4">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900">Suscripción anual — sin pagos mensuales</p>
            <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
              El precio de la licencia Banxico Plus es de <strong>${SUBSCRIPTION_PRICE}.00 USD por año</strong>, pagado en
              una sola exhibición al inicio de cada ciclo. No se aceptan pagos parciales por mes.
              Vigencia: 12 meses corridos desde la fecha de activación. Renovación automática disponible
              al vencimiento de cada ciclo anual.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Wallet ── */}
      <Card>
        <CardContent className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#c8322b]" />
              <span className="text-sm font-semibold">Wallet de Cobro</span>
            </div>
            <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 no-default-active-elevate">
              {WALLET_TOKEN} · {WALLET_NETWORK}
            </Badge>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-md">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground mb-0.5">Dirección del contrato</p>
              <p className="text-xs font-mono break-all">{WALLET_ADDRESS}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={copyAddress} data-testid="button-copy-wallet">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="px-4 py-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-[#c8322b]" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Saldo USDT</span>
            </div>
            <p className="text-xl font-bold" data-testid="text-wallet-balance">${fmt(WALLET_BALANCE)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{WALLET_TOKEN} acumulado</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-4 py-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-600" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Recaudado</span>
            </div>
            <p className="text-xl font-bold" data-testid="text-total-recaudado">${fmt(totalRecaudado)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Lista activa</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-4 py-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Usuarios</span>
            </div>
            <p className="text-xl font-bold" data-testid="text-total-users">{userList.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{usuariosCompletos} completos · {usuariosParciales} parcial</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-4 py-4">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Renovadores</span>
            </div>
            <p className="text-xl font-bold" data-testid="text-renewers">{topRenewers.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">3 ciclos consecutivos</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Gráfica de pastel + leyenda ── */}
      <Card>
        <CardContent className="px-5 py-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#c8322b]" />
            <span className="text-sm font-semibold">Distribución de Suscripciones</span>
            <Badge variant="outline" className="text-[10px] ml-auto no-default-active-elevate">Por ciclos de renovación</Badge>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-full md:w-64 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 space-y-2 w-full">
              {pieData.map((d) => {
                const pct = Math.round((d.value / pieData.reduce((s, x) => s + x.value, 0)) * 100);
                return (
                  <div key={d.name} className="flex items-center gap-3 p-3 rounded-md bg-muted/30">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight">{d.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        ${fmt(d.value)} USDT · {pct}% del total
                      </p>
                    </div>
                    <span className="text-xs font-bold tabular-nums" style={{ color: d.color }}>
                      {d.users} usr
                    </span>
                  </div>
                );
              })}

              <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground font-semibold">Total en lista activa</span>
                <span className="text-sm font-bold text-[#c8322b]">${fmt(totalRecaudado)} USDT</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabla de renovaciones (Top 8) ── */}
      <Card>
        <CardContent className="px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#c8322b]" />
              <span className="text-sm font-semibold">Top 8 — Renovaciones Consecutivas</span>
            </div>
            <Badge className="text-[10px] bg-purple-100 text-purple-800 border-purple-200 no-default-active-elevate">
              3 ciclos · 2023 / 2024 / 2025
            </Badge>
          </div>

          <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 rounded-md mb-1">
            <div className="col-span-4 text-[10px] font-semibold text-muted-foreground uppercase">Usuario</div>
            <div className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase text-center">2023</div>
            <div className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase text-center">2024</div>
            <div className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase text-center">2025</div>
            <div className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase text-right">Total</div>
          </div>

          <div className="divide-y divide-border">
            {topRenewers.map((u) => {
              const hist = renewalHistory[u.id] ?? [];
              const isOpen = expandedUser === u.id;
              return (
                <div key={u.id}>
                  <button
                    className="w-full text-left"
                    onClick={() => toggleUser(u.id)}
                    data-testid={`row-renewer-${u.id}`}
                  >
                    <div className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 hover-elevate rounded-sm">
                      <div className="col-span-6 md:col-span-4 min-w-0">
                        <p className="text-xs font-mono font-medium truncate">{u.email}</p>
                        <p className="text-[10px] text-muted-foreground md:hidden mt-0.5">3 renovaciones · ${fmt(u.paid * 3)} total</p>
                      </div>
                      <div className="hidden md:flex col-span-2 justify-center">
                        <RenewalDot active />
                      </div>
                      <div className="hidden md:flex col-span-2 justify-center">
                        <RenewalDot active />
                      </div>
                      <div className="hidden md:flex col-span-2 justify-center">
                        <RenewalDot active />
                      </div>
                      <div className="col-span-6 md:col-span-2 flex justify-end items-center gap-2">
                        <span className="text-xs font-bold text-[#c8322b]">${fmt(SUBSCRIPTION_PRICE * 3)}</span>
                        <Badge className="text-[10px] bg-purple-100 text-purple-800 border-purple-200 no-default-active-elevate hidden md:inline-flex">
                          3×
                        </Badge>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mx-3 mb-2 rounded-md border border-border bg-muted/20 overflow-hidden">
                      <div className="px-4 py-2 bg-muted/40 border-b border-border">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Historial de renovaciones · {u.email}
                        </p>
                      </div>
                      {hist.map((h) => (
                        <div key={h.year} className="flex items-center justify-between px-4 py-2 border-b last:border-0 border-border">
                          <div className="flex items-center gap-3">
                            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                            <div>
                              <p className="text-xs font-semibold">Ciclo {h.year}</p>
                              <p className="text-[10px] text-muted-foreground">Pago recibido: {h.date} · Vigencia: 12 meses</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-green-700">${fmt(h.amount)} USDT</p>
                            <Badge className="text-[9px] bg-green-100 text-green-700 border-green-200 no-default-active-elevate mt-0.5">
                              Pagado
                            </Badge>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                        <span className="text-[11px] font-bold text-muted-foreground">Total acumulado (3 años)</span>
                        <span className="text-sm font-bold text-[#c8322b]">${fmt(SUBSCRIPTION_PRICE * 3)} USDT</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between px-3">
            <span className="text-xs font-bold text-muted-foreground">Total Top 8 (3 años × $750)</span>
            <span className="text-sm font-bold text-[#c8322b]">${fmt(8 * SUBSCRIPTION_PRICE * 3)} USDT</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Lista completa de 14 usuarios ── */}
      <Card>
        <CardContent className="px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#c8322b]" />
              <span className="text-sm font-semibold">Todos los Suscriptores</span>
            </div>
            <Badge variant="outline" className="text-[10px] no-default-active-elevate">
              ${SUBSCRIPTION_PRICE} USD / año
            </Badge>
          </div>

          {/* Banner resumen pagos */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-green-50 border border-green-200 mb-3">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-xs text-green-800 leading-relaxed">
              <strong>13 de 14 suscriptores</strong> han liquidado la suscripción anual completa
              de <strong>${SUBSCRIPTION_PRICE} USD</strong>. Solo 1 usuario con saldo pendiente.
            </p>
          </div>

          <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 rounded-md mb-1">
            <div className="col-span-1 text-[10px] font-semibold text-muted-foreground uppercase">#</div>
            <div className="col-span-4 text-[10px] font-semibold text-muted-foreground uppercase">Usuario</div>
            <div className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase">Inicio</div>
            <div className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase">Ciclos</div>
            <div className="col-span-1 text-[10px] font-semibold text-muted-foreground uppercase text-right">Pagado</div>
            <div className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase text-right">Estado</div>
          </div>

          <div className="divide-y divide-border">
            {userList.map((u) => {
              const isPatricio = u.id === 10;
              const pct = Math.round((u.paid / SUBSCRIPTION_PRICE) * 100);
              return (
                <div
                  key={u.id}
                  className={`px-3 py-2.5 ${isPatricio ? "bg-amber-50/80 rounded-md border border-amber-200 my-0.5" : ""}`}
                  data-testid={`row-user-${u.id}`}
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1 text-xs text-muted-foreground font-mono">
                      {String(u.id).padStart(2, "0")}
                    </div>
                    <div className="col-span-6 md:col-span-4 min-w-0">
                      <p className="text-xs font-mono font-medium truncate" data-testid={`text-email-${u.id}`}>
                        {u.email}
                      </p>
                      {isPatricio && (
                        <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
                          Patricio Arroyo — saldo pendiente
                        </p>
                      )}
                    </div>
                    <div className="hidden md:block col-span-2">
                      <p className="text-[11px] text-muted-foreground">{u.date}</p>
                    </div>
                    <div className="hidden md:flex col-span-2 items-center gap-1">
                      {u.renewals === 3 ? (
                        <Badge className="text-[10px] bg-purple-100 text-purple-800 border-purple-200 no-default-active-elevate">
                          3 ciclos
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] no-default-active-elevate">1 ciclo</Badge>
                      )}
                    </div>
                    <div className="col-span-3 md:col-span-1 text-right">
                      <p className={`text-xs font-bold ${isPatricio ? "text-amber-700" : ""}`}>
                        ${fmt(u.paid)}
                      </p>
                      {u.remaining > 0 && (
                        <p className="text-[10px] text-amber-600 font-semibold">
                          −${fmt(u.remaining)} pend.
                        </p>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {u.status === "complete" ? (
                        <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 no-default-active-elevate gap-1">
                          <CheckCircle className="w-2.5 h-2.5" />Pagado
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200 no-default-active-elevate gap-1">
                          <Clock className="w-2.5 h-2.5" />Parcial
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Barra de progreso solo para Patricio */}
                  {isPatricio && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[10px] font-medium">
                        <span className="text-amber-700">Pagado: ${fmt(u.paid)} USDT</span>
                        <span className="text-amber-600">Pendiente: ${fmt(u.remaining)} USDT · {pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-amber-600">
                        {pct}% del total · Faltan ${fmt(u.remaining)} para completar ${SUBSCRIPTION_PRICE} USD
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-border">
            <div className="grid grid-cols-12 gap-2 items-center px-3 py-2 bg-muted/30 rounded-md">
              <div className="col-span-1" />
              <div className="col-span-5 md:col-span-4">
                <p className="text-xs font-bold">TOTAL ({userList.length} usuarios)</p>
              </div>
              <div className="hidden md:block col-span-2" />
              <div className="hidden md:block col-span-2" />
              <div className="col-span-4 md:col-span-1 text-right">
                <p className="text-xs font-bold text-[#c8322b]">${fmt(totalRecaudado)}</p>
                {totalPendiente > 0 && (
                  <p className="text-[10px] text-amber-600">+${fmt(totalPendiente)}</p>
                )}
              </div>
              <div className="col-span-2 flex justify-end">
                <span className="text-[10px] font-semibold text-muted-foreground">{usuariosCompletos}/{userList.length}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Resumen histórico ── */}
      <Card>
        <CardContent className="px-5 py-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-[#c8322b] flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Acumulado histórico en wallet</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                El saldo de <strong className="text-foreground">${fmt(WALLET_BALANCE)} USDT</strong> refleja el total
                acumulado en la wallet desde el inicio de operaciones en 2023, incluyendo los 8 usuarios
                con <strong className="text-foreground">3 renovaciones anuales consecutivas</strong> ($18,000 USDT) más
                los 7 suscriptores del ciclo 2025 activo ($5,999 USDT incluyendo abonos).
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                {[
                  { label: "Precio/año",    value: `$${SUBSCRIPTION_PRICE}.00 USD` },
                  { label: "Saldo wallet",  value: `$${fmt(WALLET_BALANCE)} USDT` },
                  { label: "Período",       value: "Ene 2023 – Jun 2026" },
                  { label: "Renovaciones",  value: "8 usuarios · 3 ciclos" },
                ].map(({ label, value }) => (
                  <div key={label} className="p-2 rounded-md bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="text-xs font-bold text-foreground mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
