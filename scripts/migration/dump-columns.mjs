// Vuelca "tabla.columna:tipo" de la BD indicada en DB_URL al archivo OUT.
import pg from "pg";
import fs from "node:fs";
const c = new pg.Client({ connectionString: process.env.DB_URL });
await c.connect();
const r = await c.query("SELECT table_name || '.' || column_name || ':' || data_type AS x FROM information_schema.columns WHERE table_schema='public' ORDER BY 1");
fs.writeFileSync(process.env.OUT, r.rows.map(w => w.x).join("\n") + "\n");
console.log("columnas:", r.rows.length, "->", process.env.OUT);
await c.end();
