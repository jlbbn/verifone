export type TronNetwork = "mainnet" | "nile";

export interface TronNetworkProfile {
  network: TronNetwork;
  label: string;
  usdtContract: string;
  genesisBlockId: string;
}

const TRON_NETWORK_PROFILES: Record<TronNetwork, TronNetworkProfile> = {
  mainnet: {
    network: "mainnet",
    label: "TRON Mainnet (TRC-20)",
    usdtContract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    genesisBlockId: "00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc",
  },
  nile: {
    network: "nile",
    label: "TRON Nile Testnet (TRC-20)",
    usdtContract: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    genesisBlockId: "0000000000000000d698d4192c56cb6be724a558448e2684802de4d6cd8690dc",
  },
};

/**
 * Selects one complete TRON profile. Mainnet remains the compatibility default,
 * while unknown values fail at startup instead of mixing network identifiers
 * and token contracts.
 */
export function configuredTronNetwork(
  env: NodeJS.ProcessEnv = process.env,
): TronNetworkProfile {
  const requested = env.TRON_NETWORK?.trim().toLowerCase() || "mainnet";
  if (requested !== "mainnet" && requested !== "nile") {
    throw new Error("TRON_NETWORK must be exactly 'mainnet' or 'nile'");
  }
  return TRON_NETWORK_PROFILES[requested];
}

export function tronChainIdentityMatches(
  genesisBlockId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return genesisBlockId === configuredTronNetwork(env).genesisBlockId;
}