import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CircleSlash,
  Clock3,
  ExternalLink,
  Fingerprint,
  LockKeyhole,
  Network,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface SystemSettingsData {
  saldoSistemaUSD: number;
  maxDispersalUsdt: number;
  maxDailyDispersalUsdt: number;
  minTrxReserve: number;
}

interface NileEvidenceData {
  network?: string;
  checkedAt?: string;
  readOnly?: boolean;
  node?: {
    healthy?: boolean;
    latencyMs?: number;
    blockNumber?: number | null;
    headAgeMs?: number | null;
    activePeers?: number | null;
    genesisBlockId?: string | null;
    chainIdentityMatches?: boolean;
  } | null;
  nodeError?: string | null;
  latestConfirmed?: DispersionAuditRow | null;
  auditError?: string | null;
}

interface DispersionAuditRow {
  id: number;
  network?: string;
  toAddress: string;
  amountUsdt: string | number;
  txid?: string | null;
  status: string;
  note?: string | null;
  createdAt: string;
}

const scenarios = [
  { id: "candados", label: "Candados apagados", stop: "Controles", stopIndex: 3, occurred: "La intención fue explicada y llegó a la revisión de políticas, donde quedó bloqueada.", missing: "Los dos candados operativos no están activos.", avoided: "La solicitud no llega al firmador ni genera exposición.", advance: "Activar explícitamente los candados y mantener la revisión de límites." },
  { id: "aprobacion", label: "Aprobación faltante", stop: "Solicitud", stopIndex: 1, occurred: "La plataforma recibió el caso didáctico, pero no existe una aprobación trazable.", missing: "Falta la aprobación de un administrador autorizado.", avoided: "Se evita reservar fondos sin autorización trazable.", advance: "Registrar la aprobación requerida antes de crear una reserva." },
  { id: "direccion", label: "Dirección no permitida", stop: "Controles", stopIndex: 3, occurred: "La revisión detectó que el destino propuesto no cumple la política de wallets permitidas.", missing: "La wallet receptora no pertenece a la lista permitida.", avoided: "Se evita enviar USDT a un destino no verificado.", advance: "Verificar y aprobar la dirección receptora por el canal de cumplimiento." },
  { id: "limite", label: "Límite excedido", stop: "Controles", stopIndex: 3, occurred: "El monto didáctico rebasa uno de los umbrales configurados y la política lo rechaza.", missing: "El importe supera el límite vigente de operación o de día.", avoided: "Se evita una exposición superior al umbral configurado.", advance: "Reducir el importe o solicitar una revisión de límites vigente." },
  { id: "nodo", label: "Nodo no saludable", stop: "Nodo Nile", stopIndex: 5, occurred: "Los controles previos serían válidos, pero la evidencia de red no permite confiar en la cadena.", missing: "La identidad o salud del nodo no permite continuar con seguridad.", avoided: "Se evita firmar contra una red o cabeza de cadena incierta.", advance: "Restablecer la conexión Nile y confirmar identidad de cadena." },
  { id: "firmador", label: "Firmador no disponible", stop: "Firmador aislado", stopIndex: 4, occurred: "La solicitud didáctica pasó los controles locales, pero no existe un firmador aislado disponible.", missing: "El firmador remoto no está configurado o saludable.", avoided: "La clave nunca queda expuesta al proceso de la aplicación.", advance: "Aprovisionar el firmador aislado y validar su perfil operativo." },
  { id: "esperado", label: "Recorrido esperado", stop: null, stopIndex: null, occurred: "Se explica la secuencia completa y sus controles, sin reservar, firmar ni transmitir nada.", missing: "Ninguno dentro del escenario; sigue siendo una demostración de solo lectura.", avoided: "La demostración no mueve fondos ni convierte el recorrido en una autorización.", advance: "Para una operación real, cada control debe estar activo, aprobado y verificado fuera de esta sala." },
] as const;

const sequence = [
  { label: "Plataforma", icon: Network, detail: "Recibe la intención y abre un caso trazable; no mueve saldo." },
  { label: "Solicitud", icon: Fingerprint, detail: "Documenta monto, destino y aprobación administrativa." },
  { label: "Reserva", icon: WalletCards, detail: "Comprueba disponibilidad y exposición antes de cualquier firma." },
  { label: "Controles", icon: ShieldCheck, detail: "Evalúa candados, límites y lista permitida de direcciones." },
  { label: "Firmador aislado", icon: LockKeyhole, detail: "Mantiene la llave fuera de la aplicación y valida la intención." },
  { label: "Nodo Nile", icon: Network, detail: "Acredita salud, pares e identidad de la cadena de pruebas." },
  { label: "Red TRON", icon: ExternalLink, detail: "Solo recibiría una transacción ya aprobada y firmada." },
  { label: "Wallet receptora", icon: WalletCards, detail: "Destino final verificado; esta sala nunca lo acredita por sí sola." },
];

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

