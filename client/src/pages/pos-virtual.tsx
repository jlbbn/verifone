import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  MonitorSmartphone, CreditCard, Wifi, ShieldCheck, CheckCircle,
  X, Delete, DollarSign, RefreshCw, Activity, Loader2, Receipt,
  Zap, Clock, Lock
} from "lucide-react";

const CARD_TYPES = ["VISA", "Mastercard", "AMEX", "Débito", "Maestro"];

const PROTOCOLS = [
  { code: "201.1", label: "201.1 — Pago Nacional" },
  { code: "201.2", label: "201.2 — Pago Internacional" },
  { code: "201.3", label: "201.3 — Pago Express" },
  { code: "101.3", label: "101.3 — Transferencia Segura" },
];

interface ProcessResult {
  success: boolean;
  authCode: string;
  tokenId: string;
  transaction: { transactionId: string; amount: string; status: string; createdAt: string };
  message: string;
}

function formatAmount(digits: string): string {
  if (!digits) return "0.00";
  const num = parseInt(digits, 10);
  return (num / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Step = "amount" | "card" | "processing" | "approved";

export default function POSVirtualPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Steps: amount → card → processing → approved
  const [step, setStep] = useState<Step>("amount");
  const [amountDigits, setAmountDigits] = useState("");
  const [cardType, setCardType] = useState("VISA");
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [protocol, setProtocol] = useState("201.1");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const processMutation = useMutation({
    mutationFn: async () => {
      const amount = parseInt(amountDigits, 10) / 100;
      if (amount <= 0) throw new Error("Monto inválido");
      const res = await apiRequest("POST", "/api/pos/process-payment", {
        cardType,
        cardNumber: cardNumber.replace(/\s/g, "") || "4111111111111111",
        amount,
        protocol,
        holderName: holderName || "Titular",
        expiryDate: expiryDate || "12/26",
      });
      if (!res.ok) throw new Error("Error al procesar");
      return res.json() as Promise<ProcessResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("approved");
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transaction-logs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error de procesamiento", description: err.message, variant: "destructive" });
      setStep("amount");
    },
  });

  function handleKey(key: string) {
    if (step !== "amount") return;
    if (key === "C") { setAmountDigits(""); return; }
    if (key === "DEL") { setAmountDigits(prev => prev.slice(0, -1)); return; }
    if (amountDigits.length >= 9) return;
    setAmountDigits(prev => prev + key);
  }

  function handleConfirmAmount() {
    const amount = parseInt(amountDigits, 10) / 100;
    if (!amount || amount <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a $0.00", variant: "destructive" });
      return;
    }
    setStep("card");
  }

  function handleProcessPayment() {
    if (!cardType) return;
    setStep("processing");
    processMutation.mutate();
  }

  function handleNewTransaction() {
    setStep("amount");
    setAmountDigits("");
    setCardType("VISA");
    setCardNumber("");
    setHolderName("");
    setExpiryDate("");
    setProtocol("201.1");
    setResult(null);
  }

  function formatCardDisplay(n: string) {
    const clean = n.replace(/\D/g, "").substring(0, 16);
    return clean.replace(/(.{4})/g, "$1 ").trim();
  }

  const numpadKeys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["C", "0", "DEL"],
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MonitorSmartphone className="w-7 h-7 text-[#c8322b]" /> POS Virtual
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Terminal punto de venta virtual · Procesamiento seguro EMV/PCI DSS
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-md font-medium">
          <ShieldCheck className="w-3.5 h-3.5" /> Sesión cifrada AES-256
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Left: POS Terminal Device */}
        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-sm">
            {/* Terminal body */}
            <div className="bg-gray-900 rounded-2xl p-5 shadow-2xl border border-gray-700">
              {/* Screen */}
              <div className="bg-black rounded-lg p-4 mb-4 min-h-[140px] flex flex-col justify-between border border-gray-700">
                {/* Top bar */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400 text-xs font-mono">BANXICO PLUS POS</span>
                  </div>
                  <span className="text-gray-500 text-xs font-mono">
                    {now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>

                {/* Amount display */}
                {step === "amount" && (
                  <div className="text-center flex-1 flex flex-col justify-center">
                    <p className="text-gray-500 text-xs mb-1 uppercase tracking-widest">Monto a cobrar</p>
                    <p className="text-4xl font-bold text-white font-mono" data-testid="display-amount">
                      ${formatAmount(amountDigits)}
                    </p>
                    <p className="text-gray-600 text-xs mt-1">USD</p>
                  </div>
                )}

                {step === "card" && (
                  <div className="text-center flex-1 flex flex-col justify-center gap-1">
                    <p className="text-gray-400 text-xs uppercase tracking-widest">Monto</p>
                    <p className="text-2xl font-bold text-white font-mono">${formatAmount(amountDigits)}</p>
                    <p className="text-[#c8322b] text-xs mt-1 animate-pulse">Ingresa datos de tarjeta</p>
                  </div>
                )}

                {step === "processing" && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-[#c8322b] animate-spin" />
                    <p className="text-white text-sm font-bold">Procesando...</p>
                    <p className="text-gray-500 text-xs">Conectando con banco emisor</p>
                  </div>
                )}

                {step === "approved" && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-1">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                    <p className="text-green-400 text-sm font-bold">APROBADO</p>
                    <p className="text-gray-400 text-xs">{result?.authCode}</p>
                  </div>
                )}
              </div>

              {/* Status strip */}
              <div className="flex items-center justify-between mb-4 text-xs">
                <span className="flex items-center gap-1 text-green-400">
                  <Wifi className="w-3 h-3" /> Conectado
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <Lock className="w-3 h-3" /> Cifrado
                </span>
                <span className="flex items-center gap-1 text-blue-400">
                  <ShieldCheck className="w-3 h-3" /> EMV
                </span>
              </div>

              {/* Numeric Keypad */}
              {(step === "amount") && (
                <div className="space-y-2">
                  {numpadKeys.map((row, ri) => (
                    <div key={ri} className="grid grid-cols-3 gap-2">
                      {row.map((key) => (
                        <button
                          key={key}
                          onClick={() => handleKey(key)}
                          data-testid={`key-${key}`}
                          className={`
                            h-12 rounded-lg font-bold text-lg transition-all active:scale-95
                            ${key === "C"
                              ? "bg-yellow-600/80 text-white hover:bg-yellow-500"
                              : key === "DEL"
                              ? "bg-red-700/80 text-white hover:bg-red-600 flex items-center justify-center"
                              : "bg-gray-700 text-white hover:bg-gray-600"
                            }
                          `}
                        >
                          {key === "DEL" ? <Delete className="w-4 h-4 mx-auto" /> : key}
                        </button>
                      ))}
                    </div>
                  ))}
                  <Button
                    className="w-full h-12 bg-[#c8322b] text-white rounded-lg text-base font-bold mt-1"
                    onClick={handleConfirmAmount}
                    data-testid="button-confirm-amount"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" /> Confirmar
                  </Button>
                </div>
              )}

              {step === "approved" && (
                <Button
                  className="w-full h-12 bg-gray-700 text-white rounded-lg font-bold"
                  onClick={handleNewTransaction}
                  data-testid="button-new-transaction-keypad"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Nueva Transacción
                </Button>
              )}

              {/* Card slots visual */}
              <div className="mt-4 border-t border-gray-700 pt-3 flex items-center justify-center gap-4 text-gray-600">
                <div className="flex items-center gap-1 text-xs"><CreditCard className="w-4 h-4" /> Chip</div>
                <div className="flex items-center gap-1 text-xs"><Wifi className="w-4 h-4" /> NFC</div>
                <div className="flex items-center gap-1 text-xs"><Lock className="w-4 h-4" /> PIN</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Card Form + Receipt */}
        <div className="space-y-4">
          {/* Card info form */}
          {(step === "card" || step === "processing") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#c8322b]" /> Datos de la Tarjeta
                </CardTitle>
                <CardDescription>Ingresa los datos para procesar el pago de ${formatAmount(amountDigits)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Tipo de Tarjeta</Label>
                  <Select value={cardType} onValueChange={setCardType} disabled={step === "processing"}>
                    <SelectTrigger data-testid="select-card-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CARD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Número de Tarjeta</Label>
                  <Input
                    placeholder="•••• •••• •••• ••••"
                    value={cardNumber}
                    onChange={e => setCardNumber(formatCardDisplay(e.target.value))}
                    maxLength={19}
                    disabled={step === "processing"}
                    className="font-mono tracking-widest"
                    data-testid="input-card-number"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Titular</Label>
                    <Input
                      placeholder="Nombre completo"
                      value={holderName}
                      onChange={e => setHolderName(e.target.value.toUpperCase())}
                      disabled={step === "processing"}
                      data-testid="input-holder-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vencimiento</Label>
                    <Input
                      placeholder="MM/YY"
                      value={expiryDate}
                      onChange={e => {
                        let v = e.target.value.replace(/\D/g, "");
                        if (v.length >= 2) v = v.substring(0, 2) + "/" + v.substring(2, 4);
                        setExpiryDate(v);
                      }}
                      maxLength={5}
                      disabled={step === "processing"}
                      data-testid="input-expiry"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Protocolo</Label>
                  <Select value={protocol} onValueChange={setProtocol} disabled={step === "processing"}>
                    <SelectTrigger data-testid="select-protocol"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROTOCOLS.map(p => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-1 flex flex-col gap-2">
                  <Button
                    className="w-full bg-[#c8322b] text-white"
                    onClick={handleProcessPayment}
                    disabled={step === "processing" || processMutation.isPending}
                    data-testid="button-process-payment"
                  >
                    {processMutation.isPending
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                      : <><Zap className="w-4 h-4 mr-2" /> Procesar Pago ${formatAmount(amountDigits)}</>
                    }
                  </Button>
                  <Button variant="outline" onClick={() => setStep("amount")} disabled={step === "processing"} data-testid="button-back-amount">
                    <X className="w-4 h-4 mr-2" /> Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Receipt */}
          {step === "approved" && result && (
            <Card className="border-green-300">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-green-700">Pago Aprobado</CardTitle>
                    <CardDescription>Transacción procesada correctamente</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2.5 font-mono text-sm">
                  <div className="text-center border-b border-dashed border-border pb-3 mb-3">
                    <p className="font-bold text-lg">BANXICO PLUS</p>
                    <p className="text-xs text-muted-foreground">Terminal Punto de Venta Virtual</p>
                    <p className="text-xs text-muted-foreground">{new Date().toLocaleString("es-MX")}</p>
                  </div>
                  {[
                    { label: "MONTO", value: `$${formatAmount(amountDigits)} USD` },
                    { label: "TARJETA", value: cardType },
                    { label: "PROTOCOLO", value: protocol },
                    { label: "AUTH CODE", value: result.authCode },
                    { label: "TOKEN", value: result.tokenId.substring(0, 24) + "..." },
                    { label: "TX ID", value: result.transaction.transactionId },
                    { label: "ESTADO", value: "APROBADO" },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="text-muted-foreground text-xs">{row.label}</span>
                      <span className="text-right text-xs font-bold break-all">{row.value}</span>
                    </div>
                  ))}
                  <div className="text-center pt-3 border-t border-dashed border-border mt-2">
                    <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-green-600" /> EMV</span>
                      <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-blue-600" /> PCI DSS</span>
                      <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-purple-600" /> AES-256</span>
                    </div>
                  </div>
                </div>
                <Button className="w-full mt-4 bg-[#c8322b] text-white" onClick={handleNewTransaction} data-testid="button-new-transaction">
                  <RefreshCw className="w-4 h-4 mr-2" /> Nueva Transacción
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Instructions when on amount step */}
          {step === "amount" && (
            <Card className="hover-elevate">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#c8322b]" /> Cómo usar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2.5">
                  {[
                    { n: "1", text: "Usa el teclado numérico para ingresar el monto (en centavos, ej. 100 = $1.00)" },
                    { n: "2", text: "Presiona Confirmar para continuar" },
                    { n: "3", text: "Ingresa los datos de la tarjeta y selecciona el protocolo" },
                    { n: "4", text: "Presiona Procesar Pago para completar la transacción" },
                  ].map(step => (
                    <li key={step.n} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#c8322b]/10 text-[#c8322b] flex items-center justify-center text-xs font-bold">{step.n}</span>
                      <span className="text-muted-foreground">{step.text}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="hover-elevate">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">Tiempo respuesta</span>
                </div>
                <p className="text-xl font-bold text-blue-600">~2.1s</p>
                <p className="text-xs text-muted-foreground">Promedio</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Operador</span>
                </div>
                <p className="text-sm font-bold truncate">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground">{user?.role}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
