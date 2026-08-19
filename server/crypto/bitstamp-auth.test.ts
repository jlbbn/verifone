// Run with: npx tsx --test server/crypto/bitstamp-auth.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import {
  buildAuthMessage,
  signAuthMessage,
  buildAuthHeaders,
  resolveBaseUrl,
  activeEnvironment,
  PRODUCTION_URL,
  SANDBOX_URL,
} from "./bitstamp-client";

// Composición exacta del mensaje según la documentación oficial de Bitstamp:
// "BITSTAMP " + api_key + verbo + host + path + query + Content-Type + nonce + timestamp + "v2" + cuerpo

test("mensaje firmado con cuerpo: incluye Content-Type y respeta el orden exacto", () => {
  const message = buildAuthMessage({
    apiKey:      "testkey",
    method:      "POST",
    host:        "www.bitstamp.net",
    path:        "/api/v2/user_transactions/",
    query:       "",
    contentType: "application/x-www-form-urlencoded",
    nonce:       "9b2c8a01-9d0f-4a34-9f7e-2a54cd12f1f8",
    timestamp:   "1687509547855",
    version:     "v2",
    body:        "offset=1",
  });
  assert.equal(
    message,
    "BITSTAMP testkey" +
      "POST" +
      "www.bitstamp.net" +
      "/api/v2/user_transactions/" +
      "" +
      "application/x-www-form-urlencoded" +
      "9b2c8a01-9d0f-4a34-9f7e-2a54cd12f1f8" +
      "1687509547855" +
      "v2" +
      "offset=1",
  );
});

test("mensaje sin cuerpo: Content-Type vacío no aparece en el mensaje", () => {
  const message = buildAuthMessage({
    apiKey:      "k",
    method:      "POST",
    host:        "sandbox.bitstamp.net",
    path:        "/api/v2/account_balances/",
    query:       "",
    contentType: "",
    nonce:       "n",
    timestamp:   "t",
    version:     "v2",
    body:        "",
  });
  assert.equal(message, "BITSTAMP kPOSTsandbox.bitstamp.net/api/v2/account_balances/ntv2");
});

test("firma: HMAC-SHA256 hex en minúsculas del mensaje con el secreto", () => {
  const msg = "BITSTAMP abcPOSTwww.bitstamp.net/api/v2/account_balances/nonce-x1700000000000v2";
  const sig = signAuthMessage(msg, "supersecret");
  assert.match(sig, /^[0-9a-f]{64}$/, "debe ser hex de 64 chars en minúsculas");
  assert.equal(sig, createHmac("sha256", "supersecret").update(msg, "utf8").digest("hex"));
});

test("headers con cuerpo: set completo v2 + Content-Type urlencoded", () => {
  const h = buildAuthHeaders({
    apiKey:    "mykey",
    apiSecret: "mysecret",
    method:    "post",
    host:      "www.bitstamp.net",
    path:      "/api/v2/buy/market/btcusd/",
    body:      "amount=0.001",
    nonce:     "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
    timestamp: "1700000000000",
  });
  assert.equal(h["X-Auth"], "BITSTAMP mykey");
  assert.equal(h["X-Auth-Version"], "v2");
  assert.equal(h["X-Auth-Nonce"], "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0");
  assert.equal(h["X-Auth-Timestamp"], "1700000000000");
  assert.equal(h["Content-Type"], "application/x-www-form-urlencoded");
  // La firma corresponde al mensaje canónico (verbo en MAYÚSCULAS, Content-Type incluido)
  const expected = signAuthMessage(
    "BITSTAMP mykey" +
      "POST" +
      "www.bitstamp.net" +
      "/api/v2/buy/market/btcusd/" +
      "" +
      "application/x-www-form-urlencoded" +
      "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0" +
      "1700000000000" +
      "v2" +
      "amount=0.001",
    "mysecret",
  );
  assert.equal(h["X-Auth-Signature"], expected);
});

test("headers sin cuerpo: Content-Type NO debe enviarse (requisito API0020)", () => {
  const h = buildAuthHeaders({
    apiKey:    "mykey",
    apiSecret: "mysecret",
    method:    "POST",
    host:      "sandbox.bitstamp.net",
    path:      "/api/v2/account_balances/",
  });
  assert.equal("Content-Type" in h, false);
  assert.equal(h["X-Auth"], "BITSTAMP mykey");
  // Nonce autogenerado: 36 chars en minúsculas (formato UUID)
  assert.match(h["X-Auth-Nonce"], /^[0-9a-f-]{36}$/);
  // Timestamp autogenerado: milisegundos
  assert.match(h["X-Auth-Timestamp"], /^\d{13}$/);
});

// ─── Selección de entorno ─────────────────────────────────────────────────────

test("entorno: default producción; BITSTAMP_ENV=sandbox → sandbox; BITSTAMP_URL gana", () => {
  assert.equal(resolveBaseUrl({} as NodeJS.ProcessEnv), PRODUCTION_URL);
  assert.equal(activeEnvironment({} as NodeJS.ProcessEnv), "production");

  assert.equal(resolveBaseUrl({ BITSTAMP_ENV: "sandbox" } as NodeJS.ProcessEnv), SANDBOX_URL);
  assert.equal(activeEnvironment({ BITSTAMP_ENV: "sandbox" } as NodeJS.ProcessEnv), "sandbox");

  assert.equal(
    resolveBaseUrl({ BITSTAMP_ENV: "production", BITSTAMP_URL: "https://sandbox.bitstamp.net/" } as NodeJS.ProcessEnv),
    "https://sandbox.bitstamp.net",
  );
  assert.equal(
    activeEnvironment({ BITSTAMP_URL: "https://sandbox.bitstamp.net" } as NodeJS.ProcessEnv),
    "sandbox",
  );
});
