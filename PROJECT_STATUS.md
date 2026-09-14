# Project status

**Current phase:** Redesigned admin workspace implemented and tested locally; existing Mumbai candidate predates this redesign. Real hosted-checkout acceptance and coordinated live release remain.

## Complete

- Product decisions and permission model agreed.
- Brand guidelines translated into design tokens and UI direction.
- Fresh Supabase project created in Mumbai.
- New modular Next.js application and initial database migration created.
- Payment finalization, referral ledger, employee dashboard, operations console, offline payouts, and temporary edit grants implemented.
- Supabase migrations `0001` through `0004` and geography seed applied to project `pryknxknjbwypdudtryz`.
- Initial super-admin account activated through the controlled bootstrap process.
- Updated server-side Supabase requests for the current `sb_secret_` API-key header requirements.
- TypeScript, ESLint, tests, production build, and browser verification are tracked below.

## External configuration verification

- Vercel environment metadata confirms Supabase, session, encryption and Razorpay variables exist. Secret values and live-key mode were not downloaded or verified.
- Local Razorpay TEST order creation works. Hosted checkout is blank in the available automated browser; desktop Chrome checking is pending with the user.
- Verify production live-key mode, capture configuration and webhook subscriptions before promotion. No active remote account matched the default seed password during the audit.

## Verification

- `npm run typecheck` — passed
- `npm run lint` — passed with zero warnings
- `npm test` — 17/17 application/security tests passed
- `npm run build` — current redesign passed locally; the preceding MVP build also passed on Vercel
- All thirteen ordered migrations plus geography seed applied successfully to a fresh isolated PostgreSQL 16 database
- `npm run test:db` — payment, authorization, session, payout and immutability regressions passed
- `npm run test:concurrency` — 12 simultaneous order requests and 12 simultaneous browser/webhook finalizations passed
- `npm run test:http` — isolated production-build HTTP journey passed with synthetic Razorpay responses; no real payment charged
- `npm audit --audit-level=high` — zero reported vulnerabilities
- Home, registration and login pages — visually checked in a browser
- Desktop and 390×844 mobile layouts — visually checked
- Crop tabs, mobile menu and dynamic add-plot controls — interacted with successfully; zero browser errors after CSP correction
- Supabase monetary lifecycle — passed in a rolled-back integration transaction
- `anon` and `authenticated` access to `private.person_identifiers` — verified false

## Current acceptance gaps

- Admin workspace redesign is local only. Details, role rules, Trash behavior and verification: [admin workspace](docs/ADMIN_WORKSPACE.md).

- Real hosted-checkout completion, failed/cancelled checkout and Android/iPhone payment-app return are not yet verified. Automated payment integration tests use a simulated provider.
- Production migration/application promotion is pending the coordinated acceptance step. The candidate is not compatible with the old authenticated/payment RPC contracts until migrations are applied.

## Production audit — 2026-09-14

- Closed public execution of privileged RPCs on connected Supabase with `restrict_privileged_rpcs` and `default_function_privileges`. Verified zero anon/authenticated privileged RPC grants and 14 existing service-role RPCs retained. No active account matched the development seed password.
- Prepared **but did not remotely apply** `payment_reliability` and `auth_and_operations_hardening`. Application changes are **not deployed**. Release them together after reconciling local/remote migration history.
- Added checkout ownership/reload recovery, single order reservation, durable failed webhooks, additional-capture detection, payout idempotency, durable rate limits, session revocation, password change, employee ownership enforcement and safe boundary errors.
- Preserved bilingual registration attributes, cash controls, fee/commission snapshots, referral priority and payment-before-membership rules. Added reduced-motion video control and deferred gateway loading until sensitive submission inputs are cleared.
- Added CI and operational runbooks. Hosted CI, real gateway/browser acceptance, production load, trusted IP/edge limits, backup restore and alert delivery remain unverified.
- The follow-up MVP scope supersedes the audit's MFA/recovery/refund launch requirements: MFA and self-service recovery are future items; no in-app refund or automatic financial correction workflow is required. Unexpected provider events are retained for operational review without changing historical finances.
- Full evidence, severity findings, scores, limitations and launch checklist: [production audit](docs/PRODUCTION_READINESS_AUDIT.md). Deployment/recovery procedure: [production runbook](docs/PRODUCTION_RUNBOOK.md).

