---
name: Stripe raw-card-data PCI block
description: Why a Stripe account rejects paymentMethods.create with typed card fields, and the only real fix.
---

Stripe accounts without special raw-card-data approval reject any
`stripe.paymentMethods.create({ card: { number, exp_month, exp_year, cvc } })`
call made from server code with: "Sending credit card numbers directly to the
Stripe API is generally unsafe... use Stripe.js, mobile bindings, or Stripe
Elements". This is an account-level PCI policy, not a key/config bug — it
cannot be worked around by fixing keys, retrying, or catching the error
differently.

**Why:** Stripe requires the PAN/CVV to be tokenized inside a Stripe-hosted
surface (Stripe.js `CardElement`/Elements, or a mobile SDK) so raw card data
never reaches the merchant's server. The typed card fields must be entered
directly into Stripe's iframe.

**How to apply:** Install `@stripe/stripe-js` + `@stripe/react-stripe-js`,
mount a `CardElement` inside `<Elements stripe={loadStripe(pk)}>`, call
`stripe.createPaymentMethod({ type: "card", card: cardElement, billing_details })`
client-side to get a `paymentMethod.id`, then send only that id to the
backend. Backend confirms the PaymentIntent with
`payment_method: paymentMethodId` — never rebuilds a PaymentMethod from raw
card fields. A raw-card fallback (e.g. to Mercado Pago) can't reuse this
tokenized id since it has no PAN; if raw card data isn't collected at all,
that fallback path must be dropped or kept on a separate raw-card form.
