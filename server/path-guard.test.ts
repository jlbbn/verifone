// Run with: npx tsx --test server/path-guard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  apiNotFoundGuard,
  canonicalizePathMiddleware,
  canonicalizeRequestTarget,
  looksLikeApiPath,
} from "./path-guard";

test("canonicalizeRequestTarget decodes %XX and collapses duplicate slashes", () => {
  assert.equal(canonicalizeRequestTarget("/api%2F.env"), "/api/.env");
  assert.equal(canonicalizeRequestTarget("/api/%2e%2e/.env"), "/api/../.env");
  assert.equal(canonicalizeRequestTarget("//api/.env"), "/api/.env");
  assert.equal(canonicalizeRequestTarget("/api/./.env"), "/api/./.env");
  assert.equal(canonicalizeRequestTarget("/API/.env"), "/API/.env");
  assert.equal(canonicalizeRequestTarget("/apis/.env"), "/apis/.env");
  assert.equal(canonicalizeRequestTarget("/a?x=%2F&y=1"), "/a?x=%2F&y=1");
});

test("canonicalizeRequestTarget rejects malformed percent-encoding", () => {
  assert.equal(canonicalizeRequestTarget("/api/%"), null);
  assert.equal(canonicalizeRequestTarget("/api/%zz"), null);
});

test("looksLikeApiPath matches /api and any case, but not lookalikes", () => {
  assert.equal(looksLikeApiPath("/api"), true);
  assert.equal(looksLikeApiPath("/api/.env"), true);
  assert.equal(looksLikeApiPath("/API/.env"), true);
  assert.equal(looksLikeApiPath("/ApI/x"), true);
  assert.equal(looksLikeApiPath("/apis/.env"), true);
  assert.equal(looksLikeApiPath("/apricot"), false);
  assert.equal(looksLikeApiPath("/"), false);
});

// ── End-to-end: a minimal app wired the same way as server/index.ts + static.ts ──
function buildTestApp() {
  const app = express();
  app.use(canonicalizePathMiddleware);
  // Stand-in for the pre-mount public routes (registered before the "/api" guard).
  app.get("/api/public", (_req, res) => res.json({ ok: true }));
  // Stand-in for `app.use("/api", requireSession)`.
  app.use("/api", (_req, res, next) => {
    // fake session guard: everything under /api requires "auth" except /api/public above
    res.status(401).json({ error: "No autenticado" });
  });
  // Stand-in for a real authenticated route that would sit after the guard
  // in the real app (never reached here since the fake guard above always
  // 401s — mirrors production, where these variants must never reach it).
  app.get("/api/known", (_req, res) => res.json({ secret: true }));
  app.use(apiNotFoundGuard);
  // Stand-in for static.ts's SPA catch-all.
  app.use((req, res) => {
    res.status(200).type("html").send("<!DOCTYPE html><html>spa</html>");
  });
  return app;
}

async function withServer<T>(fn: (baseUrl: string, rawGet: RawGet) => Promise<T>): Promise<T> {
  const app = buildTestApp();
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    const rawGet: RawGet = (rawPath) =>
      new Promise((resolve, reject) => {
        const req = http.request(
          { host: "127.0.0.1", port, path: rawPath, method: "GET" },
          (res) => {
            let body = "";
            res.on("data", (c) => (body += c));
            res.on("end", () =>
              resolve({ status: res.statusCode ?? 0, contentType: res.headers["content-type"] ?? "", body }),
            );
          },
        );
        req.on("error", reject);
        req.end();
      });
    return await fn(`http://127.0.0.1:${port}`, rawGet);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

type RawGet = (rawPath: string) => Promise<{ status: number; contentType: string; body: string }>;

// Uses raw http.request (not fetch) because Node's fetch is built on the
// WHATWG URL parser, which silently collapses percent-encoded dot-segments
// (e.g. %2e%2e) client-side before the request is even sent — so a naive
// fetch-based test of "/api/%2e%2e/.env" would actually be sending "/.env"
// and never exercise the code path it claims to.
test("previously-exploitable path variants no longer return 200 HTML", async () => {
  await withServer(async (_base, rawGet) => {
    const cases: Array<[string, number]> = [
      ["/api/.env", 401],           // real /api mount, correctly gated
      ["/apis/.env", 404],          // near-miss segment, never matched a real route → denied
      ["/api%2F.env", 401],         // decodes to /api/.env → now correctly hits the real gate
      ["/api/%2e%2e/.env", 401],    // decodes to /api/../.env → still starts with /api/, hits the real gate
      ["//api/.env", 401],          // collapses to /api/.env, hits the real gate
      ["/API/.env", 401],           // case-insensitive mount already worked; still correct
    ];
    for (const [pathVariant, expectedStatus] of cases) {
      const { status, contentType } = await rawGet(pathVariant);
      assert.equal(status, expectedStatus, `status for ${pathVariant}`);
      assert.equal(
        contentType.includes("text/html"),
        false,
        `${pathVariant} must not return HTML (got ${contentType})`,
      );
    }
  });
});

test("genuine frontend navigation paths still get the SPA catch-all", async () => {
  await withServer(async (_base, rawGet) => {
    const { status, contentType } = await rawGet("/crypto/tron-usdt");
    assert.equal(status, 200);
    assert.match(contentType, /text\/html/);
  });
});

test("a real matched /api route is unaffected by canonicalization", async () => {
  await withServer(async (_base, rawGet) => {
    const { status, body } = await rawGet("/api/public");
    assert.equal(status, 200);
    assert.deepEqual(JSON.parse(body), { ok: true });
  });
});

test("malformed percent-encoding is rejected with 400, not routed anywhere", async () => {
  await withServer(async (_base, rawGet) => {
    const { status } = await rawGet("/api/%zz");
    assert.equal(status, 400);
  });
});
