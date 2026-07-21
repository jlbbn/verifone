import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { DEFAULT_SYSTEM_SETTINGS } from "@shared/schema";
import {
  CreditCard, Check, ArrowRightLeft, ShieldCheck, Lock,
  Cpu, Clock, Copy, RefreshCw, ChevronRight, Zap,
  DollarSign, Hash, User, Calendar, Key, FileText, AlertCircle,
  Euro, ArrowDownToLine, CheckCircle2, XCircle, Wallet
} from "lucide-react";

const transactionSchema = z.object({
  amount: z.string().min(1, "Monto requerido").refine(v => !isNaN(Number(v)) && Number(v) > 0, "Monto inválido"),
  cardNumber: z.string().min(16, "Número de tarjeta debe tener 16 dígitos").max(19),
  cardHolder: z.string().min(2, "Nombre del titular requerido"),
  cardType: z.string().min(1, "Tipo de tarjeta requerido"),
  expiryDate: z.string().min(5, "Fecha de expiración requerida (MM/AA)"),
  cvv: z.string().min(3, "CVV requerido").max(4),
  protocol: z.string().min(1, "Protocolo requerido"),
  transactionType: z.string().min(1, "Tipo de transacción requerido"),
  currency: z.string(),
  fromAccount: z.string().optional(),
  toAccount: z.string().optional(),
  description: z.string().optional(),
});

type TransactionForm = z.infer<typeof transactionSchema>;

interface TransactionResult {
  success: boolean;
  authCode: string;
  tokenId: string;
  transactionId?: string;
  protocol: string;
  amount: string;
  currency: string;
  cardType: string;
  cardNumber: string;
  timestamp: string;
  emvCompliant: boolean;
  pciCompliant: boolean;
  network: string;
}

const CARD_TYPES = ["VISA", "Mastercard", "AMEX", "Discover", "UnionPay", "Débito VISA", "Débito Mastercard"];
const CURRENCIES = ["USD", "MXN", "CAD", "EUR", "GBP"];
const TRANSACTION_TYPES = [
  { value: "payment", label: "Pago" },
  { value: "transfer", label: "Transferencia" },
  { value: "deposit", label: "Depósito" },
  { value: "withdrawal", label: "Retiro" },
];

function formatCardNumber(value: string) {
  return value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim().slice(0, 19);
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
}

function maskCardNumber(num: string) {
  const clean = num.replace(/\s/g, "");
  return "**** **** **** " + clean.slice(-4);
}

