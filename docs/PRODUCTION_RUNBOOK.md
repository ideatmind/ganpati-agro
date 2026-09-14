# Production acceptance and recovery

## Release sequence

1. Preserve an encrypted database backup and verify restoration into a separate project before enabling real payments. Provisional targets: RPO <= 15 minutes, RTO <= 4 hours; the business must approve these and the hosting plan must support them.
2. Use separate Supabase projects, Razorpay keys, webhook secrets, session secrets and PII keys for staging and production. Set canonical HTTPS `NEXT_PUBLIC_APP_URL` at build time and the exact allowed application origin in server-only `APP_ORIGIN` at runtime. Preview deployments need their own allowed origin. `RAZORPAY_KEY_ID` is now returned by the order API as a public checkout key; a separate `NEXT_PUBLIC_RAZORPAY_KEY_ID` is no longer used.
3. Confirm a trusted proxy overwrites the selected client-IP header before setting `TRUSTED_CLIENT_IP_HEADER`. Never pass through a caller-controlled forwarded header. An unset header deliberately shares a conservative anonymous limit. Configure edge/WAF abuse limits too; application limits consume database resources.
4. Match deployed migration **names and versions** before applying anything. The existing remote project records timestamps for local `0001`–`0004`; the two emergency privilege migrations also have server-generated timestamp IDs. Do not run an unreviewed `db push` that replays these files. Already applied remotely: `restrict_privileged_rpcs`, `default_function_privileges`. Pending release migrations in order: `payment_reliability`, `auth_and_operations_hardening`, `mvp_payment_fast_paths`, `mvp_admin_operations`, `mvp_registration_order_index`, `admin_workspace`, `admin_delete_confirmation`, `village_directory_geography`, `crop_categories`.
5. Drain/temporarily disable checkout during the coordinated migration and application release. The new order-reservation protocol and payout signature require the new application. The new session-cookie purpose intentionally signs out old sessions. Apply the pending migrations in filename order, verify RPC privileges, then deploy the application and run staging smoke tests. No migration deletes customer or financial rows. The geography FK is NOT VALID to preserve historic rows; inspect and correct invalid geography before validating it.
6. Require the CI job, branch review and controlled release approval in the repository/host settings. The checked-in workflow does not itself configure branch protection, deploy, or enable alerts. Confirm both hosted CI and staging acceptance pass.
7. Validate Razorpay checkout, app-switch return, capture configuration, webhook endpoint/subscriptions, provider retries, and settlement reconciliation with test keys first. Subscribe to capture/order-paid and applicable refund/dispute notifications. A synthetic provider test is insufficient for this gate.
8. For rollback, prefer a forward fix while keeping the new schema. Do not roll the application back to the old checkout or payout callers against the new RPC contracts. Never restore a pre-release database over payments accepted since the backup. Reconcile the provider before any data recovery.

## Payment recovery

### Browser lost connection or was closed

Reopen `/register` in the same browser within seven days. The HttpOnly checkout capability restores the registration; `Check payment status` fetches Razorpay payments for its stored order and finalizes captured payments. It never treats a client success flag as authoritative. With no cookie, submit the original registration credentials and Aadhaar again: only a matching existing password, identity fingerprint and onboarding actor can resume the saved registration. Submitted edits are not applied on retry. If the user cannot provide those credentials, route to a verified support process; there is no insecure lookup by mobile alone.

### Provider order request timed out

Inspect `private.checkout_orders` in state `creating` joined to the registration reference. Search the merchant's Razorpay dashboard for that exact receipt/reference. Do not clear the reservation or issue a replacement just because a timeout elapsed. The provider may have accepted the request.

If an order exists, verify its merchant, reference, INR amount and associated captured payments. Bind the known order through `record_payment_order` with the stored registration ID/request key, then verify the capture through the normal server/provider path. Never pass invented success or signature-verification flags from a browser. If no order can be located, escalate to provider support before authorizing any replacement. Record the investigation; the automated path intentionally remains blocked until the uncertain outcome is resolved.

