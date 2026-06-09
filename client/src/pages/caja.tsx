import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet, TrendingUp, TrendingDown, DollarSign, Plus, Minus,
  Clock, ArrowUpRight, ArrowDownRight, BarChart2, Calculator,
  FileText, ShieldCheck, RefreshCw, X, Check, Banknote
} from "lucide-react";

const movSchema = z.object({
  type: z.enum(["ingreso", "egreso"]),
  amount: z.string().min(1).refine(v => !isNaN(Number(v)) && Number(v) > 0, "Monto inválido"),
  category: z.string().min(1, "Categoría requerida"),
  description: z.string().min(2, "Descripción requerida"),
  reference: z.string().optional(),
});
type MovForm = z.infer<typeof movSchema>;

interface Movement {
  id: string;
  type: "ingreso" | "egreso";
  amount: number;
  category: string;
  description: string;
  reference?: string;
  time: string;
  user: string;
}

const INGRESO_CATS = ["Depósito en efectivo", "Transferencia bancaria", "Venta POS", "Cobranza", "Otro ingreso"];
const EGRESO_CATS  = ["Retiro cliente", "Pago a proveedor", "Gastos operativos", "Devolución", "Otro egreso"];

const initialMovements: Movement[] = [
  { id: "MOV-001", type: "ingreso", amount: 2500, category: "Depósito en efectivo", description: "Depósito ventanilla 01", time: "10:30 AM", user: "Admin" },
  { id: "MOV-002", type: "egreso",  amount: 1800, category: "Retiro cliente", description: "Retiro cliente #1234", reference: "CLT-1234", time: "11:15 AM", user: "Admin" },
  { id: "MOV-003", type: "ingreso", amount: 3200, category: "Transferencia bancaria", description: "Transferencia SPEI entrante", reference: "SPEI-88210", time: "12:00 PM", user: "Admin" },
  { id: "MOV-004", type: "egreso",  amount: 950,  category: "Pago a proveedor", description: "Pago mantenimiento POS", time: "2:30 PM", user: "Admin" },
  { id: "MOV-005", type: "ingreso", amount: 1500, category: "Venta POS", description: "Liquidación terminal T1004", time: "3:15 PM", user: "Admin" },
  { id: "MOV-006", type: "egreso",  amount: 600,  category: "Gastos operativos", description: "Papelería y suministros", time: "4:00 PM", user: "Admin" },
  { id: "MOV-007", type: "ingreso", amount: 4800, category: "Cobranza", description: "Cobro comisiones acumuladas", reference: "COM-042", time: "5:30 PM", user: "Admin" },
];

const denominations = [
  { bill: "$1,000", qty: 12 },
  { bill: "$500",   qty: 28 },
  { bill: "$200",   qty: 15 },
  { bill: "$100",   qty: 43 },
  { bill: "$50",    qty: 22 },
  { bill: "$20",    qty: 38 },
];

