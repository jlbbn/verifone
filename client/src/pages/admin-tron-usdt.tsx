import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, ShieldCheck, Loader2, CheckCircle2, XCircle, Clock, Send,
  ArrowDownToLine, ArrowUpFromLine, AlertTriangle, ExternalLink, Info,
} from "lucide-react";
import { SiTether } from "react-icons/si";

interface OnChainInfo {
  txid: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  fromAddress: string | null;
  toAddress: string | null;
  usdtAmount: number | null;
  contractAddress: string | null;
  blockNumber: number | null;
}

interface VerifyResult {
  onChain: OnChainInfo;
  alreadyCredited: boolean;
  creditedTo: string | null;
  eligible: boolean;
  reasonIfIneligible: string | null;
}

interface UserRow { id: string; username: string; fullName: string; email: string; }

interface WithdrawalRequest {
  id: number;
  userId: string;
  amountUsdt: string;
  toAddress: string;
  status: string;
  createdAt: string;
}

interface DepositDeclaration {
  id: number;
  userId: string;
  declaredTxid: string;
  note: string | null;
  createdAt: string;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string; icon: any }> = {
    pending: { label: "Pendiente", className: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: Clock },
    approved: { label: "Aprobado", className: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: ShieldCheck },
    broadcast: { label: "Transmitido", className: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: Send },
    confirmed: { label: "Confirmado", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    rejected: { label: "Rechazado", className: "bg-red-500/10 text-red-400 border-red-500/30", icon: XCircle },
    failed: { label: "Falló", className: "bg-red-500/10 text-red-400 border-red-500/30", icon: XCircle },
  };
  return map[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border", icon: Info };
}

export default function AdminTronUsdtPage() {
  const { toast } = useToast();
  const [txid, setTxid] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveTarget, setApproveTarget] = useState<WithdrawalRequest | null>(null);
  const [approvePassword, setApprovePassword] = useState("");

  const { data: users = [] } = useQuery<UserRow[]>({ queryKey: ["/api/users"] });
  const { data: withdrawals = [] } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/admin/tron/withdrawals"],
    refetchInterval: 15_000,
  });
  const { data: declarations = [] } = useQuery<DepositDeclaration[]>({
    queryKey: ["/api/admin/tron/deposit/declarations"],
    refetchInterval: 30_000,
  });

  const userById = new Map(users.map((u) => [u.id, u]));
  const filteredUsers = users.filter((u) =>
    !userSearch || u.username.toLowerCase().includes(userSearch.toLowerCase()) || u.fullName.toLowerCase().includes(userSearch.toLowerCase()),
  );

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/tron/deposit/verify", { txid: txid.trim() });
      return res.json() as Promise<VerifyResult>;
    },
    onSuccess: (data) => setVerifyResult(data),
    onError: (err: Error) => toast({ title: "No se pudo verificar el txid", description: err.message, variant: "destructive" }),
  });

  const creditMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/tron/deposit/credit", { txid: txid.trim(), userId: selectedUserId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Depósito acreditado", description: "El saldo del usuario fue actualizado y quedó registrado en el ledger." });
      setTxid(""); setVerifyResult(null); setSelectedUserId("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tron/deposit/declarations"] });
    },
    onError: (err: Error) => toast({ title: "No se pudo acreditar el depósito", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await apiRequest("POST", `/api/admin/tron/withdrawals/${id}/approve`, { password });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Retiro aprobado", description: "La transferencia fue enviada al firmador remoto." });
      setApproveTarget(null); setApprovePassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tron/withdrawals"] });
    },
    onError: (err: Error) => toast({ title: "No se pudo aprobar el retiro", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/tron/withdrawals/${id}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Retiro rechazado", description: "El saldo del usuario fue reembolsado." });
      setRejectTarget(null); setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tron/withdrawals"] });
    },
    onError: (err: Error) => toast({ title: "No se pudo rechazar el retiro", description: err.message, variant: "destructive" }),
  });

  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");
  const resolvedWithdrawals = withdrawals.filter((w) => w.status !== "pending");

  return (
    <div className="min-h-full bg-gradient-to-b from-background via-background to-muted/20">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <SiTether className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-admin-tron-title">Depósitos y retiros USDT · TRON</h1>
            <p className="text-sm text-muted-foreground">Verificación manual de depósitos on-chain y aprobación de retiros</p>
          </div>
        </div>

        <Tabs defaultValue="deposits">
          <TabsList>
            <TabsTrigger value="deposits" data-testid="tab-deposits"><ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" />Depósitos</TabsTrigger>
            <TabsTrigger value="withdrawals" data-testid="tab-withdrawals"><ArrowUpFromLine className="w-3.5 h-3.5 mr-1.5" />
              Retiros{pendingWithdrawals.length > 0 && <Badge className="ml-1.5 h-4 px-1.5 text-[10px]">{pendingWithdrawals.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* ── Depósitos ── */}
          <TabsContent value="deposits" className="space-y-6 mt-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="font-semibold text-sm">Verificar un txid on-chain</h2>
                <div className="flex gap-2">
                  <Input
                    placeholder="Hash de la transacción (txid)"
                    value={txid}
                    onChange={(e) => { setTxid(e.target.value); setVerifyResult(null); }}
                    className="font-mono text-xs"
                    data-testid="input-verify-txid"
                  />
                  <Button onClick={() => verifyMutation.mutate()} disabled={!txid.trim() || verifyMutation.isPending} data-testid="button-verify-txid">
                    {verifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>

                {verifyResult && (
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><p className="text-muted-foreground">Estado on-chain</p><p className="font-medium">{verifyResult.onChain.status}</p></div>
                      <div><p className="text-muted-foreground">Monto USDT</p><p className="font-medium tabular-nums">{verifyResult.onChain.usdtAmount ?? "—"}</p></div>
                      <div className="col-span-2"><p className="text-muted-foreground">Desde</p><p className="font-mono break-all">{verifyResult.onChain.fromAddress ?? "—"}</p></div>
                      <div className="col-span-2"><p className="text-muted-foreground">Hacia (debe ser la hot wallet)</p><p className="font-mono break-all">{verifyResult.onChain.toAddress ?? "—"}</p></div>
                    </div>

                    {verifyResult.alreadyCredited ? (
                      <div className="flex items-center gap-2 text-sm text-amber-400">
                        <AlertTriangle className="w-4 h-4" /> Este depósito ya fue acreditado anteriormente.
                      </div>
                    ) : verifyResult.eligible ? (
                      <div className="space-y-2 pt-1">
                        <Label className="text-xs text-muted-foreground">Acreditar a</Label>
                        <Input placeholder="Buscar usuario..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="text-xs" data-testid="input-user-search" />
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger data-testid="select-credit-user"><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger>
                          <SelectContent>
                            {filteredUsers.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.fullName} · {u.username}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          className="w-full"
                          disabled={!selectedUserId || creditMutation.isPending}
                          onClick={() => creditMutation.mutate()}
                          data-testid="button-credit-deposit"
                        >
                          {creditMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                          Acreditar {verifyResult.onChain.usdtAmount} USDT
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-red-400">
                        <XCircle className="w-4 h-4" /> {verifyResult.reasonIfIneligible}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Depósitos auto-declarados por usuarios</h3>
              {declarations.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No hay declaraciones pendientes.</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {declarations.map((d) => (
                    <Card key={d.id} data-testid={`card-declaration-${d.id}`}>
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{userById.get(d.userId)?.fullName ?? d.userId}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{d.declaredTxid}</p>
                          {d.note && <p className="text-xs text-muted-foreground mt-1">{d.note}</p>}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => { setTxid(d.declaredTxid); setSelectedUserId(d.userId); verifyMutation.mutate(); }} data-testid={`button-review-declaration-${d.id}`}>
                          Revisar
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Retiros ── */}
          <TabsContent value="withdrawals" className="space-y-6 mt-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pendientes de aprobación</h3>
              {pendingWithdrawals.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No hay retiros pendientes.</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {pendingWithdrawals.map((w) => (
                    <Card key={w.id} data-testid={`card-withdrawal-${w.id}`}>
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{userById.get(w.userId)?.fullName ?? w.userId}</p>
                          <p className="font-medium tabular-nums">{Number(w.amountUsdt).toLocaleString("en-US", { maximumFractionDigits: 6 })} USDT</p>
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">{w.toAddress}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline" className="text-red-400 border-red-500/30" onClick={() => setRejectTarget(w)} data-testid={`button-reject-${w.id}`}>Rechazar</Button>
                          <Button size="sm" onClick={() => setApproveTarget(w)} data-testid={`button-approve-${w.id}`}>Aprobar</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Historial</h3>
              {resolvedWithdrawals.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Sin historial todavía.</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {resolvedWithdrawals.map((w) => {
                    const meta = statusBadge(w.status);
                    const Icon = meta.icon;
                    return (
                      <Card key={w.id}>
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{userById.get(w.userId)?.fullName ?? w.userId}</p>
                            <p className="font-medium tabular-nums">{Number(w.amountUsdt).toLocaleString("en-US", { maximumFractionDigits: 6 })} USDT</p>
                          </div>
                          <Badge variant="outline" className={`text-[11px] gap-1.5 shrink-0 ${meta.className}`}><Icon className="w-3 h-3" /> {meta.label}</Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialog: aprobar retiro ── */}
      <Dialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aprobar retiro</DialogTitle></DialogHeader>
          {approveTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Vas a transmitir <strong>{Number(approveTarget.amountUsdt).toLocaleString("en-US", { maximumFractionDigits: 6 })} USDT</strong> a{" "}
                <code className="text-xs break-all">{approveTarget.toAddress}</code>. Esta acción firma y transmite una transferencia real.
              </p>
              <Label className="text-xs text-muted-foreground">Confirma tu contraseña</Label>
              <Input type="password" value={approvePassword} onChange={(e) => setApprovePassword(e.target.value)} data-testid="input-approve-password" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Cancelar</Button>
            <Button
              disabled={!approvePassword || approveMutation.isPending}
              onClick={() => approveTarget && approveMutation.mutate({ id: approveTarget.id, password: approvePassword })}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar y transmitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: rechazar retiro ── */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rechazar retiro</DialogTitle></DialogHeader>
          {rejectTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                El saldo reservado ({Number(rejectTarget.amountUsdt).toLocaleString("en-US", { maximumFractionDigits: 6 })} USDT) será devuelto al usuario.
              </p>
              <Label className="text-xs text-muted-foreground">Motivo</Label>
              <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} data-testid="input-reject-reason" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Rechazar y reembolsar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
