import { useEffect, useRef, useState } from 'react';
import { useSystemSettings } from '@/hooks/use-system-settings';
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/schema';

// Parse value string to detect direction: "+" green, "-" red, else neutral
function parseItem(symbol: string, value: string) {
  const hasPlus  = value.includes("+");
  const hasMinus = value.includes("-");
  const dir: "up" | "down" | "flat" = hasPlus ? "up" : hasMinus ? "down" : "flat";
  return { symbol, value, dir };
}

const CLOCKS = [
  { label: "NY",  tz: "America/New_York" },
  { label: "MEX", tz: "America/Mexico_City" },
  { label: "LON", tz: "Europe/London" },
  { label: "TKY", tz: "Asia/Tokyo" },
];

function useLiveTimes() {
  const [times, setTimes] = useState<string[]>([]);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimes(CLOCKS.map(c =>
        now.toLocaleTimeString("en-US", { timeZone: c.tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
      ));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return times;
}

export function FinancialTicker() {
  const { data: settings } = useSystemSettings();
  const rawItems = settings?.tickerItems ?? DEFAULT_SYSTEM_SETTINGS.tickerItems;
  const items = rawItems.map(i => parseItem(i.symbol, i.value));
  const times = useLiveTimes();

  const [position, setPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef  = useRef<HTMLDivElement>(null);
  const requestRef  = useRef<number>();
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentWidth(contentRef.current.scrollWidth / 4);
    }
  }, [items]);

  useEffect(() => {
    if (contentWidth === 0) return;
    const animate = () => {
      setPosition((prev) => {
        const next = prev - 0.6;
        return next <= -contentWidth ? next % contentWidth : next;
      });
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [contentWidth]);

  const dirColor = (dir: "up" | "down" | "flat") =>
    dir === "up" ? "#22c55e" : dir === "down" ? "#ef4444" : "#e5e7eb";

  const dirSymbol = (dir: "up" | "down" | "flat") =>
    dir === "up" ? "▲" : dir === "down" ? "▼" : "";

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden border-t border-b border-gray-800"
      style={{ background: "#08090a", height: 42 }}
      data-testid="financial-ticker"
    >
      {/* Left edge fade */}
      <div className="absolute left-0 top-0 h-full w-16 z-10 pointer-events-none"
        style={{ background: "linear-gradient(90deg, #08090a 0%, transparent 100%)" }} />

      {/* Clock bar — pinned left */}
      <div className="absolute left-0 top-0 h-full z-20 flex items-center gap-0 pl-3 pr-2"
        style={{ background: "#08090a", borderRight: "1px solid #1f2937" }}>
        {CLOCKS.map((c, i) => (
          <div key={c.label} className="flex items-center" style={{ paddingRight: i < CLOCKS.length - 1 ? 10 : 0 }}>
            <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: "0.08em", marginRight: 4 }}>{c.label}</span>
            <span style={{ fontSize: 10, color: "#d1d5db", fontFamily: "monospace", letterSpacing: "0.04em" }}>
              {times[i] ?? "--:--:--"}
            </span>
            {i < CLOCKS.length - 1 && (
              <span style={{ marginLeft: 10, color: "#1f2937", fontSize: 14 }}>│</span>
            )}
          </div>
        ))}
        {/* thin red separator */}
        <div style={{ width: 2, height: 22, background: "#c8322b", marginLeft: 10, borderRadius: 1 }} />
      </div>

      {/* Scrolling content */}
      <div
        ref={contentRef}
        className="flex items-center h-full absolute top-0 whitespace-nowrap"
        style={{ transform: `translateX(${position}px)`, left: 230 }}
      >
        {Array(4).fill(null).map((_, ci) => (
          <div key={ci} className="flex items-center">
            {items.map((item, idx) => (
              <div
                key={`${ci}-${idx}`}
                className="inline-flex items-center"
                style={{ paddingLeft: 18, paddingRight: 18, gap: 6 }}
                data-testid={`ticker-item-${idx}-${ci}`}
              >
                {/* Separator dot */}
                {idx > 0 && (
                  <span style={{ color: "#374151", marginRight: 18, fontSize: 10 }}>│</span>
                )}
                <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.07em" }}>
                  {item.symbol}
                </span>
                <span style={{ fontSize: 11, color: dirColor(item.dir), fontWeight: 700, fontFamily: "monospace" }}>
                  {item.value}
                </span>
                {item.dir !== "flat" && (
                  <span style={{ fontSize: 8, color: dirColor(item.dir), marginLeft: -2 }}>
                    {dirSymbol(item.dir)}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Right edge fade */}
      <div className="absolute right-0 top-0 h-full w-16 z-10 pointer-events-none"
        style={{ background: "linear-gradient(270deg, #08090a 0%, transparent 100%)" }} />
    </div>
  );
}
