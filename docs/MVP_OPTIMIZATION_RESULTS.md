# MVP optimization results — 14 September 2026

This implements the follow-up to the production audit, rather than repeating it. Measurement files beside this report contain samples, sizes and query plans. Values are milliseconds unless specified. **The implementation is tested locally and built as an unpromoted Vercel candidate; the coordinated production database/application release remains pending real hosted-checkout acceptance.**

## What was slow and what changed

- The old admin read returned roughly 1.07 MB of JSON and 3.45 MB of rendered HTML at 10,000 registrations. Seven server-paginated sections now return 25 rows, with bounded search and 20-result form lookups. HTML fell to 53,964 bytes (98.4% smaller).
- Login, order creation, verification and status incurred redundant serial database round trips. Combined RPCs preserve durable throttling and perform the related lookup/reservation/authentication in one transaction. The final financial transaction still creates the farmer, membership, receipt and referral earning together.
- The live application's dynamic functions were in Washington, DC while Supabase is in Mumbai. The candidate's application functions are verified in `bom1`, configured by `vercel.json`.
- Saving registration now clears sensitive inputs and starts checkout immediately. SDK loading overlaps the order request. Existing checkout restores only when its cookie is present; a fresh form makes no needless status request. The gateway script is not loaded on unrelated public pages or before sensitive submission fields are cleared.
- The hero video falls from 3,891,655 to 1,702,052 bytes (56.3% smaller). Mobile starts with the poster and an explicit play control; desktop loads the smaller video when visible. Reduced motion, pause controls, reveals, bilingual labels and all registration attributes remain.
- Admin actions have scoped loading/error feedback, searches, confirmation for offline payout recording and staff deactivation, grant revocation, registration/payment details and provider reconciliation. Staff accounts without referral profiles no longer receive a broken `ref=null` link.

## Comparable local measurements

Twenty sequential requests per route, production builds, the same isolated 10,000-registration PostgreSQL fixture and simulated Razorpay. The test RPC bridge starts `psql` per call, adding local process overhead. These are end-to-end HTTP timings, not real-provider or production-load benchmarks. p99 is the maximum of only 20 samples; cold requests are included. Registration save still includes password hashing and durable identity writes. Dashboard and receipt p95 did not improve; no improvement is claimed for those routes.

| Route / API | Before p50 / p95 / p99 | After p50 / p95 / p99 |
|---|---:|---:|
| home | 6 / 13 / 622 | 4 / 9 / 353 |
| registrationPage | 12 / 16 / 137 | 10 / 13 / 98 |
| loginPage | 7 / 10 / 33 | 6 / 8 / 13 |
| registrationSave | 449 / 638 / 737 | 435 / 560 / 592 |
| order | 249 / 374 / 375 | 172 / 280 / 305 |
| verification | 260 / 398 / 403 | 180 / 226 / 281 |
| status | 154 / 213 / 308 | 82 / 114 / 237 |
| receipt | 95 / 140 / 169 | 95 / 147 / 162 |
| login | 509 / 610 / 727 | 340 / 391 / 423 |
| dashboard | 176 / 190 / 230 | 169 / 261 / 279 |
| admin | 2086 / 2271 / 2306 | 200 / 306 / 320 |

`MVP_BEFORE_HTTP.json` and `MVP_AFTER_HTTP.json` also include response TTFB and `Server-Timing` for API calls. Successful verification's finalization RPC took 87 ms in the saved after sample; this includes bridge overhead, not just database execution. Request logs and headers separate DB/provider operations, include a correlation ID and exclude bodies, identifiers, credentials and secrets. Browser performance marks cover Pay, order response, checkout opening and verification; no trustworthy browser rendering/hydration/LCP trace was obtained.

## Public candidate and assets

Measurements used candidate `dpl_28FaxNtRApZdgPNqbCAU3473bbKu`; the final candidate adds only a mobile dashboard CSS adjustment. Twelve sequential requests from this Windows host, including the first request, against different deployment URLs. These are indicative network samples, not controlled device benchmarks. p95 is the maximum of 12 samples. The cold candidate homepage was slower; do not describe all public pages as improved.

| Page | Existing live p50 / p95 | Candidate p50 / p95 |
|---|---:|---:|
| Home | 97 / 412 | 211 / 1306 |
| Registration | 373 / 1454 | 128 / 418 |
| Login | 388 / 511 | 136 / 307 |

