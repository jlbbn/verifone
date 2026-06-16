import { MercadoPagoConfig, Payment } from "mercadopago";

export function getMPClient(): MercadoPagoConfig {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN no configurado");
  return new MercadoPagoConfig({ accessToken });
}

export interface MPCardPaymentResult {
  id: number;
  status: string;
  status_detail: string;
  authorization_code: string | null;
}

export async function processMPCardPayment(params: {
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  securityCode: string;
  holderName: string;
  holderEmail: string;
  amount: number;
  description: string;
  cardType: string;
}): Promise<MPCardPaymentResult> {
  const client = getMPClient();
  const accessToken = process.env.MP_ACCESS_TOKEN!;

  // ── 1. Tokenizar tarjeta vía API REST (server-side) ──────────────────────
  const tokenRes = await fetch("https://api.mercadopago.com/v1/card_tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      card_number: params.cardNumber.replace(/\s/g, ""),
      expiration_month: params.expiryMonth,
      expiration_year: params.expiryYear,
      security_code: params.securityCode,
      cardholder: {
        name: params.holderName,
        identification: { type: "RFC", number: "XAXX010101000" },
      },
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    throw new Error((err as any)?.message ?? `Error tokenizando tarjeta (${tokenRes.status})`);
  }

  const tokenData = await tokenRes.json() as { id: string };
  const cardToken = tokenData.id;

  // ── 2. Crear pago con el token ────────────────────────────────────────────
  const payment = new Payment(client);
  const result = await payment.create({
    body: {
      transaction_amount: params.amount,
      token: cardToken,
      description: params.description,
      installments: 1,
      payment_method_id: params.cardType.toLowerCase() === "amex" ? "amex"
        : params.cardType.toLowerCase().includes("master") ? "master"
        : "visa",
      payer: { email: params.holderEmail },
    },
  });

  return {
    id: result.id!,
    status: result.status ?? "unknown",
    status_detail: result.status_detail ?? "",
    authorization_code: (result as any).authorization_code ?? null,
  };
}