## MVP optimization — 2026-09-14

- Local login outage traced to the stopped isolated PostgreSQL process; restart it as a hidden background service for manual testing. `/admin` now redirects to the existing protected `/dashboard/admin` page. This shortcut is local until the next deployment.

- At 10k isolated registrations, admin p95 fell 2271 → 306 ms and HTML 3,446,619 → 53,964 bytes. Order p95 fell 374 → 280 ms; verification 398 → 226 ms; login 610 → 391 ms. These use simulated provider responses, not production capture timings.
- Added bounded admin registration/staff/referrer/payout/exception/grant/audit lists, search, registration/payment details, staff status and session revocation, scoped grant revocation, and provider status reconciliation.
- Combined durable rate-limit/auth/checkout RPCs remove redundant round trips. A measured ordering index keeps recent-registration reads efficient at 50k synthetic records.
- Added explicit payment progress/recovery states, immediate submit-to-checkout, overlapping SDK/order loading after sensitive inputs clear, mobile operational layouts and a 56% smaller deferred hero video. All bilingual registration fields remain.
- Candidate `dpl_G7bgUEaHmgVSCuKFdDzYyj3xuQAR` is READY with application functions in Mumbai. Live custom domains and the project alias remain on `dpl_4yGUnhncszfcPYMArXBh4rFTQxdQ`.
- Remote schema still has the initial four and two emergency privilege migrations. Five pending migration names are listed in the runbook. No customer or financial rows were replaced or deleted.
- Full before/after measurements, UI/admin/payment acceptance and factual limitations: [MVP optimization results](docs/MVP_OPTIMIZATION_RESULTS.md).

## Bulk deletion and input rules — 14 September 2026

- Super admin can select every matching registration across pages. More than 25 selected records, or all matching records, require the signed-in admin’s current password. Incorrect passwords and stale counts leave the selection unchanged. Deletion remains recoverable Trash.
- Password minimum is eight characters in forms, APIs and PostgreSQL. Exact mobile/Aadhaar validation rejects non-digits, whitespace, newlines and wrong lengths.
- Focused SQL tests cover 25/26 records, wrong/missing passwords, another admin’s password, manager denial, 101-record cross-page removal/restore and eight-character account/password operations. A rolled-back 50,020-record bulk operation completed in 2.15 seconds locally.
- These changes and migration admin_delete_confirmation remain local and unreleased.

## Village directory — 14 September 2026

- Imported the supplied bilingual workbook: 5 districts, 50 talukas and 4,875 unique villages. Added Latur; preserved existing internal geography identifiers.
- Updated registration/profile forms with dependent selectors and local Marathi/English/code search. Only the chosen taluka is downloaded, at most 12.6 KB, and village options render incrementally in batches of 30.
- Updated homepage coverage counts and district names. Lint, typecheck, 20 tests, geography SQL checks and isolated production build passed; browser verification recorded in docs/GEOGRAPHY_DIRECTORY.md.
- Applied the geography migration to the isolated local preview database. Production migration/deployment remains pending. The side-preview runs independently on port 3103.

## Admin password change fix — 14 September 2026

- Reproduced a shared RPC client failure when a successful password-change response had HTTP 204 and no JSON body. The client now accepts 204 without parsing; the password endpoint clears cookies without a redundant session-revocation RPC after the transaction already revoked all sessions.
- Added a dedicated Account & password page to desktop/mobile admin navigation, new-password confirmation, a specific incorrect-current-password error and a sign-in success notice. The eight-character minimum remains.
- Lint, typecheck, 21 unit/security tests, production build and the full isolated HTTP journey passed. Manager and super-admin fixtures exercised wrong-current-password rejection, successful changes, revocation of two sessions, old-password rejection, new-password login and restoration of their test credentials. The test bridge now returns realistic empty 204 responses for password/session RPCs.
- Local preview refreshed. Production deployment remains pending; no production account password was changed.


## Browse villages without searching — 14 September 2026

