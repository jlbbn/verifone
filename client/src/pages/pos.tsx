import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Store, CheckCircle, XCircle, Clock, Activity, DollarSign,
  AlertTriangle, Wifi, WifiOff, RefreshCw, Settings, Zap,
  MapPin, Signal, ShieldCheck, Terminal, Eye, Power,
  TrendingUp, TrendingDown, Filter, Search
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CalendarClock, PlusCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Calcula el estado de la suscripción (plan de 12 meses) a partir de su fecha de inicio.
function getSubscriptionInfo(startIso: string | null | undefined) {
  if (!startIso) return null;
  const start = new Date(startIso);
  if (isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setMonth(end.getMonth() + 12);
  const now = new Date();
  const msDay = 86400000;
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / msDay));
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msDay));
  const monthsRemaining = Math.max(0, Math.min(12, Math.round(daysRemaining / (totalDays / 12))));
  const progress = Math.min(100, Math.max(0, Math.round(((totalDays - daysRemaining) / totalDays) * 100)));
  const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  return { start, end, totalDays, daysRemaining, monthsRemaining, progress, startLabel: fmt(start), endLabel: fmt(end) };
}

interface TimeZoneInfo {
  city: string;
  timezone: string;
  time: string;
  date: string;
}

interface POSTerminal {
  id: string;
  model: string;
  serial: string;
  status: "Online" | "Offline" | "Idle" | "Reconfigured";
  transactions: number;
  amount: number;
  efficiency: number;
  location: string;
  uptime: string;
  lastTx: string;
  firmware: string;
  ip: string;
  signalStrength: number;
  emv: boolean;
  nfc: boolean;
  pinpad: boolean;
  configNote?: string;
  owner?: string;
}

const initialTerminals: POSTerminal[] = [
  {
    id: "T1001", model: "Verifone VX 690", serial: "VFN-VX690-A4821", status: "Online",
    transactions: 542, amount: 2304567.89, efficiency: 98, location: "Sucursal Centro",
    uptime: "99.8%", lastTx: "Hace 12 seg", firmware: "v3.4.1", ip: "192.168.1.101",
    signalStrength: 95, emv: true, nfc: true, pinpad: true
  },
  {
    id: "T1002", model: "Ingenico iCT220", serial: "ING-ICT220-B3341", status: "Online",
    transactions: 321, amount: 1850234.50, efficiency: 95, location: "Sucursal Norte",
    uptime: "99.5%", lastTx: "Hace 28 seg", firmware: "v2.8.3", ip: "192.168.1.102",
    signalStrength: 88, emv: true, nfc: false, pinpad: true
  },
  {
    id: "T1003", model: "PAX S920", serial: "PAX-S920-C1198", status: "Offline",
    transactions: 198, amount: 674305.00, efficiency: 82, location: "Sucursal Sur",
    uptime: "87.2%", lastTx: "Hace 2 hrs", firmware: "v1.9.7", ip: "192.168.1.103",
    signalStrength: 0, emv: true, nfc: false, pinpad: true
  },
  {
    id: "T1004", model: "Verifone VX 520", serial: "VFN-VX520-D2276", status: "Online",
    transactions: 456, amount: 3186003.20, efficiency: 96, location: "Sucursal Oeste",
    uptime: "99.6%", lastTx: "Hace 5 seg", firmware: "v4.1.0", ip: "192.168.1.104",
    signalStrength: 99, emv: true, nfc: true, pinpad: true
  },
  {
    id: "T1005", model: "Ingenico iWL250", serial: "ING-IWL250-E5503", status: "Online",
    transactions: 330, amount: 1953806.75, efficiency: 94, location: "Sucursal Este",
    uptime: "99.3%", lastTx: "Hace 45 seg", firmware: "v3.0.2", ip: "192.168.1.105",
    signalStrength: 72, emv: true, nfc: true, pinpad: true,
    owner: "angoestradacontacto@gmail.com"
  },
  {
    id: "T1006", model: "Verifone V660p", serial: "VFN-V660P-2024-001", status: "Reconfigured",
    transactions: 0, amount: 0, efficiency: 100, location: "Nueva Terminal",
    uptime: "100%", lastTx: "Sin transacciones", firmware: "v5.0.1-LATEST", ip: "192.168.1.106",
    signalStrength: 100, emv: true, nfc: true, pinpad: true,
    configNote: "Re-configurada — Lista para Operar"
  },
];