### Failed or missing webhook

`payment_events.status='failed'` is durable. The HTTP endpoint returns 503 so Razorpay can retry. Replaying the same signed event retries a failed event; a processed event is a no-op. An event arriving before the local order is bound can recover after binding. Keep the exact original payload available in the provider console for resends; do not copy payloads containing PII into application logs.

When webhook retries are exhausted, use the checkout status reconciliation path or an authorized server process that fetches the provider payment again. There is **no scheduled reconciliation worker yet**. For the MVP, assign an operator to the paginated Exceptions view and its registration-level Check provider status action. A scheduled worker is optional future automation, not required infrastructure. Never automatically retry provider order creation.

### Additional capture, refund or dispute

An additional captured payment is preserved in `payment_attempts` and emits `additional_capture_requires_review`; it does not issue another membership or commission. Refund/dispute notifications are recorded and emit `payment_adjustment_requires_review`. Review these immediately. The MVP provides no refund interface/API and does not automatically adjust balances or entitlements for these events. Investigate in the provider console and retain the operational exception; external provider action does not authorize overwriting original application finances. Do not overwrite/delete receipts, earnings, payouts, captures or audit events. No refund workflow is introduced.

## Offline payouts

Record a payout only after offline disbursement. The UI keeps one pending request ID in sessionStorage until a successful acknowledgement. A network retry with the same request and ID returns the same payout. Changed contents with the same ID are rejected. Check existing history before clearing an unresolved request ID. Two separately entered payouts with separate IDs still represent two business actions; verify the offline reference and disbursement rather than repeatedly entering it. Different requests are serialized against the available balance; excessive amounts are rejected. Partial paise are rejected, not rounded. There is no claim-request feature or later employee/company cash settlement.

## Monitoring and incident ownership

Ship structured application logs to the chosen host's log drain. `api_request` records request ID, normalized operation, method, status and duration; `operation_timing` records DB/provider operation, success and duration, correlated to the request. `Server-Timing` exposes the same static operation names without input values. Neither includes body, cookies, credentials or SQL errors. Redact receipt capability tokens and all query strings from host/access logs too. Protect log access and set a retention period. Server-rendered page errors and provider network failures still need a central exception monitor; current application logging is a baseline, not a configured monitoring service.

Suggested alerts (provisional, configure and test delivery):

| Signal | Threshold | Response |
|---|---|---|
| New publicly executable privileged RPC | Any | Block release, revoke access, investigate |
| Additional capture / refund-dispute review event | Any | Payment operator immediately |
| Failed capture webhook | Any lasting 5 minutes | Reconcile provider and internal records |
| Unbound checkout reservation | Older than 5 minutes | Investigate uncertain provider request |
| API 5xx | >1% over 5 minutes, with minimum 20 requests | On-call dependency check |
| API p95 | >1s reads or >3s checkout over 10 minutes | Separate DB/provider/host latency |
| Rate limiting | Sustained spike vs baseline | WAF review, never weaken validation |
| Database connections/CPU/storage | >70% sustained | Capacity review before saturation |
| Backup/restore drill | Failed or overdue | Stop launch/changes until recovered |

Safe read-only operational queries:

```sql
select provider_event_id,event_type,status,received_at,error_message
from public.payment_events where status='failed' order by received_at limit 100;

select g.reference,c.created_at from private.checkout_orders c
join public.registrations g on g.id=c.registration_id
where c.state='creating' and c.created_at<now()-interval '5 minutes'
order by c.created_at limit 100;

select action,target_type,target_id,created_at from public.audit_events
where action in ('additional_capture_requires_review','payment_adjustment_requires_review')
order by created_at desc limit 100;

select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
and (has_function_privilege('anon',p.oid,'execute')
or has_function_privilege('authenticated',p.oid,'execute'));
```

## Privacy, keys and recovery ownership

