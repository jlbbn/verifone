import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileText, CheckCircle, AlertTriangle, Clock, CreditCard,
  Download, MonitorSmartphone, ExternalLink, Shield, Copy, Check,
  Lock, BarChart2, TrendingUp, Ban, Info, Wrench, RefreshCw,
  CircleDot, Circle, Loader,
} from "lucide-react";

interface PaymentHistoryEntry {
  ref: string; date: string; amountMXN: number; amountUSD: number; tc: number; status: string;
}
interface NextThreshold {
  amountMXN: number; amountUSD: number; totalAfterUSD: number; description: string;
}
interface MaintenanceLogEntry {
  time: string; phase: number; event: string; detail: string;
  status: "done" | "active" | "pending";
}

interface SubscriptionData {
  userId: string;
  userName: string;
  userEmail: string;
  plan: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: string;
  contractDate: string;
  contractTerm: string;
  status: "partial" | "complete" | "pending" | "maintenance";
  restricted?: boolean;
  paymentWarning?: string;
  posUnlocked: boolean;
  posLocked?: boolean;
  walletAddress: string | null;
  walletNetwork: string | null;
  walletToken: string | null;
  company: string;
  phone: string;
  signerName: string;
  signerTitle: string;
  supplierAddress: string;
  adminCanInterfere?: boolean;
  adminIntervention?: boolean;
  lockReason?: string;
  lockCode?: string;
  lockDate?: string;
  disputeBlock?: string;
  disputeRef?: string;
  disputeDate?: string;
  diagnosticPatch?: boolean;
  diagnosticPatchActive?: boolean;
  diagnosticPatchThreshold?: number;
  diagnosticPatchPct?: number;
  diagnosticPatchMessage?: string;
  paymentHistory?: PaymentHistoryEntry[];
  nextThreshold?: NextThreshold;
  maintenanceCode?: string;
  maintenanceStarted?: string;
  maintenanceETA?: string;
  maintenancePhase?: number;
  maintenanceTotalPhases?: number;
  maintenanceLogs?: MaintenanceLogEntry[];
}

