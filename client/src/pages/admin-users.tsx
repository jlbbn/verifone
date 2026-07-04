import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users, UserPlus, Search, Calendar, Terminal, Shield,
  User, Loader2, CheckCircle, RefreshCw, Mail, Ban, Unlock,
  CreditCard, Monitor, Wallet, Pencil, Check, X
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface UserRecord {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "USER";
  subscriptionStart: string | null;
  suspended: boolean;
  paymentEngineAccess: boolean;
  posFullAccess: boolean;
  cajaSaldoUSD: number;
}

function fmtUSD(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface TerminalRecord {
  id: string;
  terminalId: string;
  model: string;
  location: string;
  status: string;
  owner: string | null;
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function getSubscriptionStatus(start: string | null) {
  if (!start) return null;
  const end = new Date(start);
  end.setMonth(end.getMonth() + 12);
  const now = new Date();
  const days = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  if (days <= 0) return { label: "Vencida", color: "bg-red-100 text-red-700 border-red-200", days: 0 };
  if (days <= 30) return { label: `${days}d restantes`, color: "bg-yellow-100 text-yellow-700 border-yellow-200", days };
  return { label: `${days}d restantes`, color: "bg-green-100 text-green-700 border-green-200", days };
}

export default function AdminUsuariosPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // Form state
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formRole, setFormRole] = useState<"USER" | "ADMIN">("USER");
  const [formSubscription, setFormSubscription] = useState("");

  // Edición inline de la caja individual de cada usuario
  const [editingCajaId, setEditingCajaId] = useState<string | null>(null);
  const [cajaDraft, setCajaDraft] = useState("");

  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery<UserRecord[]>({
    queryKey: ["/api/users"],
  });

  const { data: terminals = [] } = useQuery<TerminalRecord[]>({
    queryKey: ["/api/terminals"],
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ id, suspended }: { id: string; suspended: boolean }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}/suspend`, { suspended });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: vars.suspended ? "Usuario suspendido" : "Acceso restaurado" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const permissionsMutation = useMutation({
    mutationFn: async ({ id, paymentEngineAccess, posFullAccess }: {
      id: string; paymentEngineAccess?: boolean; posFullAccess?: boolean;
    }) => {
      const res = await apiRequest("PATCH", `/api/admin/user-permissions/${id}`, { paymentEngineAccess, posFullAccess });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? "Error"); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cajaMutation = useMutation({
    mutationFn: async ({ id, cajaSaldoUSD }: { id: string; cajaSaldoUSD: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/user-caja/${id}`, { cajaSaldoUSD });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? "Error"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingCajaId(null);
      toast({ title: "Caja actualizada" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: {
      username: string; password: string; fullName: string;
      role: string; subscriptionStart: string | null;
    }) => {
      const res = await apiRequest("POST", "/api/users", data);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error al crear usuario");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAddOpen(false);
      resetForm();
      toast({ title: "Usuario creado", description: "El nuevo usuario fue registrado exitosamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFormUsername(""); setFormPassword(""); setFormFullName("");
    setFormRole("USER"); setFormSubscription("");
  }

  function handleAddUser() {
    if (!formUsername.trim() || !formPassword.trim() || !formFullName.trim()) {
      toast({ title: "Campos requeridos", description: "Completa todos los campos obligatorios.", variant: "destructive" });
      return;
    }
    createUserMutation.mutate({
      username: formUsername.trim(),
      password: formPassword.trim(),
      fullName: formFullName.trim(),
      role: formRole,
      subscriptionStart: formSubscription.trim() ? new Date(formSubscription).toISOString() : null,
    });
  }

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const adminCount = users.filter(u => u.role === "ADMIN").length;
  const userCount  = users.filter(u => u.role === "USER").length;
  const activeCount = users.filter(u => {
    if (!u.subscriptionStart) return false;
    const end = new Date(u.subscriptionStart);
    end.setMonth(end.getMonth() + 12);
    return end > new Date();
  }).length;

  function getTerminalsForUser(username: string): TerminalRecord[] {
    return terminals.filter(t => t.owner === username);
  }

  function startEditCaja(u: UserRecord) {
    setEditingCajaId(u.id);
    setCajaDraft(u.cajaSaldoUSD.toFixed(2));
  }

  function saveCaja(id: string) {
    const parsed = parseFloat(cajaDraft);
    if (isNaN(parsed)) {
      toast({ title: "Monto inválido", description: "Ingresa un número válido.", variant: "destructive" });
      return;
    }
    cajaMutation.mutate({ id, cajaSaldoUSD: parsed });
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="w-7 h-7 text-[#c8322b]" /> Gestión de Usuarios
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Administración completa de usuarios del sistema
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refetchUsers()} data-testid="button-refresh-users">
            <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
          </Button>
          <Button size="sm" className="bg-[#c8322b] text-white" onClick={() => setAddOpen(true)} data-testid="button-add-user">
            <UserPlus className="w-4 h-4 mr-1" /> Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="hover-elevate">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Usuarios</p>
                <p className="text-3xl font-bold">{users.length}</p>
              </div>
              <div className="w-10 h-10 rounded-md bg-[#c8322b]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#c8322b]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Administradores</p>
                <p className="text-3xl font-bold text-[#c8322b]">{adminCount}</p>
                <p className="text-xs text-muted-foreground">{userCount} usuarios</p>
              </div>
              <div className="w-10 h-10 rounded-md bg-purple-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Suscripciones Activas</p>
                <p className="text-3xl font-bold text-green-600">{activeCount}</p>
                <p className="text-xs text-muted-foreground">de {users.length} usuarios</p>
              </div>
              <div className="w-10 h-10 rounded-md bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="w-4 h-4" /> Usuarios Registrados
              </CardTitle>
              <CardDescription>Lista completa de cuentas del sistema</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar usuario..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-8 w-52 text-sm"
                data-testid="input-search-user"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {usersLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#c8322b]" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No hay usuarios que coincidan.</div>
          ) : (
            <div className="divide-y">
              {filteredUsers.map((u) => {
                const sub = getSubscriptionStatus(u.subscriptionStart);
                const userTerminals = getTerminalsForUser(u.username);
                return (
                  <div key={u.id} className="flex flex-wrap lg:flex-nowrap items-start gap-4 p-4 hover:bg-muted/30 transition-colors" data-testid={`row-user-${u.id}`}>
                    {/* Avatar */}
                    <Avatar className="w-11 h-11 flex-shrink-0">
                      <AvatarFallback className={`font-bold text-sm ${u.suspended ? "bg-gray-400 text-white" : u.role === "ADMIN" ? "bg-[#c8322b] text-white" : "bg-muted text-foreground"}`}>
                        {initials(u.fullName)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className={`font-bold text-base ${u.suspended ? "text-muted-foreground line-through" : ""}`}>{u.fullName}</span>
                        <Badge className={u.role === "ADMIN"
                          ? "bg-[#c8322b]/10 text-[#c8322b] border-[#c8322b]/20 no-default-active-elevate"
                          : "bg-blue-100 text-blue-700 border-blue-200 no-default-active-elevate"
                        }>
                          {u.role === "ADMIN" ? <><Shield className="w-3 h-3 mr-1" />ADMIN</> : <><User className="w-3 h-3 mr-1" />USER</>}
                        </Badge>
                        {u.suspended && (
                          <Badge className="bg-red-100 text-red-700 border-red-200 no-default-active-elevate gap-1">
                            <Ban className="w-3 h-3" /> Suspendido
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{u.username}</span>
                        {u.subscriptionStart && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Desde {new Date(u.subscriptionStart).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>

                      {/* Terminals */}
                      {userTerminals.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {userTerminals.map(t => (
                            <div key={t.id} className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs">
                              <Terminal className="w-3 h-3 text-[#c8322b]" />
                              <span className="font-semibold">{t.terminalId}</span>
                              <span className="text-muted-foreground">·</span>
                              <span>{t.model.split(" ").slice(-1)[0]}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Subscription badge + suspend button */}
                    <div className="flex flex-col items-end gap-1.5 min-w-[155px]">
                      {sub ? (
                        <Badge className={`${sub.color} no-default-active-elevate text-xs`}>
                          <Calendar className="w-3 h-3 mr-1" />{sub.label}
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground border-border no-default-active-elevate text-xs">Sin suscripción</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {userTerminals.length === 0
                          ? "Sin terminal"
                          : `${userTerminals.length} terminal${userTerminals.length > 1 ? "es" : ""}`}
                      </span>
                      {u.role !== "ADMIN" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className={`text-xs h-7 gap-1 mt-0.5 ${u.suspended ? "border-green-300 text-green-700" : "border-red-300 text-red-700"}`}
                          disabled={suspendMutation.isPending}
                          onClick={() => suspendMutation.mutate({ id: u.id, suspended: !u.suspended })}
                          data-testid={`button-suspend-${u.id}`}
                        >
                          {u.suspended
                            ? <><Unlock className="w-3 h-3" /> Reactivar</>
                            : <><Ban className="w-3 h-3" /> Suspender</>
                          }
                        </Button>
                      )}
                      {u.role !== "ADMIN" && (
                        <div className="flex flex-col gap-1.5 mt-1 pt-2 border-t border-border w-full">
                          <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <CreditCard className="w-3 h-3" /> Motor Pagos
                            </span>
                            <Switch
                              checked={!!u.paymentEngineAccess}
                              onCheckedChange={(v) => permissionsMutation.mutate({ id: u.id, paymentEngineAccess: v })}
                              disabled={permissionsMutation.isPending}
                              data-testid={`switch-payment-engine-${u.id}`}
                            />
                          </label>
                          <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Monitor className="w-3 h-3" /> POS Virtual
                            </span>
                            <Switch
                              checked={!!u.posFullAccess}
                              onCheckedChange={(v) => permissionsMutation.mutate({ id: u.id, posFullAccess: v })}
                              disabled={permissionsMutation.isPending}
                              data-testid={`switch-pos-${u.id}`}
                            />
                          </label>
                          <div className="flex items-center justify-between gap-2 text-xs pt-1">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Wallet className="w-3 h-3" /> Caja
                            </span>
                            {editingCajaId === u.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={cajaDraft}
                                  onChange={e => setCajaDraft(e.target.value)}
                                  type="number"
                                  step="0.01"
                                  className="h-7 w-24 text-xs font-mono"
                                  autoFocus
                                  data-testid={`input-caja-${u.id}`}
                                />
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-7 w-7"
                                  disabled={cajaMutation.isPending}
                                  onClick={() => saveCaja(u.id)}
                                  data-testid={`button-save-caja-${u.id}`}
                                >
                                  {cajaMutation.isPending
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Check className="w-3.5 h-3.5 text-green-600" />}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-7 w-7"
                                  disabled={cajaMutation.isPending}
                                  onClick={() => setEditingCajaId(null)}
                                  data-testid={`button-cancel-caja-${u.id}`}
                                >
                                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                className="flex items-center gap-1.5 font-mono font-semibold hover-elevate rounded-md px-1.5 py-0.5"
                                onClick={() => startEditCaja(u)}
                                data-testid={`button-edit-caja-${u.id}`}
                              >
                                ${fmtUSD(u.cajaSaldoUSD)} USD
                                <Pencil className="w-3 h-3 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Agregar Usuario */}
      <Dialog open={addOpen} onOpenChange={v => { setAddOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#c8322b]" /> Nuevo Usuario
            </DialogTitle>
            <DialogDescription>
              Crea una nueva cuenta de acceso al sistema Banxico Plus.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label htmlFor="u-fullname">Nombre completo <span className="text-[#c8322b]">*</span></Label>
              <Input
                id="u-fullname"
                placeholder="Ej. María García López"
                value={formFullName}
                onChange={e => setFormFullName(e.target.value)}
                data-testid="input-user-fullname"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-username">Usuario / Email <span className="text-[#c8322b]">*</span></Label>
              <Input
                id="u-username"
                placeholder="usuario@dominio.com"
                value={formUsername}
                onChange={e => setFormUsername(e.target.value)}
                data-testid="input-user-username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-password">Contraseña <span className="text-[#c8322b]">*</span></Label>
              <Input
                id="u-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={formPassword}
                onChange={e => setFormPassword(e.target.value)}
                data-testid="input-user-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-role">Rol</Label>
              <Select value={formRole} onValueChange={v => setFormRole(v as "USER" | "ADMIN")}>
                <SelectTrigger id="u-role" data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Usuario estándar</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-subscription">Fecha de inicio de suscripción (opcional)</Label>
              <Input
                id="u-subscription"
                type="date"
                value={formSubscription}
                onChange={e => setFormSubscription(e.target.value)}
                data-testid="input-user-subscription"
              />
              <p className="text-xs text-muted-foreground">Se asigna un plan de 12 meses a partir de esta fecha.</p>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => { setAddOpen(false); resetForm(); }} data-testid="button-add-user-cancel">
              Cancelar
            </Button>
            <Button
              className="bg-[#c8322b] text-white"
              disabled={!formUsername.trim() || !formPassword.trim() || !formFullName.trim() || createUserMutation.isPending}
              onClick={handleAddUser}
              data-testid="button-add-user-submit"
            >
              {createUserMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creando...</>
                : <><UserPlus className="w-4 h-4 mr-1" /> Crear Usuario</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
