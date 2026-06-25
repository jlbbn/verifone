import Stripe from 'stripe';

async function getStripeKeyFromConnector(): Promise<string | null> {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const identity = process.env.REPL_IDENTITY;
    if (!hostname || !identity) return null;
    const res = await fetch(
      `https://${hostname}/api/v2/connection/conn_stripe_01KW06WTJX3QGDN9PS8K567M0S/credentials`,
      { headers: { Authorization: `Bearer ${identity}`, 'Content-Type': 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json() as { secret?: string };
    return data.secret ?? null;
  } catch {
    return null;
  }
}

function isValidKey(k: string): boolean {
  return k.startsWith('sk_live_') || k.startsWith('sk_test_') ||
         k.startsWith('rk_live_') || k.startsWith('rk_test_') ||
         k.startsWith('mk_');
}

export async function getStripeClient(): Promise<Stripe> {
  const candidates = [
    process.env.STRIPE_SECRET_KEY,
    process.env.Secretkey1,
    process.env.STRIPE_CONNECTOR_KEY,
    await getStripeKeyFromConnector(),
  ];

  const key = candidates.find(k => k && isValidKey(k) && !k.startsWith('mk_')) ?? null;
  if (!key) throw new Error('No valid Stripe key found. Provide sk_live_ or sk_test_ in STRIPE_SECRET_KEY.');
  return new Stripe(key, { apiVersion: '2026-05-27.dahlia' as any });
}

export function getStripeMode(): 'live' | 'test' | 'unknown' {
  const candidates = [
    process.env.STRIPE_SECRET_KEY,
    process.env.Secretkey1,
    process.env.STRIPE_CONNECTOR_KEY,
  ];
  const k = candidates.find(c => c && isValidKey(c) && !c?.startsWith('mk_')) ?? '';
  if (k.startsWith('sk_live_') || k.startsWith('rk_live_')) return 'live';
  if (k.startsWith('sk_test_') || k.startsWith('rk_test_')) return 'test';
  return 'unknown';
}
