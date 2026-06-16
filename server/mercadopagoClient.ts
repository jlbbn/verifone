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

// Uses a card token created client-side via MP JS SDK (PCI compliant)
export async function processMPPaymentWithToken(params: {
  cardToken: string;
  cardType: string;
  holderEmail: string;
  amount: number;
  description: string;
}): Promise<MPCardPaymentResult> {
  const client = getMPClient();
  const payment = new Payment(client);

  const paymentMethodId =
    params.cardType.toLowerCase().includes("amex") ? "amex" :
    params.cardType.toLowerCase().includes("master") ? "master" :
    "visa";

  const result = await payment.create({
    body: {
      transaction_amount: params.amount,
      token: params.cardToken,
      description: params.description,
      installments: 1,
      payment_method_id: paymentMethodId,
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
