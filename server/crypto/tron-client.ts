/**
 * Banxico Plus LLC — TRON / TRC-20 USDT Hot Wallet Client
 *
 * Wraps TronWeb v6 for:
 *   getBalance()     → USDT + TRX balance of platform hot wallet
 *   getTransaction() → fetch on-chain transaction detail
 *   getNodeHealth()  → verify RPC head/latency without signing
 *   isValidAddress() → validate a base58 TRON address before signing
 *
 * Environment variables:
 *   PLATFORM_TRON_ADDRESS      — base58 public address    (used as default owner)
 *   TRON_FULL_HOST             — explicit private corporate-node URL
 *   TRON_APPROVED_NODE_ORIGIN  — independently approved exact origin
 */

import { TronWeb } from "tronweb";
import { approvedPrivateTronNodeConfiguration } from "./tron-policy";
import {
  configuredTronNetwork,
  tronChainIdentityMatches,
} from "./tron-network";

// ─── Configuration ────────────────────────────────────────────────────────────

const FULL_HOST        = process.env.TRON_FULL_HOST?.trim()    ?? "";
const PLATFORM_ADDRESS = process.env.PLATFORM_TRON_ADDRESS     ?? "";
const NODE_TIMEOUT_MS   = Number(process.env.TRON_NODE_TIMEOUT_MS ?? 8_000);
const NETWORK_PROFILE   = configuredTronNetwork();

export const TRON_NETWORK = NETWORK_PROFILE.network;
export const USDT_CONTRACT = NETWORK_PROFILE.usdtContract;

/** Decimals for USDT TRC-20 */
const USDT_DECIMALS = 6;

// ─── Singleton TronWeb instance ───────────────────────────────────────────────
// Fix #4: previously each function called buildClient(), creating a new TronWeb
// instance per call. A single module-level instance is sufficient and cheaper.
// Credentials are read once at module load time (same as before).
let _client: TronWeb | null = null;

function getClient(): TronWeb {
  const node = approvedPrivateTronNodeConfiguration();
  if (!node.configured || !FULL_HOST) {
    throw new Error("Approved private TRON FullNode is not configured");
  }
  if (!_client) {
    // Read-only client: the Banxico Plus process must never receive the hot
    // wallet private key. Signing is delegated to tron-signer-client.ts.
    _client = new TronWeb({ fullHost: FULL_HOST });
  }
  return _client;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converts raw TRC-20 integer amount to human-readable USDT */
function rawToUsdt(raw: bigint | string | number): number {
  return Number(BigInt(String(raw))) / 10 ** USDT_DECIMALS;
}

async function withTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`TRON node timeout during ${operation}`)),
          NODE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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

export interface TronNodeHealth {
  healthy: boolean;
  network: typeof TRON_NETWORK;
  endpoint: string;
  latencyMs: number;
  blockNumber: number | null;
  blockTimestamp: number | null;
  headAgeMs: number | null;
  activePeers: number | null;
  genesisBlockId: string | null;
  expectedGenesisBlockId: string;
  chainIdentityMatches: boolean;
  checkedAt: string;
}

export function isHealthyTronHead(
  blockNumber: number | null,
  headAgeMs: number | null,
  activePeers: number | null,
  maxHeadAgeMs: number,
  minActivePeers: number,
): boolean {
  return Boolean(
    blockNumber
    && blockNumber > 0
    && headAgeMs !== null
    && headAgeMs <= maxHeadAgeMs
    && activePeers !== null
    && activePeers >= minActivePeers
  );
}

/** Read-only health probe. Process availability alone is not considered healthy:
 * the head block must also be recent. */
export async function getNodeHealth(): Promise<TronNodeHealth> {
  const started = Date.now();
  const tw = getClient();
  const [block, nodeInfo, genesisBlock] = await withTimeout(
    Promise.all([
      tw.trx.getCurrentBlock(),
      tw.trx.getNodeInfo(),
      tw.trx.getBlockByNumber(0),
    ]),
    "health check",
  );
  const header = (block as any)?.block_header?.raw_data;
  const blockNumber = Number.isFinite(Number(header?.number)) ? Number(header.number) : null;
  const blockTimestamp = Number.isFinite(Number(header?.timestamp)) ? Number(header.timestamp) : null;
  const headAgeMs = blockTimestamp ? Math.max(0, Date.now() - blockTimestamp) : null;
  const activePeersRaw = (nodeInfo as any)?.activeConnectCount;
  const activePeers = Number.isFinite(Number(activePeersRaw)) ? Number(activePeersRaw) : null;
  const genesisBlockId = typeof (genesisBlock as any)?.blockID === "string"
    ? (genesisBlock as any).blockID
    : null;
  const chainIdentityMatches = tronChainIdentityMatches(genesisBlockId);
  const maxHeadAgeMs = Number(process.env.TRON_NODE_MAX_HEAD_AGE_MS ?? 180_000);
  const minActivePeers = Number(process.env.TRON_NODE_MIN_ACTIVE_PEERS ?? 3);
  return {
    healthy: chainIdentityMatches
      && isHealthyTronHead(
        blockNumber,
        headAgeMs,
        activePeers,
        maxHeadAgeMs,
        minActivePeers,
      ),
    network: TRON_NETWORK,
    endpoint: safeNodeEndpoint(),
    latencyMs: Date.now() - started,
    blockNumber,
    blockTimestamp,
    headAgeMs,
    activePeers,
    genesisBlockId,
    expectedGenesisBlockId: NETWORK_PROFILE.genesisBlockId,
    chainIdentityMatches,
    checkedAt: new Date().toISOString(),
  };
}

