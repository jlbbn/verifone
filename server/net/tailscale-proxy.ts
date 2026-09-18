/**
 * Routes outbound calls destined for the tailnet (mainnet TRON node and
 * signer, both reached over their 100.64.0.0/10 Tailscale addresses)
 * through the local SOCKS5/HTTP-CONNECT proxy that `tailscaled` exposes in
 * userspace-networking mode (see scripts/tailscale-up.sh).
 *
 * Everything else (Binance, OKX, TronGrid, Tronscan, Stripe, ...) must keep
 * going out directly — this module only ever returns an agent for hosts
 * that are actually on the tailnet, so plugging it in unconditionally is
 * safe.
 */
import { HttpsProxyAgent } from "https-proxy-agent";

const PROXY_ADDR = process.env.TAILSCALE_PROXY_ADDR?.trim() || "127.0.0.1:1055";
const PROXY_URL = `http://${PROXY_ADDR}`;

// A single HttpsProxyAgent instance tunnels both plain-HTTP and TLS traffic
// through the local tailscaled proxy (it issues an HTTP CONNECT either way,
// then layers TLS on top only when the destination itself is https).
let _agent: HttpsProxyAgent<string> | null = null;

function proxyAgent(): HttpsProxyAgent<string> {
  if (!_agent) _agent = new HttpsProxyAgent(PROXY_URL);
  return _agent;
}

/** CGNAT range Tailscale assigns tailnet addresses from (100.64.0.0/10). */
export function isTailnetHost(hostname: string): boolean {
  const m = hostname.match(/^100\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!m) return false;
  const secondOctet = Number(m[1]);
  return secondOctet >= 64 && secondOctet <= 127;
}

/** Agent to use for a given URL's host, or undefined when it isn't a
 * tailnet address (i.e. use the platform default / no proxy). */
export function tailnetAgentFor(url: string | URL): HttpsProxyAgent<string> | undefined {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return undefined;
  }
  if (!isTailnetHost(hostname)) return undefined;
  return proxyAgent();
}
