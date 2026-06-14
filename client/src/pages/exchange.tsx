import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Transaction } from "@shared/schema";
import {
  ArrowRightLeft, RefreshCw,
  DollarSign, Zap, BarChart2, Clock, Check, AlertTriangle,
  ChevronUp, ChevronDown
} from "lucide-react";
import { SiBitcoin, SiEthereum, SiLitecoin, SiDogecoin } from "react-icons/si";

interface Crypto {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: string;
  color: string;
}

const BASE_PRICES: Crypto[] = [
  { id: "usdt", name: "Tether",     symbol: "USDT",price:     1.00, change24h:  0.01, volume24h: 84000000000, marketCap: "$112B",  color: "text-green-600"  },
  { id: "btc",  name: "Bitcoin",    symbol: "BTC", price: 67240.50, change24h:  2.4,  volume24h: 32100000000, marketCap: "$1.32T", color: "text-orange-500" },
  { id: "eth",  name: "Ethereum",   symbol: "ETH", price:  3456.20, change24h:  1.8,  volume24h: 18400000000, marketCap: "$415B",  color: "text-purple-500" },
  { id: "xrp",  name: "XRP",        symbol: "XRP", price:     0.52, change24h: -1.2,  volume24h:  2100000000, marketCap: "$28B",   color: "text-blue-500"   },
  { id: "ltc",  name: "Litecoin",   symbol: "LTC", price:   142.87, change24h:  3.2,  volume24h:   890000000, marketCap: "$10.5B", color: "text-gray-500"   },
  { id: "ada",  name: "Cardano",    symbol: "ADA", price:     0.82, change24h: -0.5,  volume24h:   540000000, marketCap: "$29B",   color: "text-blue-400"   },
  { id: "dot",  name: "Polkadot",   symbol: "DOT", price:    10.45, change24h:  1.1,  volume24h:   320000000, marketCap: "$15B",   color: "text-pink-500"   },
  { id: "sol",  name: "Solana",     symbol: "SOL", price:   195.30, change24h:  4.7,  volume24h:  4200000000, marketCap: "$87B",   color: "text-purple-400" },
  { id: "doge", name: "Dogecoin",   symbol: "DOGE",price:     0.19, change24h: -2.1,  volume24h:  1200000000, marketCap: "$25B",   color: "text-yellow-500" },
];


function CryptoIcon({ symbol, className }: { symbol: string; className?: string }) {
  switch (symbol) {
    case "BTC":  return <SiBitcoin  className={className} />;
    case "ETH":  return <SiEthereum className={className} />;
    case "LTC":  return <SiLitecoin className={className} />;
    case "DOGE": return <SiDogecoin className={className} />;
    default:     return <DollarSign className={className} />;
  }
}

