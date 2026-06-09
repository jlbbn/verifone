import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  DollarSign, TrendingUp, TrendingDown, Users, Activity,
  ArrowRightLeft, CreditCard, ShieldCheck, Zap, Bell,
  Clock, CheckCircle, XCircle, AlertTriangle, BarChart2,
  Store, RefreshCw, ChevronRight, Cpu, Globe
} from "lucide-react";

const recentActivity = [
  { id: "TXN-8821", amount: 680000, protocol: "101.3", name: "Transferencia segura", time: "Hace 2 min", status: "completed", type: "transfer", card: "VISA" },
  { id: "TXN-8820", amount: 1200000, protocol: "201.2", name: "Pago internacional", time: "Hace 5 min", status: "completed", type: "payment", card: "AMEX" },
  { id: "TXN-8819", amount: 450000, protocol: "101.2", name: "Transferencia con validación", time: "Hace 8 min", status: "completed", type: "transfer", card: "Mastercard" },
  { id: "TXN-8818", amount: 890000, protocol: "201.3", name: "Pago express", time: "Hace 12 min", status: "completed", type: "payment", card: "VISA" },
  { id: "TXN-8817", amount: 1500000, protocol: "101.3", name: "Transferencia segura", time: "Hace 15 min", status: "failed", type: "transfer", card: "Mastercard" },
  { id: "TXN-8816", amount: 320000, protocol: "301.1", name: "Depósito cuenta", time: "Hace 18 min", status: "completed", type: "deposit", card: "Débito" },
  { id: "TXN-8815", amount: 750000, protocol: "401.1", name: "Retiro ATM", time: "Hace 21 min", status: "completed", type: "withdrawal", card: "VISA" },
];

const protocolStats = [
  { code: "101.x", label: "Transferencias", count: 847, pct: 46, color: "bg-blue-500" },
  { code: "201.x", label: "Pagos", count: 621, pct: 34, color: "bg-[#c8322b]" },
  { code: "301.x", label: "Depósitos", count: 248, pct: 13, color: "bg-green-500" },
  { code: "401.x", label: "Retiros", count: 131, pct: 7, color: "bg-yellow-500" },
];

