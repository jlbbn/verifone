import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSystemSettings } from '@/hooks/use-system-settings';
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/schema';

// ── Live crypto prices — same feed the exchange page uses (Binance→OKX→Kraken) ──
type PriceRecord = { price: number; change24h: number };
type PricesResponse = Record<string, PriceRecord>;

// Maps a ticker symbol like "BTC/USD" to the aggregator's lowercase asset key
const LIVE_SYMBOL_TO_ASSET: Record<string, string> = {
  "BTC/USD": "btc",
  "ETH/USD": "eth",
  "XRP/USD": "xrp",
  "LTC/USD": "ltc",
  "DOT/USD": "dot",
  "ADA/USD": "ada",
};

function formatLivePrice(symbol: string, price: number): string {
  // XRP/ADA trade under $1: show more decimals, like the rest of the app does
  const decimals = price < 1 ? 4 : 2;
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function useLiveCryptoPrices() {
  return useQuery<PricesResponse>({
    queryKey: ['/api/crypto-prices'],
    refetchInterval: 20_000, // matches the backend aggregator's cache TTL
    staleTime: 15_000,
    retry: 1,
  });
}

// ── World clocks — standalone component, no shared re-render ─────────────────
const CLOCKS = [
  { label: "NY",  tz: "America/New_York" },
  { label: "MEX", tz: "America/Mexico_City" },
  { label: "LON", tz: "Europe/London" },
  { label: "TKY", tz: "Asia/Tokyo" },
];

function WorldClocks() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 0,
      background: "#08090a", height: "100%",
      borderRight: "1px solid #1f2937",
      padding: "0 12px",
      flexShrink: 0,
    }}>
      {CLOCKS.map((c, i) => {
        const time = now.toLocaleTimeString("en-US", {
          timeZone: c.tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        });
        return (
          <div key={c.label} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ padding: "0 8px", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.1em", lineHeight: 1.2 }}>
                {c.label}
              </div>
              <div style={{
                fontFamily: "monospace", fontSize: 11, color: "#d1d5db",
                letterSpacing: "0.04em", lineHeight: 1.2, fontVariantNumeric: "tabular-nums",
              }}>
                {time}
              </div>
            </div>
            {i < CLOCKS.length - 1 && (
              <div style={{ width: 1, height: 20, background: "#1f2937" }} />
            )}
          </div>
        );
      })}
      <div style={{ width: 2, height: 22, background: "#c8322b", marginLeft: 10, borderRadius: 1, flexShrink: 0 }} />
    </div>
  );
}

// ── Scrolling price ticker — CSS animation, zero JS per-frame ────────────────
export function FinancialTicker() {
  const { data: settings } = useSystemSettings();
  const { data: livePrices } = useLiveCryptoPrices();
  const baseItems = settings?.tickerItems ?? DEFAULT_SYSTEM_SETTINGS.tickerItems;

  // Overlay live crypto prices onto the configured items; anything without a
  // live feed (ON, CAD/MXN) keeps its configured value untouched.
  const items = baseItems.map(item => {
    const asset = LIVE_SYMBOL_TO_ASSET[item.symbol];
    const record = asset ? livePrices?.[asset] : undefined;
    if (!record) return item;
    const changeSign = record.change24h > 0 ? "+" : record.change24h < 0 ? "-" : "";
    const changeStr = `${changeSign}${Math.abs(record.change24h).toFixed(2)}%`;
    return { symbol: item.symbol, value: `${formatLivePrice(item.symbol, record.price)} ${changeStr}` };
  });

  const dirColor = (v: string) =>
    v.includes("+") ? "#22c55e" : v.includes("-") ? "#ef4444" : "#e5e7eb";
  const dirMark = (v: string) =>
    v.includes("+") ? "▲" : v.includes("-") ? "▼" : "";

  // Build a wide enough strip (4 copies) for seamless CSS loop
  const strip = [...items, ...items, ...items, ...items];

  return (
    <div
      data-testid="financial-ticker"
      style={{
        background: "#08090a",
        height: 42,
        borderTop: "1px solid #1a1a2e",
        borderBottom: "1px solid #1a1a2e",
        display: "flex",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Pinned clock bar */}
      <WorldClocks />

      {/* Left fade */}
      <div style={{
        position: "absolute", left: 0, top: 0, height: "100%", width: 12, zIndex: 2, pointerEvents: "none",
        background: "linear-gradient(90deg,#08090a,transparent)",
      }} />

      {/* CSS-animated scroll strip */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div
          className="ticker-scroll-inner"
          style={{
            display: "flex", alignItems: "center", height: "100%",
            width: "max-content", whiteSpace: "nowrap",
            animation: `tickerScroll ${items.length * 4}s linear infinite`,
          }}
        >
          {strip.map((item, idx) => (
            <div key={idx} style={{ display: "inline-flex", alignItems: "center", paddingLeft: 20, paddingRight: 20, gap: 5 }}>
              {idx % items.length !== 0 || idx === 0 ? null : (
                <span style={{ color: "#1f2937", marginRight: 20, fontSize: 14 }}>│</span>
              )}
              <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: "0.07em" }}>
                {item.symbol}
              </span>
              <span style={{ fontSize: 11, color: dirColor(item.value), fontWeight: 700, fontFamily: "monospace" }}>
                {item.value}
              </span>
              {dirMark(item.value) && (
                <span style={{ fontSize: 8, color: dirColor(item.value) }}>{dirMark(item.value)}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right fade */}
      <div style={{
        position: "absolute", right: 0, top: 0, height: "100%", width: 32, zIndex: 2, pointerEvents: "none",
        background: "linear-gradient(270deg,#08090a,transparent)",
      }} />
    </div>
  );
}