Define why Aadhaar and birth date are necessary, approved retention for unpaid registrations and ciphertext, user export/correction procedures, and a verified support process for account recovery. Avoid inventing legal retention periods. The fingerprint currently shares the encryption key: rotating it changes uniqueness fingerprints. A planned key-version/fingerprint migration is required; do not simply replace `PII_ENCRYPTION_KEY` and leave existing data unchanged. Test restored backups with separately protected key recovery material. Session-secret rotation signs out accounts and invalidates checkout capabilities; support must account for unfinished registrations.

MFA/step-up authentication, breached-password screening and self-service password recovery are future/operational hardening items; they are not MVP release gates under the current scope. Authenticated password change is implemented and revokes all sessions. The default development seed password was checked against active accounts on the connected project: zero matches during the audit.

## Reproduce the checks

Use Node 22.18+ and an isolated PostgreSQL 16 database on loopback. `tests/database-bootstrap.sql` creates the Supabase-style test roles and pgcrypto schema in a fresh database/cluster; do not run that bootstrap against a real Supabase project. Apply migrations in filename order and the geography seed. Set `TEST_DATABASE_URL` and, on Windows, `PSQL_PATH` to `psql.exe`.

Run `npm run lint`, `npm run typecheck` (after `npx next typegen` on a fresh checkout), `npm test`, `npm run test:db`, `npm run test:concurrency`, `npm run build`, and `npm run test:http`. The SQL regression rolls back. Concurrency/HTTP tests create synthetic fixtures and should use a disposable database. HTTP tests launch their own local RPC/provider fixtures on ports 55434 and 3101 and stop them when finished. They never call the real Razorpay API. Real gateway/browser acceptance remains separate.

## Vercel release configuration — 15 September 2026

Use Node 22.x and Mumbai (`bom1`). The production canonical origin is `https://ganpatiagro.in`; www redirects there before forms are rendered. Vercel overwrites `x-vercel-forwarded-for`, which is configured as TRUSTED_CLIENT_IP_HEADER for production and previews. Each preview must use an exact matching APP_ORIGIN and build-time NEXT_PUBLIC_APP_URL; the release preview uses `https://ganpati-agro-release-20260915.vercel.app`.

The current release preview shares the existing hosted database configuration. Limit it to public/read-only smoke checks until isolated staging or a coordinated schema/application release is ready. Do not create synthetic captured payments or copy local test accounts into the hosted database. Existing PII/session secrets were preserved.

A Windows-user-encrypted pre-release logical backup was restored into isolated local PostgreSQL with all 24 application-table counts verified. The nine pending migrations then preserved account, registration and financial row counts. Keep the backup and its recovery access private; this drill does not replace a managed-project restoration/operational recovery exercise.

Production currently has Razorpay TEST credentials. The application blocks test-key checkout in the production environment. A READY preview alone is not a release gate: resolve the payment-mode decision, finish hosted gateway acceptance, and coordinate the nine migrations with the application before promoting live domains.

## Preventing canonical-domain redirect loops

Keep `ganpatiagro.in` assigned directly to Production with its Vercel project-domain `redirect` set to null. The application's next.config.ts already sends www.ganpatiagro.in to https://ganpatiagro.in. Do not configure the opposite apex-to-www redirect in Vercel: both rules together loop indefinitely. APP_ORIGIN and NEXT_PUBLIC_APP_URL must continue to use the canonical apex.

After deploying or changing domains, run `node scripts/check-production-redirects.mjs`. It makes public GET requests and verifies one www-to-apex hop followed by HTTP 200 for home, registration and login, preserving path and query string. This live smoke check is separate from offline CI.

The conflicting Vercel redirect was removed and these checks passed on 15 September 2026. No application redeployment was required for the repair. If a browser retains the old permanent redirect, retry in a private window or clear the site's cached redirect.

## Hosted migration ledger — applied 15 September 2026

All nine release migrations are now applied. Earlier references to these as pending are historical. Do not replay their local files: the management API recorded the following remote versions. The existing initial four and two emergency privilege migrations remain unchanged.

