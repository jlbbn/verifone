import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  configuredDailyLimit,
  approvedPrivateTronNodeConfiguration,
  legacyLocalSigningKeyPresent,
  parseUsdtAmount,
  tronWalletWritesEnabled,
} from "./tron-policy.js";
import {
  buildSignerAuthentication,
  buildSignerTransferPayload,
  signerConfiguration,
  signerProfileMatches,
} from "./tron-signer-client.js";
import {
  configuredTronNetwork,
  tronChainIdentityMatches,
} from "./tron-network.js";
import {
  decodeUsdtTransferLog,
  isHealthyTronHead,
  transactionExecutionStatus,
  USDT_CONTRACT,
} from "./tron-client.js";
import { TronWeb } from "tronweb";

const MAINNET_GENESIS = "00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc";
const NILE_GENESIS = "0000000000000000d698d4192c56cb6be724a558448e2684802de4d6cd8690dc";

test("USDT parser preserves six-decimal atomic precision", () => {
  assert.deepEqual(parseUsdtAmount("100.000001"), {
    normalized: "100.000001",
    atomic: "100000001",
    numeric: 100.000001,
  });
  assert.throws(() => parseUsdtAmount("001"));
});

test("USDT parser rejects zero, exponent notation, negatives and excess decimals", () => {
  for (const invalid of ["0", "0.000000", "1e3", "-1", "1.0000001", " 1.2.3 "]) {
    assert.throws(() => parseUsdtAmount(invalid));
  }
});

test("wallet write gate is explicit and detects legacy local signing key", () => {
  assert.equal(tronWalletWritesEnabled({}), false);
  assert.equal(tronWalletWritesEnabled({ TRON_WALLET_WRITES_ENABLED: "TRUE" }), true);
  assert.equal(tronWalletWritesEnabled({ TRON_WALLET_WRITES_ENABLED: "1" }), false);
  assert.equal(legacyLocalSigningKeyPresent({ PLATFORM_TRON_PRIVATE_KEY: "abc" }), true);
  assert.equal(legacyLocalSigningKeyPresent({ PLATFORM_TRON_PRIVATE_KEY: "  " }), false);
});

test("TRON network profile defaults to mainnet, selects Nile explicitly and rejects unknown values", () => {
  assert.deepEqual(configuredTronNetwork({}), {
    network: "mainnet",
    label: "TRON Mainnet (TRC-20)",
    usdtContract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    genesisBlockId: MAINNET_GENESIS,
  });
  assert.deepEqual(configuredTronNetwork({ TRON_NETWORK: "nile" }), {
    network: "nile",
    label: "TRON Nile Testnet (TRC-20)",
    usdtContract: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
    genesisBlockId: NILE_GENESIS,
  });
  assert.throws(
    () => configuredTronNetwork({ TRON_NETWORK: "shasta" }),
    /TRON_NETWORK must be exactly/,
  );
  assert.equal(tronChainIdentityMatches(MAINNET_GENESIS, {}), true);
  assert.equal(tronChainIdentityMatches(NILE_GENESIS, {}), false);
  assert.equal(tronChainIdentityMatches(NILE_GENESIS, { TRON_NETWORK: "nile" }), true);
  assert.equal(tronWalletWritesEnabled({ TRON_NETWORK: "nile" }), false);
});

test("daily limit rejects absent, zero and malformed values", () => {
  assert.equal(configuredDailyLimit({}), null);
  assert.equal(configuredDailyLimit({ TRON_DAILY_LIMIT_USDT: "0" }), null);
  assert.equal(configuredDailyLimit({ TRON_DAILY_LIMIT_USDT: "abc" }), null);
  assert.equal(configuredDailyLimit({ TRON_DAILY_LIMIT_USDT: "250.5" }), 250.5);
});

test("remote signer configuration requires HTTPS, HMAC and all mTLS paths", () => {
  const complete = {
    TRON_SIGNER_URL: "https://10.10.0.4:9443",
    TRON_SIGNER_KEY_ID: "app",
    TRON_SIGNER_HMAC_SECRET: "secret",
    TRON_SIGNER_MTLS_CERT_PATH: "/cert",
    TRON_SIGNER_MTLS_KEY_PATH: "/key",
    TRON_SIGNER_CA_PATH: "/ca",
  };
  assert.equal(signerConfiguration(complete).configured, true);
  assert.equal(signerConfiguration({ ...complete, TRON_SIGNER_URL: "http://10.10.0.4:9443" }).configured, false);
  assert.equal(signerConfiguration({ ...complete, TRON_SIGNER_CA_PATH: "" }).configured, false);
});

