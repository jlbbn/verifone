const USDT_DECIMALS = 6;

export interface ParsedUsdtAmount {
  normalized: string;
  atomic: string;
  numeric: number;
}

/** Parse a human-readable USDT amount without floating-point rounding. */
export function parseUsdtAmount(value: string | number): ParsedUsdtAmount {
  const text = typeof value === "number" ? String(value) : value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(text)) {
    throw new Error("Monto USDT inválido: use hasta 6 decimales");
  }
  const [whole, fraction = ""] = text.split(".");
  const atomic = (BigInt(whole) * 10n ** BigInt(USDT_DECIMALS)
    + BigInt(fraction.padEnd(USDT_DECIMALS, "0"))).toString();
  if (atomic === "0") throw new Error("El monto USDT debe ser mayor que cero");
  const normalizedFraction = fraction.replace(/0+$/, "");
  const normalized = normalizedFraction ? `${whole}.${normalizedFraction}` : whole;
  return { normalized, atomic, numeric: Number(normalized) };
}

export function tronWalletWritesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TRON_WALLET_WRITES_ENABLED?.trim().toLowerCase() === "true";
}

/** Rollout guard: an app process that still receives the legacy key may read
 * balances, but it can never ask the remote signer to write. */
export function legacyLocalSigningKeyPresent(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.PLATFORM_TRON_PRIVATE_KEY?.trim());
}

export function configuredDailyLimit(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env.TRON_DAILY_LIMIT_USDT?.trim();
  if (!raw) return null;
  try {
    return parseUsdtAmount(raw).numeric;
  } catch {
    return null;
  }
}

/** Unlike the display helper above, this throws on malformed configured values
 * so a write path cannot silently fall back to a less restrictive limit. */
export function configuredDailyLimitAmount(
  env: NodeJS.ProcessEnv = process.env,
): ParsedUsdtAmount | null {
  const raw = env.TRON_DAILY_LIMIT_USDT?.trim();
  return raw ? parseUsdtAmount(raw) : null;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    // Tailscale CGNAT range (100.64.0.0/10) — used when the app and the node
    // no longer share a cloud VPC and are joined by a private Tailscale mesh.
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

/** Write-capable TRON paths require an explicit private node and a separately
 * approved origin. There is deliberately no public/default fallback. */
export function approvedPrivateTronNodeConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const rawNode = env.TRON_FULL_HOST?.trim();
  const rawApproved = env.TRON_APPROVED_NODE_ORIGIN?.trim();
  try {
    if (!rawNode || !rawApproved) throw new Error("missing");
    const node = new URL(rawNode);
    const approved = new URL(rawApproved);
    const protocolAllowed = node.protocol === "https:" || node.protocol === "http:";
    const configured = protocolAllowed
      && isPrivateIpv4(node.hostname)
      && node.origin === approved.origin
      && node.pathname === "/"
      && !node.search
      && !node.hash
      && approved.pathname === "/"
      && !approved.search
      && !approved.hash;
    return { configured, endpoint: configured ? node.origin : null };
  } catch {
    return { configured: false, endpoint: null };
  }
}