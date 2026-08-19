/**
 * Bitstamp — Panel de pruebas (solo lectura, sin llaves privadas)
 *
 * Muestra conectividad de los servidores de producción y sandbox, el feed
 * WebSocket público y la comparación de precios contra OKX. Vive en el
 * Centro de Pruebas (/admin/laboratorio).
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Network, Zap, Lock, RefreshCw, Loader2 } from "lucide-react";

export function BitstampTestPanel() {
  interface BsProbe { ok: boolean; latencyMs: number; btcUsd?: number; error?: string }
  interface BsStatus {
    environment: "production" | "sandbox";
    baseUrl: string;
    credentialsConfigured: boolean;
    tradingEnabled: boolean;
    executorWouldUse: string;
    production: BsProbe;
    sandbox: BsProbe;
    ws: { source: string; status: string; lastMessageAt: number | null; trades: { pair: string; price: number; amount: number; side: string; atMs: number }[] };
  }
  interface BsPriceRow {
    asset: string;
    pair: string;
    bitstamp: { price: number; bid: number; ask: number; change24h: number } | null;
    okx: { price: number } | null;
    deltaPct: number | null;
  }

  const { data: bsStatus, isFetching: loadingBsStatus, refetch: refetchBsStatus } = useQuery<BsStatus>({
    queryKey: ["/api/admin/bitstamp/status"],
    refetchInterval: 30_000,
  });
  const { data: bsPrices, isFetching: loadingBsPrices, refetch: refetchBsPrices } = useQuery<{ environment: string; rows: BsPriceRow[] }>({
    queryKey: ["/api/admin/bitstamp/prices"],
    refetchInterval: 10_000,
  });

  const fmtUsd = (n: number | null | undefined) =>
    n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: n < 1 ? 5 : 2, maximumFractionDigits: n < 1 ? 5 : 2 });

  const wsBtc = bsStatus?.ws?.trades?.find(t => t.pair === "btcusd");
  const isSandbox = bsStatus?.environment === "sandbox";

  const probeChip = (label: string, p?: BsProbe) => (
    <div className="bg-muted/40 rounded-lg p-3 space-y-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      {!bsStatus ? (
        <div className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /><span className="text-xs">Verificando…</span></div>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${p?.ok ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-xs font-medium">{p?.ok ? "En línea" : "Sin respuesta"}</span>
            {p?.ok && <span className="text-[10px] text-muted-foreground">· {p.latencyMs} ms</span>}
          </div>
          <p className="text-xs text-muted-foreground">BTC/USD: <span className="font-mono">{p?.btcUsd ? `$${fmtUsd(p.btcUsd)}` : "—"}</span></p>
        </>
      )}
    </div>
  );

  return (
    <Card>
      <CardContent className="px-5 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-[#c8322b]" />
            <span className="text-sm font-semibold">Bitstamp — Panel de pruebas</span>
            {bsStatus && (
              isSandbox ? (
                <Badge variant="outline" className="text-[10px] border-amber-400 bg-amber-50 text-amber-700">SANDBOX · dinero ficticio</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] border-emerald-400 bg-emerald-50 text-emerald-700">PRODUCCIÓN · API pública</Badge>
              )
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => { refetchBsStatus(); refetchBsPrices(); }}
            disabled={loadingBsStatus || loadingBsPrices} className="h-7 gap-1 text-xs">
            <RefreshCw className={`w-3 h-3 ${(loadingBsStatus || loadingBsPrices) ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {/* Conectividad: producción · sandbox · websocket */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {probeChip("Servidor producción", bsStatus?.production)}
          {probeChip("Servidor sandbox (pruebas)", bsStatus?.sandbox)}
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">WebSocket en vivo</p>
            {!bsStatus ? (
              <div className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /><span className="text-xs">Verificando…</span></div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <Zap className={`w-3 h-3 ${bsStatus.ws.status === "open" ? "text-green-500" : "text-yellow-500"}`} />
                  <span className="text-xs font-medium capitalize">{bsStatus.ws.status === "open" ? "Conectado" : bsStatus.ws.status}</span>
                  <span className="text-[10px] text-muted-foreground">· feed producción</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Última operación BTC: <span className="font-mono">{wsBtc ? `$${fmtUsd(wsBtc.price)}` : "esperando…"}</span>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Estado de seguridad: solo lectura */}
        <div className="flex items-start gap-2.5 bg-blue-50/60 border border-blue-200 rounded-lg px-3 py-2.5">
          <Lock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed">
            <span className="font-semibold">Solo lectura.</span>{" "}
            Credenciales: {bsStatus?.credentialsConfigured ? "configuradas" : "no configuradas"} ·
            Interruptor de swaps Bitstamp: <span className="font-semibold">{bsStatus?.tradingEnabled ? "ENCENDIDO" : "APAGADO"}</span> ·
            Ruta actual del ejecutor: <span className="font-semibold uppercase">{bsStatus?.executorWouldUse ?? "…"}</span>.
            Bitstamp no participa en operaciones reales del sistema.
          </p>
        </div>

        {/* Comparación de precios Bitstamp vs OKX */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Precios en vivo — Bitstamp ({isSandbox ? "sandbox" : "producción"}, USD) vs OKX (USDT)
            </p>
            {loadingBsPrices && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Activo</span><span className="text-right">Bitstamp</span><span className="text-right">OKX</span><span className="text-right">Δ %</span>
            </div>
            {!bsPrices ? (
              <div className="px-3 py-4 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Cargando precios…
              </div>
            ) : bsPrices.rows.map((r) => (
              <div key={r.asset} className="grid grid-cols-4 px-3 py-1.5 text-xs border-t items-center">
                <span className="font-semibold uppercase">{r.asset}</span>
                <span className="text-right font-mono">{r.bitstamp ? `$${fmtUsd(r.bitstamp.price)}` : "—"}</span>
                <span className="text-right font-mono">{r.okx ? `$${fmtUsd(r.okx.price)}` : "—"}</span>
                <span className={`text-right font-mono ${r.deltaPct == null ? "text-muted-foreground" : Math.abs(r.deltaPct) < 0.5 ? "text-green-600" : "text-amber-600"}`}>
                  {r.deltaPct == null ? "—" : `${r.deltaPct > 0 ? "+" : ""}${r.deltaPct.toFixed(2)}%`}
                </span>
              </div>
            ))}
          </div>
          {isSandbox && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              El sandbox es un mercado ficticio: los precios pueden diferir de producción y algunos pares tienen poca actividad.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
