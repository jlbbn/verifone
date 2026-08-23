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

const { url: connectionString, sslmode, hostname } = extractSslMode(
  process.env.DATABASE_URL,
);

// TLS policy lives in server/db-ssl.ts: routable hosts always get full
// certificate verification ({ rejectUnauthorized: true } = verify-full
// semantics: chain validated against the system CA store + hostname check).
// `sslmode=disable` is honored only for platform-local proxy hops (the dev
// sidecar and Replit's managed production database proxy); a production URL
// requesting plaintext to a routable host refuses to start.
export const pool = new Pool({
  connectionString,
  ssl: resolvePoolSsl(sslmode, process.env.NODE_ENV === "production", hostname),
});

export const db = drizzle(pool, { schema });
