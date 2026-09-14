# Decisions

## 2026-09-13

- Membership activates automatically after successful ₹500 payment.
- Employees may collect cash, keep it, and pay the company online from their personal account.
- Farmer and employee referrals ship in the current release.
- Default referral commission is 10% for all eligible referrers.
- Farmer referral receives commission when an employee assists; the employee receives onboarding-count credit.
- Referral payouts and claims happen offline; the application only records and displays completed payouts.
- Authentication uses mobile number and password.
- Farmers receive referral, earnings, and payout views rather than a general farmer-management dashboard.
- Mobile and Aadhaar are unique. Current farmer and plot fields remain.
- Managers and super admins edit farmer details; employees require scoped temporary access.
- The system starts with a fresh Supabase project and does not migrate legacy records.
- Receipts render on-device; only the small receipt record is retained.

## 2026-09-14 — production audit controls

- Browser roles never authorize database RPCs. Privileged public functions and default function grants are restricted to server access; private identity data also has RLS enabled.
- Registration retries require matching existing credentials, identity fingerprint and onboarding actor. They resume the stored snapshot without overwriting it.
- One atomic reservation coordinates provider order creation. An uncertain external result requires reconciliation; it must not automatically create a replacement order.
- A signed, HttpOnly, registration-scoped cookie supports checkout ownership and recovery. A verified capture is still the only entitlement trigger.
- Additional captures and failed/refund/dispute notifications are preserved for review. No automatic refund, commission reversal or historical financial mutation is introduced. The subsequent MVP scope keeps corrective handling operational; an in-app correction/refund workflow is not a launch requirement.
- Offline payout recording uses a stable request UUID, exact paise parsing and a locked balance. Replaying the same request returns the existing record; a changed payload is rejected.
- Employee temporary access remains limited to farmers they onboarded. A grant cannot widen their visibility to unrelated farmers.
- Sessions are stored and revocable. Logout revokes the current session; password change revokes all sessions. New passwords require at least 8 characters and at most 72 UTF-8 bytes with the current bcrypt storage.
- Keep the existing monolith and Postgres transaction model. Use durable database throttles and coordination before adding a cache or queue. A trusted client-IP header must be explicitly configured for the deployment.
- Apply application/auth/payment migrations as a coordinated release. The live privilege closure alone does not deploy these behavior changes.

## 2026-09-14 — measured MVP optimization

- Keep the Next.js/Postgres architecture. Combine related throttle/auth/checkout operations transactionally; retain provider verification and atomic entitlement/accounting writes.
- Admin sections use server pagination (25 records), bounded search and 20-record form lookups. Deactivating staff revokes sessions; manager/super-admin can revoke scoped grants. Super-admin alone manages staff status.
- Record provider refund/dispute/reversal/chargeback/correction notifications as operational exceptions, linking by known payment ID when order ID is absent. Never automatically mutate original entitlements or finances.
- No MFA, SMS/OTP, OAuth, refund API/UI, claims, enterprise queue/cache or self-service recovery is required for this MVP. MFA and recovery remain future/operational work.
- Clear sensitive inputs after registration save, then overlap SDK loading with order creation. Recover uncertain payments through provider status rather than encouraging a second payment.
- Place the application near the Mumbai database. Retain self-hosted fonts and the original agricultural composition; defer smaller hero video on mobile.

- /admin is a temporary redirect to the existing protected /dashboard/admin route; authentication and role checks remain at the destination. Local manual testing runs both the app and isolated database as hidden background processes.


## Admin workspace — 14 September 2026

- Replace the stacked console with task-specific navigation, compact paginated lists and dedicated action pages. Super admin receives all submitted form fields; passwords remain unreadable hashes.
- At the owner's request, permit explicit audited Aadhaar reveal for active super admin only. Keep it out of ordinary payloads, logs, receipts, CSV and audit details; expire the browser display after 60 seconds or page hiding. Registration consent text explains this access.
- Implement bulk removal as recoverable Trash and restore, preserving the immutable financial and membership lifecycle. No hard-delete or refund operation is added.
- The redesign is tested locally and requires the admin_workspace migration with the coordinated application release. The existing Vercel candidate does not contain it.

