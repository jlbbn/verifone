import { useEffect, useState } from "react";

export interface TronLinkState {
  installed: boolean;
  connected: boolean;
  address: string | null;
  trxBalance: number | null;
  nodeHost: string | null;
  error: string | null;
  loading: boolean;
}

/** TronLink injects `tronWeb`/`tronLink` on `window` asynchronously — poll
 * briefly instead of assuming it is present on first render. Shared between
 * the admin TRON panel and the end-user USDT/TRON page. */
export function useTronLink() {
  const [state, setState] = useState<TronLinkState>({
    installed: false, connected: false, address: null, trxBalance: null, nodeHost: null, error: null, loading: false,
  });

  const refreshFromInjectedWallet = async () => {
    const tronWeb = (window as any).tronWeb;
    if (!tronWeb?.ready) return;
    const address: string | null = tronWeb.defaultAddress?.base58 || null;
    const nodeHost: string | null = tronWeb.fullNode?.host || null;
    let trxBalance: number | null = null;
    if (address) {
      try {
        const sun = await tronWeb.trx.getBalance(address);
        trxBalance = Number(sun) / 1_000_000;
      } catch {
        trxBalance = null;
      }
    }
    setState((s) => ({ ...s, installed: true, connected: Boolean(address), address, trxBalance, nodeHost }));
  };

  useEffect(() => {
    const tick = () => {
      // Some browser extensions leave a stray `window.tronWeb`/`tronLink`
      // object behind without the real API — only trust it if `request` is
      // actually callable, so we don't show a "Conectar" button that fails
      // silently every time it's pressed.
      const tronLink = (window as any).tronLink;
      const tronWeb = (window as any).tronWeb;
      const hasTronLink = typeof tronLink?.request === "function" || Boolean(tronWeb?.ready);
      setState((s) => ({ ...s, installed: hasTronLink }));
      if (hasTronLink) void refreshFromInjectedWallet();
    };
    tick();
    const interval = setInterval(tick, 3_000);
    const onMessage = (event: MessageEvent) => {
      if (event?.data?.message?.action === "accountsChanged" || event?.data?.message?.action === "setAccount") {
        void refreshFromInjectedWallet();
      }
    };
    window.addEventListener("message", onMessage);
    return () => { clearInterval(interval); window.removeEventListener("message", onMessage); };
  }, []);

  const connect = async (): Promise<{ ok: boolean; error?: string }> => {
    setState((s) => ({ ...s, error: null, loading: true }));
    try {
      const tronLink = (window as any).tronLink;
      if (typeof tronLink?.request !== "function") {
        const msg = "TronLink no está instalado en este navegador. Instálalo como extensión para conectar una wallet.";
        setState((s) => ({ ...s, loading: false, error: msg }));
        return { ok: false, error: msg };
      }
      const res = await tronLink.request({ method: "tron_requestAccounts" });
      if (res?.code && res.code !== 200) {
        throw new Error(res.message || "TronLink rechazó la solicitud de conexión.");
      }
      await refreshFromInjectedWallet();
      setState((s) => ({ ...s, loading: false }));
      return { ok: true };
    } catch (err: any) {
      const msg = err.message || "No se pudo conectar con TronLink.";
      setState((s) => ({ ...s, loading: false, error: msg }));
      return { ok: false, error: msg };
    }
  };

  return { state, connect, refresh: refreshFromInjectedWallet };
}
