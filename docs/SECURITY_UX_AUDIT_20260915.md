# SECURITY & UX AUDIT REPORT — 15 September 2026

## Inspection report before fixes

Scope: current working tree, all application routes/components/validation/server modules, ordered migrations, prior business/architecture/brand/release documentation, reachable Git history, and read-only hosted Supabase metadata. [Architecture, route and table matrix](AUDIT_20260915_MAP.md). No remote data has been modified. The original ₹500 rule takes precedence over example ₹100 amounts in the checklist; hosted ₹1 trial drift is explicitly unresolved.

Severity describes actual impact and reachability. No new CRITICAL browser authentication/payment bypass was established. A clean dependency audit or RLS advisor does not establish overall security.

## Top 10 issues to fix first

| ID | Severity | Finding / location | Failure or abuse / why it matters | Recommended fix | Tests needed |
|---|---|---|---|---|---|
| F01 | HIGH | Hosted ₹1 fee conflicts with fixed ₹500 registration/cash labels (`RegistrationForm.tsx`, `fee_versions`, remote `live_trial_fee`) | Farmer/employee sees a different fee from trusted checkout; cash declaration can be misleading | Display trusted current fee; preserve existing snapshots; owner resolves live fee before launch | Fee variation API/UI/DB tests |
| F02 | HIGH launch gate | Trial controls and real launch configuration (`payment-mode.ts`, `RegistrationForm.tsx`, runbook) | Public test mode creates valid test memberships in shared database by explicit prelaunch decision; not proof of real payment | Keep trial behavior as authorized; restrict demo helper to trial/nonproduction; disable switch and reconcile test dataset before launch | Production gating and manual Razorpay acceptance |
| F03 | MEDIUM | Cash/orders/events/allocation immutability weaker than ledger (`0001_initial_schema`, auth hardening) | A privileged service write or later faulty RPC can silently change/delete cash amount/order binding/webhook evidence | Revoke direct financial writes; triggers preserve original evidence, allowing only existing processing fields; no invented settlement flow | SQL tamper attempts and payment regressions |
| F04 | MEDIUM | Purge hides retained earnings/details (`get_dashboard`, `get_admin_registration`) | Inner person joins drop credited entries and block management reconciliation after profile erasure | Keep anonymized earnings and separate finance-only reads/page for erased registrations | Purge, late capture, scoped reads |
| F05 | MEDIUM | Names accept digits/emoji/control symbols (`registration/schema`, `profile-schema`, staff route) | Garbage identity data persists into receipts; weak input UX | Shared Unicode-aware name normalization/validation, sensible punctuation, no ASCII-only rule | Marathi, apostrophe, hyphen, initials, bad symbols |
| F06 | MEDIUM | API schema failures are generic and profile constraints missing in UI (`http.ts`, `FarmerProfileForm`) | User cannot locate rejected field; typo retry friction | Return safe allowlisted field guidance (never values); share client constraints and focus invalid field | Field errors, no PII leakage |
| F07 | MEDIUM | Payout retry stores key without payload (`AdminConsole`) | Lost response + changed/reloaded form causes persistent idempotency conflict; operator may accidentally start a second disbursement record | Preserve exact pending payout payload and provide explicit retry/recovery; no automatic new key | Network response-loss retry |
| F08 | MEDIUM | Employee cash-pending count never rendered (`dashboard/page`, `get_dashboard`) | Employee can leave collected cash unpaid without a visible queue, especially after refresh | Show own pending registration/cash records and recovery instructions; never widen employee scope | Own versus other employee pending records |
| F09 | MEDIUM | Farmer page catches database outage as 404; stale checkout cannot recover (`farmers/[id]/page`, RegistrationForm) | Outage looks like deleted data; erased checkout cookie traps retry | Distinguish forbidden/not-found from availability errors; clear nonexistent checkout capability safely | Failure/expired/deleted checkout flows |
| F10 | LOW | Mobile menu keyboard handling, unlabeled honeypot and copy/success feedback (`MarketingNav`, forms, DashboardActions) | Keyboard/assistive-tech users lack complete feedback; visible UI is not enough | Escape close/focus return, controls association, hide honeypot from accessibility tree, live success | Browser keyboard/mobile/axe checks |