function generateContractPDF(sub: SubscriptionData) {
  const pct = Math.round((sub.paidAmount / sub.totalAmount) * 100);
  const isPending = sub.status === "pending";
  const mxnEquiv = isPending ? "6,500.00 MXN" : "13,000,000 MXN";
  const contractTime = isPending ? "06/24/2026  |  18:59 CST" : sub.contractDate;
  const statusBadgeClass = isPending ? "badge-partial" : sub.status === "complete" ? "badge-complete" : "badge-partial";
  const statusLabel = isPending ? "PAYMENT PENDING" : sub.status === "complete" ? "PAID IN FULL" : "PARTIAL PAYMENT";

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>BANXICO PLUS — Contract ${sub.userName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color:#111; background:#fff; padding:48px; font-size:12px; line-height:1.6; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:3px solid #c8322b; }
  .brand { font-size:22px; font-weight:900; color:#c8322b; letter-spacing:-0.5px; }
  .brand span { color:#111; }
  .address { font-size:10px; color:#555; margin-top:4px; }
  .address-right { font-size:10px; color:#555; text-align:right; margin-top:4px; }
  h1 { font-size:15px; font-weight:700; margin:20px 0 6px; color:#111; text-align:center; text-transform:uppercase; letter-spacing:.5px; }
  h2 { font-size:11px; font-weight:700; margin:16px 0 5px; text-transform:uppercase; letter-spacing:.5px; color:#c8322b; border-bottom:1px solid #eee; padding-bottom:4px; }
  table { width:100%; border-collapse:collapse; margin:10px 0; }
  th { background:#c8322b; color:#fff; padding:6px 10px; text-align:left; font-size:10px; }
  td { padding:6px 10px; border-bottom:1px solid #f0f0f0; font-size:10.5px; }
  tr:last-child td { border:none; }
  .total-row td { font-weight:700; background:#fff8f8; }
  .label { font-weight:600; color:#555; width:180px; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin:24px 0; }
  .sig-box { border:1px solid #ddd; padding:14px; border-radius:6px; background:#fafafa; }
  .sig-box .title { font-size:10px; color:#888; margin-bottom:6px; text-transform:uppercase; letter-spacing:.5px; }
  .sig-box .name { font-size:13px; font-weight:700; }
  .sig-box .detail { font-size:10px; color:#555; margin-top:2px; }
  .legal-section { margin-top:20px; padding-top:14px; border-top:2px solid #eee; }
  .legal-section h2 { color:#111; }
  .clause { margin-bottom:12px; }
  .clause-title { font-size:11px; font-weight:700; color:#c8322b; margin-bottom:3px; }
  .clause-body { font-size:9.5px; color:#444; line-height:1.65; }
  .footer { margin-top:24px; padding-top:10px; border-top:1px solid #ddd; font-size:9px; color:#888; text-align:center; }
  .badge { display:inline-block; padding:2px 8px; border-radius:3px; font-size:10px; font-weight:700; }
  .badge-partial { background:#FEF3C7; color:#92400E; }
  .badge-complete { background:#D1FAE5; color:#065F46; }
  @media print { body { padding:30px; } @page { margin:15mm; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">BANXICO<span>+</span> LLC</div>
    <div class="address">7652 Sawmill Road, Suite 341 | Dublin, Ohio 43016 | United States<br>The Landmark GDL | Guadalajara, Jalisco, Mexico</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:14px;font-weight:700;color:#111;">SERVICES AGREEMENT &amp; ORDER FORM</div>
    <div style="font-size:10px;color:#555;margin-top:3px;">Financial Technology Services — Usuario Banxico+</div>
    <div style="font-size:10px;color:#888;margin-top:2px;">ORDER FORM FOR: ${sub.userName.toUpperCase()}</div>
    <div style="font-size:10px;color:#888;">Effective Date: ${contractTime}</div>
  </div>
</div>

<h2>Services — Products</h2>
<table>
  <tr>
    <th>Services</th>
    <th>Billing Frequency</th>
    <th>Price</th>
    <th>Quantity</th>
    <th>Total Price</th>
  </tr>
  <tr>
    <td>Usuario Banxico+</td>
    <td>Anual</td>
    <td>$${sub.totalAmount}.00</td>
    <td>1</td>
    <td>$${sub.totalAmount}.00</td>
  </tr>
  <tr class="total-row">
    <td colspan="4">TOTAL USD</td><td>$${sub.totalAmount}.00 USD</td>
  </tr>
  <tr class="total-row">
    <td colspan="4">TOTAL MXN (referencial)</td><td>${mxnEquiv}</td>
  </tr>
</table>

<h2>Administrator Information</h2>
<table>
  <tr><td class="label">Admin Full Name</td><td>${sub.userName.toUpperCase()}</td></tr>
  <tr><td class="label">Admin Email</td><td>${sub.userEmail}</td></tr>
  <tr><td class="label">Admin Job Title</td><td>Admin</td></tr>
  <tr><td class="label">Admin Phone</td><td>${sub.phone}</td></tr>
  <tr><td class="label">Company</td><td>${sub.company}</td></tr>
  <tr><td class="label">Effective Date</td><td>${contractTime}</td></tr>
</table>

<h2>Payment Status</h2>
<table>
  <tr><td class="label">Contract Term</td><td>${sub.contractTerm} (1 year)</td></tr>
  <tr><td class="label">Total Amount</td><td>$${sub.totalAmount}.00 ${sub.currency}</td></tr>
  <tr><td class="label">Amount Paid</td><td>$${sub.paidAmount}.00 ${sub.currency}</td></tr>
  <tr><td class="label">Remaining Balance</td><td>$${sub.remainingAmount}.00 ${sub.currency}</td></tr>
  <tr><td class="label">Status</td><td><span class="badge ${statusBadgeClass}">${statusLabel}</span></td></tr>
</table>

<div class="legal-section">
<h2>Legal Terms &amp; Conditions</h2>

<div class="clause">
  <div class="clause-title">1. Scope and Amendment</div>
  <div class="clause-body">This Services Agreement and Order Form (the "Agreement") amends and is incorporated into the original Order Form and Terms of Use, and/or Software as a Service Agreement, between Customer and Banxico Plus LLC ("Supplier"). This Agreement formalizes the provision of financial technology services, additional license seats, and/or additional services described herein, and governs the entire commercial and operational relationship between the parties with respect thereto.</div>
</div>

<div class="clause">
  <div class="clause-title">2. Acceptance and Payment Terms</div>
  <div class="clause-body">By accepting this Banxico+ Services License and/or Services Add-On, Customer agrees to purchase the services described in this Order Form. Payment is due in full upfront prior to the activation or delivery of any services, licenses, or additional seats. Failure to remit payment within the agreed billing cycle shall result in immediate suspension of access to the platform and services, without prejudice to the Supplier's right to pursue payment recovery.</div>
</div>

<div class="clause">
  <div class="clause-title">3. Continuity of Existing Subscriptions</div>
  <div class="clause-body">Customer's subscription for any previously existing license seats under the Original Agreement shall continue unaffected by this Order Form. Any fees relating to those seats shall continue to be billed unchanged under the Original Agreement, unless otherwise expressly modified by a subsequent written amendment signed by authorized representatives of both parties.</div>
</div>

<div class="clause">
  <div class="clause-title">4. Term, Proration, and Annual Price Adjustment</div>
  <div class="clause-body">This Agreement is effective as of the date agreed upon by both parties. Additional fees will be prorated from the effective date until the end of the current 12-month term. Fees for any subsequent 12-month term shall not be prorated and shall be billed at full 12-month rates. Access to purchased services shall be enabled once the invoice is received and paid in full. Pricing is subject to an annual adjustment of up to ten percent (10%), effective on each anniversary of the Effective Date.</div>
</div>

<div class="clause">
  <div class="clause-title">5. Responsibility for Resources and Platform Use</div>
  <div class="clause-body">Customer acknowledges that all actions performed within the Banxico Plus platform under Customer's credentials or authorized users are the sole responsibility of the Customer. Customer shall ensure all authorized users comply with the platform's Terms of Use, applicable laws, and financial regulations of the United States and the Republic of Mexico. Banxico Plus LLC shall not be liable for misuse, unauthorized access resulting from Customer's negligence, or operational errors attributable to Customer or its authorized users.</div>
</div>

<div class="clause">
  <div class="clause-title">6. Sender and Receiver Responsibility in Financial Operations</div>
  <div class="clause-body">In the context of any financial transaction, remittance, or fund transfer facilitated through the Banxico Plus platform: <strong>Sender Responsibility:</strong> The Sender is solely responsible for the accuracy of all recipient information. <strong>Receiver Responsibility:</strong> The Receiver acknowledges that funds are subject to applicable clearing times, regulatory holds, and compliance reviews. <strong>Mutual Indemnification:</strong> Both Sender and Receiver agree to indemnify and hold harmless Banxico Plus LLC from any claims, penalties, fines, or damages. <strong>Dispute Window:</strong> Any disputed transaction must be reported in writing within five (5) business days of the transaction date.</div>
</div>

<div class="clause">
  <div class="clause-title">7. Regulatory Compliance and AML/KYC Obligations</div>
  <div class="clause-body">Both parties agree to comply with all applicable anti-money laundering (AML) and know-your-customer (KYC) regulations, including those of the Financial Crimes Enforcement Network (FinCEN), the Bank Secrecy Act (BSA), and Mexico's LFPIORPI. Customer agrees to provide truthful, complete, and current identity and business documentation upon request. Non-compliance constitutes grounds for immediate termination.</div>
</div>

<div class="clause">
  <div class="clause-title">8. Data Privacy and Information Security</div>
  <div class="clause-body">Banxico Plus LLC maintains appropriate technical and organizational measures to protect Customer's personal and financial data in accordance with the CCPA, GDPR (as applicable), and Mexico's LFPDPPP. Customer data shall not be sold, rented, or disclosed to third parties except as required by law or to fulfill the services described herein.</div>
</div>

<div class="clause">
  <div class="clause-title">9. Service Level and Liability Limitation</div>
  <div class="clause-body">Banxico Plus LLC shall use commercially reasonable efforts to maintain platform availability of no less than 99% uptime on a monthly basis, excluding scheduled maintenance windows communicated at least 48 hours in advance. In no event shall Banxico Plus LLC be liable for indirect, incidental, special, consequential, or punitive damages. The aggregate liability shall not exceed the total fees paid by Customer in the three (3) months immediately preceding the event giving rise to the claim.</div>
</div>

<div class="clause">
  <div class="clause-title">10. Termination</div>
  <div class="clause-body">Either party may terminate this Agreement upon thirty (30) days' written notice if the other party materially breaches any term and fails to cure such breach within fifteen (15) days of written notice. Banxico Plus LLC reserves the right to immediately suspend or terminate services without notice if Customer engages in fraudulent activity, violates applicable law, or uses the platform for money laundering, terrorist financing, or any other prohibited purpose.</div>
</div>

<div class="clause">
  <div class="clause-title">11. Dispute Resolution and Governing Law</div>
  <div class="clause-body">This Agreement shall be governed by the laws of the State of Ohio, United States of America. Any dispute shall first be submitted to good-faith mediation between the parties. If mediation fails, the dispute shall be resolved through binding arbitration under the rules of the American Arbitration Association (AAA), conducted in English in Dublin, Ohio.</div>
</div>

<div class="clause">
  <div class="clause-title">12. Entire Agreement and Modifications</div>
  <div class="clause-body">This Agreement, together with the Order Form and any incorporated documents, constitutes the entire agreement between the parties and supersedes all prior negotiations or representations. This Agreement may not be modified except by written instrument signed by authorized representatives of both parties. Electronic signatures, including DocuSign, carry the same legal force as original wet signatures.</div>
</div>

<div class="clause">
  <div class="clause-title">13. Auto-Renewal and Final Sales</div>
  <div class="clause-body">All subscriptions under this Agreement auto-renew annually unless written cancellation notice is provided at least thirty (30) days before the end of the current term. All sales are final. Refunds, if any, are subject to Banxico Plus LLC's refund policy as communicated separately and in writing. Customer initials their understanding of these terms: ____________.</div>
</div>
</div>

<h2 style="margin-top:24px;">Agreed and Executed</h2>
<div class="two-col">
  <div class="sig-box">
    <div class="title">Agreed To: CUSTOMER</div>
    <div class="name">${sub.userName.toUpperCase()}</div>
    <div class="detail">Title: Admin / Authorized Representative</div>
    <div class="detail">Email: ${sub.userEmail}</div>
    <div class="detail">Phone: ${sub.phone}</div>
    <div class="detail">Date: ${contractTime}</div>
    <div style="margin-top:20px;border-top:1px solid #bbb;padding-top:4px;font-size:9px;color:#aaa;">By (Signature): _________________________</div>
  </div>
  <div class="sig-box">
    <div class="title">Agreed To: SUPPLIER</div>
    <div class="name">${sub.signerName}</div>
    <div class="detail">Supplier: Banxico Plus LLC / Seamless Contacts Inc.</div>
    <div class="detail">Title: ${sub.signerTitle}</div>
    <div class="detail">Address: ${sub.supplierAddress}</div>
    <div class="detail">The Landmark GDL, Guadalajara, Jalisco, Mexico</div>
    <div class="detail">Date: ${contractTime}</div>
    <div style="margin-top:20px;border-top:1px solid #bbb;padding-top:4px;font-size:9px;color:#aaa;">By (Authorized Signature): _______________</div>
  </div>
</div>

<div class="footer">
  V.20230915TermsAL  |  Banxico Plus LLC  |  Confidential &amp; Proprietary
</div>

<script>window.onload = function(){ window.print(); };</script>
</body>
</html>`);
  win.document.close();
}

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: sub, isLoading } = useQuery<SubscriptionData>({
    queryKey: ["/api/subscription"],
  });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/subscription/complete-payment"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({ title: "Payment verified!", description: "Your subscription is now paid in full. Full POS access confirmed." });
    },
  });

  function copyAddress() {
    if (!sub?.walletAddress) return;
    navigator.clipboard.writeText(sub.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#c8322b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sub) return null;

  const pct = Math.round((sub.paidAmount / sub.totalAmount) * 100);
  const isPartial = sub.status === "partial";
  const isPending = sub.status === "pending";

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 pb-20 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="w-5 h-5 text-[#c8322b]" />
            <h1 className="text-xl font-bold">Mi Membresía y Contrato</h1>
            <Badge className={`text-[10px] no-default-active-elevate ${
              sub.status === "complete"
                ? "bg-green-100 text-green-700 border-green-200"
                : sub.status === "partial"
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : sub.status === "maintenance"
                ? "bg-orange-100 text-orange-800 border-orange-200"
                : "bg-red-100 text-red-800 border-red-200"
            }`}>
              {sub.status === "complete" ? "Pagado en su totalidad"
                : sub.status === "partial" ? "Pago Parcial"
                : sub.status === "maintenance" ? "En Mantenimiento"
                : "Pago Pendiente"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{sub.plan} · {sub.contractTerm}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => generateContractPDF(sub)}
          data-testid="button-download-contract"
        >
          <Download className="w-3.5 h-3.5" />
          Descargar Contrato PDF
        </Button>
      </div>

      {/* ── Panel de Mantenimiento y Restablecimiento ── */}
      {sub.status === "maintenance" && sub.maintenanceLogs && (
        <Card className="border-orange-300 shadow-sm overflow-hidden">
          <CardContent className="p-0">

            {/* Header naranja */}
            <div className="bg-orange-500 px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-white/20 flex items-center justify-center flex-shrink-0">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-white uppercase tracking-wide">Sistema en Mantenimiento y Restablecimiento</p>
                <p className="text-xs text-orange-100">Servicios suspendidos temporalmente · Ref. {sub.maintenanceCode}</p>
              </div>
              <Badge className="bg-white/20 text-white border-white/30 no-default-active-elevate text-[10px] shrink-0">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> EN PROCESO
              </Badge>
            </div>

            {/* Barra de fase */}
            <div className="px-5 pt-4 pb-2 border-b">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Fase {sub.maintenancePhase} de {sub.maintenanceTotalPhases}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Inicio: {sub.maintenanceStarted?.replace("T", " ")} &nbsp;·&nbsp;
                  ETA: {sub.maintenanceETA?.split("T")[1]}
                </p>
              </div>
              <div className="w-full bg-orange-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-orange-500 transition-all"
                  style={{ width: `${((sub.maintenancePhase ?? 1) / (sub.maintenanceTotalPhases ?? 5)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                {Array.from({ length: sub.maintenanceTotalPhases ?? 5 }, (_, i) => (
                  <span key={i} className={i + 1 < (sub.maintenancePhase ?? 1) ? "text-orange-600 font-bold" :
                    i + 1 === (sub.maintenancePhase ?? 1) ? "text-orange-500 font-bold" : ""}>
                    F{i + 1}
                  </span>
                ))}
              </div>
            </div>

            {/* Bitácora de eventos */}
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Bitácora del Sistema · Protocolo RESET-FULL-3
              </p>
              <div className="space-y-2">
                {sub.maintenanceLogs.map((log, i) => {
                  const isDone    = log.status === "done";
                  const isActive  = log.status === "active";
                  const isPend    = log.status === "pending";
                  return (
                    <div key={i} className={`rounded-md border px-3 py-2.5 font-mono
                      ${isDone   ? "border-green-200 bg-green-50"   : ""}
                      ${isActive ? "border-orange-300 bg-orange-50" : ""}
                      ${isPend   ? "border-border bg-muted/20"      : ""}
                    `}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground shrink-0">{log.time}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
                          ${isDone   ? "bg-green-100 text-green-700"       : ""}
                          ${isActive ? "bg-orange-100 text-orange-700"     : ""}
                          ${isPend   ? "bg-muted text-muted-foreground"    : ""}
                        `}>F{log.phase}</span>
                        {isDone   && <CheckCircle  className="w-3 h-3 text-green-600 shrink-0" />}
                        {isActive && <Loader       className="w-3 h-3 text-orange-500 shrink-0 animate-spin" />}
                        {isPend   && <Circle       className="w-3 h-3 text-muted-foreground shrink-0" />}
                        <span className={`text-[10px] font-semibold
                          ${isDone   ? "text-green-800"          : ""}
                          ${isActive ? "text-orange-800"         : ""}
                          ${isPend   ? "text-muted-foreground"   : ""}
                        `}>{log.event}</span>
                      </div>
                      <p className={`text-[10px] mt-1 leading-relaxed
                        ${isDone   ? "text-green-700"         : ""}
                        ${isActive ? "text-orange-700"        : ""}
                        ${isPend   ? "text-muted-foreground"  : ""}
                      `}>{log.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Aviso de servicios suspendidos */}
            <div className="mx-5 mb-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold text-orange-800">Servicios temporalmente fuera de línea</p>
                <p className="text-[11px] text-orange-700 leading-relaxed">
                  POS Virtual · Enrutamiento POS · Motor de transacciones quedan suspendidos durante el restablecimiento.
                  Los accesos se reactivarán automáticamente al completarse la Fase 5.
                  Se notificará por correo al concluir el proceso.
                </p>
                <p className="text-[10px] text-orange-500 font-mono pt-0.5">
                  Protocolo: RESET-FULL-3 · Código: {sub.maintenanceCode} · Clearing Engine v3.1
                </p>
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      {/* System payment warning banner */}
      {sub.paymentWarning && (
        <Card className="border-red-400 bg-red-50">
          <CardContent className="py-3 px-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-800 uppercase tracking-wide">Aviso de Pago Pendiente</p>
            </div>
            <p className="text-xs text-red-700 font-mono leading-relaxed bg-red-100 rounded px-3 py-2 border border-red-200">
              {sub.paymentWarning}
            </p>
            <p className="text-[10px] text-red-500 italic">El acceso se reactivará automáticamente una vez que se confirme el pago completo.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Bloqueo por disputa registrada ── */}
      {sub.disputeBlock && (
        <Card className="border-slate-600 bg-slate-800">
          <CardContent className="py-3 px-4 space-y-2">
            <div className="flex items-start gap-2">
              <Ban className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                Bloqueo por Disputa Registrada — Servidor Maestro
              </p>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-700/60 rounded px-3 py-2 border border-slate-600/70 font-mono">
              {sub.disputeBlock}
            </p>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                <Shield className="w-3 h-3" />
                <span>Ref: {sub.disputeRef} · Fecha del evento: {sub.disputeDate}</span>
              </div>
              <Badge className="bg-slate-600 text-slate-200 border-slate-500 no-default-active-elevate text-[10px]">
                ADMIN OVERRIDE DENEGADO
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Parche de seguridad — ventana de diagnóstico ── */}
      {sub.diagnosticPatch && (
        <Card className={sub.diagnosticPatchActive
          ? "border-green-500 bg-green-50"
          : "border-amber-400 bg-amber-50"}>
          <CardContent className="py-3 px-4 space-y-2">

            {/* Header */}
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-start gap-2">
                <Wrench className={`w-4 h-4 flex-shrink-0 mt-0.5 ${sub.diagnosticPatchActive ? "text-green-600" : "text-amber-600"}`} />
                <p className={`text-xs font-bold uppercase tracking-wide ${sub.diagnosticPatchActive ? "text-green-800" : "text-amber-800"}`}>
                  Parche de Seguridad — Ventana de Diagnóstico
                </p>
              </div>
              <Badge className={sub.diagnosticPatchActive
                ? "bg-green-100 text-green-800 border-green-300 no-default-active-elevate text-[10px]"
                : "bg-amber-100 text-amber-800 border-amber-300 no-default-active-elevate text-[10px]"}>
                {sub.diagnosticPatchActive ? "ACTIVO" : "EN ESPERA"}
              </Badge>
            </div>

            {/* Mensaje del parche */}
            <p className={`text-xs leading-relaxed font-mono rounded px-3 py-2 border ${
              sub.diagnosticPatchActive
                ? "text-green-700 bg-green-100 border-green-200"
                : "text-amber-700 bg-amber-100 border-amber-200"
            }`}>
              {sub.diagnosticPatchMessage}
            </p>

            {/* Barra de progreso hacia el umbral */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Progreso hacia ventana de diagnóstico</span>
                <span className={`font-bold ${sub.diagnosticPatchActive ? "text-green-700" : "text-amber-700"}`}>
                  {((sub.paidAmount / (sub.diagnosticPatchThreshold ?? 375)) * 100).toFixed(1)}% de umbral (50%)
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all ${sub.diagnosticPatchActive ? "bg-green-500" : "bg-amber-400"}`}
                  style={{ width: `${Math.min(100, (sub.paidAmount / (sub.diagnosticPatchThreshold ?? 375)) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>${sub.paidAmount.toFixed(2)} USD pagado</span>
                <span className="text-amber-600 font-semibold">Umbral: ${sub.diagnosticPatchThreshold?.toFixed(2)} USD ({sub.diagnosticPatchPct}%)</span>
                <span>$750.00 USD (total)</span>
              </div>
            </div>

            {/* Falta / Estado */}
            {!sub.diagnosticPatchActive && (
              <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-mono pt-0.5">
                <Clock className="w-3 h-3" />
                <span>
                  Faltan <span className="font-bold">${((sub.diagnosticPatchThreshold ?? 375) - sub.paidAmount).toFixed(2)} USD</span>
                  {" "}(~${(((sub.diagnosticPatchThreshold ?? 375) - sub.paidAmount) * 17.50).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN a TC 17.50) para activar la ventana.
                </span>
              </div>
            )}
            {sub.diagnosticPatchActive && (
              <div className="flex items-center gap-1.5 text-[10px] text-green-600 font-mono pt-0.5">
                <CheckCircle className="w-3 h-3" />
                <span>Ventana de diagnóstico activa. El administrador puede asignar terminal POS en modo restringido.</span>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* ── Panel de Análisis Automatizado del Sistema (solo si tiene historial) ── */}
      {sub.paymentHistory && sub.paymentHistory.length > 0 && (
        <Card className="border shadow-sm">
          <CardContent className="p-0">

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b">
              <div className="w-9 h-9 rounded-md bg-[#c8322b]/10 flex items-center justify-center flex-shrink-0">
                <BarChart2 className="w-5 h-5 text-[#c8322b]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Estado de tu Membresía</p>
                <p className="text-xs text-muted-foreground">Detalle de pagos y acceso · Solo consulta</p>
              </div>
              <Badge className="bg-slate-100 text-slate-700 border-slate-200 no-default-active-elevate text-[10px]">
                <Lock className="w-3 h-3 mr-1" /> Solo consulta
              </Badge>
            </div>

            {/* Admin cannot interfere block */}
            {sub.adminCanInterfere === false && (
              <div className="mx-5 mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-2.5">
                <Ban className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Acceso protegido por contrato</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    El desbloqueo de funciones (POS Virtual, Enrutamiento POS) se activa de forma <span className="font-semibold">automática</span> al completar el pago. No es posible realizar modificaciones manuales mientras exista saldo pendiente.
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono pt-0.5">
                    <Shield className="w-3 h-3" />
                    <span>Protección de contrato activa · Art. 12.4 · Banxico Plus LLC</span>
                  </div>
                </div>
              </div>
            )}

            {/* Admin intervention block */}
            {sub.adminIntervention && (
              <div className="mx-5 mt-4 space-y-2">
                {/* Ajuste manual */}
                <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-2.5">
                  <Wrench className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide">Ajuste Manual — Intervenido por Admin</p>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      El administrador registró un ajuste manual sobre esta cuenta. El pago fue conciliado fuera del flujo estándar y queda pendiente de validación completa.
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-blue-500 font-mono pt-0.5">
                      <Shield className="w-3 h-3" />
                      <span>Referencia: ADJ-OPT-2026-063001 · Banxico Plus Admin Layer v3.1</span>
                    </div>
                  </div>
                </div>
                {/* Server lock notice */}
                <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-orange-800 uppercase tracking-wide">Capa de Servidor — Asignación POS Bloqueada</p>
                    <p className="text-[11px] text-orange-700 leading-relaxed">
                      El servidor no permite asignar POS a esta cuenta en su estado actual.{" "}
                      <span className="font-semibold">Non-complete payment</span> detectado.{" "}
                      El análisis promedio del sistema requiere al menos el <span className="font-semibold">50% de suscripción</span> ($375.00 USD) para habilitar la función principal.
                    </p>
                    {sub.lockCode && (
                      <div className="flex items-center gap-1.5 text-[10px] text-orange-600 font-mono pt-0.5">
                        <CircleDot className="w-3 h-3" />
                        <span>Código: {sub.lockCode} · {sub.lockDate?.slice(0, 10)}</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Current analysis */}
                <div className="rounded-md border border-muted bg-muted/30 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Análisis Promedio del Sistema</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[10px]">
                    <span className="text-foreground font-bold">{((sub.paidAmount / sub.totalAmount) * 100).toFixed(1)}% pagado</span>
                    <span className="text-amber-600 font-semibold">50.0% req. apertura</span>
                    <Badge className="bg-orange-100 text-orange-700 border-orange-200 no-default-active-elevate text-[10px]">
                      UNDEPLOYED
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Progreso de suscripción</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  ${sub.paidAmount.toFixed(2)} / ${sub.totalAmount.toFixed(2)} USD
                  <span className="ml-1 font-bold text-[#c8322b]">({((sub.paidAmount / sub.totalAmount) * 100).toFixed(1)}%)</span>
                </p>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-[#c8322b] transition-all"
                  style={{ width: `${Math.min(100, (sub.paidAmount / sub.totalAmount) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                <span>$0</span>
                <span className="text-amber-600 font-semibold">Mínimo para activación ${sub.nextThreshold?.totalAfterUSD.toFixed(2)}</span>
                <span>${sub.totalAmount} USD (acceso total)</span>
              </div>
            </div>

            {/* Payment history */}
            <div className="px-5 pb-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Historial de pagos registrados
              </p>
              <div className="space-y-1.5">
                {sub.paymentHistory.map((p, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/20 px-3 py-2 font-mono">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                        <span className="text-[10px] font-semibold text-green-700 uppercase">{p.status}</span>
                        <span className="text-[10px] text-muted-foreground">{p.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold">${p.amountMXN.toFixed(2)} MXN</span>
                        <span className="text-[10px] text-muted-foreground">= ${p.amountUSD.toFixed(2)} USD</span>
                        <span className="text-[10px] bg-muted rounded px-1 py-0.5">TC {p.tc}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">REF: {p.ref}</p>
                  </div>
                ))}
              </div>
              {/* Total */}
              <div className="mt-2 rounded-md border border-[#c8322b]/20 bg-[#c8322b]/5 px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#c8322b] uppercase tracking-wide">Total conciliado</span>
                <span className="text-sm font-bold font-mono text-[#c8322b]">${sub.paidAmount.toFixed(2)} USD</span>
              </div>
            </div>

            {/* Next threshold */}
            {sub.nextThreshold && (
              <div className="mx-5 mb-4 mt-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-amber-800">
                      Próximo umbral — Acceso proporcional ajustable
                    </p>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Con un abono mínimo adicional de{" "}
                      <span className="font-bold font-mono">${sub.nextThreshold.amountMXN.toLocaleString("es-MX")} MXN</span>
                      {" "}(equivalente a <span className="font-bold font-mono">${sub.nextThreshold.amountUSD} USD</span> al TC 17.50),
                      el total acumulado sería <span className="font-bold font-mono">${sub.nextThreshold.totalAfterUSD.toFixed(2)} USD</span>.
                      En ese punto el sistema canalizará automáticamente funciones en <strong>modo proporcional ajustable</strong>.
                    </p>
                    <p className="text-[10px] text-amber-600 font-mono">{sub.nextThreshold.description}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-600 pt-0.5">
                      <Info className="w-3 h-3" />
                      <span>Esta activación es exclusivamente automática. El administrador no puede adelantarla ni modificarla.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* Pending payment banner */}
      {isPending && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="flex items-start gap-3 py-3 px-4">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                Suscripción pendiente de pago — Acceso restringido
              </p>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                Tu cuenta está activa pero con acceso limitado hasta confirmar el pago de <strong>${sub.remainingAmount} {sub.currency}</strong>.
                Una vez procesado el pago, se habilitarán todas las funciones del sistema incluyendo POS Virtual y herramientas de transacciones.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 48-hour warning banner (only for partial payments) */}
      {isPartial && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-start gap-3 py-3 px-4">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Acción requerida en las próximas 48 horas
              </p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                {sub.posLocked
                  ? <>Tu terminal POS permanece <strong>bloqueada</strong> por pago incompleto. Completa el pago pendiente de <strong>${sub.remainingAmount} {sub.currency}</strong> para habilitar el acceso.</>
                  : <>Tu terminal POS está activa y operativa. Completa el pago pendiente de <strong>${sub.remainingAmount} {sub.currency}</strong> dentro de 48 horas para confirmar el despliegue de forma permanente. Después de esta ventana, el POS asignado se desvinculará hasta que se procese el pago.</>
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment status */}
      <Card>
        <CardContent className="px-5 py-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#c8322b]" />
              <span className="font-semibold text-sm">Estado de Pago</span>
            </div>
            <Badge
              className={`text-xs no-default-active-elevate ${
                isPending
                  ? "bg-red-100 text-red-800 border-red-200"
                  : isPartial
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-green-100 text-green-700 border-green-200"
              }`}
            >
              {isPending ? "Pago Pendiente" : isPartial ? "Pago Parcial" : "Pagado en su totalidad"}
            </Badge>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Pagado: <strong className="text-foreground">${sub.paidAmount} {sub.currency}</strong></span>
              <span>Total: <strong className="text-foreground">${sub.totalAmount} {sub.currency}</strong></span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: isPartial
                    ? "linear-gradient(90deg, #c8322b, #e85d52)"
                    : "linear-gradient(90deg, #16a34a, #22c55e)",
                }}
              />
            </div>
            <div className="flex justify-between text-xs mt-1.5">
              <span className="text-green-600 font-semibold">{pct}% pagado</span>
              {isPartial && (
                <span className="text-amber-600 font-semibold">
                  Pendiente: ${sub.remainingAmount} {sub.currency}
                </span>
              )}
              {!isPartial && (
                <span className="text-green-600 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Completado
                </span>
              )}
            </div>
          </div>

          {(isPartial || isPending) && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700">
                Pendiente: <strong>${sub.remainingAmount} {sub.currency}</strong> — Contacta a tu administrador para completar el pago y activar tu cuenta.
              </p>
            </div>
          )}
          {!isPartial && !isPending && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium justify-center py-1">
              <CheckCircle className="w-4 h-4" /> Pago completado — POS confirmado permanentemente
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sistema de Seguimiento POS */}
      <Card>
        <CardContent className="px-5 py-5 space-y-4">
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4 text-[#c8322b]" />
            <span className="font-semibold text-sm">Seguimiento de Despliegue POS</span>
          </div>

          {/* Status indicator row */}
          <div className="flex items-start gap-3 p-3 rounded-md border border-border bg-muted/20">
            <div
              className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center ${
                sub.posUnlocked
                  ? "bg-green-500 border-green-500"
                  : "bg-amber-50 border-amber-400"
              }`}
            >
              {sub.posUnlocked && <Check className="w-2.5 h-2.5 text-white" />}
              {!sub.posUnlocked && <Clock className="w-2.5 h-2.5 text-amber-500" />}
            </div>
            <div>
              <p className="text-sm font-medium">Estado de Despliegue POS</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sub.posUnlocked
                  ? "El despliegue del POS está activo y confirmado de forma permanente."
                  : "El despliegue permanente del POS se activa al completar el pago total de la suscripción."}
              </p>
            </div>
          </div>

          {/* Status bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Recibido y pagado</span>
              <span>Pendiente de confirmar</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
              <div
                className="h-full bg-green-500 rounded-l-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
              {isPartial && (
                <div
                  className="h-full bg-amber-300 rounded-r-full transition-all duration-700"
                  style={{ width: `${100 - pct}%` }}
                />
              )}
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span className="text-green-600">Recibido: ${sub.paidAmount} {sub.currency}</span>
              {isPartial
                ? <span className="text-amber-600">Pendiente: ${sub.remainingAmount} {sub.currency}</span>
                : <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Confirmado completamente</span>
              }
            </div>
          </div>

          {/* Access status grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Terminal POS",          active: !sub.posLocked },
              { label: "Todos los Protocolos",  active: !sub.posLocked },
              { label: "Despliegue Permanente", active: sub.posUnlocked },
            ].map(({ label, active }) => (
              <div
                key={label}
                className={`rounded-md border px-3 py-2 text-center ${
                  active ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${active ? "bg-green-500" : "bg-amber-400"}`} />
                <p className="text-[10px] font-medium leading-tight">{label}</p>
                <p className={`text-[10px] mt-0.5 ${active ? "text-green-600" : "text-amber-600"}`}>
                  {active ? "Activo" : "Pendiente"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detalles del contrato */}
      <Card>
        <CardContent className="px-5 py-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#c8322b]" />
            <span className="font-semibold text-sm">Detalles del Contrato</span>
          </div>

          <div className="divide-y divide-border">
            {[
              { label: "Cliente",           value: sub.userName },
              { label: "Empresa",           value: sub.company },
              { label: "Correo",            value: sub.userEmail },
              { label: "Teléfono",          value: sub.phone },
              { label: "Plan",              value: sub.plan },
              { label: "Plazo",             value: sub.contractTerm },
              { label: "Fecha contrato",    value: sub.contractDate },
              { label: "Monto total",       value: `$${sub.totalAmount}.00 ${sub.currency}` },
              { label: "Proveedor",         value: "Banxico Plus LLC — " + sub.supplierAddress },
              { label: "Autorizado por",    value: `${sub.signerName} · ${sub.signerTitle}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-4 py-2.5">
                <span className="text-xs text-muted-foreground flex-shrink-0 w-28">{label}</span>
                <span className="text-xs font-medium text-right">{value}</span>
              </div>
            ))}
          </div>

          {/* Wallet de pago */}
          {isPartial && sub.walletAddress && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Wallet de Pago</p>
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-md">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground">{sub.walletToken} · {sub.walletNetwork}</p>
                  <p className="text-xs font-mono mt-0.5 break-all">{sub.walletAddress}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={copyAddress} data-testid="button-copy-wallet">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <Link href="/subscription/payment">
                <Button variant="outline" className="w-full text-xs gap-2" data-testid="button-go-to-payment">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ir a Página de Pago
                </Button>
              </Link>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full gap-2 mt-2"
            onClick={() => generateContractPDF(sub)}
            data-testid="button-download-contract-bottom"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar Contrato PDF
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}
