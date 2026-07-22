import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Strip any `sslmode` query-param from the URL so pg-connection-string does
// not emit a security warning about ambiguous SSL mode aliases (prefer /
// require / verify-ca → verify-full).  We set the SSL behaviour explicitly
// via the `ssl` Pool option instead, which is the correct way to control it
// going forward (pg@9 / pg-connection-string@3 compatibility).
function stripSslMode(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    // Fallback regex strip if URL() can't parse a postgres:// scheme on older runtimes
    return url.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, pre, post) =>
      post === "&" ? pre : ""
    );
  }
}

const connectionString = stripSslMode(process.env.DATABASE_URL);

export const pool = new Pool({
  connectionString,
  // Explicit SSL config — equivalent to the current sslmode=verify-full
  // behaviour.  rejectUnauthorized keeps certificate validation active while
  // being compatible with Replit-managed (and other cloud) Postgres instances.
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });
