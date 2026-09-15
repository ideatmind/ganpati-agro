# Role-based UX remediation report — 16 September 2026

## Outcome and scope

Targeted local changes preserve the current business rules, permissions, bilingual registration form and brand. No new roles, database permissions, financial operations, migrations or external deployment were introduced. Existing security/payment remediation in the shared working tree was retained. This report covers this role/UI audit only; its baseline and complete permission/navigation matrices are in [the pre-change audit](ROLE_UI_AUDIT_20260916.md).

## Pages reviewed

| Area | Screens / states |
|---|---|
| Public/account | Home/menu, login, registration/saved checkout, referral alias, receipt, password feedback |
| Personal dashboard | Referrer earnings/payouts, employee own farmers and pending cash/payment queue, management personal view |
| Farmer | Own/authorized detail, read only, granted fields, edit success/denial, unavailable record |
| Operations | Overview; registrations; team; referral balances; payout history; edit permissions; payment exceptions; activity; Trash |
| Details | Registration Profile/Payments/Activity; retained financial history; original receipt |
| Administration | Create employee/manager, record offline payout, grant/revoke edit access, activate/deactivate, Trash/restore, existing permanent-delete confirmation, Aadhaar reveal controls, account/password |
| Shared states | Navigation, filters, responsive tables, empty/loading/error, confirmations, network failure, action success |

Staff detail/edit-role, system configuration, complete personal history, claims, refunds and company cash settlement remain outside the implemented product. The audit did not manufacture these modules.

## Navigation and role visibility

- Management now opens `/dashboard/admin` after login. `/dashboard?personal=1` preserves personal referrals and onboarding work. The sidebar provides this route explicitly.
- Desktop and mobile use the same role-filtered navigation metadata. Modules are grouped into Operations, Referrals, Team, Administration and My account.
- Manager team navigation says **Team activity** and explains its oversight scope. Staff creation, activation controls for protected accounts, Trash and Aadhaar remain hidden where unauthorized. Direct manager staff-creation/Trash URLs return to allowed views before calling a denied RPC.
- Super-admin/current-account staff targets are omitted from selectable/actionable targets; database checks remain independent.
- Payment detail correctly highlights Payment exceptions. Mobile disclosure supports Escape and focus return; it remains a disclosure, not a modal.
- Registration detail preserves validated list filters through tabs and farmer editing. Task Cancel has a deterministic list destination. Farmer, receipt and signed-in registration screens have usable exit links; unavailable records provide recovery navigation.

## Dashboard, tables, forms and feedback

- Employee pending onboardings/cash count appear before earnings history. Own farmer and pending sections have quick links and explicit latest-20 limits. Personal management views no longer add a global farmer-total card to personal balances.
- Tables distinguish payout **Method** and audit **Entity** from actual status. Each module has accurate search hints and a specific empty state. Existing registration filtering, sorting and pagination remain server-bounded.
- Filters use Next `Form` navigation with pending feedback; active date/page-size controls remain open and page-size changes can be reset.
- Bulk success lives above the table and survives refreshed rows; clearing selection returns focus to page selection. Actions announce moved to Trash, restored, activated, deactivated or revoked rather than a generic update.
- Destructive confirmation buttons use destructive styling. Dialogs have accessible names, single-record names when known, consequences, explicit Tab/Shift+Tab wrapping, Escape cancellation and focus return. Existing password-confirmed permanent deletion and financial-retention wording remain intact.
- Payout recording confirms the exact recipient and amount and retains the existing offline-disbursement checkbox and idempotent response-loss recovery.
- Grant submission requires at least one editable field before sending a request. Changing lookup text invalidates previous selection; stale responses cannot replace current results. Server field errors focus the relevant input when available.
- Farmer forms explain read-only access, show failure separately from green success, require a valid name, and provide Cancel/Save actions. Viewable profile fields remain visible; no extra editable scope was granted.

## Shared components and visual changes

Added only three small shared presentation components: `AdminPageHeading`, `StatusBadge`, and `AdminFilterSubmit`. Extended existing navigation metadata and added a validated list-return helper. Existing table, form, record-panel and native-dialog structures were reused; no UI library was installed.

Financial detail now uses the same admin headings, panels and status badges. Secondary text and back links use readable colors. Mobile action targets and disclosure spacing were improved; long headings/provider IDs wrap; confirmation dialogs fit the viewport. Self-hosted fonts and existing brand colors are retained.

## Verification

