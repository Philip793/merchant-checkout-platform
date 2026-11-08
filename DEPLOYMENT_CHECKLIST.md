# Checkout hardening: staged deployment checklist

This package is based on `merchant-checkout-platform-main(2).zip`.
It intentionally excludes `.env`, keys, secrets, and `node_modules`.

## Changes

- Both payment methods use an authenticated, signed **10-minute server quote**.
- AU shipping is **AUD 10**; US shipping is **USD 30 converted to AUD** at the published Frankfurter USD/AUD rate. Product prices and actual charges remain AUD.
- Rate date/source and AUD charge are displayed on the checkout screen. The quote token locks the server-side amount; user-submitted totals are ignored.
- Automatic exchange-rate lookup is cached for 12 hours. Rate data older than five days is rejected. US checkout stops if no trustworthy rate is available.
- Stripe checkout attempts now carry reusable idempotency keys; Braintree idempotency is retained.
- Stripe's failed-payment webhook cancels the PaymentIntent before releasing stock.
- Customer and merchant email attempts use Resend idempotency keys, with persisted sent/error fields and reconciliation retries.
- A Railway cron job reconciles expired, **not-started** Braintree checkouts and expired Stripe reservations, and retries unsent order emails.
- Invalid product identifiers and quantities are rejected rather than coerced.
- Backend startup initializes inventory after DB connection, and production errors no longer return raw internal messages.

## Railway + Netlify steps

1. Keep Stripe and Braintree in **test/sandbox mode** and point Railway at the existing staging MongoDB database (`test`). Do not run checkout tests against the live database.
2. Deploy the **Railway API first**, then deploy the matching **Netlify React frontend**. Old frontend code does not supply the required quote or Stripe idempotency key.
3. Confirm existing Railway configuration contains `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Braintree credentials, MongoDB connection, `FRONTEND_URL`, `RESEND_API_KEY`, `ORDER_EMAIL_FROM`, and **`MERCHANT_ORDER_EMAIL`** (or `SUPPORT_EMAIL`). Verify names and values privately; never paste keys into chat.
4. Add a separate Railway cron service using the **same backend code and staging variables**. Start command: `npm run reconcile`. Cron: `*/5 * * * *` (every five minutes). Do not start this job until the API/frontend deployment is confirmed and the DB target is verified.
5. Run `npm run test:checkout` locally, then perform live sandbox tests for both AU and US addresses, both providers, failed cards, redirects, refreshes, duplicate clicks, expired reservations, and notification delivery.
6. Verify MongoDB `PendingOrder` and `Order` entries have correct amount, country, conversion snapshot, inventory status, provider status, and notification timestamps.
7. Confirm Stripe webhooks reach `/webhooks/stripe` and subscriptions include `payment_intent.succeeded` and `payment_intent.payment_failed`.

## Important limitations / launch blockers

- **This is not independently certified or end-to-end tested.** Provider, DB, Netlify, Railway and Resend integration must be verified in staging before activating live keys.
- Existing ambiguous Braintree payments (`paymentState: processing`) are intentionally **not automatically released**; they require provider reconciliation. Build an alerting/runbook before taking real orders.
- Reconciliation must not be deployed to production with staging database variables or vice versa.
- Resend retries are provider-idempotent but sending and saving status are not one atomic cross-system transaction. Monitor failed emails; avoid assuming exactly-once delivery in every failure mode.
- Exchange rates are indicative reference rates, not a guarantee of the customer's bank conversion rate. Check the client's shipping/tariff/tax disclosures and Australian/US consumer obligations separately before launch.
- Do not remove existing `|| localhost` fallbacks until the environment URLs have been verified in deployed builds, as previously agreed.

## Local verification

`npm run test:checkout`

For a real frontend build, install dependencies from the lockfile and run `npm run build`. The ZIP review environment did not have installed `node_modules`, so a full production build and payment-provider E2E checks were not executed here.