export default function NewTransactionPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<"form" | "match" | "processing" | "result">("form");
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [pendingFormData, setPendingFormData] = useState<TransactionForm | null>(null);
  const [isEurTx, setIsEurTx] = useState(false);
  const [sentToCaja, setSentToCaja] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: protocols = [] } = useQuery<any[]>({ queryKey: ["/api/protocols"] });
  const { data: settings } = useSystemSettings();

  const eurIngressMutation = useMutation({
    mutationFn: async (payload: {
      amountEUR: number; authCode: string;
      cardType?: string; protocol?: string; transactionId?: string;
    }) => {
      const res = await apiRequest("POST", "/api/caja/eur-ingreso", payload);
      if (!res.ok) throw new Error("Error al registrar en caja");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/caja/summary"] });
    },
  });

  const fxEUR = settings?.fxRateEUR ?? DEFAULT_SYSTEM_SETTINGS.fxRateEUR;
  const tc    = settings?.tipoCambio  ?? DEFAULT_SYSTEM_SETTINGS.tipoCambio;

  const form = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: "",
      cardNumber: "",
      cardHolder: "",
      cardType: "VISA",
      expiryDate: "",
      cvv: "",
      protocol: "101.3",
      transactionType: "payment",
      currency: "USD",
      fromAccount: "",
      toAccount: "",
      description: "",
    },
  });

  const processMutation = useMutation({
    mutationFn: async (data: TransactionForm) => {
      const res = await apiRequest("POST", "/api/pos/process-payment", {
        cardType: data.cardType,
        cardNumber: data.cardNumber.replace(/\s/g, "").slice(-4),
        holderName: data.cardHolder,
        expiryDate: data.expiryDate,
        amount: parseFloat(data.amount),
        protocol: data.protocol,
      });
      return res.json();
    },
    onSuccess: (data, variables) => {
      const txResult: TransactionResult = {
        success: true,
        authCode: data.authCode,
        tokenId: data.tokenId,
        transactionId: data.transaction?.transactionId,
        protocol: variables.protocol,
        amount: variables.amount,
        currency: variables.currency,
        cardType: variables.cardType,
        cardNumber: variables.cardNumber,
        timestamp: new Date().toISOString(),
        emvCompliant: true,
        pciCompliant: true,
        network: variables.cardType.includes("VISA") ? "VISA/DIGITAL" : variables.cardType.includes("Mastercard") ? "MASTERCARD/NET" : "AMEX/INTL",
      };
      setResult(txResult);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transacción Autorizada", description: `Auth Code: ${data.authCode}` });
    },
    onError: () => {
      setStep(isEurTx ? "match" : "form");
      toast({ title: "Error en la transacción", description: "No se pudo procesar. Intente de nuevo.", variant: "destructive" });
    },
  });

  async function onSubmit(data: TransactionForm) {
    if (data.currency === "EUR") {
      setPendingFormData(data);
      setIsEurTx(true);
      setSentToCaja(false);
      setStep("match");
    } else {
      setIsEurTx(false);
      setSentToCaja(false);
      setStep("processing");
      processMutation.mutate(data);
    }
  }

  function handleConfirmMatch() {
    if (!pendingFormData) return;
    setStep("processing");
    processMutation.mutate(pendingFormData);
  }

  function handlePasarACaja() {
    if (!result) return;
    const eurAmount = pendingFormData ? parseFloat(pendingFormData.amount) : parseFloat(result.amount);

    eurIngressMutation.mutate(
      {
        amountEUR:     eurAmount,
        authCode:      result.authCode,
        cardType:      result.cardType,
        protocol:      result.protocol,
        transactionId: result.transactionId,
      },
      {
        onSuccess: () => {
          setSentToCaja(true);
          toast({
            title: "Registrado en Caja Formal",
            description: `€${eurAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} EUR ingresado correctamente.`,
          });
        },
        onError: () => {
          toast({ title: "Error al registrar", description: "No se pudo pasar a caja. Intente de nuevo.", variant: "destructive" });
        },
      }
    );
  }

  function handleCopy(value: string, key: string) {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleReset() {
    setStep("form");
    setResult(null);
    setPendingFormData(null);
    setIsEurTx(false);
    setSentToCaja(false);
    form.reset();
  }

  function handlePrint() {
    if (!result) return;
    const fecha = new Date(result.timestamp).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "medium" });
    const win = window.open("", "_blank", "width=400,height=680");
    if (!win) {
      toast({
        title: "No se pudo abrir el recibo",
        description: "Habilita las ventanas emergentes para imprimir el comprobante.",
        variant: "destructive",
      });
      return;
    }
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" />
      <title>Recibo ${result.authCode}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; color: #111; margin: 0; padding: 24px; background: #fff; }
        .receipt { max-width: 320px; margin: 0 auto; }
        .brand { text-align: center; border-bottom: 2px dashed #c8322b; padding-bottom: 12px; margin-bottom: 12px; }
        .brand h1 { color: #c8322b; font-size: 20px; margin: 0; letter-spacing: 1px; }
        .brand p { margin: 2px 0 0; font-size: 11px; color: #555; }
        .row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; gap: 12px; }
        .row span:last-child { text-align: right; font-weight: bold; }
        .total { border-top: 1px dashed #999; margin-top: 8px; padding-top: 8px; font-size: 15px; }
        .footer { text-align: center; border-top: 2px dashed #c8322b; margin-top: 14px; padding-top: 12px; font-size: 10px; color: #555; }
        .ok { color: #15803d; font-weight: bold; }
      </style></head><body>
      <div class="receipt">
        <div class="brand"><h1>BANXICO PLUS</h1><p>Comprobante de Transacción</p></div>
        <div class="row"><span>Fecha</span><span>${fecha}</span></div>
        <div class="row"><span>Transacción</span><span>${result.transactionId || "—"}</span></div>
        <div class="row"><span>Protocolo</span><span>${result.protocol}</span></div>
        <div class="row"><span>Red</span><span>${result.network}</span></div>
        <div class="row"><span>Tarjeta</span><span>${result.cardType} ${result.cardNumber}</span></div>
        <div class="row"><span>Código Auth</span><span>${result.authCode}</span></div>
        <div class="row"><span>Token</span><span>${result.tokenId}</span></div>
        <div class="row total"><span>Monto</span><span>$${Number(result.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${result.currency}</span></div>
        <div class="row"><span>Estado</span><span class="ok">APROBADA</span></div>
        <div class="footer">
          ${result.emvCompliant ? "EMV ✓ " : ""}${result.pciCompliant ? "PCI DSS ✓ " : ""}AES-256 ✓<br/>
          Gracias por su preferencia<br/>* * * Comprobante de operación * * *
        </div>
      </div>
      <script>window.onload = function(){ window.print(); }</script>
      </body></html>`);
    win.document.close();
  }

  const selectedProtocol = protocols.find((p: any) => p.code === form.watch("protocol"));

  // ── Step indicator config ─────────────────────────────────────────────────
  const eurSteps = ["Formulario", "Verificación EUR", "Procesando", "Resultado"];
  const stdSteps = ["Formulario", "Procesando", "Resultado"];
  const stepLabels = isEurTx ? eurSteps : stdSteps;
  const stepKeys   = isEurTx
    ? (["form", "match", "processing", "result"] as const)
    : (["form", "processing", "result"] as const);

  // ─── EUR amount values for the match panel ───────────────────────────────
  const eurAmtRaw = pendingFormData ? parseFloat(pendingFormData.amount) : 0;
  const eurInUSD  = eurAmtRaw * fxEUR;
  const eurInMXN  = eurAmtRaw * fxEUR * tc;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-7 h-7 text-[#c8322b]" />
            Nueva Transacción
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Procesamiento seguro · EMV/PCI DSS · AES-256</p>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-1 text-sm">
          {stepLabels.map((s, i) => {
            const currentIdx = stepKeys.indexOf(step as any);
            const isActive = i === currentIdx;
            const isDone   = i < currentIdx;
            return (
              <div key={s} className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isDone ? "bg-green-500 text-white" : isActive ? "bg-[#c8322b] text-white" : "bg-muted text-muted-foreground"}`}>
                  {isDone ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={`hidden sm:inline text-xs font-medium ${isActive ? "text-[#c8322b]" : "text-muted-foreground"}`}>{s}</span>
                {i < stepLabels.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FORM step ─────────────────────────────────────────────────────── */}
      {step === "form" && (
        <div className="grid gap-5 xl:grid-cols-3">
          {/* Form */}
          <div className="xl:col-span-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Card Data */}
                <Card className="hover-elevate">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CreditCard className="w-4 h-4 text-[#c8322b]" /> Datos de la Tarjeta
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="cardType" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Tarjeta</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-card-type">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CARD_TYPES.map(ct => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="cardHolder" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Titular de la Tarjeta</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input {...field} placeholder="NOMBRE COMPLETO" className="pl-9 uppercase" data-testid="input-card-holder" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="cardNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Tarjeta</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="XXXX XXXX XXXX XXXX"
                              className="pl-9 font-mono tracking-widest"
                              maxLength={19}
                              data-testid="input-card-number"
                              onChange={e => field.onChange(formatCardNumber(e.target.value))}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="expiryDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de Expiración</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                {...field}
                                placeholder="MM/AA"
                                className="pl-9 font-mono"
                                maxLength={5}
                                data-testid="input-expiry"
                                onChange={e => field.onChange(formatExpiry(e.target.value))}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="cvv" render={({ field }) => (
                        <FormItem>
                          <FormLabel>CVV / CVC</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                {...field}
                                placeholder="•••"
                                type="password"
                                className="pl-9 font-mono"
                                maxLength={4}
                                data-testid="input-cvv"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </CardContent>
                </Card>

                {/* Transaction Details */}
                <Card className="hover-elevate">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DollarSign className="w-4 h-4 text-[#c8322b]" /> Detalles de la Transacción
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="transactionType" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Transacción</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-tx-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TRANSACTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="protocol" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Protocolo Bancario</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-protocol">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {protocols.map((p: any) => (
                                <SelectItem key={p.code} value={p.code}>{p.code} — {p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <FormField control={form.control} name="amount" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monto</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input {...field} placeholder="0.00" type="number" step="0.01" min="0.01" className="pl-9 font-mono text-lg" data-testid="input-amount" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="currency" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Moneda</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-currency">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="fromAccount" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cuenta Origen (Opcional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="****1234" className="font-mono" data-testid="input-from-account" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="toAccount" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cuenta Destino (Opcional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="****5678" className="font-mono" data-testid="input-to-account" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción / Referencia</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Referencia de la transacción..." className="resize-none h-20" data-testid="input-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-[#c8322b] hover:bg-[#a62822] font-bold"
                  data-testid="button-submit-transaction"
                >
                  <ShieldCheck className="w-5 h-5 mr-2" />
                  Procesar Transacción Segura
                </Button>
              </form>
            </Form>
          </div>

          {/* Sidebar info */}
          <div className="space-y-4">
            {/* Protocol Info */}
            {selectedProtocol && (
              <Card className="hover-elevate border-[#c8322b]/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#c8322b]" /> Protocolo Seleccionado
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="bg-[#c8322b]/10 rounded-md px-3 py-2">
                    <p className="text-lg font-bold text-[#c8322b]">{selectedProtocol.code}</p>
                    <p className="text-sm font-semibold">{selectedProtocol.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedProtocol.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs no-default-active-elevate ${selectedProtocol.requiresSecurity ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {selectedProtocol.requiresSecurity ? "Seguridad Alta" : "Estándar"}
                    </Badge>
                    <Badge className="text-xs bg-blue-100 text-blue-700 no-default-active-elevate capitalize">{selectedProtocol.category}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Security Info */}
            <Card className="hover-elevate bg-slate-900 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-400" /> Seguridad Activa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Cifrado", value: "AES-256", icon: <Lock className="w-3 h-3 text-green-400" /> },
                  { label: "Protocolo", value: "TLS 1.3", icon: <ShieldCheck className="w-3 h-3 text-green-400" /> },
                  { label: "EMV", value: "Certificado", icon: <Cpu className="w-3 h-3 text-green-400" /> },
                  { label: "PCI DSS", value: "Compliant", icon: <Check className="w-3 h-3 text-green-400" /> },
                  { label: "Token", value: "TOK-AES-SHA256", icon: <Key className="w-3 h-3 text-green-400" /> },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-slate-700 last:border-0">
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">{item.icon}{item.label}</span>
                    <span className="text-xs font-bold text-green-400 font-mono">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick stats */}
            <Card className="hover-elevate">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Estadísticas del Día
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Procesadas", value: "1,847", color: "text-blue-600" },
                  { label: "Aprobadas", value: "1,824", color: "text-green-600" },
                  { label: "Rechazadas", value: "23", color: "text-red-600" },
                  { label: "Volumen USD", value: "$542,890", color: "text-emerald-600" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── EUR MATCH step ───────────────────────────────────────────────────── */}
      {step === "match" && pendingFormData && (
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Terminal display */}
          <Card className="bg-slate-950 text-white border-slate-700 hover-elevate overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-700">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <Euro className="w-4 h-4 text-yellow-400" />
                  Terminal — Verificación de Monto EUR
                </CardTitle>
                <div className="flex items-center gap-1.5 text-xs text-yellow-400 font-mono">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  AGUARDANDO CONFIRMACIÓN
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 pb-6 space-y-6">
              {/* Big EUR amount */}
              <div className="text-center space-y-1">
                <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Monto en terminal</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold font-mono text-white tracking-tight">
                    {eurAmtRaw.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-2xl font-bold text-yellow-400 font-mono">EUR</span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-700" />

              {/* Conversions */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded-md px-4 py-3 text-center">
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-1">Equivalente USD</p>
                  <p className="text-xl font-bold font-mono text-green-400">
                    ${eurInUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">T/C: 1 EUR = {fxEUR} USD</p>
                </div>
                <div className="bg-slate-800 rounded-md px-4 py-3 text-center">
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-1">Equivalente MXN</p>
                  <p className="text-xl font-bold font-mono text-blue-400">
                    ${eurInMXN.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">T/C: 1 EUR = {(fxEUR * tc).toFixed(4)} MXN</p>
                </div>
              </div>

              {/* Card info row */}
              <div className="flex flex-wrap items-center gap-3 bg-slate-800 rounded-md px-4 py-3">
                <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm font-mono text-slate-300">
                  {pendingFormData.cardType} — {maskCardNumber(pendingFormData.cardNumber)}
                </span>
                <Badge className="bg-yellow-900/40 text-yellow-400 border-yellow-700 no-default-active-elevate text-[10px] font-mono">
                  Protocolo {pendingFormData.protocol}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Instruction card */}
          <Card className="border-yellow-200 bg-yellow-50 hover-elevate">
            <CardContent className="pt-5 pb-5">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-yellow-100 border border-yellow-300 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-900">Verificación de emparejamiento de montos</p>
                  <p className="text-xs text-yellow-700 mt-1 leading-relaxed">
                    Confirme que el monto mostrado en la terminal física coincide exactamente con el monto registrado en el sistema.
                    Una vez verificado, la transacción será procesada y podrá ser registrada en la <strong>caja formal</strong>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              className="flex-1 h-12 bg-green-600 hover:bg-green-700 font-bold text-base"
              onClick={handleConfirmMatch}
              data-testid="button-confirm-match"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Los montos coinciden — Continuar
            </Button>
            <Button
              variant="outline"
              className="h-12"
              onClick={() => { setStep("form"); setIsEurTx(false); setPendingFormData(null); }}
              data-testid="button-cancel-match"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* ── Processing step ───────────────────────────────────────────────────── */}
      {step === "processing" && (
        <Card className="max-w-lg mx-auto hover-elevate">
          <CardContent className="pt-12 pb-12 text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="w-20 h-20 rounded-full border-4 border-gray-200" />
              <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-[#c8322b] border-t-transparent animate-spin" />
              <div className="absolute inset-3 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-[#c8322b]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xl font-bold">Procesando Transacción</p>
              <p className="text-sm text-muted-foreground">Conectando con la red bancaria segura...</p>
            </div>
            <div className="space-y-2 text-left max-w-xs mx-auto">
              {[
                "Validando datos de tarjeta...",
                "Verificando protocolo bancario...",
                "Generando token de seguridad...",
                "Enviando a red interbancaria...",
              ].map((msg, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="w-3 h-3 animate-spin flex-shrink-0" />
                  {msg}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Result step ───────────────────────────────────────────────────────── */}
      {step === "result" && result && (
        <div className="space-y-4 max-w-3xl">
          {/* Auth Code Banner */}
          <Card className="border-green-500 border-2 hover-elevate">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-7 h-7 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Transacción Autorizada</p>
                  <p className="text-3xl font-bold font-mono text-green-600">{result.authCode}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Código de Autorización</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{result.currency} {parseFloat(result.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                  <Badge className="bg-green-100 text-green-700 no-default-active-elevate mt-1">Aprobada</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* EUR → Caja banner (only for EUR transactions) */}
          {isEurTx && (
            <Card className={`border-2 hover-elevate transition-all ${sentToCaja ? "border-emerald-500 bg-emerald-50" : "border-blue-300 bg-blue-50"}`}>
              <CardContent className="pt-5 pb-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${sentToCaja ? "bg-emerald-100" : "bg-blue-100"}`}>
                    {sentToCaja
                      ? <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      : <Wallet className="w-6 h-6 text-blue-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    {sentToCaja ? (
                      <>
                        <p className="text-sm font-bold text-emerald-800">Registrado en Caja Formal</p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          €{eurAmtRaw.toLocaleString("en-US", { minimumFractionDigits: 2 })} EUR —{" "}
                          ${eurInUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD ingresado · categoría: Venta tarjeta internacional
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-blue-800">Transacción EUR lista para caja formal</p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          Montos verificados. Puede registrar €{eurAmtRaw.toLocaleString("en-US", { minimumFractionDigits: 2 })} EUR
                          (≈ ${eurInUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD) como ingreso en la caja.
                        </p>
                      </>
                    )}
                  </div>
                  {!sentToCaja && (
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 font-semibold flex-shrink-0"
                      onClick={handlePasarACaja}
                      disabled={eurIngressMutation.isPending}
                      data-testid="button-pasar-caja"
                    >
                      {eurIngressMutation.isPending
                        ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        : <ArrowDownToLine className="w-4 h-4 mr-2" />
                      }
                      {eurIngressMutation.isPending ? "Registrando..." : "Pasar a Caja Formal"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Transaction Details */}
            <Card className="hover-elevate">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Detalles de la Transacción
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "ID Transacción", value: result.transactionId || "TXN-" + Date.now(), copyKey: "txId" },
                  { label: "Auth Code", value: result.authCode, copyKey: "auth" },
                  { label: "Token ID", value: result.tokenId, copyKey: "token" },
                  { label: "Protocolo", value: result.protocol },
                  { label: "Red", value: result.network },
                  { label: "Tarjeta", value: `${result.cardType} · ${maskCardNumber(result.cardNumber)}` },
                  { label: "Timestamp", value: new Date(result.timestamp).toLocaleString("es-MX") },
                ].map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 py-1.5 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground flex-shrink-0">{item.label}</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-mono font-semibold text-right truncate max-w-[160px]">{item.value}</span>
                      {item.copyKey && (
                        <button onClick={() => handleCopy(item.value, item.copyKey!)} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors" data-testid={`copy-${item.copyKey}`}>
                          {copied === item.copyKey ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Security & Compliance */}
            <div className="space-y-4">
              <Card className="bg-slate-900 text-white hover-elevate">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-400" /> Cumplimiento de Seguridad
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "EMV", status: result.emvCompliant, detail: "ISO/IEC 7816" },
                    { label: "PCI DSS", status: result.pciCompliant, detail: "Level 1 Compliant" },
                    { label: "AES-256", status: true, detail: "Cifrado activado" },
                    { label: "TLS 1.3", status: true, detail: "Conexión segura" },
                    { label: "3D Secure", status: true, detail: "Autenticación OK" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-slate-700 last:border-0">
                      <div className="flex items-center gap-2">
                        {item.status ? <Check className="w-3 h-3 text-green-400" /> : <AlertCircle className="w-3 h-3 text-red-400" />}
                        <span className="text-xs font-bold text-slate-200">{item.label}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{item.detail}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* SWIFT Screen */}
              <Card className="bg-[#1e3a8a] text-white hover-elevate">
                <CardContent className="pt-4 pb-4">
                  <div className="font-mono text-[10px] space-y-1 text-blue-200 leading-relaxed">
                    <p className="text-white font-bold text-xs">INTERBANKING SWIFT SCREEN</p>
                    <p>SYSTEM/ACCESS/VIS91**{result.authCode}/**{result.protocol}</p>
                    <p>www.usa.visa.com/vxml/access</p>
                    <p className="text-blue-300">CENTER @visatecagency.com</p>
                    <p className="mt-2 text-white font-bold">TRACER DELIVERY REPORT</p>
                    <p>REF: VIS91**{result.authCode}/**</p>
                    <p>STATUS: <span className="text-green-300 font-bold">SUCCESSFULLY REDEEMED</span></p>
                    <p className="text-blue-300 mt-1">INTERNATIONAL GLOBAL SWIFT.COM</p>
                    <p className="text-[9px] text-blue-400">TOKEN: {result.tokenId}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleReset} className="bg-[#c8322b] hover:bg-[#a62822]" data-testid="button-new-transaction">
              <Zap className="w-4 h-4 mr-2" /> Nueva Transacción
            </Button>
            <Button variant="outline" onClick={() => handleCopy(result.authCode, "auth-final")} data-testid="button-copy-auth">
              {copied === "auth-final" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              Copiar Auth Code
            </Button>
            <Button variant="outline" onClick={handlePrint} data-testid="button-print">
              <FileText className="w-4 h-4 mr-2" /> Imprimir Recibo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