function safeNodeEndpoint(): string {
  return approvedPrivateTronNodeConfiguration().endpoint ?? "(approved private node not configured)";
}

export interface TronTransactionInfo {
  txid:        string;
  blockNumber: number | null;
  timestamp:   number | null;   // unix ms
  status:      "SUCCESS" | "FAILED" | "PENDING";
  fromAddress: string | null;
  toAddress:   string | null;
  usdtAmount:  number | null;
  usdtAtomicAmount: string | null;
  contractAddress: string | null;
}

const TRANSFER_EVENT_TOPIC = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export interface DecodedUsdtTransfer {
  fromAddress: string;
  toAddress: string;
  atomicAmount: string;
  contractAddress: string;
}

export function decodeUsdtTransferLog(logs: any[]): DecodedUsdtTransfer | null {
  for (const candidate of logs ?? []) {
    try {
      const topics = candidate?.topics ?? [];
      const topic0 = String(topics[0] ?? "").replace(/^0x/, "").toLowerCase();
      const contractHex = String(candidate?.address ?? "").replace(/^0x/, "");
      const contractAddress = TronWeb.address.fromHex("41" + contractHex.slice(-40));
      if (topic0 !== TRANSFER_EVENT_TOPIC || contractAddress !== USDT_CONTRACT) continue;
      const fromHex = String(topics[1] ?? "").replace(/^0x/, "");
      const toHex = String(topics[2] ?? "").replace(/^0x/, "");
      const dataHex = String(candidate?.data ?? "").replace(/^0x/, "");
      if (!fromHex || !toHex || !dataHex) return null;
      return {
        fromAddress: TronWeb.address.fromHex("41" + fromHex.slice(-40)),
        toAddress: TronWeb.address.fromHex("41" + toHex.slice(-40)),
        atomicAmount: BigInt("0x" + dataHex).toString(),
        contractAddress,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export function transactionExecutionStatus(txInfo: any): TronTransactionInfo["status"] {
  const result = txInfo?.receipt?.result;
  if (result === "SUCCESS") return "SUCCESS";
  if (typeof result === "string" && result.length > 0) return "FAILED";
  return "PENDING";
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

  const status = transactionExecutionStatus(txInfo);

  // Parse TRC-20 transfer log for amount / addresses
  let fromAddress: string | null = null;
  let toAddress:   string | null = null;
  let usdtAmount:  number | null = null;
  let usdtAtomicAmount: string | null = null;
  let contractAddress: string | null = null;

  try {
    const transfer = decodeUsdtTransferLog((txInfo as any)?.log ?? []);
    if (transfer) {
      fromAddress = transfer.fromAddress;
      toAddress = transfer.toAddress;
      contractAddress = transfer.contractAddress;
      usdtAtomicAmount = transfer.atomicAmount;
      usdtAmount = rawToUsdt(transfer.atomicAmount);
    }
  } catch {
    // fallback: derive from raw contract input
    const raw = (txDetail as any)?.raw_data?.contract?.[0]?.parameter?.value;
    if (raw?.owner_address) {
      fromAddress = TronWeb.address.fromHex(raw.owner_address);
    }
  }

  return {
    txid,
    blockNumber,
    timestamp,
    status,
    fromAddress,
    toAddress,
    usdtAmount,
    usdtAtomicAmount,
    contractAddress,
  };
}

/** Expose config for informational endpoints (never the private key) */
export function platformWalletInfo() {
  const node = approvedPrivateTronNodeConfiguration();
  return {
    address:    PLATFORM_ADDRESS || "(not configured)",
    network:    NETWORK_PROFILE.label,
    networkId:  TRON_NETWORK,
    token:      "USDT",
    contract:   USDT_CONTRACT,
    configured: Boolean(PLATFORM_ADDRESS),
    nodeApproved: node.configured,
    signing:    "remote-only",
    nodeEndpoint: node.endpoint,
  };
}