Home HTML-referenced gzip JS: **184,892 → 185,256 bytes** (+364); CSS: **8,137 → 8,894 bytes**. There is no measured JavaScript reduction. The main asset gain is deferred/smaller video, while the main admin gain is bounded server output. Fonts remain self-hosted. LCP, INP, CLS, Lighthouse/mobile score, hydration and JS execution time are **unmeasured**, not passing claims. Farmer-profile latency has no before/after sample.

Budgets remain: mobile LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1; public p95 TTFB ≤800 ms; dashboard ≤1 s, admin ≤1.5 s; order ≤1.5 s and verification ≤2 s under normal provider conditions. Local API samples meet these API budgets; field/mobile budgets are not yet certified.

## Database scale

At 50,000 synthetic registrations, the new admin RPC returns 7,429 bytes: p50/p95 wall time 101/118 ms; `EXPLAIN ANALYZE` execution 27.773 ms. Referrer list: 146/160 ms wall time, 86.828 ms execution. Prefix search: 116/145 ms wall time, 64.969 ms execution. These wall times include `psql` startup. The fixtures live only in isolated PostgreSQL.

The recent-registration query previously scanned/joined the dataset and sorted it. The `(created_at DESC, id DESC)` index allows an ordered index scan stopping after 26 rows; measured execution was 0.294 ms at 50,000 rows versus 6.622 ms on the earlier 10,000-row plan. These are different volumes, so they demonstrate the plan change rather than a like-for-like speedup. Totals/search still perform bounded-result scans and are acceptable at the measured scale. No Redis, queue, cache of private data or speculative index set was added.

## Payment acceptance

PASS below identifies its actual test layer. A simulated provider pass is not real hosted-checkout acceptance.

| Scenario | Expected | Actual DB/provider/UI evidence | Result |
|---|---|---|---|
| Real TEST order creation | One ₹500 INR order | Actual Razorpay order created; API 854 ms, reservation 172 ms, provider 545 ms, binding 123 ms; registration remains pending with no membership | PASS: real order API |
| Hosted checkout launch | TEST payment methods visible | In-app browser opens provider frame/Test Mode badge but the content is blank; user is checking desktop Chrome | BLOCKED: real hosted checkout |
| Successful capture | One farmer/membership/receipt/earning | SQL + HTTP simulated capture finalize once; ₹50 earning on ₹500 fixture | PASS: integration; real completion pending |
| Wrong signature/order/payment/amount/currency or uncaptured payment | Reject; no entitlement | Boundary/unit and SQL checks reject mismatches; HTTP wrong signatures rejected | PASS: automated |
| Duplicate click/two callers | One reservation/order | Concurrent HTTP requests reuse the bound order; 12-way reservation test passes; frontend uses immediate ref guard | PASS: backend; real double-tap pending |
| Browser callback + duplicate webhook | Same receipt | HTTP duplicate callbacks/webhooks and 12 simultaneous finalizers create one set of financial records | PASS: automated |
| Webhook before local binding/callback | Retry durably | Early event remains failed; retry after binding completes; late failure does not downgrade completion | PASS: SQL |
| Callback missing/browser closed | Reconcile captured provider state | Signed cookie recovery/status routes implemented; real browser reload restores pending checkout and real provider check returns pending | PARTIAL: real post-payment close pending |
| Failed/dismissed/cancelled checkout | Clear state, allow safe status check | Distinct failed/dismissed states implemented; real hosted frame prevents end-to-end execution | PARTIAL |
| Network/provider timeout | Uncertain; do not create replacement | Bounded requests; uncertain reservation prevents duplicate creation in SQL; real offline/slow-network fault injection not executed | PARTIAL |
| Refresh before/while pending | Restore saved registration | Browser reload displays saved reference, amount and status control; no additional order | PASS: browser pending state |
| Refresh after payment | Existing receipt | HTTP cookie/status recovery returns same receipt after simulated capture | PASS: HTTP; real browser pending |
| Additional capture | Preserve capture, flag exception, no second benefit | SQL preserves extra payment and emits one audit exception | PASS: SQL |
| Provider refund/dispute/reversal/correction | Record exception; immutable finances | Event-family handling records review; refund notification linked via payment ID to its order, membership unchanged | PASS: refund SQL path; other real provider events pending |
| Mobile background/app switch/return | Recover from authoritative state | Android and iPhone/Safari devices unavailable to automation; no successful hosted payment yet | BLOCKED: device acceptance |

