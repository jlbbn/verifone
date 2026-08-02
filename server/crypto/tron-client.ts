/**
 * Banxico Plus LLC — TRON / TRC-20 USDT Hot Wallet Client
 *
 * Wraps TronWeb v6 for:
 *   getBalance()     → USDT + TRX balance of platform hot wallet
 *   transfer()       → send USDT TRC-20 to an address
 *   getTransaction() → fetch on-chain transaction detail
 *   isValidAddress() → validate a base58 TRON address before signing
 *
 * Environment variables:
 *   PLATFORM_TRON_PRIVATE_KEY  — hot wallet private key  (required for write ops)
 *   PLATFORM_TRON_ADDRESS      — base58 public address    (used as default owner)
 *   TRONGRID_API_KEY           — optional rate-limit lift
 *   TRON_FULL_HOST             — override node URL (default: api.trongrid.io mainnet)
 */

import { TronWeb } from "tronweb";

// ─── Configuration ────────────────────────────────────────────────────────────

const FULL_HOST        = process.env.TRON_FULL_HOST           ?? "https://api.trongrid.io";
const PRIVATE_KEY      = process.env.PLATFORM_TRON_PRIVATE_KEY ?? "";
const PLATFORM_ADDRESS = process.env.PLATFORM_TRON_ADDRESS     ?? "";

/** TRC-20 USDT contract on TRON mainnet */
export const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

/** Decimals for USDT TRC-20 */
const USDT_DECIMALS = 6;

// ─── Singleton TronWeb instance ───────────────────────────────────────────────
// Fix #4: previously each function called buildClient(), creating a new TronWeb
// instance per call. A single module-level instance is sufficient and cheaper.
// Credentials are read once at module load time (same as before).
let _client: TronWeb | null = null;