- Registration and authorized profile forms now open the selected taluka’s full village list with 30 initial options, automatic loading on scroll and a Load more fallback. Search remains optional; reopening a selection restores full-list browsing.
- Switching taluka resets the village, search and visible batch. Existing small per-taluka downloads, caching, keyboard selection and free-text fallback remain.
- Lint, typecheck, 22 tests and production build passed. Browser checks verified scrolling and all 126 Dharashiv villages, last-village selection, Marathi search, keyboard use, taluka reset and mobile layout. Main local preview refreshed; production deployment remains pending.

## Maharashtra coverage map — 14 September 2026

- Homepage coverage now features Maharashtra district boundaries, five distinct district colors and external bilingual labels with leader lines. Counts below the map show 5 districts, 50 talukas and 4,875 villages from directory metadata.
- Static SVG geometry is about 16 KB gzip; no map SDK or remote tile requests. MIT boundary attribution is included. Checked all 36 paths and all five label anchors; desktop/mobile visual checks and lint, typecheck, 22 tests and isolated production build passed.
- Updated source and the separate preview at `http://localhost:3103/#coverage`. No production deployment or database change was made for this map.


## Owner crop catalog — 14 September 2026 (side conversation)

- Added all 13 requested categories and supplied crops/businesses to one shared catalog. The website cluster tabs, registration cluster selector and authorized profile cluster selector show bilingual category names. Each registration plot now uses a native dropdown grouped by category; plots may select different categories. Duplicate सीताफळ/सिताफळ appears once as सीताफळ.
- New registration API inputs reject unlisted crop names. Existing saved crop text and cluster IDs remain readable. Migration `20260914180710_crop_categories.sql` expands `persons_cluster_type_check` to all 13 categories without changing permissions or historical records.
- Validation: lint, typecheck, all 24 unit tests and isolated production build passed. All 15 migrations applied to a fresh loopback `crop_catalog_test` database; all 13 categories successfully registered through the database RPC in a rolled-back transaction. HTTP registration verified the oilseed, medicinal and agroforestry categories using synthetic fixtures. Browser checks verified all category/crop options, independent plot choices, preservation after plot removal, website category panels and keyboard wraparound.
- Preview: http://localhost:3104/register and http://localhost:3104/#clusters, served from `.audit/crop-sidecheck` against an isolated test database. The main preview on port 3100 and its database were not restarted or changed. Apply the new migration alongside the application update when refreshing that preview or deploying; no production deployment was performed.


## Bilingual crop labels — 14 September 2026

- Corrected all 90 catalog entries to display Marathi / English on website crop chips and registration crop options, including allied agriculture and protected cultivation. Shared, exhaustively typed display labels preserve existing stored values and validation.
- Lint, typecheck, all 24 tests and isolated production build passed. A catalog check verified both scripts on every entry; browser checks verified the form options and website chips.
- Updated separate preview: http://localhost:3105/register and http://localhost:3105/#clusters (`.audit/crop-bilingual`). Main preview and database remain untouched; the previous crop-category migration still needs coordinated application with that preview refresh. No additional migration is needed for these translations.

## Vercel release preparation — 15 September 2026

- Published the prepared application to `codex/vercel-release-20260915` in the owner-approved public GitHub repository. Environment files, backups and local audit workspace are excluded.
- Vercel preview is READY at https://ganpati-agro-release-20260915.vercel.app (deployment `dpl_wuCaPstXiuZwJbAPevXni7gEACP5`), with functions in Mumbai. Node is pinned to 22.x; the www domain redirects to the canonical apex. Production APP_ORIGIN and the Vercel-overwritten client-IP header are configured for the next deployment.
- Lint, typecheck, 24 unit tests, production build, database regressions, 12-way order/capture concurrency, synthetic production HTTP journey and dependency audit passed locally. Vercel also built successfully. Initial GitHub CI exposed a UTC-dependent test assumption; the corrected test explicitly verifies both sides of Indian midnight while the database session uses UTC.
- Created an encrypted hosted-database backup and verified restoration of all 24 application tables into isolated local PostgreSQL. All nine pending migrations applied to that restored data, preserving account, registration and financial row counts. This verifies logical data restoration and schema upgrade, not managed-project disaster recovery or a production RPO/RTO.
- Hosted Supabase remains on its six existing migrations. Live domains still serve the previous deployment. Preview public-page checks do not establish authenticated/payment compatibility until the coordinated migration release.
- Production promotion remains pending the payment-mode decision: configured Razorpay keys are TEST keys, and production deliberately rejects them. Real hosted checkout, capture/webhook acceptance and payment-app return still need verification. No hosted customer records, passwords or financial rows were changed during this preparation.

