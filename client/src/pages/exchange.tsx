
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bitcoin, TrendingUp, ArrowRightLeft } from "lucide-react";

export default function ExchangePage() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Exchange Crypto</h1>
        <p className="text-sm md:text-base text-muted-foreground">Intercambio de criptomonedas</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { name: "Bitcoin", symbol: "BTC", price: 67240.50, change: "+2.4%" },
          { name: "Ethereum", symbol: "ETH", price: 3456.20, change: "+1.8%" },
          { name: "Cardano", symbol: "ADA", price: 0.82, change: "-0.5%" },
          { name: "Solana", symbol: "SOL", price: 142.87, change: "+3.2%" },
        ].map((crypto, i) => (
          <Card key={i} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{crypto.name}</CardTitle>
              <Bitcoin className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${crypto.price.toLocaleString()}</div>
              <p className={`text-xs ${crypto.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                {crypto.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Intercambio
            </CardTitle>
            <CardDescription>Convierte entre criptomonedas y USD</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Desde</label>
              <div className="flex gap-2">
                <Input placeholder="0.00" type="number" />
                <Button variant="outline" className="min-w-[100px]">BTC</Button>
              </div>
            </div>
            
            <div className="flex justify-center">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowRightLeft className="w-4 h-4" />
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Hacia</label>
              <div className="flex gap-2">
                <Input placeholder="0.00" type="number" />
                <Button variant="outline" className="min-w-[100px]">USD</Button>
              </div>
            </div>

            <Button className="w-full bg-[#c8322b] hover:bg-[#a62822]">
              Realizar Intercambio
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle>Historial de Intercambios</CardTitle>
            <CardDescription>Últimas operaciones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { from: "0.5 BTC", to: "$33,620", time: "10:30 AM" },
                { from: "2.5 ETH", to: "$8,640", time: "11:15 AM" },
                { from: "$5,000", to: "0.074 BTC", time: "2:30 PM" },
                { from: "100 ADA", to: "$82", time: "3:45 PM" },
              ].map((exchange, i) => (
                <div key={i} className="flex items-center justify-between pb-4 border-b last:border-0">
                  <div>
                    <p className="font-medium">{exchange.from} → {exchange.to}</p>
                    <p className="text-sm text-muted-foreground">{exchange.time}</p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
