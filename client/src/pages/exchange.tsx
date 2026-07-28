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
  Wallet, Send, ShieldCheck, Copy, CheckCircle2, AlertTriangle,
  Wifi, WifiOff, Zap, History, ArrowRight, ChevronRight,
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

interface LiveCryptoData {
  price:     number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  supply:    number;
  athPrice:  number;
  athDate:   string;
  ask?:      number;
  bid?:      number;
  spread?:   number;
}

interface KrakenOrderBook {
  asset:  string;
  pair:   string;
  asks:   Array<[string, string, number]>;
  bids:   Array<[string, string, number]>;
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
  marginPercentage?: number | null;
  posLocked?: boolean;
  restricted?: boolean;
  paymentWarning?: string | null;
}

interface MarginParticipant {
  name: string; pct: number; amountUSD: number;
  wallet: string | null; network: string | null; token: string | null;
  dispersedUSD: number; availableUSD: number;
}
interface MarginPool {
  totalPool: number; operationalMargin: number;
  participants: MarginParticipant[];
}

interface BrokerNetwork {
  id: string; name: string; token: string; withdrawEnabled: boolean;
}
interface BrokerStatus {
  id: string; name: string; legalName: string; type: string;
  registryStatus: string; pingStatus: "online" | "offline" | "restricted";
  active: boolean; priority: number; jurisdiction: string;
  latencyMs: number | null; note: string; inactiveReason?: string;
  complianceStatus: string;
  fatfCompliant: boolean; fincenMsb: boolean; micaCompliant: boolean; ofacScreening: boolean;
  kycTier: string; maxTxUSD: number; travelRuleThresholdUSD: number;
  networks: BrokerNetwork[];
  fees: { maker: number; taker: number; otcFee?: number };
  capabilities: { spotTrading: boolean; priceData: boolean; withdrawals: boolean; travelRuleSupport: boolean };
}

interface RecentTx {
  transactionId: string; type: string; amount: string; currency: string;
  status: string; description: string; createdAt: string; createdBy: string;
}

const EXCHANGE_MAINTENANCE = true;

