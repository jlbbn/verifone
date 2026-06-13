import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  MonitorSmartphone, CreditCard, Wifi, ShieldCheck, CheckCircle,
  X, Delete, DollarSign, RefreshCw, Activity, Loader2, Receipt,
  Zap, Clock, Lock, AlertTriangle, Bolt
} from "lucide-react";

const CARD_TYPES = [
  "VISA Nacional",
  "VISA Internacional",
  "Mastercard Nacional",
  "Mastercard Internacional",
  "AMEX",
  "Débito Nacional",
  "Maestro",
];

const PROTOCOLS = [
  { code: "101.1", label: "101.1 M1 — Transferencia básica nacional" },
  { code: "101.2", label: "101.2 M2 — Transferencia internacional" },
  { code: "101.3", label: "101.3 M3 — Transferencia segura" },
  { code: "201.1", label: "201.1 — Pago nacional" },
  { code: "201.2", label: "201.2 — Pago internacional" },
  { code: "201.3", label: "201.3 — Pago express" },
  { code: "301.1", label: "301.1 — Depósito cuenta" },
  { code: "401.1", label: "401.1 — Retiro ATM" },
  { code: "1643",  label: "1643 — Retiro POS (Protocolo especial)" },
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

  const [step, setStep] = useState<Step>("amount");
  const [amountDigits, setAmountDigits] = useState("");
  const [cardType, setCardType] = useState("Mastercard Internacional");
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [protocol, setProtocol] = useState("201.2");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [now, setNow] = useState(new Date());

  // Venta Forzada — permite procesar independientemente del estado del banco emisor
  const [ventaForzada, setVentaForzada] = useState(false);
  const [lote, setLote] = useState(2);
  const [oper, setOper] = useState(28);

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
        holderName: holderName || "TITULAR",
        expiryDate: expiryDate || "12/27",
        ventaForzada,
      });
      if (!res.ok) throw new Error("Error al procesar");
      return res.json() as Promise<ProcessResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("approved");
      setLote(l => l + 1);
      setOper(o => o + 1);
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
    setCardType("Mastercard Internacional");
    setCardNumber("");
    setHolderName("");
    setExpiryDate("");
    setProtocol("201.2");
    setResult(null);
    setVentaForzada(false);
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
            Terminal punto de venta virtual · EMV / PCI DSS
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Venta Forzada toggle */}
          <button
            onClick={() => setVentaForzada(v => !v)}
            data-testid="button-venta-forzada"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              ventaForzada
                ? "bg-amber-500 border-amber-500 text-white shadow-md"
                : "bg-muted border-border text-muted-foreground"
            }`}
          >
            <Bolt className="w-3.5 h-3.5" />
            Venta Forzada {ventaForzada ? "ON" : "OFF"}
          </button>
          <div className="flex items-center gap-2 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-md font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> Sesión AES-256
          </div>
        </div>
      </div>

      {/* Venta Forzada warning */}
      {ventaForzada && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800 font-medium">
                <span className="font-bold">Modo Venta Forzada activo.</span> La transacción se procesará sin verificación del banco emisor. 
                Aplica solo para operaciones autorizadas bajo protocolo EMV offline. Usa con precaución.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Terminal Device */}
        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-sm">
            <div className="bg-gray-900 rounded-2xl p-5 shadow-2xl border border-gray-700">
              {/* Screen */}
              <div className={`rounded-lg p-4 mb-4 min-h-[160px] flex flex-col justify-between border ${ventaForzada ? "bg-amber-950 border-amber-700" : "bg-black border-gray-700"}`}>
                {/* Top bar */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${ventaForzada ? "bg-amber-400" : "bg-green-400"}`} />
                    <span className={`text-xs font-mono ${ventaForzada ? "text-amber-400" : "text-green-400"}`}>
                      BANXICO PLUS POS {ventaForzada ? "· FORZADA" : ""}
                    </span>
                  </div>
                  <span className="text-gray-500 text-xs font-mono">
                    {now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>

                {step === "amount" && (
                  <div className="text-center flex-1 flex flex-col justify-center">
                    <p className="text-gray-500 text-xs mb-1 uppercase tracking-widest">Monto a cobrar</p>
                    <p className="text-4xl font-bold text-white font-mono" data-testid="display-amount">
                      ${formatAmount(amountDigits)}
                    </p>
                    <p className="text-gray-600 text-xs mt-1">USD</p>
                    {ventaForzada && (
                      <p className="text-amber-400 text-[10px] mt-1 font-semibold tracking-widest">VENTA FORZADA</p>
                    )}
                  </div>
                )}

                {step === "card" && (
                  <div className="text-center flex-1 flex flex-col justify-center gap-1">
                    <p className="text-gray-400 text-xs uppercase tracking-widest">Monto</p>
                    <p className="text-2xl font-bold text-white font-mono">${formatAmount(amountDigits)}</p>
                    <p className="text-[#c8322b] text-xs mt-1 animate-pulse">Ingresa datos de tarjeta</p>
                    <div className="flex items-center justify-center gap-3 mt-1 text-[10px] text-gray-500 font-mono">
                      <span>OPER: {oper}</span>
                      <span>LOTE: {lote}</span>
                    </div>
                  </div>
                )}

                {step === "processing" && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-2">
                    <Loader2 className={`w-8 h-8 animate-spin ${ventaForzada ? "text-amber-400" : "text-[#c8322b]"}`} />
                    <p className="text-white text-sm font-bold">
                      {ventaForzada ? "Procesando FORZADO..." : "Procesando..."}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {ventaForzada ? "Modo offline EMV" : "Conectando con banco emisor"}
                    </p>
                  </div>
                )}

                {step === "approved" && (
                  <div className="text-center flex-1 flex flex-col items-center justify-center gap-1">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                    <p className="text-green-400 text-sm font-bold">APROBADO</p>
                    <p className="text-gray-400 text-xs">{result?.authCode}</p>
                    {ventaForzada && <p className="text-amber-400 text-[10px] font-semibold">VENTA FORZADA</p>}
                  </div>
                )}
              </div>

              {/* Status strip */}
              <div className="flex items-center justify-between mb-4 text-xs">
                <span className="flex items-center gap-1 text-green-400"><Wifi className="w-3 h-3" /> Online</span>
                <span className="flex items-center gap-1 text-gray-400"><Lock className="w-3 h-3" /> AES-256</span>
                <span className="flex items-center gap-1 text-blue-400"><ShieldCheck className="w-3 h-3" /> EMV</span>
                {ventaForzada && <span className="flex items-center gap-1 text-amber-400"><Bolt className="w-3 h-3" /> Forzada</span>}
              </div>

              {/* Numeric Keypad */}
              {step === "amount" && (
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
                    className={`w-full h-12 text-white rounded-lg text-base font-bold mt-1 ${ventaForzada ? "bg-amber-500" : "bg-[#c8322b]"}`}
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

              {/* Card slots */}
              <div className="mt-4 border-t border-gray-700 pt-3 flex items-center justify-center gap-4 text-gray-600">
                <div className="flex items-center gap-1 text-xs"><CreditCard className="w-4 h-4" /> Chip</div>
                <div className="flex items-center gap-1 text-xs"><Wifi className="w-4 h-4" /> NFC</div>
                <div className="flex items-center gap-1 text-xs"><Lock className="w-4 h-4" /> PIN</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Card form */}
          {(step === "card" || step === "processing") && (
            <Card className={ventaForzada ? "border-amber-300" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#c8322b]" /> Datos de Tarjeta
                  {ventaForzada && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 no-default-active-elevate text-xs">
                      <Bolt className="w-3 h-3 mr-1" /> Forzada
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Importe: ${formatAmount(amountDigits)} USD · OPER {oper} / LOTE {lote}
                </CardDescription>
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
                      placeholder="NOMBRE APELLIDO"
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
                  <Label>Protocolo de operación</Label>
                  <Select value={protocol} onValueChange={setProtocol} disabled={step === "processing"}>
                    <SelectTrigger data-testid="select-protocol"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROTOCOLS.map(p => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-1 flex flex-col gap-2">
                  <Button
                    className={`w-full text-white ${ventaForzada ? "bg-amber-500" : "bg-[#c8322b]"}`}
                    onClick={handleProcessPayment}
                    disabled={step === "processing" || processMutation.isPending}
                    data-testid="button-process-payment"
                  >
                    {processMutation.isPending
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                      : ventaForzada
                        ? <><Bolt className="w-4 h-4 mr-2" /> Procesar Venta Forzada ${formatAmount(amountDigits)}</>
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
            <Card className={ventaForzada ? "border-amber-300" : "border-green-300"}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ventaForzada ? "bg-amber-100" : "bg-green-100"}`}>
                    <CheckCircle className={`w-5 h-5 ${ventaForzada ? "text-amber-600" : "text-green-600"}`} />
                  </div>
                  <div>
                    <CardTitle className={`text-base ${ventaForzada ? "text-amber-700" : "text-green-700"}`}>
                      {ventaForzada ? "Venta Forzada Aprobada" : "Pago Aprobado"}
                    </CardTitle>
                    <CardDescription>Transacción procesada · {new Date().toLocaleString("es-MX")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2.5 font-mono text-sm">
                  <div className="text-center border-b border-dashed border-border pb-3 mb-3">
                    <p className="font-bold text-lg">BANXICO PLUS</p>
                    <p className="text-xs text-muted-foreground">VENTA{ventaForzada ? " — FORZADA" : ""}</p>
                    <p className="text-xs text-muted-foreground">GRUPO ASGE · VENADO 69</p>
                    <p className="text-xs text-muted-foreground">CANCUN QUINTANA ROO</p>
                    <p className="text-xs text-muted-foreground">{new Date().toLocaleString("es-MX")}</p>
                  </div>
                  {[
                    { label: "IMPORTE", value: `$${formatAmount(amountDigits)} USD` },
                    { label: "TARJETA", value: cardType },
                    { label: "TITULAR", value: holderName || "TITULAR" },
                    { label: "VENCIMIENTO", value: expiryDate || "**/**" },
                    { label: "PROTOCOLO", value: protocol },
                    { label: "OPER / LOTE", value: `${oper - 1} / ${lote - 1}` },
                    { label: "APROBACIÓN", value: result.authCode },
                    { label: "RRN", value: result.transaction.transactionId.slice(-8) },
                    { label: "TX ID", value: result.transaction.transactionId },
                    { label: "ESTADO", value: ventaForzada ? "APROBADO FORZADO" : "APROBADO" },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="text-muted-foreground text-xs">{row.label}</span>
                      <span className="text-right text-xs font-bold break-all">{row.value}</span>
                    </div>
                  ))}
                  <div className="text-center pt-3 border-t border-dashed border-border mt-2">
                    <p className="text-xs text-muted-foreground mb-2">COPIA DEL COMERCIO</p>
                    <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-green-600" /> EMV</span>
                      <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-blue-600" /> PCI DSS</span>
                      <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-purple-600" /> AES-256</span>
                    </div>
                  </div>
                </div>
                <Button
                  className={`w-full mt-4 text-white ${ventaForzada ? "bg-amber-500" : "bg-[#c8322b]"}`}
                  onClick={handleNewTransaction}
                  data-testid="button-new-transaction"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Nueva Transacción
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Instructions on amount step */}
          {step === "amount" && (
            <Card className="hover-elevate">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#c8322b]" /> Instrucciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2.5">
                  {[
                    { n: "1", text: "Ingresa el importe en centavos (ej. 2016000 = $20,160.00)" },
                    { n: "2", text: "Confirma el monto y selecciona el tipo de tarjeta" },
                    { n: "3", text: "Ingresa número de tarjeta, titular y vencimiento" },
                    { n: "4", text: "Selecciona el protocolo de operación (ej. 101.2 M2 para internacional)" },
                    { n: "5", text: "Activa Venta Forzada si el banco emisor no responde (modo offline EMV)" },
                  ].map(s => (
                    <li key={s.n} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#c8322b]/10 text-[#c8322b] flex items-center justify-center text-xs font-bold">{s.n}</span>
                      <span className="text-muted-foreground">{s.text}</span>
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
                <p className="text-xs text-muted-foreground">Promedio red</p>
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