const hourlyData = [42, 58, 71, 65, 89, 94, 108, 127, 143, 138, 156, 172];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const { data: transactions = [] } = useQuery<any[]>({ queryKey: ["/api/transactions"] });

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const completedToday = transactions.filter(t => t.status === "completed").length;
  const totalVolume = transactions.reduce((s, t) => s + parseFloat(t.amount || "0"), 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-[#c8322b]" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentTime.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}{currentTime.toLocaleTimeString("es-MX")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Saldo Disponible</p>
            <p className="text-2xl font-bold text-green-600" data-testid="balance">$1,250,000.00 <span className="text-sm font-semibold text-muted-foreground">USD</span></p>
          </div>
          <Button size="sm" className="bg-[#c8322b] hover:bg-[#a62822]" onClick={() => setLocation("/transacciones")} data-testid="button-nueva-tx">
            <Zap className="w-4 h-4 mr-1" /> Nueva TX
          </Button>
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Transacciones Hoy", value: "1,847", sub: "+12% vs ayer",
            up: true, icon: <ArrowRightLeft className="w-4 h-4" />, color: "blue", bg: "bg-blue-100"
          },
          {
            title: "Volumen Total", value: "$2.4M", sub: "+8% vs ayer",
            up: true, icon: <DollarSign className="w-4 h-4" />, color: "emerald", bg: "bg-emerald-100"
          },
          {
            title: "Terminales Activas", value: "4 / 6", sub: "1 re-configurada",
            up: null, icon: <Store className="w-4 h-4" />, color: "purple", bg: "bg-purple-100"
          },
          {
            title: "Estado Sistema", value: "Online", sub: "Uptime 99.9%",
            up: null, icon: <Activity className="w-4 h-4" />, color: "green", bg: "bg-green-100"
          },
        ].map((kpi, i) => (
          <Card key={i} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <div className={`w-8 h-8 rounded-md ${kpi.bg} flex items-center justify-center text-${kpi.color}-600`}>
                {kpi.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpi.color === "green" ? "text-green-600" : kpi.color === "emerald" ? "text-emerald-600" : ""}`}>
                {kpi.value}
              </div>
              <p className={`text-xs mt-0.5 flex items-center gap-1 ${kpi.up === true ? "text-green-600" : kpi.up === false ? "text-red-600" : "text-muted-foreground"}`}>
                {kpi.up === true && <TrendingUp className="w-3 h-3" />}
                {kpi.up === false && <TrendingDown className="w-3 h-3" />}
                {kpi.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Middle section */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hourly chart (simulated bars) */}
        <Card className="hover-elevate lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#c8322b]" /> Transacciones por Hora
                </CardTitle>
                <CardDescription>Últimas 12 horas</CardDescription>
              </div>
              <Badge className="bg-green-100 text-green-700 no-default-active-elevate">En vivo</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-28">
              {hourlyData.map((val, i) => {
                const max = Math.max(...hourlyData);
                const h = Math.round((val / max) * 100);
                const isLast = i === hourlyData.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-sm transition-all ${isLast ? "bg-[#c8322b]" : "bg-blue-400/70"}`}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
              {["10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm", "8pm", "9pm"].map(h => (
                <span key={h}>{h}</span>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400/70 inline-block" />Anteriores</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#c8322b] inline-block" />Actual</span>
            </div>
          </CardContent>
        </Card>

        {/* Protocol breakdown */}
        <Card className="hover-elevate">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="w-4 h-4 text-[#c8322b]" /> Distribución Protocolos
            </CardTitle>
            <CardDescription>Uso de hoy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {protocolStats.map((p, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold">{p.code} — {p.label}</span>
                  <span className="text-muted-foreground">{p.count}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
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
        {/* Recent Activity */}
        <Card className="hover-elevate lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Actividad Reciente
                </CardTitle>
                <CardDescription>Últimas transacciones procesadas</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/registros")} data-testid="link-all-records">
                Ver todo <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentActivity.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors" data-testid={`row-activity-${tx.id}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tx.status === "completed" ? "bg-green-500" : "bg-red-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{tx.id}</p>
                    <p className="text-xs text-muted-foreground">{tx.protocol} · {tx.name} · {tx.card}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold">${(tx.amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                    <p className={`text-xs font-medium ${tx.status === "completed" ? "text-green-600" : "text-red-600"}`}>
                      {tx.status === "completed" ? "Completada" : "Fallida"}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground hidden sm:block w-20 text-right">{tx.time}</span>
                </div>
              ))}
            </div>
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
                { label: "API Banking", ok: true },
                { label: "Red VISA/MC", ok: true },
                { label: "SWIFT Gateway", ok: true },
                { label: "Base de Datos", ok: true },
                { label: "Terminales POS", ok: true },
                { label: "Seguridad AES", ok: true },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${item.ok ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-xs">{item.label}</span>
                  </div>
                  <span className={`text-xs font-semibold ${item.ok ? "text-green-600" : "text-red-600"}`}>
                    {item.ok ? "Operativo" : "Error"}
                  </span>
                </div>
              ))}
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
      <Card className="hover-elevate border-yellow-200 bg-yellow-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-yellow-700">
            <AlertTriangle className="w-4 h-4" /> Alertas y Notificaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { msg: "Terminal T1003 (PAX S920) desconectada en Sucursal Sur", type: "error" },
              { msg: "3 transacciones pendientes de revisión manual", type: "warn" },
              { msg: "Rotación de claves programada para mañana 00:00 hrs", type: "info" },
            ].map((alert, i) => (
              <div key={i} className={`flex items-start gap-2 p-2.5 rounded-md text-xs ${alert.type === "error" ? "bg-red-100 text-red-700" : alert.type === "warn" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>
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
