# Audit release — 16 September 2026

The admin security and role-based UI changes are integrated with GitHub's live-only ₹1 checkout release. Production test checkout, demo controls and old test checkout capabilities remain disabled. Registration reads the effective database fee and checks the displayed expectation atomically; existing ₹500 snapshots remain unchanged.

## Hosted database

Applied to `ganpati-agro-v2` (`pryknxknjbwypdudtryz`) after an encrypted backup and isolated migration rehearsal:

| Migration | Repository version | Hosted version |
|---|---|---|
| `admin_permanent_delete` | `20260915090000` | `20260915192133` |
| `audit_financial_controls` | `20260915190000` | `20260915192254` |

The hosted ledger now contains 18 migrations. Its previously applied `live_trial_fee` version is `20260914205349`; the corresponding repository file is `20260914203610_live_trial_fee.sql`. Names and SQL contents were compared before applying the two missing migrations. Do not replay migrations solely because timestamp prefixes differ.

The effective fee remains 100 paise. Before/after counts are unchanged: 14 accounts, persons, registrations and orders; 4 farmers, memberships, captured payment records and receipts; 0 referral earnings or payouts. Aggregate profile and credential checksums are unchanged, and no accounts were erased. Schema deployment did not run the permanent-delete operation.

Post-migration checks found no public RPC execution exposure, no exposed tables without RLS and no direct service-role financial UPDATE/DELETE/TRUNCATE grants. The security advisor reported only informational deny-by-default tables with RLS and no policies, with no warnings or errors.

The encrypted backup and Windows-user-protected key are local ignored files under `.audit`; neither is published. A backup restore was not exercised during this publication.

## Behavior and scope

Super-admins can permanently erase selected trashed personal profiles after current-password confirmation. The operation removes personal/Aadhaar/plot/session data and disables account access while preserving immutable accounting links and original receipt history. Unresolved checkout/cash records and staff accounts remain blocked. This does not erase all financial history or historical backups.

Managers and super-admins land in operations. Navigation, return paths, list actions, mobile menus, form feedback and protected-role visibility follow the role matrix. Detailed UI evidence and remaining limitations are in [the remediation report](ROLE_UI_REMEDIATION_20260916.md).

The publication was assembled in a separate Git worktree so the main task's uncommitted working files and index remain intact. This release record supersedes earlier audit statements that these two migrations were unapplied, that the trial-fee migration lacked a repository counterpart, or that the public payment-mode switch remained enabled.

Real Razorpay captured-payment acceptance and production deployment verification remain separate from the isolated regression checks.

## Integrated validation

- `npm run lint`, `npm run typecheck`, `npm test` (35 tests), and `npm run build` passed in an isolated copy of the merged source.
- `npm run test:db`: all six suites passed after applying all 18 repository migrations to a fresh local database. Historical-fee fixtures explicitly set ₹500 within rolled-back transactions; trial-fee and stale-price tests verify ₹1 and snapshot preservation.
- `npm run test:concurrency`: twelve concurrent order reservations/captures produce one membership and receipt; concurrent erasure retries with duplicate capture preserve accounting and record one erasure event. Capture fixtures use the actual registration fee snapshot.
- `npm run test:http`: authenticated registration, live-only checkout, old test-cookie rejection, stale-price rejection, capture deduplication, password-confirmed permanent deletion, retained finance access and session revocation passed with a synthetic provider.
- Both role browser scripts passed on the merged production build: 22 journey groups and 132 role/page/viewport combinations, plus five supplemental groups. Thirteen mobile admin pages had no failures in the scoped solid-color text contrast check. No browser page errors were reported.

Integrated browser evidence is stored locally in `.audit/integrated-verification/.audit/role-ui-results`. These checks use synthetic fixtures and do not certify a real payment or full WCAG conformance.
