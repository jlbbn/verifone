import Stripe from 'stripe';

async function getStripeKeyFromConnector(): Promise<string | null> {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const identity = process.env.REPL_IDENTITY;
    if (!hostname || !identity) return null;

    const res = await fetch(
      `https://${hostname}/api/v2/connection/conn_stripe_01KW06WTJX3QGDN9PS8K567M0S/credentials`,
      {
        headers: {
          Authorization: `Bearer ${identity}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { secret?: string };
    return data.secret ?? null;
  } catch {
    return null;
  }
}

export async function getStripeClient(): Promise<Stripe> {
  const connectorKey = await getStripeKeyFromConnector();
  const key = connectorKey
    || process.env.Secretkey1
    || process.env.STRIPE_SECRET_KEY;

  if (!key) throw new Error('Stripe key not configured');
  if (
    !key.startsWith('sk_live_') &&
    !key.startsWith('sk_test_') &&
    !key.startsWith('rk_live_') &&
    !key.startsWith('rk_test_')
  ) {
    throw new Error(`Stripe key format invalid (got prefix: ${key.substring(0, 8)}...)`);
  }
  return new Stripe(key, { apiVersion: '2026-05-27.dahlia' as any });
}
