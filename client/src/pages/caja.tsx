import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Wallet, TrendingUp, TrendingDown, DollarSign, Plus, Minus,
  ArrowUpRight, ArrowDownRight, BarChart2, Calculator,
  FileText, ShieldCheck, X, Check, Lock, AlertTriangle, CreditCard,
  MonitorSmartphone, Radio, Activity, Zap
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
const movSchema = z.object({
  type: z.enum(["ingreso", "egreso"]),
  amount: z.string().min(1).refine(v => !isNaN(Number(v)) && Number(v) > 0, "Monto inválido"),
  category: z.string().min(1, "Categoría requerida"),
  description: z.string().min(2, "Descripción requerida"),
  reference: z.string().optional(),
});
type MovForm = z.infer<typeof movSchema>;

interface Movement {
  id: string;
  type: "ingreso" | "egreso";
  amount: number;
  category: string;
  description: string;
  reference?: string;
  time: string;
  user: string;
  protocol?: string;
  cardType?: string;
  authCode?: string;
}

interface LiveTx {
  id: string;
  terminal: string;
  merchant: string;
  amount: number;
  cardType: string;
  protocol: string;
  authCode: string;
  oper: number;
  lote: number;
  status: "aprobado" | "procesando";
  time: string;
  isNew?: boolean;
}

// ─── Categories ───────────────────────────────────────────────────────────────
const INGRESO_CATS = [
  "Liquidación POS",
  "Transferencia SPEI",
  "Cobro comisiones",
  "Venta tarjeta internacional",
  "Venta tarjeta nacional",
  "Reintegro operación",
  "Otro ingreso electrónico",
];
const EGRESO_CATS = [
  "Retiro via protocolo 1643",
  "Pago a proveedor",
  "Comisión procesadora",
  "Devolución cliente",
  "Gastos operativos",
  "Otro egreso",
];

// ─── Static seed data ─────────────────────────────────────────────────────────
const initialMovements: Movement[] = [
  { id: "MOV-001", type: "ingreso", amount: 20160.00, category: "Venta tarjeta internacional",
    description: "Venta Mastercard Internacional — GRUPO ASGE", reference: "AUTH-596122",
    time: "06:55 PM", user: "Admin", protocol: "101.2 M2", cardType: "Mastercard", authCode: "596122" },
  { id: "MOV-002", type: "ingreso", amount: 18500.00, category: "Liquidación POS",
    description: "Liquidación terminal T1004 — VISA General", reference: "AUTH-441829",
    time: "05:40 PM", user: "Admin", protocol: "101.1 M1", cardType: "VISA", authCode: "441829" },
  { id: "MOV-003", type: "ingreso", amount: 15800.00, category: "Venta tarjeta internacional",
    description: "Venta Mastercard — INTERNACIONAL GENERAL OPER 15", reference: "AUTH-334211",
    time: "04:22 PM", user: "Admin", protocol: "201.2", cardType: "Mastercard", authCode: "334211" },
  { id: "MOV-004", type: "egreso",  amount: 3200.00, category: "Retiro via protocolo 1643",
    description: "Retiro operación — Protocolo 1643 POS T1005", reference: "PRT-1643-007",
    time: "03:15 PM", user: "Admin", protocol: "1643" },
  { id: "MOV-005", type: "ingreso", amount: 12750.00, category: "Venta tarjeta nacional",
    description: "Venta VISA Nacional — Terminal T1001", reference: "AUTH-881203",
    time: "02:30 PM", user: "Admin", protocol: "101.1 M1", cardType: "VISA", authCode: "881203" },
  { id: "MOV-006", type: "egreso",  amount: 1200.00, category: "Comisión procesadora",
    description: "Comisión red EMV — Procesadora internacional", reference: "COM-EMV-042",
    time: "01:45 PM", user: "Admin", protocol: "201.1" },
  { id: "MOV-007", type: "ingreso", amount: 9480.00, category: "Cobro comisiones",
    description: "Comisiones acumuladas red T1002/T1004", reference: "COM-NET-018",
    time: "12:00 PM", user: "Admin", protocol: "101.3 M3" },
  { id: "MOV-008", type: "ingreso", amount: 22400.00, category: "Venta tarjeta internacional",
    description: "Venta Mastercard Internacional — OPER 31 LOTE 4", reference: "AUTH-774019",
    time: "10:15 AM", user: "Admin", protocol: "101.2 M2", cardType: "Mastercard", authCode: "774019" },
  { id: "MOV-009", type: "egreso",  amount: 850.00, category: "Gastos operativos",
    description: "Mantenimiento sistema POS — Proveedor técnico", reference: "SVC-2026-11",
    time: "09:00 AM", user: "Admin" },
];

