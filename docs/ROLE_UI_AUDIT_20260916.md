# Role & UI audit — 16 September 2026

## Scope and evidence

Pre-remediation inspection of the current working tree. Read AGENTS.md, roles/business rules, decisions, admin workspace documentation, architecture, brand guidance, and the 15 September security/UX report. Existing uncommitted security/payment changes belong to the main thread and are retained. This audit does not deploy, change hosted data, add permissions, or build a new administration product.

Permissions were traced separately through `src/server/session.ts`, all admin/farmer API handlers, and the latest definitions of `get_dashboard`, `get_admin_workspace`, `get_admin_page`, `get_admin_record`, `get_admin_registration`, `get_farmer_detail`, `update_farmer_profile`, staff, grant, payout and deletion RPCs. Browser verification follows the fixes; this initial report is source evidence, not a claim of browser acceptance.

`USER` is not a stored role: accounts with no staff role have no staff access; activated farmer referrers use `farmer_referrer`. Role arrays can combine permissions. Super-admin-only restrictions remain explicit. Browser roles cannot call these service-only RPCs; application sessions resolve a current active account. RLS alone is not the authorization mechanism for server calls ([Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)).

## Role matrix

| Role | Page/module | View and data scope | Create | Edit | Delete/archive | Special actions |
|---|---|---|---|---|---|---|
| Public / USER | Home, register, login, referral alias, policies | Public content; checkout/receipt by capability | Self-registration | Unsaved form | No | Pay/resume own checkout; open capability receipt |
| USER / FARMER_REFERRER | Dashboard | Own referral code, totals, latest 10 earnings and payouts when a profile exists | Share referral / self-registration | Own password | No | Copy referral link, logout; no payout claims |
| USER / FARMER_REFERRER | Farmer detail, admin and lookups | No access | No | No | No | Referral earnings do not authorize referred farmer profiles |
| EMPLOYEE | Dashboard and registration | Own completed (latest 20) and pending (latest 20) onboardings; own cash-pending count and referral balances | Assisted registration, cash declaration and online payment | Unsaved form | No | Original checkout recovery; own referral sharing |
| EMPLOYEE | Farmer detail | Only own onboarded farmer; masked mobile and plots | No | Only fields in an unexpired, unrevoked grant | No | No membership/payment/identifier edits |
| EMPLOYEE | Admin, staff, payouts, grants, exceptions | No access | No | No | No | Own account password/logout only |
| MANAGER | Admin overview/registrations/details | Global operational records; farmer mobiles masked | Assisted registration | Seven allowed farmer profile fields | No Trash/restore/purge | Provider reconciliation; original receipt access |
| MANAGER | Team | Employee/manager names, staff mobiles, roles, status and onboarding counts | No | No account administration | No | Oversight only; staff mobile visibility is permitted by existing RPC |
| MANAGER | Referrers/payouts/grants/activity/exceptions | Global operational balances/history, edit grants and audit/event metadata | Record already-disbursed payout; grant scoped employee edit | No financial history edits | Revoke grants only | No Aadhaar reveal, staff roles or system settings |
| SUPER_ADMIN | All management modules | Same operational scope plus full farmer mobile; explicitly authorized Aadhaar reveal | Staff (employee/manager), registrations, payouts, grants | Farmer allowed fields; staff active/disabled | Trash/restore; password-confirmed permanent personal-data deletion with existing blockers | Reveal/hide Aadhaar, selected-row CSV, session-revoking staff disable |
| MANAGER / SUPER_ADMIN | Personal dashboard/account | Own referral and onboarding information remains available separately | Own assisted registrations | Own password | No own account deletion | Logout; higher role does not confer a different referral balance |

No employee detail/edit-role screen, fee configuration UI, farmer self-profile page, claims, company cash settlement, refund editor, or system configuration screen exists. Do not invent these permissions or pretend they are tested. Super admins cannot disable themselves or any account carrying `super_admin`; the database rejects those targets.

## Navigation matrix before fixes

| Surface | USER/referrer | Employee | Manager | Super admin |
|---|---|---|---|---|
| Login destination | Shared dashboard | Shared dashboard | Shared dashboard, then admin callout | Shared dashboard, then admin callout |
| Personal dashboard | Referral link, password, logout | Same plus own farmers/register | Same plus global total/admin link | Same plus global total/admin link |
| Admin sidebar/mobile | Hidden; server denied | Hidden; server denied | Overview, registrations, team, balances, payouts, grants, exceptions, activity, account | Same plus Trash |
| Admin creation actions | None | None | Payout and grant | Staff, payout and grant |
| Farmer detail back | No access | Dashboard | Dashboard (loses admin context) | Dashboard (loses admin context) |
| Admin task cancel | No access | No access | Browser history, possibly external/dead end | Browser history, possibly external/dead end |

