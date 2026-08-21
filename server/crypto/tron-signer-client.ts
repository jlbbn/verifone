import { createHmac, randomBytes, randomUUID } from "crypto";
import { readFileSync } from "fs";
import https from "https";
import { USDT_CONTRACT } from "./tron-client";

const REQUEST_TIMEOUT_MS = Number(process.env.TRON_SIGNER_TIMEOUT_MS ?? 12_000);

export interface SignerTransferRequest {
  idempotencyKey: string;
  toAddress: string;
  amountAtomic: string;
}

export interface SignerTransferResult {
  requestId: string;
  txid: string;
  status: "broadcast";
  duplicate?: boolean;
}

export interface SignerHealth {
  healthy: boolean;
  configured: boolean;
  writesEnabled: boolean;
  address: string | null;
  nodeEndpoint: string | null;
  blockNumber?: number | null;
  headAgeMs?: number | null;
  activePeers?: number | null;
  checkedAt: string;
}

export interface SignerTransferStatus {
  requestId: string;
  txid: string | null;
  status: "prepared" | "broadcast";
}

function signerUrl(env: NodeJS.ProcessEnv = process.env): URL | null {
  const raw = env.TRON_SIGNER_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export function signerConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const url = signerUrl(env);
  const hasHmac = Boolean(
    env.TRON_SIGNER_KEY_ID?.trim()
    && env.TRON_SIGNER_HMAC_SECRET?.trim(),
  );
  const hasMtls = Boolean(
    env.TRON_SIGNER_MTLS_CERT_PATH?.trim()
    && env.TRON_SIGNER_MTLS_KEY_PATH?.trim()
    && env.TRON_SIGNER_CA_PATH?.trim(),
  );
  return {
    configured: Boolean(url && hasHmac && hasMtls),
    endpoint: url ? url.origin : null,
    transport: "mTLS+HMAC" as const,
  };
}

export function buildSignerAuthentication(
  payload: string,
  keyId: string,
  secret: string,
  timestamp: string,
  nonce: string,
) {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${payload}`)
    .digest("hex");
  return {
    "X-Signer-Key-Id": keyId,
    "X-Signer-Timestamp": timestamp,
    "X-Signer-Nonce": nonce,
    "X-Signer-Signature": signature,
  };
}

function tlsOptions() {
  const certPath = process.env.TRON_SIGNER_MTLS_CERT_PATH?.trim();
  const keyPath = process.env.TRON_SIGNER_MTLS_KEY_PATH?.trim();
  const caPath = process.env.TRON_SIGNER_CA_PATH?.trim();
  if (!certPath || !keyPath || !caPath) {
    throw new Error("TRON signer mTLS is not configured");
  }
  return {
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
    ca: readFileSync(caPath),
    rejectUnauthorized: true,
    minVersion: "TLSv1.3" as const,
  };
}

function requestJson<T>(
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<T> {
  const base = signerUrl();
  const keyId = process.env.TRON_SIGNER_KEY_ID?.trim();
  const secret = process.env.TRON_SIGNER_HMAC_SECRET?.trim();
  if (!base || !keyId || !secret || !signerConfiguration().configured) {
    return Promise.reject(new Error("TRON remote signer is not configured"));
  }

  const payload = body ? JSON.stringify(body) : "";
  const timestamp = Date.now().toString();
  const nonce = randomBytes(16).toString("hex");
  const authentication = buildSignerAuthentication(payload, keyId, secret, timestamp, nonce);
  const url = new URL(path, base);

  return new Promise<T>((resolve, reject) => {
    const req = https.request(url, {
      method,
      ...tlsOptions(),
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...authentication,
      },
      timeout: REQUEST_TIMEOUT_MS,
    }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 64_000) req.destroy(new Error("TRON signer response too large"));
      });
      res.on("end", () => {
        let parsed: any;
        try { parsed = raw ? JSON.parse(raw) : {}; }
        catch { return reject(new Error("TRON signer returned invalid JSON")); }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(parsed?.error || `TRON signer HTTP ${res.statusCode ?? 0}`));
        }
        resolve(parsed as T);
      });
    });
    req.on("timeout", () => req.destroy(new Error("TRON signer timeout")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export async function requestTransfer(input: SignerTransferRequest): Promise<SignerTransferResult> {
  const requestId = randomUUID();
  return requestJson<SignerTransferResult>("/v1/transfers", "POST", {
    requestId,
    idempotencyKey: input.idempotencyKey,
    network: "mainnet",
    contract: USDT_CONTRACT,
    toAddress: input.toAddress,
    amountAtomic: input.amountAtomic,
  });
}

export async function getTransferStatus(idempotencyKey: string): Promise<SignerTransferStatus> {
  return requestJson<SignerTransferStatus>(
    `/v1/transfers/${encodeURIComponent(idempotencyKey)}`,
    "GET",
  );
}

export async function getSignerHealth(): Promise<SignerHealth> {
  return requestJson<SignerHealth>("/health", "GET");
}