import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, Activity } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">Banking API POS</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs md:text-sm text-muted-foreground">Saldo disponible</p>
          <p className="text-xl md:text-2xl font-bold text-primary" data-testid="balance">$1,250,000.00 USD</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">247</div>
            <p className="text-xs text-muted-foreground">+12% desde ayer</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volumen Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2.4M</div>
            <p className="text-xs text-muted-foreground">+8% desde ayer</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">+15% este mes</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado Sistema</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Online</div>
            <p className="text-xs text-muted-foreground">99.9% uptime</p>
          </CardContent>
        </Card>
      </div>

      <Card className="hover-elevate">
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Últimas transacciones procesadas en el sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { id: 1001, amount: 680000, protocol: "101.3 - Transferencia segura", time: "Hace 2 min" },
              { id: 1002, amount: 1200000, protocol: "201.2 - Pago internacional", time: "Hace 5 min" },
              { id: 1003, amount: 450000, protocol: "101.2 - Transferencia con validación", time: "Hace 8 min" },
              { id: 1004, amount: 890000, protocol: "201.3 - Pago express", time: "Hace 12 min" },
              { id: 1005, amount: 1500000, protocol: "101.3 - Transferencia segura", time: "Hace 15 min" },
            ].map((tx) => (
              <div key={tx.id} className="flex items-center justify-between pb-4 border-b last:border-0">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <div>
                    <p className="font-medium">Transacción #{tx.id}</p>
                    <p className="text-sm text-muted-foreground">Protocolo {tx.protocol}</p>
                    <p className="text-xs text-muted-foreground/60">{tx.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${tx.amount.toLocaleString()}.00 USD</p>
                  <p className="text-sm text-green-600 font-semibold">✓ Completada</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
