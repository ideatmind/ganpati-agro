# UI, code and security review — 25 September 2026

## Delivered changes

- One shared theme for public pages, registration, login, receipts, employee/member dashboards, admin operations and error states. Brand colors, semantic feedback, type stacks, controls, card radii, surfaces, focus and shadows come from src/app/theme.css.
- Restored the previously unpublished समूह सहभाग homepage section with its four existing benefits. It has one ₹500 registration action and no Exclusive form button. Website navigation, both membership forms and employee/admin actions still expose Exclusive form. The default registration remains ₹500; focused membership remains ₹2,500.
- Preserved all bilingual form fields, six focused crop/business options, referral handling, consent/password fields, payment feedback, homepage illustrations/video and motion. Added consistent headers to member/employee, farmer and error pages.
- Closed a registration authentication-throttling gap: validated registration requests now consume login's shared hashed per-account five-attempts-per-minute budget before the registration transaction. Failed credential checks, rotating IPs and changing membership type cannot reset that budget. No migration or hosted data mutation is needed.

## Local reconciliation

The original main checkout was 23 commits behind the deployed baseline, with no unique commits. Of its 118 changed/untracked paths, 63 already matched main after newline normalization, 45 differed and 10 were absent. Old differing API/payment/admin files were not copied over newer releases.

Integrated the genuine unpublished homepage decision, Node/npm setup improvements, .nvmrc and two optional leaflet utilities. The leaflet utilities are historical: tools/README.md documents their outdated certificate/voting claims, ₹500-only content and optional Python/browser/font requirements. They require content review before distribution. Their generated files are ignored, not deployed as application source.

Before original-checkout synchronization, saved every changed/untracked file, SHA-256 manifest, binary tracked patch, original HEAD and status under its ignored .audit/recovery-ui-security-20260925 directory. A named recovery stash is retained during the final fast-forward; stale source versions must not be popped over the updated checkout.

## Verification

| Check | Result |
|---|---|
| Locked dependencies | npm ci succeeded; Node 22.23.3; npm audit reported zero known vulnerabilities |
| Required application checks | lint, typecheck, all 41 application tests and production build passed |
| Database | All nine regression suites passed against a freshly migrated isolated PostgreSQL 16 database |
| Concurrency | Twelve simultaneous order/capture and shared-membership/deletion scenarios passed |
| HTTP journeys | Registration retries, checkout ownership, signatures/capture, duplicate callbacks, receipts, both memberships and admin filtering passed |
| Authentication rate limits | Rotating IPs, mixed login/registration, both membership types, failing transactions, account isolation and expired-budget recovery passed |
| Role browser audit | 22 checks passed: four roles, direct URL/API permissions, scoped edits, referral copy, payouts, staff protection, Trash/restore and responsive layouts at 320/768/1280/1600px |
| Admin accessibility checks | 13 mobile admin pages had no solid-color text-contrast failures; network recovery, dialog focus trapping, receipt/dashboard exits passed |
| Public pages | 25 page/viewport checks passed at 320/390/768/1280/1600px with no horizontal overflow or browser errors; five public pages had no solid-color text-contrast failures |
| Mobile menu | Eight reduced-motion on/off scenarios passed, including short screens; Escape closes the menu and returns focus |
| Membership browser | Passed: both forms, fees, six crops, keyboard/plot controls, referral preservation, admin filter, owner prefill and menu visibility/focus |
| Source/client secret scan | 384 publishable source/client files checked against six configured private values and private-key markers; no matches |
| Optional tooling | JavaScript syntax/lint, Python AST parsing and generated-path ignore checks passed |

Browser screenshots and structured results remain in the ignored integration .audit directory. Visual inspection covered the homepage participation section, mobile login, focused registration, desktop admin overview and mobile payment detail. Public controls use the same font stack, warm background, green primary color and 8px control radius. The menu test now waits for React's visible state and verifies closing/focus, without changing product behavior.

## Hosted security checks

Read-only checks on ganpati-agro-v2 found no tables lacking RLS, no direct table privileges for anon/authenticated, no exposed privileged routines and no unsafe security-definer search paths. Both membership fee RPCs returned the expected 50000/250000 paise, and the hosted migration ledger includes the focused membership migration.

Supabase advisors reported informational findings only: 28 RLS-enabled tables without policies (intentional deny-by-default service-only access) and 20 unused indexes. No access policies or indexes were removed to silence these notices.

The code review covered signed-session authorization, employee scope, audited Aadhaar reveal, PII handling, body/origin validation, captured-payment amount/currency checks, immutable financial history and shared-profile deletion. One confirmed account-throttling issue was fixed; no additional critical authorization/payment bypass was identified within this review.

## Reproducing the checks

Use the normal required npm scripts. For SQL/HTTP/browser tests, use an isolated loopback PostgreSQL database with the bootstrap, ordered migrations and geography seed from the production runbook. Set TEST_DATABASE_URL and PSQL_PATH. npm run test:http includes the new registration-rate-limit HTTP suite. For the full role UI review, set UI_REVIEW_ONLY=1 on a fresh isolated fixture database; MEMBERSHIP_BROWSER_ONLY=1 runs just the focused membership HTTP/browser journey. Install Playwright Chromium first.

All synthetic customer, role, payment and payout tests were isolated; no real payment was charged and no hosted customer record was created. Local PostgreSQL is only a verification dependency, not a requirement to run the app against hosted Supabase. Automated contrast checks exclude images, gradients, transparency and disabled controls; this is not a complete accessibility certification or penetration test.
