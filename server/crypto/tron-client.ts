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
 *   TRONGRID_API_KEY           — TronGrid API key, used ONLY as a read-only
 *                                external confirmation source for tx lookups
 *                                (our self-hosted lite fullnode permanently
 *                                closes wallet/gettransactioninfobyid — see
 *                                .agents/memory/tron-lite-node-api-limits.md).
 *                                Never used for signing or balance checks.
 *   TRONSCAN_API_KEY           — Tronscan API key, used ONLY as a read-only
 *                                backup confirmation source when TronGrid
 *                                fails or is unreachable. Same restriction:
 *                                never used for signing or balance checks.
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
const TRONGRID_API_KEY  = process.env.TRONGRID_API_KEY?.trim() ?? "";
const TRONSCAN_API_KEY  = process.env.TRONSCAN_API_KEY?.trim() ?? "";

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

// ─── TronGrid external confirmation client ─────────────────────────────────
// Our self-hosted lite fullnode permanently closes wallet/gettransactioninfobyid
// and wallet/gettransactionbyid ("this API is closed because this node is a
// lite fullnode") — not a timing issue, retrying never helps. TronGrid is used
// here strictly as a public, read-only confirmation source for transaction
// lookups (data that is independently verifiable on-chain). It is never used
// for signing, balance checks, or anything requiring the private node policy.

function trongridHost(): string {
  return TRON_NETWORK === "nile" ? "https://nile.trongrid.io" : "https://api.trongrid.io";
}

export function trongridConfigured(): boolean {
  return Boolean(TRONGRID_API_KEY);
}

export function tronscanConfigured(): boolean {
  return Boolean(TRONSCAN_API_KEY);
}

function tronscanHost(): string {
  return TRON_NETWORK === "nile"
    ? "https://nileapi.tronscan.org"
    : "https://apilist.tronscanapi.com";
}

/**
 * Fetches raw transaction info from Tronscan's public REST API. Used strictly
 * as a backup read-only confirmation source when TronGrid is unavailable —
 * never for signing or balance checks. Shape differs from TronWeb's
 * trx.getTransactionInfo()/getTransaction(), so callers must normalize it
 * (see getTransaction()'s tronscan branch) rather than treat it as a TronWeb
 * result.
 */
async function fetchTronscanTransactionInfo(txid: string): Promise<any> {
  if (!TRONSCAN_API_KEY) {
    throw new Error("TRONSCAN_API_KEY is not configured");
  }
  const res = await fetch(
    `${tronscanHost()}/api/transaction-info?hash=${encodeURIComponent(txid)}`,
    { headers: { "TRON-PRO-API-KEY": TRONSCAN_API_KEY } },
  );
  if (!res.ok) {
    throw new Error(`Tronscan API responded ${res.status}`);
  }
  const data = await res.json();
  if (!data || Object.keys(data).length === 0) {
    throw new Error("Tronscan returned no data for transaction");
  }
  return data;
}

let _trongridClient: TronWeb | null = null;

