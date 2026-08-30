import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy, Check, ArrowDownToLine, ArrowUpFromLine, ShieldCheck, Loader2,
  Clock, CheckCircle2, XCircle, AlertTriangle, Send, Wallet, History, Sparkles,
} from "lucide-react";
import { SiTether } from "react-icons/si";

interface DepositInfo {
  address: string | null;
  configured: boolean;
  network: string;
  token: string;
  contract: string;
}

interface WithdrawalRequest {
  id: number;
  amountUsdt: string;
  toAddress: string;
  status: string;
  createdAt: string;
  rejectionReason: string | null;
}

function statusMeta(status: string) {
  switch (status) {
    case "pending":
      return { label: "Pendiente de aprobación", color: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: Clock };
    case "approved":
      return { label: "Aprobado", color: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: ShieldCheck };
    case "broadcast":
      return { label: "Transmitido a la red", color: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: Send };
    case "confirmed":
      return { label: "Confirmado", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 };
    case "rejected":
      return { label: "Rechazado", color: "bg-red-500/10 text-red-400 border-red-500/30", icon: XCircle };
    case "failed":
      return { label: "Falló", color: "bg-red-500/10 text-red-400 border-red-500/30", icon: XCircle };
    default:
      return { label: status, color: "bg-muted text-muted-foreground border-border", icon: AlertTriangle };
  }
}

