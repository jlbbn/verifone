const PROFILES = Object.freeze({
  mainnet: Object.freeze({
    network: "mainnet",
    usdtContract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    p2pVersion: "11111",
    genesisBlockId: "00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc",
  }),
  nile: Object.freeze({
    network: "nile",
    usdtContract: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    p2pVersion: "201910292",
    genesisBlockId: "0000000000000000d698d4192c56cb6be724a558448e2684802de4d6cd8690dc",
  }),
});

export function configuredSignerNetwork(env = process.env) {
  const requested = String(env.TRON_NETWORK || "mainnet").trim().toLowerCase();
  if (requested !== "mainnet" && requested !== "nile") {
    throw new Error("TRON_NETWORK must be exactly 'mainnet' or 'nile'");
  }
  return PROFILES[requested];
}

export function validateSignerStateProfile(state, env = process.env) {
  const activeProfile = configuredSignerNetwork(env);
  const persistedProfile = configuredSignerNetwork({
    TRON_NETWORK: state?.network || "mainnet",
  });
  const persistedContract = state?.contract || persistedProfile.usdtContract;
  if (
    persistedProfile.network !== activeProfile.network
    || persistedContract !== activeProfile.usdtContract
  ) {
    throw new Error(
      "TRON signer state belongs to a different network profile; use a separate TRON_SIGNER_STATE_PATH",
    );
  }
  return {
    network: persistedProfile.network,
    contract: persistedContract,
  };
}

export function validateSignerStatePath(statePath, env = process.env) {
  const profile = configuredSignerNetwork(env);
  if (
    profile.network === "nile"
    && (
      statePath === "/var/lib/tron-signer/state.json"
      || !String(statePath).toLowerCase().includes("nile")
    )
  ) {
    throw new Error(
      "Nile requires an explicit profile-scoped TRON_SIGNER_STATE_PATH containing 'nile'",
    );
  }
  return statePath;
}

const LITE_NODE_CLOSED_PATTERN = /lite\s*fullnode/i;

export function classifyGenesisProbe(probe) {
  if (!probe || typeof probe !== "object") {
    return { genesisBlockId: null, status: "error" };
  }
  if (probe.ok) {
    const value = probe.value;
    const blockId = typeof value?.blockID === "string" && /^[0-9a-f]{64}$/i.test(value.blockID)
      ? value.blockID.toLowerCase()
      : null;
    if (blockId) {
      return { genesisBlockId: blockId, status: "ok" };
    }
    const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
    if (text && LITE_NODE_CLOSED_PATTERN.test(text)) {
      return { genesisBlockId: null, status: "closed_lite_node" };
    }
    return { genesisBlockId: null, status: "malformed" };
  }
  const message = String(probe.error?.message ?? probe.error ?? "");
  if (LITE_NODE_CLOSED_PATTERN.test(message)) {
    return { genesisBlockId: null, status: "closed_lite_node" };
  }
  return { genesisBlockId: null, status: "error" };
}

export function chainIdentityEvidence(observed, profile) {
  const genesisBlockId = typeof observed?.genesisBlockId === "string"
    && /^[0-9a-f]{64}$/i.test(observed.genesisBlockId)
    ? observed.genesisBlockId.toLowerCase()
    : null;
  if (genesisBlockId) {
    return { matches: genesisBlockId === profile.genesisBlockId, method: "genesisBlockId" };
  }
  const rawP2p = observed?.p2pVersion;
  const p2pVersion = rawP2p === undefined || rawP2p === null || rawP2p === ""
    ? null
    : String(rawP2p);
  if (observed?.liteModeConfigured === true
    && observed?.genesisClosedForLiteNode === true
    && p2pVersion) {
    return { matches: p2pVersion === profile.p2pVersion, method: "p2pVersion" };
  }
  return { matches: false, method: null };
}