export default function ExchangePage() {
  const { toast } = useToast();
  const { user } = useAuth();

  if (EXCHANGE_MAINTENANCE) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Icono */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                <ArrowRightLeft className="w-10 h-10 text-yellow-500" />
              </div>
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center">
                <Lock className="w-3.5 h-3.5 text-black" />
              </div>
            </div>
          </div>

          {/* Título */}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Módulo en Mantenimiento
            </h1>
            <p className="mt-2 text-zinc-400 text-sm leading-relaxed">
              El módulo de Exchange & Dispersión está siendo calibrado para
              ofrecerte una mejor experiencia. Estará disponible nuevamente
              en breve.
            </p>
          </div>

          {/* Estado */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left space-y-3">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Estado del sistema</p>
            <div className="space-y-2">
              {[
                { label: "Precios de mercado",    ok: true  },
                { label: "Brokers conectados",    ok: true  },
                { label: "Motor de intercambio",  ok: false },
                { label: "Dispersión de activos", ok: false },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">{label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ok ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                    {ok ? "Operativo" : "Calibrando"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Nota admin */}
          {user?.role === "ADMIN" && (
            <p className="text-xs text-zinc-600 border border-zinc-800 rounded-lg px-3 py-2">
              <span className="text-yellow-500 font-medium">Admin:</span> cambia{" "}
              <code className="text-zinc-400">EXCHANGE_MAINTENANCE</code> a{" "}
              <code className="text-zinc-400">false</code> en{" "}
              <code className="text-zinc-400">exchange.tsx</code> para reactivar.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Wallet / dispersión ─────────────────────────────────────────────────
  const { data: subData } = useQuery<SubData>({
    queryKey: ["/api/subscription"],
    enabled: !!user,
  });
  const coldWallet      = subData?.walletAddress ?? null;
  const coldNetwork     = subData?.walletNetwork ?? "ETHEREUM (ERC-20)";
  const coldToken       = subData?.walletToken   ?? "ETH";
  const marginPct       = subData?.marginPercentage ?? null;
  const subLocked       = !!(subData?.posLocked);
  const subPayWarning   = subData?.paymentWarning ?? null;

  // Margen operacional global (visible para participantes y admin)
  const isMarginUser = marginPct !== null || user?.role === "ADMIN";
  const { data: marginPool } = useQuery<MarginPool>({
    queryKey: ["/api/margin-pool"],
    enabled: !!user && isMarginUser,
    refetchInterval: 15000,
  });

  // Transacciones del usuario para calcular saldo disponible
  const { data: userTxs = [] } = useQuery<{ transactionId: string; amount: string; status: string; currency: string }[]>({
    queryKey: ["/api/transactions"],
    enabled: !!user,
    refetchInterval: 15000,
  });

  const totalDispersado = userTxs
    .filter(t => t.status === "completed" && t.transactionId.startsWith("DSP-") && (t.currency ?? "USD") === "USD")
    .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);

  // Para usuarios con porcentaje de margen, su saldo = su parte del pool - lo ya dispersado
  const myMarginAllocation = marginPct !== null && marginPool
    ? (marginPool.operationalMargin * marginPct) / 100
    : null;

  const totalIngresado = myMarginAllocation !== null
    ? myMarginAllocation
    : userTxs
        .filter(t => t.status === "completed" && !t.transactionId.startsWith("DSP-") && (t.currency ?? "USD") === "USD")
        .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);

  const availableUSD = Math.max(0, totalIngresado - totalDispersado);

  // Saldo disponible en EUR — proviene de transacciones del POS Virtual liquidadas en EUR
  const totalIngresadoEUR = userTxs
    .filter(t => t.status === "completed" && !t.transactionId.startsWith("DSP-") && t.currency === "EUR")
    .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
  const totalDispersadoEUR = userTxs
    .filter(t => t.status === "completed" && t.transactionId.startsWith("DSP-") && t.currency === "EUR")
    .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
  const availableEUR = Math.max(0, totalIngresadoEUR - totalDispersadoEUR);

  const hasBalance = availableUSD > 0.001 || availableEUR > 0.001;

  const [dispFiat,   setDispFiat]   = useState<"USD" | "EUR">("USD");
  const [dispAmount, setDispAmount] = useState("");
  const [dispToken,  setDispToken]  = useState("eth");
  const [manualWallet, setManualWallet] = useState("");
  const [copied,     setCopied]     = useState(false);

  const [fromId, setFromId] = useState("eth");
  const [toId, setToId]     = useState("btc");
  const [fromAmount, setFromAmount] = useState("0.1");
  const [confirmSwap, setConfirmSwap] = useState(false);

  const SLIPPAGE_PCT = 0.5; // 0.5%

  const { data: liveData, dataUpdatedAt } = useQuery<Record<string, LiveCryptoData>>({
    queryKey: ["/api/crypto-prices"],
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  });

  // Saldos cripto reales del usuario (persistidos en el servidor, sin blockchain)
  const { data: cryptoBalances } = useQuery<Record<string, number>>({
    queryKey: ["/api/crypto-balances"],
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Estado de brokers
  const { data: brokerStatuses, isLoading: brokersLoading } = useQuery<BrokerStatus[]>({
    queryKey: ["/api/broker-status"],
    enabled: !!user,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Historial reciente de exchange/dispersión
  const { data: recentTxs = [] } = useQuery<RecentTx[]>({
    queryKey: ["/api/crypto/recent"],
    enabled: !!user,
    refetchInterval: 20000,
  });

  // Order book OKX en tiempo real (activo seleccionado)
  const { data: orderBook, dataUpdatedAt: obUpdatedAt } = useQuery<KrakenOrderBook>({
    queryKey: ["/api/okx/orderbook", fromId],
    queryFn: () => fetch(`/api/okx/orderbook/${fromId}?count=8`).then(r => r.json()),
    enabled: !!user && fromId !== "usdt",
    refetchInterval: 10000,
    staleTime: 8000,
  });

  function mergeLive(coin: Crypto): Crypto {
    const live = liveData?.[coin.id];
    if (!live) return coin;
    return {
      ...coin,
      basePrice: live.price ?? coin.basePrice,
      change24h: live.change24h ?? coin.change24h,
      volume24h: live.volume24h ?? coin.volume24h,
      marketCap: live.marketCap ?? coin.marketCap,
      supply: live.supply ?? coin.supply,
      athPrice: live.athPrice ?? coin.athPrice,
      athDate: live.athDate
        ? new Date(live.athDate).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
        : coin.athDate,
    };
  }

  // ── Motor de Dispersión Fiat → Crypto (USD/EUR de POS Virtual → activo cripto) ──
  const FIAT_USD_RATE: Record<"USD" | "EUR", number> = { USD: 1, EUR: 1.085 };
  const availableByFiat: Record<"USD" | "EUR", number> = { USD: availableUSD, EUR: availableEUR };

  const destWallet = coldWallet ?? (manualWallet.trim() || null);
  const currentFiatAvailable = availableByFiat[dispFiat];
  const dispCoin = mergeLive(CRYPTOS.find(c => c.id === dispToken)!);
  const dispCryptoPrice = dispCoin.basePrice;
  const dispUsdEquivalent = (parseFloat(dispAmount) || 0) * FIAT_USD_RATE[dispFiat];
  const dispCryptoAmount = dispCryptoPrice > 0 ? dispUsdEquivalent / dispCryptoPrice : 0;

  function handleCopy() {
    if (!coldWallet) return;
    navigator.clipboard.writeText(coldWallet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleFlipFiat() {
    setDispFiat(prev => (prev === "USD" ? "EUR" : "USD"));
    setDispAmount("");
  }

  const dispersionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crypto/dispersion", {
        cryptoAsset:   dispToken,
        cryptoAmount:  dispCryptoAmount,
        cryptoSymbol:  dispCoin.symbol,
        fiatAmount:    parseFloat(dispAmount),
        fiatCurrency:  dispFiat,
        destWallet:    destWallet ?? "—",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error");
      }
      return { amount: dispAmount, symbol: dispCoin.symbol, crypto: dispCryptoAmount };
    },
    onSuccess: ({ amount, symbol, crypto }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crypto-balances"] });
      toast({
        title: "Dispersión enviada",
        description: `${amount} ${dispFiat} → ${crypto.toFixed(8)} ${symbol} — wallet registrada`,
      });
      setDispAmount("");
    },
    onError: (err: Error) => {
      toast({ title: "Error al dispersar", description: err.message, variant: "destructive" });
    },
  });

  function handleDispersar() {
    const amt = parseFloat(dispAmount);
    if (!dispAmount || isNaN(amt) || amt <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a 0", variant: "destructive" });
      return;
    }
    if (amt > currentFiatAvailable) {
      toast({
        title: "Saldo insuficiente",
        description: `Necesitas ${amt.toFixed(2)} ${dispFiat} pero solo tienes ${currentFiatAvailable.toFixed(2)} ${dispFiat} disponibles.`,
        variant: "destructive",
      });
      return;
    }
    if (!destWallet) {
      toast({ title: "Wallet requerida", description: "Ingresa la dirección de destino para la dispersión.", variant: "destructive" });
      return;
    }
    dispersionMutation.mutate();
  }

  const fromCoin = mergeLive(CRYPTOS.find(c => c.id === fromId)!);
  const toCoin   = mergeLive(CRYPTOS.find(c => c.id === toId)!);
  const fromPrice = fromCoin.basePrice;
  const toPrice   = toCoin.basePrice;
  const rate = fromPrice / toPrice;
  const toAmount = fromAmount && parseFloat(fromAmount) > 0
    ? (parseFloat(fromAmount) * rate).toFixed(8)
    : "";

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

  const fromBalance = cryptoBalances?.[fromId] ?? 0;
  const toBalance   = cryptoBalances?.[toId] ?? 0;

  const exchangeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crypto/exchange", {
        fromAsset: fromId,
        toAsset: toId,
        fromAmount: parseFloat(fromAmount),
        toAmount: parseFloat(toAmount),
        fromSymbol: fromCoin.symbol,
        toSymbol: toCoin.symbol,
        rate,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crypto-balances"] });
      toast({ title: "Intercambio realizado", description: `${fromAmount} ${fromCoin.symbol} → ${toAmount} ${toCoin.symbol}` });
    },
    onError: (err: Error) => {
      toast({ title: "Error al procesar intercambio", description: err.message, variant: "destructive" });
    },
  });

  function handleExchange() {
    const amt = parseFloat(fromAmount);
    if (!fromAmount || isNaN(amt) || amt <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a 0", variant: "destructive" });
      return;
    }
    if (amt > fromBalance) {
      toast({
        title: "Saldo insuficiente",
        description: `Necesitas ${amt} ${fromCoin.symbol} pero solo tienes ${fromBalance.toFixed(8)} ${fromCoin.symbol} disponibles.`,
        variant: "destructive",
      });
      return;
    }
    setConfirmSwap(true);
  }

  function handleConfirmExchange() {
    setConfirmSwap(false);
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

  const updStr = new Date(dataUpdatedAt || Date.now()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  // Slippage sobre toAmount
  const toAmountAfterSlippage = toAmount
    ? (parseFloat(toAmount) * (1 - SLIPPAGE_PCT / 100)).toFixed(8)
    : "";

  const fromUsdValue = fromPrice * (parseFloat(fromAmount) || 0);
  const toUsdValue   = toPrice   * (parseFloat(toAmount)   || 0);

  return (
    <div className="p-4 md:p-6 pb-20 max-w-2xl mx-auto space-y-5">

      {/* ── Panel de brokers con compliance ─────────────────────────── */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center gap-3 px-5 py-3 border-b">
            <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-[#1a56db]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Brokers · Compliance & Estado</p>
              <p className="text-[10px] text-muted-foreground">Binance (principal) · OKX (respaldo) · Kraken (respaldo 2) — ping en tiempo real · caché 30s</p>
            </div>
            {brokersLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>

          <div className="divide-y">
            {(brokerStatuses ?? []).map(b => {
              const isOnline     = b.pingStatus === "online";
              const isRestricted = b.pingStatus === "restricted";
              const compColor =
                b.complianceStatus === "compliant" ? "text-green-700 bg-green-50" :
                b.complianceStatus === "partial"    ? "text-amber-700 bg-amber-50" :
                                                      "text-red-600 bg-red-50";
              return (
                <div key={b.id} className="px-5 py-4 space-y-3">
                  {/* Row 1: name + status badges */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        isOnline ? "bg-green-500 animate-pulse" : isRestricted ? "bg-amber-400" : "bg-red-400"
                      }`} />
                      <span className="font-bold text-sm">{b.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{b.legalName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {b.latencyMs !== null && isOnline && (
                        <span className="text-[10px] font-mono text-muted-foreground">{b.latencyMs}ms</span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${
                        isOnline ? "bg-green-100 text-green-700" : isRestricted ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"
                      }`}>
                        {isOnline ? "ONLINE" : isRestricted ? "RESTRINGIDO" : "OFFLINE"}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${compColor}`}>
                        {b.complianceStatus.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: jurisdiction + priority */}
                  <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
                    <span className="font-mono">{b.jurisdiction}</span>
                    <span>·</span>
                    <span>Prioridad {b.priority}</span>
                    {b.fees && (
                      <>
                        <span>·</span>
                        <span>Maker {b.fees.maker}% / Taker {b.fees.taker}%</span>
                      </>
                    )}
                  </div>

                  {/* Row 3: compliance badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "FATF",   ok: b.fatfCompliant },
                      { label: "FinCEN", ok: b.fincenMsb    },
                      { label: "MiCA",   ok: b.micaCompliant },
                      { label: "OFAC",   ok: b.ofacScreening },
                      { label: "Travel Rule", ok: b.capabilities?.travelRuleSupport },
                    ].map(({ label, ok }) => (
                      <span key={label} className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${
                        ok ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                      }`}>
                        {ok ? "✓" : "—"} {label}
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                      KYC {b.kycTier}
                    </span>
                  </div>

                  {/* Row 4: AML thresholds */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Máx. Tx",     val: b.maxTxUSD,               fmt: (v:number)=> v > 0 ? `$${(v/1e6).toFixed(1)}M` : "—" },
                      { label: "Travel Rule", val: b.travelRuleThresholdUSD,  fmt: (v:number)=> v > 0 ? `≥$${v.toLocaleString()}` : "—" },
                      { label: "CTR/SAR",     val: 10000,                     fmt: ()=> "≥$10,000" },
                    ].map(({ label, val, fmt }) => (
                      <div key={label} className="bg-muted/40 rounded px-2 py-1.5">
                        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                        <p className="text-[11px] font-mono font-bold mt-0.5">{fmt(val)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Row 5: networks */}
                  {b.networks && b.networks.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {b.networks.map(n => (
                        <span key={n.id} className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                          n.withdrawEnabled ? "bg-blue-50 text-[#1a56db]" : "bg-muted text-muted-foreground"
                        }`}>
                          {n.name} {n.withdrawEnabled ? "↑" : "·"}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Row 6: inactiveReason / note */}
                  {(b.inactiveReason || b.note) && (
                    <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded px-2.5 py-2 leading-relaxed">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-500" />
                      <span>{b.inactiveReason || b.note}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {!brokerStatuses && !brokersLoading && (
              <p className="text-xs text-muted-foreground text-center py-4">Verificando conexiones…</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Aviso de suscripción suspendida (solo cuando posLocked) ── */}
      {subLocked && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 space-y-2.5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-amber-900 text-sm">Membresía con saldo pendiente</p>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Tu acceso a Exchange está activo para consulta de precios. Las operaciones de dispersión permanecen <strong>suspendidas</strong> hasta regularizar el contrato de suscripción.
              </p>
              {coldWallet && (
                <div className="mt-2 bg-amber-100 border border-amber-200 rounded px-2.5 py-2 space-y-0.5">
                  <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Wallet registrada para dispersión</p>
                  <p className="text-[11px] font-mono text-amber-900 break-all">{coldWallet}</p>
                  <p className="text-[10px] text-amber-700">{coldNetwork} · {coldToken}</p>
                </div>
              )}
              {subPayWarning && (
                <p className="text-[10px] text-amber-900 font-mono mt-2 bg-amber-100 border border-amber-200 rounded px-2 py-1.5 leading-relaxed">
                  {subPayWarning}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="outline"
              className="text-xs border-amber-400 text-amber-800 flex-shrink-0"
              onClick={() => window.location.href = "/subscription"}>
              Ver membresía
            </Button>
          </div>
        </div>
      )}

      {/* ── Kraken Order Book (activo seleccionado) ─────────────────────── */}
      {fromId !== "usdt" && (
        <Card className="border shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold">Kraken Order Book</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {({ btc:"BTC-USDT", eth:"ETH-USDT", xrp:"XRP-USDT", ltc:"LTC-USDT", doge:"DOGE-USDT", sol:"SOL-USDT", ada:"ADA-USDT", dot:"DOT-USDT" } as Record<string,string>)[fromId] ?? (fromId.toUpperCase()+"-USDT")} · Live
                </span>
              </div>
              <div className="flex items-center gap-2">
                {orderBook && (
                  <>
                    <span className="text-[10px] text-green-600 font-mono font-bold">
                      Bid ${parseFloat(orderBook.bids?.[0]?.[0] ?? "0").toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-red-500 font-mono font-bold">
                      Ask ${parseFloat(orderBook.asks?.[0]?.[0] ?? "0").toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {orderBook.asks?.[0] && orderBook.bids?.[0] && (() => {
                      const ask = parseFloat(orderBook.asks[0][0]);
                      const bid = parseFloat(orderBook.bids[0][0]);
                      const spread = ask > 0 ? ((ask - bid) / ask * 100).toFixed(3) : "—";
                      return (
                        <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                          Spread {spread}%
                        </span>
                      );
                    })()}
                  </>
                )}
                <span className="text-[9px] text-muted-foreground">
                  {obUpdatedAt ? new Date(obUpdatedAt).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                </span>
              </div>
            </div>

            {/* Book columns */}
            {orderBook ? (
              <div className="grid grid-cols-2 divide-x">
                {/* Bids */}
                <div>
                  <div className="flex justify-between px-3 py-1 text-[9px] font-semibold text-green-700 uppercase tracking-wider border-b bg-green-50/50">
                    <span>Bid</span><span>Vol</span>
                  </div>
                  {(orderBook.bids ?? []).slice(0, 6).map(([price, vol], i) => (
                    <div key={i} className="relative flex justify-between px-3 py-1">
                      <div
                        className="absolute inset-y-0 left-0 bg-green-100/60"
                        style={{ width: `${Math.min((parseFloat(vol) / parseFloat(orderBook.bids[0][1])) * 100, 100)}%` }}
                      />
                      <span className="relative text-[10px] font-mono text-green-700 font-semibold z-10">
                        ${parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="relative text-[10px] font-mono text-muted-foreground z-10">
                        {parseFloat(vol).toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Asks */}
                <div>
                  <div className="flex justify-between px-3 py-1 text-[9px] font-semibold text-red-600 uppercase tracking-wider border-b bg-red-50/50">
                    <span>Ask</span><span>Vol</span>
                  </div>
                  {(orderBook.asks ?? []).slice(0, 6).map(([price, vol], i) => (
                    <div key={i} className="relative flex justify-between px-3 py-1">
                      <div
                        className="absolute inset-y-0 left-0 bg-red-100/60"
                        style={{ width: `${Math.min((parseFloat(vol) / parseFloat(orderBook.asks[0][1])) * 100, 100)}%` }}
                      />
                      <span className="relative text-[10px] font-mono text-red-600 font-semibold z-10">
                        ${parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="relative text-[10px] font-mono text-muted-foreground z-10">
                        {parseFloat(vol).toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                <RefreshCw className="w-3 h-3 animate-spin" /> Cargando order book…
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Exchange widget ─────────────────────────────────────────────── */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {/* You send */}
          <div className="px-5 pt-5 pb-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">You send</p>
              <button
                onClick={() => setFromAmount(fromBalance > 0 ? fromBalance.toFixed(8) : "")}
                disabled={fromBalance <= 0}
                className="text-[10px] font-bold text-[#1a56db] disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="button-max-exchange"
              >
                Disponible: {fromBalance.toFixed(8)} {fromCoin.symbol} · MAX
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  value={fromAmount}
                  onChange={e => { setFromAmount(e.target.value); setConfirmSwap(false); }}
                  type="number"
                  step="0.0001"
                  placeholder="0.1"
                  className="border-0 text-2xl font-light p-0 h-auto focus-visible:ring-0 shadow-none bg-transparent w-full"
                  data-testid="input-from-amount"
                />
                {fromAmount && parseFloat(fromAmount) > 0 && (
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    ≈ ${fromUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </p>
                )}
              </div>
              <CryptoPicker value={fromId} onChange={id => { handleFromChange(id); setConfirmSwap(false); }} exclude={toId} />
            </div>
          </div>

          {/* Floating rate row */}
          <div className="flex items-center justify-between px-5 py-3 bg-muted/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="w-3.5 h-3.5" />
              <span>Floating rate · <span className="font-mono text-[10px]">Slippage {SLIPPAGE_PCT}%</span></span>
            </div>
            <button
              onClick={() => { handleSwap(); setConfirmSwap(false); }}
              className="w-7 h-7 rounded-md bg-background border flex items-center justify-center hover-elevate"
              data-testid="button-swap"
              title="Swap currencies"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* You get */}
          <div className="px-5 pt-4 pb-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">You get</p>
              <span className="text-[10px] text-muted-foreground font-mono" data-testid="text-to-balance">
                Disponible: {toBalance.toFixed(8)} {toCoin.symbol}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-2xl font-light text-muted-foreground">
                  {toAmount ? `≈ ${toAmount}` : <span className="text-muted-foreground/50">—</span>}
                </div>
                {toAmount && parseFloat(toAmount) > 0 && (
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    ≈ ${toUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </p>
                )}
              </div>
              <CryptoPicker value={toId} onChange={id => { handleToChange(id); setConfirmSwap(false); }} exclude={fromId} />
            </div>
          </div>

          {/* Slippage breakdown */}
          {fromAmount && parseFloat(fromAmount) > 0 && toAmount && (
            <div className="px-5 py-3 border-b bg-muted/20 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>Tasa</span>
                <span>1 {fromCoin.symbol} ≈ {rate.toFixed(8)} {toCoin.symbol}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>Slippage ({SLIPPAGE_PCT}%)</span>
                <span className="text-amber-600">−{(parseFloat(toAmount) * SLIPPAGE_PCT / 100).toFixed(8)} {toCoin.symbol}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-semibold font-mono">
                <span>Mínimo recibido</span>
                <span className="text-green-700">{toAmountAfterSlippage} {toCoin.symbol}</span>
              </div>
            </div>
          )}

          {/* Exchange button / confirmation */}
          <div className="px-5 py-4">
            {!confirmSwap ? (
              <Button
                onClick={handleExchange}
                disabled={exchangeMutation.isPending || !fromAmount || parseFloat(fromAmount) <= 0}
                className="w-full h-11 font-semibold text-base"
                style={{ backgroundColor: "#1a56db" }}
                data-testid="button-exchange"
              >
                {exchangeMutation.isPending
                  ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                  : <><ArrowRightLeft className="w-4 h-4 mr-2" /> Exchange</>
                }
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-[#1a56db]/30 bg-blue-50 px-4 py-3 space-y-1.5">
                  <p className="text-xs font-bold text-[#1a56db]">Confirmar intercambio</p>
                  <div className="flex items-center gap-2 text-sm font-mono">
                    <span className="font-semibold">{parseFloat(fromAmount).toFixed(8)} {fromCoin.symbol}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold text-green-700">≥ {toAmountAfterSlippage} {toCoin.symbol}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Valor estimado: ${fromUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD · Slippage máx. {SLIPPAGE_PCT}%
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-9 text-sm"
                    onClick={() => setConfirmSwap(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirmExchange}
                    disabled={exchangeMutation.isPending}
                    className="flex-1 h-9 font-semibold text-sm"
                    style={{ backgroundColor: "#1a56db" }}
                    data-testid="button-exchange-confirm"
                  >
                    {exchangeMutation.isPending
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Confirmar</>
                    }
                  </Button>
                </div>
              </div>
            )}
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
              {(fromCoin.athPrice > 0 ? ((fromCoin.athPrice - fromPrice) / fromCoin.athPrice) * 100 : 0).toFixed(2)}% below
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


      {/* ── Panel Distribución del Margen Operacional ──────────────────────── */}
      {isMarginUser && marginPool && (() => {
        const MONTHLY_GOAL = 40_000_000;
        const GOAL_MARGIN  = MONTHLY_GOAL * 0.50;
        const PALETTE      = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-[#c8322b]", "bg-orange-400", "bg-teal-500"];

        // Usa directamente los participantes del servidor (ya incluye Socemro, Emiliano, Agustín)
        const participants = marginPool.participants;

        return (
          <Card className="border shadow-sm">
            <CardContent className="p-0">

              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b">
                <div className="w-9 h-9 rounded-md bg-[#c8322b]/10 flex items-center justify-center flex-shrink-0">
                  <BarChart2 className="w-5 h-5 text-[#c8322b]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Distribución del Margen Operacional</p>
                  <p className="text-xs text-muted-foreground">Art. 6.5 del contrato — 50% del total operacional</p>
                </div>
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 no-default-active-elevate text-[10px]">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Proyección
                </Badge>
              </div>

              {/* Aviso estimación */}
              <div className="mx-5 mt-4 mb-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 leading-relaxed">
                  <span className="font-semibold">Estimación proyectada — no refleja fondos reales.</span>{" "}
                  Los montos mostrados corresponden a una meta operacional mensual de referencia de{" "}
                  <span className="font-semibold font-mono">$40,000,000 USD</span>.
                </div>
              </div>

              {/* Meta totales */}
              <div className="grid grid-cols-3 gap-0 border-y mx-5 my-3 rounded-md overflow-hidden border">
                <div className="px-4 py-3 border-r">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Meta mensual</p>
                  <p className="text-sm font-bold font-mono mt-0.5">$40,000,000</p>
                  <p className="text-[9px] text-muted-foreground">USD / mes</p>
                </div>
                <div className="px-4 py-3 border-r">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Margen (50%)</p>
                  <p className="text-sm font-bold font-mono mt-0.5 text-[#c8322b]">$20,000,000</p>
                  <p className="text-[9px] text-muted-foreground">USD / mes</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Real acumulado</p>
                  <p className="text-sm font-bold font-mono mt-0.5 text-muted-foreground">
                    ${marginPool.totalPool.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[9px] text-muted-foreground">USD hoy</p>
                </div>
              </div>

              {/* Participants — datos en tiempo real del servidor */}
              <div className="px-5 pb-4 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Participantes · datos en tiempo real
                </p>
                {participants.map((p, i) => {
                  const projectedMonthly = GOAL_MARGIN * (p.pct / 100);
                  const colorClass = PALETTE[i % PALETTE.length];
                  const isBanxico = p.name === "Banxico Plus LLC";
                  const isMe = user?.role === "ADMIN" ||
                    (p.name === "Dany León Pinto" && user?.username === "danyleonpinto") ||
                    (p.name === "JM Open Door"    && user?.username === "jmdoorsopen@gmail.com") ||
                    (p.name === "Socemro"          && user?.email   === "socemro2@gmail.com");
                  return (
                    <div key={i} className={`rounded-md border px-4 py-3 space-y-2 ${isMe ? "border-[#c8322b]/40 bg-[#c8322b]/5" : "border-border bg-muted/20"}`}>

                      {/* Name + % */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${colorClass}`} />
                          <span className="font-semibold text-sm">{p.name}</span>
                          {isMe && user?.role !== "ADMIN" && (
                            <Badge className="bg-[#c8322b]/10 text-[#c8322b] border-[#c8322b]/30 no-default-active-elevate text-[9px]">
                              Tu cuenta
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm font-mono">{p.pct}%</span>
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                            ~${projectedMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })} / mes
                          </span>
                        </div>
                      </div>

                      {/* Barra */}
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${colorClass}`} style={{ width: `${Math.min(p.pct, 100)}%` }} />
                      </div>

                      {/* Wallet */}
                      {p.wallet && (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                          <Wallet className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{p.wallet.slice(0, 16)}…{p.wallet.slice(-6)}</span>
                          <span className="text-[9px] bg-muted rounded px-1 py-0.5 flex-shrink-0 whitespace-nowrap">{p.network} · {p.token}</span>
                        </div>
                      )}
                      {!p.wallet && !isBanxico && (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-600">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          <span>Wallet pendiente de registro</span>
                        </div>
                      )}
                      {isBanxico && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Red interna · Plataforma Banxico Plus LLC</span>
                        </div>
                      )}

                      {/* Saldos reales */}
                      {!isBanxico && (
                        <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-border/50">
                          <span className="text-muted-foreground">
                            Dispersado:{" "}
                            <span className="font-semibold text-foreground">
                              ${p.dispersedUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                            </span>
                          </span>
                          <span className={`font-semibold ${p.availableUSD > 0 ? "text-green-700" : "text-foreground"}`}>
                            Disponible: ${p.availableUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                <p className="text-[10px] text-muted-foreground pt-2 text-center leading-relaxed">
                  Saldos disponibles calculados en tiempo real desde transacciones completadas en plataforma.
                </p>
              </div>

            </CardContent>
          </Card>
        );
      })()}

      {/* ── Panel Dispersión — Conversión Fiat (USD/EUR de POS Virtual) → Crypto ── */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b">
            <div className="w-9 h-9 rounded-md bg-[#c8322b]/10 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5 text-[#c8322b]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Dispersión</p>
              <p className="text-xs text-muted-foreground">Conversión de saldo POS Virtual (USD/EUR) a criptoactivo</p>
              {/* Broker activo para dispersión */}
              <div className="flex items-center gap-1.5 mt-1">
                {(() => {
                  const kraken = brokerStatuses?.find(b => b.id === "kraken");
                  return kraken?.pingStatus === "online" ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Via Kraken · TRC-20
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                      <WifiOff className="w-2.5 h-2.5" />
                      Broker verificando…
                    </span>
                  );
                })()}
              </div>
            </div>
            {coldWallet ? (
              <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate text-[10px]">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Wallet verificada
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 no-default-active-elevate text-[10px]">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Sin wallet
              </Badge>
            )}
          </div>

          {/* Saldo actual */}
          <div className="px-5 py-4 border-b bg-muted/20">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Saldo actual</p>
              <div className="flex items-center rounded-md border border-border overflow-hidden">
                {(["USD", "EUR"] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => { setDispFiat(c); setDispAmount(""); }}
                    data-testid={`button-fiat-${c.toLowerCase()}`}
                    className={`px-3 py-1 text-[11px] font-bold transition-colors ${
                      dispFiat === c ? "bg-[#c8322b] text-white" : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <p
              className={`text-2xl font-bold font-mono ${currentFiatAvailable > 0.001 ? "text-green-700" : "text-red-600"}`}
              data-testid="text-available-balance"
            >
              {currentFiatAvailable.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              <span className="text-sm font-semibold">{dispFiat}</span>
            </p>
            {currentFiatAvailable <= 0.001 && (
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                No hay transacciones POS Virtual completadas en {dispFiat}. Cambia de divisa o registra una transacción.
              </p>
            )}
          </div>

          {/* Swap form: FROM (fiat) / TO (crypto) */}
          <div className="px-5 py-4 space-y-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nueva Dispersión</p>
              <p className="text-[10px] text-muted-foreground font-mono" data-testid="text-disp-crypto-balance">
                Saldo {dispCoin.symbol}: <span className="font-semibold text-foreground">{(cryptoBalances?.[dispToken] ?? 0).toFixed(8)}</span>
              </p>
            </div>

            {/* FROM box */}
            <div className="rounded-md border border-border px-4 py-3 bg-background">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground">Envías</span>
                <button
                  onClick={() => setDispAmount(currentFiatAvailable > 0 ? currentFiatAvailable.toFixed(2) : "")}
                  disabled={currentFiatAvailable <= 0.001}
                  className="text-[10px] font-bold text-[#c8322b] disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="button-max-dispersion"
                >
                  MAX
                </button>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={dispAmount}
                  onChange={e => setDispAmount(e.target.value)}
                  className="flex-1 border-0 text-2xl font-light p-0 h-auto focus-visible:ring-0 shadow-none bg-transparent"
                  data-testid="input-dispersion-amount"
                />
                <Badge className="bg-muted text-foreground border-border no-default-active-elevate text-xs font-bold flex-shrink-0">
                  {dispFiat}
                </Badge>
              </div>
            </div>

            {/* Swap toggle button (overlapping) */}
            <div className="flex justify-center -my-2.5 relative z-10">
              <button
                onClick={handleFlipFiat}
                className="w-8 h-8 rounded-md bg-foreground text-background border-4 border-background flex items-center justify-center hover-elevate"
                title="Cambiar divisa (USD ⇄ EUR)"
                data-testid="button-flip-fiat"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 rotate-90" />
              </button>
            </div>

            {/* TO box */}
            <div className="rounded-md border border-border px-4 py-3 bg-background">
              <p className="text-[10px] text-muted-foreground mb-2">Recibes (estimado)</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-2xl font-light text-muted-foreground truncate">
                  {dispAmount && parseFloat(dispAmount) > 0
                    ? `≈ ${dispCryptoAmount.toFixed(8)}`
                    : <span className="text-muted-foreground/50">0.00000000</span>
                  }
                </div>
                <CryptoPicker value={dispToken} onChange={setDispToken} />
              </div>
            </div>
          </div>

          {/* Preview + validación de saldo */}
          {dispAmount && parseFloat(dispAmount) > 0 && (
            <div className="px-5 pb-1">
              {(() => {
                const over = parseFloat(dispAmount) > currentFiatAvailable;
                return (
                  <div className={`flex items-center gap-2 text-xs font-mono rounded-md px-3 py-2 ${over ? "bg-red-50 text-red-600 border border-red-200" : "bg-muted/40 text-muted-foreground"}`}>
                    <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      1 {dispCoin.symbol} ≈ ${fmtNum(dispCryptoPrice, 2)} USD
                      {over ? ` — excede saldo (${currentFiatAvailable.toFixed(2)} ${dispFiat} disponibles)` : ` · de ${currentFiatAvailable.toFixed(2)} ${dispFiat} disponibles`}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Destino */}
          <div className="px-5 py-4 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Wallet de destino</p>
            {coldWallet ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/40 rounded-md px-3 py-2">
                <Send className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate flex-1" data-testid="text-wallet-address">
                  {coldWallet.slice(0, 14)}…{coldWallet.slice(-6)} · {coldNetwork}
                </span>
                <button
                  onClick={handleCopy}
                  className="flex-shrink-0 w-6 h-6 rounded-md border flex items-center justify-center hover-elevate"
                  title="Copiar dirección"
                  data-testid="button-copy-wallet"
                >
                  {copied
                    ? <CheckCircle2 className="w-3 h-3 text-green-600" />
                    : <Copy className="w-3 h-3 text-muted-foreground" />
                  }
                </button>
              </div>
            ) : (
              <Input
                placeholder="Pega la dirección de wallet destino (ej. 0x… / T…)"
                value={manualWallet}
                onChange={e => setManualWallet(e.target.value)}
                className="text-xs font-mono"
                data-testid="input-manual-wallet"
              />
            )}

            <Button
              onClick={handleDispersar}
              disabled={dispersionMutation.isPending || !dispAmount || parseFloat(dispAmount) <= 0 || !destWallet}
              className="w-full"
              style={{ backgroundColor: "#c8322b" }}
              data-testid="button-dispersar"
            >
              {dispersionMutation.isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Procesando…</>
                : <><Send className="w-4 h-4 mr-2" /> Dispersar y Convertir</>
              }
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* ── Historial reciente Exchange / Dispersión ────────────────────── */}
      {recentTxs.length > 0 && (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 px-5 py-3 border-b">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <History className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Historial reciente</p>
                <p className="text-[10px] text-muted-foreground">Últimas operaciones de swap y dispersión</p>
              </div>
            </div>
            <div className="divide-y">
              {recentTxs.map(tx => {
                const isExchange    = tx.transactionId.startsWith("EXC-");
                const isDispersion  = tx.transactionId.startsWith("DSP-");
                const dateStr = new Date(tx.createdAt).toLocaleString("es-MX", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                });
                return (
                  <div key={tx.transactionId} className="flex items-start gap-3 px-5 py-3">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isExchange ? "bg-blue-50" : isDispersion ? "bg-[#c8322b]/10" : "bg-muted"
                    }`}>
                      {isExchange
                        ? <ArrowRightLeft className="w-3.5 h-3.5 text-[#1a56db]" />
                        : <Send className="w-3.5 h-3.5 text-[#c8322b]" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <p className="text-xs font-semibold truncate">
                          {isExchange ? "Swap" : "Dispersión"}
                        </p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                          tx.status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {tx.status === "completed" ? "✓" : "…"} {tx.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate leading-relaxed mt-0.5">
                        {tx.description}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-mono text-muted-foreground">{dateStr}</span>
                        <span className="text-[10px] font-mono font-semibold">
                          {parseFloat(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })} {tx.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
