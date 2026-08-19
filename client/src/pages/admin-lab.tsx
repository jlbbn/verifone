/**
 * Centro de Pruebas (/admin/laboratorio) — extensión del proyecto para
 * revisar todas las verificaciones en un solo lugar, separadas de las
 * páginas operativas de producción:
 *   · Bitstamp: conectividad producción/sandbox, WS, precios vs OKX
 *   · Suite automatizada node:test (firma v2, SSL de la BD, …)
 * Nada de lo que se ejecuta aquí toca operaciones reales.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BitstampTestPanel } from "@/components/bitstamp-test-panel";
import {
  FlaskConical,
  ListChecks,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Terminal,
  Hourglass,
} from "lucide-react";

// ─── Suite automatizada ───────────────────────────────────────────────────────

interface TestRunRecord {
  ranAt: string;
  files: string[];
  ok: boolean;
  exitCode: number | null;
  timedOut: boolean;
  summary: { tests: number; pass: number; fail: number; durationMs: number | null };
  perTest: { name: string; ok: boolean }[];
  rawTail: string;
}

interface TestsIndex {
  files: string[];
  running: boolean;
  lastRun: TestRunRecord | null;
}

function AutomatedTestsPanel() {
  const { data: index, isLoading: loadingIndex } = useQuery<TestsIndex>({
    queryKey: ["/api/admin/tests"],
    // Refresco periódico: si otro admin lanza una corrida (o el cliente corta
    // por timeout), "running" y "lastRun" convergen solos sin recargar.
    refetchInterval: 10_000,
  });
  const [view, setView] = useState<TestRunRecord | null>(null);

  const run = useMutation<TestRunRecord, Error, string | undefined>({
    mutationFn: async (file) => {
      const res = await apiRequest("POST", "/api/admin/tests/run", file ? { file } : {});
      return (await res.json()) as TestRunRecord;
    },
    onSuccess: (rec) => {
      setView(rec);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tests"] });
    },
    onError: () => {
      // Aunque el cliente corte (p.ej. timeout), la corrida termina en el
      // servidor: refrescar el índice recupera el último resultado.
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tests"] });
    },
  });

  const busy = run.isPending || Boolean(index?.running);
  const result = view ?? index?.lastRun ?? null;

  return (
    <Card>
      <CardContent className="px-5 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-[#c8322b]" />
            <span className="text-sm font-semibold">Suite automatizada</span>
            {index && (
              <Badge variant="outline" className="text-[10px]">
                {index.files.length} archivo{index.files.length === 1 ? "" : "s"} de prueba
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => run.mutate(undefined)}
            disabled={busy || loadingIndex}
            className="h-7 gap-1.5 text-xs bg-[#c8322b] hover:bg-[#a52a24] text-white"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {busy ? "Ejecutando…" : "Ejecutar todas"}
          </Button>
        </div>

        {/* Archivos de prueba */}
        <div className="rounded-lg border divide-y">
          {loadingIndex ? (
            <div className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Buscando archivos de prueba…
            </div>
          ) : (index?.files ?? []).map((f) => (
            <div key={f} className="flex items-center justify-between px-3 py-2 gap-2">
              <span className="font-mono text-xs truncate">{f}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => run.mutate(f)}
                disabled={busy}
                className="h-6 gap-1 text-[11px] flex-shrink-0"
              >
                <Play className="w-2.5 h-2.5" /> Ejecutar
              </Button>
            </div>
          ))}
          {index && index.files.length === 0 && (
            <div className="px-3 py-3 text-xs text-muted-foreground">No se encontraron archivos *.test.ts</div>
          )}
        </div>

        {run.isError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">No se pudo ejecutar la suite: {run.error.message}</p>
          </div>
        )}

        {/* Resultado más reciente */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Resultado más reciente
              </p>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {new Date(result.ranAt).toLocaleString("es-MX")}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {result.ok ? (
                <Badge className="bg-green-100 text-green-700 border border-green-300 hover:bg-green-100 gap-1">
                  <CheckCircle className="w-3 h-3" /> TODO EN ORDEN
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700 border border-red-300 hover:bg-red-100 gap-1">
                  <XCircle className="w-3 h-3" /> {result.timedOut ? "TIEMPO AGOTADO" : "FALLARON PRUEBAS"}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {result.summary.pass}/{result.summary.tests} pasaron
                {result.summary.fail > 0 && <span className="text-red-600 font-semibold"> · {result.summary.fail} fallaron</span>}
                {result.summary.durationMs != null && ` · ${(result.summary.durationMs / 1000).toFixed(1)} s`}
              </span>
            </div>

            <div className="rounded-lg border overflow-hidden">
              {result.perTest.map((t, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${i > 0 ? "border-t" : ""}`}>
                  {t.ok
                    ? <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                    : <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                  <span className={t.ok ? "" : "text-red-700 font-medium"}>{t.name}</span>
                </div>
              ))}
              {result.perTest.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Sin detalle por prueba — revisa la salida completa.</div>
              )}
            </div>

            <details className="group">
              <summary className="text-[11px] text-muted-foreground cursor-pointer flex items-center gap-1.5 select-none">
                <Terminal className="w-3 h-3" /> Ver salida completa del runner
              </summary>
              <pre className="mt-1.5 text-[10px] bg-muted rounded-lg p-2.5 max-h-64 overflow-auto whitespace-pre-wrap">{result.rawTail}</pre>
            </details>
          </div>
        )}

        {!result && !loadingIndex && (
          <p className="text-xs text-muted-foreground">
            Aún no se ha ejecutado la suite en esta sesión del servidor. Pulsa «Ejecutar todas» para correr
            las verificaciones (firma Bitstamp v2, seguridad SSL de la base de datos, …).
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Próximas etapas ──────────────────────────────────────────────────────────

function RoadmapCard() {
  const steps = [
    {
      title: "Movimientos con dinero ficticio (sandbox Bitstamp)",
      detail: "Cuando existan credenciales del sandbox oficial, aquí se probarán compras/ventas de prueba sin tocar fondos reales.",
    },
    {
      title: "Prueba end-to-end en el droplet sandbox",
      detail: "Flujo completo en el servidor de pruebas aislado, con informe de tiempos de liquidación.",
    },
  ];
  return (
    <Card className="border-dashed">
      <CardContent className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Hourglass className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-muted-foreground">Próximas etapas del laboratorio</span>
        </div>
        <div className="space-y-2.5">
          {steps.map((s) => (
            <div key={s.title} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium">{s.title}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Estas etapas ya están programadas como tareas del proyecto y aparecerán en esta página al completarse.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminLabPage() {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-20 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-[#c8322b]" />
          <h1 className="text-xl font-bold">Centro de Pruebas</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Entorno de revisión de todas las pruebas del proyecto — conectividad de brokers, firmas de API y
          suite automatizada. Nada de lo que se ejecuta aquí toca operaciones reales ni fondos.
        </p>
      </div>

      {/* ── Bitstamp: conectividad, WS y precios ── */}
      <BitstampTestPanel />

      {/* ── Suite automatizada node:test ── */}
      <AutomatedTestsPanel />

      {/* ── Lo que sigue ── */}
      <RoadmapCard />
    </div>
  );
}