test("signer payload and health profile are bound to the selected network contract", () => {
  const input = {
    idempotencyKey: "nile-test-request-0001",
    toAddress: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
    amountAtomic: "1000001",
  };
  const payload = buildSignerTransferPayload(
    input,
    "123e4567-e89b-12d3-a456-426614174000",
    { TRON_NETWORK: "nile" },
  );
  assert.equal(payload.network, "nile");
  assert.equal(payload.contract, "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj");
  assert.equal(signerProfileMatches({
    network: "nile",
    contract: payload.contract,
    genesisBlockId: NILE_GENESIS,
  }, { TRON_NETWORK: "nile" }), true);
  assert.equal(signerProfileMatches({
    network: "mainnet",
    contract: USDT_CONTRACT,
    genesisBlockId: MAINNET_GENESIS,
  }, { TRON_NETWORK: "nile" }), false);
  assert.equal(signerProfileMatches({
    network: "nile",
    contract: payload.contract,
    genesisBlockId: MAINNET_GENESIS,
  }, { TRON_NETWORK: "nile" }), false);
});

test("HMAC authentication covers timestamp, nonce and exact body", () => {
  const payload = '{"amountAtomic":"1000000"}';
  const timestamp = "1787212800000";
  const nonce = "0123456789abcdef0123456789abcdef";
  const headers = buildSignerAuthentication(payload, "app-v1", "test-secret", timestamp, nonce);
  const expected = createHmac("sha256", "test-secret")
    .update(`${timestamp}.${nonce}.${payload}`)
    .digest("hex");
  assert.equal(headers["X-Signer-Signature"], expected);
  assert.notEqual(
    headers["X-Signer-Signature"],
    buildSignerAuthentication(`${payload} `, "app-v1", "test-secret", timestamp, nonce)["X-Signer-Signature"],
  );
});

test("node health rejects stale or peerless heads", () => {
  assert.equal(isHealthyTronHead(10, 1_000, 3, 180_000, 3), true);
  assert.equal(isHealthyTronHead(10, 181_000, 3, 180_000, 3), false);
  assert.equal(isHealthyTronHead(10, 1_000, 0, 180_000, 3), false);
  assert.equal(isHealthyTronHead(null, 1_000, 3, 180_000, 3), false);
});

test("write-capable node configuration requires an explicit approved private origin", () => {
  assert.deepEqual(approvedPrivateTronNodeConfiguration({}), {
    configured: false,
    endpoint: null,
  });
  assert.equal(approvedPrivateTronNodeConfiguration({
    TRON_FULL_HOST: "https://api.trongrid.io",
    TRON_APPROVED_NODE_ORIGIN: "https://api.trongrid.io",
  }).configured, false);
  assert.equal(approvedPrivateTronNodeConfiguration({
    TRON_FULL_HOST: "http://10.10.0.3:8090",
    TRON_APPROVED_NODE_ORIGIN: "http://10.10.0.4:8090",
  }).configured, false);
  assert.deepEqual(approvedPrivateTronNodeConfiguration({
    TRON_FULL_HOST: "http://10.10.0.3:8090",
    TRON_APPROVED_NODE_ORIGIN: "http://10.10.0.3:8090",
  }), {
    configured: true,
    endpoint: "http://10.10.0.3:8090",
  });
});

test("write-capable node configuration accepts the Tailscale CGNAT range (100.64.0.0/10)", () => {
  assert.deepEqual(approvedPrivateTronNodeConfiguration({
    TRON_FULL_HOST: "http://100.85.242.110:8090",
    TRON_APPROVED_NODE_ORIGIN: "http://100.85.242.110:8090",
  }), {
    configured: true,
    endpoint: "http://100.85.242.110:8090",
  });
  // Just outside the /10 on both sides must still be rejected.
  assert.equal(approvedPrivateTronNodeConfiguration({
    TRON_FULL_HOST: "http://100.63.0.1:8090",
    TRON_APPROVED_NODE_ORIGIN: "http://100.63.0.1:8090",
  }).configured, false);
  assert.equal(approvedPrivateTronNodeConfiguration({
    TRON_FULL_HOST: "http://100.128.0.1:8090",
    TRON_APPROVED_NODE_ORIGIN: "http://100.128.0.1:8090",
  }).configured, false);
});

test("transaction confirmation requires an explicit successful receipt", () => {
  assert.equal(transactionExecutionStatus({ blockNumber: 10 }), "PENDING");
  assert.equal(transactionExecutionStatus({ receipt: {} }), "PENDING");
  assert.equal(transactionExecutionStatus({ receipt: { result: "SUCCESS" } }), "SUCCESS");
  assert.equal(transactionExecutionStatus({ receipt: { result: "REVERT" } }), "FAILED");
});

test("USDT receipt decoder selects the official Transfer event and exact atomic amount", () => {
  const source = "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8";
  const toTopic = (address: string) => TronWeb.address.toHex(address).slice(2).padStart(64, "0");
  const transferTopic = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const decoded = decodeUsdtTransferLog([
    { address: "00".repeat(20), topics: [transferTopic], data: "01" },
    {
      address: TronWeb.address.toHex(USDT_CONTRACT).slice(2),
      topics: [transferTopic, toTopic(source), toTopic(USDT_CONTRACT)],
      data: "f4241".padStart(64, "0"),
    },
  ]);
  assert.deepEqual(decoded, {
    fromAddress: source,
    toAddress: USDT_CONTRACT,
    atomicAmount: "1000001",
    contractAddress: USDT_CONTRACT,
  });
});