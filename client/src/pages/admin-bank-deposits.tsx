import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Landmark, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

interface UserRow { id: string; username: string; fullName: string; email: string; }

interface BankDepositDeclaration {
  id: number;
  userId: string;
  clabeDestino: string;
  montoDeclarado: string;
  moneda: string;
  referencia: string | null;
  note: string | null;
  status: string;
  createdAt: string;
}

export default function AdminBankDepositsPage() {
  const { toast } = useToast();
  const [rejectTarget, setRejectTarget] = useState<BankDepositDeclaration | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: users = [] } = useQuery<UserRow[]>({ queryKey: ["/api/users"] });
  const { data: queue = [], isLoading } = useQuery<BankDepositDeclaration[]>({
    queryKey: ["/api/admin/bank-deposit/queue"],
    refetchInterval: 15_000,
  });

  const userById = new Map(users.map((u) => [u.id, u]));

  const verifyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/bank-deposit/${id}/verify`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Depósito acreditado", description: "El saldo del usuario fue actualizado y quedó registrado en su historial de transacciones." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-deposit/queue"] });
    },
    onError: (err: Error) => toast({ title: "No se pudo acreditar el depósito", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget) return;
      const res = await apiRequest("POST", `/api/admin/bank-deposit/${rejectTarget.id}/reject`, { reason: rejectReason.trim() || undefined });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Declaración rechazada" });
      setRejectTarget(null); setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-deposit/queue"] });
    },
    onError: (err: Error) => toast({ title: "No se pudo rechazar", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-admin-bank-deposits-title">Depósitos Bancarios Declarados</h1>
            <p className="text-sm text-muted-foreground">Coteja cada declaración contra el estado de cuenta real antes de acreditar.</p>
          </div>
        </div>

        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-200/90 leading-relaxed">
            No hay integración automática con el banco. Verifica manualmente en el estado de cuenta real que el
            depósito llegó antes de presionar "Acreditar" — la acción crea la transacción y actualiza el saldo del
            usuario de inmediato y no se puede deshacer desde aquí.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : queue.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center space-y-2">
              <Clock className="w-6 h-6 text-muted-foreground/60 mx-auto" />
              <p className="text-sm text-muted-foreground">No hay declaraciones pendientes de revisión.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {queue.map((d) => {
              const u = userById.get(d.userId);
              return (
                <Card key={d.id} data-testid={`card-admin-bank-declaration-${d.id}`}>
                  <CardContent className="p-4 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium tabular-nums">
                          {Number(d.montoDeclarado).toLocaleString("en-US", { minimumFractionDigits: 2 })} {d.moneda}
                        </p>
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">Pendiente</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {u ? `${u.fullName} (${u.username})` : d.userId}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">CLABE destino: {d.clabeDestino}</p>
                      {d.referencia && <p className="text-xs text-muted-foreground/70 mt-0.5">Ref: {d.referencia}</p>}
                      {d.note && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">"{d.note}"</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30"
                        onClick={() => setRejectTarget(d)}
                        data-testid={`button-reject-${d.id}`}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Rechazar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        disabled={verifyMutation.isPending}
                        onClick={() => verifyMutation.mutate(d.id)}
                        data-testid={`button-verify-${d.id}`}
                      >
                        {verifyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                        Acreditar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar declaración</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Motivo (opcional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            data-testid="input-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending} data-testid="button-confirm-reject">
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
