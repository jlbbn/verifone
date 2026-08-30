/**
 * Núcleo compartido de dispersión de USDT desde la hot wallet TRON.
 *
 * Extraído de POST /api/admin/hot-wallet/disperse para que las dispersiones
 * administrativas directas y las aprobaciones de retiro de usuario pasen por
 * exactamente la misma cascada de candados (flag de escritura, ausencia de
 * llave local, salud de nodo+firmador con verificación de identidad exacta,
 * límite por operación, reserva transaccional del límite diario con
 * pg_advisory_xact_lock, e idempotencia). Nunca dupliques esta lógica.
 *
 * La autenticación (contraseña del admin) y la validación de payload deben
 * resolverse en el llamador ANTES de invocar esta función — aquí solo vive
 * la lógica de negocio de la dispersión en sí.
 */
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { hotWalletDispersions } from "@shared/schema";
import { storage } from "../storage";
import * as TronClient from "./tron-client.js";
import * as TronSigner from "./tron-signer-client.js";
import {
  configuredDailyLimitAmount,
  legacyLocalSigningKeyPresent,
  parseUsdtAmount,
  tronWalletWritesEnabled,
} from "./tron-policy.js";

export interface DispersionInput {
  adminId: string;
  toAddress: string;
  amountUsdt: string | number;
  note?: string | null;
  idempotencyKey: string;
  withdrawalRequestId?: number;
}

export interface DispersionOutcome {
  status: number;
  body: Record<string, unknown>;
}