Real checkout launch, real verification and real finalization latency remain unmeasured. A cold read-only Razorpay probe was 1,159 ms and warm probes were 639/582 ms, separate from the actual 545 ms order call. Do not substitute those reads for capture-verification latency.

## Admin and UI acceptance

| Feature | Evidence | Status |
|---|---|---|
| Role authorization, employee ownership | SQL/HTTP reject unauthorized operations and unrelated farmers | PASS |
| Staff creation, activation/deactivation | HTTP create → disable → login rejection → activate; SQL verifies existing-session revocation | PASS |
| Registrations/search/pagination | 25-row pages, URL search/page state; browser search and detail navigation; 50k fixture measurements | PASS |
| Registration/payment/membership detail | Masked mobile, internal/provider IDs, expected/verified amounts, timestamps, receipt/profile links | PASS |
| Provider status reconciliation | Ops-only HTTP check; isolated browser real pending-status check; uncertain unbound order cannot issue a replacement | PASS: API; real capture pending |
| Referrer balances and completed offline payouts | Bounded referrer search, visible available balance, immutable payout history; retry/overdraw SQL checks | PASS: integration; UI submission not repeated manually |
| Scoped grants/revocation | Employee-scoped lookup, expiry/fields list, grant revocation; SQL ownership/field/revocation enforcement | PASS: integration |
| Exceptions and audit | Paginated failed webhook, provider adjustment, extra capture, uncertain reservation and audit views | PASS: integration |
| Mobile admin | No page overflow at 320, 360, 375, 390, 412, 430, 768 and 1440 px; 25 visible cards; 390px detail visually checked | PASS: emulation |
| Registration/form/payment UI | Bilingual grouping retained; no overflow at all eight tested widths; no Razorpay script in fresh form DOM; meaningless legend glyphs removed; larger touch targets; compact saved-payment panel and explicit progress/errors | PASS: inspected; device keyboard/app-switch pending |
| Dashboard cleanup | Hide absent referral profile and irrelevant referral totals; retain operational/onboarding information | PASS: build/typecheck and mobile browser |
| Empty/loading/error states | Each admin section and action provides feedback; pending checkout explains status uncertainty | PASS: implementation/HTTP |
| In-app refunds, claims, MFA, SMS/OTP, OAuth | Explicitly excluded by MVP scope | NOT REQUIRED |
| Self-service account recovery | Authenticated password change exists; recovery remains a future/operational item | NOT REQUIRED for this MVP |

## Release state and practical follow-up

- Local lint, typecheck, 12 unit/security tests, SQL regression, 12-way reservation/finalization, isolated HTTP payment/admin journey and production build pass. All 11 ordered migrations were applied successfully to a fresh isolated database. Hosted CI/branch protection is not asserted as configured.
- Candidate: `dpl_G7bgUEaHmgVSCuKFdDzYyj3xuQAR`, [Vercel inspection](https://vercel.com/ganeshs-projects-837a4550/ganpati-agro/G7bgUEaHmgVSCuKFdDzYyj3xuQAR). Build succeeded; application runtime is Mumbai. Its generated project alias was restored to the old deployment so the candidate remains isolated.
- Live custom domain still points to `dpl_4yGUnhncszfcPYMArXBh4rFTQxdQ`. Remote Supabase still has only the initial four and two emergency privilege migrations; five release migrations remain pending. Latest remote read found five registrations and zero payment attempts. No customer data was replaced with fixtures.
- Pending sequence: `payment_reliability`, `auth_and_operations_hardening`, `mvp_payment_fast_paths`, `mvp_admin_operations`, `mvp_registration_order_index`. Do not replay the remote initial migrations under the local filenames. Coordinate application promotion with these changed RPC contracts; the candidate's authenticated/payment routes are not usable against the old schema.
- Before live checkout promotion, resolve hosted-checkout acceptance and verify production live-key/capture/webhook settings. The application rejects test-key order creation in Vercel production. Test keys remain confined to the local synthetic database workflow. Production key values were not downloaded: automatic approval review rejected that secret-copy action, and the candidate build reused the existing remote environment.
- Use existing Vercel logs, `Server-Timing`, Supabase database metrics and the Exceptions tab for MVP monitoring. Alert delivery, webhook subscriptions, trusted edge-IP configuration and backup restoration remain unverified external configuration. No new observability platform or mandatory scheduled worker was introduced.

MFA and self-service recovery are future hardening items, not release gates for this scope. Provider exceptions require operator investigation; there are no refund APIs/buttons or automatic historical financial adjustments.
