
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, CheckCircle, XCircle, Clock } from "lucide-react";

export default function POSPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Enrutamiento POS</h1>
        <p className="text-sm md:text-base text-muted-foreground">Sistema de puntos de venta conectados</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terminales Activas</CardTitle>
            <Store className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">de 15 totales</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,847</div>
            <p className="text-xs text-muted-foreground">Hoy</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rechazadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">1.2% del total</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.3s</div>
            <p className="text-xs text-muted-foreground">Por transacción</p>
          </CardContent>
        </Card>
      </div>

      <Card className="hover-elevate">
        <CardHeader>
          <CardTitle>Terminales POS</CardTitle>
          <CardDescription>Estado de las terminales conectadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { id: "POS-001", location: "Sucursal Centro", status: "Activa", transactions: 234 },
              { id: "POS-002", location: "Sucursal Norte", status: "Activa", transactions: 189 },
              { id: "POS-003", location: "Sucursal Sur", status: "Activa", transactions: 156 },
              { id: "POS-004", location: "Sucursal Este", status: "Mantenimiento", transactions: 0 },
              { id: "POS-005", location: "Sucursal Oeste", status: "Activa", transactions: 201 },
            ].map((pos, i) => (
              <div key={i} className="flex items-center justify-between pb-4 border-b last:border-0">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${pos.status === 'Activa' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <div>
                    <p className="font-medium">{pos.id}</p>
                    <p className="text-sm text-muted-foreground">{pos.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{pos.transactions} transacciones</p>
                  <p className={`text-sm ${pos.status === 'Activa' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {pos.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
