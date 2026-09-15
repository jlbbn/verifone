import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Landmark, Loader2, Clock, CheckCircle2, XCircle, AlertTriangle,
  History, Send, ShieldCheck,
} from "lucide-react";

interface BankDepositDeclaration {
  id: number;
  clabeDestino: string;
  montoDeclarado: string;
  moneda: string;
  referencia: string | null;
  note: string | null;
  status: "pending" | "verified" | "rejected";
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

function statusMeta(status: string) {
  switch (status) {
    case "pending":
      return { label: "Pendiente de verificación", color: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: Clock };
    case "verified":
      return { label: "Verificado y acreditado", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 };
    case "rejected":
      return { label: "Rechazado", color: "bg-red-500/10 text-red-400 border-red-500/30", icon: XCircle };
    default:
      return { label: status, color: "bg-muted text-muted-foreground border-border", icon: AlertTriangle };
  }
}

export default function MisDepositosPage() {
  const { toast } = useToast();
  const [clabeDestino, setClabeDestino] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState("MXN");
  const [referencia, setReferencia] = useState("");
  const [note, setNote] = useState("");

  const { data: declarations = [], isLoading } = useQuery<BankDepositDeclaration[]>({
    queryKey: ["/api/bank-deposit/declarations"],
    refetchInterval: 15_000,
  });

  const declareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bank-deposit/declare", {
        clabeDestino: clabeDestino.trim(),
        montoDeclarado: Number(monto),
        moneda,
        referencia: referencia.trim() || undefined,
        note: note.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Depósito declarado", description: "Un administrador cotejará tu transferencia contra el estado de cuenta real y acreditará tu saldo tras verificarla." });
      setClabeDestino(""); setMonto(""); setReferencia(""); setNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/bank-deposit/declarations"] });
    },
    onError: (err: Error) => toast({ title: "No se pudo declarar el depósito", description: err.message, variant: "destructive" }),
  });

  const canDeclare = clabeDestino.trim().length >= 10 && Number(monto) > 0 && !declareMutation.isPending;

  return (
    <div className="min-h-full relative bg-[#06110d] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="absolute -top-40 left-1/4 w-[32rem] h-[32rem] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-7">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/50 via-[#0a1a15]/80 to-[#0a1a15]/60 backdrop-blur-sm px-5 py-5 sm:px-7 sm:py-6">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
          <div className="relative flex flex-wrap items-center gap-4">
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-1 ring-white/10">
              <Landmark className="w-7 h-7 text-white drop-shadow" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-white" data-testid="text-mis-depositos-title">Mis Depósitos</h1>
              <p className="text-sm text-emerald-100/50 mt-0.5">Declara tus transferencias bancarias y da seguimiento a su verificación</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/90 leading-relaxed">
            Declarar aquí no acredita tu saldo automáticamente: es solo un aviso. Un administrador coteja tu
            transferencia contra el estado de cuenta bancario real antes de reflejarla en tu historial.
          </p>
        </div>

        <Card className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-b from-emerald-950/40 via-card to-card">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
          <CardContent className="relative p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center ring-1 ring-emerald-500/20">
                <Send className="w-4 h-4 text-emerald-400" />
              </div>
              <h2 className="font-semibold">Declarar un depósito bancario</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Cuenta/CLABE a la que depositaste</Label>
                <Input
                  placeholder="18 dígitos"
                  value={clabeDestino}
                  onChange={(e) => setClabeDestino(e.target.value)}
                  className="font-mono text-xs"
                  data-testid="input-clabe-destino"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Monto</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  data-testid="input-monto-declarado"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Moneda</Label>
                <Select value={moneda} onValueChange={setMoneda}>
                  <SelectTrigger data-testid="select-moneda"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Referencia / clave de rastreo (opcional)</Label>
                <Input
                  placeholder="Folio SPEI, clave de rastreo, etc."
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  data-testid="input-referencia"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Nota para el administrador (opcional)</Label>
                <Textarea
                  placeholder="Cualquier detalle que ayude a identificar tu transferencia"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="text-xs min-h-[60px]"
                  data-testid="input-note"
                />
              </div>
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              disabled={!canDeclare}
              onClick={() => declareMutation.mutate()}
              data-testid="button-declare-bank-deposit"
            >
              {declareMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Declarar depósito
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Mis declaraciones
          </h3>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : declarations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center space-y-2">
                <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <History className="w-5 h-5 text-muted-foreground/60" />
                </div>
                <p className="text-sm text-muted-foreground">Aún no has declarado ningún depósito bancario.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {declarations.map((d) => {
                const meta = statusMeta(d.status);
                const Icon = meta.icon;
                return (
                  <Card key={d.id} data-testid={`card-bank-declaration-${d.id}`} className="transition-colors hover:border-emerald-500/25">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium tabular-nums">
                          {Number(d.montoDeclarado).toLocaleString("en-US", { minimumFractionDigits: 2 })} {d.moneda}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">CLABE {d.clabeDestino}</p>
                        {d.referencia && <p className="text-xs text-muted-foreground/70 truncate max-w-xs mt-0.5">Ref. {d.referencia}</p>}
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