## Canonical-domain redirect repair — 15 September 2026

- Reproduced the live loop: the Vercel project redirected ganpatiagro.in to www.ganpatiagro.in, while the application redirected www back to the apex. Removed only the conflicting project-domain redirect through the authenticated Vercel CLI; the apex now serves the existing deployment directly.
- Verified live GET requests: homepage, registration (including query string) and login each take one www-to-apex 308 hop and then return 200. Added `node scripts/check-production-redirects.mjs` as a repeatable, read-only deployment check.
- This repair changes domain routing only. It does not certify the pending Supabase/payment acceptance work recorded above.

## Temporary registration demo data — 15 September 2026

- Added a removable testing button to the registration form that fills randomized, schema-valid synthetic personal, geography, farm, account and consent values. It never submits the form or starts payment.
- Focused validation, lint and typecheck pass. This control is intended only for local testing and must be removed before production release.

## Hosted Supabase migration completed — 15 September 2026

- Applied all nine pending migrations to the existing hosted ganpati-agro-v2 project after taking a fresh Windows-user-encrypted backup. The hosted history now contains 15 migrations. This supersedes earlier notes saying the schema upgrade was pending.
- Existing account/person checksums are identical before and after migration. Preserved all 5 accounts, 5 registrations and 5 payment orders; captured payments, memberships and receipts remain at their original zero counts. Geography now contains 5 districts and 50 talukas; 4,875 village entries remain in the deployed static directory packs.
- Verified zero publicly executable privileged RPCs, zero application tables without RLS, and service-role access to the core application RPCs. Security/performance advisors report informational deny-by-default RLS/no-policy and unused-index notices; no warning/error findings. These tables intentionally use server-only service-role RPC access; do not add public policies to suppress the notices.
- Hosted login now returns INVALID_CREDENTIALS for a nonexistent synthetic account after successfully executing authenticate_limited_session. A rolled-back hosted transaction verified an eight-character password login, wrong-password rejection, session lookup, password change and session revocation. No synthetic account or password change persisted. All nine admin workspace sections returned successfully through the hosted database.
- Live homepage, registration and login redirect checks pass. Previously published CI passed lint, typecheck, 24 unit tests, database/concurrency regressions, build and synthetic HTTP journeys. Actual browser login with the owner's credentials and real Razorpay capture/webhook/app-return acceptance remain separate; production Razorpay credentials are still TEST keys and production checkout remains blocked by its existing guard.

## Temporary form payment switch — 15 September 2026

- Added the owner-requested Test mode ON/OFF switch. ON uses Razorpay test credentials; OFF uses live credentials and reports clearly when live keys are absent. ENABLE_PAYMENT_MODE_SWITCH controls whether the temporary switch is available.
- No database mode columns or migrations. The selection is bound to a signed HttpOnly checkout cookie, locked after registration, and reused for order creation, verification and status retries. Existing saved orders are checked against the selected provider account before reuse. Operator reconciliation can look up orders with either configured key pair.
- The owner explicitly approved creating test memberships, receipts and referral records in the current prelaunch database. No cleanup was performed; removing test/demo data remains a separately scoped prelaunch operation.
- Lint, typecheck, all 26 unit tests, isolated production build and the full synthetic HTTP payment journey passed. Tests verify distinct test/live keys, mode-bound signatures/cookies, default test blocking, and rejection of body-supplied mode overrides after checkout starts.

- Deployment verification: the switch is live on https://ganpatiagro.in/register. GitHub CI passed on 2b0f575. Browser checks verified ON/OFF labels and missing-live-key feedback. A synthetic hosted registration created one actual Razorpay TEST order for 50000 paise; retrying reused its order and signed-cookie mode. No payment was captured. No database mode migration was applied.

