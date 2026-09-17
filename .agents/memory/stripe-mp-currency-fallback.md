---
name: Stripe→Mercado Pago currency fallback
description: Why real charges landed in MXN when a USD charge was intended, and how the fix works.
---

When a Stripe charge fails with a soft error (network/config, not a card decline), this app
falls back to Mercado Pago as a secondary acquirer. Mercado Pago's Mexican account always
settles in MXN — it has no per-charge currency selection — so sending it the raw face-value
number from a USD-intended charge silently charges that same number in pesos (e.g. a $200 USD
attempt becomes $200 MXN, ~18x less). This was the real cause of "cobros en pesos" complaints
even though the user only ever intended USD.

**Fix applied:** both fallback sites (`/api/pos/process-payment` and `/api/payment-engine/charge`
in `server/routes.ts`) now convert the amount to MXN using the admin-configured exchange rate
(`settings.tipoCambio`, and `fxRateEUR`/`fxRateGBP` via `convertToUSD` for other currencies)
before charging Mercado Pago, and abort with an explicit error instead of guessing if no rate is
configured. The transaction/charge ledger records now store the currency and amount that was
actually charged (`chargedCurrency`/`chargedAmount` in the POS flow, `mpAmount`/"MXN" in the
payment-engine flow) instead of a currency label that didn't reflect what actually happened.

**Why:** silently crossing currencies on a financial charge is a correctness/compliance issue,
not just a cosmetic one — the customer's card gets debited a different real-world amount than
was intended, and the previous ledger mislabeling ("MXN" hardcoded regardless of what Stripe
actually charged) made this hard to detect from the transaction history.

**Verified separately:** the connected Stripe account (country MX, sole_prop) does support
charging in USD — a live test PaymentIntent in USD was accepted (`card_payments` capability
active). There is no Stripe-side restriction; the bug was purely in the MP fallback path.

**How to apply:** any new acquirer-fallback path that crosses between a USD-capable processor
and a fixed-MXN-settlement processor (or vice versa) must convert the amount explicitly and
refuse rather than charge the raw number if the exchange rate is unavailable.
