
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

export default function CajaPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Caja</h1>
        <p className="text-sm md:text-base text-muted-foreground">Gestión de efectivo y movimientos de caja</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo en Caja</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">$45,890.00</div>
            <p className="text-xs text-muted-foreground">USD</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Hoy</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$12,450.00</div>
            <p className="text-xs text-muted-foreground">23 transacciones</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egresos Hoy</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$8,230.00</div>
            <p className="text-xs text-muted-foreground">15 transacciones</p>
          </CardContent>
        </Card>
      </div>

      <Card className="hover-elevate">
        <CardHeader>
          <CardTitle>Movimientos Recientes</CardTitle>
          <CardDescription>Últimas operaciones de caja</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { type: "Ingreso", amount: 2500, desc: "Depósito en efectivo", time: "10:30 AM" },
              { type: "Egreso", amount: -1800, desc: "Retiro cliente #1234", time: "11:15 AM" },
              { type: "Ingreso", amount: 3200, desc: "Transferencia bancaria", time: "12:00 PM" },
              { type: "Egreso", amount: -950, desc: "Pago a proveedor", time: "2:30 PM" },
              { type: "Ingreso", amount: 1500, desc: "Venta POS", time: "3:15 PM" },
            ].map((mov, i) => (
              <div key={i} className="flex items-center justify-between pb-4 border-b last:border-0">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${mov.amount > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <div>
                    <p className="font-medium">{mov.type}</p>
                    <p className="text-sm text-muted-foreground">{mov.desc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${mov.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {mov.amount > 0 ? '+' : ''}${Math.abs(mov.amount).toLocaleString()}.00
                  </p>
                  <p className="text-sm text-muted-foreground">{mov.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button className="bg-green-600 hover:bg-green-700">
          <DollarSign className="w-4 h-4 mr-2" />
          Registrar Ingreso
        </Button>
        <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-50">
          <DollarSign className="w-4 h-4 mr-2" />
          Registrar Egreso
        </Button>
      </div>
    </div>
  );
}