## Additional findings by audit area

- **Security / authentication:** Current signed HMAC cookies, HttpOnly/SameSite, database expiration/revocation, generic login errors and bcrypt dummy work are present. Mobile uniqueness can still be inferred from registration conflict; LOW residual enumeration tradeoff. No account-recovery UI or MFA exists; explicitly deferred by current MVP decisions. Manual support recovery and secret rotation ownership remain operational requirements.
- **Supabase/RLS:** All 28 hosted application tables deny browser reads/writes and all privileged RPCs deny anon/authenticated execution. Advisor returns INFO only for intentionally absent policies. Service-role CRUD on much of public is broader than the RPC architecture needs (F03). Privileged functions use empty search_path and qualified table names. Live/local migrations differ (F01/F02/F04).
- **Payments:** Server amount/currency/order binding, capture verification, raw webhook HMAC, idempotent finalization and durable failed events are implemented. Real hosted Checkout, app return, configured live merchant keys/capture/webhook retries remain **HIGH readiness gaps**, not established signature bypasses. Test/live secret fallback is not strictly paired by mode (`payment-mode.ts`): MEDIUM configuration reliability defect; pair keys explicitly. Reconciliation uses only first 100 provider payments: LOW scale limit requiring pagination if reached. Receipt links are bearer capabilities; treat as confidential.
- **Cash accounting:** No employee/company settlement exists by design. Cash alone never completes payment. Same-registration unique collection and actor derived from session exist. F03/F08 apply. Current payout recorder uses aggregate earnings minus payouts, not `payout_allocations`; older docs imply allocations/corrections implemented when they are not. Correct documentation; do not invent a claims/refund product.
- **API:** Body bytes, JSON content type, bounded input, fixed-origin proxy CSRF and rate limits exist. Unknown keys are usually stripped, not assigned; strict profile edits reject them. F06 applies. Public receipt GETs are not throttled (LOW resource-abuse residual; UUIDs prevent practical enumeration). Server-side actor always comes from session. No server actions or arbitrary SQL input path exists.
- **Storage:** Not applicable: no uploads or hosted buckets. Static public brand/geography assets are not private documents. Re-audit before adding uploads; do not mark nonexistent storage flow as passed.
- **Input validation:** Exact 10/12 ASCII digits are the owner's rule; do not silently restrict mobile prefix or add PIN/PAN/email fields. Names F05, free notes bounded/React escaped, geography and crop enums validated. Acreage accepts excess precision that numeric(10,2) rounds (MEDIUM): enforce 0.01-acre precision at server boundary. Referral input lacks format check and malformed query is made read-only (LOW): validate format and allow correction. See field matrix.
- **UX / screen flow:** Loading/error/empty states exist across major pages; cash pending, stale checkout, field feedback and admin success remain gaps. Documented `/r/{code}` route is absent (LOW); generated `/register?ref=` works. Add safe alias or correct documented flow. KSK, approval, settlement, uploads, notifications are out of scope, not missing implemented screens.
- **Accessibility:** Reduced motion, self-hosted Devanagari fonts, focus rules, keyboard crop/village controls and video pause exist. Mobile menu and honeypot F10. Contrast, screen reader and actual iOS/Android/payment-app testing remain required; no WCAG certification claimed.
- **Data integrity:** Unique identifiers, transaction capture locks, snapshotted fees/rates, payout idempotency and scoped updates exist. Profile edit/purge lock ordering can deadlock (MEDIUM availability): align row-lock order while preserving rollback. Frozen fee/referral history and disabled accounts must remain protected in changes.
- **Audit logging:** Immutable audit actor/action/entity/time plus field names avoids Aadhaar. Profile edits do not record old/new PII by design; grant/archive reasons are retained on their records. Restore deletes the archive reason, leaving only an action audit (LOW retention gap): preserve the reason in a private operational history or audit-safe reason category if required; never copy arbitrary sensitive text into audit. Failed logins are aggregate runtime events, not durable per-person audit entries.
- **Performance/reliability:** Server timeouts and bounded admin lists exist. Employee/referrer history only exposes latest 20/10 (LOW completeness limitation). CSP allows unsafe-inline for Next bootstrap (MEDIUM defense-in-depth residual); nonce conversion needs scoped performance review, not giant rewrite. Monitoring alerts, isolated staging, production recovery drill and published release gates remain unverified. Existing backup evidence is historical, not a new restore test of hosted data.