export async function executeHotWalletDispersion(input: DispersionInput): Promise<DispersionOutcome> {
  // Fail closed: provisioning a key or signer is insufficient by itself.
  // Both the app and the isolated signer have independent write gates.
  if (!tronWalletWritesEnabled()) {
    return { status: 503, body: { error: "Dispersiones TRON desactivadas por política", code: "TRON_WRITES_DISABLED" } };
  }
  if (legacyLocalSigningKeyPresent()) {
    return {
      status: 503,
      body: { error: "Configuración TRON ambigua: retire la llave local antes de habilitar el firmador remoto", code: "LEGACY_LOCAL_SIGNING_KEY_PRESENT" },
    };
  }
  if (!TronSigner.signerConfiguration().configured) {
    return { status: 503, body: { error: "Firmador TRON aislado no configurado", code: "TRON_SIGNER_UNAVAILABLE" } };
  }

  let amount;
  try { amount = parseUsdtAmount(input.amountUsdt); }
  catch (err) {
    return { status: 400, body: { error: (err as Error).message, code: "INVALID_USDT_AMOUNT" } };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(input.idempotencyKey)) {
    return { status: 400, body: { error: "Falta una clave de idempotencia válida", code: "INVALID_IDEMPOTENCY_KEY" } };
  }

  if (!TronClient.isValidAddress(input.toAddress)) {
    return { status: 400, body: { error: "Dirección TRON inválida — debe ser una dirección base58 válida (empieza con 'T')", code: "INVALID_TRON_ADDRESS" } };
  }

  const settings = await storage.getSettings();
  const maxUsdt = settings.maxDispersalUsdt ?? 5000;
  let maxPerTransactionAtomic: bigint;
  try {
    maxPerTransactionAtomic = BigInt(parseUsdtAmount(String(maxUsdt)).atomic);
  } catch {
    return { status: 503, body: { error: "Límite por operación TRON inválido; dispersiones bloqueadas", code: "INVALID_TRON_PER_TX_LIMIT" } };
  }
  if (BigInt(amount.atomic) > maxPerTransactionAtomic) {
    return {
      status: 400,
      body: {
        error: `El monto excede el límite máximo configurado de $${maxUsdt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT por operación.`,
        code: "EXCEEDS_MAX_DISPERSAL",
        maxUsdt,
      },
    };
  }

  const info = TronClient.platformWalletInfo();
  if (!info.configured) {
    return { status: 503, body: { error: "Hot wallet no configurada" } };
  }
  if (!info.nodeApproved || !info.nodeEndpoint) {
    return { status: 503, body: { error: "Nodo TRON corporativo privado no configurado o no aprobado", code: "TRON_PRIVATE_NODE_NOT_APPROVED" } };
  }

  let nodeHealth;
  let signerHealth;
  try {
    [nodeHealth, signerHealth] = await Promise.all([
      TronClient.getNodeHealth(),
      TronSigner.getSignerHealth(),
    ]);
  } catch {
    return { status: 503, body: { error: "Infraestructura TRON no disponible; firma bloqueada", code: "TRON_INFRASTRUCTURE_UNHEALTHY" } };
  }
  if (!nodeHealth.healthy || !signerHealth.healthy || !signerHealth.writesEnabled) {
    return { status: 503, body: { error: "Nodo o firmador TRON no está listo para escrituras", code: "TRON_INFRASTRUCTURE_UNHEALTHY" } };
  }
  if (!TronSigner.signerProfileMatches(signerHealth)) {
    return { status: 503, body: { error: "El perfil de red o contrato del firmador no coincide con la aplicación", code: "TRON_SIGNER_PROFILE_MISMATCH" } };
  }
  if (signerHealth.address !== info.address) {
    return { status: 503, body: { error: "La identidad del firmador no coincide con la hot wallet configurada", code: "TRON_SIGNER_WALLET_MISMATCH" } };
  }
  if (signerHealth.nodeEndpoint !== info.nodeEndpoint) {
    return { status: 503, body: { error: "El firmador no está conectado al nodo TRON aprobado", code: "TRON_SIGNER_NODE_MISMATCH" } };
  }

  const balance = await TronClient.getBalance();
  const minTrxReserve = Number(settings.minTrxReserve ?? 40);
  if (balance.trxBalance < minTrxReserve) {
    return { status: 503, body: { error: `Saldo TRX insuficiente: se requieren al menos ${minTrxReserve} TRX`, code: "INSUFFICIENT_TRX_RESERVE" } };
  }

  let envDailyAmount;
  let settingsDailyAmount;
  try {
    envDailyAmount = configuredDailyLimitAmount();
    const settingsDaily = Number(settings.maxDailyDispersalUsdt ?? 0);
    settingsDailyAmount = settingsDaily > 0
      ? parseUsdtAmount(String(settings.maxDailyDispersalUsdt))
      : null;
  } catch {
    return { status: 503, body: { error: "Límite diario TRON inválido; dispersiones bloqueadas", code: "INVALID_TRON_DAILY_LIMIT" } };
  }
  const dailyAtomicCandidates = [envDailyAmount, settingsDailyAmount]
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .map((value) => BigInt(value.atomic));
  if (dailyAtomicCandidates.length === 0) {
    return { status: 503, body: { error: "Límite diario TRON no configurado; dispersiones bloqueadas", code: "TRON_DAILY_LIMIT_DISABLED" } };
  }
  const maxDailyAtomic = dailyAtomicCandidates.reduce(
    (lowest, current) => current < lowest ? current : lowest,
  );
  const maxDailyUsdt = Number(maxDailyAtomic) / 1_000_000;

  // Reserve the daily allowance transactionally. pg_advisory_xact_lock makes
  // concurrent requests serialize before reading the aggregate.
  const reservation = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('banxico-plus-tron-daily-limit'))`);
    const existingResult = await tx.execute(sql`
      SELECT * FROM hot_wallet_dispersions
      WHERE idempotency_key = ${input.idempotencyKey}
        AND network = ${TronClient.TRON_NETWORK}
      LIMIT 1
    `);
    const existing = (existingResult.rows?.[0] ?? null) as any;
    if (existing) return { duplicate: true as const, row: existing };

    const sumResult = await tx.execute(sql`
      SELECT COALESCE(SUM(amount_usdt * 1000000), 0)::text AS total_atomic
      FROM hot_wallet_dispersions
      WHERE network = ${TronClient.TRON_NETWORK}
        AND status IN ('pending', 'uncertain', 'broadcast', 'confirmed')
        AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
    `);
    const usedTodayAtomic = BigInt((sumResult.rows?.[0] as any)?.total_atomic ?? "0");
    if (usedTodayAtomic + BigInt(amount.atomic) > maxDailyAtomic) {
      return { limitExceeded: true as const, usedTodayAtomic };
    }

    const [row] = await tx.insert(hotWalletDispersions).values({
      adminId: input.adminId,
      toAddress: input.toAddress,
      amountUsdt: amount.normalized,
      status: "pending",
      note: input.note ?? null,
      idempotencyKey: input.idempotencyKey,
      expectedAtomicAmount: amount.atomic,
      expectedContract: TronClient.USDT_CONTRACT,
      network: TronClient.TRON_NETWORK,
      withdrawalRequestId: input.withdrawalRequestId ?? null,
      updatedAt: new Date(),
    }).returning();
    return { duplicate: false as const, row };
  });

  if ("limitExceeded" in reservation) {
    return {
      status: 400,
      body: {
        error: "La operación excede el límite diario de la hot wallet",
        code: "EXCEEDS_DAILY_DISPERSAL",
        maxDailyUsdt,
        usedToday: Number(reservation.usedTodayAtomic) / 1_000_000,
      },
    };
  }
  if (reservation.duplicate) {
    if (!reservation.row.txid && ["pending", "uncertain"].includes(reservation.row.status)) {
      try {
        const remote = await TronSigner.getTransferStatus(input.idempotencyKey);
        if (remote.status === "broadcast" && remote.txid) {
          await db.update(hotWalletDispersions)
            .set({
              txid: remote.txid,
              signerRequestId: remote.requestId,
              status: "broadcast",
              failureCode: null,
              updatedAt: new Date(),
            })
            .where(eq(hotWalletDispersions.id, reservation.row.id));
          return {
            status: 200,
            body: { success: true, duplicate: true, reconciled: true, id: reservation.row.id, txid: remote.txid, status: "broadcast" },
          };
        }
      } catch {
        // Fail closed. A missing/ambiguous remote result must be investigated;
        // it must never trigger a second signature with a new key.
      }
    }
    return {
      status: 200,
      body: {
        success: reservation.row.status === "broadcast" || reservation.row.status === "confirmed",
        duplicate: true,
        id: reservation.row.id,
        txid: reservation.row.txid,
        status: reservation.row.status,
      },
    };
  }
  const row = reservation.row;

  try {
    const result = await TronSigner.requestTransfer({
      idempotencyKey: input.idempotencyKey,
      toAddress: input.toAddress,
      amountAtomic: amount.atomic,
    });

    // Status is "broadcast" — the TX was accepted by the TRON network but
    // on-chain confirmation is asynchronous. Poll getTransaction(txid) to
    // verify final "SUCCESS" | "FAILED" settlement before treating as confirmed.
    await db.update(hotWalletDispersions)
      .set({ txid: result.txid, signerRequestId: result.requestId, status: "broadcast", updatedAt: new Date() })
      .where(eq(hotWalletDispersions.id, row.id));

    return { status: 200, body: { success: true, txid: result.txid, id: row.id, status: "broadcast" } };
  } catch (err: any) {
    await db.update(hotWalletDispersions)
      .set({ status: "uncertain", failureCode: "SIGNER_RESULT_UNKNOWN", updatedAt: new Date() })
      .where(eq(hotWalletDispersions.id, row.id));
    // id + status are included even on failure so callers (e.g. withdrawal
    // approval) can link the withdrawal to this dispersion row instead of
    // treating "no funds moved" — an uncertain signer result must never be
    // silently reverted/refunded.
    return { status: 500, body: { error: err.message, id: row.id, status: "uncertain" } };
  }
}
