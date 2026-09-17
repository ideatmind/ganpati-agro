# Decisions

## Role-aware workspace navigation — 16 September 2026

Management opens directly in operations; personal referral/onboarding activity remains available at `/dashboard?personal=1`. Employees and farmer referrers keep their scoped dashboards. Managers see team oversight wording, while staff administration and Trash remain super-admin-only. Share role-filtered desktop/mobile navigation and repeated admin heading/status patterns without introducing a new UI framework or permission model.

Use validated list returns instead of arbitrary URLs or browser history for operational Cancel/Back actions. Keep bulk success visible after refreshed rows, use named destructive confirmations with keyboard focus containment, and confirm recipient/amount before recording an already-completed offline payout. Preserve the existing independent server/database authorization, grant scope, payment snapshots, PII protection and financial retention. See [role UX remediation report](ROLE_UI_REMEDIATION_20260916.md) for local browser evidence and explicit remaining limits.

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

## Permanent deletion from Trash — 15 September 2026

Super-admins can permanently erase up to 100 explicitly selected trashed profiles after confirming their current password. The server derives the actor from the signed session, limits password attempts and repeats role, password and Trash checks in PostgreSQL. Selections are atomic; repeat requests do not repeat deletion or audit events. There is no all-matching permanent deletion.

Retain the existing financial-history invariant: physically delete persons, encrypted Aadhaar/fingerprint/last-four, plots and sessions; clear login credentials and mobile from a disabled account shell. Disable the referral code and revoke edit grants. Completed registration, farmer and account IDs remain as anonymous linking records for memberships, payments, receipts, earnings, payouts and audit/grant history. Issued receipts retain their original name and masked mobile. This is operational profile erasure, not erasure of every historical reference or backup. Mobile and Aadhaar can be used for a new registration.

Registrations that never started checkout and have no cash declaration can be physically removed. Updated by the owner on 16 September 2026: pending registrations can also be permanently erased. Checkout reservations, orders and cash records retain an anonymous registration reference so late payment evidence remains traceable. Staff accounts are blocked. Erased profiles cannot be restored or re-trashed. Accounting links preserve duplicate/late capture handling and employee onboarding attribution.

## Security and UX audit — 15–16 September 2026

Use the current database fee for registration and cash labels, with an atomic stale-price expectation check. Preserve original fee/commission snapshots on retries. The initial fee remains ₹500; the hosted `live_trial_fee` currently sets ₹1. No hosted fee or data was changed during this audit; the owner must resolve that private-trial/public-launch decision.

Strengthen cash/allocation immutability and protect original payment-order/webhook evidence while retaining permitted processing transitions. Keep finance-only management access and anonymized recent earnings after profile erasure. Align profile-edit and purge lock ordering. These changes are in `20260915190000_audit_financial_controls.sql`, following the local permanent-deletion migration.

Persist exact pending payout requests for response-loss recovery, scoped to the signed-in account's browser session. Display employees' own pending online-payment queue. Apply shared Unicode name validation, two-decimal acreage, editable validated referral codes, safe field-specific errors, duplicate-submit guards and recoverable network feedback. Add a validated `/r/[code]` alias. Restrict the demo helper to explicit trial/nonproduction mode; preserve the owner's temporary test-payment decision.

Use the existing green token for the registration action after finding insufficient white/orange text contrast. Keep keyboard access and focus return for the mobile menu. These targeted changes do not replace a screen-reader, real-device or full WCAG audit. See [audit report](SECURITY_UX_AUDIT_20260915.md) for evidence and remaining release gates.

## INR 1 live checkout — 15 September 2026

The owner requested removal of the temporary payment-mode switch and a live trial fee of INR 1. New fee versions use 100 paise while previous registration snapshots stay unchanged. Production must reject test credentials and old test checkout capabilities, and require a distinct live webhook secret. The 10% commission remains unchanged (10 paise at the new fee). No test-data cleanup is included.


## Existing protected live webhook variable

The owner saved the new live signing secret under RAZORPAY_WEBHOOK_SECRET. Vercel sensitive variables cannot be renamed or read back. Allow that standard name in production only when the server configuration explicitly sets RAZORPAY_WEBHOOK_MODE=live; prefer RAZORPAY_LIVE_WEBHOOK_SECRET if present. Checkout readiness and signature verification use the same selection. Test checkout and unsigned/tampered webhooks remain rejected.


## Integrated audit publication — 16 September 2026

