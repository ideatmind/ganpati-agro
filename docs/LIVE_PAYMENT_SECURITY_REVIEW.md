# Live payment release review — 15 September 2026

Scope: application source and dependencies, checkout/signature/webhook boundaries, database authorization, session revocation, fee snapshots and deployment configuration. This is an engineering review with automated regression checks, not a guarantee against every vulnerability or an independent penetration test.

## Changes

- Public test-mode switch and demo auto-fill removed. Production accepts live checkout only regardless of the removed switch flag. Test/legacy checkout cookies are not promoted to live checkout. Submitted test_mode=true is rejected.
- Production webhook verification requires a live signing secret: the explicit live variable, or the standard variable deliberately designated with RAZORPAY_WEBHOOK_MODE=live. Unconfigured fallback and old test signatures are rejected. Live checkout fails closed if live webhook configuration is absent. An explicit key cannot silently borrow another key pair's secret.
- New fee version is 100 paise (INR 1); earlier versions and registration snapshots remain unchanged. Initial referral rate remains 1000 basis points, yielding 10 paise for a new INR 1 membership.

## Checks and evidence

- npm audit: 0 known vulnerabilities across 405 dependencies (including development/optional dependencies).
- Next.js 16.3.3 includes the fixes listed in the [official August security release](https://nextjs.org/blog/august-2026-security-release). No dependency upgrade required by the current audit result.
- Supabase: 0 application tables without RLS, 0 anon/authenticated table privileges, 0 publicly executable privileged RPCs. Advisor results are INFO-only deny-by-default RLS/no-policy notices; service-only access is intentional.
- Source and client-bundle credential-pattern scans found no credentials; environment files are not tracked. This pattern scan does not replace a full secret-history scanner.
- Manual review confirmed server-only database/PII modules, actor IDs derived from signed sessions, scoped role checks, exact-origin mutation protection, bounded request bodies, hashed rate-limit identifiers and redacted API errors/logs.
- Regression checks cover exact payment amount/currency/order capture, invalid signatures, duplicate and out-of-order webhook handling, concurrency, no membership before capture, immutable payment history, referral accounting, checkout ownership, old test cookie rejection, employee/admin boundaries, Aadhaar reveal authorization and no-store behavior, logout/password-change session revocation and bulk-delete password confirmation.
- Database fee-version test verifies a previous INR 500 quote stays INR 500 while a later registration quotes INR 1. No historical financial records are repriced or deleted.
- Live Razorpay API credentials were validated with an authenticated read-only request (HTTP 200), and placed in Vercel production configuration without publishing their values. No money was charged.

## Release gates and limitations

- OPEN: owner must replace the predictable administrator password before enabling live payments.
- Owner reports LIVE webhook setup and has updated the protected RAZORPAY_WEBHOOK_SECRET in Vercel. The compatibility setting RAZORPAY_WEBHOOK_MODE=live deliberately selects that secret; actual delivery still requires verification after a captured payment.
- The live API secret was supplied in conversation; rotate it in Razorpay before public launch and update Vercel.
- Existing owner-approved test data remains in the current database. Cleanup is a separate operation; these records must not be treated as real collections.
- The hosted live_trial_fee migration was applied once; effective fee is 100 paise from 2026-09-14 20:53:49 UTC. The owner deployed the live release. This follow-up repairs the environment-variable name mismatch without reading or copying the protected secret.
- Real captured-payment acceptance is an owner-performed test after deployment. Automated provider fixtures do not certify actual capture or webhook delivery.

Local validation completed: npm run lint, npm run typecheck, npm test (28 passing), production build, transactional database regressions, 12-way concurrency regression and synthetic HTTP journeys passed. An initial concurrent run hit host memory exhaustion; sequential bounded-memory reruns passed.
