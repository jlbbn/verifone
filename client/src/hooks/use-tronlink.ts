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
      const hasTronLink = Boolean((window as any).tronLink || (window as any).tronWeb);
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

  const connect = async () => {
    setState((s) => ({ ...s, error: null, loading: true }));
    try {
      const tronLink = (window as any).tronLink;
      if (!tronLink) {
        setState((s) => ({
          ...s, loading: false,
          error: "TronLink no está instalado en este navegador. Instálalo como extensión para conectar una wallet.",
        }));
        return;
      }
      const res = await tronLink.request({ method: "tron_requestAccounts" });
      if (res?.code && res.code !== 200) {
        throw new Error(res.message || "TronLink rechazó la solicitud de conexión.");
      }
      await refreshFromInjectedWallet();
      setState((s) => ({ ...s, loading: false }));
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err.message || "No se pudo conectar con TronLink." }));
    }
  };

  return { state, connect, refresh: refreshFromInjectedWallet };
}