Both audit migrations are now applied to ganpati-agro-v2; the hosted ledger contains 18 migrations. Existing records and the effective ₹1 fee are unchanged. The integrated application preserves the newer live-only checkout safeguards and removes the public demo/mode controls. This supersedes earlier pending-migration and temporary-switch statements. See [the release record](AUDIT_RELEASE_20260916.md) for verified scope and migration version mapping.

## Standard fee and continuous hero playback — 16 September 2026

The owner requested ₹500 in the registration form and hosted database, removal of the hero pause/play button, and no GitHub push. Insert a new fee version for 50000 paise rather than editing old versions or registration/payment/commission snapshots. Existing ₹1 checkouts retain their original quote. The database-backed working form displays the effective fee, including employee cash labels; future registration commissions remain 10% (₹50 at this fee).

The hero now uses native muted, looping, inline autoplay with no control button or application-imposed pause. This explicit request supersedes this video's earlier reduced-motion, viewport and connection playback gates; other motion preferences remain supported. Browser or operating-system playback restrictions cannot be overridden by this component.

The fee migration is applied remotely, but all requested source edits remain local and no UI deployment or GitHub push was made. Deploy the database-backed form before relying on the hosted form's displayed price; the earlier live release hardcoded ₹1.

## Distinct filter and results identity — 16 September 2026

Use separate React key namespaces for the admin filter form and results component. Both reset when the validated query changes, but must never share a sibling key. This prevents old filter forms from remaining visible after client navigation or filter submission. Browser regression coverage must use sidebar clicks and history navigation; direct page loads alone did not expose this failure.

## Pending-payment profile erasure — 16 September 2026

Super-admin permanent deletion no longer requires completing or reconciling a pending payment first. Keep the existing password, Trash, explicit-selection, role and atomicity checks. Erase personal identifiers and login access immediately; retain financial/cash evidence. Block new checkout attempts, but allow an already in-flight provider order response to bind for traceability. A verified capture after pending erasure records the payment and a deduplicated admin-review audit entry, without creating entitlements or restoring the profile. If capture committed first, its existing receipt/membership/earning remains immutable. Erased cash profiles leave the employee’s actionable pending queue. This supersedes the unresolved-checkout rejection described in earlier audit reports.

## Registration form wording — 16 September 2026

At the owner's request, removed the employee cash-collection checkbox, its explanatory text and optional collection note from the registration form. Removed the associated client state and form payload field; the existing server schema defaults an omitted cash declaration to false. Signed-session employee onboarding attribution and historical cash records remain intact. The initial submit button now reads exactly नोंदणी करा. The ₹500 membership summary, consent, checkout and payment-status feedback remain visible as appropriate. This explicitly supersedes the earlier requirement to retain cash controls on this form. Changes remain local and unpushed.

## GitHub HTTP test port collision — 16 September 2026

The GitHub HTTP check failed before exercising the app because its RPC bridge tried to bind occupied port 55434. The runner now requests port 0 by default, reads the port actually bound by the OS from the bridge readiness message, and passes that URL to Next.js. Explicit RPC_BRIDGE_PORT overrides remain supported. Shutdown waits for each owned child process to exit, with a bounded force-stop fallback; early startup exits report captured output immediately.

Added a regression test launching two simultaneous bridges and checking their distinct reachable endpoints. Lint, typecheck, all 36 tests and production build passed. The complete HTTP suite was exercised with port 55434 deliberately occupied; the test app and bridge ports were checked for release after exit. No application behavior or Supabase migration changes are involved.


## Multiple crops and irrigation sources per plot — 17 September 2026

Use native checkbox groups with bilingual labels, selection counts, summaries and 48px touch targets. Crop choices remain filtered by the existing single profile cluster. Each plot requires at least one crop and one irrigation source; duplicates and unknown values are rejected. Native keyboard and required-field validation work without a custom listbox or new dependency.

Store bounded text arrays in registration_plots and farmer_plots. Backfill existing scalar choices as singleton arrays and copy full arrays only during verified payment finalization. Keep the old scalar columns as the first selection and accept legacy scalar RPC/API payloads for compatibility with the deployed form. The array fields are canonical for new requests and admin/employee views. Plot editing permissions remain read-only; profile editing and financial behavior are unchanged.

Applied local migration 20260917102532_plot_multi_select.sql to hosted ganpati-agro-v2 as version 20260917103536. Match by migration name when reconciling local/hosted history. Prepared for publication from current GitHub main; the database migration is already applied.
