import Stripe from 'stripe';

let _client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (_client) return _client;
  const key = process.env.Secretkey1 || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe key not configured');
  if (!key.startsWith('sk_live_') && !key.startsWith('sk_test_') && !key.startsWith('rk_live_') && !key.startsWith('rk_test_')) {
    throw new Error(`Stripe key format invalid — key must start with sk_live_ or sk_test_ (got: ${key.substring(0, 8)}...)`);
  }
  _client = new Stripe(key, { apiVersion: '2024-06-20' });
  return _client;
}
