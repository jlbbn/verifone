// Pure helpers for the database pool's TLS configuration. Kept free of side
// effects so the policy can be unit-tested (see server/db-ssl.test.ts).

export interface ExtractedSslMode {
  url: string;
  sslmode: string | null;
}

// Read the `sslmode` query-param from the URL, then strip it so
// pg-connection-string does not emit a security warning about ambiguous SSL
// mode aliases (pg@9 / pg-connection-string@3 compatibility). We set the SSL
// behaviour explicitly via the `ssl` Pool option instead.
export function extractSslMode(url: string): ExtractedSslMode {
  try {
    const u = new URL(url);
    const sslmode = u.searchParams.get("sslmode");
    u.searchParams.delete("sslmode");
    return { url: u.toString(), sslmode };
  } catch {
    // Fallback regex if URL() can't parse a postgres:// scheme on older runtimes
    const m = url.match(/[?&]sslmode=([^&]*)/);
    const stripped = url.replace(/([?&])sslmode=[^&]*(&|$)/, (_x, pre, post) =>
      post === "&" ? pre : ""
    );
    return { url: stripped, sslmode: m ? m[1] : null };
  }
}

// TLS policy:
// - Production ALWAYS uses full certificate validation:
//   `rejectUnauthorized: true` makes Node verify the chain against the system
//   CA store AND check the hostname, i.e. real verify-full semantics. Replit's
//   managed production Postgres (Neon-backed `*.neon.tech`, `sslmode=require`)
//   presents publicly trusted (Let's Encrypt) certificates, so no custom CA
//   bundle is needed. If the production URL ever requests `sslmode=disable`,
//   we refuse to start rather than silently connect without TLS.
// - Development: `sslmode=disable` (Replit dev uses a local sidecar proxy on a
//   private host; the platform tunnel secures the upstream leg) → no TLS on
//   this local hop. Any other mode in development also gets full validation.
// Never downgrade to `rejectUnauthorized: false` — that accepts any
// certificate and defeats TLS authentication entirely.
// Recognize TLS/certificate-verification failures from `pg`/Node so startup
// can fail loudly instead of continuing without a database. Covers the OpenSSL
// verify error codes Node surfaces on `err.code` plus common message text.
const TLS_ERROR_CODES = new Set([
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "CERT_SIGNATURE_FAILURE",
  "CERT_UNTRUSTED",
  "CERT_REJECTED",
  "CERT_REVOKED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "HOSTNAME_MISMATCH",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_TLS_HANDSHAKE_TIMEOUT",
  "EPROTO",
]);

export function isTlsCertificateError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; message?: unknown };
  if (typeof e.code === "string" && TLS_ERROR_CODES.has(e.code)) return true;
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  return (
    msg.includes("certificate") ||
    msg.includes("ssl") ||
    msg.includes("tls") ||
    msg.includes("self signed") ||
    msg.includes("self-signed")
  );
}

export function resolvePoolSsl(
  sslmode: string | null,
  isProduction: boolean,
): false | { rejectUnauthorized: true } {
  if (isProduction && sslmode === "disable") {
    throw new Error(
      "Refusing to start: DATABASE_URL requests sslmode=disable in production. " +
        "Production database connections must use TLS with certificate verification.",
    );
  }
  return !isProduction && sslmode === "disable"
    ? false
    : { rejectUnauthorized: true };
}
