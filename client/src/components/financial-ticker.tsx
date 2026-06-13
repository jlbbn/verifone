import { useEffect, useRef, useState } from 'react';
import { useSystemSettings } from '@/hooks/use-system-settings';
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/schema';

export function FinancialTicker() {
  const { data: settings } = useSystemSettings();
  const items = settings?.tickerItems ?? DEFAULT_SYSTEM_SETTINGS.tickerItems;

  const [position, setPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
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
        const next = prev - 1;
        return next <= -contentWidth ? next % contentWidth : next;
      });
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [contentWidth]);

  return (
    <div
      ref={containerRef}
      className="bg-black h-[50px] overflow-hidden relative border-t border-b border-gray-800"
      data-testid="financial-ticker"
    >
      <div
        ref={contentRef}
        className="flex items-center h-full absolute left-0 top-0 whitespace-nowrap"
        style={{ transform: `translateX(${position}px)` }}
      >
        {Array(4).fill(null).map((_, ci) => (
          <div key={ci} className="flex items-center">
            {items.map((msg, idx) => (
              <div
                key={`${ci}-${idx}`}
                className="inline-flex items-center text-white font-['Arial'] text-sm px-5"
                data-testid={`ticker-item-${idx}-${ci}`}
              >
                <span className="text-[#c8322b] text-xs mr-3">●</span>
                <span className="font-semibold">{msg.symbol}:</span>
                <span className="ml-1">{msg.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
