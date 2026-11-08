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
- Authenticated Stripe payment-status polling verifies ownership before querying the provider; the success page does not clear the cart before an order is confirmed.
- Braintree reconciliation searches the provider using the durable pending-order ID, recovers accepted payments and keeps unknown states reserved for manual review.
- The Braintree payment-start transition and expiry-worker claim use conditional MongoDB updates to avoid a race between expiry and a new charge.
- Admin permissions are checked against the current database account role; new customer accounts require stronger passwords.
- The shipping-information page matches the actual AU/US shipping rules, removing incorrect free-shipping and AU-only claims.

## Railway + Netlify steps

1. Keep Stripe and Braintree in **test/sandbox mode** and point Railway at the existing staging MongoDB database (`test`). Do not run checkout tests against the live database.
2. Deploy the **Railway API first**, then deploy the matching **Netlify React frontend**. Old frontend code does not supply the required quote or Stripe idempotency key.
3. Confirm existing Railway configuration contains `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Braintree credentials, MongoDB connection, `FRONTEND_URL`, `RESEND_API_KEY`, `ORDER_EMAIL_FROM`, and **`MERCHANT_ORDER_EMAIL`** (or `SUPPORT_EMAIL`). Verify names and values privately; never paste keys into chat.
4. Add a separate Railway cron service using the **same backend code and staging variables**. Start command: `npm run reconcile`. Cron: `*/5 * * * *` (every five minutes). Set `EMAIL_RETRY_SINCE` to the ISO-8601 UTC deployment cutoff timestamp (for example, `2026-11-08T00:00:00Z`) **before starting the worker**, so historical test orders do not receive surprise confirmation emails. Do not start this job until the API/frontend deployment is confirmed and the DB target is verified.
5. Run `npm run test:checkout` locally, then perform live sandbox tests for both AU and US addresses, both providers, failed cards, redirects, refreshes, duplicate clicks, expired reservations, and notification delivery.
6. Verify MongoDB `PendingOrder` and `Order` entries have correct amount, country, conversion snapshot, inventory status, provider status, and notification timestamps.
7. Confirm Stripe webhooks reach `/webhooks/stripe` and subscriptions include `payment_intent.succeeded` and `payment_intent.payment_failed`; verify refunds and disputes with your chosen events and fulfilment policies.
8. For Braintree, simulate an interrupted network response after a provider sale. Confirm the reconciliation worker can recover exactly one order from its provider order ID, without submitting a second sale. Missing or conflicting provider transactions must remain in manual-review state.
9. For Stripe, confirm an unauthenticated or different customer cannot call `/confirm-payment` to see someone else's order. Verify cart removal happens only after recorded success.
10. Verify customer and merchant notifications are sent once for successful new transactions and that provider outages do not undo a payment.
11. Confirm application monitoring and Atlas backups/restore procedure. Test a restart during successful order finalization and duplicate webhook deliveries.

## Important limitations / launch blockers

- **This is not independently certified or end-to-end tested.** Provider, DB, Netlify, Railway and Resend integration must be verified in staging before activating live keys.
- Ambiguous Braintree payments (`paymentState: processing`) are searched by their original provider order reference and only confirmed/failed provider states are automatically reconciled. Missing, multiple or inconclusive results remain **reserved for manual investigation**; the worker sends a one-time merchant alert after 30 minutes. Review Railway worker logs and alerts rather than assuming all cases resolve automatically.
- Reconciliation must not be deployed to production with staging database variables or vice versa.
- Resend retries are provider-idempotent but sending and saving status are not one atomic cross-system transaction. Monitor failed emails; avoid assuming exactly-once delivery in every failure mode.
- Provider statuses may change after a recovered order (for example, a settlement may subsequently be declined). Reconcile payouts, refunds and disputes operationally. Refunds must not automatically replenish inventory unless returned goods are actually restockable.
- Atlas uniqueness indexes must exist in the target database; verify their successful creation in staging before live traffic. Do not rely on application-only duplicate checks.
- Exchange rates are indicative reference rates, not a guarantee of the customer's bank conversion rate. Check the client's shipping/tariff/tax disclosures and Australian/US consumer obligations separately before launch.
- Do not remove existing `|| localhost` fallbacks until the environment URLs have been verified in deployed builds, as previously agreed.

## Local verification

`npm run test:checkout`

For a real frontend build, install dependencies from the lockfile and run `npm run build`. The ZIP review environment did not have installed `node_modules`, so a full production build and payment-provider E2E checks were not executed here.
