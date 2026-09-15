# Admin workspace — 14 September 2026

Implemented and verified locally. The existing Vercel candidate predates this redesign; the new application and `20260914162417_admin_workspace.sql` have not been released to production. Apply the pending migrations and application together using the existing coordinated release procedure.

## Working areas

- Overview with registration totals and links into operations.
- Registrations with name/reference/full-mobile search, status/date filters, sorting, 25/50/100-row pagination, page selection and selected-row CSV export.
- Separate team, referral balance, payout, temporary permission, payment exception, activity and Trash views. Account creation, payout recording and permission grants have dedicated pages.
- Registration details group personal information, all submitted plots, account/referral/consent context, employee cash declarations, provider payments, receipt links and a chronological lifecycle. Passwords remain one-way hashes and cannot be displayed.
- Desktop sidebar, mobile navigation, responsive record cards, visible keyboard focus, loading/empty/error states and confirmation dialogs.

## Access and bulk actions

Only an active super administrator receives full mobile numbers and can explicitly reveal encrypted Aadhaar. The reveal endpoint validates the signed actor, rate limits requests and records an audit event containing only the registration ID. Full Aadhaar is absent from ordinary server-rendered pages, lists, receipts, exports and audit details. The browser clears the revealed value after 60 seconds or when hidden. This provides administrative inspection, not government identity authentication.

Super administrators can move selected registrations (up to 100 explicit IDs, or all matching records across pages) to Trash with a reason, restore them, and activate/deactivate staff. Managers and super administrators can revoke selected temporary grants. Role and scope checks are enforced again in PostgreSQL. A malformed item fails the whole batch. Trash operations are idempotent and logged only when a record changes.

Trash hides registrations from active lists. It does not cancel checkout, revoke membership or delete persons, payments, receipts or referral earnings. A captured payment still finalizes correctly if its registration was moved to Trash. Financial history remains immutable. Staff deactivation revokes sessions through the existing account lifecycle.

## Verification

- Lint, TypeScript, 17 application/security tests and production build passed.
- All 13 ordered migrations plus geography seed installed on a fresh isolated PostgreSQL 16 database; payment/authorization and new admin workspace SQL regressions passed.
- HTTP journey covers complete form detail reads, role-denied Aadhaar/bulk requests, explicit super-admin reveal, Trash/restore with receipt preservation, and dedicated action pages, alongside the existing payment/session regression journey.
- Browser checks used synthetic local records: desktop table/search, selection/confirmation/Trash/restore, mobile menu, form detail access and Aadhaar reveal/hide.
- Ten measured requests per screen on 50,045 synthetic registrations: overview median 249 ms / slowest 406 ms; registrations median 256 ms / slowest 407 ms. Complete HTML responses were 28 KB and 53 KB respectively. These local measurements include a test-only PostgreSQL bridge and exclude browser rendering, WAN latency and real Razorpay interaction. Raw evidence: [HTTP measurements](ADMIN_WORKSPACE_HTTP.json).

Real hosted Razorpay checkout completion remains a separate acceptance gap from the earlier payment work. No real payment was charged during the admin tests.

## Password-confirmed deletion update

More than 25 explicit selections, and every all-matching selection, require the acting super admin’s current password. Select the current page, then choose “Select all … matching records” to include every page. Clear filters first to include all active registrations. The confirmation shows the count and scope. The server rechecks matching counts, role, password and filters; stale counts or incorrect credentials make no changes. Password confirmation attempts are rate limited and the input clears after each attempt or cancellation. Passwords never enter audit details or request logs.

Passwords now require eight characters for registration, staff creation and password changes; the 72-byte bcrypt bound is retained. Mobile and Aadhaar accept exactly 10 and 12 ASCII digits, respectively. These updates require migration `20260914172703_admin_delete_confirmation.sql` and the accompanying application release.

## Permanent deletion from Trash

Select records in Trash and choose **Delete permanently**. Confirm with the acting super-admin’s current password. Personal details, Aadhaar, plots and sessions are physically removed, the account is anonymized and disabled, and the entries disappear from Trash and operational profile reads. The dialog states that deletion cannot be undone and that original receipts and financial/audit history remain. Pending payments, checkout reservations, payment exceptions and cash declarations do not block deletion. Accounts with staff roles still block the entire selection. Up to 100 explicit records are supported per request.

Requires `20260915090000_admin_permanent_delete.sql` before deploying the accompanying application. The migration itself deletes no customer data. Completed registration/farmer/account shells remain for accounting links; pending registrations with checkout or cash evidence retain an anonymous registration shell, while pristine pending registrations are deleted. Apply `20260915195318_allow_pending_profile_erasure.sql` with the accompanying application to enable pending deletion. New checkout attempts are blocked after erasure. Verified late captures are retained for admin review without recreating a farmer, membership, receipt or referral earning. Existing backups and issued receipts are not erased. SQL regression coverage includes authorization, password checks, all-or-nothing failure, physical profile erasure, identifier reuse, login invalidation, retained earnings/receipts and duplicate webhook finalization.

Verification completed: all four database suites, authenticated HTTP deletion (including wrong-password and manager rejection), and 12 simultaneous deletion/capture calls passed. Lint, typecheck, 28 application tests and production build passed. No live farmer records were deleted or migrated during this work.
