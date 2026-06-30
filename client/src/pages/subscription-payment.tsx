import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Copy, Check, CheckCircle, Clock, AlertTriangle,
  RefreshCw, Share2, DollarSign, Globe, Wallet, CreditCard,
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

const WALLET_ADDRESS = "0x5293790F2C49A1B11B3d3b2AcB8583946B20f735";
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${WALLET_ADDRESS}&color=000000&bgcolor=ffffff&qzone=2`;

function InfoRow({
  icon,
  iconBg,
  label,
  value,
  onCopy,
  copied,
  testId,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold leading-none mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
      </div>
      {onCopy && (
        <button
          onClick={onCopy}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          data-testid={testId}
        >
          {copied
            ? <Check className="w-4 h-4 text-green-500" />
            : <Copy className="w-4 h-4" />
          }
        </button>
      )}
    </div>
  );
}

export default function SubscriptionPaymentPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
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
      toast({ title: "Pago verificado", description: "Tu membresía ha sido confirmada." });
    },
    onError: () => {
      toast({ title: "Error al verificar", description: "Intenta de nuevo.", variant: "destructive" });
      setVerifying(false);
    },
  });

  function handleVerify() {
    setVerifying(true);
    setTimeout(() => { completeMutation.mutate(); }, 3000);
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function shareData(wallet: string, network: string, token: string) {
    const text = `Datos Wallet USDT\nToken: ${token}\nRed: ${network}\nMonto mínimo: 1.0 USDT\nDirección: ${wallet}`;
    if (navigator.share) {
      navigator.share({ title: "Datos Wallet USDT", text });
    } else {
      copyText(text, "share");
      toast({ title: "Datos copiados", description: "Comparte desde tu portapapeles." });
    }
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
  const wallet  = sub.walletAddress  ?? WALLET_ADDRESS;
  const network = sub.walletNetwork  ?? "ETHEREUM (ERC20)";
  const token   = sub.walletToken    ?? "USDT";
  const amount  = sub.remainingAmount;

  const shortWallet = `${wallet.slice(0, 9)}...${wallet.slice(-7)}`;

  // ── Already paid ───────────────────────────────────────────────────────────
  if (isAlreadyPaid) {
    return (
      <div className="min-h-screen" style={{ background: "#ede8e3" }}>
        <div className="max-w-md mx-auto px-4 pt-5 pb-10">
          <Link href="/subscription">
            <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5" data-testid="link-back-subscription">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Pago Completado</h2>
            <p className="text-sm text-gray-500">Tu membresía está activa. POS confirmado permanentemente.</p>
            <div className="bg-green-50 rounded-xl px-4 py-3 text-sm text-green-800 space-y-1 text-left">
              <p><strong>Pagado:</strong> ${sub.totalAmount} {token}</p>
              <p><strong>Estado:</strong> Activo · Despliegue permanente</p>
              <p><strong>Protocolos:</strong> 101.x / 201.x / 301.x / 401.x</p>
            </div>
            <Link href="/subscription">
              <Button className="w-full" style={{ background: "linear-gradient(135deg,#3aafa9,#2b7a78)" }} data-testid="button-back-to-subscription">
                Ver Suscripción
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Payment flow ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "#ede8e3" }}>
      <div className="max-w-md mx-auto px-4 pt-5 pb-10 space-y-4">

        {/* Top nav */}
        <div className="flex items-center justify-between mb-2">
          <Link href="/subscription">
            <button className="text-gray-600 hover:text-gray-800 transition-colors" data-testid="link-back-subscription">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-base font-semibold text-gray-800">Datos Wallet USDT</h1>
          <div className="w-5" />
        </div>

        {/* Payment progress (si hay abonos parciales) */}
        {pct > 0 && pct < 100 && (
          <div className="bg-white rounded-xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-amber-700">Pago parcial registrado</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
              <span>Pagado: ${sub.paidAmount} {token}</span>
              <span>Total: ${sub.totalAmount} {token}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: "linear-gradient(90deg,#c8322b,#e85d52)" }}
              />
            </div>
            <p className="text-[11px] text-right mt-1 text-amber-600 font-medium">
              {pct}% pagado — ${amount} {token} restante
            </p>
          </div>
        )}

        {/* "Comparte tu código" + QR */}
        <div className="bg-white rounded-2xl px-5 pt-5 pb-6 shadow-sm text-center">
          <p className="text-base font-bold text-gray-800 mb-4">Comparte tu código</p>
          <div className="flex justify-center">
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "#111", padding: "14px" }}
            >
              <img
                src={QR_URL}
                alt="USDT wallet QR"
                className="w-[220px] h-[220px] block rounded-lg"
                data-testid="img-wallet-qr"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          </div>
        </div>

        {/* Info rows */}
        <div className="space-y-2">
          <InfoRow
            icon={<span className="text-white text-xs font-black">₮</span>}
            iconBg="bg-teal-500"
            label="Token"
            value={token}
            onCopy={() => copyText(token, "token")}
            copied={copied === "token"}
            testId="button-copy-token"
          />
          <InfoRow
            icon={<Globe className="w-4 h-4 text-white" />}
            iconBg="bg-gray-700"
            label="Red"
            value={network}
            onCopy={() => copyText(network, "network")}
            copied={copied === "network"}
            testId="button-copy-network"
          />
          <InfoRow
            icon={<DollarSign className="w-4 h-4 text-white" />}
            iconBg="bg-gray-800"
            label="Monto mínimo"
            value="1.0 USDT"
          />
          <InfoRow
            icon={<CreditCard className="w-4 h-4 text-white" />}
            iconBg="bg-gray-800"
            label="Dirección"
            value={shortWallet}
            onCopy={() => copyText(wallet, "address")}
            copied={copied === "address"}
            testId="button-copy-address"
          />
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 leading-relaxed">
            Esta wallet solo acepta <strong>USDT en ETHEREUM (ERC20)</strong>. Fondos enviados por otra red no pueden recuperarse.
          </p>
        </div>

        {/* Compartir datos button */}
        <button
          onClick={() => shareData(wallet, network, token)}
          className="w-full flex items-center justify-between px-5 py-4 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80"
          style={{ background: "linear-gradient(135deg,#3aafa9 0%,#6b8cba 100%)" }}
          data-testid="button-share-data"
        >
          <span>Compartir datos</span>
          <Share2 className="w-4 h-4" />
        </button>

        {/* Verify */}
        <button
          onClick={handleVerify}
          disabled={verifying || completeMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#c8322b 0%,#e85d52 100%)" }}
          data-testid="button-verify-payment"
        >
          {verifying || completeMutation.isPending ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Verificando en blockchain...</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> Ya envié el pago — Verificar</>
          )}
        </button>

        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          La verificación tarda 1–3 minutos. Tu acceso POS permanece activo durante el proceso.
        </p>

      </div>
    </div>
  );
}