## Fix execution log

Inspection and the initial report preceded incremental fixes. Completed 16 September 2026 (Asia/Kolkata). Existing uncommitted form/payment/Trash work was preserved; no deployment, hosted mutation, real charge or payout was performed.

| Finding | Local outcome | Evidence / remaining dependency |
|---|---|---|
| F01 | Fixed fee display and atomic expected-fee check; existing checkout snapshots retained | SQL and HTTP reject stale price; browser displays a synthetic ₹1 fee. Hosted price decision remains HIGH launch gate |
| F02 | Demo helper gated to trial/nonproduction; explicit key and secret pairing | Mode unit tests and production-browser helper check. Owner-approved trial switch/dataset and real gateway configuration remain launch gates |
| F03 | Added service-write revocations and immutable cash/allocation/original order-event evidence triggers | SQL rejects tampering and paid downgrades; payment tests remain green |
| F04 | Added separate management finance page and anonymized retained earnings using left joins | SQL/HTTP verify finance access after erasure, employee denial and preserved duplicate/late capture behavior |
| F05 | Shared Unicode/NFC name rules and client blur feedback | Marathi/initials/apostrophe/hyphen accepted; digits/emoji/repeated punctuation rejected |
| F06 | Allowlisted field guidance without rejected values; aligned form limits/focus and submit guards | Unit/HTTP tests plus browser input checks |
| F07 | Account-scoped session storage preserves exact payout UUID/payload and explicit retry | Unit tests and intercepted browser response prove the same body/key is retried; database payout idempotency tested separately |
| F08 | Own pending registration/cash queue and original-checkout recovery instructions | SQL verifies ownership; mobile dashboard renders without overflow |
| F09 | Actual outages propagate to error state; missing checkout capability clears safely; network failure keeps input and allows retry | HTTP/SQL flows and browser aborted-request check |
| F10 | Mobile menu focus/Escape and hidden-state visibility, honeypot accessibility, copy/admin success status; existing green CTA restores measured contrast | Keyboard/browser checks and limited contrast scan. Full assistive-tech assessment remains open |

Also fixed: server acreage precision/coercion, referral format and editable correction, missing referral-link alias, profile/purge lock order, explicit payment-secret pairing and hiding an Aadhaar reveal response that arrives after the document is hidden. Corrected cash/referral documentation that implied allocation/correction features existed. No settlement, claims, KSK, upload, MFA or recovery architecture was added.

The incremental SQL release is `supabase/migrations/20260915190000_audit_financial_controls.sql`, following `20260915090000_admin_permanent_delete.sql`. Both remain local. Financial retention is deliberate: personal profile erasure is not deletion of issued receipts, historical payment evidence or backups.

## Final readiness assessment

**Not cleared for public real-money launch.** The inspected application has layered server/database authorization and substantially improved local validation and recovery, with no confirmed new CRITICAL exploit in the reviewed scope. Automated results support particular controls; they do not establish that the whole application is secure. A numerical score would obscure the unverified release gates below.

**Remaining CRITICAL:** none confirmed within the inspection and test scope. This is not a claim that none exist. No confirmed secret exposure was found, so no emergency rotation finding is asserted.

**Remaining HIGH:** hosted ₹1 trial pricing versus the ₹500 initial business fee needs an owner decision; the approved shared-database test mode/dataset needs launch handling; the two local migrations/application must be coordinated with the divergent hosted ledger; real Razorpay merchant configuration and capture/webhook/app-return acceptance remain unverified. These are readiness/configuration risks, not evidence that a browser can forge a payment.

