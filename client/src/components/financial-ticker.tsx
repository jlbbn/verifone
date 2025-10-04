import { useEffect, useRef, useState } from 'react';

interface TickerMessage {
  symbol: string;
  value: string;
}

const TICKER_MESSAGES: TickerMessage[] = [
  { symbol: 'ON', value: '$22.53' },
  { symbol: 'CAD/MXN', value: '$13.20' },
  { symbol: 'BTC/USD', value: '$54,325.75' },
  { symbol: 'ETH/USD', value: '$2,670.30' },
  { symbol: 'XRP/USD', value: '$0.52' },
  { symbol: 'LTC/USD', value: '$142.87' },
  { symbol: 'DOT/USD', value: '$15.32' },
  { symbol: 'ADA/USD', value: '$0.82' },
];

export function FinancialTicker() {
  const [position, setPosition] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentWidth(contentRef.current.scrollWidth / 4);
    }
  }, []);

  useEffect(() => {
    if (isPaused || contentWidth === 0) return;

    const animate = () => {
      setPosition((prev) => {
        const newPos = prev - 1;
        if (newPos <= -contentWidth) {
          return newPos % contentWidth;
        }
        return newPos;
      });
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPaused, contentWidth]);

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
        {Array(4).fill(null).map((_, copyIndex) => (
          <div key={copyIndex} className="flex items-center">
            {TICKER_MESSAGES.map((msg, index) => (
              <div
                key={`${copyIndex}-${index}`}
                className="inline-flex items-center text-white font-['Arial'] text-sm px-5"
                data-testid={`ticker-item-${index}-${copyIndex}`}
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
