import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Terminal, UserPlus, Loader2, MonitorSmartphone, User as UserIcon } from "lucide-react";

export interface UserRecord {
  id: string;
  username: string;
  fullName: string;
  role: "ADMIN" | "USER";
  suspended: boolean;
}

export interface TerminalRecord {
  id: string;
  terminalId: string;
  model: string;
  location: string;
  status: string;
  owner: string | null;
}

const UNASSIGNED = "__unassigned__";

export function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "online") return "bg-green-100 text-green-700 border-green-200";
  if (s === "offline") return "bg-red-100 text-red-700 border-red-200";
  if (s === "idle") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-blue-100 text-blue-700 border-blue-200";
}

export function PosAssignmentManager() {
  const { toast } = useToast();

  const [newOwner, setNewOwner] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const { data: terminals = [], isLoading: terminalsLoading } = useQuery<TerminalRecord[]>({
    queryKey: ["/api/terminals"],
  });

  const { data: users = [] } = useQuery<UserRecord[]>({
    queryKey: ["/api/users"],
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ id, owner }: { id: string; owner: string | null }) => {
      const res = await apiRequest("PATCH", `/api/terminals/${id}`, { owner });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error al reasignar terminal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terminals"] });
      toast({ title: "Terminal reasignada", description: "La asignación de POS fue actualizada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al reasignar", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { ownerUsername: string; model: string; location: string }) => {
      const res = await apiRequest("POST", "/api/terminals", data);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message ?? body.error ?? "Error al asignar terminal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terminals"] });
      setNewOwner("");
      setNewModel("");
      setNewLocation("");
      toast({ title: "Terminal asignada", description: "La nueva terminal POS fue creada y asignada." });
    },
    onError: (err: Error) => {
      toast({ title: "No se pudo asignar", description: err.message, variant: "destructive" });
    },
  });

  function handleCreate() {
    if (!newOwner || !newModel.trim() || !newLocation.trim()) {
      toast({ title: "Campos requeridos", description: "Selecciona un usuario e ingresa modelo y ubicación.", variant: "destructive" });
      return;
    }
    createMutation.mutate({ ownerUsername: newOwner, model: newModel.trim(), location: newLocation.trim() });
  }

  const assignableUsers = users.filter(u => !u.suspended);

  function ownerLabel(username: string | null) {
    if (!username) return null;
    return users.find(u => u.username === username)?.fullName ?? username;
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Asignar Nueva Terminal
          </CardTitle>
          <CardDescription>
            Crea una terminal POS y asígnala directamente a un usuario del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pos-owner">Usuario</Label>
              <Select value={newOwner} onValueChange={setNewOwner}>
                <SelectTrigger id="pos-owner" data-testid="select-new-terminal-owner">
                  <SelectValue placeholder="Selecciona un usuario" />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers.map(u => (
                    <SelectItem key={u.id} value={u.username}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-model">Modelo</Label>
              <Input
                id="pos-model"
                placeholder="Ingenico Move 5000"
                value={newModel}
                onChange={e => setNewModel(e.target.value)}
                data-testid="input-new-terminal-model"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-location">Ubicación</Label>
              <Input
                id="pos-location"
                placeholder="Sucursal Centro"
                value={newLocation}
                onChange={e => setNewLocation(e.target.value)}
                data-testid="input-new-terminal-location"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-create-terminal">
              {createMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Asignando...</>
                : <><Terminal className="w-4 h-4 mr-1.5" /> Crear y Asignar</>
              }
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4" /> Terminales POS Registradas
          </CardTitle>
          <CardDescription>
            Cambia el usuario asignado a cada terminal existente
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {terminalsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#c8322b]" />
            </div>
          ) : terminals.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No hay terminales registradas.</div>
          ) : (
            <div className="divide-y">
              {terminals.map(t => (
                <div key={t.id} className="flex flex-wrap lg:flex-nowrap items-center gap-4 p-4" data-testid={`row-terminal-${t.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-sm">{t.terminalId}</span>
                      <Badge className={`${statusBadgeClass(t.status)} no-default-active-elevate text-xs`}>
                        {t.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{t.model} · {t.location}</p>
                  </div>
                  <div className="flex items-center gap-2 min-w-0 flex-shrink-0 w-full lg:w-64">
                    <UserIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <Select
                      value={t.owner ?? UNASSIGNED}
                      onValueChange={(v) => reassignMutation.mutate({ id: t.id, owner: v === UNASSIGNED ? null : v })}
                      disabled={reassignMutation.isPending}
                    >
                      <SelectTrigger className="h-8 text-xs" data-testid={`select-owner-${t.id}`}>
                        <SelectValue placeholder="Sin asignar">
                          {t.owner ? ownerLabel(t.owner) : "Sin asignar"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
                        {assignableUsers.map(u => (
                          <SelectItem key={u.id} value={u.username}>{u.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