## Ranked findings before implementation

| ID | Severity | Finding and source | Remediation |
|---|---|---|---|
| R01 | MEDIUM | Manager sees “Manage team” and “Manage employee and manager accounts”, although server permits oversight only (`navigation.ts`, admin overview, dashboard callout). | Role-specific labels/descriptions from one navigation definition. |
| R02 | MEDIUM | Management lands on accumulated employee/referrer cards; pending employee work appears after referral history (`dashboard/page.tsx`). Admin sidebar has no path to own referral dashboard. | Management lands on operations; keep explicit personal dashboard link; employee pending work first. |
| R03 | MEDIUM | Direct manager Trash/staff-create URL produces generic loading failure rather than clear route rejection; staff rows with a super-admin role can expose actions the database rejects. | Gate pages before RPC; exclude protected staff targets from activation selection/actions. |
| R04 | MEDIUM | Farmer edit leaves workspace, points back to generic dashboard; task Cancel uses browser history; registration list filters lost on detail/back (`farmers/[id]`, `AdminConsole`, `AdminRecords`). | Deterministic role-relevant return paths; preserve validated same-origin list context. |
| R05 | MEDIUM | Table uses Status for payout method and audit entity; search placeholder promises unsupported fields in payouts/grants/exceptions; empty copy is identical everywhere. | Accurate per-module table labels, search hints and empty messages. |
| R06 | MEDIUM | All selection/bulk success lives in the button that gets unmounted when selection clears; destructive dialog confirm looks routine; dialogs have no explicit accessible name (`AdminBulkButton`). | Persistent parent success announcement, named dialogs, destructive confirmation styling, affected name for single-row actions. |
| R07 | MEDIUM | Admin mobile menu has no Escape/focus restoration; payment detail highlights Overview; small/low-contrast secondary labels and long identifiers can harm keyboard/mobile use. | Correct active route mapping, disclosure keyboard handling, focused contrast/touch/wrapping fixes. |
| R08 | LOW | Financial detail uses generic panel/buttons instead of admin record sections; repeated headings/status logic differs across pages. | Small shared page heading and status helpers; reuse current record CSS. |
| R09 | MEDIUM | Grant form can submit without selecting any editable field; lookup retains old selection while search text changes; task field errors are not focused. | Validate at least one grant field; invalidate changed lookups; focus safe server-named fields. |
| R10 | LOW | Ordinary farmer read uses disabled editable-looking fields; profile failure uses the same green feedback as success, no cancel. | Explain grant requirement; distinguish success/error; deterministic cancel; retain viewable fields. |
| R11 | LOW | Admin filter submission has no explicit pending affordance, dates/page-size closed even when active; page-size reset not shown. | Next navigation form with pending feedback; show active advanced filters; keep scoped GET URLs. |
| R12 | IMPROVEMENT | Employee/referrer histories are capped without full history pages; staff has no detail/edit workflow, overview lacks actual team-workload metric. | Mark current limits clearly; defer new RPCs/modules, do not fabricate counts or broaden permissions. |

No new HIGH unauthorized-functionality exploit established by source inspection. Existing security report’s hosted-payment/fee launch gates remain separate from cosmetic UX severity.

## Screens/components inspected

Public home/navigation, registration and saved checkout, login, receipt and referral alias; personal dashboard and farmer profile; all nine admin sections; registration Profile/Payments/Activity tabs; retained financial detail; staff/payout/grant creation; account/password; loading/error/not-found paths; action dialogs, Aadhaar reveal, lookup and selected CSV. Existing payment snapshots, PII hiding and grant scope are preserved.

## Small shared components and implementation phases

1. Extend existing navigation metadata with roles/groups/module copy and active-route resolver. Keep server/database guards independent. Correct role visibility and landing pages.
2. Fix contextual returns, selection/action feedback and form mistakes before visual work.
3. Share only genuinely repeated heading/status patterns; retain existing cards, table and native dialog. Improve accurate labels, empty states and filtering feedback.
4. Apply focused responsive/keyboard/contrast fixes. Test synthetic role journeys, denied URLs/APIs, pending/success/error and mobile/tablet/desktop. Run lint, typecheck, application tests and isolated production build.

Use a separate local build/test directory and test-owned processes to avoid overwriting the main thread’s `.next` output. No deployment or hosted mutations. Final evidence and explicit remaining gaps will be recorded in a separate remediation report.
