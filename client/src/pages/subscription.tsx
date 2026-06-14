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
} from "lucide-react";

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
  status: "partial" | "complete";
  posUnlocked: boolean;
  walletAddress: string | null;
  walletNetwork: string | null;
  walletToken: string | null;
  company: string;
  phone: string;
  signerName: string;
  signerTitle: string;
  supplierAddress: string;
}

function generateContractPDF(sub: SubscriptionData) {
  const pct = Math.round((sub.paidAmount / sub.totalAmount) * 100);
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
  .address { font-size:10px; color:#555; text-align:right; margin-top:4px; }
  h1 { font-size:16px; font-weight:700; margin:24px 0 8px; color:#111; }
  h2 { font-size:12px; font-weight:700; margin:18px 0 6px; text-transform:uppercase; letter-spacing:.5px; color:#c8322b; border-bottom:1px solid #eee; padding-bottom:4px; }
  table { width:100%; border-collapse:collapse; margin:12px 0; }
  th { background:#c8322b; color:#fff; padding:7px 10px; text-align:left; font-size:11px; }
  td { padding:7px 10px; border-bottom:1px solid #f0f0f0; font-size:11px; }
  tr:last-child td { border:none; }
  .total-row td { font-weight:700; background:#fff8f8; }
  .progress-bar { background:#f0f0f0; height:10px; border-radius:5px; overflow:hidden; margin:6px 0; }
  .progress-fill { background:#c8322b; height:100%; border-radius:5px; width:${pct}%; }
  .label { font-weight:600; color:#555; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin:20px 0; }
  .sig-box { border:1px solid #ddd; padding:14px; border-radius:6px; background:#fafafa; }
  .sig-box .title { font-size:10px; color:#888; margin-bottom:6px; text-transform:uppercase; letter-spacing:.5px; }
  .sig-box .name { font-size:13px; font-weight:700; }
  .sig-box .detail { font-size:10px; color:#555; margin-top:2px; }
  .legal { font-size:9.5px; color:#666; margin-top:24px; padding-top:14px; border-top:1px solid #eee; line-height:1.7; }
  .badge { display:inline-block; padding:2px 8px; border-radius:3px; font-size:10px; font-weight:700; }
  .badge-partial { background:#FEF3C7; color:#92400E; }
  .badge-complete { background:#D1FAE5; color:#065F46; }
  .warning { background:#FFF8E1; border:1px solid #F59E0B; border-radius:5px; padding:10px 14px; margin:14px 0; font-size:11px; color:#78350F; }
  @media print { body { padding:30px; } @page { margin:20mm; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">BANXICO<span>+</span> LLC</div>
    <div class="address">7652 Sawmill Road, Suite 341<br>Dublin, Ohio 43016<br>United States</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:18px;font-weight:700;color:#111;">ORDER FORM</div>
    <div style="font-size:11px;color:#555;margin-top:4px;">Contract for: ${sub.userName}</div>
    <div style="font-size:10px;color:#888;">Date: ${sub.contractDate}</div>
  </div>
</div>

<h2>Contract Term</h2>
<table>
  <tr><td class="label">Term</td><td>${sub.contractTerm} (1 year, auto-renew)</td></tr>
  <tr><td class="label">Customer</td><td>${sub.userName}</td></tr>
  <tr><td class="label">Company</td><td>${sub.company}</td></tr>
  <tr><td class="label">Email</td><td>${sub.userEmail}</td></tr>
  <tr><td class="label">Phone</td><td>${sub.phone}</td></tr>
</table>

<h2>Services & Billing</h2>
<table>
  <tr>
    <th>Product / Service</th>
    <th>Billing Frequency</th>
    <th>Unit Price</th>
    <th>Qty</th>
    <th>Total</th>
  </tr>
  <tr>
    <td>Usuario Banxico+</td>
    <td>Annual</td>
    <td>$750.00</td>
    <td>1</td>
    <td>$750.00</td>
  </tr>
  <tr class="total-row">
    <td colspan="4">Total (USD)</td><td>$750.00 USD</td>
  </tr>
  <tr class="total-row">
    <td colspan="4">Total (MXN approx.)</td><td>$13,000,000 MXN</td>
  </tr>
</table>

<h2>Payment Status</h2>
<table>
  <tr><td class="label">Total Amount</td><td>$${sub.totalAmount}.00 ${sub.currency}</td></tr>
  <tr><td class="label">Amount Paid</td><td>$${sub.paidAmount}.00 ${sub.currency}</td></tr>
  <tr><td class="label">Remaining Balance</td><td>$${sub.remainingAmount}.00 ${sub.currency}</td></tr>
  <tr><td class="label">Status</td><td><span class="badge badge-${sub.status}">${sub.status === "complete" ? "PAID IN FULL" : "PARTIAL PAYMENT"}</span></td></tr>
</table>
<div class="progress-bar"><div class="progress-fill"></div></div>
<div style="font-size:10px;color:#666;margin-top:4px;">${pct}% paid ($${sub.paidAmount} of $${sub.totalAmount} ${sub.currency})</div>

${sub.remainingAmount > 0 ? `<div class="warning">⚠ Outstanding balance: $${sub.remainingAmount} ${sub.currency}. Payment must be completed within 48 hours to maintain POS access. Send to wallet: ${sub.walletAddress} (${sub.walletNetwork} — ${sub.walletToken})</div>` : ""}

<h2>Non Deployment POS Tracking System</h2>
<table>
  <tr><td class="label">POS Deployment Status</td><td>${sub.posUnlocked ? "✅ ACTIVE — Full POS access granted" : "⏳ ACTIVE (0–48h window) — Full access now; deployment confirmed upon full payment"}</td></tr>
  <tr><td class="label">Protocol Access</td><td>101.x / 201.x / 301.x / 401.x — All active</td></tr>
  <tr><td class="label">Terminal Assignment</td><td>Assigned & operational</td></tr>
</table>

<h2>Authorized Admins</h2>
<table>
  <tr><td class="label">Admin Full Name</td><td>${sub.userName}</td></tr>
  <tr><td class="label">Admin Email</td><td>${sub.userEmail}</td></tr>
  <tr><td class="label">Admin Phone</td><td>${sub.phone}</td></tr>
</table>

<div class="two-col" style="margin-top:32px;">
  <div class="sig-box">
    <div class="title">Customer — Agreed To</div>
    <div class="name">${sub.userName}</div>
    <div class="detail">Company: ${sub.company}</div>
    <div class="detail">Email: ${sub.userEmail}</div>
    <div class="detail">Date: ${sub.contractDate}</div>
    <div style="margin-top:20px;border-top:1px solid #bbb;padding-top:4px;font-size:9px;color:#aaa;">Signature</div>
  </div>
  <div class="sig-box">
    <div class="title">Supplier — Banxico Plus LLC</div>
    <div class="name">${sub.signerName}</div>
    <div class="detail">Title: ${sub.signerTitle}</div>
    <div class="detail">Address: ${sub.supplierAddress}</div>
    <div class="detail">Date: ${sub.contractDate} | 8:37 PM EDT</div>
    <div style="margin-top:20px;border-top:1px solid #bbb;padding-top:4px;font-size:9px;color:#aaa;">Authorized Signature</div>
  </div>
</div>

<div class="legal">
  <strong>Legal Terms:</strong> This Services Add-On Order Form amends and is incorporated into the original Order Form and Terms of Use, and/or Software as a Service Agreement between Customer and Banxico Plus LLC ("Original Agreement"). All agreements are annual agreements, auto-renew, all sales are final, and payment terms shall be in accordance with the billing cycle indicated above. By accepting this Banxico+ Services License, you agree to purchase the license seats as described and payment is due upfront prior to implementation. Access will be enabled once the invoice is received and processed. A facsimile or electronic signature will have the same force and effect as an original signature. Governed under applicable international commercial law. V.20230915TermsAL
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

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 pb-20 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#c8322b]" />
            <h1 className="text-xl font-bold">My Subscription & Contract</h1>
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
          Download Contract PDF
        </Button>
      </div>

      {/* 48-hour warning banner (only for partial payments) */}
      {isPartial && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-start gap-3 py-3 px-4">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Action required within 48 hours
              </p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Your POS terminal is currently active and fully operational. Complete your remaining
                payment of <strong>${sub.remainingAmount} {sub.currency}</strong> within 48 hours to permanently
                confirm your deployment. After this window, the assigned POS will be unlinked from
                your account until payment is processed.
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
              <span className="font-semibold text-sm">Payment Status</span>
            </div>
            <Badge
              className={`text-xs no-default-active-elevate ${
                isPartial
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-green-100 text-green-700 border-green-200"
              }`}
            >
              {isPartial ? "Partial Payment" : "Paid in Full"}
            </Badge>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Paid: <strong className="text-foreground">${sub.paidAmount} {sub.currency}</strong></span>
              <span>Total: <strong className="text-foreground">${sub.totalAmount} {sub.currency}</strong></span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
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
              <span className="text-green-600 font-semibold">{pct}% paid</span>
              {isPartial && (
                <span className="text-amber-600 font-semibold">
                  Remaining: ${sub.remainingAmount} {sub.currency}
                </span>
              )}
              {!isPartial && (
                <span className="text-green-600 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Complete
                </span>
              )}
            </div>
          </div>

          {isPartial && (
            <Link href="/subscription/payment">
              <Button className="w-full bg-[#c8322b] hover:bg-[#a62822] gap-2" data-testid="button-make-payment">
                <ExternalLink className="w-4 h-4" />
                Complete Payment — ${sub.remainingAmount} {sub.currency}
              </Button>
            </Link>
          )}
          {!isPartial && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium justify-center py-1">
              <CheckCircle className="w-4 h-4" /> Payment complete — POS permanently confirmed
            </div>
          )}
        </CardContent>
      </Card>

      {/* Non Deployment POS Tracking System */}
      <Card>
        <CardContent className="px-5 py-5 space-y-4">
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-sm">Non Deployment POS Tracking System</span>
          </div>

          {/* Checkbox row */}
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
              <p className="text-sm font-medium">Non Deployment POS Tracking System</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sub.posUnlocked
                  ? "POS deployment is permanently active and confirmed."
                  : "POS is fully operational during the 0–48h payment window. Permanent deployment locks in upon full payment."}
              </p>
            </div>
          </div>

          {/* Status bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>System received & paid</span>
              <span>Remaining to confirm</span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
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
            <div className="flex justify-between text-[11px] font-medium">
              <span className="text-green-600">Received: ${sub.paidAmount} {sub.currency}</span>
              {isPartial
                ? <span className="text-amber-600">Remaining: ${sub.remainingAmount} {sub.currency}</span>
                : <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Fully confirmed</span>
              }
            </div>
          </div>

          {/* Access status */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "POS Terminal", active: true },
              { label: "All Protocols", active: true },
              { label: "Permanent Deploy", active: sub.posUnlocked },
            ].map(({ label, active }) => (
              <div
                key={label}
                className={`rounded-md border px-3 py-2 text-center ${
                  active
                    ? "border-green-200 bg-green-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${active ? "bg-green-500" : "bg-amber-400"}`} />
                <p className="text-[10px] font-medium leading-tight">{label}</p>
                <p className={`text-[9px] mt-0.5 ${active ? "text-green-600" : "text-amber-600"}`}>
                  {active ? "Active" : "Pending"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contract details */}
      <Card>
        <CardContent className="px-5 py-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#c8322b]" />
            <span className="font-semibold text-sm">Contract Details</span>
          </div>

          <div className="divide-y divide-border">
            {[
              { label: "Customer", value: sub.userName },
              { label: "Company", value: sub.company },
              { label: "Email", value: sub.userEmail },
              { label: "Phone", value: sub.phone },
              { label: "Plan", value: sub.plan },
              { label: "Contract Term", value: sub.contractTerm },
              { label: "Contract Date", value: sub.contractDate },
              { label: "Total Amount", value: `$${sub.totalAmount}.00 ${sub.currency}` },
              { label: "Supplier", value: "Banxico Plus LLC — " + sub.supplierAddress },
              { label: "Authorized by", value: `${sub.signerName} · ${sub.signerTitle}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-4 py-2.5">
                <span className="text-xs text-muted-foreground flex-shrink-0 w-28">{label}</span>
                <span className="text-xs font-medium text-right">{value}</span>
              </div>
            ))}
          </div>

          {/* Payment wallet info (if partial) */}
          {isPartial && sub.walletAddress && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Wallet</p>
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
                  Go to Payment Page
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
            Download Contract as PDF
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}
