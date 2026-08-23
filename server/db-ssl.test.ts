// Run with: npx tsx --test server/db-ssl.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractSslMode,
  isPlatformLocalHost,
  isTlsCertificateError,
  resolvePoolSsl,
} from "./db-ssl";

const NEON_HOST = "ep-x.us-east-2.aws.neon.tech";

test("production + sslmode=require → full certificate verification", () => {
  assert.deepEqual(resolvePoolSsl("require", true, NEON_HOST), {
    rejectUnauthorized: true,
  });
});

test("production + no sslmode → full certificate verification", () => {
  assert.deepEqual(resolvePoolSsl(null, true, NEON_HOST), {
    rejectUnauthorized: true,
  });
});

test("production + sslmode=disable + routable host → refuses to start", () => {
  assert.throws(
    () => resolvePoolSsl("disable", true, "db.example.com"),
    /Refusing to start.*sslmode=disable in production/,
  );
  assert.throws(
    () => resolvePoolSsl("disable", true, NEON_HOST),
    /Refusing to start/,
  );
  assert.throws(
    () => resolvePoolSsl("disable", true, "142.93.10.4"),
    /Refusing to start/,
  );
});

test("production + sslmode=disable + unknown host → refuses to start (fail closed)", () => {
  assert.throws(() => resolvePoolSsl("disable", true, ""), /Refusing to start/);
});

test("production + sslmode=disable + platform-local proxy hosts → TLS off on local hop", () => {
  assert.equal(resolvePoolSsl("disable", true, "127.0.0.1"), false);
  assert.equal(resolvePoolSsl("disable", true, "169.254.254.254"), false);
  assert.equal(resolvePoolSsl("disable", true, "localhost"), false);
  assert.equal(resolvePoolSsl("disable", true, "[::1]"), false);
  assert.equal(resolvePoolSsl("disable", true, "helium"), false);
});

test("development + sslmode=disable (Replit dev sidecar) → TLS off on local hop", () => {
  assert.equal(resolvePoolSsl("disable", false, "helium"), false);
  // Development keeps working even against a dotted host without TLS — the
  // hard requirement applies to production only.
  assert.equal(resolvePoolSsl("disable", false, "db.example.com"), false);
});

test("development + sslmode=require → full certificate verification", () => {
  assert.deepEqual(resolvePoolSsl("require", false, "helium"), {
    rejectUnauthorized: true,
  });
});

test("isPlatformLocalHost classifies hosts correctly", () => {
  // Local
  for (const h of [
    "localhost",
    "LOCALHOST",
    "127.0.0.1",
    "127.10.20.30",
    "169.254.254.254",
    "169.254.0.1",
    "[::1]",
    "::1",
    "helium",
    "db-sidecar",
    // Percent-encoded "localhost" — pg decodes it to a genuinely local host.
    "%6C%6F%63%61%6C%68%6F%73%74",
  ]) {
    assert.equal(isPlatformLocalHost(h), true, h);
  }
  // Routable / unknown
  for (const h of [
    "",
    "db.example.com",
    NEON_HOST,
    "8.8.8.8",
    "169.253.1.1",
    "10.0.0.5",
    "[2600:1f16::1]",
    "fe80::1",
    // Encoded dots must not read as a dotless internal name.
    "db%2eexample%2ecom",
    "db%2Eexample%2Ecom",
    // Double-encoded and malformed encodings fail closed.
    "db%252eexample%252ecom",
    "db%zzbad",
    // Unicode dot-equivalents canonicalize to ASCII dots in DNS — never local.
    "db。example。com", // U+3002 ideographic full stop
    "db．example．com", // U+FF0E fullwidth full stop
    "db｡example｡com", // U+FF61 halfwidth ideographic full stop
    "db%E3%80%82example%E3%80%82com", // percent-encoded U+3002
    "db%EF%BC%8Eexample%EF%BC%8Ecom", // percent-encoded U+FF0E
  ]) {
    assert.equal(isPlatformLocalHost(h), false, h);
  }
});

test("percent-encoded public host cannot masquerade as local (full pipeline)", () => {
  const r = extractSslMode(
    "postgres://u:p@db%2eexample%2ecom/db?sslmode=disable",
  );
  assert.equal(r.sslmode, "disable");
  assert.throws(
    () => resolvePoolSsl(r.sslmode, true, r.hostname),
    /Refusing to start/,
  );
});

test("Unicode-dot public hosts cannot masquerade as local (full pipeline)", () => {
  for (const url of [
    "postgres://u:p@db%E3%80%82example%E3%80%82com/db?sslmode=disable",
    "postgres://u:p@db。example。com/db?sslmode=disable",
    "postgres://u:p@db%EF%BC%8Eexample%EF%BC%8Ecom/db?sslmode=disable",
  ]) {
    const r = extractSslMode(url);
    assert.equal(r.sslmode, "disable", url);
    assert.throws(
      () => resolvePoolSsl(r.sslmode, true, r.hostname),
      /Refusing to start/,
      url,
    );
  }
});

test("extractSslMode strips the param and reports value + hostname", () => {
  const r = extractSslMode(
    `postgresql://user:pw@${NEON_HOST}/db?sslmode=require&x=1`,
  );
  assert.equal(r.sslmode, "require");
  assert.equal(r.hostname, NEON_HOST);
  assert.ok(!r.url.includes("sslmode"));
  assert.ok(r.url.includes("x=1"));
});

test("extractSslMode handles URLs without sslmode", () => {
  const r = extractSslMode("postgresql://user:pw@host/db");
  assert.equal(r.sslmode, null);
  assert.equal(r.hostname, "host");
});

test("extractSslMode reports link-local proxy hostname", () => {
  const r = extractSslMode(
    "postgresql://user:pw@169.254.254.254:5432/neondb?sslmode=disable",
  );
  assert.equal(r.sslmode, "disable");
  assert.equal(r.hostname, "169.254.254.254");
});

test("isTlsCertificateError detects OpenSSL verify error codes", () => {
  for (const code of [
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "CERT_HAS_EXPIRED",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "ERR_TLS_CERT_ALTNAME_INVALID",
  ]) {
    assert.equal(isTlsCertificateError({ code, message: "boom" }), true, code);
  }
});

test("isTlsCertificateError detects certificate/TLS message text", () => {
  assert.equal(
    isTlsCertificateError(new Error("unable to verify the first certificate")),
    true,
  );
  assert.equal(
    isTlsCertificateError(new Error("SSL SYSCALL error: EOF detected")),
    true,
  );
  assert.equal(
    isTlsCertificateError({
      message: "Hostname/IP does not match certificate's altnames",
    }),
    true,
  );
});

test("isTlsCertificateError ignores unrelated errors", () => {
  assert.equal(isTlsCertificateError(new Error("connect ECONNREFUSED")), false);
  assert.equal(
    isTlsCertificateError({ code: "42703", message: "column does not exist" }),
    false,
  );
  assert.equal(isTlsCertificateError(null), false);
  assert.equal(isTlsCertificateError("string error"), false);
});
