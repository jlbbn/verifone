import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { TronWeb, utils } from "tronweb";
import {
  approvedPrivateNodeOrigin,
  validateUnsignedTransferTransaction,
} from "./transaction-policy.mjs";

const OWNER = "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8";
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const AMOUNT = "1000001";
const FEE_LIMIT = 40_000_000;

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