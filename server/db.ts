import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { extractSslMode, resolvePoolSsl } from "./db-ssl";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const { url: connectionString, sslmode } = extractSslMode(
  process.env.DATABASE_URL,
);

// TLS policy lives in server/db-ssl.ts: production always gets full
// certificate verification ({ rejectUnauthorized: true } = verify-full
// semantics: chain validated against the system CA store + hostname check)
// and refuses to start if the URL requests sslmode=disable. Only the
// development sidecar hop (sslmode=disable) runs without TLS.
export const pool = new Pool({
  connectionString,
  ssl: resolvePoolSsl(sslmode, process.env.NODE_ENV === "production"),
});

export const db = drizzle(pool, { schema });
