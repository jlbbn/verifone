#!/usr/bin/env node
// Cliente de ensayo Nile: mTLS + HMAC contra el firmante aislado.
// Sin dependencias externas; usa solo node:crypto y node:https.
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { request } from "node:https";

const CONFIG_PATH = process.env.REHEARSAL_CONFIG || "/root/rehearsal-client/config.json";
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const tlsMaterial = {
  ca: readFileSync(config.caPath),
  cert: readFileSync(config.certPath),
  key: readFileSync(config.keyPath),
};

function call(method, path, body) {
  const raw = body ? JSON.stringify(body) : "";
  const timestamp = String(Date.now());
  const nonce = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", config.hmacSecret)
    .update(`${timestamp}.${nonce}.${raw}`)
    .digest("hex");
  const url = new URL(path, config.signerUrl);
  return new Promise((resolve, reject) => {
    const req = request({
      method,
      host: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      ca: tlsMaterial.ca,
      cert: tlsMaterial.cert,
      key: tlsMaterial.key,
      headers: {
        "content-type": "application/json",
        "x-signer-key-id": config.keyId,
        "x-signer-timestamp": timestamp,
        "x-signer-nonce": nonce,
        "x-signer-signature": signature,
        ...(raw ? { "content-length": Buffer.byteLength(raw) } : {}),
      },
      timeout: 30_000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    if (raw) req.write(raw);
    req.end();
  });
}

const [, , command, arg1, arg2] = process.argv;
if (command === "health") {
  const res = await call("GET", "/health");
  console.log(res.status, res.body);
} else if (command === "transfer") {
  const idempotencyKey = arg1;
  const amountAtomic = arg2 || "1000000";
  if (!idempotencyKey || idempotencyKey.length < 16) {
    console.error("idempotencyKey de al menos 16 caracteres requerido");
    process.exit(2);
  }
  const res = await call("POST", "/v1/transfers", {
    requestId: randomUUID(),
    idempotencyKey,
    network: config.network,
    contract: config.contract,
    toAddress: config.address,
    amountAtomic,
  });
  console.log(res.status, res.body);
} else if (command === "status") {
  const res = await call("GET", `/v1/transfers/${encodeURIComponent(arg1 || "")}`);
  console.log(res.status, res.body);
} else {
  console.error("uso: send-rehearsal.mjs health | transfer <idempotencyKey> [amountAtomic] | status <idempotencyKey>");
  process.exit(2);
}
