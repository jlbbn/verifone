import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { TronWeb, utils } from "tronweb";
import {
  approvedPrivateNodeOrigin,
  validateUnsignedTransferTransaction,
} from "./transaction-policy.mjs";
import {
  configuredSignerNetwork,
  validateSignerStateProfile,
  validateSignerStatePath,
} from "./network-profile.mjs";

const OWNER = "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const MAINNET_GENESIS = "00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc";
const NILE_GENESIS = "0000000000000000d698d4192c56cb6be724a558448e2684802de4d6cd8690dc";
const AMOUNT = "1000001";
const FEE_LIMIT = 40_000_000;

test("signer network profile is explicit, defaults to mainnet and rejects unknown values", () => {
  assert.deepEqual(configuredSignerNetwork({}), {
    network: "mainnet",
    usdtContract: USDT,
    p2pVersion: "11111",
    genesisBlockId: MAINNET_GENESIS,
  });
  assert.deepEqual(configuredSignerNetwork({ TRON_NETWORK: "nile" }), {
    network: "nile",
    usdtContract: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
    p2pVersion: "201910292",
    genesisBlockId: NILE_GENESIS,
  });
  assert.throws(
    () => configuredSignerNetwork({ TRON_NETWORK: "shasta" }),
    /TRON_NETWORK must be exactly/,
  );
});

test("signer state cannot be reused across mainnet and Nile profiles", () => {
  assert.deepEqual(validateSignerStateProfile({}, {}), {
    network: "mainnet",
    contract: USDT,
  });
  assert.deepEqual(validateSignerStateProfile({
    network: "nile",
    contract: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
  }, { TRON_NETWORK: "nile" }), {
    network: "nile",
    contract: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
  });
  assert.throws(
    () => validateSignerStateProfile({}, { TRON_NETWORK: "nile" }),
    /state belongs to a different network profile/,
  );
  assert.throws(
    () => validateSignerStateProfile({
      network: "nile",
      contract: USDT,
    }, { TRON_NETWORK: "nile" }),
    /state belongs to a different network profile/,
  );
});

test("Nile signer requires an explicit profile-scoped state path", () => {
  assert.equal(
    validateSignerStatePath("/var/lib/tron-signer/state.json", {}),
    "/var/lib/tron-signer/state.json",
  );
  assert.equal(
    validateSignerStatePath(
      "/var/lib/tron-signer/nile-state.json",
      { TRON_NETWORK: "nile" },
    ),
    "/var/lib/tron-signer/nile-state.json",
  );
  assert.throws(
    () => validateSignerStatePath(
      "/var/lib/tron-signer/state.json",
      { TRON_NETWORK: "nile" },
    ),
    /Nile requires an explicit profile-scoped/,
  );
  assert.throws(
    () => validateSignerStatePath(
      "/var/lib/tron-signer/test-state.json",
      { TRON_NETWORK: "nile" },
    ),
    /Nile requires an explicit profile-scoped/,
  );
});

function transferData(toAddress, amountAtomic) {
  return "a9059cbb"
    + TronWeb.address.toHex(toAddress).slice(2).padStart(64, "0")
    + BigInt(amountAtomic).toString(16).padStart(64, "0");
}

function finalize(transaction) {
  const pb = utils.transaction.txJsonToPb(transaction);
  const rawBytes = pb.getRawData().serializeBinary();
  transaction.raw_data_hex = utils.code.byteArray2hexStr(rawBytes);
  transaction.txID = createHash("sha256").update(rawBytes).digest("hex");
  return transaction;
}

function validTransaction(now) {
  return finalize({
    visible: false,
    txID: "",
    raw_data: {
      contract: [{
        parameter: {
          value: {
            data: transferData(USDT, AMOUNT),
            owner_address: TronWeb.address.toHex(OWNER),
            contract_address: TronWeb.address.toHex(USDT),
            call_value: 0,
          },
          type_url: "type.googleapis.com/protocol.TriggerSmartContract",
        },
        type: "TriggerSmartContract",
      }],
      ref_block_bytes: "1234",
      ref_block_hash: "1234567890abcdef",
      expiration: now + 60_000,
      timestamp: now,
      fee_limit: FEE_LIMIT,
    },
    raw_data_hex: "",
  });
}

const intent = {
  ownerAddress: OWNER,
  contractAddress: USDT,
  toAddress: USDT,
  amountAtomic: AMOUNT,
  feeLimitSun: FEE_LIMIT,
};

test("signer accepts only a self-consistent transaction matching the full intent", () => {
  const now = 1_787_212_800_000;
  assert.equal(validateUnsignedTransferTransaction(validTransaction(now), intent, now), true);
});

test("signer rejects adversarial node-built transactions before signing", () => {
  const now = 1_787_212_800_000;
  const adversarial = [
    (tx) => { tx.raw_data.contract[0].parameter.value.data = transferData(OWNER, AMOUNT); },
    (tx) => { tx.raw_data.contract[0].parameter.value.data = transferData(USDT, "1000002"); },
    (tx) => { tx.raw_data.contract[0].parameter.value.owner_address = TronWeb.address.toHex(USDT); },
    (tx) => { tx.raw_data.contract[0].parameter.value.contract_address = TronWeb.address.toHex(OWNER); },
    (tx) => { tx.raw_data.contract[0].parameter.value.call_value = 1; },
    (tx) => { tx.raw_data.fee_limit = FEE_LIMIT + 1; },
    (tx) => { tx.raw_data.expiration = now + 20 * 60_000; },
    (tx) => { tx.raw_data.contract.push(structuredClone(tx.raw_data.contract[0])); },
  ];
  for (const mutate of adversarial) {
    const transaction = validTransaction(now);
    mutate(transaction);
    finalize(transaction);
    assert.throws(
      () => validateUnsignedTransferTransaction(transaction, intent, now),
      /Unsigned transaction rejected/,
    );
  }
});

test("signer rejects a mismatched txid/raw transaction pair", () => {
  const now = 1_787_212_800_000;
  const transaction = validTransaction(now);
  transaction.txID = "00".repeat(32);
  assert.throws(
    () => validateUnsignedTransferTransaction(transaction, intent, now),
    /txid\/raw protobuf/,
  );
});

test("signer node approval rejects public, missing, mismatched, and path-scoped URLs", () => {
  assert.equal(approvedPrivateNodeOrigin("", ""), null);
  assert.equal(
    approvedPrivateNodeOrigin("https://api.trongrid.io", "https://api.trongrid.io"),
    null,
  );
  assert.equal(
    approvedPrivateNodeOrigin("http://10.10.0.3:8090", "http://10.10.0.4:8090"),
    null,
  );
  assert.equal(
    approvedPrivateNodeOrigin("http://10.10.0.3:8090/wallet", "http://10.10.0.3:8090"),
    null,
  );
  assert.equal(
    approvedPrivateNodeOrigin("http://10.10.0.3:8090", "http://10.10.0.3:8090"),
    "http://10.10.0.3:8090",
  );
});