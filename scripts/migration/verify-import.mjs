// Compara origen (archivos .json exportados) vs destino (BD DB_URL):
// conteo de filas por tabla y suma de cada columna numerica. Solo imprime agregados.
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
const DATA_DIR = process.env.DATA_DIR || "/tmp/rehearsal-data";
const c = new pg.Client({ connectionString: process.env.DB_URL });
await c.connect();
const NUM = ["numeric", "integer", "bigint", "smallint", "double precision", "real"];
const colsQ = await c.query(`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public'`);
const cols = {};
for (const r of colsQ.rows) (cols[r.table_name] ||= []).push(r);
const tablas = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json")).map(f => path.basename(f, ".json")).sort();
let fallos = 0;
for (const t of tablas) {
  const src = JSON.parse(fs.readFileSync(path.join(DATA_DIR, t + ".json"), "utf8"));
  const nDst = (await c.query(`SELECT count(*)::int n FROM "${t}"`)).rows[0].n;
  const okFilas = src.length === nDst;
  const malas = [];
  for (const m of (cols[t] || []).filter(m => NUM.includes(m.data_type))) {
    const sSrc = src.reduce((a, f) => a + (f[m.column_name] === null || f[m.column_name] === undefined ? 0 : Number(f[m.column_name])), 0);
    const sDst = Number((await c.query(`SELECT COALESCE(sum("${m.column_name}"),0)::text s FROM "${t}"`)).rows[0].s);
    if (Math.abs(sSrc - sDst) > 0.01) malas.push(`${m.column_name} (origen ${sSrc} vs destino ${sDst})`);
  }
  if (!okFilas || malas.length) {
    fallos++;
    console.log(`✗ ${t}: filas ${src.length}->${nDst}${malas.length ? " | sumas: " + malas.join("; ") : ""}`);
  } else {
    console.log(`✓ ${t}: ${nDst} filas, sumas numericas cuadran`);
  }
}
console.log(fallos === 0 ? "VERIFICACION COMPLETA: TODO CUADRA" : `VERIFICACION: ${fallos} tablas con diferencias`);
await c.end();
process.exit(fallos === 0 ? 0 : 1);