const POS_MODELS = [
  "Verifone VX 690",
  "Verifone VX 520",
  "Verifone V660p",
  "Ingenico iCT220",
  "Ingenico iWL250",
  "Ingenico Move 5000",
  "PAX S920",
  "PAX A920",
  "PAX S300",
];

const recentTransactions = [
  { terminal: "T1001", type: "VISA", amount: 1250.00, time: "Hace 12 seg", status: "Aprobada", authCode: "AUTH-8821" },
  { terminal: "T1004", type: "Mastercard", amount: 3892.50, time: "Hace 1 min", status: "Aprobada", authCode: "AUTH-4459" },
  { terminal: "T1002", type: "AMEX", amount: 850.00, time: "Hace 2 min", status: "Aprobada", authCode: "AUTH-7732" },
  { terminal: "T1005", type: "VISA", amount: 620.75, time: "Hace 3 min", status: "Aprobada", authCode: "AUTH-9913" },
  { terminal: "T1003", type: "Mastercard", amount: 450.00, time: "Hace 12 min", status: "Rechazada", authCode: "—" },
  { terminal: "T1004", type: "VISA", amount: 2100.00, time: "Hace 15 min", status: "Aprobada", authCode: "AUTH-3345" },
  { terminal: "T1001", type: "Débito", amount: 380.00, time: "Hace 18 min", status: "Aprobada", authCode: "AUTH-6678" },
];

function getStatusColor(status: POSTerminal["status"]) {
  switch (status) {
    case "Online": return "bg-green-500";
    case "Offline": return "bg-red-500";
    case "Idle": return "bg-yellow-400";
    case "Reconfigured": return "bg-blue-500";
  }
}

function getStatusBadge(status: POSTerminal["status"]) {
  switch (status) {
    case "Online": return <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate">Online</Badge>;
    case "Offline": return <Badge className="bg-red-100 text-red-700 border-red-200 no-default-active-elevate">Offline</Badge>;
    case "Idle": return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 no-default-active-elevate">Inactiva</Badge>;
    case "Reconfigured": return <Badge className="bg-blue-100 text-blue-700 border-blue-200 no-default-active-elevate">Re-configurada</Badge>;
  }
}

