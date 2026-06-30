import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
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
} from "lucide-react";

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
