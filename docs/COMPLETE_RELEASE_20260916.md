# Complete workspace update — 16 September 2026

This release combines all current workspace follow-up changes with the latest GitHub main, including the previously merged admin audit. It preserves live-only production checkout and the explicit live-webhook configuration.

## Current behavior

- New registration fees are ₹500 (50000 paise). The form reads the database fee, checks stale expectations, and preserves existing ₹1 or ₹500 checkout snapshots.
- The initial registration button reads **नोंदणी करा**. The employee cash checkbox, collection note and explanatory block are removed; omitted cash declarations default to false. Signed-session onboarding attribution and historical cash records remain intact.
- The hero uses muted, looping, inline autoplay without a play/pause button or application-imposed pause gates. Browser/OS autoplay restrictions still apply.
- Admin filters and results have distinct React keys. Switching sections, submitting searches and browser history no longer accumulate stale filter forms; Overview has none.
- Super-admins can erase trashed pending profiles after password confirmation, retaining anonymous checkout/cash/payment evidence. New checkout is blocked after erasure. An already in-flight order can retain its provider linkage. Verified late captures create an admin-review record without restoring the profile or creating membership, receipt or referral earnings. If capture completed first, its existing financial history remains immutable.

## Supabase migration status

Project: `ganpati-agro-v2` (`pryknxknjbwypdudtryz`). All 20 repository migrations are represented in the hosted ledger by matching name; older hosted timestamp prefixes differ from repository filenames.

| Migration | Repository version | Hosted version | Status |
|---|---|---|---|
| `restore_standard_registration_fee` | `20260915194545` | `20260915194733` | Previously applied; verified, not replayed |
| `allow_pending_profile_erasure` | `20260915195318` | `20260915200851` | Applied after isolated rehearsal |

Immediately before/after the pending-erasure migration, the effective fee remained 50000 paise. Counts were unchanged: 14 accounts, registrations and orders; 12 personal profiles; 4 farmers, payments, memberships and receipts; 0 referral earnings and payouts; 2 previously erased accounts. Profile and registration-fee checksums matched. This migration did not erase any customer profile or payment record.

No exposed public RPCs were executable by anon/authenticated, and every exposed public table retained RLS. The security advisor reported only the existing 28 informational RLS-without-policy findings for deny-by-default access. No warning/error findings were returned. Prior function/constraint definitions were saved locally under ignored `.audit/pre-pending-erasure-schema.json`; the earlier encrypted database backup remains local and unpublished.

## Validation

- Lint, typecheck, all 35 application tests and production build passed for the combined source.
- All 20 migrations applied successfully to a fresh isolated PostgreSQL database; all seven SQL regression suites passed.
- Concurrent order/capture, completed-profile deletion retries and pending-erasure/first-capture races passed.
- Authenticated HTTP regression passed, including live-only checks, ₹500 registration, stale quotes, pending erasure, stale checkout rejection, duplicate late webhooks, retained finance and session revocation.
- Four admin-navigation browser groups passed: super-admin/manager at 390px/1280px, repeated section clicks, Overview, successive searches and Back/Forward.
- Eight registration browser groups passed: public, employee, manager and super-admin at both widths. Cash fields are absent, the button text is exact, and the ₹500 fee summary remains.
- Two hero browser checks passed for mobile/desktop autoplay without controls.

This record supersedes earlier pending-migration, ₹1-current-fee, cash-control and unpushed status statements. Real Razorpay acceptance and production deployment are separate from these isolated checks. All current source was integrated in a separate worktree, preserving the main task's working files and index.
