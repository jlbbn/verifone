import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { SecurityToken, Transaction, BankingProtocol } from "@shared/schema";
import {
  ShieldCheck, Lock, Cpu, Clock, DollarSign, CheckCircle2,
  AlertTriangle, TimerOff, ListChecks, Activity,
} from "lucide-react";

function fmtMoney(amount: string | number, currency: string) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const formatted = (isNaN(n) ? 0 : n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${formatted} ${currency || "USD"}`;
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

const PROTOCOL_CATEGORY_LABEL: Record<string, string> = {
  transfer: "Transferencia",
  payment: "Pago",
  deposit: "Depósito",
  withdrawal: "Retiro",
};

export default function CompliancePage() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: tokens = [], isLoading: tokensLoading } = useQuery<SecurityToken[]>({
    queryKey: ["/api/security-tokens"],
    refetchInterval: 15000,
  });
  const { data: transactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: protocols = [] } = useQuery<BankingProtocol[]>({ queryKey: ["/api/protocols"] });

  const txById = useMemo(() => {
    const map = new Map<string, Transaction>();
    transactions.forEach((tx) => map.set(tx.id, tx));
    return map;
  }, [transactions]);

  const enrichedTokens = useMemo(() => {
    return tokens
      .map((token) => {
        const tx = txById.get(token.transactionId);
        const issuedAt = new Date(token.issuedAt).getTime();
        const expiresAt = new Date(token.expiresAt).getTime();
        const totalWindow = Math.max(expiresAt - issuedAt, 1);
        const remainingMs = expiresAt - now;
        const remainingPct = Math.max(0, Math.min(100, (remainingMs / totalWindow) * 100));
        const amortizedPct = 100 - remainingPct;
        const isActive = remainingMs > 0;
        return { token, tx, remainingMs, remainingPct, amortizedPct, isActive };
      })
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.remainingMs - b.remainingMs;
      });
  }, [tokens, txById, now]);

  const activeTokens = enrichedTokens.filter((e) => e.isActive);
  const emvCompliant = tokens.filter((t) => t.emvCompliant).length;
  const pciCompliant = tokens.filter((t) => t.pciCompliant).length;
  const amortizingByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    activeTokens.forEach((e) => {
      if (!e.tx) return;
      const amount = parseFloat(e.tx.amount);
      if (isNaN(amount)) return;
      const currency = e.tx.currency || "USD";
      totals.set(currency, (totals.get(currency) ?? 0) + amount);
    });
    return Array.from(totals.entries());
  }, [activeTokens]);

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="page-compliance">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#c8322b]" />
          <h1 className="text-xl md:text-2xl font-bold text-foreground" data-testid="text-page-title">
            Cumplimiento Bancario
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-subtitle">
          Monitoreo en tiempo real de la amortización de tokens de seguridad y cumplimiento EMV / PCI DSS de las transacciones activas.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Tokens Activos
            </CardDescription>
            <CardTitle className="text-2xl" data-testid="text-kpi-active-tokens">
              {activeTokens.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Monto en Amortización
            </CardDescription>
            {amortizingByCurrency.length === 0 ? (
              <CardTitle className="text-2xl" data-testid="text-kpi-amortizing-amount">
                {fmtMoney(0, "USD")}
              </CardTitle>
            ) : amortizingByCurrency.length === 1 ? (
              <CardTitle className="text-2xl" data-testid="text-kpi-amortizing-amount">
                {fmtMoney(amortizingByCurrency[0][1], amortizingByCurrency[0][0])}
              </CardTitle>
            ) : (
              <div className="space-y-0.5" data-testid="text-kpi-amortizing-amount">
                {amortizingByCurrency.map(([currency, total]) => (
                  <p key={currency} className="text-base font-bold text-foreground leading-tight">
                    {fmtMoney(total, currency)}
                  </p>
                ))}
              </div>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Cumplimiento EMV
            </CardDescription>
            <CardTitle className="text-2xl" data-testid="text-kpi-emv">
              {tokens.length > 0 ? Math.round((emvCompliant / tokens.length) * 100) : 100}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Cumplimiento PCI DSS
            </CardDescription>
            <CardTitle className="text-2xl" data-testid="text-kpi-pci">
              {tokens.length > 0 ? Math.round((pciCompliant / tokens.length) * 100) : 100}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-[#c8322b]" />
            Amortización de Tokens en Tiempo Real
          </CardTitle>
          <CardDescription>
            Cada token de seguridad amortiza su validez de forma lineal (AES-256, expiración a 24 horas) desde su emisión hasta su expiración, junto con el monto de la transacción que respalda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokensLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center" data-testid="text-tokens-loading">
              Cargando tokens de seguridad...
            </div>
          ) : enrichedTokens.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center" data-testid="text-tokens-empty">
              Aún no hay tokens de seguridad generados. Se crean automáticamente al procesar transacciones y pagos POS.
            </div>
          ) : (
            <div className="space-y-3">
              {enrichedTokens.map(({ token, tx, remainingMs, remainingPct, amortizedPct, isActive }) => (
                <div
                  key={token.id}
                  className="rounded-md border border-border p-3 space-y-2"
                  data-testid={`row-token-${token.tokenId}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-mono text-xs text-foreground truncate" data-testid={`text-token-id-${token.tokenId}`}>
                        {token.tokenId}
                      </span>
                      {token.emvCompliant && (
                        <Badge variant="outline" className="text-[10px] gap-1 no-default-active-elevate">
                          <ShieldCheck className="w-3 h-3" /> EMV
                        </Badge>
                      )}
                      {token.pciCompliant && (
                        <Badge variant="outline" className="text-[10px] gap-1 no-default-active-elevate">
                          <Lock className="w-3 h-3" /> PCI DSS
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] gap-1 no-default-active-elevate">
                        <Cpu className="w-3 h-3" /> {token.algorithm}
                      </Badge>
                    </div>
                    {isActive ? (
                      <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 no-default-active-elevate" data-testid={`badge-status-${token.tokenId}`}>
                        Amortizando
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground no-default-active-elevate" data-testid={`badge-status-${token.tokenId}`}>
                        <TimerOff className="w-3 h-3" /> Expirado
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-muted-foreground">
                    <span data-testid={`text-token-tx-${token.tokenId}`}>
                      Transacción: <span className="font-mono text-foreground">{tx?.transactionId ?? token.transactionId}</span>
                      {tx?.protocol ? ` · Protocolo ${tx.protocol}` : ""}
                    </span>
                    <span className="font-semibold text-foreground" data-testid={`text-token-amount-${token.tokenId}`}>
                      {tx ? fmtMoney(tx.amount, tx.currency) : "—"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <Progress value={remainingPct} className="h-2" data-testid={`progress-token-${token.tokenId}`} />
                    <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-muted-foreground">
                      <span data-testid={`text-token-amortized-${token.tokenId}`}>
                        Amortizado {amortizedPct.toFixed(1)}%
                      </span>
                      <span className="font-mono" data-testid={`text-token-countdown-${token.tokenId}`}>
                        {isActive ? `Expira en ${fmtCountdown(remainingMs)}` : "Validez agotada"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="w-4 h-4 text-[#c8322b]" />
            Checklist de Cumplimiento por Protocolo
          </CardTitle>
          <CardDescription>
            Protocolos bancarios registrados y su requerimiento de validación de seguridad (EMV / PCI DSS / AES-256).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {protocols.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center" data-testid="text-protocols-empty">
              No hay protocolos registrados.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {protocols.map((protocol) => (
                <div
                  key={protocol.code}
                  className="rounded-md border border-border p-3 flex items-start justify-between gap-3"
                  data-testid={`row-protocol-${protocol.code}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-foreground">{protocol.code}</span>
                      <span className="text-sm text-foreground truncate">{protocol.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {PROTOCOL_CATEGORY_LABEL[protocol.category] ?? protocol.category}
                    </p>
                  </div>
                  {protocol.requiresSecurity ? (
                    <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 gap-1 no-default-active-elevate flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> Requiere token
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground no-default-active-elevate flex-shrink-0">
                      <AlertTriangle className="w-3 h-3" /> Sin token
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
