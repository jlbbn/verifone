import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Store, CheckCircle, XCircle, Clock, Activity, DollarSign,
  AlertTriangle, Wifi, WifiOff, RefreshCw, Settings, Zap,
  MapPin, Signal, ShieldCheck, Terminal, Eye, Power,
  TrendingUp, TrendingDown, Search, Pencil, Cpu, Network, Hash,
  ChevronDown, ChevronUp, Info, TriangleAlert
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CalendarClock, PlusCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RoutingRule = {
  id: string; name: string; description: string | null;
  conditionField: string; conditionOperator: string; conditionValue: string;
  acquirer: string; priority: number; active: boolean; createdAt: string;
};
type RoutingDecision = {
  id: string; transactionId: string; ruleId: string | null; ruleName: string | null;
  acquirer: string; conditionMatched: string | null; responseTimeMs: number | null;
  approved: boolean; amount: string | null; currency: string | null;
  protocol: string | null; cardType: string | null; createdAt: string;
};
type TerminalCommand = {
  id: string; terminalId: string; command: string; status: string;
  notes: string | null; createdBy: string; createdAt: string; completedAt: string | null;
};

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
  terminalId: string;
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
  systemMessage?: string;
  owner?: string;
}

type ApiTerminal = {
  id: string;
  terminalId: string;
  model: string;
  location: string;
  status: string;
  emv: boolean;
  nfc: boolean;
  pinpad: boolean;
  configNote: string | null;
  systemMessage: string | null;
  owner: string | null;
  amount: number;
  transactions: number;
};

function augmentTerminal(t: ApiTerminal, overrides?: Partial<POSTerminal>): POSTerminal {
  const num = parseInt(t.terminalId.replace(/\D/g, ""), 10) || 1;
  const statusMap: Record<string, POSTerminal["status"]> = {
    online: "Online", offline: "Offline", idle: "Idle", reconfigured: "Reconfigured",
    Online: "Online", Offline: "Offline", Idle: "Idle", Reconfigured: "Reconfigured",
  };
  const prefix = (t.model.split(" ")[0] ?? "POS").toUpperCase().substring(0, 3);
  const base: POSTerminal = {
    id: t.id,
    terminalId: t.terminalId,
    model: t.model,
    location: t.location,
    status: statusMap[t.status] ?? "Online",
    configNote: t.configNote ?? undefined,
    systemMessage: t.systemMessage ?? undefined,
    owner: t.owner ?? undefined,
    emv: t.emv ?? true,
    nfc: t.nfc ?? true,
    pinpad: t.pinpad ?? true,
    serial: `${prefix}-${t.terminalId}-${String(((num * 1237) % 9000) + 1000)}`,
    firmware: `v${Math.floor(num / 3) + 1}.${(num * 7) % 10}.${(num * 3) % 10}`,
    ip: `192.168.1.${100 + (num % 100)}`,
    signalStrength: t.status === "offline" ? 0 : Math.min(100, 60 + (num * 13) % 40),
    uptime: t.status === "offline" ? "0%" : `${(90 + ((num * 13) % 99) / 10).toFixed(1)}%`,
    lastTx: t.status === "offline" ? "Sin conexión" : `Hace ${((num % 5) + 1) * 10} seg`,
    transactions: t.transactions ?? 0,
    amount: t.amount ?? 0,
    efficiency: t.status === "offline" ? 70 + (num * 5) % 15 : Math.min(99, 90 + (num * 3) % 9),
  };
  return overrides ? { ...base, ...overrides } : base;
}

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
  { terminal: "T1001", type: "VISA",       amount: 1250.00, time: "Hace 12 seg", status: "Aprobada",  authCode: "AUTH-8821" },
  { terminal: "T1004", type: "Mastercard", amount: 3892.50, time: "Hace 1 min",  status: "Aprobada",  authCode: "AUTH-4459" },
  { terminal: "T1002", type: "AMEX",       amount:  850.00, time: "Hace 2 min",  status: "Aprobada",  authCode: "AUTH-7732" },
  { terminal: "T1005", type: "VISA",       amount:  620.75, time: "Hace 3 min",  status: "Aprobada",  authCode: "AUTH-9913" },
  { terminal: "T1003", type: "Mastercard", amount:  450.00, time: "Hace 12 min", status: "Rechazada", authCode: "—"         },
  { terminal: "T1004", type: "VISA",       amount: 2100.00, time: "Hace 15 min", status: "Aprobada",  authCode: "AUTH-3345" },
  { terminal: "T1001", type: "Débito",     amount:  380.00, time: "Hace 18 min", status: "Aprobada",  authCode: "AUTH-6678" },
];

function getStatusColor(status: POSTerminal["status"]) {
  switch (status) {
    case "Online":       return "bg-green-500";
    case "Offline":      return "bg-red-500";
    case "Idle":         return "bg-yellow-400";
    case "Reconfigured": return "bg-blue-500";
  }
}

function getStatusBadge(status: POSTerminal["status"]) {
  switch (status) {
    case "Online":       return <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate">Online</Badge>;
    case "Offline":      return <Badge className="bg-red-100 text-red-700 border-red-200 no-default-active-elevate">Offline</Badge>;
    case "Idle":         return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 no-default-active-elevate">Inactiva</Badge>;
    case "Reconfigured": return <Badge className="bg-blue-100 text-blue-700 border-blue-200 no-default-active-elevate">Re-configurada</Badge>;
  }
}