export default function CajaPage() {
  const { toast } = useToast();
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [showForm, setShowForm] = useState<"ingreso" | "egreso" | null>(null);
  const [filterType, setFilterType] = useState<"all" | "ingreso" | "egreso">("all");

  const form = useForm<MovForm>({
    resolver: zodResolver(movSchema),
    defaultValues: { type: "ingreso", amount: "", category: "", description: "", reference: "" },
  });

  const ingresos = movements.filter(m => m.type === "ingreso").reduce((s, m) => s + m.amount, 0);
  const egresos  = movements.filter(m => m.type === "egreso").reduce((s, m) => s + m.amount, 0);
  const saldo    = 45890 + ingresos - egresos;

  function openForm(type: "ingreso" | "egreso") {
    form.reset({ type, amount: "", category: "", description: "", reference: "" });
    setShowForm(type);
  }

  function onSubmit(data: MovForm) {
    const newMov: Movement = {
      id: `MOV-${String(movements.length + 1).padStart(3, "0")}`,
      type: data.type,
      amount: parseFloat(data.amount),
      category: data.category,
      description: data.description,
      reference: data.reference || undefined,
      time: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      user: "Admin",
    };
    setMovements(prev => [newMov, ...prev]);
    setShowForm(null);
    toast({ title: data.type === "ingreso" ? "Ingreso registrado" : "Egreso registrado", description: `$${parseFloat(data.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} — ${data.description}` });
  }

  const filtered = movements.filter(m => filterType === "all" || m.type === filterType);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Wallet className="w-7 h-7 text-[#c8322b]" /> Caja
          </h1>
          <p className="text-sm text-muted-foreground">Gestión de efectivo · {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openForm("ingreso")} data-testid="button-ingreso">
            <Plus className="w-4 h-4 mr-1" /> Registrar Ingreso
          </Button>
          <Button size="sm" variant="outline" className="border-red-400 text-red-600" onClick={() => openForm("egreso")} data-testid="button-egreso">
            <Minus className="w-4 h-4 mr-1" /> Registrar Egreso
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="hover-elevate border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo en Caja</CardTitle>
            <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600" data-testid="saldo-caja">
              ${saldo.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">USD — Actualizado ahora</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Hoy</CardTitle>
            <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              ${ingresos.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{movements.filter(m => m.type === "ingreso").length} movimientos</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egresos Hoy</CardTitle>
            <div className="w-8 h-8 rounded-md bg-red-100 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              ${egresos.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{movements.filter(m => m.type === "egreso").length} movimientos</p>
          </CardContent>
        </Card>
      </div>

      {/* Registration Form */}
      {showForm && (
        <Card className={`hover-elevate border-2 ${showForm === "ingreso" ? "border-green-400" : "border-red-400"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className={`flex items-center gap-2 ${showForm === "ingreso" ? "text-green-700" : "text-red-700"}`}>
                {showForm === "ingreso" ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                Registrar {showForm === "ingreso" ? "Ingreso" : "Egreso"}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(null)} data-testid="button-close-form">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto (USD)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input {...field} placeholder="0.00" type="number" step="0.01" min="0.01" className="pl-9 font-mono text-lg" data-testid="input-monto" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(showForm === "ingreso" ? INGRESO_CATS : EGRESO_CATS).map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Descripción del movimiento" data-testid="input-descripcion" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="reference" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referencia (Opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="REF-001" className="font-mono" data-testid="input-referencia" />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <div className="flex gap-3">
                  <Button type="submit" className={showForm === "ingreso" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} data-testid="button-guardar-mov">
                    <Check className="w-4 h-4 mr-1" /> Guardar
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(null)}>Cancelar</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Movements List */}
        <Card className="hover-elevate lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Movimientos
                </CardTitle>
                <CardDescription>Registro del día</CardDescription>
              </div>
              <div className="flex gap-1">
                {(["all", "ingreso", "egreso"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterType(f)}
                    data-testid={`filter-${f}`}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${filterType === f ? "bg-[#c8322b] text-white" : "bg-muted text-muted-foreground"}`}
                  >
                    {f === "all" ? "Todos" : f === "ingreso" ? "Ingresos" : "Egresos"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((mov) => (
                <div key={mov.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors" data-testid={`row-mov-${mov.id}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${mov.type === "ingreso" ? "bg-green-100" : "bg-red-100"}`}>
                    {mov.type === "ingreso" ? <ArrowUpRight className="w-4 h-4 text-green-600" /> : <ArrowDownRight className="w-4 h-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{mov.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">{mov.category}</span>
                      {mov.reference && <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{mov.reference}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold ${mov.type === "ingreso" ? "text-green-600" : "text-red-600"}`}>
                      {mov.type === "ingreso" ? "+" : "–"}${mov.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{mov.time} · {mov.id}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Denomination breakdown */}
          <Card className="hover-elevate">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Banknote className="w-4 h-4 text-[#c8322b]" /> Denominaciones en Caja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {denominations.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <span className="text-sm font-semibold">{d.bill}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{d.qty} billetes</span>
                    <span className="text-sm font-bold text-green-600">
                      ${(parseInt(d.bill.replace(/\D/g, "")) * d.qty).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
              <div className="pt-2 flex items-center justify-between font-bold">
                <span className="text-sm">Total Efectivo</span>
                <span className="text-green-600">
                  ${denominations.reduce((s, d) => s + parseInt(d.bill.replace(/\D/g, "")) * d.qty, 0).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="hover-elevate bg-slate-900 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-green-400" /> Resumen del Día
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Saldo apertura", value: "$45,890.00", color: "text-slate-300" },
                { label: "Total ingresos", value: `+$${ingresos.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-green-400" },
                { label: "Total egresos", value: `-$${egresos.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-red-400" },
                { label: "Saldo actual", value: `$${saldo.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-white font-bold" },
              ].map((item, i) => (
                <div key={i} className={`flex items-center justify-between py-1.5 ${i === 3 ? "border-t border-slate-600 mt-1 pt-2" : "border-b border-slate-700"}`}>
                  <span className="text-xs text-slate-400">{item.label}</span>
                  <span className={`text-sm font-mono ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold">Controles</span>
              </div>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" data-testid="button-cierre-caja">
                  <FileText className="w-3.5 h-3.5 mr-2" /> Cierre de Caja
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" data-testid="button-arqueo">
                  <Calculator className="w-3.5 h-3.5 mr-2" /> Arqueo de Caja
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" data-testid="button-reporte">
                  <BarChart2 className="w-3.5 h-3.5 mr-2" /> Reporte Diario
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
