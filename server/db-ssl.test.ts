// Run with: npx tsx --test server/db-ssl.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractSslMode,
  isTlsCertificateError,
  resolvePoolSsl,
} from "./db-ssl";

test("production + sslmode=require → full certificate verification", () => {
  assert.deepEqual(resolvePoolSsl("require", true), {
    rejectUnauthorized: true,
  });
});

test("production + no sslmode → full certificate verification", () => {
  assert.deepEqual(resolvePoolSsl(null, true), { rejectUnauthorized: true });
});

test("production + sslmode=disable → refuses to start", () => {
  assert.throws(
    () => resolvePoolSsl("disable", true),
    /Refusing to start.*sslmode=disable in production/,
  );
});

test("development + sslmode=disable (Replit dev sidecar) → TLS off on local hop", () => {
  assert.equal(resolvePoolSsl("disable", false), false);
});

test("development + sslmode=require → full certificate verification", () => {
  assert.deepEqual(resolvePoolSsl("require", false), {
    rejectUnauthorized: true,
  });
});

test("extractSslMode strips the param and reports its value", () => {
  const r = extractSslMode(
    "postgresql://user:pw@ep-x.us-east-2.aws.neon.tech/db?sslmode=require&x=1",
  );
  assert.equal(r.sslmode, "require");
  assert.ok(!r.url.includes("sslmode"));
  assert.ok(r.url.includes("x=1"));
});

test("extractSslMode handles URLs without sslmode", () => {
  const r = extractSslMode("postgresql://user:pw@host/db");
  assert.equal(r.sslmode, null);
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