- Bulk deletion now supports all matching registrations across pages. The same signed-in super administrator must re-enter their current password for more than 25 selected records or any all-matching selection. PostgreSQL resolves and locks targets, checks the expected count, verifies the password, then writes archive/audit rows atomically. Financial retention rules remain unchanged.

## Bilingual geography directory

- Use the owner's supplied 4,875-village workbook as the registration directory. Keep internal district/taluka codes stable while updating their labels and adding Latur.
- Load one content-versioned taluka JSON pack on selection, cache successful loads, and make all its villages browseable without a search. Render 30 options initially and append batches on scroll or Load more; optional search remains local. No per-keystroke database calls or full-directory client bundle.
- Preserve free-text village entry for missing/historical records. Distinguish duplicate names with their village codes. Coverage counts describe the available registration directory.

## Password change response handling

- Successful 204 RPC responses represent a completed operation, not malformed JSON. Handle this in the shared database client so password changes and session revocation use the same correct behavior.
- Password changes revoke all sessions atomically in PostgreSQL. After success, clear browser cookies directly and return the user to login with a success message. Do not issue a redundant database revocation that could turn a committed password change into a reported failure.
- Keep Account & password directly accessible from the admin navigation on desktop and mobile; require confirmation of the new password in the form.

## Homepage Maharashtra coverage map

- Replace the coverage chips and decorative counter grid with a geographic Maharashtra SVG. Highlight only the five registration districts using existing brand tokens; use external Marathi/English labels and leader lines. All other district shapes remain neutral and unlabeled.
- Render the map on the server from local simplified boundary paths, without a client map library or third-party runtime requests. Retain the source's MIT permission notice. The three totals below the map use imported directory metadata, not geographic feature counts or hard-coded marketing claims.

## Temporary registration test helper

- A local testing button may populate synthetic, schema-valid registration values, including unique-looking mobile and Aadhaar numbers and the consent checkbox. It fills only; submission and payment remain explicit user actions. Remove the helper before production release.

## Decision: temporary form switch without database modes

Per the owner's updated instruction, registration exposes a temporary Test mode switch controlled by ENABLE_PAYMENT_MODE_SWITCH. Mode is held only in the signed HttpOnly checkout cookie, never in database columns. ON selects test credentials; OFF selects live credentials. Missing credentials fail explicitly; switching never substitutes test keys for live. Mode locks after registration; the provider verifies existing-order ownership before reuse, so retrying a registration under another mode cannot reuse that gateway order successfully.

The owner approved test memberships, receipts and referral records in the same database during the private test phase. Retain normal payment signature, capture and idempotency checks. A later database cleanup/removal of test tooling is a separate task and was not executed here.

## Mobile registration spacing — 15 September 2026

Keep responsive form styling in legacy-form.css. Fieldsets must not add a second mobile gutter in operations.css. Use a single column below 768px, non-shrinking consent controls and at least 44px action targets. Preserve every bilingual field, validation, consent and payment state; no stepper or new UI dependency is needed for this layout repair.

## Dependent crop selection and public form wording — 15 September 2026

Move the existing registration-level cluster into Farm Details before its plots. All plot crops must belong to that cluster; keep shared crops when valid in the new cluster, clear incompatible crops, and enforce the relationship at API validation. Keep consent's data-use purpose visible, but omit infrastructure and administrator access details from the public form. Password visibility is opt-in, independent for each field, and available on login too.

## INR 1 live checkout — 15 September 2026

The owner requested removal of the temporary payment-mode switch and a live trial fee of INR 1. New fee versions use 100 paise while previous registration snapshots stay unchanged. Production must reject test credentials and old test checkout capabilities, and require a distinct live webhook secret. The 10% commission remains unchanged (10 paise at the new fee). No test-data cleanup is included.


## Existing protected live webhook variable

The owner saved the new live signing secret under RAZORPAY_WEBHOOK_SECRET. Vercel sensitive variables cannot be renamed or read back. Allow that standard name in production only when the server configuration explicitly sets RAZORPAY_WEBHOOK_MODE=live; prefer RAZORPAY_LIVE_WEBHOOK_SECRET if present. Checkout readiness and signature verification use the same selection. Test checkout and unsigned/tampered webhooks remain rejected.
