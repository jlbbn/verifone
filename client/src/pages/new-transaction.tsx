import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { BankingProtocol } from "@shared/schema";

export default function NewTransactionPage() {
  const { toast } = useToast();
  const [selectedProtocol, setSelectedProtocol] = useState("101.3");

  const { data: protocols, isLoading } = useQuery<BankingProtocol[]>({
    queryKey: ['/api/protocols'],
  });

  const handleContinue = () => {
    toast({
      title: "Continuando al testado de seguridad",
      description: `Protocolo ${selectedProtocol} seleccionado`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transacciones</h1>
          <p className="text-muted-foreground">Nueva Transacción</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Saldo disponible</p>
          <p className="text-2xl font-bold text-primary">$1,250,000.00 USD</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-[#c8322b] text-white">
            <CardHeader>
              <CardTitle className="text-2xl">Nueva Transacción Bancaria</CardTitle>
              <CardDescription className="text-white/90">
                Ingrese los datos para realizar una transferencia entre cuentas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  Seleccione el protocolo de transacción bancaria
                </label>
                <Select value={selectedProtocol} onValueChange={setSelectedProtocol}>
                  <SelectTrigger 
                    className="bg-white text-black border-none" 
                    data-testid="protocol-selector"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoading ? (
                      <SelectItem value="loading">Cargando...</SelectItem>
                    ) : (
                      protocols?.map((protocol) => (
                        <SelectItem 
                          key={protocol.code} 
                          value={protocol.code}
                          data-testid={`protocol-${protocol.code}`}
                        >
                          {protocol.code}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleContinue}
                className="w-full bg-white text-[#c8322b] hover:bg-gray-100"
                size="lg"
                data-testid="button-continue-security"
              >
                Continuar al Testado de Seguridad
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Funciones Relacionadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-mono mb-1">updateTransactionStatus</p>
                  <p className="text-xs text-muted-foreground">server/storage.ts:138</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Actualiza el estado de una transacción existente
                  </p>
                </div>
                <Badge variant="secondary">18 llamadas</Badge>
              </div>

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-mono mb-1">getAllTransactions</p>
                  <p className="text-xs text-muted-foreground">server/storage.ts:65</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recupera todas las transacciones almacenadas
                  </p>
                </div>
                <Badge variant="secondary">65 llamadas</Badge>
              </div>

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-mono mb-1">generateTransactionId</p>
                  <p className="text-xs text-muted-foreground">server/helpers.ts:8</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Genera un ID único para una nueva transacción
                  </p>
                </div>
                <Badge variant="secondary">49 llamadas</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