function getTrongridClient(): TronWeb {
  if (!TRONGRID_API_KEY) {
    throw new Error("TRONGRID_API_KEY is not configured");
  }
  if (!_trongridClient) {
    _trongridClient = new TronWeb({
      fullHost: trongridHost(),
      headers: { "TRON-PRO-API-KEY": TRONGRID_API_KEY },
    });
  }
  return _trongridClient;
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

// ─── Extended node diagnostics panel (admin-only) ──────────────────────────
// Backs the "Estado de la red TRON" admin panel. Separate from
// getNodeHealth() above (used by the writes-readiness gate and the
// lower-detail user-facing status) because this needs more fields, a
// stricter 5s timeout, and its own 10s cache so admins opening the panel
// don't hammer the node every render.

/** Pinned to the exact java-tron release running on the node
 * (tronprotocol/java-tron digest sha256:9db63abdb977830c7d2d56a3c96c3e5506a21d560d54f6c523871dcdc11abf34,
 * GreatVoyage-v4.8.2.1). Update this whenever the node's image is updated. */
export const EXPECTED_TRON_VERSION = "4.8.2.1";

/** True if a reported codeVersion is compatible with EXPECTED_TRON_VERSION.
 * Checked in both directions because java-tron's own `codeVersion` field is
 * sometimes reported with fewer version segments than the release tag (e.g.
 * "4.8.2" for a "GreatVoyage-v4.8.2.1" build) — a strict equality check
 * would falsely alarm on a node that is actually running the pinned image.
 * A genuinely different release (different major/minor/patch) still fails
 * both directions. */
export function tronVersionMatchesExpected(reported: string | null): boolean {
  if (!reported) return false;
  const a = reported.trim();
  const b = EXPECTED_TRON_VERSION;
  return a.startsWith(b) || b.startsWith(a);
}

/** Parses java-tron's "Num:12345,ID:abcd..." block-reference strings
 * (returned by getnodeinfo's `block` and `solidityBlock` fields) into just
 * the block number. */
function parseNodeInfoBlockNum(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const match = raw.match(/Num:(\d+)/);
  return match ? Number(match[1]) : null;
}

export type TronSyncState = "sincronizado" | "sincronizando" | "desconocido";
export type TronNetworkSemaphore = "verde" | "amarillo" | "rojo";

export interface TronNodeDiagnostics {
  status: "no_configurado" | "configurado_pero_inalcanzable" | "ok";
  network: typeof TRON_NETWORK;
  nodeVersion: string | null;
  versionMatchesExpected: boolean;
  expectedVersion: string;
  peers: { active: number | null; passive: number | null; total: number | null };
  sync: {
    beginSyncNum: number | null;
    block: number | null;
    solidityBlock: number | null;
    state: TronSyncState;
  };
  head: { blockNumber: number | null; blockTimestamp: number | null; ageSeconds: number | null };
  networkComparison: {
    tronGridBlock: number;
    blockDiff: number;
    semaphore: TronNetworkSemaphore;
  } | null;
  latencyMs: number | null;
  checkedAt: string;
  error?: string;
}

const NODE_PANEL_TIMEOUT_MS = 5_000;
const NODE_PANEL_CACHE_MS = 10_000;

/** A block is considered current if younger than this. TRON produces a block
 * every ~3s, so 60s of headroom comfortably covers normal network jitter
 * without flagging a healthy node as "still syncing". solidityBlock is
 * intentionally NOT used for this — by design it trails ~20 blocks behind
 * the head for finality, which is normal and unrelated to sync progress. */
const SYNCED_MAX_HEAD_AGE_SECONDS = 60;

/** Our node running slightly ahead of TronGrid's own head is normal (the
 * public API lags a few blocks behind actual network heads), so small
 * negative differences are not an alarm. */
const NETWORK_DIFF_GREEN_MIN = -10;
const NETWORK_DIFF_YELLOW_MAX = 100;
const NETWORK_DIFF_GREEN_MAX = 5;

function classifyNetworkDiff(blockDiff: number): TronNetworkSemaphore {
  if (blockDiff >= NETWORK_DIFF_YELLOW_MAX) return "rojo";
  if (blockDiff >= NETWORK_DIFF_GREEN_MAX) return "amarillo";
  if (blockDiff >= NETWORK_DIFF_GREEN_MIN) return "verde";
  // More than 10 blocks ahead of TronGrid is unusual enough to flag, even
  // though it isn't the "falling behind" case the red/yellow bands target.
  return "amarillo";
}

async function withPanelTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`TRON node timeout during ${operation}`)),
          NODE_PANEL_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** TronGrid's public getnowblock — no API key required for this read, used
 * strictly as an external reference point to compare our node's head
 * against, never for signing or balance checks. Failure here degrades the
 * panel (networkComparison: null) rather than failing the whole request. */
async function fetchTronGridCurrentBlock(): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NODE_PANEL_TIMEOUT_MS);
  try {
    const res = await fetch(`${trongridHost()}/wallet/getnowblock`, {
      method: "POST",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`TronGrid responded ${res.status}`);
    const data = await res.json();
    const blockNumber = Number(data?.block_header?.raw_data?.number);
    if (!Number.isFinite(blockNumber)) throw new Error("TronGrid returned no block number");
    return blockNumber;
  } finally {
    clearTimeout(timer);
  }
}