Verification used synthetic records, a dedicated loopback PostgreSQL cluster on port 54333, a service-role RPC bridge, and a separate production build at `.audit/role-ui-verification`. The main thread's `.next` and database/processes were not restarted or overwritten. Browser checks use actual application login cookies, API handlers and database RPCs; no real Razorpay charge was attempted.

| Check | Evidence |
|---|---|
| `npm run lint` | Zero errors/warnings in completed run |
| `npm run typecheck` | Passed |
| `npm test` | 34 application/security tests passed, including two new role-navigation/return-path tests |
| `npm run build` | Isolated Next.js 16.3.3 production build passed |
| `npm run test:db` | All five existing SQL regression suites passed on the dedicated local cluster |
| Role browser journeys | `tests/role-ui-browser.mjs`: four roles, denied URLs/APIs, actual profile edit/grant/payout/Trash/restore, filtered returns, copy feedback and keyboard navigation |
| Responsive matrix | 132 role/page/viewport combinations at 320, 768, 1280 and 1600 pixels; checks wait for final content rather than loading placeholders |
| Supplemental checks | `tests/role-ui-accessibility.mjs`: solid-color text contrast on 13 mobile admin pages, staff network failure/retry/create/deactivate, modal focus wrapping and public-flow exits |
| Visual inspection | Mobile financial detail and desktop overview screenshots inspected |

Raw local evidence: `.audit/role-ui-results/results.json`, `accessibility.json`, `mobile-payment.png`, and `desktop-overview.png`. These are synthetic local artifacts, not production acceptance evidence.

Final browser result: **22 role checks and all five supplemental groups passed**, including 132 responsive combinations. Both runs recorded zero browser page errors. The final 13-page solid-color text contrast scan recorded zero failures. Native confirmation focus wrapping passed in both directions. `git diff --check` also passed. Test-owned app/bridge processes and the dedicated database server were stopped after verification; disposable data and screenshots remain for inspection.

The audit found and fixed a dialog keyboard-loop defect during browser testing. The test bridge also needed to preserve the existing allowlisted field-permission denial so it could test the production 403 mapping. A screenshot check caught an early loading-state capture; final browser assertions explicitly wait for rendered headings, and the contrast scan excludes decorative `aria-hidden` text.

## Repeating the browser checks

1. Use a **fresh isolated loopback PostgreSQL database** with the repository's ordered migrations and `supabase/seeds/geography.sql`. Install required roles/extensions with `tests/database-bootstrap.sql` only on a fresh vanilla local cluster. Do not use the unrelated development seed; it currently references unqualified `gen_salt` and is unnecessary for these fixtures.
2. Seed `tests/support/role-ui.sql` once. It creates synthetic accounts and verified-payment fixtures. The tests intentionally mutate this disposable dataset and should not be rerun against customer data.
3. Build the app; run it with the existing local RPC bridge and synthetic session/provider environment as in `tests/run-http-e2e.mjs`. Set `TEST_APP_URL`, `TEST_DATABASE_URL`, and `PSQL_PATH`. Both browser scripts reject non-loopback targets. Set `PLAYWRIGHT_MODULE`/`PLAYWRIGHT_EXECUTABLE` if using a bundled browser runtime rather than a locally installed Playwright package.
4. Run `node tests/role-ui-browser.mjs`, followed by `node tests/role-ui-accessibility.mjs`. Create `.audit/role-ui-results` when running the supplemental script independently. Role fixtures start with password `role test password`, exclusively for the disposable test environment.

## Remaining usability and acceptance limits

- Personal earnings/payouts show the latest 10; own completed/pending onboarding lists show the latest 20. Full employee/referrer history and more operational filters need dedicated query/UI work. These limits are now visible rather than implied to be complete history.
- Staff management currently supports creation and active/disabled status. There is no employee detail screen, staff attribute editor, or reassignment of existing roles. No new permission was inferred to fill that product gap.
- Management and super-admin overview share currently available operational metrics; the super-admin distinction is in authorized actions and navigation. Team-workload/global cash metrics were not fabricated or inferred from personal counts.
- Farmer editing retains the existing general dashboard shell; deterministic return links address the workflow break. A complete visual shell consolidation would be a broader refactor.
- Automated Chromium checks do not establish full WCAG compliance. Real screen readers, Safari/iOS/Android, browser chrome focus behavior, zoom/magnification, contrast over gradients/images and real payment-app return remain manual acceptance work.
- Existing hosted ₹1 trial/payment configuration, production migrations and real captured-checkout acceptance remain governed by the security audit and release runbook. This audit does not certify production payment readiness or change the hosted fee.

R01–R11 received targeted remediation; R12 remains the bounded product-scope follow-up described above. No claim is made that every role experience is perfect.