// Base live transactions (seen by non-admin users)
const LIVE_SEED: LiveTx[] = [
  { id: "LX-001", terminal: "T1001", merchant: "GRUPO ASGE VENADO 69", amount: 20160.00,
    cardType: "Mastercard Internacional", protocol: "101.2 M2", authCode: "596122",
    oper: 28, lote: 2, status: "aprobado", time: "18:55" },
  { id: "LX-002", terminal: "T1004", merchant: "BANXICO PLUS CANCUN", amount: 18500.00,
    cardType: "VISA Internacional", protocol: "101.2 M2", authCode: "441829",
    oper: 15, lote: 3, status: "aprobado", time: "17:40" },
  { id: "LX-003", terminal: "T1002", merchant: "GRUPO ASGE VENADO 69", amount: 15800.00,
    cardType: "Mastercard Internacional", protocol: "201.2", authCode: "334211",
    oper: 12, lote: 1, status: "aprobado", time: "16:22" },
  { id: "LX-004", terminal: "T1001", merchant: "BANXICO PLUS CANCUN", amount: 12750.00,
    cardType: "VISA Nacional", protocol: "101.1 M1", authCode: "881203",
    oper: 9, lote: 2, status: "aprobado", time: "14:30" },
  { id: "LX-005", terminal: "T1005", merchant: "GRUPO ASGE VENADO 69", amount: 22400.00,
    cardType: "Mastercard Internacional", protocol: "101.2 M2", authCode: "774019",
    oper: 31, lote: 4, status: "aprobado", time: "10:15" },
];

// Pool of realistic transactions to add as "live" updates
const LIVE_POOL: Omit<LiveTx, "id" | "time" | "isNew">[] = [
  { terminal: "T1004", merchant: "GRUPO ASGE VENADO 69", amount: 17600.00, cardType: "Mastercard Internacional", protocol: "101.2 M2", authCode: "612843", oper: 33, lote: 5, status: "aprobado" },
  { terminal: "T1001", merchant: "BANXICO PLUS CANCUN", amount: 8900.00,  cardType: "VISA Nacional", protocol: "101.1 M1", authCode: "554301", oper: 10, lote: 3, status: "aprobado" },
  { terminal: "T1002", merchant: "GRUPO ASGE VENADO 69", amount: 24500.00, cardType: "Mastercard Internacional", protocol: "201.2",  authCode: "987432", oper: 14, lote: 2, status: "aprobado" },
  { terminal: "T1005", merchant: "BANXICO PLUS CANCUN", amount: 11200.00, cardType: "VISA Internacional", protocol: "201.2",  authCode: "331092", oper: 7,  lote: 1, status: "aprobado" },
  { terminal: "T1004", merchant: "GRUPO ASGE VENADO 69", amount: 19800.00, cardType: "Mastercard Internacional", protocol: "101.3 M3", authCode: "762118", oper: 22, lote: 3, status: "aprobado" },
  { terminal: "T1001", merchant: "BANXICO PLUS CANCUN", amount: 6500.00,  cardType: "VISA Nacional", protocol: "101.1 M1", authCode: "210934", oper: 5,  lote: 1, status: "aprobado" },
];

function randFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getSubscriptionStatus(startIso: string | null | undefined) {
  if (!startIso) return { active: false };
  const start = new Date(startIso);
  if (isNaN(start.getTime())) return { active: false };
  const end = new Date(start);
  end.setMonth(end.getMonth() + 12);
  return { active: Date.now() < end.getTime() };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CajaPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  // Non-admin users always see live terminal view (regardless of subscription)
  // regardless of whether they have active subscription
  const showLiveView = !isAdmin;

  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [showForm, setShowForm] = useState<"ingreso" | "egreso" | null>(null);
  const [filterType, setFilterType] = useState<"all" | "ingreso" | "egreso">("all");

  // Live feed state for non-admin users
  const [liveTxs, setLiveTxs] = useState<LiveTx[]>(LIVE_SEED);
  const [liveCounter, setLiveCounter] = useState(0);

  const form = useForm<MovForm>({
    resolver: zodResolver(movSchema),
    defaultValues: { type: "ingreso", amount: "", category: "", description: "", reference: "" },
  });

  // Simulate incoming live transactions every ~40s
  useEffect(() => {
    if (!showLiveView) return;
    const interval = setInterval(() => {
      const base = randFrom(LIVE_POOL);
      const newTx: LiveTx = {
        ...base,
        id: `LX-${Date.now()}`,
        time: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
        isNew: true,
      };
      setLiveTxs(prev => [newTx, ...prev].slice(0, 20));
      setLiveCounter(c => c + 1);
      // Clear "isNew" flag after animation
      setTimeout(() => {
        setLiveTxs(prev => prev.map(t => t.id === newTx.id ? { ...t, isNew: false } : t));
      }, 3000);
    }, 40000);
    return () => clearInterval(interval);
  }, [showLiveView]);

  const ingresos = movements.filter(m => m.type === "ingreso").reduce((s, m) => s + m.amount, 0);
  const egresos  = movements.filter(m => m.type === "egreso").reduce((s, m) => s + m.amount, 0);
  const saldo    = 45890 + ingresos - egresos;

  function openForm(type: "ingreso" | "egreso") {
    form.reset({ type, amount: "", category: "", description: "", reference: "" });
    setShowForm(type);
  }

  function onSubmit(data: MovForm) {
    const newMov: Movement = {
      id: `MOV-${String(movements.length + 1).padStart(3, "0")}`,
      type: data.type,
      amount: parseFloat(data.amount),
      category: data.category,
      description: data.description,
      reference: data.reference || undefined,
      time: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      user: user?.fullName ?? "Sistema",
    };
    setMovements(prev => [newMov, ...prev]);
    setShowForm(null);
    toast({ title: data.type === "ingreso" ? "Ingreso registrado" : "Egreso registrado",
      description: `$${parseFloat(data.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} — ${data.description}` });
  }

  function downloadFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function handleReporteDiario() {
    const fecha = new Date().toLocaleDateString("es-MX");
    const header = "ID,Tipo,Categoría,Descripción,Referencia,Monto,Hora,Protocolo,Tarjeta,Auth";
    const rows = movements.map(m =>
      [m.id, m.type, m.category, `"${m.description.replace(/"/g,'""')}"`,
       m.reference||"", m.amount.toFixed(2), m.time, m.protocol||"", m.cardType||"", m.authCode||""].join(",")
    );
    downloadFile(`reporte-caja-${fecha.replace(/\//g,"-")}.csv`, [header, ...rows].join("\n"), "text/csv;charset=utf-8");
    toast({ title: "Reporte generado", description: `${movements.length} movimientos exportados.` });
  }

  function handleCierreCaja() {
    const fecha = new Date().toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" });
    const reporte = [
      "========================================",
      "     BANXICO PLUS — CIERRE DE CAJA",
      "========================================",
      `Fecha : ${fecha}`,
      `Operador: ${user?.fullName ?? "Admin"}`,
      "----------------------------------------",
      `Saldo apertura : $45,890.00`,
      `Total ingresos : +$${ingresos.toLocaleString("en-US",{minimumFractionDigits:2})}`,
      `Total egresos  : -$${egresos.toLocaleString("en-US",{minimumFractionDigits:2})}`,
      "----------------------------------------",
      `SALDO FINAL    : $${saldo.toLocaleString("en-US",{minimumFractionDigits:2})}`,
      "========================================",
      "Documento simulado — Banxico Plus",
    ].join("\n");
    downloadFile(`cierre-caja-${new Date().toISOString().slice(0,10)}.txt`, reporte);
    toast({ title: "Cierre de caja realizado", description: `Saldo final: $${saldo.toLocaleString("en-US",{minimumFractionDigits:2})}` });
  }

  function handleArqueo() {
    toast({ title: "Arqueo de caja", description: `Ingresos: $${ingresos.toLocaleString("en-US",{minimumFractionDigits:2})} · Egresos: $${egresos.toLocaleString("en-US",{minimumFractionDigits:2})} · Saldo: $${saldo.toLocaleString("en-US",{minimumFractionDigits:2})}` });
  }

  const allFiltered = movements.filter(m => filterType === "all" || m.type === filterType);

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
              Transacciones activas de terminales · {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {liveCounter > 0 && (
              <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate text-xs animate-pulse">
                <Activity className="w-3 h-3 mr-1" /> {liveCounter} nueva{liveCounter > 1 ? "s" : ""}
              </Badge>
            )}
            <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-100 px-2.5 py-1.5 rounded-md font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              En vivo
            </div>
          </div>
        </div>

        {/* Subscription banner */}
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-900 text-sm">Suscripción pago pendiente</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Para acceder al desglose completo de caja, saldos y reportes, realiza el pago de tu suscripción o contacta al administrador.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats bar */}
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
                <Zap className="w-4 h-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Transacciones hoy</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{liveTxs.length}</p>
              <p className="text-xs text-muted-foreground">Operaciones procesadas</p>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-muted-foreground">Protocolo principal</span>
              </div>
              <p className="text-lg font-bold text-purple-600 font-mono">101.2 M2</p>
              <p className="text-xs text-muted-foreground">Internacional</p>
            </CardContent>
          </Card>
        </div>

        {/* Live transactions list */}
        <Card className="hover-elevate">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#c8322b]" /> Transacciones de Terminales
                </CardTitle>
                <CardDescription>Operaciones en tiempo real — solo lectura</CardDescription>
              </div>
              <Badge className="bg-[#c8322b]/10 text-[#c8322b] border-[#c8322b]/20 no-default-active-elevate text-xs font-mono">
                Visa Net 9.0
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {liveTxs.map(tx => (
                <div
                  key={tx.id}
                  data-testid={`row-live-${tx.id}`}
                  className={`flex items-start gap-3 px-4 py-3 transition-all ${tx.isNew ? "bg-green-50 border-l-2 border-l-green-500" : "hover:bg-muted/20"}`}
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MonitorSmartphone className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{tx.merchant}</span>
                      {tx.isNew && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate text-[10px]">
                          Nueva
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs font-mono text-muted-foreground">{tx.terminal}</span>
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 no-default-active-elevate text-[10px] font-mono">
                        {tx.protocol}
                      </Badge>
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
                    <p className="font-bold text-green-600">
                      +${tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{tx.time}</p>
                    <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate text-[10px] mt-0.5">
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Protocol reference */}
        <Card className="hover-elevate">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Protocolos en uso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pb-4">
            {[
              { code: "101.1 M1", label: "Transferencia nacional" },
              { code: "101.2 M2", label: "Transferencia internacional" },
              { code: "101.3 M3", label: "Transferencia segura" },
              { code: "201.1",    label: "Pago nacional" },
              { code: "201.2",    label: "Pago internacional" },
              { code: "1643",     label: "Retiro POS" },
            ].map(p => (
              <div key={p.code} className="flex items-center justify-between text-xs">
                <Badge className="bg-[#c8322b]/10 text-[#c8322b] border-[#c8322b]/20 no-default-active-elevate font-mono">{p.code}</Badge>
                <span className="text-muted-foreground">{p.label}</span>
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
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Wallet className="w-7 h-7 text-[#c8322b]" /> Caja
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión de operaciones · {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-green-600 text-white" onClick={() => openForm("ingreso")} data-testid="button-ingreso">
            <Plus className="w-4 h-4 mr-1" /> Registrar Ingreso
          </Button>
          <Button size="sm" variant="outline" className="border-red-400 text-red-600" onClick={() => openForm("egreso")} data-testid="button-egreso">
            <Minus className="w-4 h-4 mr-1" /> Registrar Egreso
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo en Caja</CardTitle>
            <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600" data-testid="saldo-caja">
              ${saldo.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">USD — Actualizado ahora</p>
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
            <div className="text-3xl font-bold text-blue-600">
              ${ingresos.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{movements.filter(m => m.type==="ingreso").length} operaciones</p>
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
            <div className="text-3xl font-bold text-red-600">
              ${egresos.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{movements.filter(m => m.type==="egreso").length} operaciones</p>
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
                      <FormControl>
                        <Input {...field} placeholder="Descripción de la operación" data-testid="input-descripcion" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="reference" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referencia / Auth (Opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="AUTH-000000" className="font-mono" data-testid="input-referencia" />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" className={showForm === "ingreso" ? "bg-green-600 text-white" : "bg-red-600 text-white"} data-testid="button-guardar-mov">
                    <Check className="w-4 h-4 mr-1" /> Guardar
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(null)}>Cancelar</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Movements */}
        <Card className="hover-elevate lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Movimientos
                </CardTitle>
                <CardDescription>Registro del día</CardDescription>
              </div>
              <div className="flex gap-1">
                {(["all", "ingreso", "egreso"] as const).map(f => (
                  <button key={f} onClick={() => setFilterType(f)} data-testid={`filter-${f}`}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${filterType === f ? "bg-[#c8322b] text-white" : "bg-muted text-muted-foreground"}`}>
                    {f === "all" ? "Todos" : f === "ingreso" ? "Ingresos" : "Egresos"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {allFiltered.map(mov => (
                <div key={mov.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors" data-testid={`row-mov-${mov.id}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${mov.type === "ingreso" ? "bg-green-100" : "bg-red-100"}`}>
                    {mov.type === "ingreso" ? <ArrowUpRight className="w-4 h-4 text-green-600" /> : <ArrowDownRight className="w-4 h-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{mov.description}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs text-muted-foreground">{mov.category}</span>
                      {mov.protocol && (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 no-default-active-elevate text-[10px] px-1.5">
                          {mov.protocol}
                        </Badge>
                      )}
                      {mov.cardType && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <CreditCard className="w-3 h-3" /> {mov.cardType}
                        </span>
                      )}
                      {mov.reference && <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{mov.reference}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold ${mov.type === "ingreso" ? "text-green-600" : "text-red-600"}`}>
                      {mov.type === "ingreso" ? "+" : "–"}${mov.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{mov.time} · {mov.id}</p>
                  </div>
                </div>
              ))}
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
                { label: "Saldo apertura", value: "$45,890.00", color: "text-slate-300" },
                { label: "Total ingresos", value: `+$${ingresos.toLocaleString("en-US",{minimumFractionDigits:2})}`, color: "text-green-400" },
                { label: "Total egresos",  value: `-$${egresos.toLocaleString("en-US",{minimumFractionDigits:2})}`, color: "text-red-400" },
                { label: "Saldo actual",   value: `$${saldo.toLocaleString("en-US",{minimumFractionDigits:2})}`, color: "text-white font-bold" },
              ].map((item, i) => (
                <div key={i} className={`flex items-center justify-between py-1.5 ${i === 3 ? "border-t border-slate-600 mt-1 pt-2" : "border-b border-slate-700"}`}>
                  <span className="text-xs text-slate-400">{item.label}</span>
                  <span className={`text-sm font-mono ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="hover-elevate border-blue-200 bg-blue-50/40">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-800">Solo operaciones electrónicas</p>
                  <p className="text-xs text-blue-700 mt-0.5">Retiros únicamente via protocolo 1643 POS.</p>
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
                  <BarChart2 className="w-3.5 h-3.5 mr-2" /> Reporte Diario
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Protocolos Activos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              {[
                { code: "101.1 M1", label: "Transferencia nacional" },
                { code: "101.2 M2", label: "Transferencia internacional" },
                { code: "101.3 M3", label: "Transferencia segura" },
                { code: "201.1",    label: "Pago nacional" },
                { code: "201.2",    label: "Pago internacional" },
                { code: "1643",     label: "Retiro POS" },
              ].map(p => (
                <div key={p.code} className="flex items-center justify-between text-xs">
                  <Badge className="bg-[#c8322b]/10 text-[#c8322b] border-[#c8322b]/20 no-default-active-elevate font-mono">{p.code}</Badge>
                  <span className="text-muted-foreground">{p.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
