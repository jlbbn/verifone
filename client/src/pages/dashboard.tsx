import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSystemSettings } from "@/hooks/use-system-settings";
import type { Transaction } from "@shared/schema";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DollarSign, Users, Activity,
  ArrowRightLeft, ShieldCheck, Zap, Bell,
  Clock, CheckCircle, XCircle, AlertTriangle, BarChart2,
  Store, ChevronRight, Cpu, Globe, Inbox, Megaphone
} from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  payment: "Pago",
  transfer: "Transferencia",
  deposit: "Depósito",
  withdrawal: "Retiro",
};

const PROTOCOL_GROUPS = [
  { label: "Transferencias", prefix: "101", color: "bg-blue-500" },
  { label: "Pagos", prefix: "201", color: "bg-[#c8322b]" },
  { label: "Depósitos", prefix: "301", color: "bg-green-500" },
  { label: "Retiros", prefix: "401", color: "bg-yellow-500" },
];

// hourlyData computed below from real transactions

function relativeTime(iso: string | Date): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Hace instantes";
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} d`;
}

function cardFromDescription(desc: string | null): string {
  if (!desc) return "";
  const m = desc.match(/Pago con (.+?) -/);
  return m ? m[1].trim() : "";
}

interface HealthData {
  database: string; bankingApi: string; visaMcNetwork: string;
  swiftGateway: string; posTerminals: string; securityAes: string;
  failedLast24h: number; totalTransactions: number; activeTerminals: number;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSubAlert, setShowSubAlert] = useState(true);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const { data: transactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: settings } = useSystemSettings();
  const { data: healthData } = useQuery<HealthData>({ queryKey: ["/api/health"], refetchInterval: 30000 });
  const { data: subData } = useQuery<{ posLocked?: boolean }>({ queryKey: ["/api/subscription"] });
  const posLocked = subData?.posLocked === true;

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const total = transactions.length;
    const completed = transactions.filter(t => t.status === "completed").length;
    const pending = transactions.filter(t => t.status === "pending" || t.status === "processing").length;
    const failed = transactions.filter(t => t.status === "failed").length;
    const volume = transactions.reduce((s, t) => s + parseFloat(t.amount || "0"), 0);
    const completedPct = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, failed, volume, completedPct };
  }, [transactions]);

  const protocolStats = useMemo(() => {
    const total = transactions.length || 1;
    return PROTOCOL_GROUPS.map(g => {
      const count = transactions.filter(t => (t.protocol || "").startsWith(g.prefix)).length;
      return { ...g, count, pct: Math.round((count / total) * 100) };
    });
  }, [transactions]);

  const recentActivity = useMemo(() => transactions.slice(0, 7), [transactions]);

  const { hourlyData, hourLabels } = useMemo(() => {
    const now = new Date();
    const slots = Array.from({ length: 12 }, (_, i) => {
      const h = (now.getHours() - 11 + i + 24) % 24;
      return h;
    });
    const labels = slots.map(h => {
      const ampm = h >= 12 ? "pm" : "am";
      const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${display}${ampm}`;
    });
    const counts = slots.map(h =>
      transactions.filter(tx => new Date(tx.createdAt).getHours() === h).length
    );
    return { hourlyData: counts, hourLabels: labels };
  }, [transactions]);

  const firstName = user?.fullName?.split(" ")[0] || user?.username || "Usuario";

  const fmtMoney = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const kpis = [
    {
      title: "Transacciones", value: stats.total.toString(),
      sub: `${stats.completed} completadas`, icon: <ArrowRightLeft className="w-4 h-4" />,
      iconBg: "bg-blue-500/20", iconColor: "text-blue-400", valueColor: "",
    },
    {
      title: "Volumen Total", value: fmtMoney(stats.volume),
      sub: "USD acumulado", icon: <DollarSign className="w-4 h-4" />,
      iconBg: "bg-emerald-500/20", iconColor: "text-emerald-400", valueColor: "text-emerald-400",
    },
    {
      title: "Completadas", value: stats.completed.toString(),
      sub: `${stats.completedPct}% del total`, icon: <CheckCircle className="w-4 h-4" />,
      iconBg: "bg-green-500/20", iconColor: "text-green-400", valueColor: "text-green-400",
    },
    {
      title: "Pendientes", value: stats.pending.toString(),
      sub: stats.pending > 0 ? "requieren revisión" : "todo al día", icon: <Clock className="w-4 h-4" />,
      iconBg: "bg-yellow-500/20", iconColor: "text-yellow-400", valueColor: stats.pending > 0 ? "text-yellow-400" : "",
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 bg-[radial-gradient(circle_at_85%_0%,rgba(200,50,43,0.07),transparent_27rem)]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }} data-testid="text-greeting">
            <BarChart2 className="w-7 h-7 text-[#c8322b]" />
            Hola, {firstName}
            {isAdmin && <Badge className="bg-[#c8322b] text-white no-default-active-elevate ml-1">ADMIN</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin ? "Vista global del sistema · " : "Tu actividad bancaria · "}
            {currentTime.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}{currentTime.toLocaleTimeString("es-MX")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Saldo Disponible</p>
            <p className="text-2xl font-bold text-green-400 tabular-nums tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }} data-testid="balance">
              {isAdmin
                ? fmtMoney(settings?.saldoSistemaUSD ?? 0)
                : fmtMoney((user as any)?.cajaSaldoUSD ?? 0)
              } <span className="text-sm font-semibold text-muted-foreground">USD</span>
            </p>
          </div>
          <Button size="sm" className="bg-[#c8322b] hover:bg-[#a62822]" onClick={() => setLocation("/transacciones")} data-testid="button-nueva-tx">
            <Zap className="w-4 h-4 mr-1" /> Nueva TX
          </Button>
        </div>
      </div>

      {/* Platform announcement banner */}
      {settings?.platformAnnouncement && showAnnouncement && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3">
          <Megaphone className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Aviso de la plataforma</p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5 whitespace-pre-line">{settings.platformAnnouncement}</p>
          </div>
          <button
            onClick={() => setShowAnnouncement(false)}
            className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 transition-colors flex-shrink-0"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Subscription POS notice — descartable, solo Patricio cuando posLocked */}
      {posLocked && showSubAlert && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Terminal POS inactiva</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Tu terminal POS está desactivada por un pago pendiente en tu suscripción. Revisa los detalles para reactivarla.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-amber-300 text-amber-800 hover:bg-amber-100 h-7 px-2"
              onClick={() => setLocation("/subscription")}
            >
              Ver suscripción
            </Button>
            <button
              onClick={() => setShowSubAlert(false)}
              className="text-amber-400 hover:text-amber-700 transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="hover-elevate group overflow-hidden border-white/[0.07] bg-card/80 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#c8322b]/40" style={{ animationDelay: `${i * 70}ms` }}>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-[11px] uppercase tracking-[0.13em] text-muted-foreground font-semibold">{kpi.title}</CardTitle>
              <div className={`w-8 h-8 rounded-md ${kpi.iconBg} flex items-center justify-center ${kpi.iconColor} transition-transform duration-300 group-hover:scale-110`}>
                {kpi.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold tracking-tight tabular-nums ${kpi.valueColor}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }} data-testid={`kpi-${i}`}>
                {kpi.value}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${i === 3 && stats.pending > 0 ? "bg-yellow-400" : "bg-emerald-400"}`} />
                <p className="text-[11px] text-muted-foreground">{kpi.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Middle section */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hourly chart */}
          <Card className="hover-elevate lg:col-span-2 border-white/[0.07] bg-card/80 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#c8322b]" /> Actividad por Hora
                </CardTitle>
                <CardDescription>Transacciones reales · últimas 12 horas</CardDescription>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 no-default-active-elevate"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />En vivo</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourLabels.map((hour, i) => ({ hour, transacciones: hourlyData[i] }))} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c8322b" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#c8322b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.55} />
                  <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip cursor={{ stroke: "#c8322b", strokeOpacity: 0.35 }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(value) => [`${value} tx`, "Actividad"]} />
                  <Area type="monotone" dataKey="transacciones" stroke="#c8322b" strokeWidth={2.5} fill="url(#activityFill)" dot={{ r: 2.5, fill: "#c8322b", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#c8322b", stroke: "hsl(var(--card))", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
              <span>{hourLabels[0]}</span><span>Últimas 12 horas</span><span>{hourLabels[hourLabels.length - 1]}</span>
            </div>
          </CardContent>
        </Card>

        {/* Protocol breakdown (real data) */}
        <Card className="hover-elevate border-white/[0.07] bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="w-4 h-4 text-[#c8322b]" /> Distribución Protocolos
            </CardTitle>
            <CardDescription>{isAdmin ? "Sistema completo" : "Tus operaciones"}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {stats.total === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">Sin datos todavía</div>
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={protocolStats} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.45} />
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis type="category" dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} width={72} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.25 }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(value, _name, item) => [`${value} (${item.payload.pct}%)`, "Transacciones"]} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                      {protocolStats.map((p, i) => <Cell key={p.prefix} fill={["#5b8def", "#c8322b", "#35b982", "#e5ab4e"][i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-muted-foreground">
              {protocolStats.map((p, i) => <span key={p.prefix} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ["#5b8def", "#c8322b", "#35b982", "#e5ab4e"][i] }} />{p.prefix}.x</span>)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent Activity (real data) */}
        <Card className="hover-elevate lg:col-span-2 border-white/[0.07] bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Actividad Reciente
                </CardTitle>
                <CardDescription>{isAdmin ? "Últimas transacciones del sistema" : "Tus últimas transacciones"}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/registros")} data-testid="link-all-records">
                Ver todo <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground" data-testid="empty-activity">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Aún no tienes transacciones.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/transacciones")} data-testid="button-first-tx">
                  Crear primera transacción
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {recentActivity.map((tx) => {
                  const card = cardFromDescription(tx.description);
                  const isOk = tx.status === "completed";
                  const isFail = tx.status === "failed";
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors duration-200" style={{ animationDelay: `${recentActivity.indexOf(tx) * 45}ms` }} data-testid={`row-activity-${tx.transactionId}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOk ? "bg-green-500" : isFail ? "bg-red-500" : "bg-yellow-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{tx.transactionId}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {tx.protocol} · {TYPE_LABEL[tx.type] ?? tx.type}{card ? ` · ${card}` : ""}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold whitespace-nowrap">{fmtMoney(parseFloat(tx.amount || "0"))} <span className="text-[10px] font-normal text-muted-foreground">{tx.currency}</span></p>
                        <p className={`text-xs font-medium ${isOk ? "text-green-600" : isFail ? "text-red-600" : "text-yellow-600"}`}>
                          {isOk ? "Completada" : isFail ? "Rechazada" : tx.status === "processing" ? "Procesando" : "Pendiente"}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground hidden sm:block w-20 text-right">{relativeTime(tx.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Status + Quick Actions */}
        <div className="space-y-4">
          <Card className="hover-elevate">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-600" /> Estado del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "API Banking",    status: healthData?.bankingApi },
                { label: "Red VISA/MC",    status: healthData?.visaMcNetwork },
                { label: "SWIFT Gateway",  status: healthData?.swiftGateway },
                { label: "Base de Datos",  status: healthData?.database },
                { label: "Terminales POS", status: posLocked ? "locked" : healthData?.posTerminals },
                { label: "Seguridad AES",  status: healthData?.securityAes },
              ].map((item, i) => {
                const locked  = item.status === "locked";
                const ok      = !locked && (!item.status || item.status === "ok");
                const loading = !item.status && !locked;
                return (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-gray-400 animate-pulse" : locked ? "bg-red-500" : ok ? "bg-green-500" : "bg-yellow-500"}`} />
                      <span className="text-xs">{item.label}</span>
                    </div>
                    <span className={`text-xs font-semibold ${loading ? "text-muted-foreground" : locked ? "text-red-600" : ok ? "text-green-600" : "text-yellow-600"}`}>
                      {loading ? "—" : locked ? "Inactivo" : ok ? "Operativo" : "Degradado"}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#c8322b]" /> Acciones Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { label: "Nueva TX", icon: <ArrowRightLeft className="w-4 h-4" />, path: "/transacciones" },
                { label: "Caja", icon: <DollarSign className="w-4 h-4" />, path: "/caja" },
                { label: "Terminales", icon: <Store className="w-4 h-4" />, path: "/pos" },
                { label: "Registros", icon: <BarChart2 className="w-4 h-4" />, path: "/registros" },
                { label: "Exchange", icon: <Globe className="w-4 h-4" />, path: "/exchange" },
                { label: "Seguridad", icon: <ShieldCheck className="w-4 h-4" />, path: "/claves" },
              ].map((action, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="flex flex-col h-14 gap-1 text-xs"
                  onClick={() => setLocation(action.path)}
                  data-testid={`quick-action-${i}`}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alerts */}
      <Card className="hover-elevate border-yellow-500/20 bg-yellow-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-yellow-400">
            <AlertTriangle className="w-4 h-4" /> Alertas y Notificaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              stats.pending > 0
                ? { msg: `${stats.pending} ${stats.pending === 1 ? "transacción pendiente" : "transacciones pendientes"} de revisión`, type: "warn" }
                : { msg: "No hay transacciones pendientes de revisión", type: "info" },
              stats.failed > 0
                ? { msg: `${stats.failed} ${stats.failed === 1 ? "transacción rechazada" : "transacciones rechazadas"} recientemente`, type: "error" }
                : { msg: "Sin rechazos recientes en tus operaciones", type: "info" },
              healthData && healthData.failedLast24h > 0
                ? { msg: `${healthData.failedLast24h} transacción${healthData.failedLast24h > 1 ? "es" : ""} rechazada${healthData.failedLast24h > 1 ? "s" : ""} en las últimas 24 h — revisa los registros`, type: "warn" }
                : { msg: `Sistema estable · ${healthData?.activeTerminals ?? "—"} terminal${(healthData?.activeTerminals ?? 0) !== 1 ? "es" : ""} activa${(healthData?.activeTerminals ?? 0) !== 1 ? "s" : ""}`, type: "info" },
            ].map((alert, i) => (
              <div key={i} className={`flex items-start gap-2 p-2.5 rounded-md text-xs ${alert.type === "error" ? "bg-red-500/15 text-red-400" : alert.type === "warn" ? "bg-yellow-500/15 text-yellow-400" : "bg-blue-500/15 text-blue-400"}`}>
                {alert.type === "error" ? <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : alert.type === "warn" ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <Bell className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                <span>{alert.msg}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
