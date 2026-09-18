/**
 * Runs scripts/tailscale-up.sh at boot, before the server starts accepting
 * traffic, so the tailnet (and its local SOCKS5/HTTP proxy) is up before
 * anything tries to reach the mainnet TRON node or signer through it.
 *
 * Never allowed to block startup indefinitely or crash the app: a bounded
 * timeout, and any failure is logged and swallowed. The rest of the app
 * (auth, payments, everything not TRON-node related) must keep working
 * even when Tailscale can't connect.
 */
import { spawn } from "child_process";
import path from "path";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "tailscale-up.sh");
const BOOT_TIMEOUT_MS = Number(process.env.TAILSCALE_BOOT_TIMEOUT_MS ?? 25_000);

export function bootstrapTailscale(): Promise<void> {
  return new Promise((resolve) => {
    if (!process.env.TS_AUTHKEY) {
      console.log("[tailscale] TS_AUTHKEY no configurado — arrancando sin tailnet.");
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const timer = setTimeout(() => {
      console.warn(`[tailscale] bootstrap excedió ${BOOT_TIMEOUT_MS}ms — continúo arrancando el servidor sin esperar más.`);
      finish();
    }, BOOT_TIMEOUT_MS);

    const child = spawn("bash", [SCRIPT_PATH], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", (err) => {
      console.error("[tailscale] no se pudo ejecutar tailscale-up.sh:", err.message);
      clearTimeout(timer);
      finish();
    });

    child.on("exit", (code) => {
      console.log(`[tailscale] bootstrap terminó (code=${code}).`);
      clearTimeout(timer);
      finish();
    });
  });
}
