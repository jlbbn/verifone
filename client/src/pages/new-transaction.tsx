
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Check } from "lucide-react";

const transactionSchema = z.object({
  amount: z.string().min(1, "Monto requerido"),
  cardNumber: z.string().min(16, "Número de tarjeta inválido"),
  cardHolder: z.string().min(1, "Nombre del titular requerido"),
  reference: z.string().optional(),
});

type TransactionForm = z.infer<typeof transactionSchema>;

function NewTransactionPage() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionCode, setTransactionCode] = useState<string | null>(null);

  const form = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: "",
      cardNumber: "",
      cardHolder: "",
      reference: "",
    },
  });

  async function onSubmit(data: TransactionForm) {
    setIsProcessing(true);
    
    // Simular procesamiento VISA
    setTimeout(() => {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setTransactionCode(code);
      
      toast({
        title: "Transacción Autorizada",
        description: `Código de autorización: ${code}`,
      });
      
      setIsProcessing(false);
    }, 2000);
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Nueva Transacción</h1>
        <p className="text-sm md:text-base text-muted-foreground">Protocolo 101.3 - VISA Network</p>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Datos de Transacción
            </CardTitle>
            <CardDescription>Complete los datos para procesar la transacción</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto (USD)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="0.00" type="number" step="0.01" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cardNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Tarjeta</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="XXXX XXXX XXXX XXXX" maxLength={16} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cardHolder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titular de la Tarjeta</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="NOMBRE COMPLETO" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referencia (Opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="REF001" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-[#c8322b] hover:bg-[#a62822]"
                  disabled={isProcessing}
                >
                  {isProcessing ? "Procesando..." : "Procesar Transacción"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle>Estado de Transacción</CardTitle>
            <CardDescription>Protocolo VISA 101.3</CardDescription>
          </CardHeader>
          <CardContent>
            {transactionCode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-semibold text-green-600">AUTORIZACIÓN EXITOSA</p>
                  <div className="bg-[#1e3a8a] text-white p-4 rounded-md font-mono">
                    <p className="text-xs opacity-75">AUTHORIZATION CODE:</p>
                    <p className="text-3xl font-bold">{transactionCode}</p>
                  </div>
                  <div className="text-left mt-4 space-y-1 text-sm">
                    <p className="text-muted-foreground">PROTOCOL: 101.3</p>
                    <p className="text-muted-foreground">NETWORK: VISA/DIGITAL</p>
                    <p className="text-muted-foreground">STATUS: SUCCESSFULLY REDEEMED</p>
                    <p className="text-muted-foreground">GLOBAL TRANSFER TIME: {new Date().toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Esperando transacción...</p>
                <p className="text-sm mt-2">Complete el formulario y procese la transacción</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {transactionCode && (
        <Card className="bg-[#1e3a8a] text-white hover-elevate">
          <CardContent className="pt-6">
            <div className="font-mono text-xs space-y-1">
              <p>SYSTEM DEPARTMENT/ACCESS/VIS91**67248***/**301286 SYSTEM SCREEN FROM:</p>
              <p>www.usa.visa.com/vxml/access</p>
              <p>Center (@visatecagency.com)</p>
              <p className="mt-4">INTERBANKING SWIFT SCREEN/TRACER DELIVERY REPORT</p>
              <p>REFERENCE NUMBER SUPPORT BANK: VIS91**67248***/**</p>
              <p className="mt-4">INTERNATIONAL GLOBAL SWIFT.COM</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default NewTransactionPage;
