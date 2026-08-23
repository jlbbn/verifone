// Pure helpers for the database pool's TLS configuration. Kept free of side
// effects so the policy can be unit-tested (see server/db-ssl.test.ts).

import { domainToASCII } from "node:url";

export interface ExtractedSslMode {
  url: string;
  sslmode: string | null;
  hostname: string;
}

// Read the `sslmode` query-param from the URL, then strip it so
// pg-connection-string does not emit a security warning about ambiguous SSL
// mode aliases (pg@9 / pg-connection-string@3 compatibility). We set the SSL
// behaviour explicitly via the `ssl` Pool option instead. The hostname is
// reported alongside so the TLS policy can distinguish platform-local proxy
// hops from routable database hosts.
export function extractSslMode(url: string): ExtractedSslMode {
  try {
    const u = new URL(url);
    const sslmode = u.searchParams.get("sslmode");
    u.searchParams.delete("sslmode");
    return { url: u.toString(), sslmode, hostname: u.hostname };
  } catch {
    // Fallback regex if URL() can't parse a postgres:// scheme on older runtimes
    const m = url.match(/[?&]sslmode=([^&]*)/);
    const stripped = url.replace(/([?&])sslmode=[^&]*(&|$)/, (_x, pre, post) =>
      post === "&" ? pre : ""
    );
    const hostMatch = url.match(/@(\[[^\]]+\]|[^/:?#@]+)(?::\d+)?(?:[/?#]|$)/);
    return {
      url: stripped,
      sslmode: m ? m[1] : null,
      hostname: hostMatch ? hostMatch[1] : "",
    };
  }
}

// True only for hosts that cannot leave the platform's private network:
// loopback, IPv4 link-local (169.254.0.0/16 — used by Replit's managed
// database proxy), and dotless single-label names (resolvable only through
// container-local DNS, e.g. the dev sidecar). Public FQDNs and routable IPs
// are never "local".
export function isPlatformLocalHost(hostname: string): boolean {
  let h = hostname;
  // pg-connection-string percent-decodes the host before connecting, so this
  // policy must classify the DECODED host — otherwise "db%2eexample%2ecom"
  // (no literal dot) would read as a dotless internal name while pg actually
  // connects to db.example.com in plaintext. Decode once, exactly like pg,
  // and fail closed on anything that is still encoded or malformed.
  if (h.includes("%")) {
    try {
      h = decodeURIComponent(h);
    } catch {
      return false;
    }
    if (h.includes("%")) return false; // double-encoded or malformed
  }
  h = h.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "") return false;
  // IPv6 literals never go through IDNA; only loopback is platform-local.
  if (h.includes(":")) return h === "::1";
  // DNS canonicalizes Unicode dot-equivalents (U+3002 ideographic full stop,
  // U+FF0E fullwidth full stop, U+FF61 halfwidth ideographic full stop) to
  // ASCII dots, so "db。example。com" actually resolves as db.example.com.
  // Classify the IDNA/UTS46 ASCII form — the name DNS will really look up —
  // and fail closed when conversion fails.
  const ascii = domainToASCII(h);
  if (ascii === "") return false;
  if (ascii === "localhost") return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ascii)) return true;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(ascii)) return true;
  if (!ascii.includes(".")) return true;
  return false;
}

// TLS policy:
// - Production with a routable host ALWAYS uses full certificate validation:
//   `rejectUnauthorized: true` makes Node verify the chain against the system
//   CA store AND check the hostname, i.e. real verify-full semantics. Publicly
//   reachable managed Postgres (e.g. Neon `*.neon.tech`) presents publicly
//   trusted certificates, so no custom CA bundle is needed. If a production
//   URL requests `sslmode=disable` for a routable host, we refuse to start
//   rather than silently send plaintext across a network.
// - Production with a platform-local host (loopback / link-local / dotless
//   internal name): Replit's managed database is reached through a local
//   proxy (observed at 169.254.254.254) that terminates TLS upstream; the
//   plaintext hop never leaves the container's private network, so
//   `sslmode=disable` is honored there — same rationale as the dev sidecar.
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
  hostname: string,
): false | { rejectUnauthorized: true } {
  if (sslmode === "disable") {
    if (!isProduction || isPlatformLocalHost(hostname)) {
      // Plaintext is confined to a platform-local proxy hop (dev sidecar or
      // the managed production database proxy); TLS is handled upstream.
      return false;
    }
    throw new Error(
      "Refusing to start: DATABASE_URL requests sslmode=disable in production " +
        `for routable host "${hostname || "(unknown)"}". Plaintext database ` +
        "connections are only permitted to platform-local proxy hosts " +
        "(loopback, link-local, or dotless internal names); remote databases " +
        "must use TLS with certificate verification.",
    );
  }
  return { rejectUnauthorized: true };
}
