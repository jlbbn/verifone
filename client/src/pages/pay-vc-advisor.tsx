import { useState } from "react";
import { Copy, Check, DollarSign, Globe, Wallet, CreditCard } from "lucide-react";

const WALLET_ADDRESS = "0xa8FAaC0297897d9c3b14a037BfDe794c1aFBa7d3";
const NETWORK = "ETHEREUM (ERC20)";
const TOKEN = "USDT";
const MIN_AMOUNT = "2.0 USDT";
const AMOUNT_DUE = "$750.00 USD";
const AMOUNT_DUE_MXN = "$13,000.00 MXN (referencial)";
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${WALLET_ADDRESS}&color=000000&bgcolor=ffffff&qzone=2`;

function BanxicoLogo() {
  return (
    <div className="flex items-center gap-3 justify-center select-none">
      <svg
        viewBox="0 0 52 60"
        width="34"
        height="39"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="20" y="0" width="5" height="8" rx="1" fill="#c8322b" />
        <rect x="30" y="0" width="5" height="8" rx="1" fill="#c8322b" />
        <rect x="20" y="52" width="5" height="8" rx="1" fill="#c8322b" />
        <rect x="30" y="52" width="5" height="8" rx="1" fill="#c8322b" />
        <path
          d="M12 4h22c6 0 10 3.5 10 9 0 3.5-1.8 6.2-4.5 7.8C43.5 22.8 46 26 46 30.5c0 6.5-4.5 10.5-11.5 10.5H12V4z"
          fill="#c8322b"
        />
        <path d="M18 10h14c3 0 5 1.5 5 4.5S35 19 32 19H18V10z" fill="white" />
        <path d="M18 24h15c3.5 0 5.5 1.8 5.5 5s-2 5-5.5 5H18V24z" fill="white" />
      </svg>
      <div className="leading-none">
        <span className="text-gray-800 font-bold tracking-widest text-lg uppercase" style={{ letterSpacing: "0.18em" }}>
          BANXICO
        </span>
        <span className="text-[#c8322b] font-black text-lg">+</span>
      </div>
    </div>
  );
}

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
        <p className="text-sm font-semibold text-gray-800 break-all">{value}</p>
      </div>
      {onCopy && (
        <button
          onClick={onCopy}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          data-testid={testId}
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

export default function PayVCAdvisorPage() {
  const [copied, setCopied] = useState<string | null>(null);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const shortWallet = `${WALLET_ADDRESS.slice(0, 9)}...${WALLET_ADDRESS.slice(-7)}`;

  return (
    <div className="min-h-screen" style={{ background: "#ede8e3" }} data-testid="page-pay-vc-advisor">
      <div className="max-w-md mx-auto px-4 pt-8 pb-14 space-y-4">

        <div className="text-center mb-2 space-y-3">
          <BanxicoLogo />
          <div>
            <h1 className="text-lg font-bold text-gray-800">Datos de Pago</h1>
            <p className="text-xs text-gray-500 mt-0.5">Usuario Banxico+ · VC Advisor LLC</p>
          </div>
        </div>

        {/* Amount due */}
        <div className="bg-white rounded-2xl px-5 py-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Monto a pagar</p>
          <p className="text-2xl font-bold text-gray-800" data-testid="text-amount-usd">{AMOUNT_DUE}</p>
          <p className="text-xs text-gray-400 mt-0.5" data-testid="text-amount-mxn">{AMOUNT_DUE_MXN}</p>
        </div>

        {/* QR */}
        <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col items-center">
          <p className="text-sm font-semibold text-gray-700 mb-4">Comparte tu código</p>
          <img
            src={QR_URL}
            alt="Código QR de la wallet de pago"
            className="w-48 h-48 rounded-lg border border-gray-100"
            data-testid="img-payment-qr"
          />
        </div>

        {/* Details */}
        <div className="space-y-2.5">
          <InfoRow
            icon={<CreditCard className="w-4 h-4 text-white" />}
            iconBg="bg-emerald-500"
            label="Token"
            value={TOKEN}
            onCopy={() => copyText(TOKEN, "token")}
            copied={copied === "token"}
            testId="button-copy-token"
          />
          <InfoRow
            icon={<Globe className="w-4 h-4 text-white" />}
            iconBg="bg-gray-800"
            label="Red"
            value={NETWORK}
            onCopy={() => copyText(NETWORK, "network")}
            copied={copied === "network"}
            testId="button-copy-network"
          />
          <InfoRow
            icon={<DollarSign className="w-4 h-4 text-white" />}
            iconBg="bg-amber-500"
            label="Monto mínimo"
            value={MIN_AMOUNT}
          />
          <InfoRow
            icon={<Wallet className="w-4 h-4 text-white" />}
            iconBg="bg-indigo-500"
            label="Dirección"
            value={shortWallet}
            onCopy={() => copyText(WALLET_ADDRESS, "address")}
            copied={copied === "address"}
            testId="button-copy-address"
          />
        </div>

        <p className="text-[11px] text-gray-400 text-center leading-relaxed pt-2">
          Envía únicamente {TOKEN} en la red {NETWORK} a esta dirección. Cualquier duda sobre tu pago,
          responde al correo de bienvenida que recibiste.
        </p>
      </div>
    </div>
  );
}