| Open finding / severity | Location | Why it matters / failure scenario | Recommendation | Verification needed |
|---|---|---|---|---|
| H01 HIGH — launch pricing | Hosted `fee_versions` / `live_trial_fee`; registration pricing | Current ₹1 can be a real charge if live mode is selected; displaying it correctly does not authorize launch pricing | Owner confirms intended price; apply a separately reviewed effective fee change if required, preserving old snapshots | Hosted fee read, form/order/receipt agreement |
| H02 HIGH — trial and release coordination | Payment-mode env, hosted ledger, two local migrations | Trial records can be mistaken for real collections; deploying callers without RPCs breaks registration/deletion | Disable trial switch for public launch, reconcile approved test data without silent financial deletion, back up and release schema/app together | Migration comparison, staged rehearsal and hosted smoke |
| H03 HIGH — real gateway acceptance | Razorpay dashboard, hosted Checkout/webhook/reconcile | Local simulated success does not prove live merchant keys, capture, delivery or mobile return | Confirm keys/secrets, subscriptions and capture settings; exercise success/cancel/failure/response loss on authorized real gateway | Razorpay dashboard review and desktop/Android/iPhone acceptance |
| M01 MEDIUM — operational evidence | Deployment/monitoring/runbook | Missing alerts or unavailable restore credentials can turn an incident into prolonged loss | Establish owners, isolated staging, trusted IP/edge limits, alerts and managed restore drill | Alert delivery and production recovery rehearsal; historical backup evidence is insufficient |
| M02 MEDIUM — inline CSP allowance | `next.config.ts` | `unsafe-inline` reduces defense in depth if another HTML/script injection is introduced | Evaluate nonce-based CSP in a scoped change with caching/Next bootstrap review | Browser CSP, payment SDK and performance regression |
| L01 LOW — bounded history | Dashboard RPC; provider reconciliation | Recent 10/20 lists and first 100 provider payments can omit older records at scale | Add pagination/filtering where operational volume requires it | Large fixtures and pagination/authorization tests |
| L02 LOW — receipt resource abuse | Receipt page/API GET | Confidential bearer UUID resists enumeration, but repeated known-token requests can consume resources | Add an appropriate edge/request budget without breaking legitimate receipts | Burst/print/link access tests |
| L03 LOW — archive reason retention | Archive/restore RPC | Restore removes the archive record/reason; action audit remains but original rationale is lost | If retention is required, retain private operational history or a safe reason category without copying arbitrary PII into audit | Restore/audit privacy test |
| L04 LOW — registration enumeration | Registration conflict response | An attacker can infer that an exact mobile/Aadhaar already exists through conflict behavior | Review UX/privacy tradeoff and observe throttling; avoid exposing more identifiers | Abuse-rate and response-consistency review |
| I01 IMPROVEMENT — support recovery/MFA | Custom account auth and runbook | MVP deliberately lacks self-service reset/MFA; support must handle account loss securely | Document authorized recovery and credential rotation ownership; assess MFA separately under agreed scope | Manual support exercise and any future auth-focused tests |
| I02 IMPROVEMENT — full accessibility assurance | Public/operations UI and hosted Checkout | Chromium keyboard/layout checks do not cover screen readers, all contrast backgrounds or mobile assistive tech | Manual WCAG AA review and external payment accessibility acceptance | Screen reader, zoom, high contrast, reduced motion and actual devices |

### Database and RLS

Read-only hosted metadata showed 23 public and five private application tables, all with RLS enabled, no application policies, no anon/authenticated direct table access and no publicly executable privileged security-definer RPC. The table-by-table SELECT/INSERT/UPDATE/DELETE and intended/current access matrix is in the [map](AUDIT_20260915_MAP.md). This is a server-only architecture with intentional browser denial, not a Supabase Auth per-user policy architecture. Service credentials remain a powerful trust boundary and must stay server-only. This design follows Supabase's [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [function privilege guidance](https://supabase.com/docs/guides/database/functions).

