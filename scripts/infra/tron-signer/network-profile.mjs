const PROFILES = Object.freeze({
  mainnet: Object.freeze({
    network: "mainnet",
    usdtContract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    genesisBlockId: "00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc",
  }),
  nile: Object.freeze({
    network: "nile",
    usdtContract: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
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