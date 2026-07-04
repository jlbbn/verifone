import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CreditCard, Globe, Zap, CheckCircle, RefreshCw,
  Shield, Lock, DollarSign, ChevronDown, ChevronUp,
} from "lucide-react";

type ChargeRecord = {
  id: string;
  chargeId: string;
  processor: "stripe" | "mercadopago";
  amount: number;
  currency: string;
  status: string;
  description: string;
  cardLast4?: string;
  cardBrand?: string;
  receiptUrl?: string | null;
  createdAt: string;
  createdBy?: string;
};

const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "MXN", label: "MXN — Peso Mexicano" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "ARS", label: "ARS — Peso Argentino" },
  { code: "COP", label: "COP — Peso Colombiano" },
  { code: "BRL", label: "BRL — Real Brasileño" },
];

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  succeeded:  { label: "Approved",   cls: "bg-green-100 text-green-700 border-green-200" },
  pending:    { label: "Pending",    cls: "bg-amber-100 text-amber-700 border-amber-200" },
  failed:     { label: "Failed",     cls: "bg-red-100 text-red-700 border-red-200" },
  approved:   { label: "Approved",   cls: "bg-green-100 text-green-700 border-green-200" },
  in_process: { label: "Processing", cls: "bg-blue-100 text-blue-700 border-blue-200" },
};

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Unified Payment Engine Panel — Visa Quantum 9.0 ─────────────────────────
// Single automatic engine: tries Stripe first, falls back to Mercado Pago
// transparently on the backend. No manual processor selection.
export function PaymentEnginePanel() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [amount, setAmount]       = useState("");
  const [currency, setCurrency]   = useState("USD");
  const [desc, setDesc]           = useState("");
  const [cardNum, setCardNum]     = useState("");
  const [expiry, setExpiry]       = useState("");
  const [cvv, setCvv]             = useState("");
  const [holder, setHolder]       = useState("");
  const [email, setEmail]         = useState("");
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [docType, setDocType]     = useState("CPF");
  const [docNum, setDocNum]       = useState("");

  const { data: charges = [], isLoading } = useQuery<ChargeRecord[]>({
    queryKey: ["/api/payment-engine/charges"],
  });

  const { data: stripeCfg } = useQuery<{ mode: string; live: boolean; publishableKey: string }>({
    queryKey: ["/api/stripe/config"],
  });

  const { data: perms } = useQuery<{ paymentEngineAccess: boolean; posFullAccess: boolean }>({
    queryKey: ["/api/user/permissions"],
    enabled: !!user,
  });

  const chargeMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await apiRequest("POST", "/api/payment-engine/charge", body);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-engine/charges"] });
      if (data.status === "succeeded" || data.status === "approved") {
        toast({ title: "Cobro aprobado", description: `Auth: ${data.chargeId}` });
        setAmount(""); setDesc(""); setCardNum(""); setExpiry(""); setCvv(""); setHolder(""); setEmail(""); setDocNum("");
      } else {
        toast({ title: "Cobro rechazado", description: data.error ?? "Declined", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function handleCharge() {
    if (!amount || !cardNum || !expiry || !cvv || !holder || !email) {
      toast({ title: "Campos requeridos", variant: "destructive" });
      return;
    }
    const [expMonth, expYear] = expiry.split("/").map(s => s.trim());
    chargeMutation.mutate({
      amount: parseFloat(amount),
      currency,
      description: desc || "Banxico Plus charge",
      email,
      card: {
        number:   cardNum.replace(/\s/g, ""),
        expMonth: parseInt(expMonth),
        expYear:  parseInt(expYear.length === 2 ? `20${expYear}` : expYear),
        cvv,
        holder,
      },
      docType, docNum,
    });
  }

  const totalApproved = charges.filter(c => c.status === "succeeded" || c.status === "approved").length;
  const totalVolume = charges
    .filter(c => c.status === "succeeded" || c.status === "approved" || c.status === "in_process")
    .reduce((s, c) => s + c.amount, 0);

  if (user?.role !== "ADMIN" && perms !== undefined && !perms.paymentEngineAccess) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-6 py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-[#c8322b]" />
            <h1 className="text-xl font-bold">Visa Quantum 9.0 — Motor de Pagos</h1>
          </div>
          <h3 className="font-bold text-amber-900 text-lg mt-2">Acceso no autorizado</h3>
          <p className="text-sm text-amber-700 mt-2 max-w-md mx-auto">
            Tu cuenta no tiene acceso al Motor de Pagos. Contacta al administrador del sistema para que active tu permiso.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-amber-100 border border-amber-200 rounded-md px-4 py-2 text-xs font-mono text-amber-800">
          <Shield className="w-3.5 h-3.5" />
          PAYMENT_ENGINE_ACCESS_DENIED — ERR_PE_PERM_001
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#c8322b]" />
            <h1 className="text-xl font-bold">Visa Quantum 9.0 — Motor de Pagos Unificado</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Motor de cobros internacional · Selección automática de procesador
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {stripeCfg && (
            <Badge className={`no-default-active-elevate gap-1 font-bold ${stripeCfg.live ? "bg-green-600 text-white border-green-700" : "bg-amber-100 text-amber-800 border-amber-300"}`}>
              <Zap className="w-3 h-3" />
              Motor {stripeCfg.live ? "LIVE" : "TEST"}
            </Badge>
          )}
          <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate gap-1">
            <Shield className="w-3 h-3" /> PCI DSS
          </Badge>
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 no-default-active-elevate gap-1">
            <Lock className="w-3 h-3" /> TLS 1.3
          </Badge>
          <Badge className="bg-purple-100 text-purple-700 border-purple-200 no-default-active-elevate gap-1">
            <Globe className="w-3 h-3" /> Internacional
          </Badge>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Total Cobros</p>
          <p className="text-2xl font-bold">{charges.length}</p>
        </CardContent></Card>
        <Card><CardContent className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Aprobados</p>
          <p className="text-2xl font-bold text-green-600">{totalApproved}</p>
        </CardContent></Card>
        <Card><CardContent className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Volumen Total</p>
          <p className="text-lg font-bold text-[#c8322b] leading-tight mt-0.5">
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalVolume)}
          </p>
        </CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">

        {/* ── Charge Form ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4 text-[#c8322b]" />
              Nuevo Cobro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">

            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Zap className="w-3.5 h-3.5 text-[#c8322b] flex-shrink-0" />
              Motor unificado: el sistema selecciona automáticamente Stripe o Mercado Pago.
            </div>

            {/* Amount + Currency */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Amount *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="0.00"
                    className="pl-7"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    type="number"
                    min="0.01"
                    step="0.01"
                    data-testid="input-charge-amount"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger data-testid="select-charge-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                placeholder="Banxico Plus — service charge"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                data-testid="input-charge-description"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label className="text-xs">Cardholder email *</Label>
              <Input
                type="email"
                placeholder="customer@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                data-testid="input-charge-email"
              />
            </div>

            {/* Card holder */}
            <div className="space-y-1">
              <Label className="text-xs">Cardholder name *</Label>
              <Input
                placeholder="JOHN DOE"
                value={holder}
                onChange={e => setHolder(e.target.value.toUpperCase())}
                data-testid="input-charge-holder"
              />
            </div>

            {/* Card number */}
            <div className="space-y-1">
              <Label className="text-xs">Card number *</Label>
              <Input
                placeholder="4242 4242 4242 4242"
                value={cardNum}
                maxLength={19}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                  setCardNum(v.replace(/(.{4})/g, "$1 ").trim());
                }}
                data-testid="input-charge-cardnum"
              />
            </div>

            {/* Expiry + CVV */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Expiry (MM/YY) *</Label>
                <Input
                  placeholder="MM/YY"
                  maxLength={5}
                  value={expiry}
                  onChange={e => {
                    let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
                    setExpiry(v);
                  }}
                  data-testid="input-charge-expiry"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CVV *</Label>
                <Input
                  placeholder="123"
                  maxLength={4}
                  type="password"
                  value={cvv}
                  onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  data-testid="input-charge-cvv"
                />
              </div>
            </div>

            {/* Optional ID fields — only used if the engine falls back to Mercado Pago */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Document type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CPF">CPF (Brazil)</SelectItem>
                    <SelectItem value="CNPJ">CNPJ (Brazil)</SelectItem>
                    <SelectItem value="CURP">CURP (Mexico)</SelectItem>
                    <SelectItem value="CC">CC (Colombia)</SelectItem>
                    <SelectItem value="DNI">DNI (Argentina)</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Document number</Label>
                <Input
                  placeholder="12345678"
                  value={docNum}
                  onChange={e => setDocNum(e.target.value)}
                  data-testid="input-charge-docnum"
                />
              </div>
            </div>

            <Button
              className="w-full bg-[#c8322b] mt-1"
              onClick={handleCharge}
              disabled={chargeMutation.isPending || !amount || !cardNum || !expiry || !cvv || !holder || !email}
              data-testid="button-process-charge"
            >
              {chargeMutation.isPending
                ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Processing…</>
                : <><Zap className="w-4 h-4 mr-2" />Process Charge</>
              }
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              Motor de Pagos Unificado · PCI DSS Level 1
            </p>
          </CardContent>
        </Card>

        {/* ── Transaction history ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Historial de Cobros</h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : charges.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10 gap-2">
                <CreditCard className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No charges yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {charges.map(c => {
                const st = STATUS_CFG[c.status] ?? { label: c.status, cls: "bg-muted text-muted-foreground" };
                const isExp = expanded === c.id;
                return (
                  <Card key={c.id} data-testid={`card-charge-${c.id}`}>
                    <CardContent className="px-4 py-3">
                      <div
                        className="flex items-center justify-between gap-2 cursor-pointer"
                        onClick={() => setExpanded(isExp ? null : c.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center ${
                            c.processor === "stripe" ? "bg-[#635bff]/10" : "bg-[#00b1ea]/10"
                          }`}>
                            {c.processor === "stripe"
                              ? <CreditCard className="w-4 h-4 text-[#635bff]" />
                              : <Globe className="w-4 h-4 text-[#00b1ea]" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{fmtAmount(c.amount, c.currency)}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{c.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={`text-[10px] no-default-active-elevate ${st.cls}`}>
                            {st.label}
                          </Badge>
                          {isExp ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                      </div>

                      {isExp && (
                        <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs">
                          <div className="grid grid-cols-2 gap-1">
                            <span className="text-muted-foreground">Charge ID</span>
                            <span className="font-mono truncate">{c.chargeId}</span>
                            <span className="text-muted-foreground">Processor</span>
                            <span className="capitalize">{c.processor}</span>
                            <span className="text-muted-foreground">Card</span>
                            <span>{c.cardBrand ? `${c.cardBrand} ····${c.cardLast4}` : "—"}</span>
                            <span className="text-muted-foreground">Date</span>
                            <span>{fmtDate(c.createdAt)}</span>
                            {user?.role === "ADMIN" && c.createdBy && (
                              <>
                                <span className="text-muted-foreground">Creado por</span>
                                <span className="font-mono text-[10px] truncate">{c.createdBy}</span>
                              </>
                            )}
                          </div>
                          {c.receiptUrl && (
                            <a
                              href={c.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#c8322b] hover:underline mt-1"
                            >
                              <CheckCircle className="w-3 h-3" /> View receipt
                            </a>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
