// Importa los .json de DATA_DIR a la BD DB_URL: TRUNCATE + INSERT en orden de dependencias,
// casts por tipo, ajuste de secuencias. Nunca imprime datos de filas.
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
const DATA_DIR = process.env.DATA_DIR || "/tmp/rehearsal-data";
const c = new pg.Client({ connectionString: process.env.DB_URL });
await c.connect();
const tablas = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json")).map(f => path.basename(f, ".json"));
const colsQ = await c.query(`SELECT table_name, column_name, data_type, udt_name, is_identity, column_default
  FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`);
const cols = {};
for (const r of colsQ.rows) (cols[r.table_name] ||= []).push(r);
const fkQ = await c.query(`SELECT DISTINCT tc.table_name AS child, ccu.table_name AS parent
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'`);
const dentro = new Set(tablas), deps = {}, grado = {};
for (const t of tablas) { deps[t] = []; grado[t] = 0; }
for (const { child, parent } of fkQ.rows) {
  if (child === parent || !dentro.has(child) || !dentro.has(parent)) continue;
  deps[parent].push(child); grado[child]++;
}
const orden = tablas.filter(t => grado[t] === 0);
for (let i = 0; i < orden.length; i++) for (const h of deps[orden[i]]) if (--grado[h] === 0) orden.push(h);
if (orden.length !== tablas.length) { console.error("ciclo de FKs:", tablas.filter(t => !orden.includes(t)).join(",")); process.exit(1); }
const castDe = (m) => m.data_type === "ARRAY" ? m.udt_name.replace(/^_/, "") + "[]"
  : m.data_type === "USER-DEFINED" ? `"${m.udt_name}"` : m.data_type;
let totalFilas = 0;
await c.query("BEGIN");
try {
  await c.query("TRUNCATE " + tablas.map(t => `"${t}"`).join(", ") + " CASCADE");
  for (const t of orden) {
    let filas = JSON.parse(fs.readFileSync(path.join(DATA_DIR, t + ".json"), "utf8"));
    const meta = cols[t] || [];
    const nombres = meta.map(m => m.column_name);
    if (filas.length && typeof filas[0].id === "number") filas = filas.sort((a, b) => a.id - b.id);
    for (const fila of filas) {
      const extra = Object.keys(fila).filter(k => !nombres.includes(k));
      if (extra.length) throw new Error(`columnas sin destino en ${t}: ${extra.join(",")}`);
      const ks = Object.keys(fila);
      const vals = ks.map(k => { const v = fila[k]; return v !== null && typeof v === "object" ? JSON.stringify(v) : v; });
      const marcas = ks.map((k, i) => `$${i + 1}::${castDe(meta.find(m => m.column_name === k))}`);
      await c.query(`INSERT INTO "${t}" (${ks.map(k => `"${k}"`).join(",")}) VALUES (${marcas.join(",")})`, vals);
      totalFilas++;
    }
  }
  for (const t of tablas) for (const m of cols[t]) {
    if (m.is_identity === "YES" || (m.column_default || "").startsWith("nextval(")) {
      const seq = (await c.query("SELECT pg_get_serial_sequence($1,$2) s", [`"${t}"`, m.column_name])).rows[0].s;
      if (seq) await c.query(`SELECT setval($1, GREATEST(COALESCE((SELECT max("${m.column_name}") FROM "${t}"), 0), 1), (SELECT count(*) FROM "${t}") > 0)`, [seq]);
    }
  }
  await c.query("COMMIT");
} catch (e) { await c.query("ROLLBACK"); console.error("IMPORT FALLO:", e.message); process.exit(1); }
console.log("IMPORT OK — tablas:", tablas.length, "| filas insertadas:", totalFilas);
await c.end();
