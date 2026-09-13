# Payments and receipts

Razorpay Orders API binds attempts to a server-created ₹500 order. Checkout success is accepted only after HMAC signature verification and provider status verification. Webhooks validate the raw request body, use `x-razorpay-event-id` for deduplication, and tolerate out-of-order delivery.

The database stores the receipt number, payment/order references, amount, issue time, member identity snapshot, and public receipt token. It stores no PDF. `/receipt/{token}` renders the record for print or Save as PDF.

Demo payment mode is permitted only outside production and is visibly labelled.