function getClient(): TronWeb {
  if (!_client) {
    _client = new TronWeb(FULL_HOST, FULL_HOST, FULL_HOST, PRIVATE_KEY || (undefined as any));
  }
  return _client;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converts raw TRC-20 integer amount to human-readable USDT */
function rawToUsdt(raw: bigint | string | number): number {
  return Number(BigInt(String(raw))) / 10 ** USDT_DECIMALS;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fix #2: Validates that a string is a legitimate TRON base58check address.
 * Call this before signing any transfer — an invalid address burns TRX fees
 * with no possibility of recovery.
 */
export function isValidAddress(address: string): boolean {
  try {
    return TronWeb.isAddress(address);
  } catch {
    return false;
  }
}

export interface HotWalletBalance {
  address:     string;
  usdtBalance: number;   // human-readable (6 decimals stripped)
  trxBalance:  number;   // TRX (for fee estimation)
  rawUsdt:     string;   // original integer string
}

/**
 * Returns the USDT TRC-20 and TRX balance of the platform hot wallet.
 * Does NOT require a private key.
 */
export async function getBalance(address?: string): Promise<HotWalletBalance> {
  const addr = address ?? PLATFORM_ADDRESS;
  if (!addr) throw new Error("PLATFORM_TRON_ADDRESS not configured");

  const tw = getClient();

  // TRX native balance (needed for fee headroom check)
  const trxRaw: number = await tw.trx.getBalance(addr);
  const trxBalance = trxRaw / 1_000_000;

  // USDT TRC-20 balance via contract call
  const contract = await tw.contract().at(USDT_CONTRACT);
  const rawUsdt: string = (await (contract as any).balanceOf(addr).call()).toString();
  const usdtBalance = rawToUsdt(rawUsdt);

  return { address: addr, usdtBalance, trxBalance, rawUsdt };
}

export interface TransferResult {
  txid:   string;
  /** Status immediately after broadcast. "broadcast" means accepted by the
   *  network — on-chain confirmation is asynchronous. Use getTransaction()
   *  to poll for the final "SUCCESS" | "FAILED" status. */
  status: "broadcast";
}

/**
 * Sends `amount` USDT TRC-20 to `toAddress`.
 * Requires PLATFORM_TRON_PRIVATE_KEY to be set.
 *
 * Fixes applied:
 *   #2 — validates toAddress with isValidAddress() before signing
 *   #3 — checks TRX balance covers the 40-TRX fee limit before broadcasting
 *   #7 — replaces meaningless `success: true` with a typed `status: "broadcast"`
 */
export async function transfer(
  toAddress: string,
  amount:    number,     // human-readable USDT (e.g. 100.5)
): Promise<TransferResult> {
  if (!PRIVATE_KEY) throw new Error("PLATFORM_TRON_PRIVATE_KEY not set — transfers disabled");

  // Fix #2: Validate TRON base58 address before touching the blockchain
  if (!isValidAddress(toAddress)) {
    throw new Error(`Invalid TRON address: "${toAddress}" — transfer aborted`);
  }

  // Fix #3: Ensure the hot wallet has enough TRX to cover the fee limit (40 TRX)
  const MIN_TRX_FOR_FEE = 40; // matches feeLimit below
  const bal = await getBalance(PLATFORM_ADDRESS);
  if (bal.trxBalance < MIN_TRX_FOR_FEE) {
    throw new Error(
      `Insufficient TRX for fees: wallet has ${bal.trxBalance.toFixed(2)} TRX, ` +
      `minimum required is ${MIN_TRX_FOR_FEE} TRX. Top up the hot wallet before dispersing.`
    );
  }

  const tw = getClient();
  const rawAmount = Math.floor(amount * 10 ** USDT_DECIMALS);

  const contract = await tw.contract().at(USDT_CONTRACT);
  const txid: string = await (contract as any).transfer(toAddress, rawAmount).send({
    feeLimit: 40_000_000, // 40 TRX max fee
  });

  // Fix #7: Return "broadcast" instead of a hardcoded `success: true`.
  // The TX is accepted by the network but not yet confirmed on-chain.
  // Callers should use getTransaction(txid) to verify final settlement.
  return { txid, status: "broadcast" };
}

export interface TronTransactionInfo {
  txid:        string;
  blockNumber: number | null;
  timestamp:   number | null;   // unix ms
  status:      "SUCCESS" | "FAILED" | "PENDING";
  fromAddress: string | null;
  toAddress:   string | null;
  usdtAmount:  number | null;
}

/**
 * Fetches on-chain transaction info for a given txid.
 * Use this to confirm a transfer() result has settled.
 */
export async function getTransaction(txid: string): Promise<TronTransactionInfo> {
  const tw = getClient();

  const [txInfo, txDetail] = await Promise.all([
    tw.trx.getTransactionInfo(txid),
    tw.trx.getTransaction(txid),
  ]);

  const blockNumber: number | null = (txInfo as any)?.blockNumber ?? null;
  const timestamp: number | null   = (txInfo as any)?.blockTimeStamp ?? null;

  let status: TronTransactionInfo["status"] = "PENDING";
  const receipt = (txInfo as any)?.receipt;
  if (receipt) {
    status = receipt.result === "SUCCESS" ? "SUCCESS" : "FAILED";
  } else if (blockNumber) {
    status = "SUCCESS";
  }

  // Parse TRC-20 transfer log for amount / addresses
  let fromAddress: string | null = null;
  let toAddress:   string | null = null;
  let usdtAmount:  number | null = null;

  try {
    const log = (txInfo as any)?.log?.[0];
    if (log) {
      // topics[1] = from (padded), topics[2] = to (padded), data = amount
      const rawFrom = log.topics?.[1];
      const rawTo   = log.topics?.[2];
      const rawData = log.data;
      if (rawFrom) fromAddress = TronWeb.address.fromHex("41" + rawFrom.slice(-40));
      if (rawTo)   toAddress   = TronWeb.address.fromHex("41" + rawTo.slice(-40));
      if (rawData) usdtAmount  = rawToUsdt(BigInt("0x" + rawData));
    }
  } catch {
    // fallback: derive from raw contract input
    const raw = (txDetail as any)?.raw_data?.contract?.[0]?.parameter?.value;
    if (raw?.owner_address) {
      fromAddress = TronWeb.address.fromHex(raw.owner_address);
    }
  }

  return { txid, blockNumber, timestamp, status, fromAddress, toAddress, usdtAmount };
}

/** Expose config for informational endpoints (never the private key) */
export function platformWalletInfo() {
  return {
    address:    PLATFORM_ADDRESS || "(not configured)",
    network:    "TRON (TRC-20)",
    token:      "USDT",
    contract:   USDT_CONTRACT,
    configured: Boolean(PLATFORM_ADDRESS && PRIVATE_KEY),
  };
}