export default function POSPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

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
  const [terminalOverrides, setTerminalOverrides] = useState<Record<string, Partial<POSTerminal>>>({});

  // Dialog "Vincular Terminal"
  const [vinculateOpen, setVinculateOpen] = useState(false);
  const [formUser, setFormUser] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [formFirmware, setFormFirmware] = useState("");
  const [formIp, setFormIp] = useState("");
  const [formStatus, setFormStatus] = useState("reconfigured");
  const [formSignal, setFormSignal] = useState("100");
  const [formEmv, setFormEmv] = useState(true);
  const [formNfc, setFormNfc] = useState(true);
  const [formPinpad, setFormPinpad] = useState(true);
  const [formConfigNote, setFormConfigNote] = useState("");
  const [formAdvanced, setFormAdvanced] = useState(false);

  // Dialog "Editar Terminal"
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<POSTerminal | null>(null);
  const [editModel, setEditModel] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editSystemMessage, setEditSystemMessage] = useState("");
  const [editAmount, setEditAmount] = useState("");

  // Routing Rules dialog
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [ruleFormName, setRuleFormName] = useState("");
  const [ruleFormDesc, setRuleFormDesc] = useState("");
  const [ruleFormField, setRuleFormField] = useState("amount");
  const [ruleFormOp, setRuleFormOp] = useState("gt");
  const [ruleFormValue, setRuleFormValue] = useState("");
  const [ruleFormAcquirer, setRuleFormAcquirer] = useState("stripe");
  const [ruleFormPriority, setRuleFormPriority] = useState("100");
  const [ruleFormActive, setRuleFormActive] = useState(true);

  // Terminal for commands panel
  const [cmdTerminalId, setCmdTerminalId] = useState<string | null>(null);

  // Suscripción — bloqueo de enrutamiento si no ha pagado
  const { data: subData } = useQuery<{ routingLocked?: boolean; paymentWarning?: string }>({
    queryKey: ["/api/subscription"],
    enabled: !!user && !isAdmin,
  });
  const routingLocked = !!(subData?.routingLocked);

  // Terminales propias del usuario (no-admin)
  const { data: myApiTerminals = [] } = useQuery<ApiTerminal[]>({ queryKey: ["/api/terminals/mine"] });
  const myTerminals = useMemo(() => myApiTerminals.map(t => augmentTerminal(t)), [myApiTerminals]);

  // Terminales admin: todas
  const { data: apiTerminals = [], isLoading: terminalsLoading, refetch: refetchTerminals } = useQuery<ApiTerminal[]>({
    queryKey: ["/api/terminals"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const terminals = useMemo(
    () => apiTerminals.map(t => augmentTerminal(t, terminalOverrides[t.id])),
    [apiTerminals, terminalOverrides]
  );

  // Usuarios del sistema (solo admin)
  const { data: allUsers = [] } = useQuery<{ username: string; fullName: string; email: string; role: string }[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });

  // Routing rules + decisions + analytics (solo admin)
  const { data: routingRulesData = [], refetch: refetchRules } = useQuery<RoutingRule[]>({
    queryKey: ["/api/routing-rules"],
    enabled: isAdmin,
  });
  const { data: routingDecisionsData = [] } = useQuery<RoutingDecision[]>({
    queryKey: ["/api/routing-decisions"],
    enabled: isAdmin,
    refetchInterval: 15000,
  });
  const { data: routingAnalytics } = useQuery<{
    acquirerStats: { acquirer: string; total: number; approved: number; approvalRate: number; avgResponseMs: number }[];
    protocolStats: { protocol: string; total: number; approved: number; approvalRate: number }[];
    totalDecisions: number;
  }>({ queryKey: ["/api/routing-analytics"], enabled: isAdmin, refetchInterval: 30000 });

  // Terminal commands for selected terminal
  const { data: terminalCmds = [] } = useQuery<TerminalCommand[]>({
    queryKey: ["/api/terminals", cmdTerminalId, "commands"],
    queryFn: () => apiRequest("GET", `/api/terminals/${cmdTerminalId}/commands`).then(r => r.json()),
    enabled: isAdmin && !!cmdTerminalId,
    refetchInterval: 3000,
  });

  // Notificaciones
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
        { city: "System Time",  timezone: "Local",                  time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }), date: now.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }) },
        { city: "Mexico City",  timezone: "America/Mexico_City",    time: now.toLocaleTimeString("en-US", { timeZone: "America/Mexico_City",    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }), date: now.toLocaleDateString("en-US", { timeZone: "America/Mexico_City",    weekday: "short", year: "numeric", month: "short", day: "numeric" }) },
        { city: "Los Angeles",  timezone: "America/Los_Angeles",    time: now.toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles",    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }), date: now.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles",    weekday: "short", year: "numeric", month: "short", day: "numeric" }) },
        { city: "New York",     timezone: "America/New_York",       time: now.toLocaleTimeString("en-US", { timeZone: "America/New_York",       hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }), date: now.toLocaleDateString("en-US", { timeZone: "America/New_York",       weekday: "short", year: "numeric", month: "short", day: "numeric" }) },
        { city: "Toronto",      timezone: "America/Toronto",        time: now.toLocaleTimeString("en-US", { timeZone: "America/Toronto",        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }), date: now.toLocaleDateString("en-US", { timeZone: "America/Toronto",        weekday: "short", year: "numeric", month: "short", day: "numeric" }) },
        { city: "London",       timezone: "Europe/London",          time: now.toLocaleTimeString("en-US", { timeZone: "Europe/London",          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }), date: now.toLocaleDateString("en-US", { timeZone: "Europe/London",          weekday: "short", year: "numeric", month: "short", day: "numeric" }) },
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
    const matchSearch =
      t.terminalId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.owner ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = selectedStatus === "all" || t.status.toLowerCase() === selectedStatus;
    return matchSearch && matchStatus;
  });

  const onlineCount = terminals.filter(t => t.status === "Online" || t.status === "Reconfigured").length;

  function handleRefresh() {
    setTerminalOverrides(prev => {
      const next = { ...prev };
      terminals.forEach(t => {
        if (t.status !== "Offline") {
          next[t.id] = {
            ...(prev[t.id] ?? {}),
            signalStrength: Math.max(55, Math.min(100, t.signalStrength + Math.round((Math.random() - 0.5) * 10))),
            lastTx: "Hace 1 seg",
          };
        }
      });
      return next;
    });
    setLastUpdate(new Date());
    refetchTerminals();
    toast({ title: "Terminales actualizadas", description: `${onlineCount} de ${terminals.length} terminales operativas.` });
  }

  function openEdit(terminal: POSTerminal) {
    setEditTarget(terminal);
    setEditModel(terminal.model);
    setEditLocation(terminal.location);
    setEditStatus(terminal.status.toLowerCase());
    setEditNote(terminal.configNote ?? "");
    setEditSystemMessage(terminal.systemMessage ?? "");
    setEditAmount(String(terminal.amount ?? 0));
    setEditOpen(true);
  }

  function handleReset(terminal: POSTerminal) {
    setTerminalOverrides(prev => ({
      ...prev,
      [terminal.id]: { status: "Idle", lastTx: "Reiniciada ahora", efficiency: 100, signalStrength: terminal.signalStrength || 80 },
    }));
    if (selectedTerminal?.id === terminal.id) {
      setSelectedTerminal({ ...terminal, status: "Idle", lastTx: "Reiniciada ahora" });
    }
    toast({ title: `Terminal ${terminal.terminalId} reiniciada`, description: "La terminal se reinició y quedó en modo inactivo, lista para operar." });
  }

  function handleHeaderConfig() {
    if (selectedTerminal) openEdit(selectedTerminal);
    else toast({ title: "Configuración POS", description: "Selecciona una terminal de la lista para configurarla." });
  }

  // Mutation: editar terminal (PATCH)
  const editMutation = useMutation({
    mutationFn: async (data: { id: string; model: string; location: string; status: string; configNote: string | null; systemMessage: string | null; amount: number }) => {
      const { id, ...body } = data;
      const res = await apiRequest("PATCH", `/api/terminals/${id}`, body);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/terminals"] });
      setEditOpen(false);
      setEditTarget(null);
      if (selectedTerminal?.id === updated.id) setSelectedTerminal(null);
      toast({ title: "Terminal actualizada", description: "Los cambios se guardaron correctamente." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la terminal.", variant: "destructive" });
    },
  });

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
      toast({ title: "Error", description: "No se pudo enviar la solicitud. Intenta de nuevo.", variant: "destructive" });
    },
  });

  const vinculateMutation = useMutation({
    mutationFn: async (data: {
      ownerUsername: string; model: string; location: string;
      serial?: string; firmware?: string; ip?: string; status?: string;
      signalStrength?: number; emv: boolean; nfc: boolean; pinpad: boolean;
      configNote?: string;
    }) => {
      const res = await apiRequest("POST", "/api/terminals", data);
      return res.json() as Promise<ApiTerminal>;
    },
    onSuccess: (terminal) => {
      queryClient.invalidateQueries({ queryKey: ["/api/terminals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/terminals/mine"] });
      setVinculateOpen(false);
      setFormUser(""); setFormModel(""); setFormLocation("");
      setFormSerial(""); setFormFirmware(""); setFormIp("");
      setFormStatus("reconfigured"); setFormSignal("100");
      setFormEmv(true); setFormNfc(true); setFormPinpad(true);
      setFormConfigNote(""); setFormAdvanced(false);
      toast({ title: "Terminal vinculada", description: `${terminal.terminalId} (${terminal.model}) asignada correctamente.` });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la terminal. Intenta de nuevo.", variant: "destructive" });
    },
  });

  function openVinculate(preUser = "") {
    setFormUser(preUser); setFormModel(""); setFormLocation("");
    setFormSerial(""); setFormFirmware(""); setFormIp("");
    setFormStatus("reconfigured"); setFormSignal("100");
    setFormEmv(true); setFormNfc(true); setFormPinpad(true);
    setFormConfigNote(""); setFormAdvanced(false);
    setVinculateOpen(true);
  }

  // Routing Rules mutations
  const createRuleMutation = useMutation({
    mutationFn: async (data: object) => {
      const res = await apiRequest("POST", "/api/routing-rules", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routing-rules"] });
      setRuleDialogOpen(false);
      toast({ title: "Regla creada", description: "La regla de enrutamiento fue agregada." });
    },
    onError: () => toast({ title: "Error", description: "No se pudo crear la regla.", variant: "destructive" }),
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [k: string]: unknown }) => {
      const res = await apiRequest("PATCH", `/api/routing-rules/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routing-rules"] });
      setRuleDialogOpen(false);
      toast({ title: "Regla actualizada" });
    },
    onError: () => toast({ title: "Error", description: "No se pudo actualizar la regla.", variant: "destructive" }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/routing-rules/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routing-rules"] });
      toast({ title: "Regla eliminada" });
    },
    onError: () => toast({ title: "Error", description: "No se pudo eliminar la regla.", variant: "destructive" }),
  });

  const sendCommandMutation = useMutation({
    mutationFn: async ({ terminalId, command, notes }: { terminalId: string; command: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/terminals/${terminalId}/commands`, { command, notes });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/terminals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/terminals", vars.terminalId, "commands"] });
      toast({ title: "Comando enviado", description: "El comando fue enviado a la terminal." });
    },
    onError: () => toast({ title: "Error", description: "No se pudo enviar el comando.", variant: "destructive" }),
  });

  function openRuleDialog(rule?: RoutingRule) {
    if (rule) {
      setEditingRule(rule);
      setRuleFormName(rule.name);
      setRuleFormDesc(rule.description ?? "");
      setRuleFormField(rule.conditionField);
      setRuleFormOp(rule.conditionOperator);
      setRuleFormValue(rule.conditionValue);
      setRuleFormAcquirer(rule.acquirer);
      setRuleFormPriority(String(rule.priority));
      setRuleFormActive(rule.active);
    } else {
      setEditingRule(null);
      setRuleFormName(""); setRuleFormDesc("");
      setRuleFormField("amount"); setRuleFormOp("gt");
      setRuleFormValue(""); setRuleFormAcquirer("stripe");
      setRuleFormPriority("100"); setRuleFormActive(true);
    }
    setRuleDialogOpen(true);
  }

  function submitRuleForm() {
    const payload = {
      name: ruleFormName.trim(), description: ruleFormDesc.trim() || null,
      conditionField: ruleFormField, conditionOperator: ruleFormOp,
      conditionValue: ruleFormValue.trim(), acquirer: ruleFormAcquirer,
      priority: Number(ruleFormPriority) || 100, active: ruleFormActive,
    };
    if (editingRule) updateRuleMutation.mutate({ id: editingRule.id, ...payload });
    else createRuleMutation.mutate(payload);
  }

  // ─── NON-ADMIN VIEW ───────────────────────────────────────────────────────
  if (!isAdmin && routingLocked) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Terminal className="w-7 h-7 text-[#c8322b]" /> Enrutamiento POS
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user?.fullName ?? "Usuario"}</p>
        </div>
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-red-100 border-2 border-red-300 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-red-800 text-base">NON PAYMENT — Acceso suspendido</p>
              <p className="text-sm text-red-700 max-w-md">
                El módulo de Enrutamiento POS está bloqueado. No se ha registrado ningún pago para activar este servicio.
              </p>
            </div>
            {subData?.paymentWarning && (
              <p className="text-[11px] text-red-700 font-mono bg-red-100 border border-red-200 rounded px-3 py-2 max-w-lg leading-relaxed">
                {subData.paymentWarning}
              </p>
            )}
            <Badge className="bg-red-600 text-white border-red-700 no-default-active-elevate">
              Código: 0x4E43-BLOCK
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
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
                <p className="text-[11px] text-muted-foreground mt-0.5">Vigencia: {sub.startLabel} — {sub.endLabel}</p>
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

    if (myTerminals.length === 0) {
      return (
        <div className="p-4 md:p-6 space-y-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Terminal className="w-7 h-7 text-[#c8322b]" /> Enrutamiento POS
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Terminal punto de venta · {user?.fullName ?? "Usuario"}</p>
          </div>
          {subscriptionBanner}
          <Card className="border-2 border-dashed border-[#c8322b]/40">
            <CardContent className="py-12 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#c8322b]/10 flex items-center justify-center">
                <WifiOff className="w-8 h-8 text-[#c8322b]" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h2 className="text-xl font-bold" data-testid="text-no-terminal-title">No POS running — Sin terminal POS activa</h2>
                <p className="text-sm text-muted-foreground">
                  Actualmente no cuentas con una terminal asignada a tu cuenta. Contacta al administrador para que configure un nuevo POS para tu usuario.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-md" data-testid="status-no-terminal">
                <AlertTriangle className="w-3.5 h-3.5" /> Estado: Sin terminal configurada · Contact admin to deploy POS
              </div>
              <Button className="bg-[#c8322b] hover:bg-[#a62822]" onClick={() => requestPosMutation.mutate()} data-testid="button-request-pos">
                <Settings className="w-4 h-4 mr-2" /> Solicitar configuración de POS
              </Button>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-4 pb-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Acceso limitado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Como usuario estándar, solo puedes ver y operar tu propia terminal una vez configurada. La administración y el monitoreo global están reservados al administrador.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    const myTx = recentTransactions.filter(rt => myTerminals.some(t => t.terminalId === rt.terminal));
    return (
      <div className="p-4 md:p-6 space-y-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Terminal className="w-7 h-7 text-[#c8322b]" /> Mi Terminal POS
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Terminal punto de venta · {user?.fullName ?? "Usuario"}</p>
        </div>
        {subscriptionBanner}
        <Card>
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">Acceso limitado</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Solo puedes consultar tu propia terminal. La configuración y el monitoreo global están reservados al administrador.
              </p>
            </div>
          </CardContent>
        </Card>

        {myTerminals.map((t) => (
          <Card key={t.id} data-testid={`card-my-terminal-${t.terminalId}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-[#c8322b]/10 flex items-center justify-center">
                    <Terminal className="w-5 h-5 text-[#c8322b]" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {t.terminalId}
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(t.status)}`} />
                    </CardTitle>
                    <CardDescription>{t.model} · {t.location}</CardDescription>
                  </div>
                </div>
                {getStatusBadge(t.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {t.systemMessage && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5" data-testid={`banner-system-message-${t.terminalId}`}>
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Mensaje del sistema</p>
                    <p className="text-sm text-amber-700 mt-0.5">{t.systemMessage}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Transacciones</p>
                  <p className="text-lg font-bold" data-testid={`text-tx-count-${t.terminalId}`}>{t.transactions}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto procesado</p>
                  <p className="text-lg font-bold" data-testid={`text-amount-${t.terminalId}`}>${t.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
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
                <span className="bg-muted px-2 py-1 rounded-md">S/N: {t.serial}</span>
                <span className="bg-muted px-2 py-1 rounded-md">IP: {t.ip}</span>
                <span className="bg-muted px-2 py-1 rounded-md">Última TX: {t.lastTx}</span>
                {t.emv   && <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate">EMV</Badge>}
                {t.nfc   && <Badge className="bg-blue-100 text-blue-700 border-blue-200 no-default-active-elevate">NFC</Badge>}
                {t.pinpad && <Badge className="bg-purple-100 text-purple-700 border-purple-200 no-default-active-elevate">PIN Pad</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}

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
                      <Badge className={tx.status === "Aprobada" ? "bg-green-100 text-green-700 border-green-200 no-default-active-elevate" : "bg-red-100 text-red-700 border-red-200 no-default-active-elevate"}>{tx.status}</Badge>
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

  // ─── ADMIN VIEW ───────────────────────────────────────────────────────────
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
              <Terminal className="w-7 h-7 text-[#c8322b]" /> Enrutamiento POS
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitoreo en tiempo real · {terminalsLoading ? "..." : `${terminals.length} terminales registradas · ${onlineCount} operativas`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
              <div className="w-8 h-8 rounded-md bg-green-500/20 flex items-center justify-center">
                <Store className="h-4 w-4 text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">{onlineCount}</div>
              <p className="text-xs text-muted-foreground mt-0.5">de {terminals.length} terminales</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: terminals.length ? `${(onlineCount / terminals.length) * 100}%` : "0%" }} />
                </div>
                <span className="text-xs font-bold text-green-400">{terminals.length ? Math.round((onlineCount / terminals.length) * 100) : 0}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transacciones Hoy</CardTitle>
              <div className="w-8 h-8 rounded-md bg-blue-500/20 flex items-center justify-center">
                <Activity className="h-4 w-4 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">1,847</div>
              <div className="flex items-center gap-1 mt-0.5">
                <TrendingUp className="w-3 h-3 text-green-400" />
                <p className="text-xs text-green-400 font-medium">+12.5% vs ayer</p>
              </div>
              <p className="text-xs text-muted-foreground">Promedio: 154 por hora</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Volumen Procesado</CardTitle>
              <div className="w-8 h-8 rounded-md bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">$542,890</div>
              <p className="text-xs text-muted-foreground mt-0.5">USD procesados hoy</p>
              <div className="flex items-center gap-1 mt-0.5">
                <TrendingUp className="w-3 h-3 text-green-400" />
                <p className="text-xs text-green-400 font-medium">+8.3% vs ayer</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Rechazo</CardTitle>
              <div className="w-8 h-8 rounded-md bg-red-500/20 flex items-center justify-center">
                <XCircle className="h-4 w-4 text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-400">1.2%</div>
              <div className="flex items-center gap-1 mt-0.5">
                <TrendingDown className="w-3 h-3 text-green-400" />
                <p className="text-xs text-green-400 font-medium">-0.3% vs ayer</p>
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
                  <Button size="sm" className="bg-[#c8322b] text-white" onClick={() => openVinculate(req.fromUser ?? "")} data-testid={`button-vinculate-${req.fromUser}`}>
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
            {terminalsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-[#c8322b]" />
              </div>
            ) : filteredTerminals.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No hay terminales que coincidan.</div>
            ) : (
              <div className="divide-y">
                {filteredTerminals.map((pos) => (
                  <div
                    key={pos.id}
                    className={`flex flex-wrap lg:flex-nowrap items-start lg:items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer ${selectedTerminal?.id === pos.id ? "bg-muted/40" : ""} ${pos.status === "Reconfigured" ? "bg-blue-50/60 hover:bg-blue-50" : ""}`}
                    onClick={() => setSelectedTerminal(selectedTerminal?.id === pos.id ? null : pos)}
                    data-testid={`row-terminal-${pos.terminalId}`}
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
                        <span className="font-bold text-base">{pos.terminalId}</span>
                        {getStatusBadge(pos.status)}
                        {pos.status === "Reconfigured" && (
                          <Badge className="bg-blue-600 text-white text-xs no-default-active-elevate">
                            <Zap className="w-3 h-3 mr-1" /> Lista para Operar
                          </Badge>
                        )}
                        {pos.owner && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{pos.owner}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground">{pos.model}</p>
                      {pos.configNote && <p className="text-xs text-blue-700 font-medium mt-0.5">{pos.configNote}</p>}
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {pos.location}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {pos.lastTx}</span>
                        <span className="text-xs font-mono text-muted-foreground">{pos.ip}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">FW: <span className="font-semibold text-foreground">{pos.firmware}</span></span>
                        <span className="text-xs text-muted-foreground">S/N: <span className="font-mono text-xs">{pos.serial}</span></span>
                        <div className="flex items-center gap-1">
                          {pos.emv   && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">EMV</span>}
                          {pos.nfc   && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">NFC</span>}
                          {pos.pinpad && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">PIN</span>}
                        </div>
                      </div>
                    </div>

                    {/* Signal & Uptime */}
                    <div className="hidden md:flex flex-col items-center gap-1 min-w-[80px]">
                      <div className="flex items-center gap-1">
                        {pos.status === "Offline" ? <WifiOff className="w-4 h-4 text-red-500" /> : <Signal className="w-4 h-4 text-green-500" />}
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
                          <div className={`h-full rounded-full ${pos.efficiency >= 95 ? "bg-green-500" : pos.efficiency >= 85 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{ width: `${pos.efficiency}%` }} />
                        </div>
                        <span className="text-xs font-bold">{pos.efficiency}%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Uptime: {pos.uptime}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 ml-2">
                      <Button variant="outline" size="sm" className="text-xs h-7 px-2" data-testid={`button-details-${pos.terminalId}`}
                        onClick={e => { e.stopPropagation(); setSelectedTerminal(selectedTerminal?.id === pos.id ? null : pos); }}>
                        <Eye className="w-3 h-3 mr-1" /> Ver
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs h-7 px-2" data-testid={`button-edit-${pos.terminalId}`}
                        onClick={e => { e.stopPropagation(); openEdit(pos); }}>
                        <Pencil className="w-3 h-3 mr-1" /> Editar
                      </Button>
                      {pos.status !== "Offline" && (
                        <Button variant="outline" size="sm" className="text-xs h-7 px-2 text-red-600"
                          data-testid={`button-power-${pos.terminalId}`} onClick={e => { e.stopPropagation(); handleReset(pos); }}>
                          <Power className="w-3 h-3 mr-1" /> Reset
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Terminal Status Detail Panel */}
        {selectedTerminal && (() => {
          const amtUSD = selectedTerminal.amount || 57000;
          const rateEUR = 0.87420;
          const rateMXN = 17.53614;
          const rateEURMXN = 20.05231;
          const amtEUR = amtUSD * rateEUR;
          const amtMXN = amtUSD * rateMXN;
          const amtEURtoMXN = amtEUR * rateEURMXN;
          const today = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
          const fmt = (n: number, decimals = 2) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
          const isISO = selectedTerminal.emv && selectedTerminal.nfc;
          return (
          <Card className="border border-border hover-elevate">
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-8 h-8 rounded-md bg-[#c8322b]/15 flex items-center justify-center">
                      <Terminal className="w-4 h-4 text-[#c8322b]" />
                    </div>
                    Status Terminal {selectedTerminal.terminalId}
                  </CardTitle>
                  <CardDescription className="mt-1">Consulta y actualiza el estado y configuración de la terminal POS seleccionada.</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(selectedTerminal)} data-testid="button-edit-detail">
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedTerminal(null)} data-testid="button-close-detail">
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-6">

              {/* Form Fields — 2-column grid */}
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {/* Modelo */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Modelo</Label>
                  <div className="flex items-center h-9 px-3 rounded-md border border-border bg-muted/30 text-sm font-medium">
                    {selectedTerminal.model}
                  </div>
                </div>
                {/* Ubicación */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ubicación</Label>
                  <div className="flex items-center h-9 px-3 rounded-md border border-border bg-muted/30 text-sm font-medium font-mono truncate" title={selectedTerminal.location}>
                    {selectedTerminal.location}
                  </div>
                </div>
                {/* Estado */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</Label>
                  <div className="flex items-center h-9 px-3 rounded-md border border-border bg-muted/30 text-sm font-medium gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(selectedTerminal.status)}`} />
                    {selectedTerminal.status === "Online" ? "Online" : selectedTerminal.status === "Offline" ? "Offline" : selectedTerminal.status === "Idle" ? "Inactivo" : "Re-configurado"}
                  </div>
                </div>
                {/* Moneda base */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Moneda base</Label>
                  <div className="flex items-center h-9 px-3 rounded-md border border-border bg-muted/30 text-sm font-medium">
                    USD — DÓLARES ESTADOUNIDENSES
                  </div>
                </div>
                {/* Monto procesado */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monto procesado (USD)</Label>
                  <div className="flex items-center h-9 px-3 rounded-md border border-border bg-muted/30 text-sm font-bold font-mono">
                    ${fmt(amtUSD)} USD
                  </div>
                  <p className="text-[11px] text-muted-foreground">El monto total procesado que ve el usuario en su terminal.</p>
                </div>
                {/* Monto en MXN */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monto en MXN (Tipo de cambio aplicado)</Label>
                  <div className="flex items-center h-9 px-3 rounded-md border border-border bg-muted/30 text-sm font-bold font-mono text-emerald-500">
                    {fmt(amtMXN)} MXN
                  </div>
                  <p className="text-[11px] text-muted-foreground">Equivalente en pesos mexicanos según el tipo de cambio aplicado.</p>
                </div>
              </div>

              {/* Mensaje del sistema */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mensaje del sistema</Label>
                <div className="px-3 py-2.5 rounded-md border border-border bg-muted/30 text-sm font-mono font-medium min-h-[44px]">
                  {selectedTerminal.systemMessage || "WAITING TO RECEIVE SERVER ROUTE"}
                </div>
                <p className="text-[11px] text-muted-foreground">Este mensaje aparece como aviso destacado en la vista del usuario.</p>
              </div>

              {/* Nota de configuración */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nota de configuración interna (opcional)</Label>
                <div className="px-3 py-2.5 rounded-md border border-border bg-muted/30 text-sm min-h-[44px] text-muted-foreground italic">
                  {selectedTerminal.configNote || "Ej. Actualización de firmware programada..."}
                </div>
                <p className="text-[11px] text-muted-foreground">Nota interna visible solo para el equipo administrador.</p>
              </div>

              {/* Tablas de Cambio */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Tablas de Cambio</h3>

                {/* Resumen de Conversión */}
                <div className="rounded-md border border-border overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumen de Conversión</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b border-border">
                        <TableHead className="text-xs h-9 font-semibold">Moneda</TableHead>
                        <TableHead className="text-xs h-9 font-semibold">Tasa de Cambio</TableHead>
                        <TableHead className="text-xs h-9 font-semibold text-right">Valor Convertido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-b border-border/50">
                        <TableCell className="text-sm py-2.5 font-semibold">USD (Base)</TableCell>
                        <TableCell className="text-sm py-2.5 font-mono">1.0000</TableCell>
                        <TableCell className="text-sm py-2.5 text-right font-mono font-semibold">${fmt(amtUSD)} USD</TableCell>
                      </TableRow>
                      <TableRow className="border-b border-border/50">
                        <TableCell className="text-sm py-2.5 font-semibold">EUR</TableCell>
                        <TableCell className="text-sm py-2.5 font-mono">{rateEUR.toFixed(5)} USD/EUR</TableCell>
                        <TableCell className="text-sm py-2.5 text-right font-mono font-semibold">${fmt(amtEUR)} EUR</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm py-2.5 font-semibold">MXN</TableCell>
                        <TableCell className="text-sm py-2.5 font-mono">{rateMXN.toFixed(5)} MXN/USD</TableCell>
                        <TableCell className="text-sm py-2.5 text-right font-mono font-semibold text-emerald-500">${fmt(amtMXN)} MXN</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Detalle de tasas */}
                <div className="rounded-md border border-border overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detalle de Tasas de Cambio Utilizadas</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b border-border">
                        <TableHead className="text-xs h-9 font-semibold">Conversión</TableHead>
                        <TableHead className="text-xs h-9 font-semibold">Tasa ({today} a.m.)</TableHead>
                        <TableHead className="text-xs h-9 font-semibold text-right">Valor convertido desde ${fmt(amtUSD)} USD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-b border-border/50">
                        <TableCell className="text-sm py-2.5 font-mono">USD → EUR</TableCell>
                        <TableCell className="text-sm py-2.5 font-mono">{rateEUR.toFixed(5)}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right font-mono">${fmt(amtEUR)} EUR</TableCell>
                      </TableRow>
                      <TableRow className="border-b border-border/50">
                        <TableCell className="text-sm py-2.5 font-mono">USD → MXN</TableCell>
                        <TableCell className="text-sm py-2.5 font-mono">{rateMXN.toFixed(5)}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right font-mono">${fmt(amtMXN)} MXN</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm py-2.5 font-mono">EUR → MXN</TableCell>
                        <TableCell className="text-sm py-2.5 font-mono">{rateEURMXN.toFixed(5)}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right font-mono">${fmt(amtEURtoMXN)} MXN*</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <div className="px-4 py-2 border-t border-border/50 bg-muted/20">
                    <p className="text-[11px] text-muted-foreground">*Nota: Existe una pequeña diferencia debido al redondeo de las tasas cruzadas entre las tres monedas.</p>
                  </div>
                </div>
              </div>

              {/* ISO-8583 Warning */}
              <div className={`flex items-center gap-3 rounded-md border px-4 py-3 ${isISO ? "border-green-500/30 bg-green-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                {isISO
                  ? <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <TriangleAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                }
                <span className={`text-sm font-semibold ${isISO ? "text-green-500" : "text-amber-500"}`}>
                  {isISO ? "ISO-8583 certified" : "ISO-8583 not certified"}
                </span>
              </div>

              {/* Remote Terminal Commands */}
              {isAdmin && (
                <div className="space-y-3 border-t border-border pt-5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Power className="w-4 h-4 text-[#c8322b]" /> Comandos Remotos
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(["restart", "reconfigure", "force_offline", "sync"] as const).map(cmd => {
                        const labels: Record<string, string> = { restart: "Reiniciar", reconfigure: "Reconfigurar", force_offline: "Forzar Offline", sync: "Sincronizar" };
                        const isPending = sendCommandMutation.isPending;
                        return (
                          <Button
                            key={cmd}
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => {
                              setCmdTerminalId(selectedTerminal.id);
                              sendCommandMutation.mutate({ terminalId: selectedTerminal.id, command: cmd });
                            }}
                            data-testid={`button-cmd-${cmd}`}
                          >
                            {isPending && sendCommandMutation.variables?.command === cmd
                              ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              : null
                            }
                            {labels[cmd]}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  {cmdTerminalId === selectedTerminal.id && terminalCmds.length > 0 && (
                    <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-b border-border">
                            <TableHead className="text-xs h-8">Comando</TableHead>
                            <TableHead className="text-xs h-8">Estado</TableHead>
                            <TableHead className="text-xs h-8">Por</TableHead>
                            <TableHead className="text-xs h-8 text-right">Hora</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {terminalCmds.slice(0, 8).map(c => (
                            <TableRow key={c.id} className="border-b border-border/50 last:border-0">
                              <TableCell className="text-xs py-2 font-mono">{c.command}</TableCell>
                              <TableCell className="text-xs py-2">
                                <span className={`font-semibold ${c.status === "completed" ? "text-green-500" : c.status === "failed" ? "text-red-500" : "text-amber-500"}`}>
                                  {c.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs py-2 text-muted-foreground">{c.createdBy}</TableCell>
                              <TableCell className="text-xs py-2 text-right text-muted-foreground">
                                {new Date(c.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {cmdTerminalId !== selectedTerminal.id && (
                    <p className="text-xs text-muted-foreground">Ejecuta un comando para ver el historial de esta terminal.</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  className="bg-[#c8322b] hover:bg-[#a62822] text-white"
                  onClick={() => openEdit(selectedTerminal)}
                  data-testid="button-save-terminal"
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Guardar Cambios
                </Button>
                <Button variant="outline" onClick={() => setSelectedTerminal(null)} data-testid="button-cancel-detail">
                  Cancelar
                </Button>
              </div>

            </CardContent>
          </Card>
          );
        })()}

        {/* Bottom grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="hover-elevate">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4" /> Últimas Transacciones</CardTitle>
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

          <Card className="hover-elevate">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><Zap className="w-4 h-4" /> Rendimiento por Terminal</CardTitle>
              <CardDescription>Velocidad de procesamiento y tasa de éxito</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {terminals.slice(0, 6).map((t, i) => {
                  const color = t.efficiency >= 90 ? "green" : t.efficiency >= 80 ? "yellow" : "red";
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color === "green" ? "bg-green-500" : color === "yellow" ? "bg-yellow-500" : "bg-red-500"}`} />
                      <span className="text-sm font-semibold w-14">{t.terminalId}</span>
                      <span className="text-xs text-muted-foreground w-20 hidden sm:block">{t.model.split(" ").slice(-1)[0]}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color === "green" ? "bg-green-500" : color === "yellow" ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${t.efficiency}%` }} />
                          </div>
                          <span className="text-xs font-bold w-8 text-right">{t.efficiency}%</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right font-mono">{t.status === "Offline" ? "—" : "2.3s"}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ ROUTING RULES ADMIN PANEL ═══════════════════════════════════════ */}
        {isAdmin && (
          <Card className="hover-elevate">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Network className="w-4 h-4 text-[#c8322b]" /> Reglas de Enrutamiento POS
                  </CardTitle>
                  <CardDescription>Administra las reglas que determinan el adquirente para cada transacción.</CardDescription>
                </div>
                <Button size="sm" className="bg-[#c8322b] text-white" onClick={() => openRuleDialog()} data-testid="button-add-rule">
                  <PlusCircle className="w-4 h-4 mr-1" /> Nueva Regla
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {routingRulesData.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-6 text-center">No hay reglas configuradas. Las transacciones se enrutan a Stripe por defecto.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className="text-xs h-9 w-10">P.</TableHead>
                      <TableHead className="text-xs h-9">Nombre</TableHead>
                      <TableHead className="text-xs h-9 hidden md:table-cell">Condición</TableHead>
                      <TableHead className="text-xs h-9">Adquirente</TableHead>
                      <TableHead className="text-xs h-9">Estado</TableHead>
                      <TableHead className="text-xs h-9 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routingRulesData.map(rule => (
                      <TableRow key={rule.id} className="border-b border-border/50 last:border-0" data-testid={`row-rule-${rule.id}`}>
                        <TableCell className="text-xs py-2.5 font-mono font-bold text-muted-foreground">{rule.priority}</TableCell>
                        <TableCell className="text-sm py-2.5">
                          <p className="font-semibold">{rule.name}</p>
                          {rule.description && <p className="text-xs text-muted-foreground mt-0.5 hidden lg:block">{rule.description}</p>}
                        </TableCell>
                        <TableCell className="text-xs py-2.5 font-mono text-muted-foreground hidden md:table-cell">
                          {rule.conditionField} {rule.conditionOperator} <span className="text-foreground font-semibold">{rule.conditionValue}</span>
                        </TableCell>
                        <TableCell className="text-xs py-2.5">
                          <Badge className={`no-default-active-elevate text-xs ${rule.acquirer === "stripe" ? "bg-blue-100 text-blue-700 border-blue-200" : rule.acquirer === "mercadopago" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-700 border-gray-200"}`}>
                            {rule.acquirer === "stripe" ? "Stripe" : rule.acquirer === "mercadopago" ? "Mercado Pago" : "Local"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2.5">
                          <Button
                            size="sm" variant="ghost"
                            className={`h-6 px-2 text-xs font-semibold ${rule.active ? "text-green-600" : "text-muted-foreground"}`}
                            onClick={() => updateRuleMutation.mutate({ id: rule.id, active: !rule.active })}
                            data-testid={`button-toggle-rule-${rule.id}`}
                          >
                            {rule.active ? "Activa" : "Inactiva"}
                          </Button>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openRuleDialog(rule)} data-testid={`button-edit-rule-${rule.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500"
                              onClick={() => { if (confirm("¿Eliminar esta regla?")) deleteRuleMutation.mutate(rule.id); }}
                              data-testid={`button-delete-rule-${rule.id}`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══ ROUTING DECISIONS REAL-TIME PANEL ════════════════════════════════ */}
        {isAdmin && (
          <Card className="hover-elevate">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="w-4 h-4 text-[#c8322b]" /> Decisiones de Enrutamiento
                  </CardTitle>
                  <CardDescription>Historial en tiempo real de qué regla y adquirente se usaron por transacción.</CardDescription>
                </div>
                <a href="/api/routing-decisions/export" target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" data-testid="button-export-decisions">
                    <Hash className="w-4 h-4 mr-1" /> Exportar CSV
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {routingDecisionsData.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-6 text-center">No hay decisiones de enrutamiento registradas. Procesa un pago POS para ver la trazabilidad.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className="text-xs h-9">Transacción</TableHead>
                      <TableHead className="text-xs h-9 hidden md:table-cell">Regla aplicada</TableHead>
                      <TableHead className="text-xs h-9">Adquirente</TableHead>
                      <TableHead className="text-xs h-9 hidden lg:table-cell">Protocolo</TableHead>
                      <TableHead className="text-xs h-9 text-right">Estado</TableHead>
                      <TableHead className="text-xs h-9 text-right hidden lg:table-cell">Resp. ms</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routingDecisionsData.slice(0, 20).map(d => (
                      <TableRow key={d.id} className="border-b border-border/50 last:border-0" data-testid={`row-decision-${d.id}`}>
                        <TableCell className="text-xs py-2.5 font-mono">{d.transactionId.slice(0, 22)}&hellip;</TableCell>
                        <TableCell className="text-xs py-2.5 hidden md:table-cell text-muted-foreground">
                          {d.ruleName ? (
                            <span className="text-foreground font-medium">{d.ruleName}</span>
                          ) : (
                            <span className="italic">Fallback</span>
                          )}
                          {d.conditionMatched && <span className="ml-1 font-mono text-muted-foreground">({d.conditionMatched})</span>}
                        </TableCell>
                        <TableCell className="text-xs py-2.5">
                          <Badge className={`no-default-active-elevate text-xs ${d.acquirer === "stripe" ? "bg-blue-100 text-blue-700 border-blue-200" : d.acquirer === "mercadopago" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-700 border-gray-200"}`}>
                            {d.acquirer}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2.5 text-muted-foreground hidden lg:table-cell">{d.protocol ?? "—"}</TableCell>
                        <TableCell className="text-xs py-2.5 text-right font-semibold">
                          <span className={d.approved ? "text-green-500" : "text-red-500"}>{d.approved ? "Aprobada" : "Rechazada"}</span>
                        </TableCell>
                        <TableCell className="text-xs py-2.5 text-right font-mono text-muted-foreground hidden lg:table-cell">
                          {d.responseTimeMs ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══ ROUTING ANALYTICS ════════════════════════════════════════════════ */}
        {isAdmin && routingAnalytics && routingAnalytics.totalDecisions > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="hover-elevate">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#c8322b]" /> Analítica por Adquirente</CardTitle>
                <CardDescription>Tasa de aprobación y tiempo de respuesta promedio</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className="text-xs h-8">Adquirente</TableHead>
                      <TableHead className="text-xs h-8 text-right">Total</TableHead>
                      <TableHead className="text-xs h-8 text-right">Aprobadas</TableHead>
                      <TableHead className="text-xs h-8 text-right">Tasa</TableHead>
                      <TableHead className="text-xs h-8 text-right">Resp. prom.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routingAnalytics.acquirerStats.map(a => (
                      <TableRow key={a.acquirer} className="border-b border-border/50 last:border-0">
                        <TableCell className="text-sm py-2.5 font-semibold capitalize">{a.acquirer}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right font-mono">{a.total}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right font-mono">{a.approved}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right">
                          <span className={`font-bold ${a.approvalRate >= 80 ? "text-green-500" : a.approvalRate >= 50 ? "text-amber-500" : "text-red-500"}`}>
                            {a.approvalRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm py-2.5 text-right font-mono text-muted-foreground">{a.avgResponseMs}ms</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-[#c8322b]" /> Analítica por Protocolo</CardTitle>
                <CardDescription>Distribución y tasa de aprobación por protocolo bancario</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className="text-xs h-8">Protocolo</TableHead>
                      <TableHead className="text-xs h-8 text-right">Total</TableHead>
                      <TableHead className="text-xs h-8 text-right">Aprobadas</TableHead>
                      <TableHead className="text-xs h-8 text-right">Tasa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routingAnalytics.protocolStats.map(p => (
                      <TableRow key={p.protocol} className="border-b border-border/50 last:border-0">
                        <TableCell className="text-sm py-2.5 font-mono font-semibold">{p.protocol}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right font-mono">{p.total}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right font-mono">{p.approved}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right">
                          <span className={`font-bold ${p.approvalRate >= 80 ? "text-green-500" : p.approvalRate >= 50 ? "text-amber-500" : "text-red-500"}`}>
                            {p.approvalRate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Sistema operativo desde: 2025-01-01</span>
            </div>
            <span className="font-medium">{new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
            <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-semibold">Sistema Activo</span>
          </div>
        </div>
      </div>

      {/* Dialog: Routing Rule Create/Edit */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 text-[#c8322b]" />
              {editingRule ? "Editar Regla de Enrutamiento" : "Nueva Regla de Enrutamiento"}
            </DialogTitle>
            <DialogDescription>Define la condición y el adquirente destino para esta regla.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label htmlFor="r-name">Nombre de la regla</Label>
              <Input id="r-name" value={ruleFormName} onChange={e => setRuleFormName(e.target.value)} placeholder="Ej. Alta denominación → Stripe" data-testid="input-rule-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-desc">Descripción (opcional)</Label>
              <Input id="r-desc" value={ruleFormDesc} onChange={e => setRuleFormDesc(e.target.value)} placeholder="Descripción breve de la regla" data-testid="input-rule-desc" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Campo</Label>
                <Select value={ruleFormField} onValueChange={setRuleFormField}>
                  <SelectTrigger data-testid="select-rule-field"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">Monto</SelectItem>
                    <SelectItem value="protocol">Protocolo</SelectItem>
                    <SelectItem value="cardType">Tipo tarjeta</SelectItem>
                    <SelectItem value="currency">Moneda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Operador</Label>
                <Select value={ruleFormOp} onValueChange={setRuleFormOp}>
                  <SelectTrigger data-testid="select-rule-op"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eq">= (igual)</SelectItem>
                    <SelectItem value="neq">≠ (distinto)</SelectItem>
                    <SelectItem value="gt">&gt; (mayor)</SelectItem>
                    <SelectItem value="gte">&gt;= (mayor o igual)</SelectItem>
                    <SelectItem value="lt">&lt; (menor)</SelectItem>
                    <SelectItem value="lte">&lt;= (menor o igual)</SelectItem>
                    <SelectItem value="contains">contiene</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-val">Valor</Label>
                <Input id="r-val" value={ruleFormValue} onChange={e => setRuleFormValue(e.target.value)} placeholder="Ej. 5000" data-testid="input-rule-value" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Adquirente destino</Label>
                <Select value={ruleFormAcquirer} onValueChange={setRuleFormAcquirer}>
                  <SelectTrigger data-testid="select-rule-acquirer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                    <SelectItem value="local">Local / Interno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-priority">Prioridad (menor = primero)</Label>
                <Input id="r-priority" type="number" min="1" value={ruleFormPriority} onChange={e => setRuleFormPriority(e.target.value)} data-testid="input-rule-priority" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="r-active"
                checked={ruleFormActive}
                onCheckedChange={v => setRuleFormActive(!!v)}
                data-testid="checkbox-rule-active"
              />
              <Label htmlFor="r-active" className="cursor-pointer">Regla activa</Label>
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancelar</Button>
            <Button
              className="bg-[#c8322b] text-white"
              disabled={!ruleFormName.trim() || !ruleFormValue.trim() || createRuleMutation.isPending || updateRuleMutation.isPending}
              onClick={submitRuleForm}
              data-testid="button-rule-submit"
            >
              {(createRuleMutation.isPending || updateRuleMutation.isPending)
                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Guardando...</>
                : editingRule ? "Actualizar Regla" : "Crear Regla"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Terminal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[#c8322b]" />
              Editar Terminal {editTarget?.terminalId}
            </DialogTitle>
            <DialogDescription>Modifica los parámetros de la terminal POS seleccionada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label htmlFor="e-model">Modelo</Label>
              <Select value={editModel} onValueChange={setEditModel}>
                <SelectTrigger id="e-model" data-testid="select-edit-model">
                  <SelectValue placeholder="Seleccionar modelo..." />
                </SelectTrigger>
                <SelectContent>
                  {POS_MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-location">Ubicación</Label>
              <Input id="e-location" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="Ej. Sucursal Centro..." data-testid="input-edit-location" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-status">Estado</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger id="e-status" data-testid="select-edit-status">
                  <SelectValue placeholder="Seleccionar estado..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="idle">Inactiva</SelectItem>
                  <SelectItem value="reconfigured">Re-configurada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-amount">Monto procesado (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  id="e-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-6"
                  data-testid="input-edit-amount"
                />
              </div>
              <p className="text-xs text-muted-foreground">Monto total procesado que ve el usuario en su terminal.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-sysmsg">Mensaje del sistema para el usuario (opcional)</Label>
              <Textarea
                id="e-sysmsg"
                value={editSystemMessage}
                onChange={e => setEditSystemMessage(e.target.value)}
                placeholder="Ej. En proceso de configuración..."
                className="resize-none text-sm"
                data-testid="input-edit-system-message"
              />
              <p className="text-xs text-muted-foreground">Este mensaje aparece como aviso destacado en la vista del usuario. Déjalo vacío para no mostrar ninguno.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-note">Nota de configuración interna (opcional)</Label>
              <Textarea id="e-note" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Ej. Actualización de firmware programada..." className="resize-none text-sm" data-testid="input-edit-note" />
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} data-testid="button-edit-cancel">Cancelar</Button>
            <Button
              className="bg-[#c8322b] text-white"
              disabled={!editModel || !editLocation.trim() || !editStatus || editMutation.isPending}
              onClick={() => editTarget && editMutation.mutate({
                id: editTarget.id,
                model: editModel,
                location: editLocation.trim(),
                status: editStatus,
                configNote: editNote.trim() || null,
                systemMessage: editSystemMessage.trim() || null,
                amount: parseFloat(editAmount) || 0,
              })}
              data-testid="button-edit-submit"
            >
              {editMutation.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Guardando...</> : <><CheckCircle className="w-4 h-4 mr-1" /> Guardar Cambios</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Vincular Terminal a Usuario */}
      <Dialog open={vinculateOpen} onOpenChange={setVinculateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#c8322b]" /> Nueva Terminal POS
            </DialogTitle>
            <DialogDescription>Registra y asigna una terminal POS a un usuario del sistema.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-1">
            {/* ── Campos principales ─────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="v-user">Usuario asignado</Label>
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

            <div className="space-y-1.5">
              <Label htmlFor="v-model">Modelo de terminal</Label>
              <Select value={formModel} onValueChange={setFormModel}>
                <SelectTrigger id="v-model" data-testid="select-vinculate-model">
                  <SelectValue placeholder="Seleccionar modelo..." />
                </SelectTrigger>
                <SelectContent>
                  {POS_MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="v-location">Ubicación / Sucursal</Label>
              <Input
                id="v-location"
                placeholder="Ej. Sucursal Centro, Oficina Principal..."
                value={formLocation}
                onChange={e => setFormLocation(e.target.value)}
                data-testid="input-vinculate-location"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="v-status">Estado inicial</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger id="v-status" data-testid="select-vinculate-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reconfigured">Re-configurada</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="idle">Inactiva</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Capacidades ────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Capacidades</Label>
              <div className="flex items-center gap-6 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                  <Checkbox
                    checked={formEmv}
                    onCheckedChange={v => setFormEmv(!!v)}
                    data-testid="check-emv"
                  />
                  <span className="font-medium">EMV</span>
                  <span className="text-xs text-muted-foreground">(chip)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                  <Checkbox
                    checked={formNfc}
                    onCheckedChange={v => setFormNfc(!!v)}
                    data-testid="check-nfc"
                  />
                  <span className="font-medium">NFC</span>
                  <span className="text-xs text-muted-foreground">(contactless)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                  <Checkbox
                    checked={formPinpad}
                    onCheckedChange={v => setFormPinpad(!!v)}
                    data-testid="check-pinpad"
                  />
                  <span className="font-medium">PIN Pad</span>
                </label>
              </div>
            </div>

            {/* ── Parámetros avanzados (expandible) ─────────── */}
            <div>
              <button
                type="button"
                onClick={() => setFormAdvanced(p => !p)}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-toggle-advanced"
              >
                {formAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Parámetros avanzados
              </button>

              {formAdvanced && (
                <div className="mt-3 space-y-3 pl-1 border-l-2 border-muted ml-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="v-serial" className="flex items-center gap-1.5 text-xs">
                        <Hash className="w-3.5 h-3.5" /> Número de serie
                      </Label>
                      <Input
                        id="v-serial"
                        placeholder="Auto-generado si vacío"
                        value={formSerial}
                        onChange={e => setFormSerial(e.target.value)}
                        className="text-sm"
                        data-testid="input-vinculate-serial"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="v-firmware" className="flex items-center gap-1.5 text-xs">
                        <Cpu className="w-3.5 h-3.5" /> Versión firmware
                      </Label>
                      <Input
                        id="v-firmware"
                        placeholder="v5.0.0-NEW"
                        value={formFirmware}
                        onChange={e => setFormFirmware(e.target.value)}
                        className="text-sm"
                        data-testid="input-vinculate-firmware"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="v-ip" className="flex items-center gap-1.5 text-xs">
                        <Network className="w-3.5 h-3.5" /> Dirección IP
                      </Label>
                      <Input
                        id="v-ip"
                        placeholder="192.168.1.xxx"
                        value={formIp}
                        onChange={e => setFormIp(e.target.value)}
                        className="text-sm"
                        data-testid="input-vinculate-ip"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="v-signal" className="flex items-center gap-1.5 text-xs">
                        <Signal className="w-3.5 h-3.5" /> Señal (%)
                      </Label>
                      <Input
                        id="v-signal"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="100"
                        value={formSignal}
                        onChange={e => setFormSignal(e.target.value)}
                        className="text-sm"
                        data-testid="input-vinculate-signal"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="v-confignote" className="text-xs">Nota de configuración interna</Label>
                    <Textarea
                      id="v-confignote"
                      value={formConfigNote}
                      onChange={e => setFormConfigNote(e.target.value)}
                      placeholder="Nota interna sobre esta terminal..."
                      className="resize-none text-sm"
                      data-testid="input-vinculate-confignote"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setVinculateOpen(false)} data-testid="button-vinculate-cancel">
              Cancelar
            </Button>
            <Button
              className="bg-[#c8322b] text-white"
              disabled={!formUser || !formModel || !formLocation.trim() || vinculateMutation.isPending}
              onClick={() => vinculateMutation.mutate({
                ownerUsername: formUser,
                model: formModel,
                location: formLocation.trim(),
                status: formStatus,
                emv: formEmv,
                nfc: formNfc,
                pinpad: formPinpad,
                serial: formSerial.trim() || undefined,
                firmware: formFirmware.trim() || undefined,
                ip: formIp.trim() || undefined,
                signalStrength: formSignal ? Number(formSignal) : undefined,
                configNote: formConfigNote.trim() || undefined,
              })}
              data-testid="button-vinculate-submit"
            >
              {vinculateMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creando...</>
                : <><PlusCircle className="w-4 h-4 mr-1" /> Registrar Terminal</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
