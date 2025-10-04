
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Search, Download, Filter } from "lucide-react";

export default function RegistrosPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Registros</h1>
          <p className="text-sm md:text-base text-muted-foreground">Historial completo de operaciones</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filtrar
          </Button>
          <Button className="bg-[#c8322b] hover:bg-[#a62822]">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por ID, monto, fecha..." className="pl-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover-elevate">
        <CardHeader>
          <CardTitle>Historial de Transacciones</CardTitle>
          <CardDescription>Últimas 50 operaciones registradas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">ID</th>
                  <th className="text-left py-3 px-4 font-medium">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium">Monto</th>
                  <th className="text-left py-3 px-4 font-medium">Estado</th>
                  <th className="text-left py-3 px-4 font-medium">Terminal</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: "TRX-10234", date: "2025-05-03 15:24", type: "Transferencia", amount: 5420, status: "Completada", terminal: "POS-001" },
                  { id: "TRX-10233", date: "2025-05-03 15:18", type: "Retiro", amount: 2100, status: "Completada", terminal: "POS-003" },
                  { id: "TRX-10232", date: "2025-05-03 15:12", type: "Depósito", amount: 8900, status: "Completada", terminal: "POS-002" },
                  { id: "TRX-10231", date: "2025-05-03 15:05", type: "Transferencia", amount: 1250, status: "Pendiente", terminal: "POS-005" },
                  { id: "TRX-10230", date: "2025-05-03 14:58", type: "Retiro", amount: 3400, status: "Completada", terminal: "POS-001" },
                ].map((registro, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-mono text-sm">{registro.id}</td>
                    <td className="py-3 px-4 text-sm">{registro.date}</td>
                    <td className="py-3 px-4 text-sm">{registro.type}</td>
                    <td className="py-3 px-4 text-sm font-semibold">${registro.amount.toLocaleString()}.00</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        registro.status === 'Completada' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {registro.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">{registro.terminal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