export default function POSPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [terminals, setTerminals] = useState<POSTerminal[]>(initialTerminals);
  const [timeZones, setTimeZones] = useState<TimeZoneInfo[]>([]);
  const [position, setPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const [contentWidth, setContentWidth] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedTerminal, setSelectedTerminal] = useState<POSTerminal | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Dialog "Vincular Terminal"
  const [vinculateOpen, setVinculateOpen] = useState(false);
  const [formUser, setFormUser] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formLocation, setFormLocation] = useState("");

  // Terminales propias del usuario (no-admin)
  const { data: myTerminals = [] } = useQuery<POSTerminal[]>({ queryKey: ["/api/terminals/mine"] });

  // Usuarios del sistema (solo admin, para el dropdown de vincular)
  const { data: allUsers = [] } = useQuery<{ username: string; fullName: string; email: string; role: string }[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });

  // Notificaciones (admin: para ver solicitudes pendientes de POS)
  const { data: notifData } = useQuery<{ notifications: { id: string; type: string; status: string; fromUser: string | null; message: string; title: string }[]; pending: number }>({
    queryKey: ["/api/notifications"],
  });
  const pendingPosRequests = isAdmin
    ? (notifData?.notifications ?? []).filter(n => n.type === "pos_request" && n.status === "pending")
    : [];

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      setLastUpdate(now);
      setTimeZones([
        {
          city: "System Time", timezone: "Local",
          time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
          date: now.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })
        },
        {
          city: "Mexico City", timezone: "America/Mexico_City",
          time: now.toLocaleTimeString("en-US", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
          date: now.toLocaleDateString("en-US", { timeZone: "America/Mexico_City", weekday: "short", year: "numeric", month: "short", day: "numeric" })
        },
        {
          city: "Los Angeles", timezone: "America/Los_Angeles",
          time: now.toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
          date: now.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", year: "numeric", month: "short", day: "numeric" })
        },
        {
          city: "New York", timezone: "America/New_York",
          time: now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
          date: now.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short", year: "numeric", month: "short", day: "numeric" })
        },
        {
          city: "Toronto", timezone: "America/Toronto",
          time: now.toLocaleTimeString("en-US", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
          date: now.toLocaleDateString("en-US", { timeZone: "America/Toronto", weekday: "short", year: "numeric", month: "short", day: "numeric" })
        },
        {
          city: "London", timezone: "Europe/London",
          time: now.toLocaleTimeString("en-US", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
          date: now.toLocaleDateString("en-US", { timeZone: "Europe/London", weekday: "short", year: "numeric", month: "short", day: "numeric" })
        },
      ]);
    };
    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (contentRef.current) setContentWidth(contentRef.current.scrollWidth / 3);
  }, [timeZones]);

  useEffect(() => {
    if (contentWidth === 0) return;
    const animate = () => {
      setPosition((prev) => {
        const newPos = prev - 0.7;
        return newPos <= -contentWidth ? newPos % contentWidth : newPos;
      });
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [contentWidth]);

  const filteredTerminals = terminals.filter((t) => {
    const matchSearch = t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = selectedStatus === "all" || t.status.toLowerCase() === selectedStatus;
    return matchSearch && matchStatus;
  });

  const onlineCount = terminals.filter(t => t.status === "Online" || t.status === "Reconfigured").length;

  function handleRefresh() {
    const next = terminals.map(t => t.status === "Offline" ? t : {
      ...t,
      signalStrength: Math.max(55, Math.min(100, t.signalStrength + Math.round((Math.random() - 0.5) * 10))),
      lastTx: "Hace 1 seg",
    });
    setTerminals(next);
    setLastUpdate(new Date());
    if (selectedTerminal) setSelectedTerminal(next.find(t => t.id === selectedTerminal.id) ?? selectedTerminal);
    toast({ title: "Terminales actualizadas", description: `${onlineCount} de ${terminals.length} terminales operativas.` });
  }

  function handleConfig(terminal: POSTerminal) {
    const updated: POSTerminal = { ...terminal, status: "Reconfigured", configNote: "Re-configurada ahora — Lista para Operar" };
    setTerminals(prev => prev.map(t => t.id === terminal.id ? updated : t));
    setSelectedTerminal(updated);
    toast({ title: `Terminal ${terminal.id} configurada`, description: "Parámetros aplicados y verificados correctamente." });
  }

  function handleReset(terminal: POSTerminal) {
    const updated: POSTerminal = { ...terminal, status: "Idle", lastTx: "Reiniciada ahora", efficiency: 100, signalStrength: terminal.signalStrength || 80 };
    setTerminals(prev => prev.map(t => t.id === terminal.id ? updated : t));
    if (selectedTerminal?.id === terminal.id) setSelectedTerminal(updated);
    toast({ title: `Terminal ${terminal.id} reiniciada`, description: "La terminal se reinició y quedó en modo inactivo, lista para operar." });
  }

  function handleHeaderConfig() {
    if (selectedTerminal) {
      handleConfig(selectedTerminal);
    } else {
      toast({ title: "Configuración POS", description: "Selecciona una terminal de la lista para configurarla." });
    }
  }

  const requestPosMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/pos-request");
      return res.json() as Promise<{ success: boolean; duplicate: boolean }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: data.duplicate ? "Solicitud ya registrada" : "Solicitud enviada",
        description: data.duplicate
          ? "Ya tienes una solicitud de POS pendiente. El administrador la revisará pronto."
          : "Tu solicitud fue enviada al administrador. Te notificaremos cuando sea atendida.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar la solicitud. Intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  function handleRequestPos() {
    requestPosMutation.mutate();
  }

  const vinculateMutation = useMutation({
    mutationFn: async (data: { ownerUsername: string; model: string; location: string }) => {
      const res = await apiRequest("POST", "/api/terminals", data);
      return res.json() as Promise<POSTerminal>;
    },
    onSuccess: (terminal) => {
      setTerminals(prev => [...prev, terminal]);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/terminals/mine"] });
      setVinculateOpen(false);
      setFormUser("");
      setFormModel("");
      setFormLocation("");
      toast({
        title: "Terminal vinculada",
        description: `${terminal.terminalId} (${terminal.model}) asignada correctamente.`,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la terminal. Intenta de nuevo.", variant: "destructive" });
    },
  });

  function openVinculate(preUser = "") {
    setFormUser(preUser);
    setFormModel("");
    setFormLocation("");
    setVinculateOpen(true);
  }

  if (!isAdmin) {
    const sub = getSubscriptionInfo(user?.subscriptionStart);

    const subscriptionBanner = sub ? (
      <Card data-testid="card-subscription">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-md bg-[#c8322b]/10 flex items-center justify-center flex-shrink-0">
                <CalendarClock className="w-5 h-5 text-[#c8322b]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold">Suscripción activa</p>
                  <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate">Plan 12 meses</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-subscription-legend">
                  Te quedan <span className="font-semibold text-foreground">{sub.monthsRemaining} meses activos de servicio</span>.
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Vigencia: {sub.startLabel} — {sub.endLabel}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-[#c8322b] leading-none" data-testid="text-days-remaining">{sub.daysRemaining}</p>
              <p className="text-xs text-muted-foreground mt-1">días restantes</p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-[#c8322b]" style={{ width: `${sub.progress}%` }} data-testid="bar-subscription-progress" />
          </div>
        </CardContent>
      </Card>
    ) : null;

    // Common user WITHOUT an assigned terminal → "no POS" legend
    if (myTerminals.length === 0) {
      return (
        <div className="p-4 md:p-6 space-y-5">
          {/* Header */}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Terminal className="w-7 h-7 text-[#c8322b]" />
              Enrutamiento POS
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Terminal punto de venta · {user?.fullName ?? "Usuario"}</p>
          </div>

          {subscriptionBanner}

          {/* No active terminal legend */}
          <Card className="border-2 border-dashed border-[#c8322b]/40">
            <CardContent className="py-12 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#c8322b]/10 flex items-center justify-center">
                <WifiOff className="w-8 h-8 text-[#c8322b]" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h2 className="text-xl font-bold" data-testid="text-no-terminal-title">No POS running — Sin terminal POS activa</h2>
                <p className="text-sm text-muted-foreground">
                  Actualmente no cuentas con una terminal asignada a tu cuenta ni transacciones registradas. Contacta al administrador para que configure (deploy) un nuevo POS para tu usuario.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-md" data-testid="status-no-terminal">
                <AlertTriangle className="w-3.5 h-3.5" />
                Estado: Sin terminal configurada · Contact admin to deploy POS
              </div>
              <Button className="bg-[#c8322b] hover:bg-[#a62822]" onClick={handleRequestPos} data-testid="button-request-pos">
                <Settings className="w-4 h-4 mr-2" /> Solicitar configuración de POS
              </Button>
            </CardContent>
          </Card>

          {/* Limited info note */}
          <Card className="hover-elevate">
            <CardContent className="pt-4 pb-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Acceso limitado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Como usuario estándar, solo puedes ver y operar tu propia terminal una vez configurada. La administración y el monitoreo global de terminales están reservados al administrador.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Common user WITH an assigned terminal → limited, read-only view of own terminal(s)
    const myTx = recentTransactions.filter(rt => myTerminals.some(t => t.id === rt.terminal));
    return (
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Terminal className="w-7 h-7 text-[#c8322b]" />
            Mi Terminal POS
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Terminal punto de venta · {user?.fullName ?? "Usuario"}</p>
        </div>

        {subscriptionBanner}

        {/* Limited access note */}
        <Card>
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">Acceso limitado</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Solo puedes consultar tu propia terminal. La configuración de terminales y el monitoreo global están reservados al administrador.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* My terminals (read-only) */}
        {myTerminals.map((t) => (
          <Card key={t.id} data-testid={`card-my-terminal-${t.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-[#c8322b]/10 flex items-center justify-center">
                    <Terminal className="w-5 h-5 text-[#c8322b]" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {t.id}
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(t.status)}`} />
                    </CardTitle>
                    <CardDescription>{t.model} · {t.location}</CardDescription>
                  </div>
                </div>
                {getStatusBadge(t.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Transacciones</p>
                  <p className="text-lg font-bold" data-testid={`text-tx-count-${t.id}`}>{t.transactions}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto procesado</p>
                  <p className="text-lg font-bold">${t.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Eficiencia</p>
                  <p className="text-lg font-bold">{t.efficiency}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                  <p className="text-lg font-bold">{t.uptime}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md"><Signal className="w-3 h-3" /> Señal {t.signalStrength}%</span>
                <span className="bg-muted px-2 py-1 rounded-md">Firmware {t.firmware}</span>
                <span className="bg-muted px-2 py-1 rounded-md">Última TX: {t.lastTx}</span>
                {t.emv && <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate">EMV</Badge>}
                {t.nfc && <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate">NFC</Badge>}
                {t.pinpad && <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate">PIN Pad</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* My recent transactions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mis Transacciones Recientes</CardTitle>
            <CardDescription>Movimientos de tu terminal</CardDescription>
          </CardHeader>
          <CardContent>
            {myTx.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center" data-testid="text-no-my-tx">Sin transacciones recientes en tu terminal.</p>
            ) : (
              <div className="space-y-2">
                {myTx.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 flex-wrap py-2 border-b border-border last:border-0" data-testid={`row-my-tx-${i}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground">{tx.terminal}</span>
                      <span className="text-sm font-medium">{tx.type}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">${tx.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                      <Badge className={tx.status === "Aprobada"
                        ? "bg-green-100 text-green-700 border-green-200 no-default-active-elevate"
                        : "bg-red-100 text-red-700 border-red-200 no-default-active-elevate"}>{tx.status}</Badge>
                      <span className="text-[10px] text-muted-foreground w-16 text-right hidden sm:block">{tx.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Time Zone Ticker */}
      <div ref={containerRef} className="bg-black h-[48px] overflow-hidden relative border-b border-gray-800">
        <div
          ref={contentRef}
          className="flex items-center h-full absolute left-0 top-0 whitespace-nowrap"
          style={{ transform: `translateX(${position}px)` }}
        >
          {Array(3).fill(null).map((_, ci) => (
            <div key={ci} className="flex items-center">
              {timeZones.map((zone, idx) => (
                <div key={`${ci}-${idx}`} className="inline-flex items-center text-white font-mono text-sm px-6">
                  <span className="text-[#c8322b] text-xs mr-2">●</span>
                  <span className="font-semibold mr-2 text-gray-300">{zone.city}:</span>
                  <span className="font-bold mr-1">{zone.time}</span>
                  <span className="text-gray-500 text-xs ml-2">| {zone.date}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Terminal className="w-7 h-7 text-[#c8322b]" />
              Enrutamiento POS
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitoreo en tiempo real · {terminals.length} terminales registradas · {onlineCount} operativas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Actualizado: {lastUpdate.toLocaleTimeString("es-MX")}
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh-pos">
              <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
            </Button>
            <Button size="sm" className="bg-[#c8322b] text-white" onClick={handleHeaderConfig} data-testid="button-add-terminal">
              <Settings className="w-4 h-4 mr-1" /> Configurar
            </Button>
            <Button size="sm" className="bg-[#c8322b] text-white" onClick={() => openVinculate()} data-testid="button-vinculate-terminal">
              <PlusCircle className="w-4 h-4 mr-1" /> Vincular Terminal
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Terminales Activas</CardTitle>
              <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center">
                <Store className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{onlineCount}</div>
              <p className="text-xs text-muted-foreground mt-0.5">de {terminals.length} terminales</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${(onlineCount / terminals.length) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-green-600">{Math.round((onlineCount / terminals.length) * 100)}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transacciones Hoy</CardTitle>
              <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">1,847</div>
              <div className="flex items-center gap-1 mt-0.5">
                <TrendingUp className="w-3 h-3 text-green-600" />
                <p className="text-xs text-green-600 font-medium">+12.5% vs ayer</p>
              </div>
              <p className="text-xs text-muted-foreground">Promedio: 154 por hora</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Volumen Procesado</CardTitle>
              <div className="w-8 h-8 rounded-md bg-emerald-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">$542,890</div>
              <p className="text-xs text-muted-foreground mt-0.5">USD procesados hoy</p>
              <div className="flex items-center gap-1 mt-0.5">
                <TrendingUp className="w-3 h-3 text-green-600" />
                <p className="text-xs text-green-600 font-medium">+8.3% vs ayer</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Rechazo</CardTitle>
              <div className="w-8 h-8 rounded-md bg-red-100 flex items-center justify-center">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">1.2%</div>
              <div className="flex items-center gap-1 mt-0.5">
                <TrendingDown className="w-3 h-3 text-green-600" />
                <p className="text-xs text-green-600 font-medium">-0.3% vs ayer</p>
              </div>
              <p className="text-xs text-muted-foreground">23 rechazadas hoy</p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary metrics */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="hover-elevate">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Tiempo Promedio</p>
                  <p className="text-2xl font-bold text-purple-600">2.3s</p>
                  <p className="text-xs text-green-600 flex items-center gap-1"><TrendingDown className="w-3 h-3" />-0.2s vs ayer</p>
                </div>
                <div className="w-10 h-10 rounded-md bg-purple-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Tasa de Éxito</p>
                  <p className="text-2xl font-bold text-green-600">98.8%</p>
                  <p className="text-xs text-muted-foreground">Últimas 24 horas</p>
                </div>
                <div className="w-10 h-10 rounded-md bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Alertas Activas</p>
                  <p className="text-2xl font-bold text-yellow-600">3</p>
                  <p className="text-xs text-muted-foreground">Requieren atención</p>
                </div>
                <div className="w-10 h-10 rounded-md bg-yellow-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending POS Requests */}
        {pendingPosRequests.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/40">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <CardTitle className="text-base text-amber-800">Solicitudes pendientes de POS</CardTitle>
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 no-default-active-elevate">{pendingPosRequests.length}</Badge>
              </div>
              <CardDescription className="text-amber-700/80">Usuarios que requieren configuración de terminal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingPosRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between gap-3 flex-wrap py-2 border-b border-amber-200 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">{req.title}</p>
                    <p className="text-xs text-amber-700">{req.fromUser}</p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-[#c8322b] text-white"
                    onClick={() => openVinculate(req.fromUser ?? "")}
                    data-testid={`button-vinculate-${req.fromUser}`}
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1" /> Vincular Terminal
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Terminals Table */}
        <Card className="hover-elevate">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> Terminales POS Registradas
                </CardTitle>
                <CardDescription>Estado en tiempo real y métricas de rendimiento</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar terminal..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 w-44 text-sm"
                    data-testid="input-search-terminal"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {["all", "online", "offline", "idle", "reconfigured"].map(s => (
                    <button
                      key={s}
                      onClick={() => setSelectedStatus(s)}
                      data-testid={`filter-status-${s}`}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${selectedStatus === s ? "bg-[#c8322b] text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      {s === "all" ? "Todas" : s === "reconfigured" ? "Reconf." : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredTerminals.map((pos) => (
                <div
                  key={pos.id}
                  className={`flex flex-wrap lg:flex-nowrap items-start lg:items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer ${selectedTerminal?.id === pos.id ? "bg-muted/40" : ""} ${pos.status === "Reconfigured" ? "bg-blue-50/60 hover:bg-blue-50" : ""}`}
                  onClick={() => setSelectedTerminal(selectedTerminal?.id === pos.id ? null : pos)}
                  data-testid={`row-terminal-${pos.id}`}
                >
                  {/* Status dot */}
                  <div className="relative flex-shrink-0 mt-1">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(pos.status)}`} />
                    {(pos.status === "Online" || pos.status === "Reconfigured") && (
                      <div className={`absolute inset-0 w-3 h-3 rounded-full ${getStatusColor(pos.status)} animate-ping opacity-50`} />
                    )}
                  </div>

                  {/* Terminal Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-base">{pos.id}</span>
                      {getStatusBadge(pos.status)}
                      {pos.status === "Reconfigured" && (
                        <Badge className="bg-blue-600 text-white text-xs no-default-active-elevate">
                          <Zap className="w-3 h-3 mr-1" /> Lista para Operar
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{pos.model}</p>
                    {pos.configNote && (
                      <p className="text-xs text-blue-700 font-medium mt-0.5">{pos.configNote}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {pos.location}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {pos.lastTx}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">{pos.ip}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">FW: <span className="font-semibold text-foreground">{pos.firmware}</span></span>
                      <span className="text-xs text-muted-foreground">S/N: <span className="font-mono text-xs">{pos.serial}</span></span>
                      <div className="flex items-center gap-1">
                        {pos.emv && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">EMV</span>}
                        {pos.nfc && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">NFC</span>}
                        {pos.pinpad && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">PIN</span>}
                      </div>
                    </div>
                  </div>

                  {/* Signal & Uptime */}
                  <div className="hidden md:flex flex-col items-center gap-1 min-w-[80px]">
                    <div className="flex items-center gap-1">
                      {pos.status === "Offline" ? (
                        <WifiOff className="w-4 h-4 text-red-500" />
                      ) : (
                        <Signal className="w-4 h-4 text-green-500" />
                      )}
                      <span className="text-sm font-bold">{pos.signalStrength}%</span>
                    </div>
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pos.signalStrength > 70 ? "bg-green-500" : pos.signalStrength > 30 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${pos.signalStrength}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Señal</span>
                  </div>

                  {/* Stats */}
                  <div className="text-right min-w-[160px]">
                    <p className="font-bold text-lg text-green-600">
                      ${pos.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">{pos.transactions} transacciones</p>
                    <div className="flex items-center gap-1.5 justify-end mt-1">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pos.efficiency >= 95 ? "bg-green-500" : pos.efficiency >= 85 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${pos.efficiency}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold">{pos.efficiency}%</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Uptime: {pos.uptime}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 ml-2">
                    <Button variant="outline" size="sm" className="text-xs h-7 px-2" data-testid={`button-details-${pos.id}`}
                      onClick={e => { e.stopPropagation(); setSelectedTerminal(selectedTerminal?.id === pos.id ? null : pos); }}>
                      <Eye className="w-3 h-3 mr-1" /> Ver
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7 px-2" data-testid={`button-config-${pos.id}`}
                      onClick={e => { e.stopPropagation(); handleConfig(pos); }}>
                      <Settings className="w-3 h-3 mr-1" /> Config
                    </Button>
                    {pos.status !== "Offline" && (
                      <Button variant="outline" size="sm" className="text-xs h-7 px-2 text-red-600 hover:text-red-700"
                        data-testid={`button-power-${pos.id}`} onClick={e => { e.stopPropagation(); handleReset(pos); }}>
                        <Power className="w-3 h-3 mr-1" /> Reset
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Terminal Detail Panel */}
        {selectedTerminal && (
          <Card className="border-[#c8322b] border-2 hover-elevate">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-[#c8322b]">
                  <Terminal className="w-5 h-5" />
                  Detalle: {selectedTerminal.id} — {selectedTerminal.model}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTerminal(null)} data-testid="button-close-detail">
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Número de Serie", value: selectedTerminal.serial, icon: <Terminal className="w-4 h-4" /> },
                  { label: "Firmware", value: selectedTerminal.firmware, icon: <Settings className="w-4 h-4" /> },
                  { label: "Dirección IP", value: selectedTerminal.ip, icon: <Wifi className="w-4 h-4" /> },
                  { label: "Uptime", value: selectedTerminal.uptime, icon: <Activity className="w-4 h-4" /> },
                  { label: "Última Transacción", value: selectedTerminal.lastTx, icon: <Clock className="w-4 h-4" /> },
                  { label: "Eficiencia", value: `${selectedTerminal.efficiency}%`, icon: <Zap className="w-4 h-4" /> },
                  { label: "Transacciones", value: selectedTerminal.transactions.toString(), icon: <CheckCircle className="w-4 h-4" /> },
                  { label: "Volumen Total", value: `$${selectedTerminal.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: <DollarSign className="w-4 h-4" /> },
                ].map((item, i) => (
                  <div key={i} className="bg-muted/40 rounded-md p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      {item.icon}
                      <span className="text-xs">{item.label}</span>
                    </div>
                    <p className="font-bold text-sm">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">EMV Certificada</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">PCI DSS Compliant</span>
                </div>
                {selectedTerminal.nfc && (
                  <div className="flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">NFC Habilitado</span>
                  </div>
                )}
                {selectedTerminal.status === "Reconfigured" && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-blue-700">Terminal Re-configurada — Lista para Operar</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bottom grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent Transactions */}
          <Card className="hover-elevate">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4" /> Últimas Transacciones
              </CardTitle>
              <CardDescription>Actividad reciente en tiempo real</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {recentTransactions.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors" data-testid={`row-tx-${i}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tx.status === "Aprobada" ? "bg-green-500" : "bg-red-500"}`} />
                      <div>
                        <p className="text-sm font-semibold">{tx.terminal} <span className="font-normal text-muted-foreground">·</span> <span className="text-muted-foreground font-normal">{tx.type}</span></p>
                        <p className="text-xs text-muted-foreground">{tx.time} · {tx.authCode}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">${tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                      <span className={`text-xs font-medium ${tx.status === "Aprobada" ? "text-green-600" : "text-red-600"}`}>{tx.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance */}
          <Card className="hover-elevate">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4" /> Rendimiento por Terminal
              </CardTitle>
              <CardDescription>Velocidad de procesamiento y tasa de éxito</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { terminal: "T1001", model: "VX 690", avgTime: "2.1s", success: 98, color: "green" },
                  { terminal: "T1002", model: "iCT220", avgTime: "2.4s", success: 95, color: "green" },
                  { terminal: "T1003", model: "PAX S920", avgTime: "3.8s", success: 82, color: "yellow" },
                  { terminal: "T1004", model: "VX 520", avgTime: "2.2s", success: 96, color: "green" },
                  { terminal: "T1005", model: "iWL250", avgTime: "2.5s", success: 94, color: "green" },
                  { terminal: "T1006", model: "V660p", avgTime: "—", success: 100, color: "blue" },
                ].map((perf, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${perf.color === "green" ? "bg-green-500" : perf.color === "yellow" ? "bg-yellow-500" : "bg-blue-500"}`} />
                    <span className="text-sm font-semibold w-14">{perf.terminal}</span>
                    <span className="text-xs text-muted-foreground w-20 hidden sm:block">{perf.model}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${perf.color === "green" ? "bg-green-500" : perf.color === "yellow" ? "bg-yellow-500" : "bg-blue-500"}`}
                            style={{ width: `${perf.success}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold w-8 text-right">{perf.success}%</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right font-mono">{perf.avgTime}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Sistema operativo desde: 2025-01-01</span>
            </div>
            <span className="font-medium">
              {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
            <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-semibold">Sistema Activo</span>
          </div>
        </div>
      </div>

      {/* Dialog: Vincular Terminal a Usuario */}
      <Dialog open={vinculateOpen} onOpenChange={setVinculateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#c8322b]" />
              Vincular Nueva Terminal POS
            </DialogTitle>
            <DialogDescription>
              Crea y asigna una terminal POS a un usuario del sistema. La terminal quedará activa de inmediato.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-1">
            {/* Usuario */}
            <div className="space-y-1.5">
              <Label htmlFor="v-user">Usuario</Label>
              <Select value={formUser} onValueChange={setFormUser}>
                <SelectTrigger id="v-user" data-testid="select-vinculate-user">
                  <SelectValue placeholder="Seleccionar usuario..." />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.filter(u => u.role !== "ADMIN").map(u => (
                    <SelectItem key={u.username} value={u.username}>
                      {u.fullName} — {u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modelo de Terminal */}
            <div className="space-y-1.5">
              <Label htmlFor="v-model">Modelo de Terminal</Label>
              <Select value={formModel} onValueChange={setFormModel}>
                <SelectTrigger id="v-model" data-testid="select-vinculate-model">
                  <SelectValue placeholder="Seleccionar modelo..." />
                </SelectTrigger>
                <SelectContent>
                  {POS_MODELS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ubicación */}
            <div className="space-y-1.5">
              <Label htmlFor="v-location">Ubicación</Label>
              <Input
                id="v-location"
                placeholder="Ej. Sucursal Centro, Oficina Principal..."
                value={formLocation}
                onChange={e => setFormLocation(e.target.value)}
                data-testid="input-vinculate-location"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setVinculateOpen(false)} data-testid="button-vinculate-cancel">
              Cancelar
            </Button>
            <Button
              className="bg-[#c8322b] text-white"
              disabled={!formUser || !formModel || !formLocation.trim() || vinculateMutation.isPending}
              onClick={() => vinculateMutation.mutate({ ownerUsername: formUser, model: formModel, location: formLocation.trim() })}
              data-testid="button-vinculate-submit"
            >
              {vinculateMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creando...</>
                : <><PlusCircle className="w-4 h-4 mr-1" /> Vincular Terminal</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
