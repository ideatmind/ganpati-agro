# Phase 01 acceptance criteria

- A unique mobile and unique Aadhaar can create only one account.
- A farmer record, membership and referral earning appear only after a verified captured ₹500 payment.
- Browser verification and webhook replay converge on one idempotent finalization transaction.
- A referrer receives the snapshotted 10% rate even when an employee assists onboarding.
- Employee attribution is independent from referral ownership.
- Cash is recorded only when the employee explicitly marks it received.
- Employee lists are limited to their onboarded farmers and are read-only.
- Referral balances show earned, offline paid and available amounts.
- Receipts render from a small payment record and are printed/downloaded on-device.
- No Razorpay secret, Aadhaar plaintext or privileged Supabase key reaches browser code.
