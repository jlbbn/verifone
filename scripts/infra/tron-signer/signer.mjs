#!/usr/bin/env node
/**
 * Banxico Plus TRON remote signer.
 *
 * This process belongs on an isolated host. Banxico Plus authenticates with
 * mTLS + HMAC; the TRON private key exists only in this process environment.
 * Writes are denied unless TRON_SIGNER_WRITES_ENABLED=true.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { open, readFile, rename } from "node:fs/promises";
import { createServer } from "node:https";
import { dirname } from "node:path";
import { TronWeb } from "tronweb";
import {
  approvedPrivateNodeOrigin,
  validateUnsignedTransferTransaction,
} from "./transaction-policy.mjs";
import {
  configuredSignerNetwork,
  validateSignerStateProfile,
  validateSignerStatePath,
} from "./network-profile.mjs";

const NETWORK_PROFILE = configuredSignerNetwork();
const NETWORK = NETWORK_PROFILE.network;
const USDT_CONTRACT = NETWORK_PROFILE.usdtContract;
const PORT = positiveInt(process.env.TRON_SIGNER_PORT || "9443", "TRON_SIGNER_PORT");
const HOST = required("TRON_SIGNER_HOST");
const STATE_PATH = validateSignerStatePath(
  process.env.TRON_SIGNER_STATE_PATH || "/var/lib/tron-signer/state.json",
  process.env,
);
const FULL_HOST = required("TRON_FULL_HOST");
const APPROVED_NODE_ORIGIN = required("TRON_APPROVED_NODE_ORIGIN");
const KEY_ID = required("TRON_SIGNER_KEY_ID");
const HMAC_SECRET = required("TRON_SIGNER_HMAC_SECRET");
const TLS_KEY_PATH = required("TRON_SIGNER_TLS_KEY_PATH");
const TLS_CERT_PATH = required("TRON_SIGNER_TLS_CERT_PATH");
const CLIENT_CA_PATH = required("TRON_SIGNER_CLIENT_CA_PATH");
const WALLET_ADDRESS = required("TRON_SIGNER_ADDRESS");
const WRITES_ENABLED = process.env.TRON_SIGNER_WRITES_ENABLED?.toLowerCase() === "true";
const PRIVATE_KEY = process.env.TRON_SIGNER_PRIVATE_KEY || "";
const MAX_PER_TX_ATOMIC = usdtToAtomic(required("TRON_SIGNER_MAX_PER_TX_USDT"));
const MAX_DAILY_ATOMIC = usdtToAtomic(required("TRON_SIGNER_MAX_DAILY_USDT"));
const MIN_TRX_RESERVE = Number(process.env.TRON_SIGNER_MIN_TRX_RESERVE || "40");
const FEE_LIMIT_SUN = positiveInt(process.env.TRON_SIGNER_FEE_LIMIT_SUN || "40000000", "TRON_SIGNER_FEE_LIMIT_SUN");
const MAX_HEAD_AGE_MS = positiveInt(process.env.TRON_SIGNER_MAX_HEAD_AGE_MS || "180000", "TRON_SIGNER_MAX_HEAD_AGE_MS");
const MIN_ACTIVE_PEERS = positiveInt(process.env.TRON_SIGNER_MIN_ACTIVE_PEERS || "3", "TRON_SIGNER_MIN_ACTIVE_PEERS");
const MAX_BODY_BYTES = 32_768;
const AUTH_WINDOW_MS = 30_000;

if (!isPrivateIpv4(HOST)) {
  throw new Error("TRON_SIGNER_HOST must be a private or loopback IPv4 address, never a wildcard/public address");
}
const approvedNodeOrigin = approvedPrivateNodeOrigin(FULL_HOST, APPROVED_NODE_ORIGIN);
if (!approvedNodeOrigin) {
  throw new Error("TRON_FULL_HOST must exactly match TRON_APPROVED_NODE_ORIGIN on a private IPv4 address");
}
if (WRITES_ENABLED && !/^[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
  throw new Error("TRON_SIGNER_PRIVATE_KEY is required and must be 64 hex chars when writes are enabled");
}

const tls = {
  key: await readFile(TLS_KEY_PATH),
  cert: await readFile(TLS_CERT_PATH),
  ca: await readFile(CLIENT_CA_PATH),
  requestCert: true,
  rejectUnauthorized: true,
  minVersion: "TLSv1.3",
};

let tron = null;
if (WRITES_ENABLED) {
  const derived = TronWeb.address.fromPrivateKey(PRIVATE_KEY);
  if (!derived || derived !== WALLET_ADDRESS) {
    throw new Error("TRON_SIGNER_PRIVATE_KEY does not match TRON_SIGNER_ADDRESS");
  }
  tron = new TronWeb({ fullHost: FULL_HOST, privateKey: PRIVATE_KEY });
}

let state = await loadState();
let serial = Promise.resolve();
const nonces = new Map();

if (WRITES_ENABLED) {
  for (const [key, request] of Object.entries(state.requests)) {
    if (request.status !== "prepared") continue;
    try {
      await reconcilePrepared(key, request);
    } catch (err) {
      log("prepared_reconciliation_failed", {
        requestId: request.requestId,
        txid: request.txid,
        code: safeErrorCode(err),
      });
    }
  }
}

const server = createServer(tls, async (req, res) => {
  setSecurityHeaders(res);
  if (!req.socket.authorized) return json(res, 401, { error: "mTLS client rejected" });

  if (req.method === "GET" && req.url === "/health") {
    return health(res);
  }
  if (req.method === "GET" && req.url?.startsWith("/v1/transfers/")) {
    const authError = authenticate(req.headers, "");
    if (authError) return json(res, 401, { error: authError });
    const key = decodeURIComponent(req.url.slice("/v1/transfers/".length));
    let result = state.requests[key];
    if (!result) return json(res, 404, { error: "Transfer not found", code: "TRANSFER_NOT_FOUND" });
    if (result.status === "prepared") {
      serial = serial.then(
        () => reconcilePrepared(key, result),
        () => reconcilePrepared(key, result),
      );
      try { result = await serial; }
      catch {
        result = state.requests[key];
      }
    }
    return json(res, 200, {
      requestId: result.requestId,
      txid: result.txid || null,
      status: result.status,
    });
  }
  if (req.method !== "POST" || req.url !== "/v1/transfers") {
    return json(res, 404, { error: "Not found" });
  }

  let raw;
  try { raw = await readBody(req); }
  catch (err) { return json(res, 413, { error: err.message }); }
  const authError = authenticate(req.headers, raw);
  if (authError) return json(res, 401, { error: authError });
  if (!WRITES_ENABLED) {
    return json(res, 503, { error: "TRON signer writes disabled", code: "SIGNER_WRITES_DISABLED" });
  }

  let body;
  try { body = JSON.parse(raw); }
  catch { return json(res, 400, { error: "Invalid JSON" }); }

  serial = serial.then(() => processTransfer(body), () => processTransfer(body));
  try {
    const result = await serial;
    return json(res, 200, result);
  } catch (err) {
    log("transfer_rejected", { code: safeErrorCode(err) });
    return json(res, err.status || 500, {
      error: err.publicMessage || "Transfer rejected",
      code: safeErrorCode(err),
    });
  }
});

server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.listen(PORT, HOST, () => {
  log("signer_started", {
    host: HOST,
    port: PORT,
    network: NETWORK,
    contract: USDT_CONTRACT,
    writesEnabled: WRITES_ENABLED,
    wallet: maskAddress(WALLET_ADDRESS),
  });
});

async function processTransfer(body) {
  validateTransfer(body);
  rotateDailyState();
  const fingerprint = createHash("sha256").update(JSON.stringify({
    network: body.network,
    contract: body.contract,
    toAddress: body.toAddress,
    amountAtomic: body.amountAtomic,
  })).digest("hex");

  const previous = state.requests[body.idempotencyKey];
  if (previous) {
    if (previous.fingerprint !== fingerprint) {
      throw publicError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key already used");
    }
    if (previous.status === "prepared") {
      const reconciled = await reconcilePrepared(body.idempotencyKey, previous);
      if (reconciled.status === "broadcast") {
        return {
          requestId: reconciled.requestId,
          txid: reconciled.txid,
          status: "broadcast",
          duplicate: true,
        };
      }
    }
    if (previous.status !== "broadcast" || !previous.txid) {
      throw publicError(409, "AMBIGUOUS_PREVIOUS_ATTEMPT", "Previous attempt requires reconciliation");
    }
    return {
      requestId: previous.requestId,
      txid: previous.txid,
      status: "broadcast",
      duplicate: true,
    };
  }

  const amountAtomic = BigInt(body.amountAtomic);
  if (amountAtomic > MAX_PER_TX_ATOMIC) {
    throw publicError(400, "EXCEEDS_SIGNER_PER_TX_LIMIT", "Transfer exceeds signer per-transaction limit");
  }
  if (BigInt(state.totalAtomic) + amountAtomic > MAX_DAILY_ATOMIC) {
    throw publicError(400, "EXCEEDS_SIGNER_DAILY_LIMIT", "Transfer exceeds signer daily limit");
  }

  const nodeReadiness = await inspectNode();
  if (!nodeReadiness.healthy) {
    const identityMismatch = nodeReadiness.chainIdentityMatches === false;
    throw publicError(
      503,
      identityMismatch ? "TRON_NETWORK_IDENTITY_MISMATCH" : "TRON_NODE_UNHEALTHY",
      identityMismatch
        ? "TRON node identity does not match the configured network"
        : "TRON node is stale, peerless, or unavailable",
    );
  }

  const trxBalance = Number(await withTimeout(tron.trx.getBalance(WALLET_ADDRESS), 8_000)) / 1_000_000;
  if (trxBalance < MIN_TRX_RESERVE) {
    throw publicError(503, "INSUFFICIENT_TRX_RESERVE", "Insufficient TRX reserve");
  }

  const trigger = await withTimeout(
    tron.transactionBuilder.triggerSmartContract(
      USDT_CONTRACT,
      "transfer(address,uint256)",
      { feeLimit: FEE_LIMIT_SUN, callValue: 0 },
      [
        { type: "address", value: body.toAddress },
        { type: "uint256", value: body.amountAtomic },
      ],
      WALLET_ADDRESS,
    ),
    8_000,
  );
  if (!trigger?.result?.result || !trigger.transaction) {
    throw publicError(502, "TRANSACTION_BUILD_FAILED", "TRON node could not build the transaction");
  }
  try {
    validateUnsignedTransferTransaction(trigger.transaction, {
      ownerAddress: WALLET_ADDRESS,
      contractAddress: USDT_CONTRACT,
      toAddress: body.toAddress,
      amountAtomic: body.amountAtomic,
      feeLimitSun: FEE_LIMIT_SUN,
    });
  } catch {
    throw publicError(
      502,
      "UNSIGNED_TRANSACTION_INTENT_MISMATCH",
      "TRON node returned a transaction that does not match the approved intent",
    );
  }
  const signedTransaction = await withTimeout(
    tron.trx.sign(trigger.transaction, PRIVATE_KEY),
    8_000,
  );
  const txid = signedTransaction?.txID;
  if (!txid || !/^[0-9a-fA-F]{64}$/.test(txid) || !Array.isArray(signedTransaction.signature)) {
    throw publicError(502, "TRANSACTION_SIGN_FAILED", "Signer could not produce a valid transaction");
  }

  // Persist the exact signed transaction and its deterministic txid before
  // broadcast. A retry can only rebroadcast these same bytes, never create a
  // second transfer.
  state.totalAtomic = (BigInt(state.totalAtomic) + amountAtomic).toString();
  state.requests[body.idempotencyKey] = {
    requestId: body.requestId,
    fingerprint,
    txid,
    status: "prepared",
    signedTransaction,
    createdAt: new Date().toISOString(),
  };
  await persistState();

  await broadcastPrepared(signedTransaction, txid);
  state.requests[body.idempotencyKey] = {
    requestId: body.requestId,
    fingerprint,
    txid,
    status: "broadcast",
    createdAt: new Date().toISOString(),
  };
  await persistState();
  log("transfer_broadcast", {
    requestId: body.requestId,
    txid,
    amountAtomic: body.amountAtomic,
    to: maskAddress(body.toAddress),
  });
  return { requestId: body.requestId, txid, status: "broadcast" };
}

async function reconcilePrepared(key, request) {
  if (!request?.txid || !request?.signedTransaction) {
    throw publicError(409, "INCOMPLETE_PREPARED_TRANSACTION", "Prepared transaction is incomplete");
  }
  try {
    const transaction = await withTimeout(tron.trx.getTransaction(request.txid), 8_000);
    if (transaction?.txID === request.txid) {
      state.requests[key] = { ...request, status: "broadcast", signedTransaction: undefined };
      await persistState();
      return state.requests[key];
    }
  } catch {
    // Not visible yet: rebroadcast the exact persisted bytes below.
  }
  await broadcastPrepared(request.signedTransaction, request.txid);
  state.requests[key] = { ...request, status: "broadcast", signedTransaction: undefined };
  await persistState();
  return state.requests[key];
}

async function broadcastPrepared(signedTransaction, expectedTxid) {
  const result = await withTimeout(tron.trx.sendRawTransaction(signedTransaction), 15_000);
  const duplicate = result?.code === 5 || result?.code === "DUP_TRANSACTION_ERROR";
  if (!result?.result && !duplicate) {
    throw publicError(502, "TRANSACTION_BROADCAST_FAILED", "TRON node rejected the transaction");
  }
  if (result?.txid && result.txid !== expectedTxid) {
    throw publicError(502, "TRANSACTION_ID_MISMATCH", "TRON node returned a different transaction id");
  }
}

function validateTransfer(body) {
  if (!body || typeof body !== "object") throw publicError(400, "INVALID_REQUEST", "Invalid request");
  if (!/^[0-9a-f-]{36}$/i.test(body.requestId || "")) {
    throw publicError(400, "INVALID_REQUEST_ID", "Invalid request id");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(body.idempotencyKey || "")) {
    throw publicError(400, "INVALID_IDEMPOTENCY_KEY", "Invalid idempotency key");
  }
  if (body.network !== NETWORK || body.contract !== USDT_CONTRACT) {
    throw publicError(400, "NETWORK_OR_CONTRACT_REJECTED", "Network or contract rejected");
  }
  if (!TronWeb.isAddress(body.toAddress || "")) {
    throw publicError(400, "INVALID_TRON_ADDRESS", "Invalid TRON address");
  }
  if (!/^[1-9]\d*$/.test(body.amountAtomic || "")) {
    throw publicError(400, "INVALID_AMOUNT", "Invalid atomic amount");
  }
}

function authenticate(headers, raw) {
  const keyId = String(headers["x-signer-key-id"] || "");
  const timestamp = String(headers["x-signer-timestamp"] || "");
  const nonce = String(headers["x-signer-nonce"] || "");
  const supplied = String(headers["x-signer-signature"] || "");
  if (keyId !== KEY_ID || !/^\d{13}$/.test(timestamp) || !/^[0-9a-f]{32}$/.test(nonce)) {
    return "Invalid authentication";
  }
  if (Math.abs(Date.now() - Number(timestamp)) > AUTH_WINDOW_MS) return "Expired authentication";
  cleanupNonces();
  if (nonces.has(nonce)) return "Replay rejected";
  const expected = createHmac("sha256", HMAC_SECRET)
    .update(`${timestamp}.${nonce}.${raw}`)
    .digest("hex");
  if (!safeEqual(expected, supplied)) return "Invalid authentication";
  nonces.set(nonce, Date.now());
  return null;
}

async function health(res) {
  const node = await inspectNode();
  return json(res, 200, {
    ...node,
    configured: Boolean(WALLET_ADDRESS && TLS_KEY_PATH && TLS_CERT_PATH),
    writesEnabled: WRITES_ENABLED,
    network: NETWORK,
    contract: USDT_CONTRACT,
    address: WALLET_ADDRESS,
    nodeEndpoint: approvedNodeOrigin,
    expectedGenesisBlockId: NETWORK_PROFILE.genesisBlockId,
    checkedAt: new Date().toISOString(),
  });
}

async function inspectNode() {
  let nodeHealthy = false;
  let blockNumber = null;
  let headAgeMs = null;
  let activePeers = null;
  let genesisBlockId = null;
  let chainIdentityMatches = null;
  let nodeError = null;
  try {
    const readOnly = tron || new TronWeb({ fullHost: FULL_HOST });
    const [block, nodeInfo, genesisBlock] = await withTimeout(Promise.all([
      readOnly.trx.getCurrentBlock(),
      readOnly.trx.getNodeInfo(),
      readOnly.trx.getBlockByNumber(0),
    ]), 8_000);
    blockNumber = Number(block?.block_header?.raw_data?.number || 0) || null;
    const blockTimestamp = Number(block?.block_header?.raw_data?.timestamp || 0) || null;
    headAgeMs = blockTimestamp ? Math.max(0, Date.now() - blockTimestamp) : null;
    const peersValue = Number(nodeInfo?.activeConnectCount);
    activePeers = Number.isFinite(peersValue) ? peersValue : null;
    genesisBlockId = typeof genesisBlock?.blockID === "string"
      ? genesisBlock.blockID
      : null;
    chainIdentityMatches = genesisBlockId === NETWORK_PROFILE.genesisBlockId;
    nodeHealthy = Boolean(
      blockNumber
      && headAgeMs !== null
      && headAgeMs <= MAX_HEAD_AGE_MS
      && activePeers !== null
      && activePeers >= MIN_ACTIVE_PEERS
      && chainIdentityMatches
    );
  } catch (err) {
    nodeError = err.message;
  }
  return {
    healthy: nodeHealthy,
    blockNumber,
    headAgeMs,
    activePeers,
    genesisBlockId,
    chainIdentityMatches,
    nodeError,
  };
}

async function loadState() {
  try {
    const parsed = JSON.parse(await readFile(STATE_PATH, "utf8"));
    if (parsed && typeof parsed === "object" && parsed.requests) {
      const persistedProfile = validateSignerStateProfile(parsed, {
        TRON_NETWORK: NETWORK,
      });
      return {
        ...parsed,
        network: persistedProfile.network,
        contract: persistedProfile.contract,
      };
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  return {
    network: NETWORK,
    contract: USDT_CONTRACT,
    date: utcDate(),
    totalAtomic: "0",
    requests: {},
  };
}

function rotateDailyState() {
  const today = utcDate();
  if (state.date !== today) {
    // Retain request results for retry safety; reset only the daily aggregate.
    state.date = today;
    state.totalAtomic = "0";
  }
  const retentionCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  for (const [key, request] of Object.entries(state.requests)) {
    if (request.status === "broadcast" && Date.parse(request.createdAt) < retentionCutoff) {
      delete state.requests[key];
    }
  }
}

async function persistState() {
  const tmp = `${STATE_PATH}.tmp`;
  const file = await open(tmp, "w", 0o600);
  try {
    await file.writeFile(JSON.stringify(state));
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(tmp, STATE_PATH);
  const directory = await open(dirname(STATE_PATH), "r");
  try { await directory.sync(); }
  finally { await directory.close(); }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInt(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function isPrivateIpv4(value) {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function usdtToAtomic(value) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) throw new Error("USDT limit must have up to 6 decimals");
  const [whole, fraction = ""] = value.split(".");
  const atomic = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  if (atomic <= 0n) throw new Error("USDT limit must be positive");
  return atomic;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("TRON node timeout")), ms)),
  ]);
}

function publicError(status, code, message) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  err.publicMessage = message;
  return err;
}

function safeErrorCode(err) {
  return typeof err?.code === "string" && /^[A-Z0-9_]{3,64}$/.test(err.code)
    ? err.code : "SIGNER_INTERNAL_ERROR";
}

function safeEqual(a, b) {
  if (!/^[0-9a-f]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function cleanupNonces() {
  const cutoff = Date.now() - AUTH_WINDOW_MS;
  for (const [nonce, at] of nonces) if (at < cutoff) nonces.delete(nonce);
}

function utcDate() { return new Date().toISOString().slice(0, 10); }
function safeOrigin(value) { try { return new URL(value).origin; } catch { return null; } }
function maskAddress(value) { return value.length > 10 ? `${value.slice(0, 6)}…${value.slice(-4)}` : "(invalid)"; }
function setSecurityHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}
function json(res, status, value) { res.statusCode = status; res.end(JSON.stringify(value)); }
function log(event, fields = {}) {
  process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), event, ...fields })}\n`);
}

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));