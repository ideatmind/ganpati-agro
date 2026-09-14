# Payments and receipts

Razorpay Orders API binds attempts to a server-created ₹500 order. Checkout success is accepted only after HMAC signature verification and provider status verification. Webhooks validate the raw request body, use `x-razorpay-event-id` for deduplication, and tolerate out-of-order delivery.

The database stores the receipt number, payment/order references, amount, issue time, member identity snapshot, and public receipt token. It stores no PDF. `/receipt/{token}` renders the record for print or Save as PDF.

Demo payment mode is permitted only outside production and is visibly labelled.

Checkout uses a signed HttpOnly capability bound to the registration. The server reserves order creation atomically and reuses the stored provider order on retries. If provider creation times out before its identifier can be stored, checkout remains uncertain; operators must reconcile it rather than reset the reservation and risk another charge.

The status endpoint restores saved checkout after refresh. An explicit status check can fetch the bound order's payments and finalize a matching captured payment. Missing webhooks can therefore recover without trusting a browser success callback. Scheduled reconciliation is not yet implemented.

Capture finalization locks the registration and order, persists the attempt, and creates entitlements once. Additional captures are retained and flagged for review. Webhook failures persist safely and return a retryable response; duplicate and out-of-order events do not downgrade a completed registration.

Receipts have no-store, noindex and no-referrer controls, contain no Aadhaar, and display issue times in Asia/Kolkata. Treat receipt links as bearer access and avoid sharing them in analytics or support logs.

There is no customer/admin refund interface or refund initiation endpoint. Refund/dispute/reversal/chargeback/correction notifications are retained for operational review, linked to a known order using the payment ID when necessary. No automatic commission reversal, financial mutation or second membership occurs. A refund/corrective-accounting product is explicitly outside this MVP scope. See [PRODUCTION_RUNBOOK.md](PRODUCTION_RUNBOOK.md) for incident and deployment procedures.
