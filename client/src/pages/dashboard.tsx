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
  DollarSign, Users, Activity,
  ArrowRightLeft, ShieldCheck, Zap, Bell,
  Clock, CheckCircle, XCircle, AlertTriangle, BarChart2,
  Store, ChevronRight, Cpu, Globe, Inbox
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
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-greeting">
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
            <p className="text-2xl font-bold text-green-600" data-testid="balance">
              {fmtMoney(settings?.saldoSistemaUSD ?? 1250000)} <span className="text-sm font-semibold text-muted-foreground">USD</span>
            </p>
          </div>
          <Button size="sm" className="bg-[#c8322b] hover:bg-[#a62822]" onClick={() => setLocation("/transacciones")} data-testid="button-nueva-tx">
            <Zap className="w-4 h-4 mr-1" /> Nueva TX
          </Button>
        </div>
      </div>

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
          <Card key={i} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <div className={`w-8 h-8 rounded-md ${kpi.iconBg} flex items-center justify-center ${kpi.iconColor}`}>
                {kpi.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpi.valueColor}`} data-testid={`kpi-${i}`}>
                {kpi.value}
              </div>
              <p className="text-xs mt-0.5 text-muted-foreground">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Middle section */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hourly chart */}
        <Card className="hover-elevate lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#c8322b]" /> Actividad por Hora
                </CardTitle>
                <CardDescription>Transacciones reales · últimas 12 horas</CardDescription>
              </div>
              <Badge className="bg-green-100 text-green-700 no-default-active-elevate">En vivo</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-28">
              {hourlyData.map((val, i) => {
                const max = Math.max(...hourlyData, 1);
                const h = Math.round((val / max) * 100);
                const isLast = i === hourlyData.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-sm transition-all ${isLast ? "bg-[#c8322b]" : "bg-blue-400/70"}`}
                      style={{ height: `${Math.max(h, 3)}%` }}
                      title={`${val} tx`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
              {hourLabels.map(h => (
                <span key={h}>{h}</span>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400/70 inline-block" />Anteriores</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#c8322b] inline-block" />Actual</span>
            </div>
          </CardContent>
        </Card>

        {/* Protocol breakdown (real data) */}
        <Card className="hover-elevate">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="w-4 h-4 text-[#c8322b]" /> Distribución Protocolos
            </CardTitle>
            <CardDescription>{isAdmin ? "Sistema completo" : "Tus operaciones"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.total === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Sin datos todavía</p>
            ) : protocolStats.map((p, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold">{p.prefix}.x — {p.label}</span>
                  <span className="text-muted-foreground">{p.count}</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${p.color}`} style={{ width: `${p.pct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{p.pct}% del total</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent Activity (real data) */}
        <Card className="hover-elevate lg:col-span-2">
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
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors" data-testid={`row-activity-${tx.transactionId}`}>
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