export default function TronUsdtPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [declareTxid, setDeclareTxid] = useState("");
  const [declareNote, setDeclareNote] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { data: depositInfo } = useQuery<DepositInfo>({ queryKey: ["/api/crypto/tron-deposit-info"] });
  const { data: balances } = useQuery<Record<string, number>>({ queryKey: ["/api/crypto-balances"] });
  const { data: withdrawals = [] } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/crypto/tron-withdrawal"],
    refetchInterval: 15_000,
  });

  const usdtBalance = balances?.usdt ?? 0;

  const declareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crypto/tron-deposit/declare", { txid: declareTxid.trim(), note: declareNote.trim() || undefined });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Depósito declarado", description: "Un administrador revisará tu transferencia y acreditará tu saldo tras verificarla en la blockchain." });
      setDeclareTxid("");
      setDeclareNote("");
    },
    onError: (err: Error) => toast({ title: "No se pudo declarar el depósito", description: err.message, variant: "destructive" }),
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crypto/tron-withdrawal", { toAddress: withdrawAddress.trim(), amountUsdt: withdrawAmount.trim() });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Retiro solicitado", description: "Tu saldo fue reservado. Un administrador aprobará la transferencia en breve." });
      setWithdrawAddress("");
      setWithdrawAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/tron-withdrawal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crypto-balances"] });
    },
    onError: (err: Error) => toast({ title: "No se pudo solicitar el retiro", description: err.message, variant: "destructive" }),
  });

  const copyAddress = () => {
    if (!depositInfo?.address) return;
    navigator.clipboard.writeText(depositInfo.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-full relative bg-[#06110d] overflow-hidden">
      {/* ── Ambient backdrop ── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="absolute -top-40 left-1/4 w-[32rem] h-[32rem] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-7">
        {/* ── Header ── */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/50 via-[#0a1a15]/80 to-[#0a1a15]/60 backdrop-blur-sm px-5 py-5 sm:px-7 sm:py-6">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
          <div className="relative flex flex-wrap items-center gap-4">
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-1 ring-white/10">
              <SiTether className="w-7 h-7 text-white drop-shadow" />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0a1a15] border border-emerald-500/40 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight text-white" data-testid="text-tron-usdt-title">USDT · Red TRON</h1>
                <Badge variant="outline" className="text-[10px] font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-300 gap-1">
                  <ShieldCheck className="w-3 h-3" /> On-chain real
                </Badge>
              </div>
              <p className="text-sm text-emerald-100/50 mt-0.5">Depósitos y retiros reales sobre la blockchain de TRON (TRC-20)</p>
            </div>
            <div className="ml-auto text-right pl-4 border-l border-emerald-500/10">
              <p className="text-[11px] uppercase tracking-wider text-emerald-100/40 flex items-center justify-end gap-1">
                <Wallet className="w-3 h-3" /> Saldo disponible
              </p>
              <p className="text-2xl font-semibold tabular-nums text-white" data-testid="text-usdt-balance">
                {usdtBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}{" "}
                <span className="text-sm font-normal text-emerald-300/70">USDT</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── Depositar ── */}
          <Card className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-b from-emerald-950/40 via-card to-card">
            <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
            <CardContent className="relative p-6 space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center ring-1 ring-emerald-500/20">
                  <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
                </div>
                <h2 className="font-semibold">Depositar USDT (TRON)</h2>
              </div>

              {depositInfo?.configured && depositInfo.address ? (
                <>
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className="relative p-4 bg-white rounded-2xl shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_20px_40px_-15px_rgba(16,185,129,0.35)]">
                      <QRCodeSVG value={depositInfo.address} size={148} level="M" />
                      <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl-md" />
                      <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr-md" />
                      <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl-md" />
                      <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br-md" />
                    </div>
                    <Badge variant="outline" className="text-[10px] font-normal border-emerald-500/30 bg-emerald-500/5 text-emerald-300">
                      Red TRC-20 · solo USDT
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dirección de depósito de la plataforma</Label>
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-muted/40 px-3 py-2.5 transition-colors hover:border-emerald-500/30">
                      <code className="text-xs flex-1 break-all font-mono" data-testid="text-deposit-address">{depositInfo.address}</code>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={copyAddress} data-testid="button-copy-address">
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      Envía únicamente USDT sobre la red TRC-20 a esta dirección. Un administrador verifica cada transferencia
                      directamente en la blockchain antes de acreditar tu saldo — puede tomar algo de tiempo.
                    </p>
                  </div>

                  <div className="space-y-2 pt-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-emerald-400" /> Declarar mi transferencia (opcional, acelera la revisión)
                    </Label>
                    <Input
                      placeholder="Hash de la transacción (txid)"
                      value={declareTxid}
                      onChange={(e) => setDeclareTxid(e.target.value)}
                      className="font-mono text-xs"
                      data-testid="input-declare-txid"
                    />
                    <Textarea
                      placeholder="Nota opcional para el administrador"
                      value={declareNote}
                      onChange={(e) => setDeclareNote(e.target.value)}
                      className="text-xs min-h-[60px]"
                      data-testid="input-declare-note"
                    />
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                      disabled={!declareTxid.trim() || declareMutation.isPending}
                      onClick={() => declareMutation.mutate()}
                      data-testid="button-declare-deposit"
                    >
                      {declareMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Declarar depósito
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  La wallet de depósito no está configurada actualmente.
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Retirar ── */}
          <Card className="relative overflow-hidden border-border">
            <div className="absolute -top-24 -left-24 w-56 h-56 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardContent className="relative p-6 space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                  <ArrowUpFromLine className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-semibold">Retirar USDT (TRON)</h2>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Dirección TRON de destino</Label>
                  <Input
                    placeholder="T..."
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="font-mono text-xs"
                    data-testid="input-withdraw-address"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Monto (USDT)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.000001"
                      min="0"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="pr-20"
                      data-testid="input-withdraw-amount"
                    />
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(String(usdtBalance))}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-medium px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      MÁX
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Disponible: <span className="tabular-nums text-foreground/80">{usdtBalance.toLocaleString("en-US", { maximumFractionDigits: 6 })}</span> USDT
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 flex gap-2">
                  <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Tu saldo se reserva de inmediato al enviar la solicitud. Un administrador aprueba cada retiro antes
                    de transmitirlo a la red TRON.
                  </p>
                </div>
                <Button
                  className="w-full"
                  disabled={!withdrawAddress.trim() || !withdrawAmount.trim() || withdrawMutation.isPending || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > usdtBalance}
                  onClick={() => withdrawMutation.mutate()}
                  data-testid="button-request-withdrawal"
                >
                  {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Solicitar retiro
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Historial de retiros ── */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Mis solicitudes de retiro
          </h3>
          {withdrawals.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center space-y-2">
                <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <History className="w-5 h-5 text-muted-foreground/60" />
                </div>
                <p className="text-sm text-muted-foreground">Aún no has solicitado ningún retiro.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {withdrawals.map((w) => {
                const meta = statusMeta(w.status);
                const Icon = meta.icon;
                return (
                  <Card key={w.id} data-testid={`card-withdrawal-${w.id}`} className="transition-colors hover:border-emerald-500/25">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                        <ArrowUpFromLine className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium tabular-nums">{Number(w.amountUsdt).toLocaleString("en-US", { maximumFractionDigits: 6 })} USDT</p>
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">{w.toAddress}</p>
                        {w.rejectionReason && <p className="text-xs text-red-400 mt-1">{w.rejectionReason}</p>}
                      </div>
                      <Badge variant="outline" className={`text-[11px] gap-1.5 shrink-0 ${meta.color}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
