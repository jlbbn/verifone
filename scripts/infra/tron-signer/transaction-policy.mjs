import { TronWeb, utils } from "tronweb";

const TRANSFER_SELECTOR = "a9059cbb";
const MAX_TRANSACTION_AGE_MS = 120_000;
const MAX_CLOCK_SKEW_MS = 30_000;
const MAX_EXPIRATION_WINDOW_MS = 10 * 60_000;

function reject(message) {
  throw new Error(`Unsigned transaction rejected: ${message}`);
}

function hexAddress(value) {
  try {
    const hex = String(value).startsWith("T")
      ? TronWeb.address.toHex(String(value))
      : String(value).replace(/^0x/, "");
    const normalized = hex.toLowerCase();
    return /^41[0-9a-f]{40}$/.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function expectedTransferData(toAddress, amountAtomic) {
  const to = hexAddress(toAddress);
  if (!to || !/^[1-9]\d*$/.test(String(amountAtomic))) reject("invalid expected intent");
  const amountHex = BigInt(amountAtomic).toString(16);
  if (amountHex.length > 64) reject("amount exceeds ABI uint256");
  return TRANSFER_SELECTOR
    + to.slice(2).padStart(64, "0")
    + amountHex.padStart(64, "0");
}

export function approvedPrivateNodeOrigin(fullHost, approvedOrigin) {
  try {
    const node = new URL(String(fullHost || ""));
    const approved = new URL(String(approvedOrigin || ""));
    const parts = node.hostname.split(".").map(Number);
    const privateIpv4 = parts.length === 4
      && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
      && (
        parts[0] === 10
        || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
        || (parts[0] === 192 && parts[1] === 168)
      );
    const protocolAllowed = node.protocol === "https:" || node.protocol === "http:";
    if (!privateIpv4 || !protocolAllowed || node.origin !== approved.origin) return null;
    if (node.pathname !== "/" || node.search || node.hash) return null;
    if (approved.pathname !== "/" || approved.search || approved.hash) return null;
    return node.origin;
  } catch {
    return null;
  }
}

export function validateUnsignedTransferTransaction(transaction, intent, now = Date.now()) {
  if (!transaction || typeof transaction !== "object" || transaction.signature) {
    reject("missing, malformed, or already signed");
  }
  try {
    if (!utils.transaction.txCheck(transaction)) {
      reject("txid/raw protobuf does not match decoded transaction");
    }
  } catch {
    reject("txid/raw protobuf does not match decoded transaction");
  }

  const raw = transaction.raw_data;
  if (!raw || !Array.isArray(raw.contract) || raw.contract.length !== 1) {
    reject("exactly one contract is required");
  }
  const contract = raw.contract[0];
  if (contract.type !== "TriggerSmartContract"
      || contract.parameter?.type_url !== "type.googleapis.com/protocol.TriggerSmartContract") {
    reject("contract type is not TriggerSmartContract");
  }
  if (contract.Permission_id !== undefined && contract.Permission_id !== 0) {
    reject("unexpected permission id");
  }

  const value = contract.parameter?.value;
  if (hexAddress(value?.owner_address) !== hexAddress(intent.ownerAddress)) reject("owner mismatch");
  if (hexAddress(value?.contract_address) !== hexAddress(intent.contractAddress)) reject("contract mismatch");
  if (Number(value?.call_value ?? 0) !== 0
      || Number(value?.call_token_value ?? 0) !== 0
      || Number(value?.token_id ?? 0) !== 0) {
    reject("native/token side value is not zero");
  }
  const expectedData = expectedTransferData(intent.toAddress, intent.amountAtomic);
  if (String(value?.data ?? "").replace(/^0x/, "").toLowerCase() !== expectedData) {
    reject("transfer calldata mismatch");
  }
  if (raw.data) reject("transaction memo is not allowed");
  if (Number(raw.fee_limit) !== Number(intent.feeLimitSun)) reject("fee limit mismatch");

  const timestamp = Number(raw.timestamp);
  const expiration = Number(raw.expiration);
  if (!Number.isSafeInteger(timestamp)
      || timestamp < now - MAX_TRANSACTION_AGE_MS
      || timestamp > now + MAX_CLOCK_SKEW_MS) {
    reject("timestamp outside allowed window");
  }
  if (!Number.isSafeInteger(expiration)
      || expiration <= now
      || expiration <= timestamp
      || expiration - timestamp > MAX_EXPIRATION_WINDOW_MS
      || expiration > now + MAX_EXPIRATION_WINDOW_MS) {
    reject("expiration outside allowed window");
  }
  if (!/^[0-9a-fA-F]{4}$/.test(String(raw.ref_block_bytes ?? ""))
      || !/^[0-9a-fA-F]{16}$/.test(String(raw.ref_block_hash ?? ""))) {
    reject("invalid TAPOS reference");
  }
  return true;
}