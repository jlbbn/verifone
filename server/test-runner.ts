/**
 * Banxico Plus LLC — Runner de la suite automatizada (node:test) para el
 * Centro de Pruebas (/admin/laboratorio).
 *
 * Diseño:
 *  - Lista blanca: solo se ejecutan archivos *.test.ts descubiertos dentro de
 *    server/ y shared/ — jamás rutas provistas por el cliente.
 *  - Reporter TAP forzado (--test-reporter=tap): el reporter por defecto de
 *    node:test varía según versión de Node y TTY (spec vs tap); forzarlo hace
 *    el parseo determinista en cualquier entorno.
 *  - Exclusión mutua atómica: el lock se toma de forma síncrona (sin ningún
 *    await entre la comprobación y la adquisición), así dos POST simultáneos
 *    no pueden lanzar dos runners.
 */

import { spawn } from "child_process";
import { promises as fsp } from "fs";
import path from "path";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TestRunRecord {
  ranAt:    string;
  files:    string[];
  ok:       boolean;
  exitCode: number | null;
  timedOut: boolean;
  summary:  { tests: number; pass: number; fail: number; durationMs: number | null };
  perTest:  { name: string; ok: boolean }[];
  rawTail:  string;
}

export type RunOutcome =
  | { kind: "busy" }
  | { kind: "unknown-file" }
  | { kind: "done"; record: TestRunRecord };

// ─── Descubrimiento (lista blanca) ────────────────────────────────────────────

const TEST_ROOTS = ["server", "shared"];
const MAX_DEPTH  = 4;

/** Descubre archivos *.test.ts dentro del repo. Es la única fuente de rutas ejecutables. */
export async function discoverTestFiles(): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) return;
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p, depth + 1);
      else if (e.name.endsWith(".test.ts")) found.push(p);
    }
  }
  for (const r of TEST_ROOTS) await walk(r, 0);
  return found.sort();
}

// ─── Parseo TAP (puro y testeable) ────────────────────────────────────────────

/**
 * Extrae resultados por prueba y el resumen del plan TAP.
 * Tolera indentación (subtests), directivas (# SKIP/# TODO) y, en corridas
 * multi-archivo, descarta las entradas agregadas cuyo nombre es el archivo.
 */
export function parseTapOutput(out: string, fallbackDurationMs: number | null = null): {
  perTest: { name: string; ok: boolean }[];
  summary: TestRunRecord["summary"];
} {
  const perTest: { name: string; ok: boolean }[] = [];
  for (const line of out.split("\n")) {
    const m = /^\s*(ok|not ok) \d+ - (.+?)\s*(?:# .*)?$/.exec(line);
    if (!m) continue;
    const name = m[2].trim();
    if (name.endsWith(".test.ts")) continue; // entrada agregada por archivo (TAP multi-file)
    perTest.push({ name, ok: m[1] === "ok" });
  }
  const grab = (label: string) => {
    const g = new RegExp(`^# ${label} (\\d+(?:\\.\\d+)?)$`, "m").exec(out);
    return g ? parseFloat(g[1]) : null;
  };
  return {
    perTest,
    summary: {
      tests:      grab("tests") ?? perTest.length,
      pass:       grab("pass")  ?? perTest.filter((t) => t.ok).length,
      fail:       grab("fail")  ?? perTest.filter((t) => !t.ok).length,
      durationMs: grab("duration_ms") ?? fallbackDurationMs,
    },
  };
}

// ─── Ejecución ────────────────────────────────────────────────────────────────

const RUN_TIMEOUT_MS  = 90_000;
const OUTPUT_CAP      = 400_000;
const OUTPUT_KEEP     = 200_000;

function runNodeTests(files: string[]): Promise<TestRunRecord> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let out = "";
    let timedOut = false;

    // Rutas ya validadas contra la lista blanca por el caller.
    // Se eliminan las variables NODE_TEST_* del ambiente: si este proceso corre
    // dentro de node:test (p.ej. el propio test-runner.test.ts), el runner
    // anidado las heredaría y cambiaría de protocolo/reporter, rompiendo el TAP.
    const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: "0" };
    for (const key of Object.keys(env)) {
      if (key.startsWith("NODE_TEST")) delete env[key];
    }
    const child = spawn("npx", ["tsx", "--test", "--test-reporter=tap", ...files], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const killTimer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, RUN_TIMEOUT_MS);
    const collect = (d: Buffer) => {
      out += d.toString();
      if (out.length > OUTPUT_CAP) out = out.slice(-OUTPUT_KEEP); // techo de memoria
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);

    child.on("close", (code) => {
      clearTimeout(killTimer);
      const { perTest, summary } = parseTapOutput(out, Date.now() - startedAt);
      resolve({
        ranAt: new Date().toISOString(),
        files,
        ok: code === 0 && !timedOut,
        exitCode: code,
        timedOut,
        summary,
        perTest,
        rawTail: out.slice(-4_000),
      });
    });

    child.on("error", (err) => {
      clearTimeout(killTimer);
      resolve({
        ranAt: new Date().toISOString(),
        files,
        ok: false,
        exitCode: null,
        timedOut,
        summary: { tests: 0, pass: 0, fail: 0, durationMs: Date.now() - startedAt },
        perTest: [],
        rawTail: `No se pudo lanzar el runner de pruebas: ${err.message}`,
      });
    });
  });
}

// ─── Estado + exclusión mutua ─────────────────────────────────────────────────

let inFlight = false;
let lastRun: TestRunRecord | null = null;

export function isTestRunInFlight(): boolean { return inFlight; }
export function getLastTestRun(): TestRunRecord | null { return lastRun; }

/**
 * Ejecuta la suite completa (o un solo archivo si `requestedFile` viene dado).
 * El lock se adquiere SIN ningún await entre comprobación y asignación, por lo
 * que dos llamadas concurrentes nunca lanzan dos runners; se libera en
 * `finally` para todos los caminos (archivo desconocido, error, éxito).
 */
export async function runTestsExclusive(requestedFile?: string): Promise<RunOutcome> {
  if (inFlight) return { kind: "busy" };
  inFlight = true; // adquisición atómica: sin await desde la comprobación

  try {
    const available = await discoverTestFiles();
    const files = requestedFile !== undefined
      ? [requestedFile].filter((f) => available.includes(f)) // solo lista blanca
      : available;
    if (files.length === 0) return { kind: "unknown-file" };

    const record = await runNodeTests(files);
    lastRun = record;
    return { kind: "done", record };
  } finally {
    inFlight = false;
  }
}