| Migration name | Hosted version |
|---|---|
| payment_reliability | 20260914191043 |
| auth_and_operations_hardening | 20260914191125 |
| mvp_payment_fast_paths | 20260914191132 |
| mvp_admin_operations | 20260914191149 |
| mvp_registration_order_index | 20260914191155 |
| admin_workspace | 20260914191202 |
| admin_delete_confirmation | 20260914191216 |
| village_directory_geography | 20260914191222 |
| crop_categories | 20260914191229 |

A fresh encrypted backup was taken immediately before application. Account/person checksums and account, registration and financial counts were preserved. Hosted login-to-RPC connectivity, rolled-back successful authentication/password/session checks, all nine admin workspace sections, RLS and privileged-RPC grants passed. All synthetic database changes were rolled back; existing passwords were not reset.

Supabase advisors returned informational [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) notices for the intentionally service-only tables and [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) on the low-traffic database. No warning/error findings were returned. Keep deny-by-default access and the release's indexing until real workload measurements justify changes.

The deployed application and hosted schema now share the required RPC contracts. Schema completion does not establish live payment acceptance: the existing production TEST-key guard remains, and real checkout/capture/webhook/app-return verification is still outstanding. Preserve the new schema during recovery; do not roll back to old authentication/order/payout callers.

## Temporary form switch for the private test phase

Set ENABLE_PAYMENT_MODE_SWITCH=true in Vercel Production and redeploy to show Test mode ON/OFF. ON uses RAZORPAY_TEST_KEY_ID/RAZORPAY_TEST_KEY_SECRET; OFF uses RAZORPAY_LIVE_KEY_ID/RAZORPAY_LIVE_KEY_SECRET. The existing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET pair remains a fallback only for its matching key-ID mode. Keep the current standard pair as TEST credentials and add the explicit LIVE pair when ready. Never put secrets in NEXT_PUBLIC variables.

The checkout mode lives only in its signed HttpOnly browser cookie. No database mode field is added. Select mode before registration; it is locked for saved checkout/retries. Existing orders are verified with the selected provider keys, and administrator reconciliation checks either configured provider account when necessary. Missing live credentials produce an explicit message rather than falling back to test checkout.

Razorpay test and live webhooks can both use https://ganpatiagro.in/api/payments/webhook. Configure their matching RAZORPAY_TEST_WEBHOOK_SECRET and RAZORPAY_LIVE_WEBHOOK_SECRET; the original RAZORPAY_WEBHOOK_SECRET remains supported. Verify payment.captured/order.paid delivery for each configured mode. The switch does not enable simulated payment signatures or bypass captured-payment verification.

The owner explicitly approved test membership/receipt/referral records in this current private-test database. No records were deleted. Before public launch, separately reconcile/clear the test dataset as instructed by the owner, remove demo controls, configure live credentials/webhooks, set ENABLE_PAYMENT_MODE_SWITCH=false, and redeploy. Do not treat test entries as real collections.

## Live INR 1 trial (supersedes temporary switch instructions)

Production accepts live credentials only. Configure RAZORPAY_LIVE_KEY_ID, RAZORPAY_LIVE_KEY_SECRET and the separate RAZORPAY_LIVE_WEBHOOK_SECRET as server-only Vercel production variables. The webhook must subscribe to payment.captured and order.paid at /api/payments/webhook. The removed ENABLE_PAYMENT_MODE_SWITCH flag cannot re-enable test mode. Apply the live_trial_fee migration once before promoting the release; do not replay earlier hosted migrations. New registrations quote 100 paise while existing quote snapshots are retained. Complete the release gates in LIVE_PAYMENT_SECURITY_REVIEW.md.


### Protected standard webhook secret

If the LIVE signing secret was saved as RAZORPAY_WEBHOOK_SECRET, set RAZORPAY_WEBHOOK_MODE=live in Vercel Production and redeploy. This is an explicit operator assertion that the standard secret belongs to the live webhook, never a browser mode switch. RAZORPAY_LIVE_WEBHOOK_SECRET takes precedence if present. The hosted live_trial_fee migration has already been applied; do not replay it. Verify a real captured payment and webhook delivery separately.