async function computeNodeDiagnostics(): Promise<TronNodeDiagnostics> {
  const node = approvedPrivateTronNodeConfiguration();
  if (!node.configured) {
    return {
      status: "no_configurado",
      network: TRON_NETWORK,
      nodeVersion: null,
      versionMatchesExpected: false,
      expectedVersion: EXPECTED_TRON_VERSION,
      peers: { active: null, passive: null, total: null },
      sync: { beginSyncNum: null, block: null, solidityBlock: null, state: "desconocido" },
      head: { blockNumber: null, blockTimestamp: null, ageSeconds: null },
      networkComparison: null,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
    };
  }

  const started = Date.now();
  try {
    const tw = getClient();
    const [block, nodeInfo] = await withPanelTimeout(
      Promise.all([tw.trx.getCurrentBlock(), tw.trx.getNodeInfo()]),
      "node panel diagnostics",
    );
    const latencyMs = Date.now() - started;

    const header = (block as any)?.block_header?.raw_data;
    const blockNumber = Number.isFinite(Number(header?.number)) ? Number(header.number) : null;
    const blockTimestamp = Number.isFinite(Number(header?.timestamp)) ? Number(header.timestamp) : null;
    const ageSeconds = blockTimestamp ? Math.max(0, (Date.now() - blockTimestamp) / 1000) : null;

    const nodeVersion: string | null = (nodeInfo as any)?.configNodeInfo?.codeVersion ?? null;
    const active = Number.isFinite(Number((nodeInfo as any)?.activeConnectCount))
      ? Number((nodeInfo as any).activeConnectCount) : null;
    const passive = Number.isFinite(Number((nodeInfo as any)?.passiveConnectCount))
      ? Number((nodeInfo as any).passiveConnectCount) : null;
    const total = active !== null && passive !== null ? active + passive : null;

    const beginSyncNum = Number.isFinite(Number((nodeInfo as any)?.beginSyncNum))
      ? Number((nodeInfo as any).beginSyncNum) : null;
    const solidityBlock = parseNodeInfoBlockNum((nodeInfo as any)?.solidityBlock);
    const infoBlock = parseNodeInfoBlockNum((nodeInfo as any)?.block) ?? blockNumber;

    const syncState: TronSyncState = ageSeconds === null
      ? "desconocido"
      : ageSeconds < SYNCED_MAX_HEAD_AGE_SECONDS ? "sincronizado" : "sincronizando";

    let networkComparison: TronNodeDiagnostics["networkComparison"] = null;
    if (blockNumber !== null) {
      try {
        const tronGridBlock = await fetchTronGridCurrentBlock();
        const blockDiff = tronGridBlock - blockNumber;
        networkComparison = { tronGridBlock, blockDiff, semaphore: classifyNetworkDiff(blockDiff) };
      } catch {
        networkComparison = null;
      }
    }

    return {
      status: "ok",
      network: TRON_NETWORK,
      nodeVersion,
      versionMatchesExpected: tronVersionMatchesExpected(nodeVersion),
      expectedVersion: EXPECTED_TRON_VERSION,
      peers: { active, passive, total },
      sync: { beginSyncNum, block: infoBlock, solidityBlock, state: syncState },
      head: { blockNumber, blockTimestamp, ageSeconds },
      networkComparison,
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status: "configurado_pero_inalcanzable",
      network: TRON_NETWORK,
      nodeVersion: null,
      versionMatchesExpected: false,
      expectedVersion: EXPECTED_TRON_VERSION,
      peers: { active: null, passive: null, total: null },
      sync: { beginSyncNum: null, block: null, solidityBlock: null, state: "desconocido" },
      head: { blockNumber: null, blockTimestamp: null, ageSeconds: null },
      networkComparison: null,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
      error: (err as Error).message,
    };
  }
}

