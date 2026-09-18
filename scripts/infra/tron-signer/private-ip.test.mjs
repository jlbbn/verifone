import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateIpv4 } from "./private-ip.mjs";

test("accepts RFC1918 and loopback ranges", () => {
  assert.equal(isPrivateIpv4("10.30.0.3"), true);
  assert.equal(isPrivateIpv4("127.0.0.1"), true);
  assert.equal(isPrivateIpv4("172.16.0.5"), true);
  assert.equal(isPrivateIpv4("172.31.255.254"), true);
  assert.equal(isPrivateIpv4("192.168.1.10"), true);
});

test("accepts the Tailscale CGNAT range (100.64.0.0/10)", () => {
  assert.equal(isPrivateIpv4("100.64.0.1"), true);
  assert.equal(isPrivateIpv4("100.85.242.110"), true);
  assert.equal(isPrivateIpv4("100.99.181.52"), true);
  assert.equal(isPrivateIpv4("100.101.95.48"), true);
  assert.equal(isPrivateIpv4("100.127.255.255"), true);
});

test("rejects addresses outside every private/CGNAT range", () => {
  assert.equal(isPrivateIpv4("100.63.255.255"), false);
  assert.equal(isPrivateIpv4("100.128.0.0"), false);
  assert.equal(isPrivateIpv4("172.15.255.255"), false);
  assert.equal(isPrivateIpv4("172.32.0.0"), false);
  assert.equal(isPrivateIpv4("8.8.8.8"), false);
  assert.equal(isPrivateIpv4("165.227.191.242"), false);
});

test("rejects malformed input", () => {
  assert.equal(isPrivateIpv4("not-an-ip"), false);
  assert.equal(isPrivateIpv4("10.30.0"), false);
  assert.equal(isPrivateIpv4("10.30.0.256"), false);
  assert.equal(isPrivateIpv4(""), false);
});
