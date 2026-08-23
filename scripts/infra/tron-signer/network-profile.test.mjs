import test from "node:test";
import assert from "node:assert/strict";
import {
  chainIdentityEvidence,
  classifyGenesisProbe,
  configuredSignerNetwork,
  validateSignerStatePath,
} from "./network-profile.mjs";

const NILE = configuredSignerNetwork({ TRON_NETWORK: "nile" });
const MAINNET = configuredSignerNetwork({ TRON_NETWORK: "mainnet" });
const LITE_CLOSED_TEXT = "this API is closed because this node is a lite fullnode";

test("profiles pin network identity references", () => {
  assert.equal(MAINNET.p2pVersion, "11111");
  assert.equal(NILE.p2pVersion, "201910292");
  assert.match(MAINNET.genesisBlockId, /^[0-9a-f]{64}$/);
  assert.match(NILE.genesisBlockId, /^[0-9a-f]{64}$/);
  assert.notEqual(MAINNET.genesisBlockId, NILE.genesisBlockId);
});

test("genesis probe classification separates ok, lite closure, malformed and error", () => {
  assert.deepEqual(classifyGenesisProbe({ ok: true, value: { blockID: NILE.genesisBlockId } }), {
    genesisBlockId: NILE.genesisBlockId,
    status: "ok",
  });
  assert.deepEqual(
    classifyGenesisProbe({ ok: true, value: { blockID: NILE.genesisBlockId.toUpperCase() } }),
    { genesisBlockId: NILE.genesisBlockId, status: "ok" },
  );
  assert.deepEqual(classifyGenesisProbe({ ok: true, value: LITE_CLOSED_TEXT }), {
    genesisBlockId: null,
    status: "closed_lite_node",
  });
  assert.deepEqual(classifyGenesisProbe({ ok: false, error: new Error(LITE_CLOSED_TEXT) }), {
    genesisBlockId: null,
    status: "closed_lite_node",
  });
  assert.deepEqual(classifyGenesisProbe({ ok: false, error: new Error("timeout of 8000ms") }), {
    genesisBlockId: null,
    status: "error",
  });
  assert.deepEqual(classifyGenesisProbe({ ok: true, value: {} }), {
    genesisBlockId: null,
    status: "malformed",
  });
  assert.deepEqual(classifyGenesisProbe({ ok: true, value: { blockID: "not-hex" } }), {
    genesisBlockId: null,
    status: "malformed",
  });
  assert.deepEqual(classifyGenesisProbe(undefined), { genesisBlockId: null, status: "error" });
});

test("valid genesis evidence always wins and detects the wrong chain", () => {
  assert.deepEqual(
    chainIdentityEvidence({ genesisBlockId: NILE.genesisBlockId }, NILE),
    { matches: true, method: "genesisBlockId" },
  );
  assert.deepEqual(
    chainIdentityEvidence({ genesisBlockId: NILE.genesisBlockId.toUpperCase() }, NILE),
    { matches: true, method: "genesisBlockId" },
  );
  assert.deepEqual(
    chainIdentityEvidence(
      {
        genesisBlockId: MAINNET.genesisBlockId,
        genesisClosedForLiteNode: true,
        liteModeConfigured: true,
        p2pVersion: NILE.p2pVersion,
      },
      NILE,
    ),
    { matches: false, method: "genesisBlockId" },
  );
});

test("p2p fallback requires BOTH declared lite mode and the expected lite closure", () => {
  const base = { genesisBlockId: null, p2pVersion: "201910292" };
  assert.deepEqual(
    chainIdentityEvidence(
      { ...base, genesisClosedForLiteNode: true, liteModeConfigured: true },
      NILE,
    ),
    { matches: true, method: "p2pVersion" },
  );
  assert.deepEqual(
    chainIdentityEvidence(
      { ...base, p2pVersion: 201910292, genesisClosedForLiteNode: true, liteModeConfigured: true },
      NILE,
    ),
    { matches: true, method: "p2pVersion" },
  );
  assert.deepEqual(
    chainIdentityEvidence(
      { ...base, genesisClosedForLiteNode: true, liteModeConfigured: false },
      NILE,
    ),
    { matches: false, method: null },
  );
  assert.deepEqual(
    chainIdentityEvidence(
      { ...base, genesisClosedForLiteNode: false, liteModeConfigured: true },
      NILE,
    ),
    { matches: false, method: null },
  );
  assert.deepEqual(
    chainIdentityEvidence(
      { ...base, p2pVersion: "11111", genesisClosedForLiteNode: true, liteModeConfigured: true },
      NILE,
    ),
    { matches: false, method: "p2pVersion" },
  );
});

test("unexpected genesis failures never authorize identity, even in lite mode", () => {
  const malformed = classifyGenesisProbe({ ok: true, value: { blockID: "corrupt" } });
  assert.deepEqual(
    chainIdentityEvidence(
      {
        genesisBlockId: malformed.genesisBlockId,
        genesisClosedForLiteNode: malformed.status === "closed_lite_node",
        liteModeConfigured: true,
        p2pVersion: "201910292",
      },
      NILE,
    ),
    { matches: false, method: null },
  );
  const timedOut = classifyGenesisProbe({ ok: false, error: new Error("socket hang up") });
  assert.deepEqual(
    chainIdentityEvidence(
      {
        genesisBlockId: timedOut.genesisBlockId,
        genesisClosedForLiteNode: timedOut.status === "closed_lite_node",
        liteModeConfigured: true,
        p2pVersion: "201910292",
      },
      NILE,
    ),
    { matches: false, method: null },
  );
});

test("no identity evidence means no match", () => {
  assert.deepEqual(chainIdentityEvidence({ genesisBlockId: null, p2pVersion: null }, NILE), {
    matches: false,
    method: null,
  });
  assert.deepEqual(chainIdentityEvidence({}, NILE), { matches: false, method: null });
});

test("nile still demands a nile-scoped state path", () => {
  assert.throws(
    () => validateSignerStatePath("/var/lib/tron-signer/state.json", { TRON_NETWORK: "nile" }),
    /nile/i,
  );
  assert.equal(
    validateSignerStatePath("/var/lib/tron-signer/nile-state.json", { TRON_NETWORK: "nile" }),
    "/var/lib/tron-signer/nile-state.json",
  );
});