Hosted advisors returned 28 informational RLS-without-policy notices and 20 informational unused-index notices, no warning/error findings. [No policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is intentional here; [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) on a small trial database are not grounds to remove foreign-key/performance indexes. No Supabase Auth users, Storage buckets or Edge Functions were present. Hosted has 16 migrations; local has 17, with differing earlier version numbers, the remote-only trial fee and two local-only additions. Reconcile contents, not counts alone.

### Payment and cash accounting

Server order/amount/currency binding, captured-payment verification, raw-body HMAC and transaction idempotency are implemented and exercised with synthetic provider fixtures. Browser success alone cannot activate membership. Duplicate/out-of-order capture preserves one farmer, membership, receipt and earning. Additional captures remain exceptions; erase retains their financial links. Signature verification and duplicate delivery must also be checked against real configuration, consistent with Razorpay's [webhook validation guidance](https://razorpay.com/docs/webhooks/validate-test/) and [webhook behavior](https://razorpay.com/docs/webhooks/).

Cash is recorded against the acting employee and snapshotted fee; it alone does not activate membership. Employee keeps cash and pays online. There is no company settlement or supported partial settlement, so fake/double settlement scenarios have no endpoint to attack. New triggers reject changes/deletion of original cash evidence. Payouts record completed offline disbursements; they do not transfer money. Balance serialization and UUID/payload reuse protect duplicate records. The current balance uses earnings minus payouts; allocation and correction editors are not implemented. Uncertain payouts require reconciliation before a new UUID, especially if browser session storage was lost.

### Validation, UX and accessibility

The [field matrix](AUDIT_20260915_VALIDATION.md) covers every current form and API-edited field, expected types, client/server rules and bounds. Server validation remains authoritative. Names retain Marathi and legitimate punctuation; mobile/Aadhaar keep the owner's exact ASCII-digit rule; acreage rejects silent two-decimal rounding; enums/geography/crops/referrals and IDs are validated. Safe errors identify fields without echoing private values. Narrow digit input guards improve typing/paste behavior without silently stripping a pasted identity. PIN/PAN/email/business/upload fields do not exist.

Public registration through receipt, employee onboarding, own pending queue, manager operations and super-admin Trash/erasure were traced through code and isolated tests. Loading/error/empty states exist; new network feedback, payout recovery and explicit success improve the identified gaps. Erased profiles remain unavailable while permitted finance review continues. History pagination, account recovery and real payment-device acceptance remain limited as above.

Browser checks at widths 320, 390, 768 and 1280 found no horizontal overflow on home/register/login; seven operations routes were checked at mobile width. Escape/focus return, Unicode text, input feedback and hidden demo controls were checked. The registration action originally measured 3.79:1 white-on-orange contrast; using the existing green token removed failures from the limited solid-color text scan. This scan excludes gradients, images, transparency and some control states and is not axe/WCAG certification. Manual assistive-tech review remains needed under [error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) and [name/role/value guidance](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html).

## Adversarial verification

| Scenario | Result / scope |
|---|---|
| Logged-out mutation, expired/revoked session, employee direct admin access | Rejected in isolated HTTP/SQL suites; current account role/activation is checked server-side |
| Change farmer/registration ID to another employee's record | Denied; scoped grants do not authorize unrelated ownership |
| Supply actor/role or extra editable fields | Acting account remains session-derived; strict profile schema rejects unknown edits; server RPC enforces role |
| Forged payment success, wrong signature/order/amount/currency | Rejected by isolated payment boundary tests/provider fixtures |
| Replay webhook/browser verification, concurrent capture | One entitlement/receipt/earning retained; different extra capture recorded for review |
| Duplicate order creation, submit and refresh/retry | Reservation/retry and duplicate-call tests pass; original fee and submitted details remain fixed |
| Change fee before submit | SQL/HTTP reject stale expected fee; cannot choose price by payload |
| Change/delete cash or original order/webhook evidence; downgrade paid order | SQL rejects tampering; permitted processing still passes regressions |
| Duplicate payout / insufficient balance / response loss | SQL idempotency/balance tests pass; browser retries exact saved payload and clears it only after acknowledged success |
| Erase pending financial record, non-Trash record, staff or unauthorized role | Permanent-delete suite rejects blocked cases atomically |
| Erase completed profile, then duplicate/late capture and finance access | History/idempotency retained; ordinary profile gone; management finance allowed; employee finance denied |
| Bad names, digits, enum/crop/referral, dates, acreage and oversized bodies | Unit/HTTP schema/boundary tests reject; error guidance avoids private value echoes |
| Network failure during registration | Browser abort shows recoverable uncertainty, preserves form/password and enables safe retry |
| Keyboard menu/mobile forms and duplicate submit guards | Browser keyboard/layout checks plus code review; no page JS exceptions in recorded run |
| Direct browser Supabase access | Hosted grants/RLS inspected read-only; isolated privilege tests verify denials |
| Wrong upload type/private file access, KSK, double settlement, SMS delivery | Not applicable: no such application workflows or hosted storage buckets |

### Tests added or extended

- `tests/security-audit.test.ts`: Unicode name rules, precision/referral/PII-safe errors, saved payout validation and payment-secret pairing.
- `tests/audit-financial-controls.sql`: fee expectations/snapshots, financial tamper guards, pending ownership, cross-employee edit denial, finance access after erasure, retained earnings and capture/receipt uniqueness.
- `tests/e2e-http.mjs`: safe field failures, stale price, logged-out edit and retained management finance/reconciliation after erasure.
- Existing permanent-delete and concurrency suites exercise atomic erasure, blocked financial states, role/password/session protection and simultaneous purge/capture. These originated in the preceding Trash fix and were rerun as regression coverage.
- The local Playwright audit harness records responsive, keyboard, limited contrast, network-loss, dynamic-fee and saved-payout checks; synthetic routes/provider responses do not prove real gateway delivery.

### Commands and evidence

| Command / check | Outcome |
|---|---|
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 32 tests passed |
| `npm run build` | Production build passed; 25 generated static entries, dynamic protected/payment routes |
| Ordered SQL migration rehearsal + geography seed | All 17 local migrations applied to a fresh isolated PostgreSQL 16 database |
| `npm run test:db` | Five SQL suites passed, including new financial controls and permanent deletion |
| `npm run test:concurrency` | 12-way order/finalization and purge/capture scenarios passed |
| `npm run test:http` | Isolated production-build HTTP journeys passed with synthetic provider responses |
| Local Playwright audit | 25 recorded checks, no page JS errors; no measured solid-color text contrast failures after fix |
| `npm audit --audit-level=high` | Successful registry audit reported zero vulnerabilities across 405 dependencies; initial sandbox network failure was retried with approved access |
| `git diff --check` | Passed |
| Reachable Git history scan | 508 reachable blobs scanned for known secret patterns, zero hits; only tracked environment template was `.env.example` |
| Exact configured-secret scan | Five configured sensitive values compared against reachable Git objects and built client static assets, zero matches; no values printed |
| Hosted Supabase metadata/advisors | Read-only findings summarized above; no remote mutation |

Sanitized browser results are retained in [verification evidence](AUDIT_20260915_RESULTS.json). Secret scanning is limited to reachable objects and selected patterns/known configured values: it cannot prove absence in unknown formats, unreachable history, other clones, provider logs or previously exposed infrastructure. Environment-file permissions and deployment secret access still require production review.

## Unperformed acceptance and remaining recommendations

Before promotion, resolve H01–H03 and the release procedure in [production runbook](PRODUCTION_RUNBOOK.md). Complete manual penetration testing of the deployed domain, an independent external security review proportionate to its PII/payment exposure, and production configuration review. Specifically inspect Razorpay live merchant/capture/webhook settings and Supabase API exposure/grants/secrets/backup access after deployment. Confirm trusted proxy headers, throttling under load, alerts and managed recovery. No new hosted restore drill, production load test, actual mobile gateway transaction, full screen-reader/zoom/high-contrast assessment or independent penetration test was performed in this audit.

DLT/SMS provider configuration is not applicable to the current application because no SMS workflow is implemented. Reassess consent, templates, sender/provider configuration and delivery before introducing it. Likewise, re-audit Supabase Auth/Storage, uploads or KSK if they are added; their absence is not a passed security test.
