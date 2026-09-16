import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromiseCache: { key: string; promise: Promise<Stripe | null> } | null = null;

// Cache the loadStripe() promise per publishable key so we never re-instantiate
// Stripe.js on every render — loadStripe() is expensive and should be called once.
export function getStripePromise(publishableKey: string | undefined | null): Promise<Stripe | null> | null {
  if (!publishableKey) return null;
  if (stripePromiseCache && stripePromiseCache.key === publishableKey) {
    return stripePromiseCache.promise;
  }
  const promise = loadStripe(publishableKey);
  stripePromiseCache = { key: publishableKey, promise };
  return promise;
}
