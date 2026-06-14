import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Copy, Check, CheckCircle, Clock, AlertTriangle,
  Wallet, Shield, RefreshCw, ExternalLink,
} from "lucide-react";

interface SubscriptionData {
  paidAmount: number;
  totalAmount: number;
  remainingAmount: number;
  currency: string;
  status: "partial" | "complete";
  walletAddress: string | null;
  walletNetwork: string | null;
  walletToken: string | null;
  userName: string;
  userEmail: string;
}

const WALLET_ADDRESS = "0xa8FAaC0297897d9c3b14a037BfDe794c1aFBa7d3";
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${WALLET_ADDRESS}&color=000000&bgcolor=ffffff&qzone=2`;

export default function SubscriptionPaymentPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const { data: sub, isLoading } = useQuery<SubscriptionData>({
    queryKey: ["/api/subscription"],
  });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/subscription/complete-payment"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      setConfirmed(true);
      toast({ title: "Payment verified!", description: "Your POS deployment is now permanently confirmed." });
    },
    onError: () => {
      toast({ title: "Verification failed", description: "Please try again.", variant: "destructive" });
      setVerifying(false);
    },
  });

  function handleVerify() {
    setVerifying(true);
    // Simulate blockchain confirmation delay
    setTimeout(() => {
      completeMutation.mutate();
    }, 3000);
  }

  function copyAddress() {
    navigator.clipboard.writeText(sub?.walletAddress ?? WALLET_ADDRESS);
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
  const isAlreadyPaid = sub.status === "complete" || confirmed;

  // ── Already paid ────────────────────────────────────────────────────────────
  if (isAlreadyPaid) {
    return (
      <div className="max-w-lg mx-auto p-4 md:p-6 pb-20 space-y-4">
        <Link href="/subscription">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2" data-testid="link-back-subscription">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Subscription
          </button>
        </Link>

        <Card className="border-green-200">
          <CardContent className="px-5 py-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-700">Payment Complete</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your subscription is paid in full. POS deployment is permanently confirmed.
              </p>
            </div>
            <div className="bg-green-50 rounded-md px-4 py-3 text-sm text-green-800 space-y-1">
              <p><strong>Paid:</strong> ${sub.totalAmount} {sub.currency}</p>
              <p><strong>Status:</strong> Active · Permanent deployment</p>
              <p><strong>All protocols:</strong> 101.x / 201.x / 301.x / 401.x</p>
            </div>
            <Link href="/subscription">
              <Button className="w-full bg-green-600 hover:bg-green-700" data-testid="button-back-to-subscription">
                View Subscription
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Payment flow ─────────────────────────────────────────────────────────────
  const wallet = sub.walletAddress ?? WALLET_ADDRESS;
  const network = sub.walletNetwork ?? "ETHEREUM (ERC20)";
  const token = sub.walletToken ?? "USDT";
  const amount = sub.remainingAmount;

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6 pb-20 space-y-4">

      <Link href="/subscription">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-1" data-testid="link-back-subscription">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Subscription
        </button>
      </Link>

      {/* Header */}
      <div className="flex items-center gap-2">
        <Wallet className="w-5 h-5 text-[#c8322b]" />
        <h1 className="text-xl font-bold">Complete Your Payment</h1>
      </div>

      {/* 48h warning */}
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="flex items-start gap-3 py-3 px-4">
          <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Your POS is fully active during the 48-hour payment window. Complete payment now to
            permanently confirm your deployment and avoid disconnection.
          </p>
        </CardContent>
      </Card>

      {/* Amount + progress */}
      <Card>
        <CardContent className="px-5 py-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Amount due</span>
            <span className="text-2xl font-bold font-mono">{amount} {token}</span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Paid: ${sub.paidAmount} {token}</span>
              <span>Total: ${sub.totalAmount} {token}</span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, #c8322b, #e85d52)",
                }}
              />
            </div>
            <p className="text-xs text-right mt-1 text-amber-600 font-medium">
              {pct}% paid — ${amount} {token} remaining
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Wallet card */}
      <Card>
        <CardContent className="px-5 py-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-sm">Payment Details</span>
          </div>

          {/* Token / Network badges */}
          <div className="flex gap-2 flex-wrap">
            <Badge className="bg-teal-100 text-teal-700 border-teal-200 no-default-active-elevate text-xs gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
              Token: {token}
            </Badge>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 no-default-active-elevate text-xs">
              Network: {network}
            </Badge>
            <Badge className="bg-gray-100 text-gray-600 border-gray-200 no-default-active-elevate text-xs">
              Min: 1.0 USDT
            </Badge>
          </div>

          {/* QR Code */}
          <div className="flex justify-center py-2">
            <div className="rounded-xl overflow-hidden border-2 border-border p-2 bg-white">
              <img
                src={QR_URL}
                alt="USDT wallet QR code"
                className="w-[200px] h-[200px] block"
                data-testid="img-wallet-qr"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-semibold">Wallet Address</p>
            <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2.5 border border-border">
              <p className="text-xs font-mono flex-1 break-all text-foreground">{wallet}</p>
              <Button
                size="icon"
                variant="ghost"
                onClick={copyAddress}
                className="flex-shrink-0"
                data-testid="button-copy-address"
              >
                {copied
                  ? <Check className="w-3.5 h-3.5 text-green-500" />
                  : <Copy className="w-3.5 h-3.5" />
                }
              </Button>
            </div>
            {copied && (
              <p className="text-xs text-green-600 mt-1 text-center font-medium">Address copied!</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent className="px-5 py-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Instructions</p>
          {[
            `Open your crypto wallet or exchange`,
            `Send exactly ${amount} USDT to the address above`,
            `Select ETHEREUM (ERC20) network — do NOT use other networks`,
            `Once sent, click the verify button below`,
          ].map((txt, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#c8322b]/10 text-[#c8322b] flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-muted-foreground text-xs leading-relaxed">{txt}</span>
            </div>
          ))}
          <div className="flex items-start gap-2 mt-3 p-2.5 bg-blue-50 rounded-md border border-blue-200">
            <AlertTriangle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Always verify the network before sending. Funds sent on the wrong network cannot be recovered.
              This wallet only accepts USDT on ETHEREUM (ERC20).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Verify button */}
      <Button
        className="w-full h-12 text-base font-semibold gap-2"
        style={{ backgroundColor: "#1a56db" }}
        onClick={handleVerify}
        disabled={verifying || completeMutation.isPending}
        data-testid="button-verify-payment"
      >
        {verifying || completeMutation.isPending ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Verifying on blockchain...
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4" />
            I've Sent the Payment — Verify Now
          </>
        )}
      </Button>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        Verification checks blockchain confirmations. This may take 1–3 minutes.
        Your POS access remains active throughout the verification process.
      </p>

    </div>
  );
}
