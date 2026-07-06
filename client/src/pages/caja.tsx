import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSystemSettings, useUpdateSettings } from "@/hooks/use-system-settings";
import { useCajaSummary, useCreateCajaMovement, type CajaMovementRow } from "@/hooks/use-caja";
import { DEFAULT_SYSTEM_SETTINGS } from "@shared/schema";
import {
  Wallet, TrendingUp, TrendingDown, DollarSign, Plus, Minus,
  ArrowUpRight, ArrowDownRight, BarChart2, Calculator,
  FileText, ShieldCheck, X, Check, Lock, AlertTriangle, CreditCard,
  MonitorSmartphone, Radio, Activity, Zap, RefreshCw, SlidersHorizontal, Loader2
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
function fmtUSD(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ─── Types ────────────────────────────────────────────────────────────────────
const movSchema = z.object({
  type: z.enum(["ingreso", "egreso"]),
  amount: z.string().min(1).refine(v => !isNaN(Number(v)) && Number(v) > 0, "Monto inválido"),
  category: z.string().min(1, "Categoría requerida"),
  description: z.string().min(2, "Descripción requerida"),
  reference: z.string().optional(),
});
type MovForm = z.infer<typeof movSchema>;

type TxProtocol = "pos" | "1643" | "101.1";

interface LiveTx {
  id: string; terminal: string; merchant: string;
  amountUSD: number; cardType: string;
  protocol: string; protocolType: TxProtocol;
  authCode: string; oper: number; lote: number;
  status: "aprobado" | "procesando"; date: string; time: string;
  isNew?: boolean;
}

// ─── Categories ───────────────────────────────────────────────────────────────
const INGRESO_CATS = [
  "Liquidación POS", "Transferencia SPEI", "Cobro comisiones",
  "Venta tarjeta internacional", "Venta tarjeta nacional",
  "Reintegro operación", "Otro ingreso electrónico",
];
const EGRESO_CATS = [
  "Retiro via protocolo 1643", "Pago a proveedor",
  "Comisión procesadora", "Devolución cliente",
  "Gastos operativos", "Otro egreso",
];

// ─── Seed data ────────────────────────────────────────────────────────────────
const today = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short" }).toUpperCase();
const lastWeek = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }).toUpperCase(); })();

function buildLiveSeed(s: typeof DEFAULT_SYSTEM_SETTINGS): LiveTx[] {
  // No hay operaciones activas: actualmente ningún otro usuario está transaccionando.
  return [];
}

const LIVE_POOL: Omit<LiveTx, "id" | "date" | "time" | "isNew">[] = [
  { terminal: "T1004", merchant: "GRUPO ASGE VENADO 69", amountUSD: 1960000, cardType: "Mastercard Internacional", protocol: "201.2", protocolType: "pos", authCode: "612843", oper: 33, lote: 5, status: "aprobado" },
  { terminal: "T1001", merchant: "BANXICO PLUS CANCUN",  amountUSD: 2100000, cardType: "VISA Internacional",       protocol: "101.2 M2", protocolType: "pos", authCode: "554301", oper: 10, lote: 3, status: "aprobado" },
  { terminal: "T1002", merchant: "GRUPO ASGE VENADO 69", amountUSD: 2400000, cardType: "Mastercard Internacional", protocol: "201.2", protocolType: "pos", authCode: "987432", oper: 14, lote: 2, status: "aprobado" },
  { terminal: "T1005", merchant: "BANXICO PLUS CANCUN",  amountUSD: 29800,   cardType: "VISA Internacional",       protocol: "1643", protocolType: "1643", authCode: "331092", oper: 7,  lote: 1, status: "aprobado" },
  { terminal: "T1004", merchant: "GRUPO ASGE VENADO 69", amountUSD: 2200000, cardType: "Mastercard Internacional", protocol: "101.2 M2", protocolType: "pos", authCode: "762118", oper: 22, lote: 3, status: "aprobado" },
  { terminal: "T1001", merchant: "BANXICO PLUS CANCUN",  amountUSD: 32100,   cardType: "VISA Internacional",       protocol: "1643", protocolType: "1643", authCode: "210934", oper: 5,  lote: 1, status: "aprobado" },
];

function randFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CajaPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const showLiveView = !isAdmin;
  const { data: settings } = useSystemSettings();
  const { mutate: saveSettings, isPending: isSavingSettings } = useUpdateSettings();
  const { data: cajaSummary, isLoading: isCajaLoading } = useCajaSummary();
  const { mutate: createMovement, isPending: isCreatingMovement } = useCreateCajaMovement();
  const TC = settings?.tipoCambio ?? DEFAULT_SYSTEM_SETTINGS.tipoCambio;
  const fmtMXN = (usd: number) => (usd * TC).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const settingsRef = useRef(settings);
  const movementsInitialized = useRef(false);

  const movements: CajaMovementRow[] = cajaSummary?.movements ?? [];
  const [showForm, setShowForm] = useState<"ingreso" | "egreso" | null>(null);
  const [filterType, setFilterType] = useState<"all" | "ingreso" | "egreso">("all");

  // ── Configurar Montos dialog state ──
  const [showMontos, setShowMontos] = useState(false);
  const [draftMontos, setDraftMontos] = useState({
    saldoAperturaUSD:  DEFAULT_SYSTEM_SETTINGS.saldoAperturaUSD,
    feedPosRegularUSD: DEFAULT_SYSTEM_SETTINGS.feedPosRegularUSD,
    feed1643USD:       DEFAULT_SYSTEM_SETTINGS.feed1643USD,
    feedVisaNet101USD: DEFAULT_SYSTEM_SETTINGS.feedVisaNet101USD,
  });

  const [liveTxs, setLiveTxs] = useState<LiveTx[]>(() => buildLiveSeed(DEFAULT_SYSTEM_SETTINGS));
  const [liveCounter, setLiveCounter] = useState(0);

  const form = useForm<MovForm>({
    resolver: zodResolver(movSchema),
    defaultValues: { type: "ingreso", amount: "", category: "", description: "", reference: "" },
  });

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // sync "Configurar Montos" draft once real settings arrive (only on first load)
  useEffect(() => {
    if (settings && !movementsInitialized.current) {
      movementsInitialized.current = true;
      setDraftMontos({
        saldoAperturaUSD:  settings.saldoAperturaUSD,
        feedPosRegularUSD: settings.feedPosRegularUSD,
        feed1643USD:       settings.feed1643USD,
        feedVisaNet101USD: settings.feedVisaNet101USD,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    if (settings && showLiveView) setLiveTxs(buildLiveSeed(settings));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.feedPosRegularUSD, settings?.feed1643USD, settings?.feedVisaNet101USD, settings?.feedMerchant1, settings?.feedMerchant2, showLiveView]);

  useEffect(() => {
    // Sin actividad simulada: no hay otros usuarios transaccionando por el momento.
    return;
    if (!showLiveView) return;
    const interval = setInterval(() => {
      const s = settingsRef.current ?? DEFAULT_SYSTEM_SETTINGS;
      const base = randFrom(LIVE_POOL);
      const isType1643 = base.protocolType === "1643";
      const adjustedAmt = Math.round(
        (isType1643 ? s.feed1643USD : s.feedPosRegularUSD) * (0.9 + Math.random() * 0.2)
      );
      const merchant = Math.random() > 0.5 ? s.feedMerchant1 : s.feedMerchant2;
      const now = new Date();
      const newTx: LiveTx = {
        ...base,
        amountUSD: adjustedAmt,
        merchant,
        id: `LX-${Date.now()}`,
        date: today,
        time: now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
        isNew: true,
      };
      setLiveTxs(prev => [newTx, ...prev].slice(0, 25));
      setLiveCounter(c => c + 1);
      setTimeout(() => {
        setLiveTxs(prev => prev.map(t => t.id === newTx.id ? { ...t, isNew: false } : t));
      }, 4000);
    }, 40000);
    return () => clearInterval(interval);
  }, [showLiveView]);

  const ingresosUSD = cajaSummary?.ingresosUSD ?? 0;
  const egresosUSD  = cajaSummary?.egresosUSD ?? 0;
  const saldoUSD    = cajaSummary?.saldoUSD ?? (settings?.saldoAperturaUSD ?? DEFAULT_SYSTEM_SETTINGS.saldoAperturaUSD);

  function openForm(type: "ingreso" | "egreso") {
    form.reset({ type, amount: "", category: "", description: "", reference: "" });
    setShowForm(type);
  }

  function onSubmit(data: MovForm) {
    createMovement({
      type: data.type,
      amountUSD: parseFloat(data.amount),
      category: data.category,
      description: data.description,
      reference: data.reference || undefined,
    }, {
      onSuccess: () => {
        setShowForm(null);
        toast({ title: data.type === "ingreso" ? "Ingreso registrado" : "Egreso registrado",
          description: `$${fmtUSD(parseFloat(data.amount))} USD — ${data.description}` });
      },
      onError: (e) => {
        toast({ title: "Error al registrar movimiento", description: e.message, variant: "destructive" });
      },
    });
  }

  function download(filename: string, content: string, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function handleReporteDiario() {
    const fecha = new Date().toLocaleDateString("es-MX");
    const header = "ID,Origen,Tipo,Categoría,Descripción,Referencia,Monto Original,Moneda Original,USD,MXN,Hora,Usuario";
    const rows = movements.map(m =>
      [m.id, m.source, m.type, m.category, `"${m.description.replace(/"/g,'""')}"`,
       m.reference||"", m.originalAmount, m.originalCurrency, fmtUSD(m.amountUSD), fmtUSD(m.amountUSD * TC),
       fmtTime(m.createdAt), m.createdBy].join(",")
    );
    download(`reporte-caja-${fecha.replace(/\//g,"-")}.csv`, [header, ...rows].join("\n"), "text/csv;charset=utf-8");
    toast({ title: "Reporte generado", description: `${movements.length} movimientos exportados.` });
  }

  function handleCierreCaja() {
    const fecha = new Date().toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" });
    const content = [
      "========================================",
      "     BANXICO PLUS — CIERRE DE CAJA",
      "========================================",
      `Fecha : ${fecha}`,
      `Operador: ${user?.fullName ?? "Admin"}`,
      `T/C : ${TC} MXN/USD`,
      "----------------------------------------",
      `Saldo apertura  : $${fmtUSD(settings?.saldoAperturaUSD ?? DEFAULT_SYSTEM_SETTINGS.saldoAperturaUSD)} USD`,
      `Total ingresos  : +$${fmtUSD(ingresosUSD)} USD  (+$${fmtUSD(ingresosUSD * TC)} MXN)`,
      `Total egresos   : -$${fmtUSD(egresosUSD)} USD  (-$${fmtUSD(egresosUSD * TC)} MXN)`,
      "----------------------------------------",
      `SALDO FINAL USD : $${fmtUSD(saldoUSD)}`,
      `SALDO FINAL MXN : $${fmtUSD(saldoUSD * TC)}`,
      "========================================",
    ].join("\n");
    download(`cierre-caja-${new Date().toISOString().slice(0,10)}.txt`, content);
    toast({ title: "Cierre realizado", description: `Saldo: $${fmtUSD(saldoUSD)} USD` });
  }

  function handleArqueo() {
    toast({ title: "Arqueo de caja",
      description: `Ingresos: $${fmtUSD(ingresosUSD)} USD · Egresos: $${fmtUSD(egresosUSD)} USD · Saldo: $${fmtUSD(saldoUSD)} USD` });
  }

  const allFiltered = movements.filter(m => filterType === "all" || m.type === filterType);

  function openMontos() {
    setDraftMontos({
      saldoAperturaUSD:  settings?.saldoAperturaUSD  ?? DEFAULT_SYSTEM_SETTINGS.saldoAperturaUSD,
      feedPosRegularUSD: settings?.feedPosRegularUSD ?? DEFAULT_SYSTEM_SETTINGS.feedPosRegularUSD,
      feed1643USD:       settings?.feed1643USD       ?? DEFAULT_SYSTEM_SETTINGS.feed1643USD,
      feedVisaNet101USD: settings?.feedVisaNet101USD ?? DEFAULT_SYSTEM_SETTINGS.feedVisaNet101USD,
    });
    setShowMontos(true);
  }

  function saveMontos() {
    if (!settings) return;
    const updated = { ...settings, ...draftMontos };
    saveSettings(updated, {
      onSuccess: () => {
        setShowMontos(false);
        toast({ title: "Montos actualizados", description: "Los saldos y montos de caja ya están activos." });
      },
      onError: (e) => {
        toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
      },
    });
  }

  function sourceBadge(m: CajaMovementRow) {
    if (m.source === "transaction") {
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 no-default-active-elevate text-[10px] font-mono">
          <MonitorSmartphone className="w-2.5 h-2.5 mr-0.5" /> Terminal
        </Badge>
      );
    }
    return <Badge className="bg-gray-100 text-gray-600 border-gray-200 no-default-active-elevate text-[10px]">Manual</Badge>;
  }

  function currencyBadge(m: CajaMovementRow) {
    if (m.originalCurrency === "USD") return null;
    return (
      <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
        {m.originalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {m.originalCurrency}
      </span>
    );
  }

  // ─── LIVE VIEW (non-admin) ─────────────────────────────────────────────────
  if (showLiveView) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Radio className="w-7 h-7 text-[#c8322b]" /> Operaciones en Tiempo Real
            </h1>
            <p className="text-sm text-muted-foreground">
              Terminales activas · {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {liveCounter > 0 && (
              <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate text-xs animate-pulse">
                <Activity className="w-3 h-3 mr-1" /> {liveCounter} nueva{liveCounter > 1 ? "s" : ""}
              </Badge>
            )}
            <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-100 px-2.5 py-1.5 rounded-md font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> En vivo
            </div>
          </div>
        </div>


        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="hover-elevate">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <MonitorSmartphone className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">Terminales activas</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">4</p>
              <p className="text-xs text-muted-foreground">T1001 · T1002 · T1004 · T1005</p>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Transacciones hoy</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{liveTxs.filter(t => t.date === today).length}</p>
              <p className="text-xs text-muted-foreground">Operaciones procesadas</p>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-muted-foreground">T/C vigente</span>
              </div>
              <p className="text-lg font-bold text-purple-600 font-mono">{TC}</p>
              <p className="text-xs text-muted-foreground">MXN por USD</p>
            </CardContent>
          </Card>
        </div>

        {/* Live transactions */}
        <Card className="hover-elevate">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#c8322b]" /> Transacciones de Terminales
                </CardTitle>
                <CardDescription>En tiempo real — solo lectura · TC: {TC} MXN/USD</CardDescription>
              </div>
              <Badge className="bg-[#c8322b]/10 text-[#c8322b] border-[#c8322b]/20 no-default-active-elevate text-xs font-mono">
                Visa Net 9.0
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {liveTxs.map(tx => {
                const is101 = tx.protocolType === "101.1";
                const is1643 = tx.protocolType === "1643";
                const isOldWeek = tx.date === lastWeek;
                return (
                  <div
                    key={tx.id}
                    data-testid={`row-live-${tx.id}`}
                    className={`flex items-start gap-3 px-4 py-3 transition-all ${
                      tx.isNew ? "bg-green-50 border-l-2 border-l-green-500"
                      : is101 ? "bg-blue-50/50"
                      : is1643 ? "bg-amber-50/40"
                      : "hover:bg-muted/20"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      is101 ? "bg-[#1A1F71]/10"
                      : is1643 ? "bg-amber-100"
                      : "bg-blue-100"
                    }`}>
                      {is101
                        ? <span className="text-sm font-extrabold italic text-[#1A1F71]" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>V</span>
                        : is1643
                          ? <Zap className="w-4 h-4 text-amber-600" />
                          : <MonitorSmartphone className="w-4 h-4 text-blue-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{tx.merchant}</span>
                        {tx.isNew && (
                          <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate text-[10px]">Nueva</Badge>
                        )}
                        {isOldWeek && (
                          <Badge className="bg-gray-100 text-gray-500 border-gray-200 no-default-active-elevate text-[10px]">Hace 1 semana</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{tx.terminal}</span>
                        {is101 && (
                          <Badge className="bg-[#1A1F71]/10 text-[#1A1F71] border-[#1A1F71]/20 no-default-active-elevate text-[10px] font-mono">
                            Visa Net 101.1
                          </Badge>
                        )}
                        {is1643 && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 no-default-active-elevate text-[10px] font-mono">
                            <Zap className="w-2.5 h-2.5 mr-0.5" /> 1643 Manual
                          </Badge>
                        )}
                        {!is101 && !is1643 && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 no-default-active-elevate text-[10px] font-mono">
                            {tx.protocol}
                          </Badge>
                        )}
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <CreditCard className="w-3 h-3" /> {tx.cardType}
                        </span>
                        <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                          OPER {tx.oper} / LOTE {tx.lote}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-mono">AUTH: {tx.authCode}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold ${is1643 ? "text-amber-600" : is101 ? "text-[#1A1F71]" : "text-green-600"}`}>
                        +${fmtUSD(tx.amountUSD)} USD
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        ≈ ${fmtMXN(tx.amountUSD)} MXN
                      </p>
                      <p className="text-[10px] text-muted-foreground">{tx.date} {tx.time}</p>
                      <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate text-[10px] mt-0.5">
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="hover-elevate">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipos de operación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {[
              { badge: "Visa Net 101.1", color: "bg-[#1A1F71]/10 text-[#1A1F71] border-[#1A1F71]/20", desc: "Transferencia Visa Network · bloques $5M USD · poco frecuente" },
              { badge: "POS 201.x/101.2", color: "bg-blue-100 text-blue-700 border-blue-200", desc: "Venta regular internacional · ~$2M USD c/u" },
              { badge: "1643 Manual", color: "bg-amber-100 text-amber-700 border-amber-200", desc: "Venta forzada terminal manual · operativos ~$30K USD" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <Badge className={`no-default-active-elevate text-[10px] font-mono flex-shrink-0 ${item.color}`}>{item.badge}</Badge>
                <span className="text-xs text-muted-foreground">{item.desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── ADMIN FULL VIEW ───────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Wallet className="w-7 h-7 text-[#c8322b]" /> Caja
          </h1>
          <p className="text-sm text-muted-foreground">
            TC: {TC} MXN/USD · {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={openMontos} data-testid="button-configurar-montos">
            <SlidersHorizontal className="w-4 h-4 mr-1" /> Configurar Montos
          </Button>
          <Button size="sm" className="bg-green-600 text-white" onClick={() => openForm("ingreso")} data-testid="button-ingreso">
            <Plus className="w-4 h-4 mr-1" /> Ingreso
          </Button>
          <Button size="sm" variant="outline" className="border-red-400 text-red-600" onClick={() => openForm("egreso")} data-testid="button-egreso">
            <Minus className="w-4 h-4 mr-1" /> Egreso
          </Button>
        </div>
      </div>

      {/* KPIs — USD + MXN */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo en Caja</CardTitle>
            <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="saldo-caja">${fmtUSD(saldoUSD)} USD</div>
            <p className="text-xs text-muted-foreground mt-0.5">≈ ${fmtMXN(saldoUSD)} MXN</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Hoy</CardTitle>
            <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">${fmtUSD(ingresosUSD)} USD</div>
            <p className="text-xs text-muted-foreground mt-0.5">≈ ${fmtMXN(ingresosUSD)} MXN · {movements.filter(m=>m.type==="ingreso").length} ops</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egresos Hoy</CardTitle>
            <div className="w-8 h-8 rounded-md bg-red-100 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${fmtUSD(egresosUSD)} USD</div>
            <p className="text-xs text-muted-foreground mt-0.5">≈ ${fmtMXN(egresosUSD)} MXN</p>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      {showForm && (
        <Card className={`border-2 ${showForm === "ingreso" ? "border-green-400" : "border-red-400"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className={`flex items-center gap-2 ${showForm === "ingreso" ? "text-green-700" : "text-red-700"}`}>
                {showForm === "ingreso" ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                Registrar {showForm === "ingreso" ? "Ingreso" : "Egreso"}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(null)} data-testid="button-close-form">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto (USD)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input {...field} placeholder="0.00" type="number" step="0.01" min="0.01" className="pl-9 font-mono text-lg" data-testid="input-monto" />
                        </div>
                      </FormControl>
                      {field.value && !isNaN(parseFloat(field.value)) && (
                        <p className="text-xs text-muted-foreground">≈ ${fmtMXN(parseFloat(field.value))} MXN</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(showForm === "ingreso" ? INGRESO_CATS : EGRESO_CATS).map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl><Input {...field} placeholder="Descripción de la operación" data-testid="input-descripcion" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="reference" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referencia / Auth (Opcional)</FormLabel>
                      <FormControl><Input {...field} placeholder="AUTH-000000" className="font-mono" data-testid="input-referencia" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={isCreatingMovement} className={showForm === "ingreso" ? "bg-green-600 text-white" : "bg-red-600 text-white"} data-testid="button-guardar-mov">
                    {isCreatingMovement ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Guardar
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(null)}>Cancelar</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Movements list */}
        <Card className="hover-elevate lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2"><FileText className="w-4 h-4" /> Movimientos</CardTitle>
                <CardDescription>Registro del día · en USD</CardDescription>
              </div>
              <div className="flex gap-1">
                {(["all","ingreso","egreso"] as const).map(f => (
                  <button key={f} onClick={() => setFilterType(f)} data-testid={`filter-${f}`}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${filterType===f ? "bg-[#c8322b] text-white" : "bg-muted text-muted-foreground"}`}>
                    {f==="all" ? "Todos" : f==="ingreso" ? "Ingresos" : "Egresos"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {isCajaLoading && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" /> Cargando movimientos...
                </div>
              )}
              {!isCajaLoading && allFiltered.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Sin movimientos registrados.
                </div>
              )}
              {allFiltered.map(mov => {
                const isTx = mov.source === "transaction";
                return (
                  <div key={mov.id}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30 ${isTx ? "bg-blue-50/30" : ""}`}
                    data-testid={`row-mov-${mov.id}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${mov.type==="ingreso" ? "bg-green-100" : "bg-red-100"}`}>
                      {mov.type==="ingreso" ? <ArrowUpRight className="w-4 h-4 text-green-600" /> : <ArrowDownRight className="w-4 h-4 text-red-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{mov.description}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-xs text-muted-foreground">{mov.category}</span>
                        {sourceBadge(mov)}
                        {currencyBadge(mov)}
                        {mov.reference && <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{mov.reference}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold ${mov.type==="ingreso" ? "text-green-600" : "text-red-600"}`}>
                        {mov.type==="ingreso" ? "+" : "–"}${fmtUSD(mov.amountUSD)} USD
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        ≈ ${fmtMXN(mov.amountUSD)} MXN
                      </p>
                      <p className="text-[10px] text-muted-foreground">{fmtTime(mov.createdAt)} · {mov.createdBy}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="hover-elevate bg-slate-900 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-green-400" /> Resumen del Día
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Saldo apertura", usd: settings?.saldoAperturaUSD ?? DEFAULT_SYSTEM_SETTINGS.saldoAperturaUSD, color: "text-slate-300" },
                { label: "Total ingresos", usd: ingresosUSD, color: "text-green-400", prefix: "+" },
                { label: "Total egresos",  usd: egresosUSD, color: "text-red-400", prefix: "–" },
                { label: "Saldo actual",   usd: saldoUSD, color: "text-white font-bold", isFinal: true },
              ].map((item, i) => (
                <div key={i} className={`py-1.5 ${i===3 ? "border-t border-slate-600 mt-1 pt-2" : "border-b border-slate-700"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{item.label}</span>
                    <span className={`text-sm font-mono ${item.color}`}>
                      {item.prefix || ""} ${fmtUSD(item.usd)} USD
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <span className="text-[10px] text-slate-500 font-mono">≈ ${fmtMXN(item.usd)} MXN</span>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-slate-500 pt-1 text-right">TC: {TC} MXN/USD</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-blue-200 bg-blue-50/40">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-800">Solo operaciones electrónicas</p>
                  <p className="text-xs text-blue-700 mt-0.5">Sin depósito en efectivo. Venta forzada vía protocolo 1643.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold">Controles</span>
              </div>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={handleCierreCaja} data-testid="button-cierre-caja">
                  <FileText className="w-3.5 h-3.5 mr-2" /> Cierre de Caja
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={handleArqueo} data-testid="button-arqueo">
                  <Calculator className="w-3.5 h-3.5 mr-2" /> Arqueo de Caja
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={handleReporteDiario} data-testid="button-reporte">
                  <BarChart2 className="w-3.5 h-3.5 mr-2" /> Reporte Diario CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Configurar Montos Dialog ── */}
      <Dialog open={showMontos} onOpenChange={setShowMontos}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-[#c8322b]" />
              Configurar Montos de Caja
            </DialogTitle>
            <DialogDescription>
              Ajusta los saldos base y los montos de las operaciones. Los cambios se reflejan inmediatamente en la tabla de movimientos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Saldo Apertura */}
            <div className="space-y-1.5">
              <Label htmlFor="dm-apertura" className="text-sm font-medium">Saldo de Apertura de Caja (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  id="dm-apertura"
                  type="number"
                  step="1000"
                  min="0"
                  className="pl-6"
                  value={draftMontos.saldoAperturaUSD}
                  onChange={e => setDraftMontos(d => ({ ...d, saldoAperturaUSD: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-dm-apertura"
                />
              </div>
              <p className="text-xs text-muted-foreground">Base de la caja antes de sumar ingresos / egresos del día</p>
            </div>

            <Separator />

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Montos de Operaciones en Feed</p>

            {/* POS Regular */}
            <div className="space-y-1.5">
              <Label htmlFor="dm-pos" className="text-sm font-medium">Monto POS Regular (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  id="dm-pos"
                  type="number"
                  step="10000"
                  min="0"
                  className="pl-6"
                  value={draftMontos.feedPosRegularUSD}
                  onChange={e => setDraftMontos(d => ({ ...d, feedPosRegularUSD: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-dm-pos"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Operaciones POS 201.x / 101.2 — actualmente:{" "}
                <span className="font-mono">${draftMontos.feedPosRegularUSD.toLocaleString("en-US")} USD</span>
              </p>
            </div>

            {/* 1643 */}
            <div className="space-y-1.5">
              <Label htmlFor="dm-1643" className="text-sm font-medium">Monto Protocolo 1643 (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  id="dm-1643"
                  type="number"
                  step="1000"
                  min="0"
                  className="pl-6"
                  value={draftMontos.feed1643USD}
                  onChange={e => setDraftMontos(d => ({ ...d, feed1643USD: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-dm-1643"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Ventas forzadas manuales — actualmente:{" "}
                <span className="font-mono">${draftMontos.feed1643USD.toLocaleString("en-US")} USD</span>
              </p>
            </div>

            {/* Visa Net 101.1 */}
            <div className="space-y-1.5">
              <Label htmlFor="dm-visa" className="text-sm font-medium">Monto Visa Network 101.1 (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  id="dm-visa"
                  type="number"
                  step="100000"
                  min="0"
                  className="pl-6"
                  value={draftMontos.feedVisaNet101USD}
                  onChange={e => setDraftMontos(d => ({ ...d, feedVisaNet101USD: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-dm-visa"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Transferencias Visa Network — actualmente:{" "}
                <span className="font-mono">${draftMontos.feedVisaNet101USD.toLocaleString("en-US")} USD</span>
              </p>
            </div>

            {/* Preview totals */}
            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <p className="font-semibold text-sm mb-1.5">Vista previa del total de ingresos</p>
              {(() => {
                const pos   = draftMontos.feedPosRegularUSD;
                const f1643 = draftMontos.feed1643USD;
                const visa  = draftMontos.feedVisaNet101USD;
                const total = pos + Math.round(pos*0.925) + Math.round(pos*1.075) + Math.round(f1643*1.05) + Math.round(pos*1.175) + Math.round(f1643*0.957) + visa - 1200;
                return (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>5× POS (201.x / 101.2)</span>
                      <span className="font-mono">${(pos + Math.round(pos*0.925) + Math.round(pos*1.075) + Math.round(pos*1.175)).toLocaleString("en-US")} USD</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>2× Protocolo 1643</span>
                      <span className="font-mono">${(Math.round(f1643*1.05) + Math.round(f1643*0.957)).toLocaleString("en-US")} USD</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>1× Visa Network 101.1</span>
                      <span className="font-mono">${visa.toLocaleString("en-US")} USD</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-semibold">
                      <span>Saldo en caja estimado</span>
                      <span className="font-mono text-green-600">${(draftMontos.saldoAperturaUSD + total).toLocaleString("en-US")} USD</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMontos(false)}>Cancelar</Button>
            <Button onClick={saveMontos} disabled={isSavingSettings} data-testid="button-save-montos">
              {isSavingSettings ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
              Guardar Montos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