let _panelCache: { data: TronNodeDiagnostics; expiresAt: number } | null = null;
let _panelInFlight: Promise<TronNodeDiagnostics> | null = null;

/** Cached (10s) + de-duplicated (concurrent callers share one in-flight
 * request) entry point for the admin node-panel endpoint. Never called from
 * the browser directly — only from the admin-only backend route. */
export async function getNodePanelDiagnostics(): Promise<TronNodeDiagnostics> {
  const now = Date.now();
  if (_panelCache && _panelCache.expiresAt > now) {
    return _panelCache.data;
  }
  if (_panelInFlight) {
    return _panelInFlight;
  }
  _panelInFlight = computeNodeDiagnostics().then((data) => {
    _panelCache = { data, expiresAt: Date.now() + NODE_PANEL_CACHE_MS };
    _panelInFlight = null;
    return data;
  }).catch((err) => {
    _panelInFlight = null;
    throw err;
  });
  return _panelInFlight;
}

/** Whether a private TRON node is even provisioned — distinct from whether
 * that node is currently healthy. Never exposes the host/IP itself. */
export function approvedNodeConfigured(): boolean {
  return approvedPrivateTronNodeConfiguration().configured;
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

/** Normalizes Tronscan's transaction-info payload into our common shape. */
function normalizeTronscanTransaction(txid: string, data: any): TronTransactionInfo {
  const blockNumber: number | null = data?.block ?? null;
  const timestamp: number | null = data?.timestamp ?? null;

  let status: TronTransactionInfo["status"] = "PENDING";
  if (data?.confirmed === true && data?.contractRet === "SUCCESS") {
    status = "SUCCESS";
  } else if (data?.confirmed === true && typeof data?.contractRet === "string") {
    status = "FAILED";
  }

  let fromAddress: string | null = null;
  let toAddress: string | null = null;
  let usdtAmount: number | null = null;
  let usdtAtomicAmount: string | null = null;
  let contractAddress: string | null = null;

  const transfer = Array.isArray(data?.trc20TransferInfo) ? data.trc20TransferInfo[0] : null;
  if (transfer) {
    fromAddress = transfer.from_address ?? transfer.from ?? null;
    toAddress = transfer.to_address ?? transfer.to ?? null;
    contractAddress = transfer.contract_address ?? null;
    usdtAtomicAmount = transfer.amount_str ?? transfer.amount ?? null;
    if (usdtAtomicAmount) {
      usdtAmount = rawToUsdt(usdtAtomicAmount);
    }
  } else {
    fromAddress = data?.ownerAddress ?? null;
    toAddress = data?.toAddress ?? null;
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

/**
 * Fetches on-chain transaction info for a given txid.
 * Use this to confirm a transfer() result has settled.
 *
 * Confirmation source order: TronGrid (primary) → Tronscan (backup, only if
 * TronGrid is unreachable or fails) → private node (last resort, matching
 * prior behavior for local/dev where neither external key is configured).
 * All three are strictly read-only lookups; none is ever used for signing.
 */
export async function getTransaction(txid: string): Promise<TronTransactionInfo> {
  if (trongridConfigured()) {
    try {
      return await getTransactionFromTronWeb(txid, getTrongridClient());
    } catch (err) {
      if (tronscanConfigured()) {
        try {
          const data = await fetchTronscanTransactionInfo(txid);
          return normalizeTronscanTransaction(txid, data);
        } catch {
          // Both external sources failed — surface the original TronGrid error.
          throw err;
        }
      }
      throw err;
    }
  }

  if (tronscanConfigured()) {
    return normalizeTronscanTransaction(txid, await fetchTronscanTransactionInfo(txid));
  }

  return getTransactionFromTronWeb(txid, getClient());
}

async function getTransactionFromTronWeb(txid: string, tw: TronWeb): Promise<TronTransactionInfo> {
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
    txConfirmationSource: trongridConfigured() ? "trongrid" : "private-node",
    txConfirmationBackup: tronscanConfigured() ? "tronscan" : "(not configured)",
  };
}
