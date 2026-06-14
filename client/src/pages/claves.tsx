import { useState } from "react";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { CryptoKey } from "@shared/schema";
import {
  Lock, Key, Shield, Copy, Eye, EyeOff, Plus, RefreshCw,
  Trash2, Check, AlertTriangle, ShieldCheck, Clock,
  Activity, FileText, Zap, X
} from "lucide-react";

function relativeTime(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `Hace ${secs} seg`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} días`;
}

const genSchema = z.object({
  name: z.string().min(2, "Nombre requerido (mín. 2 caracteres)").max(40).regex(/^[A-Z0-9_]+$/, "Solo mayúsculas, números y _"),
  type: z.string().min(1, "Tipo requerido"),
  scope: z.string().min(1, "Alcance requerido"),
  expiresDays: z.string().min(1, "Expiración requerida"),
});
type GenForm = z.infer<typeof genSchema>;

const STATUS_COLOR: Record<string, string> = {
  Activa:   "bg-green-100 text-green-700",
  Rotada:   "bg-yellow-100 text-yellow-700",
  Expirada: "bg-red-100 text-red-700",
};

function maskKey(value: string) {
  const parts = value.split("...");
  if (parts.length === 2) return parts[0] + "·".repeat(16) + parts[1];
  return "•".repeat(40);
}

export default function ClavesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: keys = [], isLoading } = useQuery<CryptoKey[]>({ queryKey: ["/api/crypto-keys"] });

  const generateMutation = useMutation({
    mutationFn: (data: GenForm) => apiRequest("POST", "/api/crypto-keys", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto-keys"] });
      setShowGenerator(false);
      form.reset();
      toast({ title: "Clave generada", description: "Lista para usar." });
    },
    onError: () => toast({ title: "Error al generar clave", variant: "destructive" }),
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/crypto-keys/${id}`, { status: "Rotada" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto-keys"] });
      toast({ title: "Clave rotada", description: "La clave ha sido rotada exitosamente." });
    },
    onError: () => toast({ title: "Error al rotar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/crypto-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto-keys"] });
      toast({ title: "Clave eliminada", description: "La clave ha sido eliminada del sistema." });
    },
    onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
  });

  const form = useForm<GenForm>({
    resolver: zodResolver(genSchema),
    defaultValues: { name: "", type: "AES-256-GCM", scope: "API / General", expiresDays: "180" },
  });

  function toggleVisibility(id: string) {
    setVisibleKeys(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function handleCopy(id: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    apiRequest("POST", `/api/crypto-keys/${id}/usage`).catch(() => null);
    toast({ title: "Copiado al portapapeles", description: "La clave ha sido copiada de forma segura." });
  }

  function onGenerate(data: GenForm) {
    generateMutation.mutate(data);
  }

  const filtered = keys.filter(k => filterStatus === "all" || k.status === filterStatus);
  const activeCount = keys.filter(k => k.status === "Activa").length;
  const expiredCount = keys.filter(k => k.status === "Expirada").length;
  const totalUsage = keys.reduce((s, k) => s + k.usage, 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield className="w-7 h-7 text-[#c8322b]" /> Claves Encriptadas
          </h1>
          <p className="text-sm text-muted-foreground">Gestión segura de claves criptográficas del sistema</p>
        </div>
        {isAdmin && (
          <Button size="sm" className="bg-[#c8322b] hover:bg-[#a62822]" onClick={() => setShowGenerator(v => !v)} data-testid="button-generate">
            <Plus className="w-4 h-4 mr-1" /> Generar Nueva Clave
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="hover-elevate">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Claves Activas</p>
              <Key className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{activeCount}</p>
            <p className="text-xs text-muted-foreground">de {keys.length} totales</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Nivel Seguridad</p>
              <Shield className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">ALTO</p>
            <p className="text-xs text-muted-foreground">AES-256 / RSA-4096</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Última Rotación</p>
              <RefreshCw className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">2 días</p>
            <p className="text-xs text-muted-foreground">Próxima en 5 días</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Uso Total</p>
              <Activity className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold">{totalUsage.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Operaciones cifradas</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {expiredCount > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-2.5 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{expiredCount} clave{expiredCount > 1 ? "s" : ""} expirada{expiredCount > 1 ? "s" : ""}. Rota o elimina para mantener la seguridad del sistema.</span>
        </div>
      )}

      {/* Generator */}
      {showGenerator && (
        <Card className="hover-elevate border-2 border-[#c8322b]/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-[#c8322b]">
                <Zap className="w-5 h-5" /> Generar Nueva Clave
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowGenerator(false)} data-testid="button-close-generator">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription>La clave se generará con entropía criptográfica segura</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onGenerate)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Clave</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="API_KEY_PRODUCCION" className="font-mono uppercase" data-testid="input-key-name"
                          onChange={e => field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Algoritmo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-key-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["AES-256-GCM", "AES-256-CBC", "RSA-4096", "ChaCha20-Poly1305", "HMAC-SHA256", "3DES-EDE"].map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="scope" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alcance / Uso</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-scope">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["API / Pagos", "API / General", "Base de Datos", "Autenticación", "Terminales POS", "EMV / Tarjetas", "Interbancario", "OAuth 2.0"].map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="expiresDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiración (días)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-expires">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[{ v: "30", l: "30 días" }, { v: "90", l: "90 días" }, { v: "180", l: "6 meses" }, { v: "365", l: "1 año" }].map(o => (
                            <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" className="bg-[#c8322b] hover:bg-[#a62822]" disabled={generateMutation.isPending} data-testid="button-generate-submit">
                    {generateMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generando...</> : <><Key className="w-4 h-4 mr-2" /> Generar Clave</>}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowGenerator(false)}>Cancelar</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Keys list */}
      <Card className="hover-elevate">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-4 h-4" /> Claves Almacenadas
              </CardTitle>
              <CardDescription>{isLoading ? "Cargando..." : `${filtered.length} claves · Cifrado de extremo a extremo`}</CardDescription>
            </div>
            <div className="flex gap-1">
              {["all", "Activa", "Rotada", "Expirada"].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${filterStatus === s ? "bg-[#c8322b] text-white" : "bg-muted text-muted-foreground"}`}
                  data-testid={`filter-key-${s}`}>
                  {s === "all" ? "Todas" : s}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin opacity-40" />
              Cargando claves...
            </div>
          ) : (
          <div className="divide-y">
            {filtered.map((clave) => {
              const createdStr = new Date(clave.createdAt).toISOString().slice(0, 10);
              const expiresStr = new Date(clave.expiresAt).toISOString().slice(0, 10);
              const lastUsedStr = clave.lastUsedAt ? relativeTime(clave.lastUsedAt) : "Nunca";
              return (
              <div key={clave.id} className={`px-4 py-3 hover:bg-muted/30 transition-colors ${clave.status === "Expirada" ? "bg-red-50/50" : ""}`} data-testid={`row-key-${clave.id}`}>
                <div className="flex flex-wrap items-start gap-3">
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${clave.status === "Activa" ? "bg-blue-100" : clave.status === "Rotada" ? "bg-yellow-100" : "bg-red-100"}`}>
                    <Lock className={`w-4 h-4 ${clave.status === "Activa" ? "text-blue-600" : clave.status === "Rotada" ? "text-yellow-600" : "text-red-600"}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-mono font-bold text-sm">{clave.name}</span>
                      <Badge className={`text-xs no-default-active-elevate ${STATUS_COLOR[clave.status] ?? ""}`}>{clave.status}</Badge>
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">{clave.type}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>Scope: <strong className="text-foreground">{clave.scope}</strong></span>
                      <span>Creada: {createdStr}</span>
                      <span className={clave.status === "Expirada" ? "text-red-600 font-semibold" : ""}>
                        Expira: {expiresStr}
                      </span>
                      <span>Uso: <strong className="text-foreground">{clave.usage.toLocaleString()}</strong></span>
                      <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{lastUsedStr}</span>
                    </div>

                    {/* Key value */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="text-[11px] font-mono bg-muted px-2 py-1 rounded flex-1 truncate">
                        {visibleKeys.has(clave.id) ? clave.value : maskKey(clave.value)}
                      </code>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => toggleVisibility(clave.id)} data-testid={`toggle-${clave.id}`}>
                      {visibleKeys.has(clave.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleCopy(clave.id, clave.value)} data-testid={`copy-${clave.id}`}>
                      {copied === clave.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                    {isAdmin && clave.status === "Activa" && (
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-yellow-600" onClick={() => rotateMutation.mutate(clave.id)} data-testid={`rotate-${clave.id}`}>
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500" onClick={() => deleteMutation.mutate(clave.id)} data-testid={`delete-${clave.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Security info footer */}
      <Card className="hover-elevate bg-slate-900 text-white">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-xs font-bold text-slate-200">PCI DSS Level 1</p>
                <p className="text-[10px] text-slate-400">Certificación vigente</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-xs font-bold text-slate-200">HSM Protegido</p>
                <p className="text-[10px] text-slate-400">Hardware Security Module</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-xs font-bold text-slate-200">Auditoría Activa</p>
                <p className="text-[10px] text-slate-400">Log de accesos disponible</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-xs font-bold text-slate-200">Rotación Automática</p>
                <p className="text-[10px] text-slate-400">Cada 90 días por política</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