export default function ExchangePage() {
  const { toast } = useToast();
  const [cryptos, setCryptos] = useState<Crypto[]>(BASE_PRICES);
  const [fromCrypto, setFromCrypto] = useState("BTC");
  const [toCurrency, setToCurrency] = useState("USD");
  const [fromAmount, setFromAmount] = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: allTransactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const exchangeHistory = allTransactions.filter(tx => tx.type === "exchange").slice(0, 6);

  const exchangeMutation = useMutation({
    mutationFn: async (payload: { fromCrypto: string; fromAmount: string; toAmount: string; rate: number }) => {
      const txId = `EXC-${Date.now().toString(36).toUpperCase()}`;
      return apiRequest("POST", "/api/transactions", {
        transactionId: txId,
        protocol: "201.1",
        type: "exchange",
        amount: payload.toAmount,
        currency: "USD",
        status: "completed",
        fromAccount: `EXCHANGE · ${payload.fromCrypto} · ${payload.fromAmount}`,
        toAccount: `USD · ${payload.toAmount}`,
        description: `Exchange ${payload.fromAmount} ${payload.fromCrypto} → $${payload.toAmount} USD (1 ${payload.fromCrypto} = $${payload.rate.toFixed(2)})`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Intercambio realizado", description: `${fromAmount} ${fromCrypto} → $${toAmount} USD` });
      setFromAmount("");
    },
    onError: () => {
      toast({ title: "Error al procesar intercambio", variant: "destructive" });
    },
  });

  // Simulate live price fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setCryptos(prev => prev.map(c => {
        const delta = (Math.random() - 0.49) * c.price * 0.002;
        return { ...c, price: Math.max(c.price + delta, 0.001) };
      }));
      setLastRefresh(new Date());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const selectedCrypto = cryptos.find(c => c.symbol === fromCrypto) || cryptos[0];
  const toAmount = fromAmount ? (parseFloat(fromAmount) * selectedCrypto.price).toFixed(2) : "";

  function handleExchange() {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a 0", variant: "destructive" });
      return;
    }
    exchangeMutation.mutate({ fromCrypto, fromAmount, toAmount, rate: selectedCrypto.price });
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-7 h-7 text-[#c8322b]" /> Exchange Crypto
          </h1>
          <p className="text-sm text-muted-foreground">Intercambio de criptomonedas en tiempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {lastRefresh.toLocaleTimeString("es-MX")}
          </div>
          <Badge className="bg-green-100 text-green-700 no-default-active-elevate text-xs">Mercado Abierto</Badge>
        </div>
      </div>

      {/* Crypto ticker cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cryptos.slice(0, 8).map((crypto) => (
          <Card
            key={crypto.id}
            className={`hover-elevate cursor-pointer transition-all ${fromCrypto === crypto.symbol ? "ring-2 ring-[#c8322b]" : ""}`}
            onClick={() => setFromCrypto(crypto.symbol)}
            data-testid={`card-crypto-${crypto.symbol}`}
          >
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CryptoIcon symbol={crypto.symbol} className={`w-5 h-5 ${crypto.color}`} />
                  <div>
                    <p className="text-sm font-bold">{crypto.symbol}</p>
                    <p className="text-[10px] text-muted-foreground">{crypto.name}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded ${crypto.change24h >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {crypto.change24h >= 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {Math.abs(crypto.change24h).toFixed(1)}%
                </div>
              </div>
              <p className="text-lg font-bold font-mono">
                ${crypto.price < 1 ? crypto.price.toFixed(4) : crypto.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-muted-foreground">Cap: {crypto.marketCap}</p>
                <p className={`text-[10px] font-medium ${crypto.change24h >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {crypto.change24h >= 0 ? "▲" : "▼"} 24h
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Exchange + History */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Exchange form */}
        <Card className="hover-elevate">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-[#c8322b]" /> Realizar Intercambio
            </CardTitle>
            <CardDescription>Tasa en tiempo real · Sin comisión de conversión</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* From */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Desde</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="0.00000"
                    type="number"
                    step="0.00001"
                    value={fromAmount}
                    onChange={e => setFromAmount(e.target.value)}
                    className="pr-16 font-mono text-lg"
                    data-testid="input-from-amount"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">{fromCrypto}</span>
                </div>
                <Select value={fromCrypto} onValueChange={setFromCrypto}>
                  <SelectTrigger className="w-36" data-testid="select-from-crypto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cryptos.map(c => (
                      <SelectItem key={c.id} value={c.symbol}>
                        <span className="flex items-center gap-2">
                          <CryptoIcon symbol={c.symbol} className={`w-3.5 h-3.5 ${c.color}`} />
                          {c.symbol}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rate display */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <div className="flex flex-col items-center gap-1">
                <div className="w-9 h-9 rounded-full border-2 border-[#c8322b] flex items-center justify-center bg-background">
                  <ArrowRightLeft className="w-4 h-4 text-[#c8322b]" />
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  1 {fromCrypto} = ${selectedCrypto.price < 1 ? selectedCrypto.price.toFixed(4) : selectedCrypto.price.toLocaleString("en-US", { maximumFractionDigits: 2 })} USD
                </p>
              </div>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* To */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Hacia</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={toAmount}
                    readOnly
                    placeholder="0.00"
                    className="pr-16 font-mono text-lg bg-muted/40"
                    data-testid="input-to-amount"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">USD</span>
                </div>
                <Select value={toCurrency} onValueChange={setToCurrency}>
                  <SelectTrigger className="w-36" data-testid="select-to-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["USD", "MXN", "EUR", "CAD"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Info */}
            {fromAmount && parseFloat(fromAmount) > 0 && (
              <div className="bg-muted/40 rounded-md px-3 py-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Recibirás</span><span className="font-bold text-green-600">${parseFloat(toAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })} {toCurrency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tasa</span><span className="font-mono">1 {fromCrypto} = ${selectedCrypto.price.toLocaleString("en-US", { maximumFractionDigits: 2 })} {toCurrency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Comisión</span><span className="text-green-600 font-bold">$0.00</span></div>
              </div>
            )}

            <Button
              onClick={handleExchange}
              disabled={exchangeMutation.isPending || !fromAmount}
              className="w-full h-11 bg-[#c8322b] hover:bg-[#a62822] font-bold"
              data-testid="button-exchange"
            >
              {exchangeMutation.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" /> Realizar Intercambio</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* History + market overview */}
        <div className="space-y-4">
          <Card className="hover-elevate">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" /> Historial de Intercambios
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {exchangeHistory.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <ArrowRightLeft className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  No hay intercambios registrados aún
                </div>
              ) : (
                <div className="divide-y">
                  {exchangeHistory.map((tx, i) => {
                    const parts = (tx.description ?? "").split(" → ");
                    const from = parts[0]?.replace("Exchange ", "") ?? tx.fromAccount ?? "";
                    const to = parts[1]?.split(" (")[0] ?? tx.toAccount ?? "";
                    const rate = (tx.description ?? "").match(/\((.+)\)/)?.[1] ?? "";
                    const diff = Date.now() - new Date(tx.createdAt).getTime();
                    const mins = Math.floor(diff / 60000);
                    const timeStr = mins < 1 ? "Ahora" : mins < 60 ? `Hace ${mins} min` : `Hace ${Math.floor(mins/60)} h`;
                    return (
                      <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors" data-testid={`row-history-${i}`}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-green-100">
                          <Check className="w-3 h-3 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{from} <span className="text-muted-foreground font-normal">→</span> {to}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{rate}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Market overview */}
          <Card className="hover-elevate bg-slate-900 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-green-400" /> Resumen de Mercado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {cryptos.slice(0, 6).map((c, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-slate-700 last:border-0">
                  <div className="flex items-center gap-2">
                    <CryptoIcon symbol={c.symbol} className={`w-3.5 h-3.5 ${c.color}`} />
                    <span className="text-xs font-bold text-slate-200">{c.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${c.change24h >= 0 ? "bg-green-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(Math.abs(c.change24h) * 15 + 30, 100)}%` }} />
                    </div>
                    <span className={`text-xs font-mono w-14 text-right ${c.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(1)}%
                    </span>
                    <span className="text-xs font-mono text-slate-300 w-20 text-right">
                      ${c.price < 1 ? c.price.toFixed(4) : c.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
