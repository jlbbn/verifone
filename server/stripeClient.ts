import Stripe from 'stripe';

let _client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (_client) return _client;
  const key = process.env.Secretkey1 || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe key not configured');
  _client = new Stripe(key, { apiVersion: '2024-06-20' });
  return _client;
}
