# API contracts

Public endpoints create a validated registration, create/resume its payment order, verify checkout success, process Razorpay webhooks, and retrieve a receipt by an unguessable token.

Authenticated endpoints login/logout, read the caller's dashboard, and let authorized management record payouts or controlled edits. Every response uses a stable `{ data }` or `{ error }` shape and avoids returning Aadhaar.