export function ExternalDispersionRoom() {
  const [selectedId, setSelectedId] = useState<(typeof scenarios)[number]["id"]>("esperado");
  const selected = scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[6];
  const settings = useQuery<SystemSettingsData>({ queryKey: ["/api/settings"] });
  const evidence = useQuery<NileEvidenceData>({ queryKey: ["/api/admin/tron/nile-evidence"] });
  const nileConnected = evidence.data?.network === "nile";
  const candidate = evidence.data?.latestConfirmed;
  const confirmedNile = candidate
    && candidate.network?.toLowerCase() === "nile"
    && candidate.status.toLowerCase() === "confirmed"
    && /^[0-9a-f]{64}$/i.test(candidate.txid ?? "")
    ? candidate
    : undefined;

  return (
    <section className="space-y-4" aria-labelledby="dispersion-room-title">
      <Card className="overflow-hidden border-[#9b332b]/25 shadow-sm">
        <div className="border-b border-[#9b332b]/15 bg-[#252c3a] px-5 py-5 text-[#f7f1e7] md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e7b6a7]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#d77a61]" /> Sala de revisión · solo lectura
              </div>
              <h2 id="dispersion-room-title" className="text-xl font-semibold tracking-tight md:text-2xl">Dispersión externa</h2>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#d7dce3]">
                Recorrido controlado para explicar una salida USDT-TRC20 a terceros sin simular fondos ni estados de éxito.
              </p>
            </div>
            <div className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-wider text-[#b9c1cc]">Exposición global configurada</p>
              <p className="mt-0.5 font-mono text-lg font-bold tabular-nums">
                {settings.isLoading ? "Consultando…" : settings.data ? money(settings.data.saldoSistemaUSD) : "No disponible"}
              </p>
              <p className="text-[10px] text-[#b9c1cc]">Referencia de riesgo · no es saldo enviable</p>
              {settings.isError && <p className="text-[10px] text-[#f1b3a5]">No se pudo consultar configuración</p>}
            </div>
          </div>
        </div>
        <CardContent className="space-y-5 px-5 py-5 md:px-6">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Escenario local</p>
              <span className="text-[10px] font-mono text-muted-foreground">sin llamadas de escritura</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => setSelectedId(scenario.id)}
                  aria-pressed={selectedId === scenario.id}
                  className={`min-h-11 rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b332b] focus-visible:ring-offset-2 ${
                    selectedId === scenario.id
                      ? "border-[#9b332b] bg-[#9b332b] text-white shadow-sm"
                      : "border-border bg-background text-foreground hover:border-[#9b332b]/50 hover:bg-[#9b332b]/5"
                  }`}
                >
                  {scenario.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-[#f5f0e8]/70 p-4 dark:bg-slate-900/70">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9b332b]">Lectura del escenario</p>
                <h3 className="mt-1 text-base font-semibold">{selected.label}</h3>
              </div>
              <Badge variant="outline" className="shrink-0 border-[#9b332b]/30 bg-[#fffaf3] text-[#7f2d27]">
                {selected.stop ? `Se detiene en: ${selected.stop}` : "Recorrido explicativo completo"}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Info label="Qué ocurrió" value={selected.occurred} icon={Fingerprint} tone="slate" />
              <Info label="Control ausente" value={selected.missing} icon={AlertTriangle} tone="amber" />
              <Info label="Exposición evitada" value={selected.avoided} icon={ShieldCheck} tone="green" />
              <Info label="Para avanzar" value={selected.advance} icon={ArrowRight} tone="slate" />
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cadena operativa</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {sequence.map((step, index) => {
                const Icon = step.icon;
                const state = selected.stopIndex == null
                  ? "explained"
                  : index < selected.stopIndex
                    ? "reviewed"
                    : index === selected.stopIndex
                      ? "stopped"
                      : "unreached";
                const stateLabel = {
                  explained: "Paso explicado",
                  reviewed: "Control anterior",
                  stopped: "Bloqueo aplicado",
                  unreached: "No alcanzado",
                }[state];
                const stateStyle = {
                  explained: "border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/80",
                  reviewed: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30",
                  stopped: "border-[#9b332b] bg-[#9b332b]/10 dark:border-[#d77a61] dark:bg-[#9b332b]/25",
                  unreached: "border-border bg-muted/25 dark:bg-slate-900/45",
                }[state];
                return (
                  <div key={step.label} className="relative">
                    <div className={`flex min-h-[132px] flex-col rounded-md border p-3 transition-colors ${stateStyle}`}>
                      <div className="flex items-center justify-between gap-2">
                        <Icon className={`h-4 w-4 ${state === "stopped" ? "text-[#9b332b]" : "text-muted-foreground"}`} />
                        <span className="font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <div>
                        <p className="mt-3 text-xs font-semibold leading-tight">{step.label}</p>
                        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{step.detail}</p>
                        <p className={`mt-2 text-[9px] font-semibold uppercase tracking-wide ${state === "stopped" ? "text-[#9b332b]" : "text-muted-foreground"}`}>{stateLabel}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
            <NileEvidence
              status={evidence.data}
              loading={evidence.isFetching}
              error={evidence.error}
              evidenceError={Boolean(evidence.data?.auditError)}
              evidenceLoading={evidence.isLoading}
              connected={nileConnected}
              refresh={() => { void evidence.refetch(); }}
              confirmed={confirmedNile}
            />
            <ExposureDetails settings={settings.data} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function Info({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof AlertTriangle; tone: "amber" | "green" | "slate" }) {
  const colors = {
    amber: "text-amber-700 bg-amber-50 border-amber-200 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-200",
    green: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200",
    slate: "text-slate-700 bg-slate-50 border-slate-200 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200",
  };
  return <div className={`rounded-md border p-3 ${colors[tone]}`}><Icon className="mb-2 h-4 w-4" /><p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p><p className="mt-1 text-xs leading-relaxed">{value}</p></div>;
}

function NileEvidence({
  status,
  loading,
  error,
  evidenceError,
  evidenceLoading,
  connected,
  refresh,
  confirmed,
}: {
  status?: NileEvidenceData;
  loading: boolean;
  error: Error | null;
  evidenceError: boolean;
  evidenceLoading: boolean;
  connected: boolean;
  refresh: () => void;
  confirmed?: DispersionAuditRow;
}) {
  return <div className="rounded-md border bg-card p-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-semibold">Evidencia Nile</p><p className="mt-0.5 text-[11px] text-muted-foreground">Datos observados, nunca inferidos</p></div>
      <Button type="button" variant="ghost" size="sm" onClick={refresh} disabled={loading} className="h-8 min-w-11 gap-1 text-xs"><RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Actualizar</Button>
    </div>
    {loading && !status ? <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" /> Consultando perfil Nile…</p> : error ? <p className="mt-3 flex items-center gap-2 text-xs text-amber-700"><XCircle className="h-4 w-4" /> No disponible. Intenta actualizar.</p> : !connected ? <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><CircleSlash className="h-4 w-4" /> Nile no está conectado; el perfil observado es {status?.network ?? "no disponible"}.</p> : <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Metric label="Nodo" value={status?.node?.healthy ? "Saludable" : "No saludable"} /><Metric label="Identidad" value={status?.node?.chainIdentityMatches ? "Nile verificada" : "No verificada"} /><Metric label="Bloque" value={status?.node?.blockNumber?.toLocaleString() ?? "No disponible"} /><Metric label="Pares activos" value={status?.node?.activePeers?.toLocaleString() ?? "No disponible"} /><Metric label="Antigüedad" value={status?.node?.headAgeMs != null ? `${Math.round(status.node.headAgeMs / 1000)} s` : "No disponible"} /><Metric label="Latencia" value={status?.node?.latencyMs != null ? `${status.node.latencyMs} ms` : "No disponible"} /></div>}
    <div className="mt-3 border-t pt-3">
      {evidenceLoading
        ? <p className="text-[11px] text-muted-foreground">Consultando auditoría Nile…</p>
        : evidenceError
          ? <p className="text-[11px] text-amber-700">No se pudo consultar la auditoría; la evidencia de transacción no está disponible.</p>
          : confirmed
            ? <p className="break-all font-mono text-[10px] text-emerald-700">Registro Nile confirmado: {confirmed.txid}</p>
            : <p className="text-[11px] text-muted-foreground">No hay evidencia de una transacción on-chain confirmada en Nile.</p>}
    </div>
    {connected && status?.checkedAt && <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="h-3 w-3" /> Consulta: {new Date(status.checkedAt).toLocaleString("es-MX")}</p>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded border bg-muted/30 p-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-0.5 font-mono text-[11px] font-semibold">{value}</p></div>; }

function ExposureDetails({ settings }: { settings?: SystemSettingsData }) {
  const rows = settings ? [["Máximo por operación", `${settings.maxDispersalUsdt.toLocaleString("es-MX")} USDT`], ["Máximo diario", `${settings.maxDailyDispersalUsdt.toLocaleString("es-MX")} USDT`], ["Reserva mínima", `${settings.minTrxReserve.toLocaleString("es-MX")} TRX`]] : [];
  return <div className="rounded-md border bg-card p-4"><p className="text-xs font-semibold">Parámetros de exposición</p><p className="mt-0.5 text-[11px] text-muted-foreground">Contexto de configuración, no una autorización</p>{settings ? <div className="mt-3 divide-y">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-2 text-xs"><span className="text-muted-foreground">{label}</span><span className="font-mono font-semibold">{value}</span></div>)}</div> : <p className="mt-3 text-xs text-muted-foreground">No disponible</p>}</div>;
}