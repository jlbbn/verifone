import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft, Lock, RefreshCw, TrendingUp, BarChart2,
  Activity, Coins, DollarSign, TrendingDown, Clock,
  Wallet, Send, ShieldCheck, Copy, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  SiBitcoin, SiEthereum, SiLitecoin, SiDogecoin,
  SiSolana, SiCardano, SiPolkadot, SiTether,
} from "react-icons/si";

// ─── Crypto catalog ──────────────────────────────────────────────────────────

interface Crypto {
  id: string;
  name: string;
  symbol: string;
  basePrice: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  supply: number;
  athPrice: number;
  athDate: string;
  athPct: number;
  color: string;
  lightBg: string;
  tvSymbol: string;
}

const CRYPTOS: Crypto[] = [
  {
    id: "btc", name: "Bitcoin", symbol: "BTC",
    basePrice: 54325.75, change24h: 1.23,
    volume24h: 28900000000, marketCap: 1071000000000,
    supply: 19700000,
    athPrice: 73737.94, athDate: "14 Mar 2024", athPct: 26.23,
    color: "#F7931A", lightBg: "#FEF3C7",
    tvSymbol: "BITSTAMP:BTCUSD",
  },
  {
    id: "eth", name: "Ethereum", symbol: "ETH",
    basePrice: 2670.36, change24h: 0.1094,
    volume24h: 5941013667, marketCap: 202199926337,
    supply: 120684209,
    athPrice: 4953.73, athDate: "24 Aug 2025", athPct: 46.11,
    color: "#627EEA", lightBg: "#EDE9FE",
    tvSymbol: "BITSTAMP:ETHUSD",
  },
  {
    id: "xrp", name: "XRP", symbol: "XRP",
    basePrice: 0.52, change24h: -0.8,
    volume24h: 2100000000, marketCap: 28000000000,
    supply: 58000000000,
    athPrice: 3.84, athDate: "4 Jan 2018", athPct: 86.46,
    color: "#00AAE4", lightBg: "#E0F2FE",
    tvSymbol: "BITSTAMP:XRPUSD",
  },
  {
    id: "ltc", name: "Litecoin", symbol: "LTC",
    basePrice: 142.87, change24h: 2.1,
    volume24h: 890000000, marketCap: 10500000000,
    supply: 73400000,
    athPrice: 410.26, athDate: "10 May 2021", athPct: 65.19,
    color: "#A6A9AA", lightBg: "#F3F4F6",
    tvSymbol: "BITSTAMP:LTCUSD",
  },
  {
    id: "doge", name: "Dogecoin", symbol: "DOGE",
    basePrice: 0.19, change24h: -1.4,
    volume24h: 1200000000, marketCap: 25000000000,
    supply: 144000000000,
    athPrice: 0.74, athDate: "8 May 2021", athPct: 74.32,
    color: "#C2A633", lightBg: "#FEF9C3",
    tvSymbol: "BINANCE:DOGEUSDT",
  },
  {
    id: "sol", name: "Solana", symbol: "SOL",
    basePrice: 195.30, change24h: 3.2,
    volume24h: 4200000000, marketCap: 87000000000,
    supply: 444000000,
    athPrice: 259.96, athDate: "19 Nov 2021", athPct: 24.88,
    color: "#9945FF", lightBg: "#F3E8FF",
    tvSymbol: "BINANCE:SOLUSDT",
  },
  {
    id: "ada", name: "Cardano", symbol: "ADA",
    basePrice: 0.82, change24h: -0.3,
    volume24h: 540000000, marketCap: 29000000000,
    supply: 35000000000,
    athPrice: 3.10, athDate: "2 Sep 2021", athPct: 73.55,
    color: "#0033AD", lightBg: "#EFF6FF",
    tvSymbol: "BINANCE:ADAUSDT",
  },
  {
    id: "dot", name: "Polkadot", symbol: "DOT",
    basePrice: 10.45, change24h: 0.9,
    volume24h: 320000000, marketCap: 15000000000,
    supply: 1430000000,
    athPrice: 55.00, athDate: "4 Nov 2021", athPct: 81.00,
    color: "#E6007A", lightBg: "#FCE7F3",
    tvSymbol: "BINANCE:DOTUSDT",
  },
  {
    id: "usdt", name: "Tether", symbol: "USDT",
    basePrice: 1.0002, change24h: 0.01,
    volume24h: 118000000000, marketCap: 113000000000,
    supply: 113000000000,
    athPrice: 1.32, athDate: "27 Jul 2018", athPct: 24.07,
    color: "#26A17B", lightBg: "#D1FAE5",
    tvSymbol: "BITSTAMP:USDTUSD",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number, decimals = 4) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCompact(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(4)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(4)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(4)}M`;
  return `$${n.toFixed(4)}`;
}

function CryptoIcon({ symbol, size = 20, color }: { symbol: string; size?: number; color?: string }) {
  const style: React.CSSProperties = { width: size, height: size, color: color ?? "currentColor" };
  switch (symbol) {
    case "BTC":  return <SiBitcoin style={style} />;
    case "ETH":  return <SiEthereum style={style} />;
    case "LTC":  return <SiLitecoin style={style} />;
    case "DOGE": return <SiDogecoin style={style} />;
    case "SOL":  return <SiSolana style={style} />;
    case "ADA":  return <SiCardano style={style} />;
    case "DOT":  return <SiPolkadot style={style} />;
    case "USDT": return <SiTether style={style} />;
    default:     return <DollarSign style={style} />;
  }
}

// ─── TradingView chart ────────────────────────────────────────────────────────

function TradingViewChart({ tvSymbol }: { tvSymbol: string }) {
  const idRef = useRef(`tvw-${Math.random().toString(36).slice(2)}`);
  const id = idRef.current;

  useEffect(() => {
    const container = document.getElementById(id);
    if (container) container.innerHTML = "";

    function build() {
      if (!(window as { TradingView?: { widget: new (o: object) => void } }).TradingView) return;
      const container2 = document.getElementById(id);
      if (!container2) return;
      new (window as unknown as { TradingView: { widget: new (o: object) => void } }).TradingView.widget({
        autosize: true,
        symbol: tvSymbol,
        interval: "D",
        timezone: "America/Mexico_City",
        theme: "light",
        style: "1",
        locale: "en",
        toolbar_bg: "#f8f8f8",
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        save_image: false,
        container_id: id,
      });
    }

    const w = window as { TradingView?: unknown };
    if (w.TradingView) {
      build();
    } else {
      const existing = document.getElementById("tv-script-loader");
      if (existing) {
        existing.addEventListener("load", build);
        return () => existing.removeEventListener("load", build);
      }
      const s = document.createElement("script");
      s.id = "tv-script-loader";
      s.src = "https://s3.tradingview.com/tv.js";
      s.async = true;
      s.onload = build;
      document.head.appendChild(s);
    }
  }, [tvSymbol, id]);

  return <div id={id} className="w-full" style={{ height: 420 }} />;
}

// ─── Crypto picker ────────────────────────────────────────────────────────────

function CryptoPicker({
  value, onChange, exclude,
}: {
  value: string; onChange: (v: string) => void; exclude?: string;
}) {
  const coin = CRYPTOS.find(c => c.id === value)!;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className="border-0 bg-transparent p-0 h-auto focus:ring-0 shadow-none gap-1"
        data-testid={`picker-${value}`}
      >
        <div className="flex items-center gap-2 min-w-[96px]">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: coin.lightBg }}
          >
            <CryptoIcon symbol={coin.symbol} size={18} color={coin.color} />
          </div>
          <div className="text-left">
            <p className="font-bold text-sm leading-none text-foreground">{coin.symbol}</p>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm mt-0.5 inline-block"
              style={{ backgroundColor: coin.color + "22", color: coin.color }}
            >
              {coin.symbol}
            </span>
          </div>
        </div>
      </SelectTrigger>
      <SelectContent>
        {CRYPTOS.filter(c => c.id !== exclude).map(c => (
          <SelectItem key={c.id} value={c.id}>
            <div className="flex items-center gap-2 py-0.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.lightBg }}>
                <CryptoIcon symbol={c.symbol} size={13} color={c.color} />
              </div>
              <span className="font-semibold text-sm">{c.symbol}</span>
              <span className="text-xs text-muted-foreground">{c.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface SubData {
  walletAddress?: string | null;
  walletNetwork?: string | null;
  walletToken?: string | null;
}

export default function ExchangePage() {
  const { toast } = useToast();
  const { user } = useAuth();

  // ── Wallet / dispersión ─────────────────────────────────────────────────
  const { data: subData } = useQuery<SubData>({
    queryKey: ["/api/subscription"],
    enabled: !!user,
  });
  const coldWallet   = subData?.walletAddress ?? null;
  const coldNetwork  = subData?.walletNetwork ?? "ETHEREUM (ERC-20)";
  const coldToken    = subData?.walletToken   ?? "ETH";

  const [dispAmount, setDispAmount] = useState("");
  const [dispToken,  setDispToken]  = useState("eth");
  const [copied,     setCopied]     = useState(false);

  function handleCopy() {
    if (!coldWallet) return;
    navigator.clipboard.writeText(coldWallet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const dispersionMutation = useMutation({
    mutationFn: async () => {
      const coin   = CRYPTOS.find(c => c.id === dispToken)!;
      const price  = prices[dispToken] ?? coin.basePrice;
      const usdVal = (parseFloat(dispAmount) * price).toFixed(2);
      const txId   = `DSP-${Date.now().toString(36).toUpperCase()}`;
      const res = await apiRequest("POST", "/api/transactions", {
        transactionId: txId,
        protocol:      "101.3",
        type:          "transfer",
        amount:        usdVal,
        currency:      "USD",
        status:        "completed",
        fromAccount:   `EXCHANGE · WALLET · ${coin.symbol}`,
        toAccount:     coldWallet ?? "—",
        description:   `Dispersión ${dispAmount} ${coin.symbol} → Wallet fría ${coldWallet?.slice(0, 10)}…`,
      });
      if (!res.ok) throw new Error("Error");
      return { amount: dispAmount, symbol: coin.symbol };
    },
    onSuccess: ({ amount, symbol }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Dispersión enviada", description: `${amount} ${symbol} → wallet fría registrada` });
      setDispAmount("");
    },
    onError: () => {
      toast({ title: "Error al dispersar", variant: "destructive" });
    },
  });

  function handleDispersar() {
    if (!dispAmount || parseFloat(dispAmount) <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a 0", variant: "destructive" });
      return;
    }
    dispersionMutation.mutate();
  }

  const [fromId, setFromId] = useState("eth");
  const [toId, setToId]     = useState("btc");
  const [fromAmount, setFromAmount] = useState("0.1");
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries(CRYPTOS.map(c => [c.id, c.basePrice]))
  );
  const [updatedAt, setUpdatedAt] = useState(new Date());

  const fromCoin = CRYPTOS.find(c => c.id === fromId)!;
  const toCoin   = CRYPTOS.find(c => c.id === toId)!;
  const fromPrice = prices[fromId] ?? fromCoin.basePrice;
  const toPrice   = prices[toId]   ?? toCoin.basePrice;
  const rate = fromPrice / toPrice;
  const toAmount = fromAmount && parseFloat(fromAmount) > 0
    ? (parseFloat(fromAmount) * rate).toFixed(8)
    : "";

  // Live price simulation
  useEffect(() => {
    const t = setInterval(() => {
      setPrices(prev => {
        const next = { ...prev };
        CRYPTOS.forEach(c => {
          const base = prev[c.id] ?? c.basePrice;
          const delta = (Math.random() - 0.49) * base * 0.0015;
          next[c.id] = Math.max(base + delta, 0.0001);
        });
        return next;
      });
      setUpdatedAt(new Date());
    }, 4000);
    return () => clearInterval(t);
  }, []);

  function handleSwap() {
    const tmp = fromId;
    setFromId(toId);
    setToId(tmp);
  }

  function handleFromChange(id: string) {
    if (id === toId) setToId(fromId);
    setFromId(id);
  }
  function handleToChange(id: string) {
    if (id === fromId) setFromId(toId);
    setToId(id);
  }

  const exchangeMutation = useMutation({
    mutationFn: async () => {
      const txId = `EXC-${Date.now().toString(36).toUpperCase()}`;
      const res = await apiRequest("POST", "/api/transactions", {
        transactionId: txId,
        protocol: "201.3",
        type: "exchange",
        amount: (parseFloat(fromAmount) * fromPrice).toFixed(2),
        currency: "USD",
        status: "completed",
        fromAccount: `EXCHANGE · ${fromCoin.symbol} · ${fromAmount}`,
        toAccount: `${toCoin.symbol} · ${toAmount}`,
        description: `Exchange ${fromAmount} ${fromCoin.symbol} → ${toAmount} ${toCoin.symbol} (rate: ${rate.toFixed(8)})`,
      });
      if (!res.ok) throw new Error("Error");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Intercambio realizado", description: `${fromAmount} ${fromCoin.symbol} → ${toAmount} ${toCoin.symbol}` });
    },
    onError: () => {
      toast({ title: "Error al procesar intercambio", variant: "destructive" });
    },
  });

  function handleExchange() {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a 0", variant: "destructive" });
      return;
    }
    exchangeMutation.mutate();
  }

  const price24hChange = fromCoin.change24h;
  const positive = price24hChange >= 0;

  // Stat rows for the selected coin
  const statsRows = [
    {
      icon: <DollarSign className="w-3.5 h-3.5" />,
      label: `${fromCoin.symbol} Price`,
      value: `$ ${fmtNum(fromPrice, fromPrice < 1 ? 4 : 4)}`,
    },
    {
      icon: positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />,
      label: "24h % Change",
      value: `${price24hChange >= 0 ? "+" : ""}${Math.abs(price24hChange).toFixed(4)}%`,
      valueColor: positive ? "text-green-600" : "text-red-500",
    },
    {
      icon: <BarChart2 className="w-3.5 h-3.5" />,
      label: "Market Cap",
      value: `$ ${fmtNum(fromCoin.marketCap, 4)}`,
    },
    {
      icon: <Activity className="w-3.5 h-3.5" />,
      label: "24h Volume",
      value: `$ ${fmtNum(fromCoin.volume24h, 4)}`,
    },
    {
      icon: <Coins className="w-3.5 h-3.5" />,
      label: "Circulating Supply",
      value: fmtNum(fromCoin.supply, 4),
    },
  ];

  const updStr = updatedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="p-4 md:p-6 pb-20 max-w-2xl mx-auto space-y-5">

      {/* ── Exchange widget ─────────────────────────────────────────────── */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {/* You send */}
          <div className="px-5 pt-5 pb-4 border-b">
            <p className="text-xs text-muted-foreground mb-2">You send</p>
            <div className="flex items-center gap-3">
              <Input
                value={fromAmount}
                onChange={e => setFromAmount(e.target.value)}
                type="number"
                step="0.0001"
                placeholder="0.1"
                className="flex-1 border-0 text-2xl font-light p-0 h-auto focus-visible:ring-0 shadow-none bg-transparent"
                data-testid="input-from-amount"
              />
              <CryptoPicker value={fromId} onChange={handleFromChange} exclude={toId} />
            </div>
          </div>

          {/* Floating rate row */}
          <div className="flex items-center justify-between px-5 py-3 bg-muted/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="w-3.5 h-3.5" />
              <span>Floating rate</span>
            </div>
            <button
              onClick={handleSwap}
              className="w-7 h-7 rounded-md bg-background border flex items-center justify-center hover-elevate"
              data-testid="button-swap"
              title="Swap currencies"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* You get */}
          <div className="px-5 pt-4 pb-5 border-b">
            <p className="text-xs text-muted-foreground mb-2">You get</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-2xl font-light text-muted-foreground">
                {toAmount ? `≈ ${toAmount}` : <span className="text-muted-foreground/50">—</span>}
              </div>
              <CryptoPicker value={toId} onChange={handleToChange} exclude={fromId} />
            </div>
          </div>

          {/* Exchange button */}
          <div className="px-5 py-4">
            {fromAmount && parseFloat(fromAmount) > 0 && (
              <p className="text-xs text-muted-foreground mb-3 text-center font-mono">
                1 {fromCoin.symbol} ≈ {rate.toFixed(8)} {toCoin.symbol}
              </p>
            )}
            <Button
              onClick={handleExchange}
              disabled={exchangeMutation.isPending || !fromAmount || parseFloat(fromAmount) <= 0}
              className="w-full h-11 font-semibold text-base"
              style={{ backgroundColor: "#1a56db" }}
              data-testid="button-exchange"
            >
              {exchangeMutation.isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                : "Exchange"
              }
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Market Data + TradingView chart ─────────────────────────────── */}
      <Card className="border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <p className="font-semibold text-sm">
              {fromCoin.name} ({fromCoin.symbol}) Market Data
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>upd at {updStr}</span>
            <RefreshCw className="w-3 h-3 animate-spin" />
          </div>
        </div>
        <TradingViewChart key={fromCoin.tvSymbol} tvSymbol={fromCoin.tvSymbol} />
      </Card>

      {/* ── Coin detail stats ───────────────────────────────────────────── */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {/* Coin header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: fromCoin.lightBg }}
            >
              <CryptoIcon symbol={fromCoin.symbol} size={24} color={fromCoin.color} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{fromCoin.symbol} Price</p>
              <p className="text-xl font-bold font-mono">
                $ {fmtNum(fromPrice, fromPrice < 1 ? 4 : 4)}
              </p>
            </div>
          </div>

          {/* Stats list */}
          <div className="divide-y">
            {statsRows.slice(1).map((s, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                <div className="mt-0.5 text-muted-foreground flex-shrink-0">{s.icon}</div>
                <div>
                  <p className="text-xs font-medium" style={{ color: "#0d9488" }}>{s.label}</p>
                  <p className={`text-base font-semibold font-mono mt-0.5 ${s.valueColor ?? "text-foreground"}`}>
                    {s.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── All Time High ───────────────────────────────────────────────── */}
      <Card className="border shadow-sm">
        <CardContent className="px-5 py-5 space-y-4">
          <h2 className="text-base font-semibold">
            {fromCoin.name} ({fromCoin.symbol}) All Time High
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {fromCoin.symbol} reached its all-time high price of{" "}
            <span className="font-semibold text-foreground">
              ${fmtNum(fromCoin.athPrice, 2)}
            </span>{" "}
            on {fromCoin.athDate}. Based on the current market price of{" "}
            <span className="font-semibold text-foreground">
              ${fmtNum(fromPrice, 2)}
            </span>{" "}
            in USD, {fromCoin.name} ({fromCoin.symbol}) is currently trading approximately{" "}
            <span className="font-semibold text-red-500">
              {fromCoin.athPct.toFixed(2)}% below
            </span>{" "}
            its record peak.
          </p>

          <div className="pt-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Stats</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-md px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium" style={{ color: "#0d9488" }}>ATH Price</p>
                </div>
                <p className="text-base font-bold font-mono">
                  ${fmtNum(fromCoin.athPrice, 2)}
                </p>
              </div>
              <div className="bg-muted/40 rounded-md px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium" style={{ color: "#0d9488" }}>ATH Date</p>
                </div>
                <p className="text-base font-bold">{fromCoin.athDate}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* ── Panel Dispersión (solo si tiene wallet registrada) ────────────── */}
      {coldWallet && (
        <Card className="border shadow-sm">
          <CardContent className="p-0">

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b">
              <div className="w-9 h-9 rounded-md bg-[#c8322b]/10 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-5 h-5 text-[#c8322b]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Wallet Fría Registrada</p>
                <p className="text-xs text-muted-foreground">Método de dispersión activo</p>
              </div>
              <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate text-[10px]">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Verificada
              </Badge>
            </div>

            {/* Wallet info */}
            <div className="px-5 py-4 border-b space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Dirección</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono text-foreground break-all flex-1" data-testid="text-wallet-address">
                    {coldWallet}
                  </p>
                  <button
                    onClick={handleCopy}
                    className="flex-shrink-0 w-7 h-7 rounded-md border flex items-center justify-center hover-elevate"
                    title="Copiar dirección"
                    data-testid="button-copy-wallet"
                  >
                    {copied
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    }
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Red</p>
                  <p className="text-xs font-semibold text-foreground" data-testid="text-wallet-network">{coldNetwork}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Token</p>
                  <p className="text-xs font-semibold text-foreground" data-testid="text-wallet-token">{coldToken}</p>
                </div>
              </div>
            </div>

            {/* Dispersión form */}
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nueva Dispersión</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="0.0000"
                  value={dispAmount}
                  onChange={e => setDispAmount(e.target.value)}
                  className="flex-1 font-mono text-sm"
                  data-testid="input-dispersion-amount"
                />
                <div className="w-32 flex-shrink-0">
                  <Select value={dispToken} onValueChange={setDispToken}>
                    <SelectTrigger className="text-xs" data-testid="select-dispersion-token">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRYPTOS.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-1.5">
                            <CryptoIcon symbol={c.symbol} size={13} color={c.color} />
                            <span className="text-xs font-semibold">{c.symbol}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/40 rounded-md px-3 py-2">
                <Send className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  → {coldWallet.slice(0, 14)}…{coldWallet.slice(-6)}
                </span>
              </div>
              <Button
                onClick={handleDispersar}
                disabled={dispersionMutation.isPending || !dispAmount || parseFloat(dispAmount) <= 0}
                className="w-full"
                style={{ backgroundColor: "#c8322b" }}
                data-testid="button-dispersar"
              >
                {dispersionMutation.isPending
                  ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Procesando…</>
                  : <><Send className="w-4 h-4 mr-2" /> Dispersar a Wallet Fría</>
                }
              </Button>
            </div>

          </CardContent>
        </Card>
      )}

    </div>
  );
}
