// Run with: npx tsx --test server/test-runner.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTapOutput, runTestsExclusive, discoverTestFiles } from "./test-runner";

// ─── Parseo TAP ───────────────────────────────────────────────────────────────

test("parseTapOutput: extrae pruebas, filtra agregados por archivo y lee el plan", () => {
  const tap = [
    "TAP version 13",
    "# Subtest: server/crypto/bitstamp-auth.test.ts",
    "ok 1 - server/crypto/bitstamp-auth.test.ts",
    "    ok 1 - firma correcta",
    "    not ok 2 - caso que falla # TODO pendiente",
    "ok 2 - prueba suelta",
    "1..2",
    "# tests 3",
    "# suites 0",
    "# pass 2",
    "# fail 1",
    "# duration_ms 123.45",
  ].join("\n");
  const { perTest, summary } = parseTapOutput(tap);
  assert.deepEqual(perTest, [
    { name: "firma correcta", ok: true },
    { name: "caso que falla", ok: false },
    { name: "prueba suelta", ok: true },
  ]);
  assert.equal(summary.tests, 3);
  assert.equal(summary.pass, 2);
  assert.equal(summary.fail, 1);
  assert.equal(summary.durationMs, 123.45);
});

test("parseTapOutput: sin plan TAP deriva conteos y usa la duración fallback", () => {
  const { perTest, summary } = parseTapOutput("ok 1 - a\nnot ok 2 - b\n", 500);
  assert.equal(perTest.length, 2);
  assert.deepEqual(
    [summary.tests, summary.pass, summary.fail, summary.durationMs],
    [2, 1, 1, 500],
  );
});

// ─── Lista blanca ─────────────────────────────────────────────────────────────

test("lista blanca: rutas fuera del repo o sin normalizar se rechazan y liberan el lock", async () => {
  const traversal = await runTestsExclusive("../etc/passwd");
  assert.equal(traversal.kind, "unknown-file");
  const unnormalized = await runTestsExclusive("./server/crypto/bitstamp-auth.test.ts");
  assert.equal(unnormalized.kind, "unknown-file");
  // Si el lock hubiera quedado tomado, esta tercera llamada devolvería "busy".
  const clean = await runTestsExclusive("archivo-que-no-existe.test.ts");
  assert.equal(clean.kind, "unknown-file");
});

// ─── Descubrimiento ───────────────────────────────────────────────────────────

test("descubrimiento: encuentra los archivos de prueba conocidos", async () => {
  const files = await discoverTestFiles();
  assert.ok(files.includes("server/crypto/bitstamp-auth.test.ts"), "falta bitstamp-auth");
  assert.ok(files.includes("server/db-ssl.test.ts"), "falta db-ssl");
  assert.ok(files.includes("server/test-runner.test.ts"), "falta test-runner");
});

// ─── Integración: registro devuelto por el endpoint ──────────────────────────

test("integración: corre la suite de firma Bitstamp y reporta 6/6 con detalle por prueba", async () => {
  const outcome = await runTestsExclusive("server/crypto/bitstamp-auth.test.ts");
  assert.equal(outcome.kind, "done");
  if (outcome.kind !== "done") return;
  const r = outcome.record;
  assert.equal(r.ok, true);
  assert.equal(r.exitCode, 0);
  assert.equal(r.timedOut, false);
  assert.deepEqual(r.files, ["server/crypto/bitstamp-auth.test.ts"]);
  assert.equal(r.summary.tests, 6);
  assert.equal(r.summary.pass, 6);
  assert.equal(r.summary.fail, 0);
  assert.equal(r.perTest.length, 6, `perTest inesperado: ${JSON.stringify(r.perTest)}`);
  assert.ok(r.perTest.every((t) => t.ok));
  assert.match(r.rawTail, /# pass 6/);
});

// ─── Exclusión mutua ──────────────────────────────────────────────────────────

test("exclusión mutua: dos corridas simultáneas → exactamente una 'busy'", async () => {
  const p1 = runTestsExclusive("server/crypto/bitstamp-auth.test.ts");
  const p2 = runTestsExclusive("server/crypto/bitstamp-auth.test.ts");
  const [a, b] = await Promise.all([p1, p2]);
  assert.deepEqual([a.kind, b.kind].sort(), ["busy", "done"]);
});
